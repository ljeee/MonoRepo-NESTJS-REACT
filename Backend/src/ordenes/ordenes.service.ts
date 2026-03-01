import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between} from 'typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {CreateOrdenesDto, CreateOrdenItemDto, FindOrdenesDto} from './esquemas/ordenes.dto';
import {FacturaCreationService} from './services/factura-creation.service';
import {DomicilioCreationService} from './services/domicilio-creation.service';
import {ProductProcessingService} from './services/product-processing.service';
import {OrdenesGateway} from './ordenes.gateway';

@Injectable()
export class OrdenesService {
	constructor(
		@InjectRepository(Ordenes) private readonly repo: Repository<Ordenes>,
		private readonly ordenesGateway: OrdenesGateway,
		private readonly facturaCreationService: FacturaCreationService,
		private readonly domicilioCreationService: DomicilioCreationService,
		private readonly productProcessingService: ProductProcessingService
	) {}

	async findAll(query: FindOrdenesDto = {}) {
		const { estado, from, to, page = 1, limit = 500 } = query;
		const qb = this.repo.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.orderBy('o.fechaOrden', 'DESC')
			.take(limit)
			.skip((page - 1) * limit);

		if (estado) {
			qb.andWhere('o.estadoOrden = :estado', { estado });
		}
		if (from && to) {
			qb.andWhere('o.fechaOrden BETWEEN :from AND :to', { from: new Date(from + 'T00:00:00'), to: new Date(to + 'T23:59:59') });
		} else if (from) {
			qb.andWhere('o.fechaOrden >= :from', { from: new Date(from + 'T00:00:00') });
		} else if (to) {
			qb.andWhere('o.fechaOrden <= :to', { to: new Date(to + 'T23:59:59') });
		}

		const [data, total] = await qb.getManyAndCount();
		return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
	}

	findByDay(estado?: string) {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		const qb = this.repo.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.leftJoinAndSelect('o.domicilios', 'domicilios')
			.where('o.fechaOrden BETWEEN :start AND :end', { start, end });

		if (estado) {
			qb.andWhere('o.estadoOrden = :estado', { estado });
		}

		return qb.getMany();
	}

	findByDaySinPendientes() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo
			.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.where('o.fechaOrden BETWEEN :start AND :end', {start, end})
			.andWhere('o.estadoOrden != :pendiente', {pendiente: 'pendiente'})
			.getMany();
	}

	findPendingByDay() {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		return this.repo
			.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.where('(o.estadoOrden = :pendiente OR o.estadoOrden IS NULL)')
			.andWhere('o.fechaOrden BETWEEN :start AND :end', {start, end, pendiente: 'pendiente'})
			.getMany();
	}

	async findOne(id: number) {
		const orden = await this.repo.findOne({
			where: {ordenId: id},
			relations: ['factura', 'productos', 'productos.productoObj', 'productos.variante', 'domicilios'],
		});
		if (!orden) {
			throw new NotFoundException(`Orden con ID ${id} no encontrada`);
		}
		return orden;
	}

	// ==================== OPERACIONES ATÓMICAS ====================

	private esDomicilio(tipoPedido?: string): boolean {
		return (tipoPedido || 'mesa') === 'domicilio';
	}

	private async crearOrden(facturaId: number, tipoPedido?: string, estadoOrden?: string, observaciones?: string): Promise<Ordenes> {
		const orden = this.repo.create({facturaId, tipoPedido, estadoOrden, observaciones});
		return this.repo.save(orden);
	}

	// ==================== MÉTODO PRINCIPAL ====================

	async create(data: CreateOrdenesDto) {
		const productos = Array.isArray(data.productos) ? data.productos : [];
		const descripcion = productos.length > 0 
            ? this.facturaCreationService.generarDescripcionFactura(productos, this.productProcessingService.construirNombreProducto.bind(this.productProcessingService)) 
            : '';

		// 1. Crear factura
		const factura = await this.facturaCreationService.crearFactura(data.nombreCliente || '', data.metodo, descripcion);

		// 2. Crear orden
		const orden = await this.crearOrden(factura.facturaId, data.tipoPedido, data.estadoOrden, data.observaciones);

		// 3. Procesar productos y calcular total
		let total = 0;
		if (productos.length > 0) {
			const result = await this.productProcessingService.procesarProductos(orden.ordenId, productos);
			total = result.total;
		}

		// 3.5 Sumar costo domicilio al total
		if (this.domicilioCreationService.esDomicilio(data.tipoPedido) && data.costoDomicilio) {
			total += Number(data.costoDomicilio);
		}

		// 3.6 Persistir total en factura
		if (total > 0) {
			await this.facturaCreationService.updateFacturaTotal(factura.facturaId, total);
			factura.total = total;
		}

		// 4. Procesar domicilio si aplica
		if (this.domicilioCreationService.esDomicilio(data.tipoPedido)) {
			await this.domicilioCreationService.procesarDomicilio(data, factura.facturaId, orden.ordenId);
		}

		const fullOrden = await this.findOne(orden.ordenId);
		this.ordenesGateway.emitirNuevaOrden(fullOrden);

		return fullOrden;
	}

	async update(id: number, data: Partial<CreateOrdenesDto>) {
		await this.repo.update(id, data);
		// Return the updated order with relations
		const updated = await this.findOne(id);
		this.ordenesGateway.emitirOrdenActualizada(updated);
		return updated;
	}

	remove(id: number) {
		return this.repo.delete(id);
	}

	async cancel(id: number) {
		const orden = await this.findOne(id);
		if (!orden) throw new NotFoundException('Orden no encontrada');

		// 1. Cancelar orden
		orden.estadoOrden = 'cancelado';
		await this.repo.save(orden);

		// 2. Cancelar factura asociada
		if (orden.facturaId) {
			await this.facturaCreationService.cancelarFactura(orden.facturaId);
		}

		this.ordenesGateway.emitirOrdenActualizada(orden);

		return orden;
	}

}
