import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrdenItemDto } from '../esquemas/ordenes.dto';
import { ProductoVariantes } from '../../productos/esquemas/producto-variantes.entity';
import { OrdenesProductos } from '../../ordenes-productos/esquemas/ordenes-productos.entity';

@Injectable()
export class ProductProcessingService {
	constructor(
		@InjectRepository(ProductoVariantes) private readonly variantesRepo: Repository<ProductoVariantes>,
		@InjectRepository(OrdenesProductos) private readonly ordenesProductosRepo: Repository<OrdenesProductos>,
	) {}

	construirNombreProducto(item: CreateOrdenItemDto): string {
		if (item.tipo?.toLowerCase() === 'pizza') {
			let nombre = `${item.tipo} ${item.tamano ?? ''} ${item.sabor1 ?? ''}`.trim();
			if (item.sabor2) nombre += ` y ${item.sabor2}`;
			if (item.sabor3) nombre += ` y ${item.sabor3}`;
			return nombre;
		}

		let nombre = (item.tipo ?? 'Producto').trim();
		if (item.tamano) nombre += ` ${item.tamano}`;
		if (item.sabor1) nombre += ` ${item.sabor1}`;
		if (item.sabor2) nombre += ` y ${item.sabor2}`;
		if (item.sabor3) nombre += ` y ${item.sabor3}`;
		return nombre;
	}

	async vincularProductoAOrden(
		ordenId: number,
		nombre: string,
		cantidad: number,
		precioUnitario?: number,
		varianteId?: number,
	): Promise<void> {
		const item = new OrdenesProductos();
		item.ordenId = ordenId;
		item.producto = nombre;
		item.cantidad = cantidad;
		item.precioUnitario = precioUnitario ?? null;
		item.varianteId = varianteId ?? null;
		await this.ordenesProductosRepo.save(item);
	}

	async procesarProductos(
		ordenId: number,
		productos: CreateOrdenItemDto[],
	): Promise<{total: number; items: {nombre: string; cantidad: number; precioUnitario: number}[]}> {
		let total = 0;
		const items: {nombre: string; cantidad: number; precioUnitario: number}[] = [];

		for (const item of productos) {
			let nombre = this.construirNombreProducto(item);
			
			const variante = await this.variantesRepo.findOne({
				where: {varianteId: item.varianteId},
				relations: ['producto'],
			});
			if (!variante) {
				throw new BadRequestException(`Variante no encontrada: ${item.varianteId}`);
			}
			
			const precio = Number(variante.precio);
			const varianteId = item.varianteId;
			if (variante.producto) {
				nombre = `${variante.producto.productoNombre} - ${variante.nombre}`;
				const sabores = [item.sabor1, item.sabor2, item.sabor3].filter(Boolean);
				if (sabores.length > 0) {
					nombre += ` (${sabores.join(' + ')})`;
				}
			}

			const cantidad = Number(item.cantidad) || 1;
			total += precio * cantidad;

			await this.vincularProductoAOrden(ordenId, nombre, cantidad, precio, varianteId);
			items.push({nombre, cantidad, precioUnitario: precio});
		}

		return {total, items};
	}
}
