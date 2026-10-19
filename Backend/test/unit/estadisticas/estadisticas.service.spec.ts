import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {EstadisticasService} from '../../../src/estadisticas/estadisticas.service';
import {Ordenes} from '../../../src/ordenes/esquemas/ordenes.entity';
import {OrdenesProductos} from '../../../src/ordenes-productos/esquemas/ordenes-productos.entity';
import {FacturasVentas} from '../../../src/facturas-ventas/esquemas/facturas-ventas.entity';
import {FacturasPagos} from '../../../src/facturas-pagos/esquemas/facturas-pagos.entity';

const makeQb = (overrides: any = {}) => {
	const qb: any = {};
	const chainable = [
		'select',
		'addSelect',
		'innerJoin',
		'innerJoinAndSelect',
		'leftJoin',
		'leftJoinAndSelect',
		'where',
		'andWhere',
		'groupBy',
		'addGroupBy',
		'orderBy',
		'limit',
		'take',
	];
	chainable.forEach((m) => {
		qb[m] = jest.fn().mockReturnValue(qb);
	});
	qb.getRawMany = overrides.getRawMany ?? jest.fn().mockResolvedValue([]);
	qb.getRawOne = overrides.getRawOne ?? jest.fn().mockResolvedValue({});
	qb.getMany = overrides.getMany ?? jest.fn().mockResolvedValue([]);
	return qb;
};

describe('EstadisticasService', () => {
	let service: EstadisticasService;
	let mockOrdenesRepo: any;
	let mockOpRepo: any;
	let mockFacturasRepo: any;
	let mockPagosRepo: any;

	beforeEach(async () => {
		mockOrdenesRepo = {createQueryBuilder: jest.fn()};
		mockOpRepo = {createQueryBuilder: jest.fn()};
		mockFacturasRepo = {
			createQueryBuilder: jest.fn(),
			find: jest.fn(),
			manager: {createQueryBuilder: jest.fn()},
		};
		mockPagosRepo = {createQueryBuilder: jest.fn()};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EstadisticasService,
				{provide: getRepositoryToken(Ordenes), useValue: mockOrdenesRepo},
				{provide: getRepositoryToken(OrdenesProductos), useValue: mockOpRepo},
				{provide: getRepositoryToken(FacturasVentas), useValue: mockFacturasRepo},
				{provide: getRepositoryToken(FacturasPagos), useValue: mockPagosRepo},
			],
		}).compile();

		service = module.get<EstadisticasService>(EstadisticasService);
	});

	// ==================== productosTop ====================

	// ==================== saboresTop ====================

	// ==================== ventasPorHora ====================

	// ==================== ventasPorDia ====================

	// ==================== clientesFrecuentes ====================

	// ==================== facturasDetalle ====================

	describe('facturasDetalle', () => {
		it('retorna facturas del período', async () => {
			const facturas = [{facturaId: 1, total: 50000}];
			mockFacturasRepo.find.mockResolvedValue(facturas);

			const result = await service.facturasDetalle('2025-01-01', '2025-01-01');

			expect(result).toEqual(facturas);
			expect(mockFacturasRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						estado: expect.any(Object),
					}),
				}),
			);
		});
	});

	// ==================== domiciliariosStats ====================
});
