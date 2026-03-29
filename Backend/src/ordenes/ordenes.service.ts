import {BadRequestException, Injectable, NotFoundException, ConflictException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between, EntityManager} from 'typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {CreateOrdenesDto, CreateOrdenItemDto, FindOrdenesDto} from './esquemas/ordenes.dto';
import {FacturaCreationService} from './services/factura-creation.service';
import {DomicilioCreationService} from './services/domicilio-creation.service';
import {ProductProcessingService} from './services/product-processing.service';
import {OrdenesGateway} from './ordenes.gateway';
import {CierresService} from '../cierres/cierres.service';

@Injectable()
export class OrdenesService {
	constructor(
		@InjectRepository(Ordenes) private readonly repo: Repository<Ordenes>,
		private readonly ordenesGateway: OrdenesGateway,
		private readonly facturaCreationService: FacturaCreationService,
		private readonly domicilioCreationService: DomicilioCreationService,
		private readonly productProcessingService: ProductProcessingService,
		private readonly cierresService: CierresService
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

	private async crearOrden(facturaId: number, tipoPedido?: string, estadoOrden?: string, observaciones?: string, manager?: EntityManager): Promise<Ordenes> {
		const repo = manager ? manager.getRepository(Ordenes) : this.repo;
		const orden = repo.create({facturaId, tipoPedido, estadoOrden, observaciones});
		return repo.save(orden);
	}

	// ==================== MÉTODO PRINCIPAL ====================

	async create(data: CreateOrdenesDto) {
		return this.repo.manager.transaction(async (manager) => {
			const productos = Array.isArray(data.productos) ? data.productos : [];
			const descripcion = productos.length > 0
				? this.facturaCreationService.generarDescripcionFactura(productos, this.productProcessingService.construirNombreProducto.bind(this.productProcessingService))
				: '';

			// 1. Crear factura
			const factura = await this.facturaCreationService.crearFactura(data.nombreCliente || '', undefined, descripcion, manager);

			// 2. Crear orden
			const orden = await this.crearOrden(factura.facturaId, data.tipoPedido, data.estadoOrden, data.observaciones, manager);

			// 3. Procesar productos y calcular total
			let total = 0;
			if (productos.length > 0) {
				const result = await this.productProcessingService.procesarProductos(orden.ordenId, productos, manager);
				total = result.total;
			}

			// 3.5 Sumar costo domicilio al total
			if (this.domicilioCreationService.esDomicilio(data.tipoPedido) && data.costoDomicilio) {
				total += Number(data.costoDomicilio);
			}

			// 3.6 Persistir total en factura
			if (total > 0) {
				await this.facturaCreationService.updateFacturaTotal(factura.facturaId, total, manager);
				factura.total = total;
			}

			// 4. Procesar domicilio si aplica
			if (this.domicilioCreationService.esDomicilio(data.tipoPedido)) {
				await this.domicilioCreationService.procesarDomicilio(data, factura.facturaId, orden.ordenId, manager);
			}

			const fullOrden = await this.findOne(orden.ordenId); // Note: findOne is read-only, optionally use manager here too
			this.ordenesGateway.emitirNuevaOrden(fullOrden);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = new Date(fullOrden.fechaOrden).toISOString().split('T')[0];
			await this.cierresService.updateCierreIfExists(fechaStr);

			return fullOrden;
		});
	}

	async update(id: number, data: Partial<CreateOrdenesDto>) {
		return this.repo.manager.transaction(async (manager) => {
			const { productos, ...basicData } = data;
			const oRepo = manager.getRepository(Ordenes);

			// 1. Update basic order data
			const allowedFields = ['tipoPedido', 'estadoOrden', 'fechaOrden', 'observaciones', 'usuarioCancelacionId', 'fechaCancelacion'];
			const updateData: any = {};
			for (const key of allowedFields) {
				if (key in basicData) {
					updateData[key] = (basicData as any)[key];
				}
			}

			if (Object.keys(updateData).length > 0) {
				await oRepo.update(id, updateData);
			}

			let orden = await this.findOne(id);

			// 1.5 Update Domicilio Delivery Data (if is domicilio)
			if (this.domicilioCreationService.esDomicilio(orden.tipoPedido)) {
				await this.domicilioCreationService.updateDomicilioPorOrden(id, data, orden.facturaId); // Note: updateDomicilioPorOrden also needs manager support, but for now it uses repos
				// Refresh orden after domicilio update
				orden = await this.findOne(id);
			}

			// 2. If products are included, re-process everything
			if (productos && Array.isArray(productos)) {
				// a. Delete old relations
				await this.productProcessingService.eliminarProductosDeOrden(id, manager);

				// b. Process new productos
				const { total: totalProductos } = await this.productProcessingService.procesarProductos(id, productos, manager);

				// c. Recalculate total (including domicile cost)
				let newTotal = totalProductos;
				if (this.domicilioCreationService.esDomicilio(orden.tipoPedido)) {
					// We check if it comes in data or we use the one already in the order
					const costoDom = data.costoDomicilio !== undefined ? Number(data.costoDomicilio) : Number(orden.domicilios?.[0]?.costoDomicilio || 0);
					newTotal += costoDom;
				}

				// d. Update Invoice description and total
				const newDescripcion = this.facturaCreationService.generarDescripcionFactura(
					productos,
					this.productProcessingService.construirNombreProducto.bind(this.productProcessingService),
				);

				if (orden.facturaId) {
					await this.facturaCreationService.updateFactura(orden.facturaId, {
						total: newTotal,
						descripcion: newDescripcion,
					}, manager);
				}
			}

			const updated = await this.findOne(id);
			this.ordenesGateway.emitirOrdenActualizada(updated);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = new Date(updated.fechaOrden).toISOString().split('T')[0];
			await this.cierresService.updateCierreIfExists(fechaStr);

			return updated;
		});
	}

	remove(id: number) {
		return this.repo.delete(id);
	}

	async cancel(id: number, reason: string, userId: string) {
		return this.repo.manager.transaction(async (manager) => {
			const oRepo = manager.getRepository(Ordenes);
			const orden = await oRepo.findOne({
				where: {ordenId: id},
				relations: ['factura'],
			});
			if (!orden) throw new NotFoundException('Orden no encontrada');

			const estadoActual = String(orden.estadoOrden || '').toLowerCase();
			const estadosCancelables = ['pendiente', 'preparacion', 'en preparación'];
			
			if (!estadosCancelables.includes(estadoActual)) {
				throw new BadRequestException(`No se puede cancelar una orden en estado: ${orden.estadoOrden}`);
			}

			// 1. Cancelar orden
			orden.estadoOrden = 'cancelado';
			orden.usuarioCancelacionId = userId;
			orden.fechaCancelacion = new Date();
			
			if (reason) {
				const notaCancelacion = `[ANULACIÓN: ${reason}]`;
				orden.observaciones = orden.observaciones 
					? `${orden.observaciones} ${notaCancelacion}`
					: notaCancelacion;
			}
			
			await oRepo.save(orden);

			// 2. Cancelar factura asociada
			if (orden.facturaId) {
				await this.facturaCreationService.cancelarFactura(orden.facturaId, manager);
			}

			const fullUpdated = await this.findOne(id);
			this.ordenesGateway.emitirOrdenActualizada(fullUpdated);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = new Date(fullUpdated.fechaOrden).toISOString().split('T')[0];
			await this.cierresService.updateCierreIfExists(fechaStr);

			return fullUpdated;
		});
	}

	async completar(id: number, metodo: string, userId: string, ip: string, idempotencyKey?: string, lastUpdatedAt?: string) {
		return this.repo.manager.transaction(async (manager) => {
			const oRepo = manager.getRepository(Ordenes);
			const orden = await oRepo.findOne({
				where: {ordenId: id},
				relations: ['factura'],
			});
			if (!orden) throw new NotFoundException('Orden no encontrada');

			// 1. Verificar concurrencia optimista si se provee lastUpdatedAt
			if (lastUpdatedAt && orden.updatedAt) {
				const clientDate = new Date(lastUpdatedAt).getTime();
				const serverDate = new Date(orden.updatedAt).getTime();
				
				if (Math.abs(serverDate - clientDate) > 1000) {
					throw new ConflictException('La orden ha sido modificada por otro usuario. Por favor refresca antes de pagar.');
				}
			}

			// 2. Verificar idempotencia
			if (idempotencyKey) {
				const existing = await this.facturaCreationService.findByIdempotencyKey(idempotencyKey);
				if (existing) {
					return this.findOne(id); 
				}
			}

			// 3. Actualizar Factura
			if (orden.facturaId) {
				await this.facturaCreationService.updateFactura(orden.facturaId, {
					metodo,
					estado: 'pagada',
					usuarioCobroId: userId,
					fechaCobro: new Date(),
					ipDispositivo: ip,
					idempotencyKey,
				}, manager);
			}

			// 4. Marcar Orden como Completada
			orden.estadoOrden = 'completada';
			await oRepo.save(orden);

			const updated = await this.findOne(id);
			this.ordenesGateway.emitirOrdenActualizada(updated);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = new Date(updated.fechaOrden).toISOString().split('T')[0];
			await this.cierresService.updateCierreIfExists(fechaStr);

			return updated;
		});
	}

}
