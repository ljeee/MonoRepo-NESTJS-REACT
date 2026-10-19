import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface AdjuntoCorreo {
	filename: string;
	content: Buffer | string;
	contentType: string;
}

@Injectable()
export class MailService {
	private transporter: nodemailer.Transporter;

	constructor(private readonly config: ConfigService) {
		const mailSecure = this.config.get('MAIL_SECURE');
		// Robust boolean parsing for environment variables
		const isSecure = mailSecure === true || mailSecure === 'true';

		this.transporter = nodemailer.createTransport({
			host: this.config.get('MAIL_HOST'),
			port: Number(this.config.get('MAIL_PORT', 587)),
			secure: isSecure,
			auth: {
				user: this.config.get('MAIL_USER'),
				pass: this.config.get('MAIL_PASS'),
			},
		});
	}

	/** Sin MAIL_HOST no hay a dónde enviar (p. ej. el entorno local de pruebas). */
	configurado(): boolean {
		return !!this.config.get<string>('MAIL_HOST');
	}

	/**
	 * Un correo con adjuntos a varios destinatarios. Lo usa el cierre (resumen en el cuerpo + los dos libros diarios
	 * en PDF, al dueño y a la contadora) y el envío manual desde Contabilidad.
	 */
	async enviarConAdjuntos(
		destinos: string[],
		d: {asunto: string; html: string; adjuntos: AdjuntoCorreo[]; remitente?: string},
	) {
		const nombre = d.remitente ?? this.config.get<string>('COMPANY_NAME', 'Dfiru Pizzería');
		await this.transporter.sendMail({
			from: `"${nombre}" <${this.config.get('MAIL_USER')}>`,
			to: destinos,
			subject: d.asunto,
			html: d.html,
			attachments: d.adjuntos,
		});
	}
}
