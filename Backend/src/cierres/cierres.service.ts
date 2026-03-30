import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CierreCaja } from './esquemas/cierre.entity';
import { EstadisticasService } from '../estadisticas/estadisticas.service';
import { MailService } from '../common/services/mail.service';
import { ConfigService } from '@nestjs/config';
import { EmpresaService } from '../empresa/empresa.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CierresService {
    private readonly logger = new Logger(CierresService.name);

    constructor(
        @InjectRepository(CierreCaja)
        private readonly cierreRepo: Repository<CierreCaja>,
        private readonly statsService: EstadisticasService,
        private readonly mailService: MailService,
        private readonly config: ConfigService,
        private readonly empresaService: EmpresaService,
    ) {}

    /**
     * Realiza el cierre de caja.
     * @param enviarEmail Por defecto false para evitar spam en actualizaciones automáticas.
     */
    async generalCierre(fecha: string, userId: string, observations?: string, force = false, enviarEmail = false) {
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
        this.logger.log(`Cierre ${existing ? 'actualizado' : 'creado'} para la fecha: ${fecha}`);

        // Enviar por correo solo si se solicita explícitamente y está configurado
        const reportEmail = this.config.get('REPORT_EMAIL');
        if (enviarEmail && reportEmail) {
            try {
                await this.mailService.sendCierreReport(reportEmail, {
                    ...saved,
                    empresa, 
                    facturas, 
                });
                this.logger.log(`Reporte de cierre enviado a: ${reportEmail}`);
            } catch (error) {
                this.logger.error('Error enviando reporte por correo:', error);
            }
        } else if (enviarEmail && !reportEmail) {
            this.logger.warn('Se solicitó envío de correo, pero REPORT_EMAIL no está configurado.');
        }

        return saved;
    }

    /**
     * Tarea programada para el cierre automático a las 11:59 PM.
     * Esto asegura que recibas un solo correo al día con el consolidado final.
     */
    @Cron('59 23 * * *')
    async handleAutomaticDailyClosing() {
        const hoy = new Date().toISOString().split('T')[0];
        this.logger.log(`Iniciando cierre automático programado para: ${hoy}`);
        
        const systemId = '00000000-0000-0000-0000-000000000000';
        try {
            await this.generalCierre(hoy, systemId, 'Cierre automático programado de fin de día.', true, true);
        } catch (error) {
            this.logger.error(`Error en el cierre automático de ${hoy}:`, error);
        }
    }

    async updateCierreIfExists(fecha: string) {
        const existing = await this.cierreRepo.findOne({ where: { fecha } });
        if (existing) {
            // El ID del sistema o del robot para actualizaciones automáticas
            const systemId = '00000000-0000-0000-0000-000000000000';
            // Pasamos enviarEmail = false para que no mande correos en cada edición de orden
            return this.generalCierre(fecha, systemId, 'Actualización automática tras edición de orden.', true, false);
        }
        return null;
    }

    async getHistory() {
        return this.cierreRepo.find({ order: { fecha: 'DESC' }, take: 30 });
    }

    async deleteCierre(id: string) {
        return this.cierreRepo.delete(id);
    }
}
