import {
	CategoriaProducto,
	claveSabor,
	derivarCategoriaProducto,
	normalizarTamano,
	normalizarTexto,
} from '../../common/utils/catalogo.util';
import type {
	ContextoCatalogo,
	LineaVentaCruda,
	ProductoCatalogo,
	ResultadoParseo,
	SaborCatalogo,
	SaborParseado,
} from './parsear-linea-venta.types';

/**
 * Deduce el detalle estructurado de una línea de venta HISTÓRICA a partir de su texto
 * (y de variante_id cuando existe). Función pura: nunca lanza ni hace I/O.
 *
 * Formatos que existieron (ver product-processing.service.ts y su historia en git):
 *  - actual:      "<Prod> - <Var>[ (Leche|Agua)][ (s1 + s2 + s3)]"  (calzone sin " - <Var>")
 *  - marzo 2026:  igual, pero el calzone sí llevaba " - <Var>"
 *  - ≤ ene 2026:  "<tipo> <tamaño> <s1> y <s2> y <s3>" sin variante_id; a veces en
 *                 minúsculas o con la palabra literal "undefined".
 */
export function parsearLineaVenta(linea: LineaVentaCruda, ctx: ContextoCatalogo): ResultadoParseo {
	const texto = limpiarTexto(linea.texto);
	const variante = linea.varianteId != null ? ctx.variantes.get(linea.varianteId) : undefined;

	if (!texto && !variante) {
		return {
			productoId: null,
			productoBase: null,
			varianteNombre: null,
			tamano: null,
			categoria: null,
			sabores: [],
			motivo: 'sin-texto',
		};
	}

	const t = new TextoNormalizado(texto);
	const sinBase = new TextoNormalizado(texto.replace(RE_BASE, ' ').replace(/\s+/g, ' ').trim());

	let productoId: number | null = null;
	let productoBase: string | null = null;
	let varianteNombre: string | null = null;
	let categoria: CategoriaProducto;
	/** Parte del texto (sin base) que sigue al producto y a la variante/tamaño: allí van los sabores legados. */
	let resto = '';

	if (variante) {
		productoId = variante.productoId;
		productoBase = variante.productoNombre;
		varianteNombre = variante.nombre;
		categoria = variante.categoria;
		// Quitar " - <Var>" o la palabra de tamaño del inicio para que no se lea como sabor.
		resto = extraerVariante(restoTrasPrefijo(sinBase, variante.productoNombre), [variante.nombre]).resto;
	} else {
		const encontrado = buscarProductoPorPrefijo(t.norm, ctx.productos);
		const categoriaTexto = derivarCategoriaProducto(texto);
		// "Pizza Burguer - Paisa" de un producto ya borrado coincide por prefijo con "Pizza":
		// si el propio texto dice que NO es pizza, el prefijo no sirve.
		const contradice = encontrado?.categoria === 'pizza' && categoriaTexto !== 'pizza';
		if (encontrado && !contradice) {
			productoId = encontrado.productoId;
			productoBase = encontrado.productoNombre;
			categoria = encontrado.categoria;
			const trasProducto = restoTrasPrefijo(sinBase, encontrado.productoNombre);
			const variantePorTexto = extraerVariante(trasProducto, encontrado.variantes);
			varianteNombre = variantePorTexto.nombre;
			resto = variantePorTexto.resto;
		} else {
			categoria = categoriaTexto;
			// Sin producto conocido: igual se intenta leer tamaño y sabores del formato legado
			// ("<tipo> <tamaño> <sabores>"), quitando la primera palabra (el tipo).
			const sinTipo = sinBase.original.replace(/^\S+\s*/, '');
			const porTamano = extraerTamanoLegado(sinTipo);
			varianteNombre = porTamano.nombre;
			resto = porTamano.resto;
		}
	}

	const sabores =
		categoria === 'pizza' || categoria === 'calzone'
			? extraerSabores(sinBase, resto, varianteNombre, categoria, ctx.sabores)
			: [];

	return {
		productoId,
		productoBase,
		varianteNombre,
		tamano: categoria === 'pizza' ? normalizarTamano(varianteNombre) : null,
		categoria,
		sabores,
		motivo: productoId != null ? 'ok' : 'sin-producto',
	};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RE_BASE = /\((?:\s*)(leche|agua)(?:\s*)\)/gi;
const RE_TAMANO_LEGADO = /^(peque(?:n|ñ)[ao]|median[ao]|grande|personal)\b/i;

/** Quita los "undefined"/"null" que dejaba la plantilla vieja y colapsa espacios. */
function limpiarTexto(texto: string | null): string {
	return (texto ?? '')
		.replace(/\b(undefined|null)\b/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Texto con su versión normalizada (minúsculas, sin tildes) y un mapa de índices al
 * original, para comparar normalizado pero devolver los nombres tal como se escribieron.
 */
class TextoNormalizado {
	readonly norm: string;
	private readonly idx: number[] = [];

	constructor(readonly original: string) {
		let norm = '';
		for (let i = 0; i < original.length; i++) {
			const c = original[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
			for (let k = 0; k < c.length; k++) {
				norm += c[k];
				this.idx.push(i);
			}
		}
		this.norm = norm;
	}

	/** Substring ORIGINAL correspondiente a norm[desde, hasta). */
	slice(desde: number, hasta: number): string {
		if (desde >= hasta || desde >= this.idx.length) return '';
		const a = this.idx[desde];
		const b = this.idx[Math.min(hasta, this.idx.length) - 1] + 1;
		return this.original.slice(a, b);
	}
}

const esLimite = (c: string | undefined) =>
	c === undefined || c === ' ' || c === '-' || c === '(' || c === ',' || c === '+';

/** Producto con el nombre más largo que sea prefijo del texto (solo productos con variantes). */
function buscarProductoPorPrefijo(normTexto: string, productos: ProductoCatalogo[]): ProductoCatalogo | null {
	let mejor: ProductoCatalogo | null = null;
	let mejorLargo = 0;
	for (const p of productos) {
		if (!p.tieneVariantes) continue;
		const nombre = normalizarTexto(p.productoNombre);
		if (!nombre || nombre.length <= mejorLargo) continue;
		if (normTexto.startsWith(nombre) && esLimite(normTexto[nombre.length])) {
			mejor = p;
			mejorLargo = nombre.length;
		}
	}
	return mejor;
}

/** Lo que queda del texto tras el nombre del producto (si el texto empieza por él). */
function restoTrasPrefijo(t: TextoNormalizado, productoNombre: string): string {
	const nombre = normalizarTexto(productoNombre);
	if (nombre && t.norm.startsWith(nombre) && esLimite(t.norm[nombre.length])) {
		return t.slice(nombre.length, t.norm.length).trim();
	}
	return t.original;
}

/**
 * Tras el producto puede venir " - <Var>" (formato actual) o una palabra de tamaño
 * (formato legado). Devuelve la variante reconocida y el resto del texto.
 */
function extraerVariante(trasProducto: string, variantes: string[]): {nombre: string | null; resto: string} {
	const texto = trasProducto.trim();
	if (texto.startsWith('-')) {
		const segmento = texto.slice(1).split('(')[0].trim();
		const resto = texto.slice(1 + texto.slice(1).indexOf(segmento) + segmento.length).trim();
		if (!segmento) return {nombre: null, resto};
		const coincidencia = variantes.find((v) => normalizarTexto(v) === normalizarTexto(segmento));
		return {nombre: coincidencia ?? segmento, resto};
	}
	return extraerTamanoLegado(texto);
}

/** "grande paisa y carnes" → {nombre: 'Grande', resto: 'paisa y carnes'}. */
function extraerTamanoLegado(texto: string): {nombre: string | null; resto: string} {
	const limpio = texto.trim();
	const m = limpio.match(RE_TAMANO_LEGADO);
	if (!m) return {nombre: null, resto: limpio};
	const palabra = m[1];
	return {
		nombre: palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase(),
		resto: limpio.slice(palabra.length).trim(),
	};
}

/** Contenido del ÚLTIMO grupo "( … )" del texto (ya sin la base), o null. */
function ultimoGrupo(texto: string): string | null {
	const m = texto.match(/\(([^()]*)\)\s*$/);
	if (m) return m[1];
	const todos = [...texto.matchAll(/\(([^()]*)\)/g)];
	return todos.length ? todos[todos.length - 1][1] : null;
}

function extraerSabores(
	sinBase: TextoNormalizado,
	resto: string,
	varianteNombre: string | null,
	categoria: CategoriaProducto,
	catalogo: SaborCatalogo[],
): SaborParseado[] {
	// Entre nombres iguales gana el sabor de la misma familia que la línea (pizza vs calzone); el orden es estable.
	const quiereCalzone = categoria === 'calzone';
	const deOtraFamilia = (d: {sabor: SaborCatalogo}) =>
		d.sabor.esCalzone !== undefined && d.sabor.esCalzone !== quiereCalzone;
	const diccionario = catalogo
		.filter((s) => s.tipo !== 'configuracion')
		.map((s) => ({sabor: s, norm: normalizarTexto(s.nombre), clave: claveSabor(s.nombre)}))
		.filter((d) => d.norm)
		.sort((a, b) => b.norm.length - a.norm.length || Number(deOtraFamilia(a)) - Number(deOtraFamilia(b)));

	let tokens: {saborId: number | null; nombre: string}[] = [];

	const grupo = ultimoGrupo(sinBase.original);
	if (grupo != null) {
		// Hay grupo de sabores (aunque venga vacío): el formato es el actual, no el legado.
		if (grupo.trim()) {
			tokens = grupo.includes('+')
				? grupo.split('+').map((parte) => resolverToken(parte, diccionario))
				: tokenizarGreedy(grupo, diccionario);
		}
	} else if (resto.trim() && !resto.trim().startsWith('-')) {
		tokens = tokenizarGreedy(resto, diccionario);
	}

	// Calzone de un sabor: la variante ES el sabor, solo si coincide con uno real.
	if (!tokens.length && categoria === 'calzone' && varianteNombre) {
		const d = buscarEnDiccionario(varianteNombre, diccionario);
		if (d) tokens = [{saborId: d.sabor.saborId, nombre: d.sabor.nombre}];
	}

	const vistos = new Set<string>();
	const unicos = tokens.filter((tk) => {
		// Restos de puntuación ('()', '-', ',') no son sabores.
		if (!/[\p{L}\p{N}]/u.test(tk.nombre)) return false;
		const clave = normalizarTexto(tk.nombre);
		if (!clave || vistos.has(clave)) return false;
		vistos.add(clave);
		return true;
	});

	const fraccion = unicos.length ? Math.round((1 / unicos.length) * 10000) / 10000 : 0;
	return unicos.map((tk, i) => ({saborId: tk.saborId, nombre: tk.nombre, posicion: i + 1, fraccion}));
}

type EntradaDiccionario = {sabor: SaborCatalogo; norm: string; clave: string};

/** Coincidencia exacta normalizada; si no, por clave tolerante ("De Casa" ≈ "De la Casa"). */
function buscarEnDiccionario(nombre: string, diccionario: EntradaDiccionario[]): EntradaDiccionario | undefined {
	const norm = normalizarTexto(nombre);
	if (!norm) return undefined;
	const exacta = diccionario.find((x) => x.norm === norm);
	if (exacta) return exacta;
	const clave = claveSabor(nombre);
	return clave ? diccionario.find((x) => x.clave === clave) : undefined;
}

function resolverToken(crudo: string, diccionario: EntradaDiccionario[]): {saborId: number | null; nombre: string} {
	const nombre = crudo.trim();
	const d = buscarEnDiccionario(nombre, diccionario);
	return d ? {saborId: d.sabor.saborId, nombre: d.sabor.nombre} : {saborId: null, nombre};
}

/**
 * Tokeniza "paisa y jamón y queso" contra el diccionario de forma greedy: en cada
 * posición prueba el sabor más largo ("Jamón y Queso" gana sobre "Jamón"). Lo que no
 * coincide se toma hasta el siguiente separador como sabor "sin clasificar".
 */
function tokenizarGreedy(texto: string, diccionario: EntradaDiccionario[]): {saborId: number | null; nombre: string}[] {
	const t = new TextoNormalizado(texto);
	const n = t.norm;
	const tokens: {saborId: number | null; nombre: string}[] = [];
	let pos = 0;

	const saltarSeparadores = () => {
		for (;;) {
			if (pos < n.length && (n[pos] === ' ' || n[pos] === ',' || n[pos] === '+')) {
				pos++;
				continue;
			}
			// " y " como separador (solo como palabra completa)
			if (
				n.startsWith('y', pos) &&
				(pos === 0 || n[pos - 1] === ' ') &&
				(n[pos + 1] === ' ' || pos + 1 >= n.length)
			) {
				pos += 1;
				continue;
			}
			break;
		}
	};

	saltarSeparadores();
	while (pos < n.length) {
		const d = diccionario.find((x) => n.startsWith(x.norm, pos) && esFinDeSabor(n, pos + x.norm.length));
		if (d) {
			tokens.push({saborId: d.sabor.saborId, nombre: d.sabor.nombre});
			pos += d.norm.length;
		} else {
			const fin = siguienteSeparador(n, pos);
			const crudo = t.slice(pos, fin).trim();
			if (crudo) tokens.push(resolverToken(crudo, diccionario));
			pos = fin;
		}
		saltarSeparadores();
	}
	return tokens;
}

const esFinDeSabor = (n: string, i: number) => i >= n.length || n[i] === ' ' || n[i] === ',' || n[i] === '+';

/** Índice del siguiente separador (" y ", ",", "+") desde pos, o el final. */
function siguienteSeparador(n: string, pos: number): number {
	let mejor = n.length;
	const candidatos = [n.indexOf(' y ', pos), n.indexOf(',', pos), n.indexOf('+', pos)];
	for (const c of candidatos) if (c !== -1 && c < mejor) mejor = c;
	return mejor;
}
