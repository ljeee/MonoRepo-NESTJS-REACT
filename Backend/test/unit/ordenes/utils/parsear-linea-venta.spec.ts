import {parsearLineaVenta} from '../../../../src/ordenes/utils/parsear-linea-venta';
import type {
	ContextoCatalogo,
	ProductoCatalogo,
	VarianteCatalogo,
} from '../../../../src/ordenes/utils/parsear-linea-venta.types';
import type {CategoriaProducto} from '../../../../src/common/utils/catalogo.util';

// ─── Catálogo de prueba (nombres reales de Backend/seed-menu.sql) ────────────

const SABORES = [
	'De la Casa',
	'Napolitana',
	'Ranchera',
	'Hawaiana',
	'Vegetales',
	'Mexicana',
	'Carnes',
	'Pollo Tocineta',
	'Pollo Champiñones',
	'Pollo Maicitos',
	'Jamón y Queso',
	'Quesuda',
	'Boloñesa',
	'Pollo BBQ',
	'Aborrajada',
	'Firu',
	'Paisa',
].map((nombre, i) => ({saborId: i + 1, nombre, tipo: i >= 11 ? 'especial' : 'tradicional'}));

const ID = (nombre: string) => SABORES.find((s) => s.nombre === nombre)!.saborId;

interface ProductoFixture {
	productoId: number;
	productoNombre: string;
	categoria: CategoriaProducto;
	variantes: {varianteId: number; nombre: string}[];
}

const PRODUCTOS: ProductoFixture[] = [
	{
		productoId: 1,
		productoNombre: 'Pizza',
		categoria: 'pizza',
		variantes: [
			{varianteId: 10, nombre: 'Grande'},
			{varianteId: 11, nombre: 'Mediana'},
			{varianteId: 12, nombre: 'Pequeña'},
		],
	},
	{
		productoId: 2,
		productoNombre: 'Calzone',
		categoria: 'calzone',
		variantes: [
			{varianteId: 20, nombre: 'Carnes'},
			{varianteId: 21, nombre: 'De Casa'},
			{varianteId: 22, nombre: 'Hawaiana'},
			{varianteId: 23, nombre: 'UNIDAD'},
			{varianteId: 24, nombre: 'calzone de dos sabores'},
		],
	},
	{
		productoId: 3,
		productoNombre: 'CALZONE DE DOS SABORES',
		categoria: 'calzone',
		variantes: [{varianteId: 30, nombre: 'CALZONE DOS SABORES'}],
	},
	{
		productoId: 4,
		productoNombre: 'Pizza Burguer',
		categoria: 'comida',
		variantes: [
			{varianteId: 40, nombre: "D'Firu"},
			{varianteId: 41, nombre: 'Paisa'},
		],
	},
	{
		productoId: 5,
		productoNombre: 'Adición de Queso',
		categoria: 'adicion',
		variantes: [
			{varianteId: 50, nombre: 'Grande'},
			{varianteId: 51, nombre: 'Pequeña'},
		],
	},
	{
		productoId: 6,
		productoNombre: 'GASEOSA',
		categoria: 'bebida',
		variantes: [{varianteId: 60, nombre: 'Coca Cola Personal'}],
	},
	{
		productoId: 7,
		productoNombre: 'Jugo Natural',
		categoria: 'jugo',
		variantes: [{varianteId: 70, nombre: 'Mora'}],
	},
	// Producto basura del sistema viejo (un producto por nombre completo, sin variantes):
	// nunca debe ganar por prefijo.
	{productoId: 99, productoNombre: 'pizza grande paisa', categoria: 'pizza', variantes: []},
];

function crearContexto(productos: ProductoFixture[] = PRODUCTOS): ContextoCatalogo {
	const variantes = new Map<number, VarianteCatalogo>();
	const catalogoProductos: ProductoCatalogo[] = [];
	for (const p of productos) {
		for (const v of p.variantes) {
			variantes.set(v.varianteId, {
				varianteId: v.varianteId,
				nombre: v.nombre,
				productoId: p.productoId,
				productoNombre: p.productoNombre,
				categoria: p.categoria,
			});
		}
		catalogoProductos.push({
			productoId: p.productoId,
			productoNombre: p.productoNombre,
			categoria: p.categoria,
			tieneVariantes: p.variantes.length > 0,
			variantes: p.variantes.map((v) => v.nombre),
		});
	}
	return {variantes, productos: catalogoProductos, sabores: SABORES};
}

const ctx = crearContexto();

const parsear = (texto: string | null, varianteId: number | null = null, base: string | null = null) =>
	parsearLineaVenta({texto, varianteId, base}, ctx);

/** [saborId, nombre] de cada sabor, para comparar compacto. */
const sabores = (r: ReturnType<typeof parsear>) => r.sabores.map((s) => [s.saborId, s.nombre]);

describe('parsearLineaVenta', () => {
	describe('formato actual (con variante_id)', () => {
		it('pizza de un sabor', () => {
			const r = parsear('Pizza - Grande (Paisa)', 10);
			expect(r).toEqual(
				expect.objectContaining({
					productoId: 1,
					productoBase: 'Pizza',
					varianteNombre: 'Grande',
					tamano: 'grande',
					categoria: 'pizza',
					motivo: 'ok',
				}),
			);
			expect(r.sabores).toEqual([{saborId: ID('Paisa'), nombre: 'Paisa', posicion: 1, fraccion: 1}]);
		});

		it('pizza mitad y mitad: fracción 0.5 y posiciones en orden', () => {
			const r = parsear('Pizza - Mediana (Hawaiana + Carnes)', 11);
			expect(r.tamano).toBe('mediana');
			expect(r.sabores).toEqual([
				{saborId: ID('Hawaiana'), nombre: 'Hawaiana', posicion: 1, fraccion: 0.5},
				{saborId: ID('Carnes'), nombre: 'Carnes', posicion: 2, fraccion: 0.5},
			]);
		});

		it('pizza de tres sabores, incluido uno con " y " en el nombre', () => {
			const r = parsear('Pizza - Pequeña (Jamón y Queso + Pollo BBQ + Vegetales)', 12);
			expect(r.tamano).toBe('pequena');
			expect(sabores(r)).toEqual([
				[ID('Jamón y Queso'), 'Jamón y Queso'],
				[ID('Pollo BBQ'), 'Pollo BBQ'],
				[ID('Vegetales'), 'Vegetales'],
			]);
			expect(r.sabores.map((s) => s.fraccion)).toEqual([0.3333, 0.3333, 0.3333]);
		});

		it('ignora el grupo de base (Leche/Agua) al leer los sabores', () => {
			const r = parsear('Pizza - Grande (Leche) (Paisa + Firu)', 10, 'leche');
			expect(sabores(r)).toEqual([
				[ID('Paisa'), 'Paisa'],
				[ID('Firu'), 'Firu'],
			]);
		});

		it('sabor desconocido queda sin clasificar con su nombre original', () => {
			const r = parsear('Pizza - Grande (Marciana + Paisa)', 10);
			expect(sabores(r)).toEqual([
				[null, 'Marciana'],
				[ID('Paisa'), 'Paisa'],
			]);
		});

		it('deduplica sabores repetidos sin importar mayúsculas ni tildes', () => {
			const r = parsear('Pizza - Grande (Boloñesa + BOLONESA + paisa)', 10);
			expect(sabores(r)).toEqual([
				[ID('Boloñesa'), 'Boloñesa'],
				[ID('Paisa'), 'Paisa'],
			]);
			expect(r.sabores.map((s) => s.fraccion)).toEqual([0.5, 0.5]);
		});

		it('calzone actual: sin " - <Var>", sabores del grupo', () => {
			const r = parsear('Calzone (Carnes)', 20);
			expect(r).toEqual(expect.objectContaining({productoId: 2, categoria: 'calzone', tamano: null}));
			expect(sabores(r)).toEqual([[ID('Carnes'), 'Carnes']]);
		});

		it('calzone de marzo 2026 con " - <Var>" y grupo', () => {
			const r = parsear('Calzone - Hawaiana (Hawaiana)', 22);
			expect(sabores(r)).toEqual([[ID('Hawaiana'), 'Hawaiana']]);
		});

		it('calzone sin grupo: la variante es el sabor (con clave tolerante "De Casa" ≈ "De la Casa")', () => {
			expect(sabores(parsear('Calzone', 20))).toEqual([[ID('Carnes'), 'Carnes']]);
			expect(sabores(parsear('Calzone', 21))).toEqual([[ID('De la Casa'), 'De la Casa']]);
		});

		it('calzone "UNIDAD" o "calzone de dos sabores" sin grupo no tiene sabores', () => {
			expect(parsear('Calzone', 23).sabores).toEqual([]);
			expect(parsear('Calzone', 24).sabores).toEqual([]);
		});

		it('calzone de dos sabores', () => {
			const r = parsear('CALZONE DE DOS SABORES (Carnes + Hawaiana)', 30);
			expect(r).toEqual(expect.objectContaining({productoId: 3, categoria: 'calzone', tamano: null}));
			expect(sabores(r)).toEqual([
				[ID('Carnes'), 'Carnes'],
				[ID('Hawaiana'), 'Hawaiana'],
			]);
		});

		it('Pizza Burguer no genera sabores ni tamaño aunque la variante se llame como un sabor', () => {
			const r = parsear('Pizza Burguer - Paisa', 41);
			expect(r).toEqual(expect.objectContaining({productoId: 4, categoria: 'comida', tamano: null, sabores: []}));
		});

		it('adición "Grande" no es tamaño de pizza', () => {
			const r = parsear('Adición de Queso - Grande', 50);
			expect(r).toEqual(
				expect.objectContaining({categoria: 'adicion', varianteNombre: 'Grande', tamano: null, sabores: []}),
			);
		});

		it('gaseosa "Personal" no es tamaño de pizza', () => {
			const r = parsear('GASEOSA - Coca Cola Personal', 60);
			expect(r).toEqual(expect.objectContaining({categoria: 'bebida', tamano: null, sabores: []}));
		});

		it('jugo con base: sin sabores ni tamaño', () => {
			const r = parsear('Jugo Natural - Mora (Leche)', 70, 'leche');
			expect(r).toEqual(
				expect.objectContaining({
					productoId: 7,
					categoria: 'jugo',
					varianteNombre: 'Mora',
					tamano: null,
					sabores: [],
				}),
			);
		});

		it('variante conocida con texto vacío usa los datos de la variante', () => {
			const r = parsear('', 10);
			expect(r).toEqual(
				expect.objectContaining({productoId: 1, varianteNombre: 'Grande', tamano: 'grande', motivo: 'ok'}),
			);
		});
	});

	describe('sin variante_id (productos/variantes borrados o histórico)', () => {
		it('formato actual: reconoce producto por prefijo y la variante tras el guion', () => {
			const r = parsear('Pizza - Grande (Paisa + Carnes)');
			expect(r).toEqual(
				expect.objectContaining({productoId: 1, varianteNombre: 'Grande', tamano: 'grande', motivo: 'ok'}),
			);
			expect(sabores(r)).toEqual([
				[ID('Paisa'), 'Paisa'],
				[ID('Carnes'), 'Carnes'],
			]);
		});

		it('variante_id que ya no existe en el catálogo cae al prefijo', () => {
			const r = parsear('Pizza - Mediana (Quesuda)', 999);
			expect(r).toEqual(expect.objectContaining({productoId: 1, tamano: 'mediana'}));
			expect(sabores(r)).toEqual([[ID('Quesuda'), 'Quesuda']]);
		});

		it('el prefijo más largo gana: "Pizza Burguer" no se lee como pizza', () => {
			const r = parsear('Pizza Burguer - Paisa');
			expect(r).toEqual(expect.objectContaining({productoId: 4, categoria: 'comida', sabores: []}));
		});

		it('Pizza Burguer de un producto ya borrado queda como comida, no como pizza sabor Paisa', () => {
			const sinBurguer = crearContexto(PRODUCTOS.filter((p) => p.productoId !== 4));
			const r = parsearLineaVenta({texto: 'Pizza Burguer - Paisa', varianteId: null, base: null}, sinBurguer);
			expect(r).toEqual(
				expect.objectContaining({productoId: null, categoria: 'comida', sabores: [], motivo: 'sin-producto'}),
			);
		});

		it('no usa productos basura sin variantes para el prefijo', () => {
			const r = parsear('pizza grande paisa');
			expect(r.productoId).toBe(1);
		});
	});

	describe('formato legado (≤ enero 2026)', () => {
		it('minúsculas con tamaño y dos sabores separados por " y "', () => {
			const r = parsear('pizza grande paisa y carnes');
			expect(r).toEqual(
				expect.objectContaining({
					productoId: 1,
					productoBase: 'Pizza',
					varianteNombre: 'Grande',
					tamano: 'grande',
				}),
			);
			expect(sabores(r)).toEqual([
				[ID('Paisa'), 'Paisa'],
				[ID('Carnes'), 'Carnes'],
			]);
		});

		it('tokeniza greedy: "Jamón y Queso" es un solo sabor', () => {
			const r = parsear('Pizza mediana jamon y queso y hawaiana');
			expect(r.tamano).toBe('mediana');
			expect(sabores(r)).toEqual([
				[ID('Jamón y Queso'), 'Jamón y Queso'],
				[ID('Hawaiana'), 'Hawaiana'],
			]);
		});

		it('ignora la palabra literal "undefined" de la plantilla vieja', () => {
			const r = parsear('Pizza undefined paisa');
			expect(r.tamano).toBeNull();
			expect(sabores(r)).toEqual([[ID('Paisa'), 'Paisa']]);

			const r2 = parsear('pizza grande undefined');
			expect(r2.tamano).toBe('grande');
			expect(r2.sabores).toEqual([]);
		});

		it('sabor legado desconocido queda sin clasificar sin romper los demás', () => {
			const r = parsear('pizza pequeña especial de la abuela y paisa');
			expect(r.tamano).toBe('pequena');
			expect(sabores(r)).toEqual([
				[null, 'especial de la abuela'],
				[ID('Paisa'), 'Paisa'],
			]);
		});

		it('calzone legado sin paréntesis', () => {
			const r = parsear('Calzone De Casa');
			expect(r).toEqual(expect.objectContaining({productoId: 2, categoria: 'calzone'}));
			expect(sabores(r)).toEqual([[ID('De la Casa'), 'De la Casa']]);
		});

		it('formato "Pizza Grande (paisa + carnes)" (paréntesis sin guion)', () => {
			const r = parsear('Pizza Grande (paisa + carnes)');
			expect(r.tamano).toBe('grande');
			expect(sabores(r)).toEqual([
				[ID('Paisa'), 'Paisa'],
				[ID('Carnes'), 'Carnes'],
			]);
		});

		it('tipo desconocido sin producto: motivo sin-producto y categoría deducida', () => {
			const r = parsear('Chuzo grande');
			expect(r).toEqual(expect.objectContaining({productoId: null, motivo: 'sin-producto', sabores: []}));
		});
	});

	describe('entradas vacías', () => {
		it('texto vacío y sin variante → sin-texto', () => {
			for (const texto of [null, '', '   ', 'undefined']) {
				const r = parsear(texto);
				expect(r).toEqual({
					productoId: null,
					productoBase: null,
					varianteNombre: null,
					tamano: null,
					categoria: null,
					sabores: [],
					motivo: 'sin-texto',
				});
			}
		});

		it('nunca lanza con texto extraño', () => {
			expect(() => parsear('((( ) + ) y ,,, -')).not.toThrow();
			expect(() => parsear('Pizza - ')).not.toThrow();
			expect(() => parsear('Pizza - Grande ()', 10)).not.toThrow();
		});

		it('un grupo vacío o pura puntuación no produce sabores fantasma', () => {
			expect(parsear('Pizza - Grande ()', 10).sabores).toEqual([]);
			expect(parsear('Pizza - Grande ( + )', 10).sabores).toEqual([]);
			expect(parsear('pizza grande , y', null).sabores).toEqual([]);
		});
	});

	describe('pizza y calzone con un sabor del mismo nombre ("Carnes" en las dos familias)', () => {
		const PIZZA = {saborId: 101, nombre: 'Carnes', tipo: 'tradicional', esCalzone: false};
		const CALZONE = {saborId: 102, nombre: 'Carnes', tipo: 'calzone', esCalzone: true};
		const sinFamilia = (s: {saborId: number; nombre: string; tipo: string}) => ({
			saborId: s.saborId,
			nombre: s.nombre,
			tipo: s.tipo,
		});
		// El orden del catálogo NO decide: se prueba en los dos sentidos.
		const CATALOGOS = {
			'pizza primero': [PIZZA, CALZONE],
			'calzone primero': [CALZONE, PIZZA],
		};
		const con = (catalogo: ContextoCatalogo['sabores']) => ({...ctx, sabores: catalogo});

		describe.each(Object.entries(CATALOGOS))('catálogo con %s', (_nombre, catalogo) => {
			it('una pizza lee el sabor de pizza', () => {
				const r = parsearLineaVenta(
					{texto: 'Pizza - Grande (Carnes)', varianteId: 10, base: null},
					con(catalogo),
				);

				expect(r.sabores.map((s) => s.saborId)).toEqual([PIZZA.saborId]);
			});

			it('un calzone lee el sabor de calzone, con grupo o con la variante como sabor', () => {
				const conGrupo = parsearLineaVenta(
					{texto: 'Calzone (Carnes)', varianteId: 20, base: null},
					con(catalogo),
				);
				const porVariante = parsearLineaVenta({texto: 'Calzone', varianteId: 20, base: null}, con(catalogo));

				expect(conGrupo.sabores.map((s) => s.saborId)).toEqual([CALZONE.saborId]);
				expect(porVariante.sabores.map((s) => s.saborId)).toEqual([CALZONE.saborId]);
			});

			it('el formato legado ("calzone carnes") también respeta la familia', () => {
				const r = parsearLineaVenta({texto: 'calzone carnes', varianteId: null, base: null}, con(catalogo));

				expect(r.categoria).toBe('calzone');
				expect(r.sabores.map((s) => s.saborId)).toEqual([CALZONE.saborId]);
			});
		});

		it('es una preferencia, no un filtro: si la familia no tiene ese sabor, usa el de la otra en vez de dejarlo sin clasificar', () => {
			const soloCalzone = [{saborId: 300, nombre: 'Hawaiana', tipo: 'calzone', esCalzone: true}];

			const r = parsearLineaVenta(
				{texto: 'Pizza - Grande (Hawaiana)', varianteId: 10, base: null},
				con(soloCalzone),
			);

			expect(r.sabores.map((s) => [s.saborId, s.nombre])).toEqual([[300, 'Hawaiana']]);
		});

		it('sin dato de familia (catálogo anterior al grupo) se comporta como siempre: gana el primero', () => {
			const r = parsearLineaVenta(
				{texto: 'Pizza - Grande (Carnes)', varianteId: 10, base: null},
				con([PIZZA, CALZONE].map(sinFamilia)),
			);

			expect(r.sabores.map((s) => s.saborId)).toEqual([PIZZA.saborId]);
		});

		it('el nombre más largo sigue ganando sobre la familia ("Jamón y Queso" no se parte en "Jamón")', () => {
			const catalogo = [
				{saborId: 400, nombre: 'Jamón', tipo: 'calzone', esCalzone: true},
				{saborId: 401, nombre: 'Jamón y Queso', tipo: 'tradicional', esCalzone: false},
			];

			const r = parsearLineaVenta({texto: 'Calzone (Jamón y Queso)', varianteId: 20, base: null}, con(catalogo));

			expect(r.sabores.map((s) => s.saborId)).toEqual([401]);
		});
	});
});
