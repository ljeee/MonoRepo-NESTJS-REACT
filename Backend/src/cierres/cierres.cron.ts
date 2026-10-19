import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {CierresService} from './cierres.service';
import {getBogotaDateString} from '../common/utils/date.utils';

@Injectable()
export class CierresCronService implements OnApplicationBootstrap {
	private readonly logger = new Logger(CierresCronService.name);

	constructor(private readonly cierresService: CierresService) {}

	async onApplicationBootstrap() {
		// Verify automatic closure on server startup (e.g. docker restarts)
		this.logger.log('Startup: Revisando si hay un cierre de caja pendiente de ayer...');
		await this.checkAndGenerateClosure();
	}

	// Ejecuta todos los días a las 00:05 (Justo pasada la medianoche)
	@Cron('5 0 * * *', {timeZone: 'America/Bogota'})
	async handleDailyClose() {
		this.logger.log('Cron: Ejecutando verificación de cierre de turno...');
		await this.checkAndGenerateClosure();
	}

	private async checkAndGenerateClosure() {
		try {
			// El objetivo es AYER en hora de Bogotá (no la del servidor, que en Docker suele ser UTC).
			const fechaStr = getBogotaDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

			// Se asume un ID del sistema genérico,
			// no es un usuario real, es para identificar que lo hizo el robot.
			const systemId = '00000000-0000-0000-0000-000000000000';

			this.logger.log(`Intentando emitir cierre automático para el día: ${fechaStr}`);

			await this.cierresService.generalCierre(
				fechaStr,
				systemId,
				'Generado automáticamente vía Node Cron al finalizar el día.',
				false,
				// Único envío de correo del cierre automático (antes lo mandaba un segundo cron a las 23:59,
				// con el día aún abierto, y este — el real — nunca enviaba). Si el día ya estaba cerrado
				// (cierre manual o reinicio del servidor) lanza "Ya existe" y no se repite el correo.
				true,
			);

			this.logger.log(`✅ Cierre del día ${fechaStr} autogenerado y reportado exitosamente.`);
		} catch (error) {
			if (error.message && error.message.includes('Ya existe un cierre')) {
				// Ignore, as it simply means the user manually closed the shift
				this.logger.log('El cierre para el día objetivo ya había sido elaborado. Omitiendo.');
			} else {
				this.logger.error(`Error procesando cierre de caja automático: ${error.message}`);
			}
		}
	}
}
