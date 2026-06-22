import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {NotFoundException} from '@nestjs/common';
import {InventarioCajasService} from '../../../src/inventario-cajas/inventario-cajas.service';
import {
	InventarioCajas,
	InventarioCajasMovimiento,
} from '../../../src/inventario-cajas/esquemas/inventario-cajas.entity';

describe('InventarioCajasService', () => {
	let service: InventarioCajasService;
	let mockInventarioRepo: any;
	let mockMovimientosRepo: any;

	beforeEach(async () => {
		mockInventarioRepo = {
			create: jest.fn(),
			save: jest.fn(),
			findOne: jest.fn(),
			find: jest.fn(),
			remove: jest.fn(),
		};
		mockMovimientosRepo = {
			create: jest.fn().mockImplementation((data: any) => data),
			save: jest.fn(),
			find: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				InventarioCajasService,
				{provide: getRepositoryToken(InventarioCajas), useValue: mockInventarioRepo},
				{provide: getRepositoryToken(InventarioCajasMovimiento), useValue: mockMovimientosRepo},
			],
		}).compile();

		service = module.get<InventarioCajasService>(InventarioCajasService);
	});

	// ==================== crear ====================

	describe('crear', () => {
		it('crea y guarda una nueva caja', async () => {
			const inv = {id: 1, nombre: 'Caja Pizza Grande', cantidad: 50, alertaMinimo: 10};
			mockInventarioRepo.create.mockReturnValue(inv);
			mockInventarioRepo.save.mockResolvedValue(inv);

			const result = await service.crear({nombre: 'Caja Pizza Grande', cantidad: 50, alertaMinimo: 10});

			expect(result).toEqual(inv);
			expect(mockInventarioRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({nombre: 'Caja Pizza Grande', cantidad: 50}),
			);
		});

		it('usa cantidad 0 por defecto', async () => {
			const inv = {id: 1, nombre: 'Caja', cantidad: 0};
			mockInventarioRepo.create.mockReturnValue(inv);
			mockInventarioRepo.save.mockResolvedValue(inv);

			await service.crear({nombre: 'Caja'});

			expect(mockInventarioRepo.create).toHaveBeenCalledWith(expect.objectContaining({cantidad: 0}));
		});
	});

	// ==================== eliminar ====================

	describe('eliminar', () => {
		it('elimina la caja existente', async () => {
			const inv = {id: 1, nombre: 'Caja'};
			mockInventarioRepo.findOne.mockResolvedValue(inv);
			mockInventarioRepo.remove.mockResolvedValue(inv);

			await service.eliminar(1);

			expect(mockInventarioRepo.remove).toHaveBeenCalledWith(inv);
		});

		it('lanza NotFoundException cuando la caja no existe', async () => {
			mockInventarioRepo.findOne.mockResolvedValue(null);

			await expect(service.eliminar(99)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== getEstado ====================

	describe('getEstado', () => {
		it('retorna las cajas con enAlerta calculado', async () => {
			mockInventarioRepo.find.mockResolvedValue([
				{id: 1, nombre: 'Caja Grande', cantidad: 5, alertaMinimo: 10},
				{id: 2, nombre: 'Caja Mediana', cantidad: 20, alertaMinimo: 10},
				{id: 3, nombre: 'Caja Sin Alerta', cantidad: 0, alertaMinimo: null},
			]);

			const result = await service.getEstado();

			expect(result).toEqual([
				{id: 1, nombre: 'Caja Grande', cantidad: 5, alertaMinimo: 10, enAlerta: true},
				{id: 2, nombre: 'Caja Mediana', cantidad: 20, alertaMinimo: 10, enAlerta: false},
				{id: 3, nombre: 'Caja Sin Alerta', cantidad: 0, alertaMinimo: null, enAlerta: false},
			]);
		});
	});

	// ==================== ajustar ====================

	describe('ajustar', () => {
		it('suma el delta a la cantidad actual', async () => {
			const inv = {id: 1, nombre: 'Caja Grande', cantidad: 10, alertaMinimo: 5};
			mockInventarioRepo.findOne.mockResolvedValue(inv);
			// mockMovimientosRepo.create is configured in beforeEach to passthrough
			mockMovimientosRepo.save.mockResolvedValue({});
			mockInventarioRepo.save.mockResolvedValue({...inv, cantidad: 15});

			const result = await service.ajustar(1, {delta: 5, tipo: 'entrada'} as any);

			expect(result.cantidad).toBe(15);
			expect(mockMovimientosRepo.save).toHaveBeenCalled();
		});

		it('no permite cantidad negativa (se clampea a 0)', async () => {
			const inv = {id: 1, nombre: 'Caja', cantidad: 3, alertaMinimo: null};
			mockInventarioRepo.findOne.mockResolvedValue(inv);
			// mockMovimientosRepo.create is configured in beforeEach to passthrough
			mockMovimientosRepo.save.mockResolvedValue({});
			mockInventarioRepo.save.mockImplementation(async (i: any) => i);

			const result = await service.ajustar(1, {delta: -10} as any);

			expect(result.cantidad).toBe(0);
		});

		it('infiere tipo "entrada" cuando delta es positivo', async () => {
			const inv = {id: 1, nombre: 'Caja', cantidad: 5, alertaMinimo: null};
			mockInventarioRepo.findOne.mockResolvedValue(inv);
			// mockMovimientosRepo.create is configured in beforeEach to passthrough
			mockMovimientosRepo.save.mockResolvedValue({});
			mockInventarioRepo.save.mockImplementation(async (i: any) => i);

			await service.ajustar(1, {delta: 3} as any);

			expect(mockMovimientosRepo.create).toHaveBeenCalledWith(expect.objectContaining({tipo: 'entrada'}));
		});

		it('lanza NotFoundException cuando la caja no existe', async () => {
			mockInventarioRepo.findOne.mockResolvedValue(null);

			await expect(service.ajustar(99, {delta: 5} as any)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== configurarAlerta ====================

	describe('configurarAlerta', () => {
		it('actualiza el alertaMinimo y lo retorna', async () => {
			const inv = {id: 1, nombre: 'Caja', cantidad: 10, alertaMinimo: null};
			mockInventarioRepo.findOne.mockResolvedValue(inv);
			mockInventarioRepo.save.mockImplementation(async (i: any) => i);

			const result = await service.configurarAlerta(1, {alertaMinimo: 5});

			expect(result).toEqual({alertaMinimo: 5});
		});

		it('lanza NotFoundException cuando la caja no existe', async () => {
			mockInventarioRepo.findOne.mockResolvedValue(null);

			await expect(service.configurarAlerta(99, {alertaMinimo: 5})).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== getMovimientos ====================

	describe('getMovimientos', () => {
		it('retorna los movimientos con cajaNombre', async () => {
			const movimientos = [
				{
					id: 1,
					cajaId: 1,
					caja: {nombre: 'Caja Grande'},
					delta: -2,
					cantidadResultante: 8,
					tipo: 'salida',
					nota: 'Orden #5',
					creadoEn: new Date(),
				},
			];
			mockMovimientosRepo.find.mockResolvedValue(movimientos);

			const result = await service.getMovimientos();

			expect(result[0].cajaNombre).toBe('Caja Grande');
			expect(result[0].delta).toBe(-2);
		});

		it('usa "Caja eliminada" cuando la caja ya no existe', async () => {
			const movimientos = [
				{
					id: 2,
					cajaId: 5,
					caja: null,
					delta: -1,
					cantidadResultante: 0,
					tipo: 'salida',
					nota: null,
					creadoEn: new Date(),
				},
			];
			mockMovimientosRepo.find.mockResolvedValue(movimientos);

			const result = await service.getMovimientos();

			expect(result[0].cajaNombre).toBe('Caja eliminada');
		});
	});

	// ==================== descontarCajasParaOrden ====================

	describe('descontarCajasParaOrden', () => {
		it('descuenta la cantidad correcta de la caja correspondiente', async () => {
			const caja = {id: 1, nombre: 'Caja Pizza Grande', cantidad: 20, alertaMinimo: null};
			mockInventarioRepo.find.mockResolvedValue([caja]);
			mockInventarioRepo.findOne.mockResolvedValue(caja);
			mockMovimientosRepo.save.mockResolvedValue({});
			mockInventarioRepo.save.mockImplementation(async (c: any) => c);

			await service.descontarCajasParaOrden([{varianteNombre: 'Grande', tipoProducto: 'pizza', cantidad: 2}], 7);

			expect(caja.cantidad).toBe(18);
			expect(mockMovimientosRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({delta: -2, nota: 'Orden #7'}),
			);
		});

		it('omite productos que no llevan caja', async () => {
			await service.descontarCajasParaOrden([{varianteNombre: 'Normal', tipoProducto: 'bebida', cantidad: 3}], 8);

			expect(mockInventarioRepo.findOne).not.toHaveBeenCalled();
		});

		it('omite silenciosamente si la caja no está registrada en BD', async () => {
			mockInventarioRepo.find.mockResolvedValue([]);
			mockInventarioRepo.findOne.mockResolvedValue(null);

			await service.descontarCajasParaOrden([{varianteNombre: 'Grande', tipoProducto: 'pizza', cantidad: 1}], 9);

			expect(mockMovimientosRepo.save).not.toHaveBeenCalled();
		});

		it('agrupa múltiples items del mismo tipo de caja', async () => {
			const caja = {id: 1, nombre: 'Caja Pizza Grande', cantidad: 10, alertaMinimo: null};
			mockInventarioRepo.find.mockResolvedValue([caja]);
			mockInventarioRepo.findOne.mockResolvedValue(caja);
			mockMovimientosRepo.save.mockResolvedValue({});
			mockInventarioRepo.save.mockImplementation(async (c: any) => c);

			await service.descontarCajasParaOrden(
				[
					{varianteNombre: 'Grande', tipoProducto: 'pizza', cantidad: 1},
					{varianteNombre: 'Grande', tipoProducto: 'pizza', cantidad: 2},
				],
				10,
			);

			// Solo una llamada a save (agrupado)
			expect(caja.cantidad).toBe(7);
		});
	});
});
