import {BadRequestException, Injectable, NotFoundException, ConflictException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between, EntityManager} from 'typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {Domicilios} from '../domicilios/esquemas/domicilios.entity';
import {CreateOrdenesDto, CreateOrdenItemDto, FindOrdenesDto} from './esquemas/ordenes.dto';
import {FacturaCreationService} from './services/factura-creation.service';
import {DomicilioCreationService} from './services/domicilio-creation.service';
import {ProductProcessingService} from './services/product-processing.service';
import {OrdenesGateway} from './ordenes.gateway';
import {CierresService} from '../cierres/cierres.service';
import {InventarioCajasService} from '../inventario-cajas/inventario-cajas.service';
import {CajaMovimientosService} from '../caja-movimientos/caja-movimientos.service';
import {InventarioBebidasService} from '../inventario-bebidas/inventario-bebidas.service';
import {getBogotaDateString} from '../common/utils/date.utils';

@Injectable()
export class OrdenesService {
	constructor(
		@InjectRepository(Ordenes) private readonly repo: Repository<Ordenes>,
		private readonly ordenesGateway: OrdenesGateway,
		private readonly facturaCreationService: FacturaCreationService,
		private readonly domicilioCreationService: DomicilioCreationService,
		private readonly productProcessingService: ProductProcessingService,
		private readonly cierresService: CierresService,
		private readonly inventarioCajasService: InventarioCajasService,
		private readonly cajaMovimientosService: CajaMovimientosService,
		private readonly inventarioBebidasService: InventarioBebidasService,
	) {}

	async findAll(query: FindOrdenesDto = {}) {
		const {estado, from, to, page = 1, limit = 50} = query;
		const qb = this.repo
			.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.leftJoinAndSelect('o.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
			.orderBy('o.fechaOrden', 'DESC')
			.take(limit)
			.skip((page - 1) * limit);

		if (estado) {
			qb.andWhere('o.estadoOrden = :estado', {estado});
		}
		if (from && to) {
			qb.andWhere('o.fechaOrden BETWEEN :from AND :to', {
				from: new Date(from + 'T00:00:00'),
				to: new Date(to + 'T23:59:59'),
			});
		} else if (from) {
			qb.andWhere('o.fechaOrden >= :from', {from: new Date(from + 'T00:00:00')});
		} else if (to) {
			qb.andWhere('o.fechaOrden <= :to', {to: new Date(to + 'T23:59:59')});
		}

		const [data, total] = await qb.getManyAndCount();
		return {data, total, page, limit, totalPages: Math.ceil(total / limit)};
	}

	findByDay(estado?: string) {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		const qb = this.repo
			.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.leftJoinAndSelect('o.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
			.where('o.fechaOrden BETWEEN :start AND :end', {start, end});

		if (estado) {
			qb.andWhere('o.estadoOrden = :estado', {estado});
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
			.leftJoinAndSelect('o.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
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
			.leftJoinAndSelect('o.domicilios', 'domicilios')
			.leftJoinAndSelect('domicilios.domiciliario', 'domiciliario')
			.where('(o.estadoOrden = :pendiente OR o.estadoOrden IS NULL)')
			.andWhere('o.fechaOrden BETWEEN :start AND :end', {start, end, pendiente: 'pendiente'})
			.getMany();
	}

	async findOne(id: number, manager?: EntityManager) {
		const repo = manager ? manager.getRepository(Ordenes) : this.repo;
		const orden = await repo.findOne({
			where: {ordenId: id},
			relations: [
				'factura',
				'productos',
				'productos.productoObj',
				'productos.variante',
				'domicilios',
				'domicilios.domiciliario',
			],
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

	private async crearOrden(
		facturaId: number,
		tipoPedido?: string,
		estadoOrden?: string,
		observaciones?: string,
		manager?: EntityManager,
	): Promise<Ordenes> {
		const repo = manager ? manager.getRepository(Ordenes) : this.repo;
		const orden = repo.create({facturaId, tipoPedido, estadoOrden, observaciones});
		return repo.save(orden);
	}

	// ==================== MÉTODO PRINCIPAL ====================

	async create(data: CreateOrdenesDto) {
		return this.repo.manager.transaction(async (manager) => {
			const productos = Array.isArray(data.productos) ? data.productos : [];
			const descripcion =
				productos.length > 0
					? this.facturaCreationService.generarDescripcionFactura(
							productos,
							this.productProcessingService.construirNombreProducto.bind(this.productProcessingService),
						)
					: '';

			// 1. Crear factura (metodo se guarda desde el inicio para pedidos con pago conocido, ej. WhatsApp bot)
			const factura = await this.facturaCreationService.crearFactura(
				data.nombreCliente || '',
				data.metodo,
				descripcion,
				manager,
				data.telefonoCliente || undefined,
			);

			// 2. Crear orden
			const orden = await this.crearOrden(
				factura.facturaId,
				data.tipoPedido,
				data.estadoOrden,
				data.observaciones,
				manager,
			);

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
			const necesitaCaja = ['domicilio', 'para llevar', 'para_llevar', 'paraLlevar'].includes(
				(data.tipoPedido || '').toLowerCase(),
			);
			if (this.domicilioCreationService.esDomicilio(data.tipoPedido)) {
				await this.domicilioCreationService.procesarDomicilio(data, factura.facturaId, orden.ordenId, manager);
			}

			const fullOrden = await this.findOne(orden.ordenId, manager);
			this.ordenesGateway.emitirNuevaOrden(fullOrden);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = getBogotaDateString(new Date(fullOrden.fechaOrden));
			await this.cierresService.updateCierreIfExists(fechaStr);

			// 5. Descontar cajas (domicilio o para llevar) — fuera de TX para no bloquear
			if (necesitaCaja && productos.length > 0) {
				const itemsToCajas =
					fullOrden.productos?.map((p) => ({
						varianteNombre: (p as any).variante?.nombre || '',
						tipoProducto: (p as any).productoObj?.productoNombre || p.producto || '',
						cantidad: Number(p.cantidad) || 1,
					})) ?? [];
				// fire-and-forget: no queremos que un error de inventario revierta la orden
				this.inventarioCajasService
					.descontarCajasParaOrden(itemsToCajas, orden.ordenId)
					.catch((err) => console.warn('[InventarioCajas] Error al descontar cajas:', err?.message));
			}

			// 6. Descontar stock de bebidas (gaseosas/jugos) — aplica a TODO tipo de orden
			//    (incl. mesa), fire-and-forget. Registra -1 en historial aunque no haya stock.
			if (productos.length > 0) {
				const drinkItems =
					fullOrden.productos?.map((p) => ({
						varianteId: (p as any).varianteId ?? (p as any).variante?.varianteId ?? null,
						productoNombre: (p as any).productoObj?.productoNombre || p.producto || '',
						cantidad: Number(p.cantidad) || 1,
					})) ?? [];
				this.inventarioBebidasService
					.descontarBebidasParaOrden(drinkItems, orden.ordenId)
					.catch((err) => console.warn('[InventarioBebidas] Error al descontar stock:', err?.message));
			}

			return fullOrden;
		});
	}

	async update(id: number, data: Partial<CreateOrdenesDto>) {
		return this.repo.manager.transaction(async (manager) => {
			const {productos, ...basicData} = data;
			const oRepo = manager.getRepository(Ordenes);

			let orden = await this.findOne(id, manager);

			// 0. Bloquear edición si ya está pagada
			if (orden.factura?.estado === 'pagada') {
				throw new BadRequestException('No se puede modificar una orden que ya ha sido pagada');
			}

			// 1. Update basic order data
			const allowedFields = [
				'tipoPedido',
				'estadoOrden',
				'fechaOrden',
				'observaciones',
				'usuarioCancelacionId',
				'fechaCancelacion',
			];
			const updateData: any = {};
			for (const key of allowedFields) {
				if (key in basicData) {
					updateData[key] = (basicData as any)[key];
				}
			}

			if (Object.keys(updateData).length > 0) {
				await oRepo.update(id, updateData);
			}

			// 1.5 Update Domicilio Delivery Data (if is domicilio)
			if (this.domicilioCreationService.esDomicilio(orden.tipoPedido)) {
				await this.domicilioCreationService.updateDomicilioPorOrden(id, data, orden.facturaId, manager);
				// Refresh orden after domicilio update
				orden = await this.findOne(id, manager);
			}

			// 2. Recalculate total and update Invoice
			let newTotal = 0;
			let isTotalChanged = false;

			if (productos && Array.isArray(productos)) {
				// a. Delete old relations
				await this.productProcessingService.eliminarProductosDeOrden(id, manager);

				// b. Process new productos
				const {total: totalProductos} = await this.productProcessingService.procesarProductos(
					id,
					productos,
					manager,
				);
				newTotal = totalProductos;
				isTotalChanged = true;
			} else {
				// Sum existing products of the order
				newTotal = (orden.productos || []).reduce(
					(sum, p) => sum + (Number(p.precioUnitario) || 0) * (p.cantidad || 1),
					0,
				);
			}

			if (this.domicilioCreationService.esDomicilio(orden.tipoPedido)) {
				const costoDom =
					data.costoDomicilio !== undefined
						? Number(data.costoDomicilio)
						: Number(orden.domicilios?.[0]?.costoDomicilio || 0);
				newTotal += costoDom;

				if (data.costoDomicilio !== undefined) {
					isTotalChanged = true;
				}
			}

			if (orden.facturaId && (isTotalChanged || (productos && Array.isArray(productos)))) {
				const updateFields: any = {total: newTotal};
				if (productos && Array.isArray(productos)) {
					updateFields.descripcion = this.facturaCreationService.generarDescripcionFactura(
						productos,
						this.productProcessingService.construirNombreProducto.bind(this.productProcessingService),
					);
				}
				await this.facturaCreationService.updateFactura(orden.facturaId, updateFields, manager);
			}

			const updated = await this.findOne(id, manager);
			this.ordenesGateway.emitirOrdenActualizada(updated);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = getBogotaDateString(new Date(updated.fechaOrden));
			await this.cierresService.updateCierreIfExists(fechaStr);

			return updated;
		});
	}

	async remove(id: number) {
		const orden = await this.findOne(id);
		if (orden.factura?.estado === 'pagada') {
			throw new BadRequestException('No se puede eliminar una orden que ya ha sido pagada');
		}
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

			// 1.5 Eliminar domicilio asociado
			await manager.getRepository(Domicilios).delete({ordenId: id});

			// 2. Cancelar factura asociada
			if (orden.facturaId) {
				await this.facturaCreationService.cancelarFactura(orden.facturaId, manager);
			}

			const fullUpdated = await this.findOne(id, manager);
			this.ordenesGateway.emitirOrdenActualizada(fullUpdated);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = getBogotaDateString(new Date(fullUpdated.fechaOrden));
			await this.cierresService.updateCierreIfExists(fechaStr);

			// Restaurar stock de bebidas descontado al crear (idempotente, fire-and-forget)
			this.inventarioBebidasService
				.restaurarBebidasParaOrden(id)
				.catch((err) => console.warn('[InventarioBebidas] Error al restaurar stock:', err?.message));

			return fullUpdated;
		});
	}

	async completar(
		id: number,
		metodo: string,
		userId: string,
		ip: string,
		idempotencyKey?: string,
		lastUpdatedAt?: string,
		pagoEfectivo?: number,
		pagoTransferencia?: number,
		denominaciones?: Record<string, number>,
	) {
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
					throw new ConflictException(
						'La orden ha sido modificada por otro usuario. Por favor refresca antes de pagar.',
					);
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
				await this.facturaCreationService.updateFactura(
					orden.facturaId,
					{
						metodo,
						estado: 'pagada',
						usuarioCobroId: userId,
						fechaCobro: new Date(),
						ipDispositivo: ip,
						idempotencyKey,
						pagoEfectivo,
						pagoTransferencia,
					},
					manager,
				);
			}

			// 4. Marcar Orden como Completada
			orden.estadoOrden = 'completada';
			await oRepo.save(orden);

			// 5. Descontar stock de bebidas (best-effort, no bloquea el pago)
			try {
				const opRepo = manager.getRepository('ordenes_productos');
				const raw = await opRepo
					.createQueryBuilder('op')
					.select(['op.variante_id AS "varianteId"', 'op.cantidad AS cantidad'])
					.where('op.orden_id = :id', {id})
					.getRawMany();
				// getRawMany returns DB column values as strings — normalize here
				const items: Array<{varianteId: number | null; cantidad: number}> = raw.map(
					(r: Record<string, unknown>) => ({
						varianteId:
							r['varianteId'] != null
								? Number(r['varianteId'])
								: r['variante_id'] != null
									? Number(r['variante_id'])
									: null,
						cantidad: Number(r['cantidad']) || 0,
					}),
				);
				await this.inventarioBebidasService.deductForOrden(items, manager);
			} catch {
				// Non-critical — never break the payment flow
			}

			const updated = await this.findOne(id, manager);
			this.ordenesGateway.emitirOrdenActualizada(updated);

			// Actualizar cierre si existe para la fecha de la orden
			const fechaStr = getBogotaDateString(new Date(updated.fechaOrden));
			await this.cierresService.updateCierreIfExists(fechaStr);

			// Registrar movimiento de caja si hay denominaciones en efectivo
			if (denominaciones && Object.keys(denominaciones).length > 0 && (pagoEfectivo ?? 0) > 0) {
				await this.cajaMovimientosService.registrarEntrada({
					denominaciones,
					facturaVentaId: orden.facturaId,
					descripcion: `Cobro orden #${id}`,
					fecha: fechaStr,
					metodo,
					pagoTransferencia,
				});
			}

			return updated;
		});
	}
}
