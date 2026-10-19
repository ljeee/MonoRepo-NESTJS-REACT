import {Injectable, BadRequestException, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {CierreCaja} from './esquemas/cierre.entity';
import {EstadisticasService} from '../estadisticas/estadisticas.service';
import {AnaliticaService} from '../estadisticas/analitica/analitica.service';
import {MailService} from '../common/services/mail.service';
import {ConfigService} from '@nestjs/config';
import {EmpresaService} from '../empresa/empresa.service';

@Injectable()
export class CierresService {
	private readonly logger = new Logger(CierresService.name);

	constructor(
		@InjectRepository(CierreCaja)
		private readonly cierreRepo: Repository<CierreCaja>,
		private readonly statsService: EstadisticasService,
		private readonly analiticaService: AnaliticaService,
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
		const existing = await this.cierreRepo.findOne({where: {fecha}});
		if (existing && !force) {
			throw new BadRequestException(`Ya existe un cierre para la fecha ${fecha}`);
		}

		// Mismas cifras que ven las pantallas de dinero (balance del día, cierre de caja): las
		// definiciones únicas de GET /estadisticas/resumen, no una suma aparte.
		const resumen = await this.analiticaService.resumenGeneral(fecha, fecha);
		const metodosPago = this.metodosDelCierre(resumen);
		// Agrupado por producto + variante (antes por el texto completo, que fragmentaba por sabor).
		const productosTop = await this.analiticaService.topProductosCierre(fecha, 5);
		const facturas = await this.statsService.facturasDetalle(fecha, fecha);

		const cierre = this.cierreRepo.create({
			...(existing || {}),
			fecha,
			totalVentas: resumen.ventas.facturado,
			totalEgresos: resumen.gastos.total,
			// Balance de caja (cobrado − gastos pagados): UNA sola definición en pantallas y correo.
			balanceNeto: resumen.balance.cobrado,
			resumen,
			totalFacturas: resumen.ventas.facturas,
			totalOrdenes: resumen.ventas.ordenes + resumen.ventas.canceladas,
			ticketPromedio: resumen.ventas.ticket,
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
	 * Detalle por método del cierre (lo lee mail.service y se guarda en `metodosPago`): lo COBRADO en
	 * efectivo y por QR/transferencia (mixtas y abonos repartidos), el desglose por cuenta de
	 * transferencia y lo que quedó por cobrar. Antes sumaba el total de cada factura al método de su
	 * etiqueta aunque estuviera pendiente, y una mixta aparecía como un método aparte.
	 */
	private metodosDelCierre(resumen: Awaited<ReturnType<AnaliticaService['resumenGeneral']>>) {
		const {ventas} = resumen;
		const facturasDe = (clave: string) => ventas.porMetodo.find((m) => m.clave === clave)?.facturas ?? 0;
		const pendientes = ventas.porEstado
			.filter((e) => e.clave === 'pendiente' || e.clave === 'parcial')
			.reduce((t, e) => t + e.facturas, 0);
		const filas = [
			{metodo: 'efectivo', cantidad: facturasDe('efectivo') + facturasDe('mixto'), total: ventas.cobradoPorMetodo.efectivo, porCuenta: []},
			{
				metodo: 'transferencia',
				cantidad: facturasDe('transferencia') + facturasDe('mixto'),
				total: ventas.cobradoPorMetodo.transferencia,
				porCuenta: ventas.porCuenta.map((c) => ({cuentaNombre: c.cuenta, cantidad: c.facturas, total: c.monto})),
			},
			{metodo: 'por_cobrar', cantidad: pendientes, total: ventas.porCobrar, porCuenta: []},
		].filter((f) => f.total > 0);
		const cobrado = ventas.cobradoPorMetodo.efectivo + ventas.cobradoPorMetodo.transferencia;
		return filas.map((f) => ({
			...f,
			porcentaje: f.metodo !== 'por_cobrar' && cobrado > 0 ? Math.round((f.total / cobrado) * 100) : 0,
		}));
	}

	async updateCierreIfExists(fecha: string) {
		const existing = await this.cierreRepo.findOne({where: {fecha}});
		if (existing) {
			// El ID del sistema o del robot para actualizaciones automáticas
			const systemId = '00000000-0000-0000-0000-000000000000';
			// Pasamos enviarEmail = false para que no mande correos en cada edición de orden
			return this.generalCierre(fecha, systemId, 'Actualización automática tras edición de orden.', true, false);
		}
		return null;
	}

	/** Todos los cierres (uno por día); `limite` > 0 devuelve solo los más recientes. */
	async getHistory(limite?: number) {
		return this.cierreRepo.find({order: {fecha: 'DESC'}, ...(limite && limite > 0 ? {take: limite} : {})});
	}

	async deleteCierre(id: string) {
		return this.cierreRepo.delete(id);
	}
}
