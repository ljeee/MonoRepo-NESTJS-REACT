import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FacturaCreationService } from '../../../../src/ordenes/services/factura-creation.service';
import { FacturasVentas } from '../../../../src/facturas-ventas/esquemas/facturas-ventas.entity';

describe('FacturaCreationService', () => {
	let service: FacturaCreationService;
	let mockRepo: any;

	beforeEach(async () => {
		mockRepo = {
			findOne: jest.fn(),
			save: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FacturaCreationService,
				{ provide: getRepositoryToken(FacturasVentas), useValue: mockRepo },
			],
		}).compile();

		service = module.get<FacturaCreationService>(FacturaCreationService);
	});

	describe('generarDescripcionFactura', () => {
		const construirNombre = (item: any) => `${item.tipo} ${item.tamano ?? ''} ${item.sabor1 ?? ''}`.trim();

		it('genera descripción con un solo producto', () => {
			const items = [{ tipo: 'Pizza', tamano: 'grande', sabor1: 'paisa', cantidad: 1 }];
			const result = service.generarDescripcionFactura(items as any, construirNombre);
			expect(result).toBe('1 Pizza grande paisa');
		});

		it('genera descripción con varios productos', () => {
			const items = [
				{ tipo: 'Pizza', tamano: 'grande', sabor1: 'paisa', cantidad: 2 },
				{ tipo: 'Chuzo', cantidad: 1 },
			];
			const result = service.generarDescripcionFactura(items as any, construirNombre);
			expect(result).toContain('2 Pizza grande paisa');
			expect(result).toContain('1 Chuzo');
		});

		it('usa cantidad 1 cuando no se especifica cantidad', () => {
			const items = [{ tipo: 'Bebida', cantidad: undefined }];
			const result = service.generarDescripcionFactura(items as any, construirNombre);
			expect(result).toBe('1 Bebida');
		});

		it('retorna cadena vacía para lista vacía', () => {
			const result = service.generarDescripcionFactura([], construirNombre);
			expect(result).toBe('');
		});
	});

	describe('crearFactura', () => {
		it('crea y guarda una factura con el cliente y método', async () => {
			const factura = { facturaId: 1, clienteNombre: 'Juan', metodo: 'efectivo' };
			mockRepo.create.mockReturnValue(factura);
			mockRepo.save.mockResolvedValue(factura);

			const result = await service.crearFactura('Juan', 'efectivo', 'desc');

			expect(mockRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ clienteNombre: 'Juan', metodo: 'efectivo' }),
			);
			expect(result).toEqual(factura);
		});

		it('usa el repo del manager cuando se provee', async () => {
			const managerRepo = { create: jest.fn().mockReturnValue({}), save: jest.fn().mockResolvedValue({ facturaId: 2 }) };
			const manager = { getRepository: jest.fn().mockReturnValue(managerRepo) };

			await service.crearFactura('Ana', undefined, undefined, manager as any);

			expect(manager.getRepository).toHaveBeenCalledWith(FacturasVentas);
			expect(managerRepo.save).toHaveBeenCalled();
		});

		it('no asigna metodo cuando es undefined', async () => {
			mockRepo.create.mockReturnValue({});
			mockRepo.save.mockResolvedValue({ facturaId: 1 });

			await service.crearFactura('Cliente', undefined);

			const createArg = mockRepo.create.mock.calls[0][0];
			expect(createArg.metodo).toBeUndefined();
		});
	});

	describe('findByIdempotencyKey', () => {
		it('retorna la factura cuando la key existe', async () => {
			const factura = { facturaId: 1, idempotencyKey: 'key-abc' };
			mockRepo.findOne.mockResolvedValue(factura);

			const result = await service.findByIdempotencyKey('key-abc');

			expect(result).toEqual(factura);
			expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { idempotencyKey: 'key-abc' } });
		});

		it('retorna null cuando la key no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);
			const result = await service.findByIdempotencyKey('no-existe');
			expect(result).toBeNull();
		});
	});

	describe('updateFactura', () => {
		it('actualiza la factura con los campos dados', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.updateFactura(1, { metodo: 'transferencia', estado: 'pagada' });

			expect(mockRepo.update).toHaveBeenCalledWith(
				1,
				expect.objectContaining({ metodo: 'transferencia', estado: 'pagada' }),
			);
		});

		it('usa el repo del manager cuando se provee', async () => {
			const managerRepo = { update: jest.fn().mockResolvedValue({}) };
			const manager = { getRepository: jest.fn().mockReturnValue(managerRepo) };

			await service.updateFactura(5, { total: 99000 }, manager as any);

			expect(managerRepo.update).toHaveBeenCalledWith(5, { total: 99000 });
		});
	});

	describe('updateFacturaTotal', () => {
		it('actualiza solo el total de la factura', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.updateFacturaTotal(1, 75000);

			expect(mockRepo.update).toHaveBeenCalledWith(1, { total: 75000 });
		});
	});

	describe('cancelarFactura', () => {
		it('cambia el estado de la factura a cancelado', async () => {
			mockRepo.update.mockResolvedValue({ affected: 1 });

			await service.cancelarFactura(3);

			expect(mockRepo.update).toHaveBeenCalledWith(3, { estado: 'cancelado' });
		});

		it('usa el repo del manager cuando se provee', async () => {
			const managerRepo = { update: jest.fn().mockResolvedValue({}) };
			const manager = { getRepository: jest.fn().mockReturnValue(managerRepo) };

			await service.cancelarFactura(3, manager as any);

			expect(managerRepo.update).toHaveBeenCalledWith(3, { estado: 'cancelado' });
		});
	});
});
