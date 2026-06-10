import {Injectable, NotFoundException} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Productos} from "./esquemas/productos.entity";
import {ProductoVariantes} from "./esquemas/producto-variantes.entity";
import {CreateProductosDto, FindProductosDto} from "./esquemas/productos.dto";

@Injectable()
export class ProductosService {
	constructor(
		@InjectRepository(Productos)
		private readonly repo: Repository<Productos>,
		@InjectRepository(ProductoVariantes)
		private readonly variantesRepo: Repository<ProductoVariantes>,
	) {}

	async findAll(query: FindProductosDto = {}, page = 1, limit = 500) {
		const {activo} = query;
		const qb = this.repo.createQueryBuilder('p')
			.leftJoinAndSelect('p.variantes', 'variantes')
			.orderBy('p.productoNombre', 'ASC')
			.take(limit)
			.skip((page - 1) * limit);

		if (activo !== undefined) {
			qb.andWhere('p.activo = :activo', {activo});
		}

		return qb.getMany();
	}

	async findOne(productoId: number) {
		const producto = await this.repo.findOne({
			where: {productoId},
			relations: ['variantes'],
		});
		if (!producto) {
			throw new NotFoundException(`Producto con ID ${productoId} no encontrado`);
		}
		return producto;
	}

	async findByName(productoNombre: string) {
		const producto = await this.repo.findOne({
			where: {productoNombre},
			relations: ['variantes'],
		});
		if (!producto) {
			throw new NotFoundException(`Producto con nombre ${productoNombre} no encontrado`);
		}
		return producto;
	}

	async create(data: CreateProductosDto) {
		const producto = this.repo.create({
			productoNombre: data.productoNombre,
			descripcion: data.descripcion,
			activo: data.activo ?? true,
			emoji: data.emoji,
		});
		const savedProducto = await this.repo.save(producto) as Productos;

		if (data.variantes && data.variantes.length > 0) {
			const variantes = data.variantes.map(v => this.variantesRepo.create({
				productoId: savedProducto.productoId,
				nombre: v.nombre,
				precio: v.precio,
				descripcion: v.descripcion,
				activo: true,
			}));
			await this.variantesRepo.save(variantes);
			savedProducto.variantes = variantes;
		}

		return savedProducto;
	}

	async update(productoId: number, data: Partial<CreateProductosDto>) {
		await this.repo.update(productoId, {
			productoNombre: data.productoNombre,
			descripcion: data.descripcion,
			activo: data.activo,
			emoji: data.emoji,
		});
		return this.findOne(productoId);
	}

	async remove(productoId: number) {
		return this.repo.delete(productoId);
	}

	async createVariante(productoId: number, nombre: string, precio: number, descripcion?: string, precioLeche?: number | null) {
		const variante = this.variantesRepo.create({
			productoId,
			nombre,
			precio,
			precioLeche: precioLeche ?? null,
			descripcion,
			activo: true,
		});
		return this.variantesRepo.save(variante);
	}

	async getVariantes(productoId: number) {
		return this.variantesRepo.find({
			where: {productoId, activo: true},
			order: {nombre: 'ASC'},
		});
	}

	async updateVariante(varianteId: number, nombre?: string, precio?: number, descripcion?: string, activo?: boolean, precioLeche?: number | null) {
		const updateData: any = {};
		if (nombre !== undefined) updateData.nombre = nombre;
		if (precio !== undefined) updateData.precio = precio;
		// precioLeche can be explicitly null (to clear it) or a number
		if (precioLeche !== undefined) updateData.precioLeche = precioLeche;
		if (descripcion !== undefined) updateData.descripcion = descripcion;
		if (activo !== undefined) updateData.activo = activo;

		await this.variantesRepo.update(varianteId, updateData);
		return this.variantesRepo.findOne({where: {varianteId}});
	}

	async deleteVariante(varianteId: number) {
		await this.variantesRepo.update(varianteId, { activo: false });
		return this.variantesRepo.findOne({where: {varianteId}});
	}

	async ajustarStockBebida(varianteId: number, delta: number): Promise<ProductoVariantes> {
		const variante = await this.variantesRepo.findOne({where: {varianteId}});
		if (!variante) throw new NotFoundException(`Variante con ID ${varianteId} no encontrada`);
		variante.stockBebida = Math.max(0, (variante.stockBebida ?? 0) + delta);
		return this.variantesRepo.save(variante);
	}
}
