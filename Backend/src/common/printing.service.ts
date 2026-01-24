import { Injectable, Logger } from '@nestjs/common';

export interface ReceiptData {
	clienteNombre: string;
	productos: Array<{ nombre: string; cantidad: number; precio?: number }>;
	total?: number;
	direccion?: string;
	telefono?: string;
	domiciliario?: string;
}

@Injectable()
export class PrintingService {
	private readonly logger = new Logger(PrintingService.name);
	private readonly enabled: boolean;

	constructor() {
		this.enabled = process.env.PRINTER_ENABLED === 'true';
		
		if (!this.enabled) {
			this.logger.warn('Impresora deshabilitada. Configurar PRINTER_ENABLED=true en .env para habilitar.');
		}
	}

	async printReceipt(data: ReceiptData): Promise<boolean> {
		if (!this.enabled) {
			this.logger.warn('Impresora deshabilitada. No se imprimirá recibo.');
			return false;
		}

		try {
			// Lazy load para evitar errores si las librerías no están instaladas
			const escpos = await import('escpos');
			const USB = await import('escpos-usb');

			const device = new USB.default();
			const printer = new escpos.Printer(device);

			await new Promise<void>((resolve, reject) => {
				device.open((error: any) => {
					if (error) {
						reject(error);
						return;
					}

					printer
						.font('a')
						.align('ct')
						.style('bu')
						.size(1, 1)
						.text('PIZZERÍA')
						.text('------------------------')
						.align('lt')
						.style('normal')
						.text(`Cliente: ${data.clienteNombre}`)
						.text(`Teléfono: ${data.telefono || 'N/A'}`)
						.text(`Dirección: ${data.direccion || 'N/A'}`)
						.text('------------------------')
						.text('PRODUCTOS:');

					data.productos.forEach(p => {
						const precio = p.precio ? ` - $${p.precio.toLocaleString()}` : '';
						printer.text(`${p.cantidad}x ${p.nombre}${precio}`);
					});

					printer.text('------------------------');

					if (data.total) {
						printer.text(`TOTAL: $${data.total.toLocaleString()}`);
					}

					if (data.domiciliario) {
						printer
							.text('------------------------')
							.text(`Domiciliario: ${data.domiciliario}`);
					}

					printer
						.text('------------------------')
						.text(`Fecha: ${new Date().toLocaleString('es-CO')}`)
						.cut()
						.close(() => {
							this.logger.log('Recibo impreso exitosamente');
							resolve();
						});
				});
			});

			return true;
		} catch (error) {
			this.logger.error('Error imprimiendo recibo:', error);
			return false;
		}
	}
}
