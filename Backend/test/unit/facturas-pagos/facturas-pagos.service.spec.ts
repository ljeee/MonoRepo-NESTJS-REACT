import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException, NotFoundException} from '@nestjs/common';
import {FacturasPagosService} from '../../../src/facturas-pagos/facturas-pagos.service';
import {FacturasPagos} from '../../../src/facturas-pagos/esquemas/facturas-pagos.entity';
import {CajaMovimientosService} from '../../../src/caja-movimientos/caja-movimientos.service';
import {EstadisticasGateway} from '../../../src/estadisticas/estadisticas.gateway';

const makeQb = () => {
	const qb: any = {};
	['where', 'andWhere', 'orderBy', 'addOrderBy', 'take', 'skip'].forEach((m) => {
		qb[m] = jest.fn().mockReturnValue(qb);
	});
	qb.getMany = jest.fn();
	qb.getManyAndCount = jest.fn();
	return qb;
};

describe('FacturasPagosService', () => {
	let service: FacturasPagosService;
	let mockRepo: any;
	let qb: any;
	let mockCajaMovimientosService: any;
	let mockEstadisticasGateway: any;

	beforeEach(async () => {
		qb = makeQb();
		mockRepo = {
			createQueryBuilder: jest.fn().mockReturnValue(qb),
			findOneBy: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			manager: {query: jest.fn().mockResolvedValue([{activa: true}])},
		};

		mockCajaMovimientosService = {
			registrarSalida: jest.fn().mockResolvedValue(undefined),
		};

		mockEstadisticasGateway = {emitirActualizacionStats: jest.fn()};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FacturasPagosService,
				{provide: getRepositoryToken(FacturasPagos), useValue: mockRepo},
				{provide: CajaMovimientosService, useValue: mockCajaMovimientosService},
				{provide: EstadisticasGateway, useValue: mockEstadisticasGateway},
			],
		}).compile();

		service = module.get<FacturasPagosService>(FacturasPagosService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		describe('paginación por cursor', () => {
			it("'inicio': total del filtro aparte, tanda de 500 por pagos_id descendente y `siguiente`", async () => {
				qb.getCount = jest.fn().mockResolvedValue(700);
				qb.getMany.mockResolvedValue(Array.from({length: 500}, (_, i) => ({pagosId: String(700 - i)})));

				const r = await service.findAll({from: '2026-05-01', to: '2026-05-31', cursor: 'inicio'});

				expect(qb.orderBy).toHaveBeenCalledWith('p.pagosId', 'DESC');
				expect(qb.take).toHaveBeenCalledWith(500);
				expect(qb.getManyAndCount).not.toHaveBeenCalled();
				expect(r).toEqual(expect.objectContaining({total: 700, limit: 500, siguiente: '201'}));
			});

			it('con un id sigue después de él; la última tanda devuelve siguiente null', async () => {
				qb.getCount = jest.fn().mockResolvedValue(700);
				qb.getMany.mockResolvedValue([{pagosId: '200'}, {pagosId: '199'}]);

				const r = await service.findAll({from: '2026-05-01', to: '2026-05-31', cursor: '201'});

				expect(qb.andWhere).toHaveBeenCalledWith('p.pagosId < :despuesDe', {despuesDe: '201'});
				expect(r.siguiente).toBeNull();
			});
		});

		it('retorna datos paginados con from y to', async () => {
			const data = [{pagosId: 1}];
			qb.getManyAndCount.mockResolvedValue([data, 1]);

			const result = await service.findAll({from: '2025-01-01', to: '2025-01-31', page: 1, limit: 50});

			expect(result.data).toEqual(data);
			expect(result.total).toBe(1);
			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('BETWEEN'),
				expect.objectContaining({from: '2025-01-01', to: '2025-01-31'}),
			);
		});

		it('filtra solo con from cuando falta to', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({from: '2025-01-01'});

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('>='),
				expect.objectContaining({from: '2025-01-01'}),
			);
		});

		it('filtra solo con to cuando falta from', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({to: '2025-01-31'});

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining('<='),
				expect.objectContaining({to: '2025-01-31'}),
			);
		});

		it('no filtra cuando no hay from ni to', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({});

			expect(qb.where).not.toHaveBeenCalled();
		});

		it('calcula totalPages correctamente', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 25]);

			const result = await service.findAll({limit: 10});

			expect(result.totalPages).toBe(3);
			expect(qb.take).toHaveBeenCalledWith(10);
		});

		it('sin limit (o limit=0) trae TODOS los egresos del rango: sin take ni skip', async () => {
			qb.getManyAndCount.mockResolvedValue([Array(150).fill({}), 150]);

			const result = await service.findAll({from: '2025-01-01', to: '2025-12-31'});
			await service.findAll({limit: 0});

			expect(result.data).toHaveLength(150);
			expect(result.totalPages).toBe(1);
			expect(result.limit).toBe(0);
			expect(qb.take).not.toHaveBeenCalled();
			expect(qb.skip).not.toHaveBeenCalled();
		});

		it('filtra por tipo, categoría y estado', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({tipo: 'costo', categoria: 'insumos', estado: 'pagado'});

			expect(qb.andWhere).toHaveBeenCalledWith('p.tipoGasto = :tipo', {tipo: 'costo'});
			expect(qb.andWhere).toHaveBeenCalledWith('p.categoria = :categoria', {categoria: 'insumos'});
			expect(qb.andWhere).toHaveBeenCalledWith('p.estado = :estado', {estado: 'pagado'});
		});

		it('tipo=sin_clasificar trae los que no tienen tipo (todo el histórico)', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({tipo: 'sin_clasificar'});

			expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('p.tipoGasto IS NULL'));
		});

		it('estado=pendiente incluye los sin estado', async () => {
			qb.getManyAndCount.mockResolvedValue([[], 0]);

			await service.findAll({estado: 'pendiente'});

			expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('p.estado IS NULL'), {pendiente: 'pendiente'});
		});
	});

	// ==================== findByDay ====================

	describe('findByDay', () => {
		it('filtra pagos por la fecha de hoy', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findByDay();

			expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('fechaFactura = :today'), expect.any(Object));
		});
	});

	// ==================== findPendingByDay ====================

	describe('findPendingByDay', () => {
		it('filtra pagos pendientes del día', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findPendingByDay();

			expect(qb.where).toHaveBeenCalledWith(expect.stringContaining('estado = :pendiente'));
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna el pago cuando existe', async () => {
			const pago = {pagosId: 1, total: 50000};
			mockRepo.findOneBy.mockResolvedValue(pago);

			const result = await service.findOne(1);

			expect(result).toEqual(pago);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOneBy.mockResolvedValue(null);

			await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== create ====================

	describe('create', () => {
		it('guarda el pago con fechaFactura asignada automáticamente si no se provee', async () => {
			const data: any = {total: 50000};
			mockRepo.save.mockResolvedValue({pagosId: 1, ...data});

			await service.create(data);

			expect(data.fechaFactura).toBeDefined();
			expect(mockRepo.save).toHaveBeenCalledWith(data);
		});

		it('toma el tipo de la categoría cuando no se indica (nómina → gasto, insumos → costo)', async () => {
			mockRepo.save.mockResolvedValue({pagosId: 1});
			const nomina: any = {total: 1000000, categoria: 'nomina'};
			const insumos: any = {total: 50000, categoria: 'insumos'};

			await service.create(nomina);
			await service.create(insumos);

			expect(nomina.tipoGasto).toBe('gasto');
			expect(insumos.tipoGasto).toBe('costo');
		});

		it('respeta el tipo elegido aunque difiera del de la categoría (nómina de cocina como costo)', async () => {
			mockRepo.save.mockResolvedValue({pagosId: 1});
			const data: any = {total: 800000, categoria: 'nomina', tipoGasto: 'costo'};

			await service.create(data);

			expect(data.tipoGasto).toBe('costo');
		});

		it('sin categoría queda sin clasificar (tipo vacío)', async () => {
			mockRepo.save.mockResolvedValue({pagosId: 1});
			const data: any = {total: 5000};

			await service.create(data);

			expect(data.tipoGasto).toBeUndefined();
		});

		it('conserva fechaFactura si ya viene en los datos', async () => {
			const data: any = {total: 50000, fechaFactura: '2025-01-15'};
			mockRepo.save.mockResolvedValue(data);

			await service.create(data);

			expect(data.fechaFactura).toBe('2025-01-15');
		});
	});

	// ==================== update ====================

	describe('update', () => {
		it('actualiza el pago con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});

			await service.update(1, {estado: 'pagado'} as any);

			expect(mockRepo.update).toHaveBeenCalledWith(1, {estado: 'pagado'});
		});

		it('al cambiar la categoría sin tipo, reclasifica con el tipo de la nueva categoría', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});

			await service.update(1, {categoria: 'servicios'} as any);

			expect(mockRepo.update).toHaveBeenCalledWith(1, {categoria: 'servicios', tipoGasto: 'gasto'});
		});

		it('nunca edita el id ni las denominaciones de la salida de caja ya registrada', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});

			await service.update(1, {pagosId: 99, denominaciones: {50000: 1}, total: 10} as any);

			expect(mockRepo.update).toHaveBeenCalledWith(1, {total: 10});
		});
	});

	// ==================== cuenta de origen de los egresos QR ====================

	describe('cuenta de origen (egresos por QR)', () => {
		it('un egreso por QR exige la cuenta de la que sale', async () => {
			await expect(service.create({total: 100000, metodo: 'qr'} as any)).rejects.toThrow(BadRequestException);
			expect(mockRepo.save).not.toHaveBeenCalled();
		});

		it('guarda la cuenta de origen de un egreso por QR', async () => {
			mockRepo.save.mockResolvedValue({pagosId: 1});
			const data: any = {total: 100000, metodo: 'qr', cuentaOrigenId: 2};

			await service.create(data);

			expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({metodo: 'qr', cuentaOrigenId: 2}));
		});

		it('rechaza una cuenta inexistente o desactivada', async () => {
			mockRepo.manager.query.mockResolvedValueOnce([]);
			await expect(service.create({metodo: 'qr', cuentaOrigenId: 99} as any)).rejects.toThrow(/no existe/);

			mockRepo.manager.query.mockResolvedValueOnce([{activa: false}]);
			await expect(service.create({metodo: 'qr', cuentaOrigenId: 3} as any)).rejects.toThrow(/desactivada/);
		});

		it('un egreso que no es por QR no lleva cuenta aunque venga una', async () => {
			mockRepo.save.mockResolvedValue({pagosId: 1});
			const data: any = {total: 5000, metodo: 'efectivo', cuentaOrigenId: 2};

			await service.create(data);

			expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({cuentaOrigenId: null}));
		});

		it('al pasar un egreso a QR hay que elegir la cuenta; al sacarlo de QR se limpia', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});
			mockRepo.findOneBy.mockResolvedValue({pagosId: 1, metodo: 'efectivo', cuentaOrigenId: null});
			await expect(service.update(1, {metodo: 'qr'} as any)).rejects.toThrow(BadRequestException);

			await service.update(1, {metodo: 'qr', cuentaOrigenId: 2} as any);
			expect(mockRepo.update).toHaveBeenCalledWith(1, {metodo: 'qr', cuentaOrigenId: 2});

			mockRepo.findOneBy.mockResolvedValue({pagosId: 1, metodo: 'qr', cuentaOrigenId: 2});
			await service.update(1, {metodo: 'efectivo'} as any);
			expect(mockRepo.update).toHaveBeenLastCalledWith(1, {metodo: 'efectivo', cuentaOrigenId: null});
		});

		it('asignar la cuenta a un egreso QR histórico (sin cuenta) funciona; una cuenta ya usada puede estar desactivada', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});
			mockRepo.findOneBy.mockResolvedValue({pagosId: 7, metodo: 'qr', cuentaOrigenId: null});
			await service.update(7, {cuentaOrigenId: 1} as any);
			expect(mockRepo.update).toHaveBeenCalledWith(7, {cuentaOrigenId: 1});

			// Reeditar otro campo de un egreso cuya cuenta luego se desactivó no debe fallar.
			mockRepo.findOneBy.mockResolvedValue({pagosId: 8, metodo: 'qr', cuentaOrigenId: 4});
			mockRepo.manager.query.mockResolvedValueOnce([{activa: false}]);
			await expect(service.update(8, {cuentaOrigenId: 4} as any)).resolves.toBeDefined();
		});
	});

	// ==================== remove ====================

	describe('remove', () => {
		it('elimina el pago por id', async () => {
			mockRepo.delete.mockResolvedValue({affected: 1});

			await service.remove(5);

			expect(mockRepo.delete).toHaveBeenCalledWith(5);
		});
	});
});
