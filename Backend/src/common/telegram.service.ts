import { Injectable, Logger } from '@nestjs/common';

export interface DomicilioNotification {
	clienteNombre: string;
	telefono: string;
	direccion: string;
	productos: string;
	observaciones?: string;
}

@Injectable()
export class TelegramService {
	private readonly logger = new Logger(TelegramService.name);
	private bot: any = null;
	private readonly enabled: boolean;

	constructor() {
		const token = process.env.TELEGRAM_BOT_TOKEN;
		this.enabled = !!token;

		if (this.enabled) {
			this.initBot(token);
		} else {
			this.logger.warn('TELEGRAM_BOT_TOKEN no configurado. Notificaciones deshabilitadas.');
		}
	}

	private async initBot(token: string) {
		try {
			const TelegramBot = await import('node-telegram-bot-api');
			this.bot = new TelegramBot.default(token, { polling: false });
			this.logger.log('Telegram bot inicializado correctamente');
		} catch (error) {
			this.logger.error('Error inicializando Telegram bot. Instalar: npm install node-telegram-bot-api', error);
			this.enabled = false;
		}
	}

	async sendDomicilioNotification(
		chatId: string,
		data: DomicilioNotification,
	): Promise<boolean> {
		if (!this.enabled || !this.bot) {
			this.logger.warn('Telegram deshabilitado. No se enviará notificación.');
			return false;
		}

		try {
			const message = this.formatDomicilioMessage(data);
			await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
			this.logger.log(`Notificación enviada a chat ${chatId}`);
			return true;
		} catch (error) {
			this.logger.error(`Error enviando notificación a ${chatId}:`, error);
			return false;
		}
	}

	private formatDomicilioMessage(data: DomicilioNotification): string {
		let message = '<b>🍕 NUEVO DOMICILIO</b>\n\n';
		message += `<b>Cliente:</b> ${data.clienteNombre}\n`;
		message += `<b>Teléfono:</b> ${data.telefono}\n`;
		message += `<b>Dirección:</b> ${data.direccion}\n\n`;
		message += `<b>Productos:</b>\n${data.productos}\n`;

		if (data.observaciones) {
			message += `\n<b>Observaciones:</b> ${data.observaciones}`;
		}

		message += `\n\n<i>Fecha: ${new Date().toLocaleString('es-CO')}</i>`;

		return message;
	}

	async getChatIdFromPhone(phone: string): Promise<string | null> {
		// TODO: Implementar mapeo desde base de datos
		// Por ahora, mapeo hardcodeado para desarrollo
		const mapping: Record<string, string> = {
			// Ejemplo: '3001234567': '123456789',
		};
		
		const chatId = mapping[phone];
		if (!chatId) {
			this.logger.warn(`No se encontró chat_id para teléfono ${phone}. Configurar mapeo en telegram.service.ts`);
		}
		
		return chatId || null;
	}
}
