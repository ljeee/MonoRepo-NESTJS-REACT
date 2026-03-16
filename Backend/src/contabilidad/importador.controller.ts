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
				file: {
					type: 'string',
					format: 'binary',
				},
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

		// Header: fecha,cliente,descripcion,total,metodo,estado
		const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
		const dataRows = lines.slice(1);

		const imported: any[] = [];
		const errors: { line: number; error: string }[] = [];

		for (const [index, line] of dataRows.entries()) {
			const values = line.split(',').map(v => v.trim());
			if (values.length < headers.length) continue;

			try {
				const row: any = {};
				headers.forEach((header, i) => {
					row[header] = values[i];
				});

				// Transformación básica
				const factura = {
					fechaFactura: row.fecha ? new Date(row.fecha) : new Date(),
					clienteNombre: row.cliente || 'Importado',
					descripcion: row.descripcion || 'Sin descripción',
					total: parseFloat(row.total) || 0,
					metodo: row.metodo || 'efectivo',
					estado: row.estado || 'pagada',
				};

				await this.facturasService.create(factura as any);
				imported.push(factura);
			} catch (err) {
				errors.push({line: index + 2, error: err.message});
			}
		}

		return {
			success: true,
			totalImported: imported.length,
			totalErrors: errors.length,
			errors: errors.slice(0, 10), // Limitar logs de errores
		};
	}
}
