import {PGlite} from '@electric-sql/pglite';
import {CajaMovimientosService} from '../../../src/caja-movimientos/caja-movimientos.service';

/**
 * Compensación de caja al revertir/anular/borrar una factura, contra PostgreSQL real (PGlite): lo que la factura
 * puso en la caja (efectivo recibido menos cambio entregado) sale otra vez, una sola vez.
 */
describe('Compensación de caja de una factura (PGlite)', () => {
	let pg: PGlite;
	let service: CajaMovimientosService;
	let emitir: jest.Mock;

	const query = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params as any[])).rows as any[];

	const insertar = (fila: {tipo: string; den: Record<string, number>; factura?: number | null; desc?: string; fecha?: string; caja?: string}) =>
		query(
			`INSERT INTO caja_movimientos (fecha, tipo, caja_origen, denominaciones, total, factura_venta_id, descripcion)
			 VALUES ($1, $2, $3, $4::jsonb, 0, $5, $6)`,
			[fila.fecha ?? '2026-06-10', fila.tipo, fila.caja ?? 'principal', JSON.stringify(fila.den), fila.factura ?? null, fila.desc ?? null],
		);

	/** El "manager" que usa el servicio: query directa y un repositorio que inserta de verdad. */
	const manager = {
		query,
		getRepository: () => ({
			save: async (m: any) => {
				await insertar({tipo: m.tipo, den: m.denominaciones, factura: m.facturaVentaId, desc: m.descripcion, fecha: m.fecha, caja: m.cajaOrigen});
				return m;
			},
		}),
	};

	beforeAll(async () => {
		pg = new PGlite();
		await pg.exec(`CREATE TABLE caja_movimientos (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fecha date, tipo varchar(20), caja_origen varchar(20),
			denominaciones jsonb, total numeric, factura_venta_id bigint, factura_pago_id bigint, descripcion text,
			created_at timestamptz DEFAULT now())`);
	}, 60000);

	beforeEach(async () => {
		await pg.exec('TRUNCATE caja_movimientos');
		emitir = jest.fn();
		service = Object.assign(Object.create(CajaMovimientosService.prototype), {
			repo: {manager},
			estadisticasGateway: {emitirActualizacionStats: emitir},
		}) as CajaMovimientosService;
	});

	afterAll(async () => {
		await pg?.close();
	});

	const movimientosDeReverso = () => query("SELECT tipo, denominaciones, descripcion FROM caja_movimientos WHERE descripcion LIKE 'Reverso%' ORDER BY descripcion");

	it('devuelve lo recibido y repone el cambio entregado (cambio ya enlazado a la factura)', async () => {
		await insertar({tipo: 'entrada', den: {'50000': 1}, factura: 7, desc: 'Cobro factura #7'});
		await insertar({tipo: 'salida', den: {'20000': 1}, factura: 7, desc: 'Cambio factura #7'});

		expect(await service.efectivoNetoDeFactura(7)).toEqual({'50000': 1, '20000': -1});
		await service.compensarFactura(7, 'cobro revertido', manager as any);

		const reversos = await movimientosDeReverso();
		expect(reversos).toHaveLength(2);
		expect(reversos.find((r) => r.tipo === 'salida')?.denominaciones).toEqual({'50000': 1});
		expect(reversos.find((r) => r.tipo === 'entrada')?.denominaciones).toEqual({'20000': 1});
		expect(await service.efectivoNetoDeFactura(7)).toEqual({}); // la caja quedó como antes de cobrar
	});

	it('es idempotente: compensar dos veces no saca el efectivo dos veces', async () => {
		await insertar({tipo: 'entrada', den: {'10000': 3}, factura: 8});

		await service.compensarFactura(8, 'factura anulada', manager as any);
		const primera = (await movimientosDeReverso()).length;
		await service.compensarFactura(8, 'factura eliminada', manager as any);

		expect(primera).toBe(1);
		expect((await movimientosDeReverso()).length).toBe(1);
	});

	it('reconoce el cambio de movimientos viejos (sin factura enlazada) por su descripción, sin confundir facturas', async () => {
		await insertar({tipo: 'entrada', den: {'100000': 1}, factura: 12});
		await insertar({tipo: 'salida', den: {'50000': 1}, factura: null, desc: 'Cambio factura #12 - Ana'});
		// Otra factura cuyo número empieza igual: no debe mezclarse.
		await insertar({tipo: 'salida', den: {'20000': 5}, factura: null, desc: 'Cambio factura #123 - Luis'});

		expect(await service.efectivoNetoDeFactura(12)).toEqual({'100000': 1, '50000': -1});
	});

	it('abonos en efectivo suman y el efectivo neto (arqueo apagado) sale como pesos', async () => {
		await insertar({tipo: 'entrada', den: {coins: 30000}, factura: 9, desc: 'Cobro factura #9'});
		await insertar({tipo: 'entrada', den: {coins: 15000}, factura: 9, desc: 'Abono factura #9'});

		await service.compensarFactura(9, 'cobro revertido', manager as any);

		const [reverso] = await movimientosDeReverso();
		expect(reverso).toMatchObject({tipo: 'salida', denominaciones: {coins: 45000}});
	});

	it('una factura que nunca puso efectivo en la caja (QR) no genera movimientos', async () => {
		await expect(service.compensarFactura(50, 'cobro revertido', manager as any)).resolves.toEqual([]);
		expect(await movimientosDeReverso()).toHaveLength(0);
		expect(emitir).not.toHaveBeenCalled();
	});

	it('solo cuenta la caja principal (la de gastos no se toca)', async () => {
		await insertar({tipo: 'entrada', den: {'5000': 2}, factura: 3});
		await insertar({tipo: 'salida', den: {'5000': 2}, factura: 3, caja: 'gastos'});

		expect(await service.efectivoNetoDeFactura(3)).toEqual({'5000': 2});
	});

	it('el ajuste por cambio de total entra o sale como pesos netos y se ignora si es ínfimo', async () => {
		await service.ajustarEfectivoDeFactura(4, -10000, 'cambio de total', manager as any);
		await service.ajustarEfectivoDeFactura(4, 2500, 'cambio de total', manager as any);
		await service.ajustarEfectivoDeFactura(4, 0.2, 'cambio de total', manager as any);

		const filas = await query("SELECT tipo, denominaciones FROM caja_movimientos WHERE descripcion LIKE 'Ajuste%' ORDER BY created_at, tipo");
		expect(filas).toHaveLength(2);
		expect(filas.find((f) => f.tipo === 'salida')?.denominaciones).toEqual({coins: 10000});
		expect(filas.find((f) => f.tipo === 'entrada')?.denominaciones).toEqual({coins: 2500});
	});
});
