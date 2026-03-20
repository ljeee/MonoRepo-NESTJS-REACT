import {Controller, Post, UseInterceptors, UploadedFile, BadRequestException} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiTags, ApiOperation, ApiConsumes, ApiBody} from '@nestjs/swagger';
import {FacturasVentasService} from '../facturas-ventas/facturas-ventas.service';

@ApiTags('Contabilidad')
@Controller('contabilidad')
export class ImportadorController {
	constructor(private readonly facturasService: FacturasVentasService) {}

	@Post('importar-csv')
	@ApiOperation({summary: 'Importar facturas históricas desde CSV'})
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: { type: 'string', format: 'binary' },
			},
		},
	})
	@UseInterceptors(FileInterceptor('file'))
	async importarCsv(@UploadedFile() file: any) {
		if (!file) {
			throw new BadRequestException('No se subió ningún archivo');
		}

		const content = file.buffer.toString('utf-8');
		const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
		
		if (lines.length < 2) {
			throw new BadRequestException('El archivo CSV está vacío o le faltan datos');
		}

		// Parse utility for CSV rows protecting quoted commas
		const parseCsvRow = (text: string) => {
			const re = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
			return text.split(re).map(v => v.replace(/^"|"$/g, '').trim());
		};

		const rawHeaders = parseCsvRow(lines[0]);
		const headers = rawHeaders.map(h => 
			h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
		);

		const dataRows = lines.slice(1);
		const facturasMap = new Map<string, any>();
		const errors: { line: number; error: string }[] = [];

		for (const [index, line] of dataRows.entries()) {
			const values = parseCsvRow(line);
			if (values.length < 2) continue; // Skip malformed lines

			const row: Record<string, string> = {};
			headers.forEach((header, i) => {
				row[header] = values[i] || '';
			});

			const id = row['id'];
			// Ignorar agrupaciones si no hay ID válido (o autogenerar)
			const facturaKey = id || `temp_row_${index}`;

			if (!facturasMap.has(facturaKey)) {
				// Buscar campos bajo diferentes posibles traducciones
				const rawFecha = row['fecha'] || row['fechafactura'] || '';
				const rawTotal = row['total factura'] || row['total'] || '0';
				const rawMetodo = row['metodo'] || row['metodo de pago'] || row['metodopago'] || 'efectivo';
				const rawEstado = row['estado'] || 'pagado';
				const rawCliente = row['cliente'] || row['nombre/cliente'] || 'Importado';

				// Parse currency format string ($20,000) or raw (20000)
				const cleanTotal = rawTotal.replace(/[^0-9.-]+/g, "");

				const factura = {
					facturaId: id ? parseInt(id, 10) : undefined,
					fechaFactura: rawFecha ? new Date(rawFecha.split('/').reverse().join('-')) : new Date(),
					clienteNombre: rawCliente,
					descripcion: row['descripcion'] || row['notas'] || 'Importado desde CSV de Recuperación',
					total: parseFloat(cleanTotal) || 0,
					metodo: rawMetodo.toLowerCase() || 'efectivo',
					estado: rawEstado.toLowerCase() || 'pagado',
					ordenes: [], // Puedes expandir esto para construir la orden entera si se requiere
				};

				// Fallback to ISO parsing if standard Date breaks on Colombian ES formats
				if (isNaN(factura.fechaFactura.getTime())) {
					factura.fechaFactura = new Date(rawFecha); // Intentar ISO
				}
				if (isNaN(factura.fechaFactura.getTime())) {
					factura.fechaFactura = new Date(); // Ultra fallback seguro
				}

				facturasMap.set(facturaKey, factura);
			}
		}

		const imported: any[] = [];
		for (const [key, factura] of facturasMap.entries()) {
			try {
				await this.facturasService.create(factura as any);
				imported.push(factura);
			} catch (err) {
				errors.push({line: -1, error: `Factura ID ${key}: ${err.message}`});
			}
		}

		return {
			success: true,
			totalImported: imported.length,
			totalErrors: errors.length,
			errors: errors.slice(0, 10),
		};
	}
}
