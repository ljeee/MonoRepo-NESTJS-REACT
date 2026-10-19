import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {construirHtmlCierre} from './cierre-email';

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

	async sendCierreReport(to: string, data: any) {
		const companyName =
			data.empresa?.nombreComercial ||
			data.empresa?.razonSocial ||
			this.config.get('COMPANY_NAME', 'Antigravity POS');
		const nit = data.empresa?.nit || this.config.get('COMPANY_NIT', 'N/A');

		if (!data.resumen) {
			throw new Error(`El cierre ${data.fecha} no guardó su resumen: no se puede armar el correo`);
		}
		const html = construirHtmlCierre({
			fecha: data.fecha,
			empresa: data.empresa,
			resumen: data.resumen,
			observaciones: data.observaciones,
			facturas: data.facturas,
			companyName,
			nit,
		});

		// Support multiple recipients if 'to' is a comma-separated string
		const recipients =
			typeof to === 'string'
				? to
						.split(',')
						.map((email) => email.trim())
						.filter((email) => !!email)
				: to;

		await this.transporter.sendMail({
			from: `"${companyName}" <${this.config.get('MAIL_USER')}>`,
			to: recipients,
			subject: `Cierre de Caja - ${data.fecha} - ${companyName}`,
			html,
		});
	}
}
