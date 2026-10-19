import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {CierresService} from './cierres.service';
import {getBogotaDateString} from '../common/utils/date.utils';

/** Hora (Bogotá) del cierre automático del día anterior. El día sigue siendo de medianoche a medianoche. */
export const HORA_CIERRE = 4;

/** true si en Bogotá aún no son las HORA_CIERRE (Colombia no tiene horario de verano: UTC−5 fijo). */
export function antesDeHoraCierre(ahora: Date = new Date()): boolean {
	const horaBogota = (ahora.getUTCHours() + 24 - 5) % 24;
	return horaBogota < HORA_CIERRE;
}

@Injectable()
export class CierresCronService implements OnApplicationBootstrap {
	private readonly logger = new Logger(CierresCronService.name);

	constructor(private readonly cierresService: CierresService) {}

	async onApplicationBootstrap() {
		// Al arrancar (reinicio del contenedor) recupera el cierre de ayer si falta. Pero antes de las 4:00 el local
		// puede seguir atendiendo (a veces hasta las 2 a. m.): ahí no se cierra, lo hace el cron de las 4:00.
		if (antesDeHoraCierre()) {
			this.logger.log(
				`Startup: son antes de las ${HORA_CIERRE}:00 en Bogotá; el cierre de ayer lo hará el cron.`,
			);
			return;
		}
		this.logger.log('Startup: Revisando si hay un cierre de caja pendiente de ayer...');
		await this.checkAndGenerateClosure();
	}

	// Todos los días a las 4:00 a. m. (Bogotá): el local a veces cierra pasada la medianoche, y así lo cobrado o
	// editado después de las 12 sobre las ventas de ayer ya entra al cierre y a los dos PDF del correo.
	@Cron(`0 ${HORA_CIERRE} * * *`, {timeZone: 'America/Bogota'})
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
