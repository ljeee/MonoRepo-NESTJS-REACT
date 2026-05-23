import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { ProductProcessingService } from '../../../../src/ordenes/services/product-processing.service';
import { ProductoVariantes } from '../../../../src/productos/esquemas/producto-variantes.entity';
import { OrdenesProductos } from '../../../../src/ordenes-productos/esquemas/ordenes-productos.entity';
import { PizzaSabor } from '../../../../src/pizza-sabores/esquemas/pizza-sabores.entity';

describe('ProductProcessingService', () => {
	let service: ProductProcessingService;
	let mockVariantesRepo: any;
	let mockOrdenesProductosRepo: any;
	let mockSaboresRepo: any;
	let mockQb: any;

	beforeEach(async () => {
		mockQb = { where: jest.fn().mockReturnThis(), getMany: jest.fn() };
		mockVariantesRepo = { findOne: jest.fn() };
		mockOrdenesProductosRepo = { save: jest.fn(), delete: jest.fn() };
		mockSaboresRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue(mockQb) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ProductProcessingService,
				{ provide: getRepositoryToken(ProductoVariantes), useValue: mockVariantesRepo },
				{ provide: getRepositoryToken(OrdenesProductos), useValue: mockOrdenesProductosRepo },
				{ provide: getRepositoryToken(PizzaSabor), useValue: mockSaboresRepo },
			],
		}).compile();

		service = module.get<ProductProcessingService>(ProductProcessingService);
	});

	// ==================== construirNombreProducto ====================

	describe('construirNombreProducto', () => {
		it('construye nombre para pizza con un sabor', () => {
			const result = service.construirNombreProducto({ tipo: 'pizza', tamano: 'grande', sabor1: 'paisa' } as any);
			expect(result).toBe('pizza grande paisa');
		});

		it('construye nombre para pizza con dos sabores', () => {
			const result = service.construirNombreProducto({ tipo: 'Pizza', tamano: 'mediana', sabor1: 'paisa', sabor2: 'hawaiana' } as any);
			expect(result).toBe('Pizza mediana paisa y hawaiana');
		});

		it('construye nombre para pizza con tres sabores', () => {
			const result = service.construirNombreProducto({ tipo: 'Pizza', tamano: 'grande', sabor1: 'paisa', sabor2: 'hawaiana', sabor3: 'bbq' } as any);
			expect(result).toBe('Pizza grande paisa y hawaiana y bbq');
		});

		it('construye nombre para producto no-pizza', () => {
			const result = service.construirNombreProducto({ tipo: 'Chuzo' } as any);
			expect(result).toBe('Chuzo');
		});

		it('construye nombre para producto no-pizza con tamaño', () => {
			const result = service.construirNombreProducto({ tipo: 'Bebida', tamano: 'grande' } as any);
			expect(result).toBe('Bebida grande');
		});

		it('usa "Producto" como fallback cuando tipo es undefined', () => {
			const result = service.construirNombreProducto({ tipo: undefined } as any);
			expect(result).toBe('Producto');
		});
	});

	// ==================== vincularProductoAOrden ====================

	describe('vincularProductoAOrden', () => {
		it('guarda el producto usando el repo directo', async () => {
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			await service.vincularProductoAOrden(1, 'Pizza grande', 2, 25000, 5);

			expect(mockOrdenesProductosRepo.save).toHaveBeenCalledWith(
				expect.objectContaining({ ordenId: 1, producto: 'Pizza grande', cantidad: 2, precioUnitario: 25000, varianteId: 5 }),
			);
		});

		it('asigna null cuando no se provee precioUnitario ni varianteId', async () => {
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			await service.vincularProductoAOrden(1, 'Combo', 1);

			const saved = mockOrdenesProductosRepo.save.mock.calls[0][0];
			expect(saved.precioUnitario).toBeNull();
			expect(saved.varianteId).toBeNull();
		});

		it('usa el repo del manager cuando se provee', async () => {
			const managerRepo = { save: jest.fn().mockResolvedValue({}) };
			const manager = { getRepository: jest.fn().mockReturnValue(managerRepo) };

			await service.vincularProductoAOrden(1, 'Bebida', 1, undefined, undefined, manager as any);

			expect(manager.getRepository).toHaveBeenCalledWith(OrdenesProductos);
			expect(managerRepo.save).toHaveBeenCalled();
		});
	});

	// ==================== eliminarProductosDeOrden ====================

	describe('eliminarProductosDeOrden', () => {
		it('elimina por ordenId usando el repo directo', async () => {
			mockOrdenesProductosRepo.delete.mockResolvedValue({ affected: 3 });

			await service.eliminarProductosDeOrden(5);

			expect(mockOrdenesProductosRepo.delete).toHaveBeenCalledWith({ ordenId: 5 });
		});

		it('usa el repo del manager cuando se provee', async () => {
			const managerRepo = { delete: jest.fn().mockResolvedValue({}) };
			const manager = { getRepository: jest.fn().mockReturnValue(managerRepo) };

			await service.eliminarProductosDeOrden(3, manager as any);

			expect(manager.getRepository).toHaveBeenCalledWith(OrdenesProductos);
			expect(managerRepo.delete).toHaveBeenCalledWith({ ordenId: 3 });
		});
	});

	// ==================== procesarProductos ====================

	describe('procesarProductos', () => {
		it('lanza BadRequestException si no se encuentra la variante', async () => {
			mockVariantesRepo.findOne.mockResolvedValue(null);

			await expect(
				service.procesarProductos(1, [{ varianteId: 99, cantidad: 1 } as any]),
			).rejects.toThrow(BadRequestException);
		});

		it('calcula total sin sabores', async () => {
			mockVariantesRepo.findOne.mockResolvedValue({ varianteId: 1, precio: 20000, nombre: 'Grande', producto: { productoNombre: 'Chuzo' } });
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			const result = await service.procesarProductos(1, [{ varianteId: 1, cantidad: 2 } as any]);

			expect(result.total).toBe(40000);
			expect(result.items).toHaveLength(1);
			expect(result.items[0].precioUnitario).toBe(20000);
		});

		it('agrega recargo por sabor especial en variante grande', async () => {
			mockVariantesRepo.findOne.mockResolvedValue({ varianteId: 1, precio: 30000, nombre: 'Grande', producto: { productoNombre: 'Pizza' } });
			mockQb.getMany.mockResolvedValue([{ nombre: 'especial1', tipo: 'especial', recargoGrande: '5000' }]);
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			const result = await service.procesarProductos(1, [{ varianteId: 1, cantidad: 1, sabor1: 'especial1' } as any]);

			expect(result.total).toBe(35000);
			expect(result.items[0].precioUnitario).toBe(35000);
		});

		it('aplica recargoPequena cuando la variante es pequeña', async () => {
			mockVariantesRepo.findOne.mockResolvedValue({ varianteId: 1, precio: 15000, nombre: 'Pequeña', producto: { productoNombre: 'Pizza' } });
			mockQb.getMany.mockResolvedValue([{ nombre: 'especial1', tipo: 'especial', recargoPequena: '2000' }]);
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			const result = await service.procesarProductos(1, [{ varianteId: 1, cantidad: 1, sabor1: 'especial1' } as any]);

			expect(result.total).toBe(17000);
		});

		it('aplica recargoMediana cuando la variante es mediana', async () => {
			mockVariantesRepo.findOne.mockResolvedValue({ varianteId: 1, precio: 22000, nombre: 'Mediana', producto: { productoNombre: 'Pizza' } });
			mockQb.getMany.mockResolvedValue([{ nombre: 'especial1', tipo: 'especial', recargoMediana: '3000' }]);
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			const result = await service.procesarProductos(1, [{ varianteId: 1, cantidad: 1, sabor1: 'especial1' } as any]);

			expect(result.total).toBe(25000);
		});

		it('agrega recargo por 3 sabores usando config de la DB', async () => {
			mockVariantesRepo.findOne.mockResolvedValue({ varianteId: 1, precio: 30000, nombre: 'Grande', producto: { productoNombre: 'Pizza' } });
			mockQb.getMany.mockResolvedValue([]);
			mockSaboresRepo.findOne.mockResolvedValue({ nombre: 'RECARGO_3_SABORES', tipo: 'configuracion', recargoGrande: '4000' });
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			const result = await service.procesarProductos(1, [
				{ varianteId: 1, cantidad: 1, sabor1: 's1', sabor2: 's2', sabor3: 's3' } as any,
			]);

			expect(result.total).toBe(34000);
		});

		it('usa fallback de 3000 para recargo de 3 sabores si no hay config en DB', async () => {
			mockVariantesRepo.findOne.mockResolvedValue({ varianteId: 1, precio: 30000, nombre: 'Grande', producto: { productoNombre: 'Pizza' } });
			mockQb.getMany.mockResolvedValue([]);
			mockSaboresRepo.findOne.mockResolvedValue(null);
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			const result = await service.procesarProductos(1, [
				{ varianteId: 1, cantidad: 1, sabor1: 's1', sabor2: 's2', sabor3: 's3' } as any,
			]);

			expect(result.total).toBe(33000);
		});

		it('procesa múltiples productos y acumula el total correctamente', async () => {
			mockVariantesRepo.findOne
				.mockResolvedValueOnce({ varianteId: 1, precio: 20000, nombre: 'Grande', producto: { productoNombre: 'Chuzo' } })
				.mockResolvedValueOnce({ varianteId: 2, precio: 10000, nombre: 'Pequeño', producto: { productoNombre: 'Bebida' } });
			mockOrdenesProductosRepo.save.mockResolvedValue({});

			const result = await service.procesarProductos(1, [
				{ varianteId: 1, cantidad: 1 } as any,
				{ varianteId: 2, cantidad: 2 } as any,
			]);

			expect(result.total).toBe(40000);
			expect(result.items).toHaveLength(2);
		});

		it('usa los repos del manager cuando se provee', async () => {
			const managerVRepo = {
				findOne: jest.fn().mockResolvedValue({ varianteId: 1, precio: 10000, nombre: 'Mediana', producto: { productoNombre: 'Bebida' } }),
			};
			const managerSRepo = {};
			const managerOPRepo = { save: jest.fn().mockResolvedValue({}) };
			const manager = {
				getRepository: jest.fn()
					.mockImplementationOnce(() => managerVRepo)
					.mockImplementationOnce(() => managerSRepo)
					.mockImplementationOnce(() => managerOPRepo),
			};

			await service.procesarProductos(1, [{ varianteId: 1, cantidad: 1 } as any], manager as any);

			expect(managerVRepo.findOne).toHaveBeenCalled();
			expect(managerOPRepo.save).toHaveBeenCalled();
		});
	});
});
