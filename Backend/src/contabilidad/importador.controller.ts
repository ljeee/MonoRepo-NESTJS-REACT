import {Controller, Post, UseInterceptors, UploadedFile, BadRequestException} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiTags, ApiOperation, ApiConsumes, ApiBody} from '@nestjs/swagger';
import {FacturasVentasService} from '../facturas-ventas/facturas-ventas.service';
import {InjectRepository} from '@nestjs/typeorm';
import {FacturasVentas} from '../facturas-ventas/esquemas/facturas-ventas.entity';
import {Repository} from 'typeorm';

@ApiTags('Contabilidad')
@Controller('contabilidad')
export class ImportadorController {
	constructor(
		private readonly facturasService: FacturasVentasService,
		@InjectRepository(FacturasVentas)
		private readonly facturaRepo: Repository<FacturasVentas>,
	) {}

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
				const cleanTotal = rawTotal.replace(/[^0-9.-]+/g, '');

				// ── Fecha parsing ──────────────────────────────────────────────────────
				// Priority 1: ISO format YYYY-MM-DD (exported by our backup)
				// Priority 2: Colombian DD/MM/YYYY format
				// Priority 3: fallback to today
				let parsedFecha: Date;
				if (/^\d{4}-\d{2}-\d{2}/.test(rawFecha)) {
					// ISO format — parse directly (safe and unambiguous)
					parsedFecha = new Date(rawFecha);
				} else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawFecha)) {
					// DD/MM/YYYY — reverse to YYYY-MM-DD
					const [d, m, y] = rawFecha.split('/');
					parsedFecha = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
				} else {
					parsedFecha = rawFecha ? new Date(rawFecha) : new Date();
				}
				if (isNaN(parsedFecha.getTime())) parsedFecha = new Date();

				const factura = {
					facturaId: id ? parseInt(id, 10) : undefined,
					fechaFactura: parsedFecha,
					clienteNombre: rawCliente,
					descripcion: row['descripcion'] || row['notas'] || 'Importado desde CSV de Recuperación',
					total: parseFloat(cleanTotal) || 0,
					metodo: rawMetodo.toLowerCase() || 'efectivo',
					estado: rawEstado.toLowerCase() || 'pagado',
					ordenes: [],
				};

				facturasMap.set(facturaKey, factura);
			}
		}

		const imported: any[] = [];
		let skipped = 0;
		for (const [key, factura] of facturasMap.entries()) {
			try {
				// ── Avoid duplicates: skip if facturaId already exists in DB ─────────
				if (factura.facturaId) {
					const existing = await this.facturaRepo.findOne({where: {facturaId: factura.facturaId}});
					if (existing) {
						skipped++;
						continue;
					}
				}
				await this.facturasService.create(factura as any);
				imported.push(factura);
			} catch (err) {
				errors.push({line: -1, error: `Factura ID ${key}: ${err.message}`});
			}
		}

		return {
			success: true,
			totalImported: imported.length,
			totalSkipped: skipped,
			totalErrors: errors.length,
			errors: errors.slice(0, 10),
		};
	}
}
