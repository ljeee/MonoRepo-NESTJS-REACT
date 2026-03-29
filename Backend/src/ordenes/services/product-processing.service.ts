import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrdenItemDto } from '../esquemas/ordenes.dto';
import { ProductoVariantes } from '../../productos/esquemas/producto-variantes.entity';
import { OrdenesProductos } from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import { PizzaSabor } from '../../pizza-sabores/esquemas/pizza-sabores.entity';

@Injectable()
export class ProductProcessingService {
	constructor(
		@InjectRepository(ProductoVariantes) private readonly variantesRepo: Repository<ProductoVariantes>,
		@InjectRepository(OrdenesProductos) private readonly ordenesProductosRepo: Repository<OrdenesProductos>,
		@InjectRepository(PizzaSabor) private readonly saboresRepo: Repository<PizzaSabor>,
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

	async eliminarProductosDeOrden(ordenId: number): Promise<void> {
		await this.ordenesProductosRepo.delete({ordenId});
	}

	async procesarProductos(
		ordenId: number,
		productos: CreateOrdenItemDto[],
	): Promise<{total: number; items: {nombre: string; cantidad: number; precioUnitario: number}[]}> {
		let total = 0;
		const items: {nombre: string; cantidad: number; precioUnitario: number}[] = [];

		for (const item of productos) {
			const variante = await this.variantesRepo.findOne({
				where: {varianteId: item.varianteId},
				relations: ['producto'],
			});
			if (!variante) {
				throw new BadRequestException(`Variante no encontrada: ${item.varianteId}`);
			}
			
			let precioBase = Number(variante.precio);
			let nombre = (variante.producto?.productoNombre || item.tipo || 'Producto').trim();
			nombre = `${nombre} - ${variante.nombre}`;

			// --- Lógica de Recargos para Pizzas ---
			let recargoTotal = 0;
			const saboresNames = [item.sabor1, item.sabor2, item.sabor3].filter(Boolean) as string[];

			if (saboresNames.length > 0) {
				nombre += ` (${saboresNames.join(' + ')})`;
				
				// Buscamos los detalles de los sabores en la DB
				const saboresInfo = await this.saboresRepo.createQueryBuilder('s')
					.where('s.nombre IN (:...names)', { names: saboresNames })
					.getMany();

				// Identificar columna de recargo basada en el nombre de la variante
				const vName = (variante.nombre || '').toLowerCase();
				let sizeKey: 'recargoPequena' | 'recargoMediana' | 'recargoGrande' = 'recargoGrande';
				if (vName.includes('pequeña') || vName.includes('pequena') || vName.includes('personal')) {
					sizeKey = 'recargoPequena';
				} else if (vName.includes('mediana')) {
					sizeKey = 'recargoMediana';
				}

				// 1. Recargo por Sabor Especial (Tomar el máximo)
				const maxRecargoEspecial = saboresInfo
					.filter(s => s.tipo === 'especial')
					.reduce((max, s) => Math.max(max, Number(s[sizeKey]) || 0), 0);
				
				recargoTotal += maxRecargoEspecial;

				// 2. Recargo por 3 Sabores (Si hay exactamente 3 nombres)
				if (saboresNames.length >= 3) {
					const config3 = await this.saboresRepo.findOne({ where: { nombre: 'RECARGO_3_SABORES', tipo: 'configuracion' } });
					const extra3 = config3 ? (Number(config3[sizeKey]) || 3000) : 3000;
					recargoTotal += extra3;
				}
			}

			const precioFinalItem = precioBase + recargoTotal;
			const cantidad = Number(item.cantidad) || 1;
			total += precioFinalItem * cantidad;

			await this.vincularProductoAOrden(ordenId, nombre, cantidad, precioFinalItem, item.varianteId);
			items.push({nombre, cantidad, precioUnitario: precioFinalItem});
		}

		return {total, items};
	}
}
