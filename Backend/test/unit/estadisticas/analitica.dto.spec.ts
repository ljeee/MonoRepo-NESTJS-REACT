import 'reflect-metadata';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {BadRequestException} from '@nestjs/common';
import {FiltrosAnaliticaDto, ProductosAnaliticaDto} from '../../../src/estadisticas/analitica/analitica.dto';
import {calcularPeriodo} from '../../../src/estadisticas/analitica/filtros';
import {AnaliticaController} from '../../../src/estadisticas/analitica/analitica.controller';
import {ROLES_KEY} from '../../../src/auth/decorators/roles.decorator';
import {Role} from '../../../src/auth/roles.enum';

/** Igual que el ValidationPipe global de main.ts (transform + conversión implícita). */
async function parsear<T extends object>(clase: new () => T, query: Record<string, unknown>) {
	const dto = plainToInstance(clase, query, {enableImplicitConversion: true});
	const errores = await validate(dto, {whitelist: true});
	return {dto, errores};
}

describe('FiltrosAnaliticaDto', () => {
	it('convierte listas separadas por comas, números y booleanos', async () => {
		const {dto, errores} = await parsear(FiltrosAnaliticaDto, {
			from: '2026-05-01',
			to: '2026-05-31',
			tipoPedido: 'mesa,domicilio',
			productoId: '1,2',
			diaSemana: '6,7',
			horaDesde: '18',
			comparar: 'true',
			precioManual: 'false',
		});
		expect(errores).toEqual([]);
		expect(dto).toEqual(
			expect.objectContaining({
				tipoPedido: ['mesa', 'domicilio'],
				productoId: [1, 2],
				diaSemana: [6, 7],
				horaDesde: 18,
				comparar: true,
				precioManual: false,
			}),
		);
	});

	it('rechaza valores fuera de catálogo y fechas mal formadas', async () => {
		const {errores} = await parsear(FiltrosAnaliticaDto, {
			from: '01/05/2026',
			to: '2026-05-31',
			tipoPedido: 'mesa,avion',
			diaSemana: '9',
			horaHasta: '25',
		});
		expect(errores.map((e) => e.property).sort()).toEqual(['diaSemana', 'from', 'horaHasta', 'tipoPedido']);
	});

	it('valida agrupación y límites de la tabla de productos', async () => {
		const {errores} = await parsear(ProductosAnaliticaDto, {
			from: '2026-05-01',
			to: '2026-05-31',
			agrupar: 'cliente',
			limit: '9999',
		});
		expect(errores.map((e) => e.property).sort()).toEqual(['agrupar', 'limit']);
	});
});

describe('calcularPeriodo', () => {
	it('rechaza rangos invertidos o de más de 366 días', () => {
		expect(() => calcularPeriodo('2026-05-10', '2026-05-01')).toThrow(BadRequestException);
		expect(() => calcularPeriodo('2025-01-01', '2026-05-01')).toThrow(BadRequestException);
	});

	it('el período anterior tiene la misma duración', () => {
		const p = calcularPeriodo('2026-05-01', '2026-05-31', true, new Date('2026-07-01T00:00:00Z'));
		expect(p.dias).toBe(31);
		expect(p.anterior!.inicio.toISOString()).toBe('2026-03-31T05:00:00.000Z');
		expect(p.anterior!.fin.getTime() - p.anterior!.inicio.getTime()).toBe(
			p.actual.fin.getTime() - p.actual.inicio.getTime(),
		);
	});

	it('si el rango termina hoy, corta en "ahora" y compara la misma ventana horaria', () => {
		const ahora = new Date('2026-05-15T20:00:00Z'); // 3 p. m. en Bogotá
		const p = calcularPeriodo('2026-05-15', '2026-05-15', true, ahora);
		expect(p.actual.fin).toEqual(ahora);
		expect(p.anterior!.inicio.toISOString()).toBe('2026-05-14T05:00:00.000Z');
		expect(p.anterior!.fin.toISOString()).toBe('2026-05-14T20:00:00.000Z');
	});
});

describe('AnaliticaController', () => {
	it('solo admin, cajero y contador', () => {
		expect(Reflect.getMetadata(ROLES_KEY, AnaliticaController)).toEqual([Role.Admin, Role.Cajero, Role.Contador]);
	});
});
