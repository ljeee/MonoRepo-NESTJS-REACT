import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Productos} from './esquemas/productos.entity';
import {ProductoVariantes} from './esquemas/producto-variantes.entity';
import {CreateProductosDto, FindProductosDto, TAMANOS_VARIANTE} from './esquemas/productos.dto';
import {derivarCategoriaProducto, esCategoriaProducto} from '../common/utils/catalogo.util';

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
		const qb = this.repo
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.variantes', 'variantes', 'variantes.activo = true')
			.orderBy('p.productoNombre', 'ASC')
			.addOrderBy('variantes.nombre', 'ASC')
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

	/** Verifica que el grupo exista (el FK lo exigiría igual, pero con un mensaje claro). */
	private async validarGrupo(saborGrupoId: number | null | undefined): Promise<void> {
		if (saborGrupoId == null) return;
		const filas: unknown[] = await this.repo.manager.query('SELECT 1 FROM sabor_grupos WHERE id = $1', [saborGrupoId]);
		if (!filas.length) throw new BadRequestException(`Grupo de sabores inexistente: ${saborGrupoId}`);
	}

	private validarTamano(tamano: string | null | undefined): void {
		if (tamano != null && !(TAMANOS_VARIANTE as readonly string[]).includes(tamano)) {
			throw new BadRequestException(`Tamaño inválido: ${tamano}`);
		}
	}

	async create(data: CreateProductosDto) {
		await this.validarGrupo(data.saborGrupoId);
		const producto = this.repo.create({
			productoNombre: data.productoNombre,
			descripcion: data.descripcion,
			activo: data.activo ?? true,
			emoji: data.emoji,
			personalizacion: data.personalizacion ?? null,
			saborGrupoId: data.saborGrupoId ?? null,
			// Sin categoría explícita se deduce del nombre; el admin puede corregirla luego.
			categoria: esCategoriaProducto(data.categoria)
				? data.categoria
				: derivarCategoriaProducto(data.productoNombre, data.personalizacion),
		});
		const savedProducto = await this.repo.save(producto);

		if (data.variantes && data.variantes.length > 0) {
			const variantes = data.variantes.map((v) =>
				this.variantesRepo.create({
					productoId: savedProducto.productoId,
					nombre: v.nombre,
					precio: v.precio,
					descripcion: v.descripcion,
					tamano: v.tamano ?? null,
					activo: true,
				}),
			);
			await this.variantesRepo.save(variantes);
			savedProducto.variantes = variantes;
		}

		return savedProducto;
	}

	async update(productoId: number, data: Partial<CreateProductosDto>) {
		// El PATCH llega como Partial<…> (sin validación de clase): se valida aquí.
		if (data.categoria !== undefined && data.categoria !== null && !esCategoriaProducto(data.categoria)) {
			throw new BadRequestException(`Categoría inválida: ${String(data.categoria)}`);
		}
		await this.validarGrupo(data.saborGrupoId);
		await this.repo.update(productoId, {
			productoNombre: data.productoNombre,
			descripcion: data.descripcion,
			activo: data.activo,
			emoji: data.emoji,
			...(data.personalizacion !== undefined ? {personalizacion: data.personalizacion} : {}),
			...(data.categoria !== undefined ? {categoria: data.categoria} : {}),
			...(data.saborGrupoId !== undefined ? {saborGrupoId: data.saborGrupoId} : {}),
		});
		return this.findOne(productoId);
	}

	async remove(productoId: number) {
		// Borrado real. Antes de eliminar, rompemos las referencias del historial de órdenes
		// (variante_id y "productoObjProductoId" → NULL); el texto, el nombre del producto
		// (producto_base) y el precio quedan en la misma fila, así no se pierde el historial.
		// Sin soltar "productoObjProductoId" el FK (NO ACTION) impediría borrar un producto vendido.
		return this.repo.manager.transaction(async (m) => {
			await m.query('UPDATE ordenes_productos SET "productoObjProductoId" = NULL WHERE "productoObjProductoId" = $1', [
				productoId,
			]);
			const variantes = await m.getRepository(ProductoVariantes).find({where: {productoId}});
			const ids = variantes.map((v) => v.varianteId);
			if (ids.length) {
				await m.query('UPDATE ordenes_productos SET variante_id = NULL WHERE variante_id = ANY($1::int[])', [
					ids,
				]);
			}
			await m.getRepository(ProductoVariantes).delete({productoId});
			return m.getRepository(Productos).delete(productoId);
		});
	}

	async createVariante(
		productoId: number,
		nombre: string,
		precio: number,
		descripcion?: string,
		precioLeche?: number | null,
		tamano?: string | null,
	) {
		this.validarTamano(tamano);
		const variante = this.variantesRepo.create({
			productoId,
			nombre,
			precio,
			precioLeche: precioLeche ?? null,
			tamano: tamano ?? null,
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

	async updateVariante(
		varianteId: number,
		nombre?: string,
		precio?: number,
		descripcion?: string,
		activo?: boolean,
		precioLeche?: number | null,
		tamano?: string | null,
	) {
		this.validarTamano(tamano);
		const updateData: any = {};
		if (nombre !== undefined) updateData.nombre = nombre;
		if (precio !== undefined) updateData.precio = precio;
		// precioLeche can be explicitly null (to clear it) or a number
		if (precioLeche !== undefined) updateData.precioLeche = precioLeche;
		if (descripcion !== undefined) updateData.descripcion = descripcion;
		if (activo !== undefined) updateData.activo = activo;
		// tamano puede ser null explícito (volver a deducirlo del nombre) o un valor
		if (tamano !== undefined) updateData.tamano = tamano;

		await this.variantesRepo.update(varianteId, updateData);
		return this.variantesRepo.findOne({where: {varianteId}});
	}

	async deleteVariante(varianteId: number) {
		// Hard-delete: rompe FK en historial de órdenes (conserva nombre+precio en texto)
		// y elimina la variante (sus reglas de inventario caen por FK en cascada).
		await this.variantesRepo.manager.transaction(async (m) => {
			await m.query('UPDATE ordenes_productos SET variante_id = NULL WHERE variante_id = $1', [varianteId]);
			await m.getRepository(ProductoVariantes).delete(varianteId);
		});
	}
}
