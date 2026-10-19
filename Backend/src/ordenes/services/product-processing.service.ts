import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, In, Repository} from 'typeorm';
import {CreateOrdenItemDto} from '../esquemas/ordenes.dto';
import {ProductoVariantes} from '../../productos/esquemas/producto-variantes.entity';
import {OrdenesProductos} from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import {OrdenProductoSabor} from '../../ordenes-productos/esquemas/orden-producto-sabor.entity';
import {PizzaSabor} from '../../pizza-sabores/esquemas/pizza-sabores.entity';
import {calcularRecargoSabores, tamanoDeVariante} from '../utils/recargos-sabores';
import {
	CategoriaProducto,
	TamanoPizza,
	claveSabor,
	derivarCategoriaProducto,
	esCategoriaProducto,
	normalizarTexto,
} from '../../common/utils/catalogo.util';
import {EmpresaConfig} from '../../empresa/esquemas/empresa.entity';

/** Todo lo que se persiste de una línea de venta: texto legible + detalle estructurado. */
export interface DetalleLinea {
	ordenId: number;
	/** Texto legible ("Pizza - Grande (Paisa + Carnes)"). Su formato no cambia: lo leen KDS, recibos y facturas. */
	nombre: string;
	cantidad: number;
	precioUnitario: number | null;
	varianteId: number | null;
	base: 'leche' | 'agua' | null;
	productoId: number | null;
	productoBase: string | null;
	varianteNombre: string | null;
	tamano: TamanoPizza | null;
	categoria: CategoriaProducto | null;
	precioLista: number | null;
	precioManual: boolean;
	/** Sabores en el orden en que se pidieron; posición y fracción se calculan al guardar. */
	sabores: {saborId: number | null; nombre: string}[];
}

/** Catálogo de sabores (sin la fila de configuración) indexado por nombre normalizado y por clave tolerante. */
interface CatalogoSabores {
	porNombre: Map<string, PizzaSabor>;
	porClave: Map<string, PizzaSabor>;
}

/** Coincidencia exacta normalizada; si no, por clave tolerante ("De Casa" ≈ "De la Casa"). */
function buscarSabor(nombre: string, catalogo: CatalogoSabores): PizzaSabor | undefined {
	return catalogo.porNombre.get(normalizarTexto(nombre)) ?? catalogo.porClave.get(claveSabor(nombre));
}

@Injectable()
export class ProductProcessingService {
	constructor(
		@InjectRepository(ProductoVariantes) private readonly variantesRepo: Repository<ProductoVariantes>,
		@InjectRepository(OrdenesProductos) private readonly ordenesProductosRepo: Repository<OrdenesProductos>,
		@InjectRepository(OrdenProductoSabor) private readonly saboresLineaRepo: Repository<OrdenProductoSabor>,
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

	async vincularProductoAOrden(detalle: DetalleLinea, manager?: EntityManager): Promise<void> {
		const repo = manager ? manager.getRepository(OrdenesProductos) : this.ordenesProductosRepo;
		const item = new OrdenesProductos();
		item.ordenId = detalle.ordenId;
		item.producto = detalle.nombre;
		item.cantidad = detalle.cantidad;
		item.precioUnitario = detalle.precioUnitario;
		item.varianteId = detalle.varianteId;
		item.base = detalle.base;
		item.productoId = detalle.productoId;
		item.productoBase = detalle.productoBase;
		item.varianteNombre = detalle.varianteNombre;
		item.tamano = detalle.tamano;
		item.categoria = detalle.categoria;
		item.precioLista = detalle.precioLista;
		item.precioManual = detalle.precioManual;
		item.detalleVersion = 'v1';
		const guardado = await repo.save(item);

		const sabores = detalle.sabores;
		if (!sabores.length) return;
		const sRepo = manager ? manager.getRepository(OrdenProductoSabor) : this.saboresLineaRepo;
		const fraccion = Math.round((1 / sabores.length) * 10000) / 10000;
		await sRepo.save(
			sabores.map((s, i) =>
				sRepo.create({
					ordenProductoId: String(guardado.id),
					saborId: s.saborId,
					saborNombre: s.nombre,
					posicion: i + 1,
					fraccion,
				}),
			),
		);
	}

	async eliminarProductosDeOrden(ordenId: number, manager?: EntityManager): Promise<void> {
		const repo = manager ? manager.getRepository(OrdenesProductos) : this.ordenesProductosRepo;
		// Las filas de ordenes_productos_sabores caen por ON DELETE CASCADE.
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

		// Catálogo de sabores de cada grupo para resolver ids: se carga como mucho una vez por grupo y
		// por orden, y solo si alguna línea lo necesita.
		const catalogos = new Map<number, CatalogoSabores>();
		const obtenerCatalogo = async (grupoId: number): Promise<CatalogoSabores> => {
			let catalogo = catalogos.get(grupoId);
			if (!catalogo) {
				const todos = await sRepo.find({where: {grupoId}});
				catalogo = {
					porNombre: new Map(todos.map((s) => [normalizarTexto(s.nombre), s])),
					porClave: new Map(todos.map((s) => [claveSabor(s.nombre), s])),
				};
				catalogos.set(grupoId, catalogo);
			}
			return catalogo;
		};

		for (const item of productos) {
			const variante = await vRepo.findOne({
				where: {varianteId: item.varianteId},
				relations: ['producto', 'producto.saborGrupo'],
			});
			if (!variante) {
				throw new BadRequestException(`Variante no encontrada: ${item.varianteId}`);
			}

			let precioBase = Number(variante.precio);
			// Recargo dinámico por base leche
			if (item.base === 'leche') {
				precioBase += recargoLecheConfig;
			}

			const productoNombre = (variante.producto?.productoNombre || item.tipo || 'Producto').trim();
			let nombre = productoNombre;
			// Las reglas de sabores (tope, tamaños, recargos) salen del GRUPO del producto: un producto nuevo con
			// sabores se configura asignándole un grupo, sin tocar código. Sin grupo no lleva sabores.
			const grupo = variante.producto?.saborGrupo ?? null;

			// Si las variantes SON los sabores (calzone) el descriptor de sabores ya basta: no agregamos
			// "- variante" (sería redundante: "Calzone - De Casa (De Casa + ...)").
			if (!grupo?.varianteEsSabor) {
				nombre = `${nombre} - ${variante.nombre}`;
			}

			// Base del jugo (leche / agua)
			if (item.base) {
				nombre += ` (${item.base === 'leche' ? 'Leche' : 'Agua'})`;
			}

			// --- Sabores y sus recargos (según el grupo) ---
			let recargoTotal = 0;
			const saboresNames = [item.sabor1, item.sabor2, item.sabor3].filter(Boolean) as string[];
			const tamano = grupo?.usaTamano ? tamanoDeVariante(variante) : null;

			if (saboresNames.length > 0) {
				nombre += ` (${saboresNames.join(' + ')})`;

				if (grupo) {
					const saboresInfo = await sRepo.find({where: {grupoId: grupo.id, nombre: In(saboresNames)}});
					recargoTotal += calcularRecargoSabores(grupo, saboresInfo, saboresNames.length, tamano).total;
				}
			}

			// Un precio manual (descuento, precio pactado, cortesía) reemplaza por
			// completo el cálculo de variante + recargos. El controller ya lo
			// eliminó para el rol `cliente`, así que si llega hasta aquí es staff.
			const precioManual = Number(item.precioUnitario);
			const tienePrecioManual = item.precioUnitario != null && Number.isFinite(precioManual) && precioManual >= 0;

			const precioLista = precioBase + recargoTotal;
			const precioFinalItem = tienePrecioManual ? precioManual : precioLista;
			const cantidad = Number(item.cantidad) || 1;
			total += precioFinalItem * cantidad;

			// --- Detalle estructurado para analítica (no altera precio ni texto) ---
			const categoriaConfigurada = variante.producto?.categoria;
			const categoria: CategoriaProducto = esCategoriaProducto(categoriaConfigurada)
				? categoriaConfigurada
				: derivarCategoriaProducto(productoNombre, variante.producto?.personalizacion);

			let sabores: DetalleLinea['sabores'] = [];
			if (grupo && saboresNames.length > 0) {
				const catalogo = await obtenerCatalogo(grupo.id);
				sabores = this.resolverSabores(saboresNames, catalogo);
			} else if (grupo?.varianteEsSabor && saboresNames.length === 0) {
				// Un solo sabor: la variante ES el sabor, pero solo si coincide con uno real
				// ("UNIDAD" o "CALZONE DOS SABORES" no lo son).
				const catalogo = await obtenerCatalogo(grupo.id);
				const coincidencia = buscarSabor(variante.nombre, catalogo);
				if (coincidencia) sabores = [{saborId: coincidencia.saborId, nombre: coincidencia.nombre}];
			}

			await this.vincularProductoAOrden(
				{
					ordenId,
					nombre,
					cantidad,
					precioUnitario: precioFinalItem,
					varianteId: item.varianteId ?? null,
					base: item.base ?? null,
					productoId: variante.producto?.productoId ?? variante.productoId ?? null,
					productoBase: variante.producto?.productoNombre?.trim() || null,
					varianteNombre: variante.nombre ?? null,
					tamano,
					categoria,
					precioLista,
					precioManual: tienePrecioManual,
					sabores,
				},
				manager,
			);
			items.push({nombre, cantidad, precioUnitario: precioFinalItem});
		}

		return {total, items};
	}

	/**
	 * Resuelve los nombres de sabor de una línea contra el catálogo, sin distinguir
	 * mayúsculas ni tildes. Los no reconocidos se guardan con saborId null
	 * ("sin clasificar"); los repetidos se cuentan una sola vez.
	 */
	private resolverSabores(nombres: string[], catalogo: CatalogoSabores): DetalleLinea['sabores'] {
		const vistos = new Set<string>();
		const resultado: DetalleLinea['sabores'] = [];
		for (const crudo of nombres) {
			const nombre = crudo.trim();
			const clave = normalizarTexto(nombre);
			if (!clave || vistos.has(clave)) continue;
			vistos.add(clave);
			const sabor = buscarSabor(nombre, catalogo);
			resultado.push(sabor ? {saborId: sabor.saborId, nombre: sabor.nombre} : {saborId: null, nombre});
		}
		return resultado;
	}
}
