import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductosService } from '../../../src/productos/productos.service';
import { Productos } from '../../../src/productos/esquemas/productos.entity';
import { ProductoVariantes } from '../../../src/productos/esquemas/producto-variantes.entity';

const makeQb = () => {
	const qb: any = {};
	['leftJoinAndSelect', 'orderBy', 'take', 'skip', 'andWhere'].forEach(m => {
		qb[m] = jest.fn().mockReturnValue(qb);
	});
	qb.getMany = jest.fn();
	return qb;
};

describe('ProductosService', () => {
	let service: ProductosService;
	let mockRepo: any;
	let mockVariantesRepo: any;
	let qb: any;

	beforeEach(async () => {
		qb = makeQb();
		mockRepo = {
			createQueryBuilder: jest.fn().mockReturnValue(qb),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};
		mockVariantesRepo = {
			create: jest.fn(),
			save: jest.fn(),
			find: jest.fn(),
			findOne: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ProductosService,
				{ provide: getRepositoryToken(Productos), useValue: mockRepo },
				{ provide: getRepositoryToken(ProductoVariantes), useValue: mockVariantesRepo },
			],
		}).compile();

		service = module.get<ProductosService>(ProductosService);
	});

	// ==================== findAll ====================

	describe('findAll', () => {
		it('retorna todos los productos con sus variantes', async () => {
			const list = [{ productoId: 1, productoNombre: 'Pizza' }];
			qb.getMany.mockResolvedValue(list);

			const result = await service.findAll();

			expect(result).toEqual(list);
			expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('p.variantes', 'variantes');
		});

		it('filtra por activo cuando se especifica', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findAll({ activo: true });

			expect(qb.andWhere).toHaveBeenCalledWith('p.activo = :activo', { activo: true });
		});

		it('no filtra cuando activo es undefined', async () => {
			qb.getMany.mockResolvedValue([]);

			await service.findAll({});

			expect(qb.andWhere).not.toHaveBeenCalled();
		});
	});

	// ==================== findOne ====================

	describe('findOne', () => {
		it('retorna el producto cuando existe', async () => {
			const producto = { productoId: 1, productoNombre: 'Pizza' };
			mockRepo.findOne.mockResolvedValue(producto);

			const result = await service.findOne(1);

			expect(result).toEqual(producto);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== findByName ====================

	describe('findByName', () => {
		it('retorna el producto por nombre', async () => {
			const producto = { productoId: 1, productoNombre: 'Pizza' };
			mockRepo.findOne.mockResolvedValue(producto);

			const result = await service.findByName('Pizza');

			expect(result).toEqual(producto);
		});

		it('lanza NotFoundException cuando no existe', async () => {
			mockRepo.findOne.mockResolvedValue(null);

			await expect(service.findByName('Inexistente')).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== create ====================

	describe('create', () => {
		it('crea producto sin variantes', async () => {
			const dto = { productoNombre: 'Bebida', descripcion: 'Refrescos', activo: true } as any;
			const producto = { productoId: 1, ...dto };
			mockRepo.create.mockReturnValue(producto);
			mockRepo.save.mockResolvedValue(producto);

			const result = await service.create(dto);

			expect(result.productoId).toBe(1);
			expect(mockVariantesRepo.save).not.toHaveBeenCalled();
		});

		it('crea producto con variantes', async () => {
			const dto = {
				productoNombre: 'Pizza',
				variantes: [{ nombre: 'Grande', precio: 30000 }],
			} as any;
			const producto = { productoId: 1, productoNombre: 'Pizza', variantes: [] };
			mockRepo.create.mockReturnValue(producto);
			mockRepo.save.mockResolvedValue(producto);
			const variante = { varianteId: 1, nombre: 'Grande', precio: 30000 };
			mockVariantesRepo.create.mockReturnValue(variante);
			mockVariantesRepo.save.mockResolvedValue([variante]);

			const result = await service.create(dto);

			expect(mockVariantesRepo.save).toHaveBeenCalled();
			expect(result.variantes).toHaveLength(1);
		});

		it('usa activo=true por defecto cuando no se especifica', async () => {
			const dto = { productoNombre: 'Chuzo' } as any;
			mockRepo.create.mockReturnValue({ productoId: 1, activo: true });
			mockRepo.save.mockResolvedValue({ productoId: 1, activo: true });

			await service.create(dto);

			expect(mockRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ activo: true }),
			);
		});
	});

	// ==================== update ====================

	describe('update', () => {
		it('actualiza el producto y retorna el resultado', async () => {
			const updated = { productoId: 1, productoNombre: 'Pizza Actualizada' };
			mockRepo.update.mockResolvedValue({ affected: 1 });
			mockRepo.findOne.mockResolvedValue(updated);

			const result = await service.update(1, { productoNombre: 'Pizza Actualizada' } as any);

			expect(result).toEqual(updated);
		});
	});

	// ==================== remove ====================

	describe('remove', () => {
		it('elimina el producto por id', async () => {
			mockRepo.delete.mockResolvedValue({ affected: 1 });

			await service.remove(1);

			expect(mockRepo.delete).toHaveBeenCalledWith(1);
		});
	});

	// ==================== variantes ====================

	describe('createVariante', () => {
		it('crea y guarda una variante', async () => {
			const variante = { varianteId: 1, nombre: 'Grande', precio: 30000, productoId: 1 };
			mockVariantesRepo.create.mockReturnValue(variante);
			mockVariantesRepo.save.mockResolvedValue(variante);

			const result = await service.createVariante(1, 'Grande', 30000);

			expect(result).toEqual(variante);
		});
	});

	describe('getVariantes', () => {
		it('retorna variantes activas del producto ordenadas por nombre', async () => {
			const list = [{ varianteId: 1, nombre: 'Grande', activo: true }];
			mockVariantesRepo.find.mockResolvedValue(list);

			const result = await service.getVariantes(1);

			expect(result).toEqual(list);
			expect(mockVariantesRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({ where: { productoId: 1, activo: true } }),
			);
		});
	});

	describe('updateVariante', () => {
		it('actualiza solo los campos provistos', async () => {
			const updated = { varianteId: 1, nombre: 'Nuevo', precio: 35000 };
			mockVariantesRepo.update.mockResolvedValue({ affected: 1 });
			mockVariantesRepo.findOne.mockResolvedValue(updated);

			const result = await service.updateVariante(1, 'Nuevo', 35000);

			expect(mockVariantesRepo.update).toHaveBeenCalledWith(
				1,
				expect.objectContaining({ nombre: 'Nuevo', precio: 35000 }),
			);
			expect(result).toEqual(updated);
		});
	});

	describe('deleteVariante', () => {
		it('elimina la variante por id', async () => {
			mockVariantesRepo.delete.mockResolvedValue({ affected: 1 });

			await service.deleteVariante(5);

			expect(mockVariantesRepo.delete).toHaveBeenCalledWith(5);
		});
	});
});
