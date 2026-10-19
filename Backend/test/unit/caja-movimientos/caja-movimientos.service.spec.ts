import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException} from '@nestjs/common';
import {CajaMovimientosService} from '../../../src/caja-movimientos/caja-movimientos.service';
import {CajaMovimiento} from '../../../src/caja-movimientos/esquemas/caja-movimiento.entity';
import {EmpresaConfig} from '../../../src/empresa/esquemas/empresa.entity';
import {EstadisticasGateway} from '../../../src/estadisticas/estadisticas.gateway';

type Mov = {tipo: 'apertura' | 'entrada' | 'salida' | 'cambio'; denominaciones: Record<string, number>; total?: number};

describe('CajaMovimientosService — arqueo opcional', () => {
	let service: CajaMovimientosService;
	let movimientos: Mov[];
	let config: {arqueoCaja: boolean} | null;
	let repo: {find: jest.Mock; save: jest.Mock};

	beforeEach(async () => {
		movimientos = [];
		config = {arqueoCaja: true};
		repo = {
			find: jest.fn(() => Promise.resolve(movimientos)),
			save: jest.fn((m: Mov) => Promise.resolve(m)),
		};
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CajaMovimientosService,
				{provide: getRepositoryToken(CajaMovimiento), useValue: repo},
				{
					provide: getRepositoryToken(EmpresaConfig),
					useValue: {findOne: jest.fn(() => Promise.resolve(config))},
				},
				{provide: EstadisticasGateway, useValue: {emitirActualizacionStats: jest.fn()}},
			],
		}).compile();
		service = module.get(CajaMovimientosService);
	});

	describe('arqueoActivo', () => {
		it('por defecto (sin configuración) se controla la caja', async () => {
			config = null;
			await expect(service.arqueoActivo()).resolves.toBe(true);
		});

		it('refleja el interruptor del admin', async () => {
			config = {arqueoCaja: false};
			await expect(service.arqueoActivo()).resolves.toBe(false);
		});
	});

	describe('salidas de efectivo', () => {
		beforeEach(() => {
			movimientos = [{tipo: 'apertura', denominaciones: {'10000': 2}}];
		});

		it('con arqueo: no deja sacar billetes que no hay', async () => {
			await expect(service.registrarSalida({denominaciones: {'50000': 1}})).rejects.toThrow(BadRequestException);
			expect(repo.save).not.toHaveBeenCalled();
		});

		it('sin arqueo: la salida se registra sin validar contra el conteo', async () => {
			config = {arqueoCaja: false};
			await service.registrarSalida({denominaciones: {'50000': 1}});
			expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({tipo: 'salida', total: 50000}));
		});

		it('skipValidation sigue funcionando (cambio de una factura)', async () => {
			await service.registrarSalida({denominaciones: {'50000': 1}, skipValidation: true});
			expect(repo.save).toHaveBeenCalled();
		});
	});

	describe('ajustes manuales', () => {
		beforeEach(() => {
			movimientos = [{tipo: 'apertura', denominaciones: {'10000': 2}}];
		});

		it('con arqueo: un retiro mayor al conteo falla', async () => {
			await expect(
				service.registrarAjuste({tipo: 'salida', denominaciones: {'50000': 1}, descripcion: 'retiro'}),
			).rejects.toThrow(BadRequestException);
		});

		it('sin arqueo: el retiro pasa', async () => {
			config = {arqueoCaja: false};
			await service.registrarAjuste({tipo: 'salida', denominaciones: {'50000': 1}, descripcion: 'retiro'});
			expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({tipo: 'salida'}));
		});

		it('un cambio de billetes sigue exigiendo total $0 aunque no haya arqueo', async () => {
			config = {arqueoCaja: false};
			await expect(
				service.registrarAjuste({
					tipo: 'cambio',
					denominaciones: {'50000': 1, '10000': -2},
					descripcion: 'cambio',
				}),
			).rejects.toThrow('total de la transacción debe ser $0');
		});
	});

	describe('un arqueo nuevo reemplaza la base del día', () => {
		it('lo cobrado antes de la última apertura no se suma otra vez', async () => {
			movimientos = [
				{tipo: 'entrada', denominaciones: {coins: 60000}}, // cobros de la mañana, sin arqueo
				{tipo: 'entrada', denominaciones: {coins: 40000}},
				{tipo: 'apertura', denominaciones: {'50000': 2}}, // el admin cuenta y deja la caja arqueada
				{tipo: 'entrada', denominaciones: {'20000': 1}}, // cobro posterior
				{tipo: 'salida', denominaciones: {'10000': 0}},
			];
			const estado = await service.getEstadoActual('2026-10-07');
			expect(estado).toEqual({'50000': 2, '20000': 1, '10000': 0});

			const resumen = await service.getResumen('2026-10-07');
			expect(resumen.totalEfectivo).toBe(120000); // 100.000 contados + 20.000 cobrados después
		});

		it('sin apertura se suman todos los movimientos del día (como siempre)', async () => {
			movimientos = [
				{tipo: 'entrada', denominaciones: {'10000': 3}},
				{tipo: 'salida', denominaciones: {'10000': 1}},
			];
			await expect(service.getEstadoActual('2026-10-07')).resolves.toEqual({'10000': 2});
		});

		it('con una sola apertura, cuenta todo el día', async () => {
			movimientos = [
				{tipo: 'apertura', denominaciones: {'10000': 5}},
				{tipo: 'entrada', denominaciones: {'10000': 1}},
			];
			await expect(service.getEstadoActual('2026-10-07')).resolves.toEqual({'10000': 6});
		});
	});
});
