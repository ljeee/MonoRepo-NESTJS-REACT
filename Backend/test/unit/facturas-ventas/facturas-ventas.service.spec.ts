import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {BadRequestException, NotFoundException} from '@nestjs/common';
import {FacturasVentasService} from '../../../src/facturas-ventas/facturas-ventas.service';
import {FacturasVentas} from '../../../src/facturas-ventas/esquemas/facturas-ventas.entity';
import {CajaMovimientosService} from '../../../src/caja-movimientos/caja-movimientos.service';
import {EstadisticasGateway} from '../../../src/estadisticas/estadisticas.gateway';
import {ConsumoOrdenService} from '../../../src/inventario/consumo-orden.service';

const makeQb = () => ({
	leftJoinAndSelect: jest.fn().mockReturnThis(),
	orderBy: jest.fn().mockReturnThis(),
	addOrderBy: jest.fn().mockReturnThis(),
	take: jest.fn().mockReturnThis(),
	skip: jest.fn().mockReturnThis(),
	where: jest.fn().mockReturnThis(),
	andWhere: jest.fn().mockReturnThis(),
	getCount: jest.fn().mockResolvedValue(0),
	getMany: jest.fn().mockResolvedValue([]),
});

describe('FacturasVentasService', () => {
	let service: FacturasVentasService;
	let qb: ReturnType<typeof makeQb>;
	let mockRepo: any;
	let mockCajaMovimientosService: any;
	let mockEstadisticasGateway: any;
	let mockConsumoOrden: any;
	let txManager: any;
	/** cuentas_transferencia que "existen" para resolverCuenta. */
	let cuentas: {id: number; nombre: string; activa?: boolean}[];

	beforeEach(async () => {
		qb = makeQb();
		cuentas = [
			{id: 1, nombre: 'Nequi'},
			{id: 2, nombre: 'Bancolombia'},
		];

		mockRepo = {
			createQueryBuilder: jest.fn(() => qb),
			findOne: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			query: jest.fn(),
			manager: {
				transaction: jest.fn(),
				query: jest.fn(async (sql: string, params: unknown[]) => {
					if (/FROM cuentas_transferencia WHERE id = \$1/.test(sql)) {
						return cuentas.filter((c) => c.id === params[0]);
					}
					if (/lower\(nombre\) = lower/.test(sql)) {
						return cuentas.filter((c) => c.nombre.toLowerCase() === String(params[0]).toLowerCase());
					}
					return [];
				}),
			},
		};

		mockCajaMovimientosService = {
			registrarEntrada: jest.fn().mockResolvedValue(undefined),
			registrarSalida: jest.fn().mockResolvedValue(undefined),
			compensarFactura: jest.fn().mockResolvedValue([]),
			ajustarEfectivoDeFactura: jest.fn().mockResolvedValue(null),
		};

		mockEstadisticasGateway = {
			emitirActualizacionStats: jest.fn(),
		};

		mockConsumoOrden = {reconciliar: jest.fn().mockResolvedValue(true)};
		txManager = {
			query: jest.fn().mockResolvedValue([{ordenId: 7}, {ordenId: 8}]),
			getRepository: jest.fn().mockReturnValue(mockRepo),
		};
		mockRepo.manager.transaction.mockImplementation(async (cb: Function) => cb(txManager));

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FacturasVentasService,
				{provide: getRepositoryToken(FacturasVentas), useValue: mockRepo},
				{provide: CajaMovimientosService, useValue: mockCajaMovimientosService},
				{provide: EstadisticasGateway, useValue: mockEstadisticasGateway},
				{provide: ConsumoOrdenService, useValue: mockConsumoOrden},
			],
		}).compile();

		service = module.get<FacturasVentasService>(FacturasVentasService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('sin rango ni límite: 50 por página', async () => {
			const facturas = [{facturaId: 1, total: 30000, estado: 'pagada'}];
			qb.getCount.mockResolvedValue(1);
			qb.getMany.mockResolvedValue(facturas);

			const result = await service.findAll({});

			expect(result.data).toEqual(facturas);
			expect(result.total).toBe(1);
			expect(result.page).toBe(1);
			expect(result.limit).toBe(50);
			expect(result.totalPages).toBe(1);
			expect(qb.take).toHaveBeenCalledWith(50);
		});

		it('con rango from/to y sin límite devuelve TODO el rango, sin take/skip', async () => {
			const filas = Array(120).fill({facturaId: 1});
			qb.getCount.mockResolvedValue(120);
			qb.getMany.mockResolvedValue(filas);

			const result = await service.findAll({from: '2025-01-01', to: '2025-01-31'});

			expect(result.data).toHaveLength(120);
			expect(result.totalPages).toBe(1);
			expect(result.limit).toBe(0);
			expect(qb.take).not.toHaveBeenCalled();
			expect(qb.skip).not.toHaveBeenCalled();
		});

		it('limit=0 explícito también trae todo (aun sin rango)', async () => {
			qb.getCount.mockResolvedValue(0);

			await service.findAll({limit: 0});

			expect(qb.take).not.toHaveBeenCalled();
		});

		it('aplica filtro de rango de fechas completo', async () => {
			qb.getCount.mockResolvedValue(0);
			qb.getMany.mockResolvedValue([]);

			await service.findAll({from: '2024-01-01', to: '2024-01-31'});

			expect(qb.where).toHaveBeenCalledWith(
				'f.fechaFactura BETWEEN :from AND :to',
				expect.objectContaining({from: expect.any(Date), to: expect.any(Date)}),
			);
		});

		it('aplica filtro solo desde cuando to está ausente', async () => {
			await service.findAll({from: '2024-01-01'});

			expect(qb.where).toHaveBeenCalledWith('f.fechaFactura >= :from', expect.any(Object));
		});

		it('aplica filtro solo hasta cuando from está ausente', async () => {
			await service.findAll({to: '2024-01-31'});

			expect(qb.where).toHaveBeenCalledWith('f.fechaFactura <= :to', expect.any(Object));
		});

		it('calcula totalPages correctamente', async () => {
			qb.getCount.mockResolvedValue(100);
			qb.getMany.mockResolvedValue(Array(10).fill({}));

			const result = await service.findAll({limit: 10});

			expect(result.totalPages).toBe(10);
		});

		it('aplica paginación con take y skip', async () => {
			await service.findAll({page: 3, limit: 15});

			expect(qb.take).toHaveBeenCalledWith(15);
			expect(qb.skip).toHaveBeenCalledWith(30);
		});

		describe('paginación por cursor (rango completo por tandas)', () => {
			const filas = (desde: number, n: number) => Array.from({length: n}, (_, i) => ({facturaId: desde - i}));

			it("'inicio': tanda de 500 por factura_id descendente, sin skip, y `siguiente` = último id si vino llena", async () => {
				qb.getCount.mockResolvedValue(1200);
				qb.getMany.mockResolvedValue(filas(1200, 500));

				const r = await service.findAll({from: '2025-01-01', to: '2025-01-31', cursor: 'inicio'});

				expect(qb.orderBy).toHaveBeenCalledWith('f.facturaId', 'DESC');
				expect(qb.addOrderBy).not.toHaveBeenCalled();
				expect(qb.take).toHaveBeenCalledWith(500);
				expect(qb.skip).toHaveBeenCalledWith(0);
				expect(qb.andWhere).not.toHaveBeenCalledWith('f.facturaId < :despuesDe', expect.anything());
				expect(r).toEqual(expect.objectContaining({total: 1200, limit: 500, totalPages: 1, siguiente: '701'}));
			});

			it('con un id: sigue después de él (id < cursor), con el límite pedido; tanda incompleta = no hay más', async () => {
				qb.getCount.mockResolvedValue(1200);
				qb.getMany.mockResolvedValue(filas(200, 200));

				const r = await service.findAll({from: '2025-01-01', to: '2025-01-31', cursor: '701', limit: 300});

				expect(qb.andWhere).toHaveBeenCalledWith('f.facturaId < :despuesDe', {despuesDe: 701});
				expect(qb.take).toHaveBeenCalledWith(300);
				expect(r.siguiente).toBeNull();
			});

			it('el cursor va después de los filtros (que abren con `where`) y no cambia el total', async () => {
				qb.getCount.mockResolvedValue(42);
				await service.findAll({from: '2025-01-01', to: '2025-01-31', metodo: 'efectivo', cursor: '99'});

				const ordenWhere = qb.where.mock.invocationCallOrder[0];
				const ordenCursor = qb.andWhere.mock.invocationCallOrder[qb.andWhere.mock.calls.findIndex((c) => c[0] === 'f.facturaId < :despuesDe')];
				expect(ordenCursor).toBeGreaterThan(ordenWhere);
			});

			it('nunca más de 1000 por tanda y un cursor inválido vuelve a la paginación de siempre', async () => {
				await service.findAll({cursor: 'inicio', limit: 50000});
				expect(qb.take).toHaveBeenLastCalledWith(1000);

				qb.take.mockClear();
				const r = await service.findAll({cursor: '1; DROP TABLE x'});
				expect(qb.take).toHaveBeenCalledWith(50);
				expect(r.siguiente).toBeNull();
			});
		});

		it('conTransferencia: solo ventas válidas con dinero cobrado por transferencia', async () => {
			await service.findAll({from: '2025-01-01', to: '2025-01-31', conTransferencia: true});

			const sql = qb.andWhere.mock.calls.map((c) => c[0]).join('\n');
			expect(sql).toContain("IS DISTINCT FROM 'cancelado'"); // sqlFacturaValida
			expect(sql).toContain('pago_transferencia'); // sqlMontoTransferencia
			expect(sql).toMatch(/> 0/);
		});

		it('cuenta -1 filtra las facturas sin cuenta; con id, por esa cuenta (desglose incluido)', async () => {
			await service.findAll({cuentaTransferenciaId: -1});
			expect(qb.andWhere.mock.calls.map((c) => c[0]).join('\n')).toContain('cuenta_transferencia_id IS NULL');

			qb.andWhere.mockClear();
			await service.findAll({cuentaTransferenciaId: 2});
			const llamada = qb.andWhere.mock.calls.find((c) => String(c[0]).includes(':cuentaId'));
			expect(llamada?.[1]).toEqual({cuentaId: 2});
			expect(llamada?.[0]).toContain('jsonb_array_elements');
		});
	});

	// ==================== findByDay ====================

	describe('findByDay', () => {
		it('retorna las facturas del día actual', async () => {
			const facturas = [{facturaId: 1}, {facturaId: 2}];
			qb.getMany.mockResolvedValue(facturas);

			const result = await service.findByDay();

			expect(result).toEqual(facturas);
			expect(qb.where).toHaveBeenCalledWith(
				'f.fechaFactura BETWEEN :start AND :end',
				expect.objectContaining({start: expect.any(Date), end: expect.any(Date)}),
			);
		});
	});

	// ==================== getDayStats ====================

	describe('getDayStats', () => {
		it('devuelve la foto del día con las definiciones únicas (SQL del dominio)', async () => {
			mockRepo.query.mockResolvedValue([{count: 3, total: 65000, cobrado: 55000, por_cobrar: 10000}]);

			const result = await service.getDayStats();

			expect(result).toEqual({totalDia: 65000, totalPagado: 55000, totalPendiente: 10000, count: 3});
			const sql: string = mockRepo.query.mock.calls[0][0];
			expect(sql).toContain("IS DISTINCT FROM 'cancelado'"); // anuladas fuera, estado NULL dentro
			expect(sql).toContain("'parcial'"); // los abonos cuentan como cobrado
		});

		it('retorna ceros cuando no hay facturas en el día', async () => {
			mockRepo.query.mockResolvedValue([{count: 0, total: 0, cobrado: 0, por_cobrar: 0}]);

			expect(await service.getDayStats()).toEqual({totalDia: 0, totalPagado: 0, totalPendiente: 0, count: 0});
		});

		it('maneja filas null sin NaN', async () => {
			mockRepo.query.mockResolvedValue([]);

			const result = await service.getDayStats();

			expect(result.totalDia).toBe(0);
			expect(isNaN(result.totalDia)).toBe(false);
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna la factura cuando existe', async () => {
			const factura = {facturaId: 1, total: 30000, estado: 'pagada'};
			mockRepo.findOne.mockResolvedValue(factura);

			const result = await service.findOne(1);

			expect(result).toEqual(factura);
			expect(mockRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({where: {facturaId: 1}}));
		});

		it('lanza NotFoundException cuando la factura no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== create ====================

	describe('create', () => {
		it('guarda y retorna la factura creada', async () => {
			const dto = {clienteNombre: 'Juan', total: 50000, idempotencyKey: 'key-1'};
			const saved = {facturaId: 1, ...dto};
			mockRepo.save.mockResolvedValue(saved);

			const result = await service.create(dto as any);

			expect(result).toEqual(saved);
			expect(mockRepo.save).toHaveBeenCalledWith(dto);
		});
	});

	// ==================== update ====================

	describe('update', () => {
		it('hace simple update cuando el estado NO es pagada', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});

			await service.update(1, {clienteNombre: 'Pedro'});

			expect(mockRepo.update).toHaveBeenCalledWith(1, {clienteNombre: 'Pedro'});
		});

		it('actualiza factura y registra caja cuando el estado cambia a pagada', async () => {
			mockRepo.update.mockResolvedValue({affected: 1});
			const facturaObj = {facturaId: 1, estado: 'pagada', total: 30000, clienteNombre: 'Pedro'};
			mockRepo.findOne.mockResolvedValue(facturaObj);

			const result = await service.update(1, {
				estado: 'pagada',
				metodo: 'efectivo',
				denominaciones: {50000: 1},
				pagoEfectivo: 50000,
			});

			expect(mockRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({estado: 'pagada'}));
			expect(mockCajaMovimientosService.registrarEntrada).toHaveBeenCalledWith(
				expect.objectContaining({facturaVentaId: 1, metodo: 'efectivo'}),
			);
			expect(result).toEqual(facturaObj);
		});

		it('cobrar en efectivo una factura que antes fue QR limpia cuenta y desglose; fija fechaCobro', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 1, total: 30000, metodo: 'transferencia', cuentaTransferenciaId: 1});

			await service.update(1, {estado: 'pagado', metodo: 'efectivo'});

			expect(mockRepo.update).toHaveBeenCalledWith(
				1,
				expect.objectContaining({
					montoPagado: 30000,
					pagoEfectivo: 30000,
					pagoTransferencia: 0,
					cuentaTransferenciaId: null,
					cuentaTransferenciaNombre: null,
					desgloseTransferencia: null,
					fechaCobro: expect.any(Date),
				}),
			);
		});

		it('cobrar por QR: el total va a pagoTransferencia y conserva la cuenta elegida (nombre de la tabla)', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 1, total: 30000});

			await service.update(1, {
				estado: 'pagado',
				metodo: 'transferencia',
				cuentaTransferenciaId: 2,
				cuentaTransferenciaNombre: 'nombre-viejo-del-cliente',
			});

			expect(mockRepo.update).toHaveBeenCalledWith(
				1,
				expect.objectContaining({
					pagoTransferencia: 30000,
					pagoEfectivo: 0,
					cuentaTransferenciaId: 2,
					cuentaTransferenciaNombre: 'Bancolombia',
				}),
			);
		});

		it('asignar una cuenta inexistente falla', async () => {
			await expect(service.update(1, {cuentaTransferenciaId: 99})).rejects.toThrow(BadRequestException);
			expect(mockRepo.update).not.toHaveBeenCalled();
		});

		it('asignar una cuenta solo por un nombre que no existe falla (no se guarda un nombre inventado)', async () => {
			await expect(service.update(1, {cuentaTransferenciaNombre: 'Cuenta fantasma'})).rejects.toThrow(/no existe/);
			expect(mockRepo.update).not.toHaveBeenCalled();
		});

		it('una cuenta desactivada no puede recibir cobros nuevos', async () => {
			cuentas.push({id: 3, nombre: 'Vieja', activa: false});

			await expect(service.update(1, {cuentaTransferenciaId: 3})).rejects.toThrow(/desactivada/);
			expect(mockRepo.update).not.toHaveBeenCalled();
		});

		it('no se reasigna a una sola cuenta una factura abonada por QR a varias (se perdería el reparto)', async () => {
			mockRepo.findOne.mockResolvedValue({
				facturaId: 1,
				desgloseTransferencia: [
					{cuentaId: 1, cuenta: 'Nequi', monto: 10000},
					{cuentaId: 2, cuenta: 'Bancolombia', monto: 5000},
				],
			});

			await expect(service.update(1, {cuentaTransferenciaId: 1})).rejects.toThrow(/varias cuentas/);
			expect(mockRepo.update).not.toHaveBeenCalled();
		});

		it('asignar cuenta a una factura: toda la transferencia va a esa cuenta (borra el desglose)', async () => {
			await service.update(1, {cuentaTransferenciaId: 1, cuentaTransferenciaNombre: 'Nequi'});

			expect(mockRepo.update).toHaveBeenCalledWith(1, {
				cuentaTransferenciaId: 1,
				cuentaTransferenciaNombre: 'Nequi',
				desgloseTransferencia: null,
			});
		});

		it('revertir a pendiente descarta lo cobrado (monto, desglose por método, fecha de cobro)', async () => {
			await service.update(5, {estado: 'pendiente'});

			expect(mockRepo.update).toHaveBeenCalledWith(5, {
				estado: 'pendiente',
				montoPagado: 0,
				pagoEfectivo: null,
				pagoTransferencia: null,
				fechaCobro: null,
				desgloseTransferencia: null,
			});
		});

		describe('cambiar el total de una factura ya cobrada', () => {
			it('efectivo: lo cobrado sigue al nuevo total', async () => {
				mockRepo.findOne.mockResolvedValue({facturaId: 1, estado: 'pagado', metodo: 'efectivo', total: 30000, montoPagado: 30000});

				await service.update(1, {total: 35000});

				expect(mockRepo.update).toHaveBeenCalledWith(1, {total: 35000, montoPagado: 35000, pagoEfectivo: 35000});
			});

			it('mixta: respeta la transferencia y el efectivo absorbe la diferencia', async () => {
				mockRepo.findOne.mockResolvedValue({
					facturaId: 1,
					estado: 'pagado',
					metodo: 'efectivo_transferencia',
					total: 30000,
					pagoEfectivo: 10000,
					pagoTransferencia: 20000,
				});

				await service.update(1, {total: 36000});

				expect(mockRepo.update).toHaveBeenCalledWith(
					1,
					expect.objectContaining({montoPagado: 36000, pagoTransferencia: 20000, pagoEfectivo: 16000}),
				);
			});

			it('parcial cuyo nuevo total ya cubren los abonos queda pagada con su método derivado', async () => {
				mockRepo.findOne.mockResolvedValue({
					facturaId: 1,
					estado: 'parcial',
					total: 50000,
					montoPagado: 20000,
					pagoEfectivo: 5000,
					pagoTransferencia: 15000,
				});

				await service.update(1, {total: 20000});

				expect(mockRepo.update).toHaveBeenCalledWith(
					1,
					expect.objectContaining({estado: 'pagado', metodo: 'efectivo_transferencia', montoPagado: 20000}),
				);
			});

			it('pendiente: solo cambia el total', async () => {
				mockRepo.findOne.mockResolvedValue({facturaId: 1, estado: 'pendiente', total: 30000});

				await service.update(1, {total: 31000});

				expect(mockRepo.update).toHaveBeenCalledWith(1, {total: 31000});
			});
		});
	});

	// ==================== abonos ====================

	describe('registrarAbono', () => {
		const base = {facturaId: 10, clienteNombre: 'Ana', total: 50000};

		beforeEach(() => {
			// findOne se llama al inicio y al final (devuelve la factura ya actualizada)
			mockRepo.update.mockResolvedValue({affected: 1});
		});

		it('abono en efectivo a una pendiente: queda parcial con su desglose y caja', async () => {
			mockRepo.findOne.mockResolvedValue({...base, estado: 'pendiente'});

			await service.registrarAbono(10, {monto: 20000, metodo: 'efectivo', denominaciones: {20000: 1}});

			expect(mockRepo.update).toHaveBeenCalledWith(
				10,
				expect.objectContaining({montoPagado: 20000, estado: 'parcial', pagoEfectivo: 20000, pagoTransferencia: 0}),
			);
			expect(mockCajaMovimientosService.registrarEntrada).toHaveBeenCalledWith(
				expect.objectContaining({facturaVentaId: 10, metodo: 'efectivo'}),
			);
		});

		it('una factura revertida (pendiente con montoPagado viejo) NO suma el abono a lo anterior', async () => {
			// Antes: 50000 (viejo) + 10000 → "pagado" de golpe con un abono de 10000.
			mockRepo.findOne.mockResolvedValue({
				...base,
				estado: 'pendiente',
				montoPagado: 50000,
				pagoEfectivo: 50000,
				pagoTransferencia: 0,
			});

			await service.registrarAbono(10, {monto: 10000, metodo: 'efectivo'});

			expect(mockRepo.update).toHaveBeenCalledWith(
				10,
				expect.objectContaining({montoPagado: 10000, estado: 'parcial', pagoEfectivo: 10000}),
			);
		});

		it('abono que supera el saldo se rechaza', async () => {
			mockRepo.findOne.mockResolvedValue({...base, estado: 'parcial', montoPagado: 40000, pagoEfectivo: 40000});

			await expect(service.registrarAbono(10, {monto: 15000, metodo: 'efectivo'})).rejects.toThrow(
				BadRequestException,
			);
			expect(mockRepo.update).not.toHaveBeenCalled();
		});

		it('abono por QR guarda la cuenta (nombre de la tabla) y su parte del desglose', async () => {
			mockRepo.findOne.mockResolvedValue({...base, estado: 'pendiente'});

			await service.registrarAbono(10, {monto: 20000, metodo: 'transferencia', cuentaTransferenciaId: 1});

			expect(mockRepo.update).toHaveBeenCalledWith(
				10,
				expect.objectContaining({
					pagoTransferencia: 20000,
					cuentaTransferenciaId: 1,
					cuentaTransferenciaNombre: 'Nequi',
					desgloseTransferencia: [{cuentaId: 1, cuenta: 'Nequi', monto: 20000}],
				}),
			);
			expect(mockCajaMovimientosService.registrarEntrada).not.toHaveBeenCalled();
		});

		it('abonos QR a cuentas distintas: cada una conserva su monto; lo previo sin desglose va a la cuenta de la factura', async () => {
			mockRepo.findOne.mockResolvedValue({
				...base,
				estado: 'parcial',
				montoPagado: 10000,
				pagoEfectivo: 0,
				pagoTransferencia: 10000,
				cuentaTransferenciaId: 1,
				cuentaTransferenciaNombre: 'Nequi',
				desgloseTransferencia: null,
			});

			await service.registrarAbono(10, {monto: 15000, metodo: 'transferencia', cuentaTransferenciaId: 2});

			expect(mockRepo.update).toHaveBeenCalledWith(
				10,
				expect.objectContaining({
					montoPagado: 25000,
					pagoTransferencia: 25000,
					cuentaTransferenciaId: 2,
					desgloseTransferencia: [
						{cuentaId: 1, cuenta: 'Nequi', monto: 10000},
						{cuentaId: 2, cuenta: 'Bancolombia', monto: 15000},
					],
				}),
			);
		});

		it('el abono que salda deriva el método final (mixta si hubo efectivo y QR) y fija fechaCobro', async () => {
			mockRepo.findOne.mockResolvedValue({
				...base,
				estado: 'parcial',
				montoPagado: 30000,
				pagoEfectivo: 30000,
				pagoTransferencia: 0,
			});

			await service.registrarAbono(10, {monto: 20000, metodo: 'transferencia', cuentaTransferenciaId: 1});

			expect(mockRepo.update).toHaveBeenCalledWith(
				10,
				expect.objectContaining({
					estado: 'pagado',
					metodo: 'efectivo_transferencia',
					pagoEfectivo: 30000,
					pagoTransferencia: 20000,
					fechaCobro: expect.any(Date),
				}),
			);
		});

		it('no se abona a una factura pagada o cancelada', async () => {
			mockRepo.findOne.mockResolvedValue({...base, estado: 'pagado'});
			await expect(service.registrarAbono(10, {monto: 1000})).rejects.toThrow(BadRequestException);
			mockRepo.findOne.mockResolvedValue({...base, estado: 'cancelado'});
			await expect(service.registrarAbono(10, {monto: 1000})).rejects.toThrow(BadRequestException);
		});
	});

	// ==================== remove ====================

	describe('remove', () => {
		it('elimina la factura por ID', async () => {
			mockRepo.delete.mockResolvedValue({affected: 1});

			await service.remove(1);

			expect(mockRepo.delete).toHaveBeenCalledWith(1);
		});

		it('devuelve el inventario de cada orden antes del borrado en cascada', async () => {
			const pasos: string[] = [];
			mockConsumoOrden.reconciliar.mockImplementation(async (id: number) => pasos.push(`reconciliar ${id}`));
			mockRepo.delete.mockImplementation(async () => pasos.push('delete'));

			await service.remove(1);

			expect(mockConsumoOrden.reconciliar).toHaveBeenCalledWith(7, txManager, {eliminada: true});
			expect(pasos).toEqual(['reconciliar 7', 'reconciliar 8', 'delete']);
		});
	});

	describe('update a cancelado', () => {
		it('anula en una transacción y reconcilia el inventario de sus órdenes', async () => {
			await service.update(3, {estado: 'cancelado'} as any);

			expect(mockRepo.update).toHaveBeenCalledWith(3, {estado: 'cancelado'});
			expect(mockConsumoOrden.reconciliar).toHaveBeenCalledWith(7, txManager, {eliminada: false});
			expect(mockConsumoOrden.reconciliar).toHaveBeenCalledWith(8, txManager, {eliminada: false});
		});

		it('otros cambios de estado no tocan el inventario', async () => {
			await service.update(3, {estado: 'pendiente'} as any);

			expect(mockConsumoOrden.reconciliar).not.toHaveBeenCalled();
		});
	});

	// ==================== caja: reversos y cuenta obligatoria ====================

	describe('efectivo en la caja principal cuando la factura deja de valer', () => {
		it('revertir a pendiente saca de la caja el efectivo que había entrado (en la misma transacción)', async () => {
			await service.update(5, {estado: 'pendiente'} as any);

			expect(mockRepo.manager.transaction).toHaveBeenCalled();
			expect(mockCajaMovimientosService.compensarFactura).toHaveBeenCalledWith(5, 'cobro revertido', txManager);
		});

		it('anular la factura también compensa la caja', async () => {
			await service.update(5, {estado: 'cancelado'} as any);

			expect(mockCajaMovimientosService.compensarFactura).toHaveBeenCalledWith(5, 'factura anulada', txManager);
		});

		it('borrar la factura compensa la caja ANTES del borrado', async () => {
			const orden: string[] = [];
			mockCajaMovimientosService.compensarFactura.mockImplementation(async () => orden.push('compensar'));
			mockRepo.delete.mockImplementation(async () => orden.push('borrar'));

			await service.remove(5);

			expect(orden).toEqual(['compensar', 'borrar']);
		});

		it('editar el total de una factura cobrada en efectivo ajusta la caja por la diferencia', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pagado', metodo: 'efectivo', total: 50000, montoPagado: 50000, pagoEfectivo: 50000});

			await service.update(5, {total: 40000} as any);

			expect(mockCajaMovimientosService.ajustarEfectivoDeFactura).toHaveBeenCalledWith(5, -10000, 'cambio de total');
		});

		it('editar el total de una factura sin cobrar no mueve la caja', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pendiente', total: 50000});

			await service.update(5, {total: 40000} as any);

			expect(mockCajaMovimientosService.ajustarEfectivoDeFactura).not.toHaveBeenCalled();
		});

		it('el cambio entregado queda enlazado a su factura (para poder netear la caja)', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pendiente', total: 30000});

			await service.update(5, {estado: 'pagado', metodo: 'efectivo', denominaciones: {'50000': 1}, pagoEfectivo: 50000, cambioDenominaciones: {'20000': 1}} as any);

			expect(mockCajaMovimientosService.registrarSalida).toHaveBeenCalledWith(expect.objectContaining({facturaVentaId: 5, skipValidation: true}));
		});
	});

	describe('cuenta de transferencia obligatoria al cobrar', () => {
		it('un abono por transferencia sin cuenta se rechaza', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pendiente', total: 50000});

			await expect(service.registrarAbono(5, {monto: 20000, metodo: 'transferencia'} as any)).rejects.toThrow(/cuenta/);
			expect(mockRepo.update).not.toHaveBeenCalled();
		});

		it('un abono por transferencia con cuenta pasa', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pendiente', total: 50000});

			await expect(service.registrarAbono(5, {monto: 20000, metodo: 'transferencia', cuentaTransferenciaId: 1} as any)).resolves.toBeDefined();
		});

		it('cobrar una factura por QR sin cuenta se rechaza; con cuenta o con la que ya tenía, pasa', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pendiente', total: 50000});
			await expect(service.update(5, {estado: 'pagado', metodo: 'qr'} as any)).rejects.toThrow(/cuenta/);

			await expect(service.update(5, {estado: 'pagado', metodo: 'qr', cuentaTransferenciaId: 2} as any)).resolves.toBeDefined();

			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pendiente', total: 50000, cuentaTransferenciaId: 1, cuentaTransferenciaNombre: 'Nequi'});
			await expect(service.update(5, {estado: 'pagado', metodo: 'qr'} as any)).resolves.toBeDefined();
		});

		it('cobrar en efectivo no pide cuenta', async () => {
			mockRepo.findOne.mockResolvedValue({facturaId: 5, estado: 'pendiente', total: 50000});

			await expect(service.update(5, {estado: 'pagado', metodo: 'efectivo'} as any)).resolves.toBeDefined();
		});
	});
});
