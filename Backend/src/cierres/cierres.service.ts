import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CierreCaja } from './esquemas/cierre.entity';
import { EstadisticasService } from '../estadisticas/estadisticas.service';
import { MailService } from '../common/services/mail.service';
import { ConfigService } from '@nestjs/config';
import { EmpresaService } from '../empresa/empresa.service';

@Injectable()
export class CierresService {
    constructor(
        @InjectRepository(CierreCaja)
        private readonly cierreRepo: Repository<CierreCaja>,
        private readonly statsService: EstadisticasService,
        private readonly mailService: MailService,
        private readonly config: ConfigService,
        private readonly empresaService: EmpresaService,
    ) {}

    async generalCierre(fecha: string, userId: string, observations?: string, force = false) {
        const empresa = await this.empresaService.getConfig();
        // Verificar si ya existe un cierre
        const existing = await this.cierreRepo.findOne({ where: { fecha } });
        if (existing && !force) {
            throw new BadRequestException(`Ya existe un cierre para la fecha ${fecha}`);
        }

        // Obtener resumen del periodo (un solo día)
        const resumen = await this.statsService.resumenPeriodo(fecha, fecha);
        const metodosPago = await this.statsService.metodosPago(fecha, fecha);
        const productosTop = await this.statsService.productosTop(fecha, fecha, 5);
        const facturas = await this.statsService.facturasDetalle(fecha, fecha);
 
        const cierre = this.cierreRepo.create({
            ...(existing || {}),
            fecha,
            totalVentas: resumen.totalVentas,
            totalEgresos: resumen.totalEgresos,
            balanceNeto: resumen.balanceNeto,
            totalFacturas: resumen.facturas,
            totalOrdenes: resumen.ordenes + resumen.cancelados,
            ticketPromedio: resumen.ticketPromedio,
            metodosPago,
            productosTop,
            observaciones: observations || (existing ? existing.observaciones : undefined),
            createdById: userId,
        });

        const saved = await this.cierreRepo.save(cierre);

        // Enviar por correo si está configurado
        const reportEmail = this.config.get('REPORT_EMAIL');
        if (reportEmail) {
            try {
                await this.mailService.sendCierreReport(reportEmail, {
                    ...saved,
                    empresa, 
                    facturas, // Send details for the table
                });
            } catch (error) {
                console.error('Error enviando reporte por correo:', error);
            }
        } else {
            console.warn('Cierre realizado satisfactoriamente, pero REPORT_EMAIL no está configurado.');
        }

        return saved;
    }

    async updateCierreIfExists(fecha: string) {
        const existing = await this.cierreRepo.findOne({ where: { fecha } });
        if (existing) {
            console.log(`[CierresService] Actualizando cierre existente para la fecha: ${fecha}`);
            // El ID del sistema o del robot para actualizaciones automáticas
            const systemId = '00000000-0000-0000-0000-000000000000';
            return this.generalCierre(fecha, systemId, 'Actualización automática tras edición de orden.', true);
        }
        return null; // No hace nada si no existe el cierre
    }

    async getHistory() {
        return this.cierreRepo.find({ order: { fecha: 'DESC' }, take: 30 });
    }

    async deleteCierre(id: string) {
        return this.cierreRepo.delete(id);
    }
}
