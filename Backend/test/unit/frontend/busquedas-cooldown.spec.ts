import {
	COOLDOWN_BUSQUEDA_MS,
	MINIMO_RECARGA_MS,
	claveConsulta,
	consultarConCooldown,
	invalidarConsultas,
} from '../../../../Frontend/src/shared/utils/consultas';
import {ordenarRecientesPrimero, traerPorCursor} from '../../../../Frontend/src/shared/utils/paginas';

/**
 * Lógica pura del POS (Frontend/src/shared) que reemplaza al viejo tope de 50 registros: los rangos se traen
 * COMPLETOS por tandas con cursor, y lo que se limita es repetir la MISMA búsqueda (cooldown).
 */
describe('cooldown de búsquedas (consultarConCooldown)', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-10-18T12:00:00-05:00'));
		invalidarConsultas();
	});
	afterEach(() => jest.useRealTimers());

	const contador = () => {
		let llamadas = 0;
		const pedir = jest.fn(async () => ++llamadas);
		return {pedir, llamadas: () => llamadas};
	};

	it('la misma búsqueda dentro del cooldown no vuelve a pedirse; vencido, sí', async () => {
		const {pedir} = contador();

		const a = await consultarConCooldown('facturas:x', pedir);
		jest.advanceTimersByTime(COOLDOWN_BUSQUEDA_MS - 1000);
		const b = await consultarConCooldown('facturas:x', pedir);

		expect(pedir).toHaveBeenCalledTimes(1);
		expect(a).toEqual(expect.objectContaining({valor: 1, desdeCache: false}));
		expect(b).toEqual(expect.objectContaining({valor: 1, desdeCache: true, obtenidoEn: a.obtenidoEn}));

		jest.advanceTimersByTime(2000);
		const c = await consultarConCooldown('facturas:x', pedir);
		expect(pedir).toHaveBeenCalledTimes(2);
		expect(c).toEqual(expect.objectContaining({valor: 2, desdeCache: false}));
	});

	it('dos búsquedas idénticas simultáneas comparten una sola petición', async () => {
		let resolver: (v: string) => void = () => undefined;
		const pedir = jest.fn(() => new Promise<string>((r) => (resolver = r)));

		const p1 = consultarConCooldown('analitica:resumen', pedir);
		const p2 = consultarConCooldown('analitica:resumen', pedir);
		resolver('datos');

		expect(await p1).toEqual(expect.objectContaining({valor: 'datos'}));
		expect(await p2).toEqual(expect.objectContaining({valor: 'datos'}));
		expect(pedir).toHaveBeenCalledTimes(1);
	});

	it('búsquedas distintas no se mezclan', async () => {
		const {pedir} = contador();
		await consultarConCooldown(claveConsulta('facturas', {from: '2026-10-01', to: '2026-10-31'}), pedir);
		await consultarConCooldown(claveConsulta('facturas', {from: '2026-09-01', to: '2026-09-30'}), pedir);
		expect(pedir).toHaveBeenCalledTimes(2);
	});

	it('la clave no depende del orden de los filtros ni de los vacíos', () => {
		expect(claveConsulta('f', {to: 'b', from: 'a', metodo: undefined, cliente: '', telefonos: []})).toBe(claveConsulta('f', {from: 'a', to: 'b'}));
		expect(claveConsulta('f', {metodo: 'efectivo'})).not.toBe(claveConsulta('f', {metodo: 'transferencia'}));
	});

	it('invalidar (lo hace toda escritura) obliga a pedir de nuevo, aunque esté dentro del cooldown', async () => {
		const {pedir} = contador();
		await consultarConCooldown('facturas:x', pedir);
		await consultarConCooldown('analitica:y', pedir);

		invalidarConsultas('facturas');
		await consultarConCooldown('facturas:x', pedir);
		await consultarConCooldown('analitica:y', pedir);

		expect(pedir).toHaveBeenCalledTimes(3); // facturas otra vez; analítica salió del cooldown
	});

	it('si se invalida mientras la petición va en camino, su resultado no queda guardado como vigente', async () => {
		let resolver: (v: number) => void = () => undefined;
		const lenta = jest.fn(() => new Promise<number>((r) => (resolver = r)));
		const enCamino = consultarConCooldown('facturas:x', lenta);
		invalidarConsultas();
		resolver(1);
		await enCamino;

		const {pedir} = contador();
		await consultarConCooldown('facturas:x', pedir);
		expect(pedir).toHaveBeenCalledTimes(1);
	});

	it('forzar (deslizar para recargar) se salta el cooldown, pero no más de una vez cada 5 s', async () => {
		const {pedir} = contador();
		await consultarConCooldown('facturas:x', pedir);

		const r1 = await consultarConCooldown('facturas:x', pedir, {forzar: true});
		const r2 = await consultarConCooldown('facturas:x', pedir, {forzar: true});
		expect(pedir).toHaveBeenCalledTimes(2);
		expect(r1.desdeCache).toBe(false);
		expect(r2.desdeCache).toBe(true);

		jest.advanceTimersByTime(MINIMO_RECARGA_MS + 1);
		await consultarConCooldown('facturas:x', pedir, {forzar: true});
		expect(pedir).toHaveBeenCalledTimes(3);
	});

	it('un error no se guarda: se conserva lo anterior y el siguiente intento vuelve a pedir', async () => {
		await consultarConCooldown('facturas:x', async () => 'bueno');
		jest.advanceTimersByTime(COOLDOWN_BUSQUEDA_MS + 1);

		await expect(consultarConCooldown('facturas:x', async () => Promise.reject(new Error('sin red')))).rejects.toThrow('sin red');
		const pedir = jest.fn(async () => 'nuevo');
		expect((await consultarConCooldown('facturas:x', pedir)).valor).toBe('nuevo');
		expect(pedir).toHaveBeenCalledTimes(1);
	});
});

describe('rango completo por tandas con cursor (traerPorCursor)', () => {
	/** Servidor simulado con la semántica de `GET /facturas-ventas?cursor=…`: id descendente, `id < cursor`. */
	function servidor(idsIniciales: number[]) {
		const ids = new Set(idsIniciales);
		const pedidos: string[] = [];
		const pedirTanda = async ({cursor, limite}: {cursor: string; limite: number}) => {
			pedidos.push(cursor);
			const todos = [...ids].sort((a, b) => b - a);
			const desde = cursor === 'inicio' ? todos : todos.filter((id) => id < Number(cursor));
			const data = desde.slice(0, limite).map((facturaId) => ({facturaId}));
			return {data, total: ids.size, siguiente: data.length === limite ? String(data[data.length - 1].facturaId) : null};
		};
		return {ids, pedidos, pedirTanda};
	}
	const rango = (n: number) => Array.from({length: n}, (_, i) => i + 1);

	it('trae TODO el rango en tandas (1.200 facturas = 3 tandas de 500), sin tope de 50', async () => {
		const s = servidor(rango(1200));
		const progreso: number[] = [];

		const r = await traerPorCursor(s.pedirTanda, (f) => f.facturaId, {onProgreso: (c) => progreso.push(c)});

		expect(r.total).toBe(1200);
		expect(new Set(r.data.map((f) => f.facturaId)).size).toBe(1200);
		expect(s.pedidos).toEqual(['inicio', '701', '201']);
		expect(progreso).toEqual([500, 1000, 1200]);
	});

	it('una venta que entra y otra que se borra mientras se descarga no duplican ni saltan filas', async () => {
		const s = servidor(rango(1200));
		const original = s.pedirTanda;
		let tanda = 0;
		const conMovimiento = async (p: {cursor: string; limite: number}) => {
			const r = await original(p);
			if (++tanda === 1) {
				s.ids.add(1201); // entra una venta nueva (va arriba de todo)
				s.ids.delete(300); // y se borra una que todavía no se había descargado
			}
			return r;
		};

		const r = await traerPorCursor(conMovimiento, (f) => f.facturaId);
		const ids = r.data.map((f) => f.facturaId);

		expect(new Set(ids).size).toBe(ids.length); // ninguna repetida
		expect(ids).not.toContain(300); // la borrada no aparece
		expect(rango(1200).filter((id) => id !== 300).every((id) => ids.includes(id))).toBe(true); // ninguna saltada
		expect(ids).toHaveLength(1199);
	});

	it('con un servidor sin cursor (versión vieja) sigue por páginas en vez de quedarse con la primera tanda', async () => {
		const todos = rango(1200).sort((a, b) => b - a);
		const pedirTanda = jest.fn(async ({limite, pagina}: {cursor: string; limite: number; pagina: number}) => ({
			data: todos.slice((pagina - 1) * limite, pagina * limite).map((facturaId) => ({facturaId})),
			total: todos.length,
			totalPages: Math.ceil(todos.length / limite),
		}));

		const r = await traerPorCursor(pedirTanda, (f) => f.facturaId);

		expect(r.total).toBe(1200);
		expect(pedirTanda).toHaveBeenCalledTimes(3);
	});

	it('las pantallas reciben lo más reciente primero (por fecha y luego id), aunque las tandas lleguen por id', () => {
		const filas = [
			{id: 3, fecha: '2026-10-01T10:00:00Z'},
			{id: 9, fecha: '2026-09-15T10:00:00Z'}, // importada por CSV: id alto, fecha vieja
			{id: 5, fecha: '2026-10-01T10:00:00Z'},
		];
		expect(ordenarRecientesPrimero(filas, (f) => f.fecha, (f) => f.id).map((f) => f.id)).toEqual([5, 3, 9]);
	});
});
