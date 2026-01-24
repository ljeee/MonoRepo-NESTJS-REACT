import {Injectable} from "@nestjs/common";
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
		const {categoria, activo} = query;
		const qb = this.repo.createQueryBuilder('p')
			.leftJoinAndSelect('p.variantes', 'variantes')
			.orderBy('p.categoria', 'ASC')
			.addOrderBy('p.productoNombre', 'ASC')
			.take(limit)
			.skip((page - 1) * limit);

		if (categoria) {
			qb.andWhere('p.categoria = :categoria', {categoria});
		}
		if (activo !== undefined) {
			qb.andWhere('p.activo = :activo', {activo});
		}

		return qb.getMany();
	}

	async findOne(productoId: number) {
		return this.repo.findOne({
			where: {productoId},
			relations: ['variantes'],
		});
	}

	async findByName(productoNombre: string) {
		return this.repo.findOne({
			where: {productoNombre},
			relations: ['variantes'],
		});
	}

	async create(data: CreateProductosDto) {
		const producto = this.repo.create({
			productoNombre: data.productoNombre,
			categoria: data.categoria,
			descripcion: data.descripcion,
			activo: data.activo ?? true,
		});
		const savedProducto = await this.repo.save(producto);

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
			categoria: data.categoria,
			descripcion: data.descripcion,
			activo: data.activo,
		});
		return this.findOne(productoId);
	}

	async remove(productoId: number) {
		return this.repo.delete(productoId);
	}

	async createVariante(productoId: number, nombre: string, precio: number, descripcion?: string) {
		const variante = this.variantesRepo.create({
			productoId,
			nombre,
			precio,
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

	async getCategories() {
		const result = await this.repo.createQueryBuilder('p')
			.select('DISTINCT p.categoria', 'categoria')
			.where('p.activo = :activo', {activo: true})
			.orderBy('p.categoria', 'ASC')
			.getRawMany();
		return result.map(r => r.categoria);
	}

	async updateVariante(varianteId: number, nombre?: string, precio?: number, descripcion?: string, activo?: boolean) {
		const updateData: any = {};
		if (nombre !== undefined) updateData.nombre = nombre;
		if (precio !== undefined) updateData.precio = precio;
		if (descripcion !== undefined) updateData.descripcion = descripcion;
		if (activo !== undefined) updateData.activo = activo;

		await this.variantesRepo.update(varianteId, updateData);
		return this.variantesRepo.findOne({where: {varianteId}});
	}

	async deleteVariante(varianteId: number) {
		return this.variantesRepo.delete(varianteId);
	}
}
