import {Injectable, BadRequestException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, Repository} from 'typeorm';
import {CajaMovimiento} from './esquemas/caja-movimiento.entity';
import {getBogotaDateString} from '../common/utils/date.utils';
import {EstadisticasGateway} from '../estadisticas/estadisticas.gateway';
import {EmpresaConfig} from '../empresa/esquemas/empresa.entity';

export interface DenominacionesMap {
	[denominacion: string]: number; // e.g. { "100000": 2, "50000": 1 }
}

export type CajaOrigen = 'principal' | 'gastos';

function sumarDenominaciones(map: DenominacionesMap): number {
	return Object.entries(map).reduce((acc, [den, qty]) => {
		// 'coins' stores the total coin value directly (not denomination × count)
		if (den === 'coins') return acc + qty;
		const denom = Number(den);
		return acc + (isNaN(denom) ? 0 : denom * qty);
	}, 0);
}

@Injectable()
export class CajaMovimientosService {
	constructor(
		@InjectRepository(CajaMovimiento)
		private readonly repo: Repository<CajaMovimiento>,
		@InjectRepository(EmpresaConfig)
		private readonly empresaRepo: Repository<EmpresaConfig>,
		private readonly estadisticasGateway: EstadisticasGateway,
	) {}

	async getMovimientos(fecha?: string, cajaOrigen: CajaOrigen = 'principal') {
		const day = fecha ?? getBogotaDateString();
		return this.repo.find({where: {fecha: day, cajaOrigen}, order: {createdAt: 'ASC'}});
	}

	/**
	 * ¿Se controla la caja por arqueo? Si no hay configuración o falla la consulta, se asume que sí
	 * (el comportamiento de siempre): ante la duda se valida, no se deja pasar.
	 */
	async arqueoActivo(): Promise<boolean> {
		try {
			const config = await this.empresaRepo.findOne({where: {}});
			return config?.arqueoCaja ?? true;
		} catch {
			return true;
		}
	}

	/**
	 * Movimientos que cuentan para el saldo: desde la ÚLTIMA apertura del día. Un arqueo nuevo
	 * (p. ej. el admin lo enciende al irse y deja la caja contada) reemplaza la base: lo cobrado
	 * antes ya está dentro de ese conteo y sumarlo otra vez duplicaría el efectivo.
	 */
	private desdeUltimaApertura<T extends {tipo: string}>(movimientos: T[]): T[] {
		let ultima = -1;
		movimientos.forEach((m, i) => {
			if (m.tipo === 'apertura') ultima = i;
		});
		return ultima > 0 ? movimientos.slice(ultima) : movimientos;
	}

	async getEstadoActual(fecha?: string, cajaOrigen: CajaOrigen = 'principal'): Promise<DenominacionesMap> {
		const day = fecha ?? getBogotaDateString();
		const movimientos = this.desdeUltimaApertura(await this.getMovimientos(day, cajaOrigen));

		const estado: DenominacionesMap = {};
		for (const mov of movimientos) {
			const signo = mov.tipo === 'salida' ? -1 : 1;
			for (const [den, qty] of Object.entries(mov.denominaciones)) {
				estado[den] = (estado[den] ?? 0) + signo * qty;
			}
		}
		return estado;
	}

	async registrarEntrada(data: {
		denominaciones: DenominacionesMap;
		facturaVentaId?: number | string;
		descripcion?: string;
		fecha?: string;
		metodo?: string;
		pagoTransferencia?: number;
		cajaOrigen?: CajaOrigen;
	}) {
		const fecha = data.fecha ?? getBogotaDateString();
		const total = sumarDenominaciones(data.denominaciones);
		const saved = await this.repo.save({
			fecha,
			tipo: 'entrada',
			cajaOrigen: data.cajaOrigen ?? 'principal',
			denominaciones: data.denominaciones,
			total,
			facturaVentaId: data.facturaVentaId ? Number(data.facturaVentaId) : null,
			facturaPagoId: null,
			descripcion: data.descripcion ?? null,
			metodo: data.metodo ?? null,
			pagoTransferencia: data.pagoTransferencia ?? null,
		});
		this.estadisticasGateway.emitirActualizacionStats({source: 'caja_entrada', fecha});
		return saved;
	}

	async registrarSalida(data: {
		denominaciones: DenominacionesMap;
		facturaPagoId?: number;
		/** Factura a la que pertenece la salida (el cambio entregado): permite netear lo que esa factura dejó en caja. */
		facturaVentaId?: number;
		descripcion?: string;
		fecha?: string;
		cajaOrigen?: CajaOrigen;
		skipValidation?: boolean;
	}) {
		const fecha = data.fecha ?? getBogotaDateString();
		const cajaOrigen = data.cajaOrigen ?? 'principal';

		if (!data.skipValidation && (await this.arqueoActivo())) {
			// Validar que hay suficiente efectivo para cada denominación
			const estado = await this.getEstadoActual(fecha, cajaOrigen);
			for (const [den, qty] of Object.entries(data.denominaciones)) {
				const disponible = estado[den] ?? 0;
				if (disponible < qty) {
					throw new BadRequestException(
						`No hay suficientes billetes de $${Number(den).toLocaleString('es-CO')}. Disponibles: ${disponible}, requeridos: ${qty}`,
					);
				}
			}
		}

		const total = sumarDenominaciones(data.denominaciones);
		const saved = await this.repo.save({
			fecha,
			tipo: 'salida',
			cajaOrigen,
			denominaciones: data.denominaciones,
			total,
			facturaVentaId: data.facturaVentaId ?? null,
			facturaPagoId: data.facturaPagoId ?? null,
			descripcion: data.descripcion ?? null,
		});
		this.estadisticasGateway.emitirActualizacionStats({source: 'caja_salida', fecha});
		return saved;
	}

	/**
	 * Efectivo que una factura dejó en la caja principal, por denominación: entradas (lo recibido) menos salidas
	 * (cambio entregado y reversos anteriores). El cambio de movimientos viejos no estaba enlazado a la factura:
	 * se reconoce por su descripción ("Cambio factura #N" / "Cambio abono factura #N").
	 */
	async efectivoNetoDeFactura(facturaId: number, manager?: EntityManager): Promise<DenominacionesMap> {
		const em = manager ?? this.repo.manager;
		const filas: {tipo: string; denominaciones: DenominacionesMap}[] = await em.query(
			`SELECT tipo, denominaciones FROM caja_movimientos
			 WHERE caja_origen = 'principal' AND tipo IN ('entrada', 'salida')
			   AND (factura_venta_id = $1 OR descripcion ~ ('^Cambio (abono )?factura #' || $1::text || '( |$)'))`,
			[facturaId],
		);
		const neto: DenominacionesMap = {};
		for (const f of filas) {
			const signo = f.tipo === 'salida' ? -1 : 1;
			for (const [den, qty] of Object.entries(f.denominaciones ?? {})) {
				neto[den] = (neto[den] ?? 0) + signo * Number(qty);
			}
		}
		for (const den of Object.keys(neto)) if (Math.abs(neto[den]) < 1e-9) delete neto[den];
		return neto;
	}

	/**
	 * Saca de la caja principal el efectivo que una factura había dejado (la factura se revierte, se anula o se
	 * borra): una salida por lo que quedó y, si el cambio entregado superó lo recibido en alguna denominación, una
	 * entrada por la diferencia. Idempotente: tras compensar, el neto de la factura es 0 y repetirlo no hace nada.
	 * Sin validar billetes: lo que se devuelve es lo que esa factura puso, no un retiro nuevo.
	 */
	async compensarFactura(facturaId: number, motivo: string, manager?: EntityManager) {
		const neto = await this.efectivoNetoDeFactura(facturaId, manager);
		const sale: DenominacionesMap = {};
		const entra: DenominacionesMap = {};
		for (const [den, qty] of Object.entries(neto)) {
			if (qty > 0) sale[den] = qty;
			else if (qty < 0) entra[den] = -qty;
		}
		const fecha = getBogotaDateString();
		const em = manager ?? this.repo.manager;
		const repo = em.getRepository(CajaMovimiento);
		const base = {fecha, cajaOrigen: 'principal' as const, facturaPagoId: null, facturaVentaId: facturaId};
		const creados: CajaMovimiento[] = [];
		if (Object.keys(sale).length) {
			creados.push(
				await repo.save({...base, tipo: 'salida', denominaciones: sale, total: sumarDenominaciones(sale), descripcion: `Reverso factura #${facturaId} (${motivo})`}),
			);
		}
		if (Object.keys(entra).length) {
			creados.push(
				await repo.save({...base, tipo: 'entrada', denominaciones: entra, total: sumarDenominaciones(entra), descripcion: `Reverso cambio factura #${facturaId} (${motivo})`}),
			);
		}
		if (creados.length) this.estadisticasGateway.emitirActualizacionStats({source: 'caja_reverso', fecha});
		return creados;
	}

	/**
	 * La factura ya cobrada cambió de total y su parte en efectivo subió o bajó: la diferencia entra o sale de la
	 * caja principal como pesos netos (clave 'coins'), sin tocar billetes (no se sabe cuáles fueron).
	 */
	async ajustarEfectivoDeFactura(facturaId: number, diferencia: number, motivo: string, manager?: EntityManager) {
		if (!Number.isFinite(diferencia) || Math.abs(diferencia) < 0.5) return null;
		const em = manager ?? this.repo.manager;
		const monto = Math.abs(Math.round(diferencia));
		const saved = await em.getRepository(CajaMovimiento).save({
			fecha: getBogotaDateString(),
			tipo: diferencia > 0 ? 'entrada' : 'salida',
			cajaOrigen: 'principal',
			denominaciones: {coins: monto},
			total: monto,
			facturaVentaId: facturaId,
			facturaPagoId: null,
			descripcion: `Ajuste efectivo factura #${facturaId} (${motivo})`,
		});
		this.estadisticasGateway.emitirActualizacionStats({source: 'caja_ajuste', fecha: saved.fecha});
		return saved;
	}

	async registrarApertura(data: {
		denominaciones: DenominacionesMap;
		descripcion?: string;
		fecha?: string;
		cajaOrigen?: CajaOrigen;
	}) {
		const fecha = data.fecha ?? getBogotaDateString();
		const total = sumarDenominaciones(data.denominaciones);
		const saved = await this.repo.save({
			fecha,
			tipo: 'apertura',
			cajaOrigen: data.cajaOrigen ?? 'principal',
			denominaciones: data.denominaciones,
			total,
			facturaVentaId: null,
			facturaPagoId: null,
			descripcion: data.descripcion ?? 'Apertura de caja',
		});
		this.estadisticasGateway.emitirActualizacionStats({source: 'caja_apertura', fecha});
		return saved;
	}

	async registrarAjuste(data: {
		tipo: 'entrada' | 'salida' | 'cambio';
		denominaciones: DenominacionesMap;
		descripcion: string;
		fecha?: string;
		cajaOrigen?: CajaOrigen;
	}) {
		const fecha = data.fecha ?? getBogotaDateString();
		const cajaOrigen = data.cajaOrigen ?? 'principal';
		const controlar = await this.arqueoActivo();
		const estado = controlar ? await this.getEstadoActual(fecha, cajaOrigen) : {};
		const total = sumarDenominaciones(data.denominaciones);

		if (data.tipo === 'cambio') {
			if (total !== 0) {
				throw new BadRequestException('En un cambio de billetes, el total de la transacción debe ser $0.');
			}
			// Validar que los billetes que salen (qty < 0) existan en la caja
			for (const [den, qty] of Object.entries(data.denominaciones)) {
				if (controlar && qty < 0) {
					const disponible = estado[den] ?? 0;
					if (disponible < Math.abs(qty)) {
						throw new BadRequestException(
							`No hay suficientes billetes de $${Number(den).toLocaleString('es-CO')} para realizar el cambio.`,
						);
					}
				}
			}
		} else if (data.tipo === 'salida' && controlar) {
			for (const [den, qty] of Object.entries(data.denominaciones)) {
				const disponible = estado[den] ?? 0;
				if (disponible < qty) {
					throw new BadRequestException(
						`No hay suficientes billetes de $${Number(den).toLocaleString('es-CO')} para retirar.`,
					);
				}
			}
		}

		const saved = await this.repo.save({
			fecha,
			tipo: data.tipo,
			cajaOrigen,
			denominaciones: data.denominaciones,
			total: Math.abs(total),
			descripcion: data.descripcion,
			facturaVentaId: null,
			facturaPagoId: null,
		});
		this.estadisticasGateway.emitirActualizacionStats({source: 'caja_ajuste', fecha});
		return saved;
	}

	async getResumen(fecha?: string, cajaOrigen: CajaOrigen = 'principal') {
		const day = fecha ?? getBogotaDateString();
		const movimientos = await this.getMovimientos(day, cajaOrigen);
		const estadoActual = await this.getEstadoActual(day, cajaOrigen);

		const totalEfectivo = sumarDenominaciones(estadoActual);
		const entradas = movimientos.filter((m) => m.tipo !== 'salida');
		const salidas = movimientos.filter((m) => m.tipo === 'salida');

		return {
			fecha: day,
			estadoActual,
			totalEfectivo,
			totalEntradas: entradas.reduce((a, m) => a + (Number(m.total) || 0), 0),
			totalSalidas: salidas.reduce((a, m) => a + (Number(m.total) || 0), 0),
			movimientos,
		};
	}
}
