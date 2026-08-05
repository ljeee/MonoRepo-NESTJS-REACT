import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, Repository} from 'typeorm';
import {CreateOrdenItemDto} from '../esquemas/ordenes.dto';
import {ProductoVariantes} from '../../productos/esquemas/producto-variantes.entity';
import {OrdenesProductos} from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import {PizzaSabor} from '../../pizza-sabores/esquemas/pizza-sabores.entity';
import {resolverPersonalizacion} from '../../common/utils/personalizacion.util';
import {EmpresaConfig} from '../../empresa/esquemas/empresa.entity';

@Injectable()
export class ProductProcessingService {
	constructor(
		@InjectRepository(ProductoVariantes) private readonly variantesRepo: Repository<ProductoVariantes>,
		@InjectRepository(OrdenesProductos) private readonly ordenesProductosRepo: Repository<OrdenesProductos>,
		@InjectRepository(PizzaSabor) private readonly saboresRepo: Repository<PizzaSabor>,
		@InjectRepository(EmpresaConfig) private readonly empresaRepo: Repository<EmpresaConfig>,
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
		if (item.base) nombre += ` (${item.base === 'leche' ? 'Leche' : 'Agua'})`;
		return nombre;
	}

	async vincularProductoAOrden(
		ordenId: number,
		nombre: string,
		cantidad: number,
		precioUnitario?: number,
		varianteId?: number,
		base?: 'leche' | 'agua' | null,
		manager?: EntityManager,
	): Promise<void> {
		const repo = manager ? manager.getRepository(OrdenesProductos) : this.ordenesProductosRepo;
		const item = new OrdenesProductos();
		item.ordenId = ordenId;
		item.producto = nombre;
		item.cantidad = cantidad;
		item.precioUnitario = precioUnitario ?? null;
		item.varianteId = varianteId ?? null;
		item.base = base ?? null;
		await repo.save(item);
	}

	async eliminarProductosDeOrden(ordenId: number, manager?: EntityManager): Promise<void> {
		const repo = manager ? manager.getRepository(OrdenesProductos) : this.ordenesProductosRepo;
		await repo.delete({ordenId});
	}

	async procesarProductos(
		ordenId: number,
		productos: CreateOrdenItemDto[],
		manager?: EntityManager,
	): Promise<{total: number; items: {nombre: string; cantidad: number; precioUnitario: number}[]}> {
		let total = 0;
		const items: {nombre: string; cantidad: number; precioUnitario: number}[] = [];

		const vRepo = manager ? manager.getRepository(ProductoVariantes) : this.variantesRepo;
		const sRepo = manager ? manager.getRepository(PizzaSabor) : this.saboresRepo;
		const eRepo = manager ? manager.getRepository(EmpresaConfig) : this.empresaRepo;

		let recargoLecheConfig = 1000;
		try {
			const empConfig = await eRepo.findOne({where: {id: 1}});
			if (empConfig && empConfig.recargoLeche != null) {
				recargoLecheConfig = Number(empConfig.recargoLeche);
			}
		} catch {
			// Fallback to default
		}

		for (const item of productos) {
			const variante = await vRepo.findOne({
				where: {varianteId: item.varianteId},
				relations: ['producto'],
			});
			if (!variante) {
				throw new BadRequestException(`Variante no encontrada: ${item.varianteId}`);
			}

			let precioBase = Number(variante.precio);
			// Recargo dinámico por base leche
			if (item.base === 'leche') {
				precioBase += recargoLecheConfig;
			}

			let nombre = (variante.producto?.productoNombre || item.tipo || 'Producto').trim();
			// Personalización data-driven (con fallback por nombre para productos sin configurar)
			const pers = resolverPersonalizacion(nombre, variante.producto?.personalizacion);
			const isPizza = pers === 'pizza';
			const isCalzone = pers === 'calzone';

			// Calzone: sus variantes SON los sabores; el descriptor de sabores ya basta,
			// no agregamos "- variante" (sería redundante: "Calzone - De Casa (De Casa + ...)").
			if (!isCalzone) {
				nombre = `${nombre} - ${variante.nombre}`;
			}

			// Base del jugo (leche / agua)
			if (item.base) {
				nombre += ` (${item.base === 'leche' ? 'Leche' : 'Agua'})`;
			}

			// --- Lógica de Recargos para Pizzas ---
			let recargoTotal = 0;
			const saboresNames = [item.sabor1, item.sabor2, item.sabor3].filter(Boolean) as string[];

			if (saboresNames.length > 0) {
				nombre += ` (${saboresNames.join(' + ')})`;

				// Los recargos por sabor especial / 3 sabores aplican SOLO a pizza.
				// Calzone (y cualquier otro) mantienen su precio plano de variante.
				if (isPizza) {
					// Buscamos los detalles de los sabores en la DB
					const saboresInfo = await sRepo
						.createQueryBuilder('s')
						.where('s.nombre IN (:...names)', {names: saboresNames})
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
						.filter((s) => s.tipo === 'especial')
						.reduce((max, s) => Math.max(max, Number(s[sizeKey]) || 0), 0);

					recargoTotal += maxRecargoEspecial;

					// 2. Recargo por 3 Sabores (Si hay exactamente 3 nombres)
					if (saboresNames.length >= 3) {
						const config3 = await sRepo.findOne({
							where: {nombre: 'RECARGO_3_SABORES', tipo: 'configuracion'},
						});
						const extra3 = config3 ? Number(config3[sizeKey]) || 3000 : 3000;
						recargoTotal += extra3;
					}
				}
			}

			// Un precio manual (descuento, precio pactado, cortesía) reemplaza por
			// completo el cálculo de variante + recargos. El controller ya lo
			// eliminó para el rol `cliente`, así que si llega hasta aquí es staff.
			const precioManual = Number(item.precioUnitario);
			const tienePrecioManual = item.precioUnitario != null && Number.isFinite(precioManual) && precioManual >= 0;

			const precioFinalItem = tienePrecioManual ? precioManual : precioBase + recargoTotal;
			const cantidad = Number(item.cantidad) || 1;
			total += precioFinalItem * cantidad;

			await this.vincularProductoAOrden(
				ordenId,
				nombre,
				cantidad,
				precioFinalItem,
				item.varianteId,
				item.base ?? null,
				manager,
			);
			items.push({nombre, cantidad, precioUnitario: precioFinalItem});
		}

		return {total, items};
	}
}
