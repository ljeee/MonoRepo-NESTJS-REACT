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

    async generalCierre(fecha: string, userId: string, observations?: string) {
        const empresa = await this.empresaService.getConfig();
        // Verificar si ya existe un cierre
        const existing = await this.cierreRepo.findOne({ where: { fecha } });
        if (existing) {
            throw new BadRequestException(`Ya existe un cierre para la fecha ${fecha}`);
        }

        // Obtener resumen del periodo (un solo día)
        const resumen = await this.statsService.resumenPeriodo(fecha, fecha);
        const metodosPago = await this.statsService.metodosPago(fecha, fecha);
        const productosTop = await this.statsService.productosTop(fecha, fecha, 5);
        const facturas = await this.statsService.facturasDetalle(fecha, fecha);
 
        const cierre = this.cierreRepo.create({
            fecha,
            totalVentas: resumen.totalVentas,
            totalEgresos: resumen.totalEgresos,
            balanceNeto: resumen.balanceNeto,
            totalFacturas: resumen.facturas,
            totalOrdenes: resumen.ordenes + resumen.cancelados,
            ticketPromedio: resumen.ticketPromedio,
            metodosPago,
            productosTop,
            observaciones: observations,
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

    async getHistory() {
        return this.cierreRepo.find({ order: { fecha: 'DESC' }, take: 30 });
    }

    async deleteCierre(id: string) {
        return this.cierreRepo.delete(id);
    }
}
