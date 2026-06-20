import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstadisticasService } from '../../../src/estadisticas/estadisticas.service';
import { Ordenes } from '../../../src/ordenes/esquemas/ordenes.entity';
import { OrdenesProductos } from '../../../src/ordenes-productos/esquemas/ordenes-productos.entity';
import { FacturasVentas } from '../../../src/facturas-ventas/esquemas/facturas-ventas.entity';
import { FacturasPagos } from '../../../src/facturas-pagos/esquemas/facturas-pagos.entity';

const makeQb = (overrides: any = {}) => {
	const qb: any = {};
	const chainable = [
		'select', 'addSelect', 'innerJoin', 'leftJoin', 'leftJoinAndSelect',
		'where', 'andWhere', 'groupBy', 'addGroupBy', 'orderBy', 'limit', 'take',
	];
	chainable.forEach(m => { qb[m] = jest.fn().mockReturnValue(qb); });
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
		mockOrdenesRepo = { createQueryBuilder: jest.fn() };
		mockOpRepo = { createQueryBuilder: jest.fn() };
		mockFacturasRepo = {
			createQueryBuilder: jest.fn(),
			find: jest.fn(),
			manager: { createQueryBuilder: jest.fn() },
		};
		mockPagosRepo = { createQueryBuilder: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EstadisticasService,
				{ provide: getRepositoryToken(Ordenes), useValue: mockOrdenesRepo },
				{ provide: getRepositoryToken(OrdenesProductos), useValue: mockOpRepo },
				{ provide: getRepositoryToken(FacturasVentas), useValue: mockFacturasRepo },
				{ provide: getRepositoryToken(FacturasPagos), useValue: mockPagosRepo },
			],
		}).compile();

		service = module.get<EstadisticasService>(EstadisticasService);
	});

	// ==================== productosTop ====================

	describe('productosTop', () => {
		it('retorna los productos top formateados', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([
					{ producto: 'Pizza Grande', totalVendido: '5', ingresos: '150000' },
				]),
			});
			mockOpRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.productosTop('2025-01-01', '2025-01-01');

			expect(result).toEqual([{ producto: 'Pizza Grande', totalVendido: 5, ingresos: 150000 }]);
		});

		it('devuelve lista vacía si no hay datos', async () => {
			mockOpRepo.createQueryBuilder.mockReturnValue(makeQb());

			const result = await service.productosTop('2025-01-01', '2025-01-01');

			expect(result).toEqual([]);
		});
	});

	// ==================== saboresTop ====================

	describe('saboresTop', () => {
		it('extrae sabores de formato con paréntesis', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([
					{ producto: 'Pizza Grande (paisa + hawaiana)', cantidad: '2' },
				]),
			});
			mockOpRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.saboresTop('2025-01-01', '2025-01-01');

			expect(result.find(r => r.sabor === 'paisa')?.cantidad).toBe(2);
			expect(result.find(r => r.sabor === 'hawaiana')?.cantidad).toBe(2);
		});

		it('extrae sabores de formato con "y"', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([
					{ producto: 'Pizza Grande paisa y ranchera', cantidad: '1' },
				]),
			});
			mockOpRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.saboresTop('2025-01-01', '2025-01-01');

			expect(result.find(r => r.sabor === 'paisa')?.cantidad).toBe(1);
		});

		it('retorna lista vacía si no hay pizzas', async () => {
			mockOpRepo.createQueryBuilder.mockReturnValue(makeQb());

			const result = await service.saboresTop('2025-01-01', '2025-01-01');

			expect(result).toEqual([]);
		});
	});

	// ==================== ventasPorHora ====================

	describe('ventasPorHora', () => {
		it('retorna ventas por hora formateadas', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([{ hora: '12', cantidad: '3', total: '90000' }]),
			});
			mockOrdenesRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.ventasPorHora(undefined, '2025-01-01', '2025-01-31');

			expect(result).toEqual([{ hora: 12, cantidad: 3, total: 90000 }]);
		});

		it('usa fecha específica cuando se provee', async () => {
			const qb = makeQb();
			mockOrdenesRepo.createQueryBuilder.mockReturnValue(qb);

			await service.ventasPorHora('2025-01-15');

			expect(qb.where).toHaveBeenCalledWith(
				expect.stringContaining("::date = :fecha"),
				expect.objectContaining({ fecha: '2025-01-15' }),
			);
		});

		it('usa la fecha de hoy cuando no se provee nada', async () => {
			const qb = makeQb();
			mockOrdenesRepo.createQueryBuilder.mockReturnValue(qb);

			await service.ventasPorHora();

			expect(qb.where).toHaveBeenCalled();
		});
	});

	// ==================== ventasPorDia ====================

	describe('ventasPorDia', () => {
		it('calcula ticketPromedio correctamente', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([
					{ fecha: '2025-01-01', cantidad: '4', total: '80000' },
				]),
			});
			mockOrdenesRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.ventasPorDia('2025-01-01', '2025-01-01');

			expect(result[0].ticketPromedio).toBe(20000);
		});

		it('ticketPromedio es 0 cuando no hay ventas', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([
					{ fecha: '2025-01-01', cantidad: '0', total: '0' },
				]),
			});
			mockOrdenesRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.ventasPorDia('2025-01-01', '2025-01-01');

			expect(result[0].ticketPromedio).toBe(0);
		});
	});

	// ==================== metodosPago ====================

	describe('metodosPago', () => {
		it('agrupa correctamente por método de pago', async () => {
			const qb = makeQb({
				getMany: jest.fn().mockResolvedValue([
					{ metodo: 'efectivo', total: 50000, pagoEfectivo: null, pagoTransferencia: null },
					{ metodo: 'transferencia', total: 30000, pagoEfectivo: null, pagoTransferencia: null },
				]),
			});
			mockFacturasRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.metodosPago('2025-01-01', '2025-01-01');

			expect(result.find(r => r.metodo === 'efectivo')?.total).toBe(50000);
			expect(result.find(r => r.metodo === 'transferencia')?.total).toBe(30000);
		});

		it('agrupa efectivo_transferencia como su propio bucket "mixto" (total completo, cuenta 1 vez)', async () => {
			const qb = makeQb({
				getMany: jest.fn().mockResolvedValue([
					{ metodo: 'efectivo_transferencia', total: 70000, pagoEfectivo: 50000, pagoTransferencia: 20000 },
				]),
			});
			mockFacturasRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.metodosPago('2025-01-01', '2025-01-01');

			const mixto = result.find(r => r.metodo === 'mixto');
			expect(mixto?.total).toBe(70000);
			expect(mixto?.cantidad).toBe(1);
			// No debe inflar los buckets de efectivo/transferencia
			expect(result.find(r => r.metodo === 'efectivo')).toBeUndefined();
			expect(result.find(r => r.metodo === 'transferencia')).toBeUndefined();
		});

		it('calcula porcentaje correcto', async () => {
			const qb = makeQb({
				getMany: jest.fn().mockResolvedValue([
					{ metodo: 'efectivo', total: 75000, pagoEfectivo: null, pagoTransferencia: null },
					{ metodo: 'transferencia', total: 25000, pagoEfectivo: null, pagoTransferencia: null },
				]),
			});
			mockFacturasRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.metodosPago('2025-01-01', '2025-01-01');

			const efectivo = result.find(r => r.metodo === 'efectivo');
			expect(efectivo?.porcentaje).toBe(75);
		});

		it('maneja método nulo usando "sin método"', async () => {
			const qb = makeQb({
				getMany: jest.fn().mockResolvedValue([
					{ metodo: null, total: 10000, pagoEfectivo: null, pagoTransferencia: null },
				]),
			});
			mockFacturasRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.metodosPago('2025-01-01', '2025-01-01');

			expect(result.find(r => r.metodo === 'sin método')?.total).toBe(10000);
		});
	});

	// ==================== resumenPeriodo ====================

	describe('resumenPeriodo', () => {
		it('calcula balanceNeto y ticketPromedio correctamente', async () => {
			const ventasQb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ count: '5', total: '100000' }) });
			const egresosQb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ total: '20000' }) });
			const ordenesQb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ count: '4' }) });
			const canceladosQb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ count: '1' }) });

			mockFacturasRepo.createQueryBuilder
				.mockReturnValueOnce(ventasQb);
			mockPagosRepo.createQueryBuilder
				.mockReturnValueOnce(egresosQb);
			mockOrdenesRepo.createQueryBuilder
				.mockReturnValueOnce(ordenesQb)
				.mockReturnValueOnce(canceladosQb);

			const result = await service.resumenPeriodo('2025-01-01', '2025-01-01');

			expect(result.totalVentas).toBe(100000);
			expect(result.totalEgresos).toBe(20000);
			expect(result.balanceNeto).toBe(80000);
			expect(result.ticketPromedio).toBe(20000);
			expect(result.tasaCancelacion).toBe(20);
		});

		it('ticketPromedio es 0 cuando no hay facturas', async () => {
			const zeroQb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ count: '0', total: '0' }) });
			mockFacturasRepo.createQueryBuilder.mockReturnValueOnce(zeroQb);
			mockPagosRepo.createQueryBuilder.mockReturnValueOnce(makeQb({ getRawOne: jest.fn().mockResolvedValue({ total: '0' }) }));
			mockOrdenesRepo.createQueryBuilder
				.mockReturnValueOnce(makeQb({ getRawOne: jest.fn().mockResolvedValue({ count: '0' }) }))
				.mockReturnValueOnce(makeQb({ getRawOne: jest.fn().mockResolvedValue({ count: '0' }) }));

			const result = await service.resumenPeriodo('2025-01-01', '2025-01-01');

			expect(result.ticketPromedio).toBe(0);
			expect(result.tasaCancelacion).toBe(0);
		});
	});

	// ==================== clientesFrecuentes ====================

	describe('clientesFrecuentes', () => {
		it('retorna los clientes frecuentes formateados', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([
					{ clienteNombre: 'Juan', totalOrdenes: '5', gastoTotal: '200000', ultimaVisita: '2025-01-10' },
				]),
			});
			mockFacturasRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.clientesFrecuentes();

			expect(result[0].clienteNombre).toBe('Juan');
			expect(result[0].totalOrdenes).toBe(5);
		});
	});

	// ==================== facturasDetalle ====================

	describe('facturasDetalle', () => {
		it('retorna facturas del período', async () => {
			const facturas = [{ facturaId: 1, total: 50000 }];
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

	describe('domiciliariosStats', () => {
		it('retorna estadísticas de domiciliarios', async () => {
			const qb = makeQb({
				getRawMany: jest.fn().mockResolvedValue([
					{ nombre: 'Carlos', telefono: '3001', entregas: '3', ganancia: '15000' },
				]),
			});
			mockFacturasRepo.manager.createQueryBuilder.mockReturnValue(qb);

			const result = await service.domiciliariosStats('2025-01-01', '2025-01-01');

			expect(result[0].nombre).toBe('Carlos');
			expect(result[0].entregas).toBe(3);
		});
	});

	// ==================== clienteHistorial ====================

	describe('clienteHistorial', () => {
		it('devuelve historial vacío cuando no hay órdenes', async () => {
			const qb = makeQb({ getMany: jest.fn().mockResolvedValue([]) });
			mockOrdenesRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.clienteHistorial('3001234567');

			expect(result.totalOrdenes).toBe(0);
			expect(result.gastoTotal).toBe(0);
			expect(result.ordenes).toEqual([]);
		});

		it('calcula stats correctamente con órdenes completadas y canceladas', async () => {
			const ordenes = [
				{ ordenId: 1, fechaOrden: new Date('2025-01-10'), estadoOrden: 'completado', tipoPedido: 'domicilio', factura: { total: '50000' }, productos: [{ producto: 'Pizza', cantidad: 1 }] },
				{ ordenId: 2, fechaOrden: new Date('2025-01-05'), estadoOrden: 'cancelado', tipoPedido: 'mesa', factura: null, productos: [] },
			];
			const qb = makeQb({ getMany: jest.fn().mockResolvedValue(ordenes).mockResolvedValueOnce(ordenes).mockResolvedValueOnce([]) });
			mockOrdenesRepo.createQueryBuilder.mockReturnValue(qb);

			const result = await service.clienteHistorial('3001234567');

			// deduplication: both calls return the same ordenes, so only unique ones counted
			expect(result.totalOrdenes).toBe(2);
			expect(result.canceladas).toBe(1);
		});
	});
});
