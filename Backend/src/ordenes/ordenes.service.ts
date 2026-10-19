import {BadRequestException, Injectable, NotFoundException, ConflictException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, EntityManager} from 'typeorm';
import {Ordenes} from './esquemas/ordenes.entity';
import {Domicilios} from '../domicilios/esquemas/domicilios.entity';
import {CreateOrdenesDto, FindOrdenesDto} from './esquemas/ordenes.dto';
import {FacturaCreationService} from './services/factura-creation.service';
import {DomicilioCreationService} from './services/domicilio-creation.service';
import {ProductProcessingService} from './services/product-processing.service';
import {OrdenesGateway} from './ordenes.gateway';
import {CierresService} from '../cierres/cierres.service';
import {CajaMovimientosService} from '../caja-movimientos/caja-movimientos.service';
import {ConsumoOrdenService} from '../inventario/consumo-orden.service';
import {getBogotaDateString} from '../common/utils/date.utils';
import {CajaMovimiento} from '../caja-movimientos/esquemas/caja-movimiento.entity';
import {EstadisticasGateway} from '../estadisticas/estadisticas.gateway';

/** Quién y por dónde entró la orden. Lo arma el controller a partir del token. */
export interface OrigenOrden {
	canal?: 'pos' | 'web' | null;
	usuarioCreacionId?: string | null;
}

@Injectable()
export class OrdenesService {
	constructor(
		@InjectRepository(Ordenes) private readonly repo: Repository<Ordenes>,
		private readonly ordenesGateway: OrdenesGateway,
		private readonly facturaCreationService: FacturaCreationService,
		private readonly domicilioCreationService: DomicilioCreationService,
		private readonly productProcessingService: ProductProcessingService,
		private readonly cierresService: CierresService,
		private readonly cajaMovimientosService: CajaMovimientosService,
		private readonly consumoOrden: ConsumoOrdenService,
		private readonly estadisticasGateway: EstadisticasGateway,
	) {}

	async findAll(query: FindOrdenesDto = {}) {
		const {estado, from, to, page = 1, limit = 50} = query;
		const qb = this.repo
			.createQueryBuilder('o')
			.leftJoinAndSelect('o.factura', 'factura')
			.leftJoinAndSelect('o.productos', 'op')
			.leftJoinAndSelect('op.productoObj', 'productoObj')
			.leftJoinAndSelect('op.saboresDetalle', 'saboresDetalle')
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
			.leftJoinAndSelect('op.saboresDetalle', 'saboresDetalle')
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
			.leftJoinAndSelect('op.saboresDetalle', 'saboresDetalle')
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
			.leftJoinAndSelect('op.saboresDetalle', 'saboresDetalle')
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
				'productos.saboresDetalle',
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
		origen: OrigenOrden = {},
	): Promise<Ordenes> {
		const repo = manager ? manager.getRepository(Ordenes) : this.repo;
		const orden = repo.create({
			facturaId,
			tipoPedido,
			estadoOrden,
			observaciones,
			canal: origen.canal ?? null,
			usuarioCreacionId: origen.usuarioCreacionId ?? null,
		});
		return repo.save(orden);
	}

	/**
	 * Efectos que deben ocurrir DESPUÉS del commit: notificar por socket (si se emite
	 * antes, el cliente refresca y aún no ve la orden), recalcular el cierre (lee con
	 * su propia conexión). Un fallo aquí se registra
	 * pero no revierte ni hace fallar una orden ya guardada.
	 */
	private async trasCommit(efectos: Array<() => unknown>): Promise<void> {
		for (const efecto of efectos) {
			try {
				await efecto();
			} catch (err) {
				console.warn('[Ordenes] Efecto posterior al commit falló:', (err as Error)?.message);
			}
		}
	}

	private async actualizarCierreDe(fechaOrden: Date): Promise<void> {
		await this.cierresService.updateCierreIfExists(getBogotaDateString(new Date(fechaOrden)));
	}

	// ==================== MÉTODO PRINCIPAL ====================

	async create(data: CreateOrdenesDto, origen: OrigenOrden = {}) {
		const productos = Array.isArray(data.productos) ? data.productos : [];
		const fullOrden = await this.repo.manager.transaction(async (manager) => {
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
				origen,
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
			if (this.domicilioCreationService.esDomicilio(data.tipoPedido)) {
				await this.domicilioCreationService.procesarDomicilio(data, factura.facturaId, orden.ordenId, manager);
			}

			// 5. Inventario: descuenta cajas y bebidas según las reglas de consumo.
			await this.consumoOrden.reconciliar(orden.ordenId, manager);

			return this.findOne(orden.ordenId, manager);
		});

		await this.trasCommit([
			() => this.ordenesGateway.emitirNuevaOrden(fullOrden),
			() => this.estadisticasGateway.emitirActualizacionStats({source: 'orden_create', id: fullOrden.ordenId}),
			// Actualizar cierre si existe para la fecha de la orden
			() => this.actualizarCierreDe(fullOrden.fechaOrden),
		]);

		return fullOrden;
	}

	async update(id: number, data: Partial<CreateOrdenesDto>) {
		const updated = await this.repo.manager.transaction(async (manager) => {
			const {productos, ...basicData} = data;
			const oRepo = manager.getRepository(Ordenes);

			let orden = await this.findOne(id, manager);

			// 0. Bloquear edición si ya está pagada
			if (orden.factura?.estado === 'pagada' || orden.factura?.estado === 'pagado') {
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

			const eraDomicilio = this.domicilioCreationService.esDomicilio(orden.tipoPedido);
			if (Object.keys(updateData).length > 0) {
				await oRepo.update(id, updateData);
				// `orden` se leyó ANTES de actualizar: sin releerla, "¿es domicilio?" se decidía con el tipo viejo
				// (al pasar de mesa a domicilio no se creaba/actualizaba el domicilio ni se sumaba el envío, y al pasar
				// de domicilio a mesa el envío seguía en el total).
				orden = await this.findOne(id, manager);
			}
			const ahoraDomicilio = this.domicilioCreationService.esDomicilio(orden.tipoPedido);

			// Dejó de ser domicilio: el domicilio asociado ya no aplica y el total pierde el envío.
			if (eraDomicilio && !ahoraDomicilio) {
				await manager.getRepository(Domicilios).delete({ordenId: id});
				orden = await this.findOne(id, manager);
			}

			// 1.5 Update Domicilio Delivery Data (if is domicilio)
			if (this.domicilioCreationService.esDomicilio(orden.tipoPedido)) {
				await this.domicilioCreationService.updateDomicilioPorOrden(id, data, orden.facturaId, manager);
				// Refresh orden after domicilio update
				orden = await this.findOne(id, manager);
			}

			// 2. Recalculate total and update Invoice
			let newTotal = 0;
			// Cambiar entre domicilio y no-domicilio cambia el total (entra o sale el envío) aunque no cambien los productos.
			let isTotalChanged = eraDomicilio !== ahoraDomicilio;

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

			// Inventario: líneas, tipo de pedido o estado (incl. 'cancelado') pueden haber cambiado.
			await this.consumoOrden.reconciliar(id, manager);

			return this.findOne(id, manager);
		});

		await this.trasCommit([
			() => this.ordenesGateway.emitirOrdenActualizada(updated),
			() => this.estadisticasGateway.emitirActualizacionStats({source: 'orden_update', id}),
			// Actualizar cierre si existe para la fecha de la orden
			() => this.actualizarCierreDe(updated.fechaOrden),
		]);

		return updated;
	}

	async remove(id: number) {
		return this.repo.manager.transaction(async (manager) => {
			const orden = await this.findOne(id, manager);
			if (orden.factura?.estado === 'pagada' || orden.factura?.estado === 'pagado') {
				throw new BadRequestException('No se puede eliminar una orden que ya ha sido pagada');
			}
			// Devolver lo consumido ANTES de borrar (después ya no hay orden que leer).
			await this.consumoOrden.reconciliar(id, manager, {eliminada: true});
			return manager.getRepository(Ordenes).delete(id);
		});
	}

	async cancel(id: number, reason: string, userId: string) {
		const fullUpdated = await this.repo.manager.transaction(async (manager) => {
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

			// 3. Devolver al inventario lo que la orden había consumido.
			await this.consumoOrden.reconciliar(id, manager);

			return this.findOne(id, manager);
		});

		await this.trasCommit([
			() => this.ordenesGateway.emitirOrdenActualizada(fullUpdated),
			() => this.estadisticasGateway.emitirActualizacionStats({source: 'orden_cancel', id}),
			// Actualizar cierre si existe para la fecha de la orden
			() => this.actualizarCierreDe(fullUpdated.fechaOrden),
		]);

		return fullUpdated;
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
		cuentaTransferenciaId?: number,
		cuentaTransferenciaNombre?: string,
	) {
		// Notificaciones a disparar tras el commit (solo si el pago se completó de verdad;
		// el camino idempotente no notifica, igual que antes).
		const efectos: Array<() => unknown> = [];
		let completada = false;

		const resultado = await this.repo.manager.transaction(async (manager) => {
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
				const totalFactura = Number(orden.factura?.total) || 0;
				const finalPagoEfectivo =
					metodo === 'efectivo'
						? (pagoEfectivo ?? totalFactura)
						: metodo === 'efectivo_transferencia'
							? (pagoEfectivo ?? 0)
							: 0;
				const finalPagoTransferencia =
					metodo === 'transferencia' || metodo === 'qr'
						? (pagoTransferencia ?? totalFactura)
						: metodo === 'efectivo_transferencia'
							? (pagoTransferencia ?? 0)
							: 0;

				// Idempotencia natural: la llave del cliente puede cambiar en cada reintento (respuesta perdida, doble
				// toque, cola offline) y repetir el cobro duplicaba la entrada de efectivo en la caja. Si la factura ya
				// está pagada EXACTAMENTE así, no se cobra de nuevo. Si está pagada de otra forma es una corrección:
				// el efectivo del cobro anterior sale de la caja antes de registrar el nuevo.
				const f = orden.factura;
				const yaPagada = f?.estado === 'pagado' || f?.estado === 'pagada';
				const mismoCobro =
					yaPagada &&
					f?.metodo === metodo &&
					Math.abs(Number(f?.pagoEfectivo ?? 0) - finalPagoEfectivo) < 0.5 &&
					Math.abs(Number(f?.pagoTransferencia ?? 0) - finalPagoTransferencia) < 0.5;

				if (mismoCobro) {
					orden.estadoOrden = 'completada';
					await oRepo.save(orden);
					completada = true;
					return this.findOne(id, manager);
				}
				if (yaPagada) await this.cajaMovimientosService.compensarFactura(orden.facturaId, 'cobro corregido', manager);

				// Todo cobro con transferencia dice A QUÉ cuenta entró; el nombre sale de la tabla, no del cliente.
				let cuenta: {id: number | null; nombre: string | null} = {id: null, nombre: null};
				if (finalPagoTransferencia > 0) {
					const filas: {id: number; nombre: string; activa?: boolean}[] = cuentaTransferenciaId
						? await manager.query('SELECT id, nombre, activa FROM cuentas_transferencia WHERE id = $1', [cuentaTransferenciaId])
						: cuentaTransferenciaNombre?.trim()
							? await manager.query('SELECT id, nombre, activa FROM cuentas_transferencia WHERE lower(nombre) = lower($1) ORDER BY id LIMIT 1', [cuentaTransferenciaNombre.trim()])
							: [];
					if (!filas.length) {
						throw new BadRequestException(
							cuentaTransferenciaId || cuentaTransferenciaNombre?.trim()
								? 'La cuenta de transferencia elegida no existe'
								: 'Elige la cuenta a la que entró la transferencia',
						);
					}
					if (filas[0].activa === false) throw new BadRequestException(`La cuenta "${filas[0].nombre}" está desactivada`);
					cuenta = {id: Number(filas[0].id), nombre: filas[0].nombre};
				}

				await this.facturaCreationService.updateFactura(
					orden.facturaId,
					{
						metodo,
						estado: 'pagado',
						usuarioCobroId: userId,
						fechaCobro: new Date(),
						ipDispositivo: ip,
						idempotencyKey,
						pagoEfectivo: finalPagoEfectivo,
						pagoTransferencia: finalPagoTransferencia,
						montoPagado: totalFactura,
						// Un cobro nuevo reemplaza al anterior: sin transferencia no queda cuenta vieja, y sin
						// desglose por abonos (cada abono QR guardaba su cuenta).
						cuentaTransferenciaId: cuenta.id,
						cuentaTransferenciaNombre: cuenta.nombre,
						desgloseTransferencia: null,
					},
					manager,
				);

				// REGISTRAR MOVIMIENTO EN CAJA PRINCIPAL SI TIENE PARTE EFECTIVO
				const fecha = getBogotaDateString();
				if ((metodo === 'efectivo' || metodo === 'efectivo_transferencia') && finalPagoEfectivo > 0) {
					const denomMap =
						denominaciones && Object.keys(denominaciones).length > 0
							? denominaciones
							: {coins: finalPagoEfectivo};

					const cajaRepo = manager.getRepository(CajaMovimiento);
					await cajaRepo.save({
						fecha,
						tipo: 'entrada',
						cajaOrigen: 'principal',
						denominaciones: denomMap,
						total: finalPagoEfectivo,
						facturaVentaId: orden.facturaId,
						facturaPagoId: null,
						descripcion: `Cobro factura #${orden.facturaId} (Pre-pago)${orden.factura?.clienteNombre ? ` - ${orden.factura.clienteNombre}` : ''}`,
						metodo,
						pagoTransferencia: finalPagoTransferencia || null,
					});

					efectos.push(() => this.estadisticasGateway.emitirActualizacionStats({source: 'caja_entrada', fecha}));
				}

				const facturaId = orden.facturaId;
				efectos.push(() => this.estadisticasGateway.emitirActualizacionStats({source: 'factura_pagada', id: facturaId}));
			}

			// 4. Marcar Orden como Completada
			orden.estadoOrden = 'completada';
			await oRepo.save(orden);

			completada = true;
			return this.findOne(id, manager);
		});

		if (completada) {
			await this.trasCommit([
				...efectos,
				() => this.ordenesGateway.emitirOrdenActualizada(resultado),
				// Actualizar cierre si existe para la fecha de la orden
				() => this.actualizarCierreDe(resultado.fechaOrden),
			]);
		}

		return resultado;
	}
}
