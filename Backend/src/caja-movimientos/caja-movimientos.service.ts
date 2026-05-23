import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CajaMovimiento } from './esquemas/caja-movimiento.entity';
import { getBogotaDateString } from '../common/utils/date.utils';

export interface DenominacionesMap {
    [denominacion: string]: number; // e.g. { "100000": 2, "50000": 1 }
}

function sumarDenominaciones(map: DenominacionesMap): number {
    return Object.entries(map).reduce(
        (acc, [den, qty]) => acc + Number(den) * qty,
        0,
    );
}

@Injectable()
export class CajaMovimientosService {
    constructor(
        @InjectRepository(CajaMovimiento)
        private readonly repo: Repository<CajaMovimiento>,
    ) {}

    async getMovimientos(fecha?: string) {
        const day = fecha ?? getBogotaDateString();
        return this.repo.find({ where: { fecha: day }, order: { createdAt: 'ASC' } });
    }

    async getEstadoActual(fecha?: string): Promise<DenominacionesMap> {
        const day = fecha ?? getBogotaDateString();
        const movimientos = await this.getMovimientos(day);

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
    }) {
        const fecha = data.fecha ?? getBogotaDateString();
        const total = sumarDenominaciones(data.denominaciones);
        return this.repo.save({
            fecha,
            tipo: 'entrada',
            denominaciones: data.denominaciones,
            total,
            facturaVentaId: data.facturaVentaId ? Number(data.facturaVentaId) : null,
            facturaPagoId: null,
            descripcion: data.descripcion ?? null,
        });
    }

    async registrarSalida(data: {
        denominaciones: DenominacionesMap;
        facturaPagoId?: number;
        descripcion?: string;
        fecha?: string;
    }) {
        const fecha = data.fecha ?? getBogotaDateString();

        // Validar que hay suficiente efectivo para cada denominación
        const estado = await this.getEstadoActual(fecha);
        for (const [den, qty] of Object.entries(data.denominaciones)) {
            const disponible = estado[den] ?? 0;
            if (disponible < qty) {
                throw new BadRequestException(
                    `No hay suficientes billetes de $${Number(den).toLocaleString('es-CO')}. Disponibles: ${disponible}, requeridos: ${qty}`,
                );
            }
        }

        const total = sumarDenominaciones(data.denominaciones);
        return this.repo.save({
            fecha,
            tipo: 'salida',
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
    }) {
        const fecha = data.fecha ?? getBogotaDateString();
        const total = sumarDenominaciones(data.denominaciones);
        return this.repo.save({
            fecha,
            tipo: 'apertura',
            denominaciones: data.denominaciones,
            total,
            facturaVentaId: null,
            facturaPagoId: null,
            descripcion: data.descripcion ?? 'Apertura de caja',
        });
    }

    async getResumen(fecha?: string) {
        const day = fecha ?? getBogotaDateString();
        const movimientos = await this.getMovimientos(day);
        const estadoActual = await this.getEstadoActual(day);

        const totalEfectivo = sumarDenominaciones(estadoActual);
        const entradas = movimientos.filter(m => m.tipo !== 'salida');
        const salidas = movimientos.filter(m => m.tipo === 'salida');

        return {
            fecha: day,
            estadoActual,
            totalEfectivo,
            totalEntradas: entradas.reduce((a, m) => a + Number(m.total), 0),
            totalSalidas: salidas.reduce((a, m) => a + Number(m.total), 0),
            movimientos,
        };
    }
}
