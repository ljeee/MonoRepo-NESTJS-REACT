import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CajaMovimiento } from './esquemas/caja-movimiento.entity';
import { getBogotaDateString } from '../common/utils/date.utils';

export interface DenominacionesMap {
    [denominacion: string]: number; // e.g. { "100000": 2, "50000": 1 }
}

export type CajaOrigen = 'principal' | 'gastos';

function sumarDenominaciones(map: DenominacionesMap): number {
    return Object.entries(map).reduce(
        (acc, [den, qty]) => {
            // 'coins' stores the total coin value directly (not denomination × count)
            if (den === 'coins') return acc + qty;
            const denom = Number(den);
            return acc + (isNaN(denom) ? 0 : denom * qty);
        },
        0,
    );
}

@Injectable()
export class CajaMovimientosService {
    constructor(
        @InjectRepository(CajaMovimiento)
        private readonly repo: Repository<CajaMovimiento>,
    ) {}

    async getMovimientos(fecha?: string, cajaOrigen: CajaOrigen = 'principal') {
        const day = fecha ?? getBogotaDateString();
        return this.repo.find({ where: { fecha: day, cajaOrigen }, order: { createdAt: 'ASC' } });
    }

    async getEstadoActual(fecha?: string, cajaOrigen: CajaOrigen = 'principal'): Promise<DenominacionesMap> {
        const day = fecha ?? getBogotaDateString();
        const movimientos = await this.getMovimientos(day, cajaOrigen);

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
        return this.repo.save({
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
    }

    async registrarSalida(data: {
        denominaciones: DenominacionesMap;
        facturaPagoId?: number;
        descripcion?: string;
        fecha?: string;
        cajaOrigen?: CajaOrigen;
        skipValidation?: boolean;
    }) {
        const fecha = data.fecha ?? getBogotaDateString();
        const cajaOrigen = data.cajaOrigen ?? 'principal';

        if (!data.skipValidation) {
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
        return this.repo.save({
            fecha,
            tipo: 'salida',
            cajaOrigen,
            denominaciones: data.denominaciones,
            total,
            facturaVentaId: null,
            facturaPagoId: data.facturaPagoId ?? null,
            descripcion: data.descripcion ?? null,
        });
    }

    async registrarApertura(data: {
        denominaciones: DenominacionesMap;
        descripcion?: string;
        fecha?: string;
        cajaOrigen?: CajaOrigen;
    }) {
        const fecha = data.fecha ?? getBogotaDateString();
        const total = sumarDenominaciones(data.denominaciones);
        return this.repo.save({
            fecha,
            tipo: 'apertura',
            cajaOrigen: data.cajaOrigen ?? 'principal',
            denominaciones: data.denominaciones,
            total,
            facturaVentaId: null,
            facturaPagoId: null,
            descripcion: data.descripcion ?? 'Apertura de caja',
        });
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
        const estado = await this.getEstadoActual(fecha, cajaOrigen);
        const total = sumarDenominaciones(data.denominaciones);

        if (data.tipo === 'cambio') {
            if (total !== 0) {
                throw new BadRequestException('En un cambio de billetes, el total de la transacción debe ser $0.');
            }
            // Validar que los billetes que salen (qty < 0) existan en la caja
            for (const [den, qty] of Object.entries(data.denominaciones)) {
                if (qty < 0) {
                    const disponible = estado[den] ?? 0;
                    if (disponible < Math.abs(qty)) {
                        throw new BadRequestException(`No hay suficientes billetes de $${Number(den).toLocaleString('es-CO')} para realizar el cambio.`);
                    }
                }
            }
        } else if (data.tipo === 'salida') {
            for (const [den, qty] of Object.entries(data.denominaciones)) {
                const disponible = estado[den] ?? 0;
                if (disponible < qty) {
                    throw new BadRequestException(`No hay suficientes billetes de $${Number(den).toLocaleString('es-CO')} para retirar.`);
                }
            }
        }

        return this.repo.save({
            fecha,
            tipo: data.tipo,
            cajaOrigen,
            denominaciones: data.denominaciones,
            total: Math.abs(total),
            descripcion: data.descripcion,
            facturaVentaId: null,
            facturaPagoId: null,
        });
    }

    async getResumen(fecha?: string, cajaOrigen: CajaOrigen = 'principal') {
        const day = fecha ?? getBogotaDateString();
        const movimientos = await this.getMovimientos(day, cajaOrigen);
        const estadoActual = await this.getEstadoActual(day, cajaOrigen);

        const totalEfectivo = sumarDenominaciones(estadoActual);
        const entradas = movimientos.filter(m => m.tipo !== 'salida');
        const salidas = movimientos.filter(m => m.tipo === 'salida');

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
