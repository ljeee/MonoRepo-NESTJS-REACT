import {ArgumentMetadata, BadRequestException, ValidationPipe} from '@nestjs/common';
import {
	CreateFacturasPagosDto,
	FindFacturasPagosDto,
	UpdateFacturasPagosDto,
} from '../../../src/facturas-pagos/esquemas/facturas-pagos.dto';

// Misma configuración que main.ts
const pipe = new ValidationPipe({whitelist: true, transform: true, transformOptions: {enableImplicitConversion: true}});
const validar = (metatype: new () => object, value: unknown, type: ArgumentMetadata['type'] = 'body') =>
	pipe.transform(value, {type, metatype});

describe('DTO de egresos (facturas-pagos)', () => {
	it('acepta categoría y tipo válidos', async () => {
		const dto = (await validar(CreateFacturasPagosDto, {
			total: 1200000,
			nombreGasto: 'Nómina',
			categoria: 'nomina',
			tipoGasto: 'gasto',
		})) as CreateFacturasPagosDto;

		expect(dto.categoria).toBe('nomina');
		expect(dto.tipoGasto).toBe('gasto');
	});

	it("sigue aceptando 'general' (el valor histórico) y la ausencia de categoría", async () => {
		await expect(validar(CreateFacturasPagosDto, {total: 1, categoria: 'general'})).resolves.toBeDefined();
		await expect(validar(CreateFacturasPagosDto, {total: 1})).resolves.toBeDefined();
	});

	it('rechaza una categoría o un tipo que no existen', async () => {
		await expect(validar(CreateFacturasPagosDto, {total: 1, categoria: 'cosas'})).rejects.toThrow(BadRequestException);
		await expect(validar(CreateFacturasPagosDto, {total: 1, tipoGasto: 'otro'})).rejects.toThrow(BadRequestException);
	});

	it('el PATCH ahora también valida (antes `Partial<Dto>` dejaba pasar cualquier cosa)', async () => {
		await expect(validar(UpdateFacturasPagosDto, {categoria: 'servicios'})).resolves.toBeDefined();
		await expect(validar(UpdateFacturasPagosDto, {categoria: 'inventada'})).rejects.toThrow(BadRequestException);
		await expect(validar(UpdateFacturasPagosDto, {total: 'mucho'})).rejects.toThrow(BadRequestException);
	});

	it('el listado acepta limit=0 (todo) y filtros por tipo', async () => {
		const q = (await validar(
			FindFacturasPagosDto,
			{from: '2026-06-01', to: '2026-06-30', limit: '0', tipo: 'sin_clasificar'},
			'query',
		)) as FindFacturasPagosDto;

		expect(q.limit).toBe(0);
		expect(q.tipo).toBe('sin_clasificar');
		await expect(validar(FindFacturasPagosDto, {tipo: 'raro'}, 'query')).rejects.toThrow(BadRequestException);
	});
});
