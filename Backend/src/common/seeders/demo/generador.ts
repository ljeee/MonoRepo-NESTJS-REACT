import {getBogotaDateString} from '../../utils/date.utils';
import {acumularDesglose} from '../../domain/ventas';
import {categoriaCajaDeVariante} from '../../../inventario/inventario.util';
import {calcularRecargoSabores, tamanoDeVariante} from '../../../ordenes/utils/recargos-sabores';
import type {
	AbonoDemo,
	AperturaDemo,
	Catalogo,
	ClienteDemo,
	DatasetDemo,
	EstadoFacturaDemo,
	FacturaDemo,
	GastoDemo,
	GrupoCat,
	LineaDemo,
	SaborCat,
	StockDemo,
	UbicacionDemo,
	VarianteCat,
} from './tipos';

/**
 * Generador PURO de datos de demostración (sin base de datos): dado el catálogo real y una fecha, devuelve ventas,
 * cobros, abonos, domicilios, egresos, caja e inventario coherentes entre sí y con las definiciones de dinero del
 * sistema (`common/domain/ventas.ts`). Con la misma semilla produce siempre lo mismo, así que se puede probar.
 */

// ── Aleatoriedad determinista ───────────────────────────────────────────────

export function crearAzar(semilla: number) {
	let a = semilla >>> 0;
	const siguiente = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		siguiente,
		entre: (min: number, max: number) => Math.floor(siguiente() * (max - min + 1)) + min,
		elegir: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)],
		/** Elige según pesos: `[[valor, peso], …]`. */
		pesos: <T>(lista: readonly (readonly [T, number])[]): T => {
			const total = lista.reduce((s, [, p]) => s + p, 0);
			let r = siguiente() * total;
			for (const [valor, peso] of lista) {
				r -= peso;
				if (r < 0) return valor;
			}
			return lista[lista.length - 1][0];
		},
	};
}
type Azar = ReturnType<typeof crearAzar>;

// ── Fechas (todo en hora de Bogotá, UTC-5 sin horario de verano) ───────────

function sumarDias(ymd: string, dias: number): string {
	const [y, m, d] = ymd.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
function diaSemana(ymd: string): number {
	const [y, m, d] = ymd.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function instante(ymd: string, hora: number, minuto: number): Date {
	return new Date(`${ymd}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-05:00`);
}
const redondear1000 = (n: number) => Math.max(1000, Math.round(n / 1000) * 1000);

// ── Datos fijos ─────────────────────────────────────────────────────────────

export const CUENTAS_DEMO = ['Nequi', 'Bancolombia', 'Daviplata'];

const NOMBRES = [
	'Carlos Morales',
	'Luisa Fernández',
	'Andrés Gómez',
	'María Rodríguez',
	'Pedro Jiménez',
	'Ana Martínez',
	'Santiago López',
	'Valentina Ruiz',
	'Camilo Herrera',
	'Isabella Torres',
	'Juan Pablo Ortiz',
	'Daniela Castro',
	'Sebastián Vargas',
	'Laura Mejía',
];
const DIRECCIONES = [
	'Cra 5 # 12-34 Apto 201',
	'Calle 8 # 3-10',
	'Tv 9 # 7-15 Casa 2',
	'Cll 15 # 8-20 Bl 3 Ap 5',
	'Cra 12 # 18-40',
	'Diagonal 10 # 4-22',
	'Cll 22 # 6-18 Ap 302',
	'Cra 3 # 9-55 Casa 1',
	'Cll 30 # 11-5 Of 201',
	'Cra 7 # 14-22',
	'Cll 40 # 20-12',
	'Cra 9 # 25-60 Torre 2',
	'Calle 33 # 15-08',
	'Cra 15 # 30-45',
];
const REFERENCIAS = ['Portón negro', 'Frente al parque', 'Timbre 2', 'Casa de rejas blancas', null, null];
const OBSERVACIONES = [
	'Sin cebolla',
	'Llamar al llegar',
	'Cortar en 8 porciones',
	'Extra servilletas',
	'Sin picante',
	'Alergia a la lactosa — sin queso en toda la orden',
	null,
	null,
	null,
	null,
	null,
];
const HORAS = [11, 12, 12, 13, 13, 14, 15, 17, 18, 18, 19, 19, 20, 20, 21];
const PEDIDOS_POR_DIA = [16, 6, 7, 8, 9, 15, 17]; // domingo … sábado

/** Teléfonos de demostración: rango propio (3102…) para reconocerlos y poder borrarlos sin tocar clientes reales. */
export const PREFIJO_TELEFONO_DEMO = '3102';
export const PASSWORD_CLIENTE_DEMO = '123456';

// ── Clientes ────────────────────────────────────────────────────────────────

function generarClientes(azar: Azar): ClienteDemo[] {
	return NOMBRES.map((nombre, i) => ({
		telefono: `${PREFIJO_TELEFONO_DEMO}${String(i + 1).padStart(6, '0')}`,
		nombre,
		correo: i % 3 === 0 ? `${nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@correo.test` : null,
		conPassword: i === 0, // el primero entra a ClientWeb con 123456
		direcciones: [
			{direccion: DIRECCIONES[i], referencia: azar.elegir(REFERENCIAS), costoDomicilio: azar.elegir([3000, 4000, 5000])},
			...(i % 4 === 0
				? [{direccion: DIRECCIONES[(i + 5) % DIRECCIONES.length], referencia: null, costoDomicilio: 6000}]
				: []),
		],
	}));
}

// ── Líneas de venta ─────────────────────────────────────────────────────────

interface Pools {
	pizzas: VarianteCat[];
	calzones: VarianteCat[];
	bebidas: VarianteCat[];
	comidas: VarianteCat[];
	grupos: Map<number, GrupoCat>;
	saboresPorGrupo: Map<number, SaborCat[]>;
}

function armarPools(c: Catalogo): Pools {
	const grupos = new Map(c.grupos.map((g) => [g.id, g]));
	const saboresPorGrupo = new Map<number, SaborCat[]>();
	for (const s of c.sabores) {
		if (s.grupoId == null) continue;
		saboresPorGrupo.set(s.grupoId, [...(saboresPorGrupo.get(s.grupoId) ?? []), s]);
	}
	const conGrupo = (v: VarianteCat) => v.grupoId != null && grupos.has(v.grupoId);
	return {
		grupos,
		saboresPorGrupo,
		pizzas: c.variantes.filter((v) => v.categoria === 'pizza' && conGrupo(v) && grupos.get(v.grupoId!)!.usaTamano),
		calzones: c.variantes.filter((v) => v.categoria === 'calzone' && conGrupo(v) && grupos.get(v.grupoId!)!.varianteEsSabor),
		bebidas: c.variantes.filter((v) => v.categoria === 'bebida'),
		comidas: c.variantes.filter((v) => v.categoria === 'comida'),
	};
}

function elegirSabores(azar: Azar, disponibles: SaborCat[], cantidad: number): SaborCat[] {
	const pool = [...disponibles];
	const elegidos: SaborCat[] = [];
	while (elegidos.length < cantidad && pool.length) {
		elegidos.push(pool.splice(azar.entre(0, pool.length - 1), 1)[0]);
	}
	return elegidos;
}

function lineaConSabores(azar: Azar, v: VarianteCat, pools: Pools, cantSabores: number): LineaDemo {
	const grupo = pools.grupos.get(v.grupoId!)!;
	const sabores = elegirSabores(azar, pools.saboresPorGrupo.get(grupo.id) ?? [], cantSabores);
	const tamano = grupo.usaTamano ? tamanoDeVariante({nombre: v.nombre, tamano: v.tamano}) : null;
	const recargo = calcularRecargoSabores(grupo, sabores, sabores.length, tamano).total;
	// Mismo texto que arma el servidor: si la variante ES el sabor (calzone) no se repite "- variante".
	let producto = grupo.varianteEsSabor ? v.producto : `${v.producto} - ${v.nombre}`;
	if (sabores.length) producto += ` (${sabores.map((s) => s.nombre).join(' + ')})`;
	const fraccion = sabores.length ? Math.round((1 / sabores.length) * 10000) / 10000 : 0;
	const precioLista = v.precio + recargo;
	return {
		producto,
		cantidad: 1,
		precioUnitario: precioLista,
		varianteId: v.varianteId,
		productoId: v.productoId,
		productoBase: v.producto,
		varianteNombre: v.nombre,
		tamano,
		categoria: v.categoria,
		precioLista,
		precioManual: false,
		sabores: sabores.map((s, i) => ({saborId: s.saborId, nombre: s.nombre, posicion: i + 1, fraccion})),
	};
}

function lineaSimple(v: VarianteCat): LineaDemo {
	return {
		producto: `${v.producto} - ${v.nombre}`,
		cantidad: 1,
		precioUnitario: v.precio,
		varianteId: v.varianteId,
		productoId: v.productoId,
		productoBase: v.producto,
		varianteNombre: v.nombre,
		tamano: null,
		categoria: v.categoria,
		precioLista: v.precio,
		precioManual: false,
		sabores: [],
	};
}

function generarLineas(azar: Azar, pools: Pools, tipo: 'mesa' | 'llevar' | 'domicilio'): LineaDemo[] {
	const lineas: LineaDemo[] = [];
	const principales = azar.pesos<'pizza' | 'calzone' | 'comida'>([
		['pizza', 62],
		['calzone', 14],
		['comida', 24],
	]);
	const cuantasPrincipales = tipo === 'llevar' ? 1 : azar.pesos([[1, 55], [2, 35], [3, 10]] as const);
	for (let i = 0; i < cuantasPrincipales; i++) {
		const que = i === 0 ? principales : azar.pesos<'pizza' | 'calzone' | 'comida'>([['pizza', 70], ['calzone', 10], ['comida', 20]]);
		if (que === 'pizza' && pools.pizzas.length) {
			const v = azar.pesos(pools.pizzas.map((p) => [p, /grande/i.test(p.nombre) ? 45 : /median/i.test(p.nombre) ? 35 : 20] as const));
			lineas.push(lineaConSabores(azar, v, pools, azar.pesos([[1, 45], [2, 40], [3, 15]] as const)));
		} else if (que === 'calzone' && pools.calzones.length) {
			const v = pools.calzones.find((c) => /unidad/i.test(c.nombre)) ?? pools.calzones[0];
			lineas.push(lineaConSabores(azar, v, pools, azar.pesos([[1, 70], [2, 30]] as const)));
		} else if (pools.comidas.length) {
			lineas.push(lineaSimple(azar.elegir(pools.comidas)));
		} else if (pools.pizzas.length) {
			lineas.push(lineaConSabores(azar, azar.elegir(pools.pizzas), pools, 1));
		}
	}
	if (pools.bebidas.length && azar.siguiente() < 0.6) {
		const b = lineaSimple(azar.elegir(pools.bebidas));
		if (azar.siguiente() < 0.15) b.cantidad = 2;
		lineas.push(b);
	}
	// Algunas líneas con precio pactado distinto del de lista (descuento o cortesía): alimenta "ajustes de precio".
	for (const l of lineas) {
		if (azar.siguiente() < 0.03 && l.precioLista > 4000) {
			l.precioUnitario = l.precioLista - 2000;
			l.precioManual = true;
		}
	}
	return lineas;
}

// ── Ventas ──────────────────────────────────────────────────────────────────

interface ContextoVentas {
	azar: Azar;
	pools: Pools;
	clientes: ClienteDemo[];
	catalogo: Catalogo;
	contador: {n: number};
}

function cuentaAleatoria(azar: Azar): string {
	return azar.pesos<string>([[CUENTAS_DEMO[0], 45], [CUENTAS_DEMO[1], 35], [CUENTAS_DEMO[2], 20]]);
}

function totalDeLineas(lineas: LineaDemo[]): number {
	return lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0);
}

interface Cobro {
	estado: EstadoFacturaDemo;
	metodo: FacturaDemo['metodo'];
	pagoEfectivo: number | null;
	pagoTransferencia: number | null;
	montoPagado: number | null;
	fechaCobro: Date | null;
	cuenta: string | null;
	desglose: FacturaDemo['desglose'];
	entradasCaja: FacturaDemo['entradasCaja'];
}

const sinCobro = (estado: EstadoFacturaDemo): Cobro => ({
	estado,
	metodo: null,
	pagoEfectivo: null,
	pagoTransferencia: null,
	montoPagado: null,
	fechaCobro: null,
	cuenta: null,
	desglose: null,
	entradasCaja: [],
});

const minutosDespues = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

/** Cobro completo: efectivo, transferencia (con cuenta) o mixto. Misma forma que deja `completar`. */
function cobroPagado(azar: Azar, total: number, fecha: Date): Cobro {
	const fechaCobro = minutosDespues(fecha, azar.entre(15, 70));
	const metodo =
		total < 6000
			? 'efectivo'
			: azar.pesos<'efectivo' | 'transferencia' | 'efectivo_transferencia'>([
					['efectivo', 50],
					['transferencia', 32],
					['efectivo_transferencia', 18],
				]);
	if (metodo === 'efectivo') {
		return {
			...sinCobro('pagado'),
			metodo,
			pagoEfectivo: total,
			pagoTransferencia: 0,
			montoPagado: total,
			fechaCobro,
			entradasCaja: [{monto: total, fecha: fechaCobro, metodo: 'efectivo', pagoTransferencia: null}],
		};
	}
	const cuenta = cuentaAleatoria(azar);
	if (metodo === 'transferencia') {
		return {...sinCobro('pagado'), metodo, pagoEfectivo: 0, pagoTransferencia: total, montoPagado: total, fechaCobro, cuenta};
	}
	const efectivo = Math.min(redondear1000(total * (0.3 + azar.siguiente() * 0.3)), total - 1000);
	const transferencia = total - efectivo;
	return {
		...sinCobro('pagado'),
		metodo,
		pagoEfectivo: efectivo,
		pagoTransferencia: transferencia,
		montoPagado: total,
		fechaCobro,
		cuenta,
		entradasCaja: [{monto: efectivo, fecha: fechaCobro, metodo: 'efectivo_transferencia', pagoTransferencia: transferencia}],
	};
}

/** Factura abonada pero no saldada: abonos en efectivo y/o QR (a una o dos cuentas), con el desglose por cuenta. */
function cobroParcial(azar: Azar, total: number, fecha: Date): Cobro {
	const forma = azar.pesos<'qr' | 'efectivo' | 'qr+efectivo' | 'qr+qr'>([
		['qr', 30],
		['efectivo', 25],
		['qr+efectivo', 25],
		['qr+qr', 20],
	]);
	const a1 = redondear1000(total * (0.3 + azar.siguiente() * 0.2));
	const a2 = redondear1000(total * 0.2);
	const cuentaA = cuentaAleatoria(azar);
	const cuentaB = CUENTAS_DEMO.find((c) => c !== cuentaA) ?? cuentaA;
	const abonos: AbonoDemo[] = [];
	const f1 = minutosDespues(fecha, 25);
	const f2 = minutosDespues(fecha, 55);
	if (forma === 'qr') abonos.push({metodo: 'transferencia', monto: a1, cuenta: cuentaA, fecha: f1});
	else if (forma === 'efectivo') abonos.push({metodo: 'efectivo', monto: a1, cuenta: null, fecha: f1});
	else if (forma === 'qr+efectivo')
		abonos.push({metodo: 'transferencia', monto: a1, cuenta: cuentaA, fecha: f1}, {metodo: 'efectivo', monto: a2, cuenta: null, fecha: f2});
	else
		abonos.push({metodo: 'transferencia', monto: a1, cuenta: cuentaA, fecha: f1}, {metodo: 'transferencia', monto: a2, cuenta: cuentaB, fecha: f2});
	// Siempre queda saldo por cobrar (si no, sería una factura pagada).
	while (abonos.length > 1 && abonos.reduce((s, a) => s + a.monto, 0) > total - 1000) abonos.pop();

	const efectivo = abonos.filter((a) => a.metodo === 'efectivo').reduce((s, a) => s + a.monto, 0);
	const transferencia = abonos.filter((a) => a.metodo === 'transferencia').reduce((s, a) => s + a.monto, 0);
	let desglose: {cuentaId: number | null; cuenta: string | null; monto: number}[] = [];
	for (const a of abonos) if (a.metodo === 'transferencia') desglose = acumularDesglose(desglose, null, a.cuenta, a.monto);
	const ultimaQr = [...abonos].reverse().find((a) => a.metodo === 'transferencia');
	return {
		...sinCobro('parcial'),
		pagoEfectivo: efectivo,
		pagoTransferencia: transferencia,
		montoPagado: efectivo + transferencia,
		cuenta: ultimaQr?.cuenta ?? null,
		desglose: desglose.length ? desglose.map((d) => ({cuenta: d.cuenta as string, monto: d.monto})) : null,
		entradasCaja: abonos
			.filter((a) => a.metodo === 'efectivo')
			.map((a) => ({monto: a.monto, fecha: a.fecha, metodo: 'efectivo', pagoTransferencia: null})),
	};
}

type ModoVenta = 'historica' | 'activa' | 'completadaHoy';

function generarVenta(ctx: ContextoVentas, fecha: Date, modo: ModoVenta, activaIdx = 0): FacturaDemo | null {
	const {azar, pools, clientes, catalogo} = ctx;
	const tipo = azar.pesos<'domicilio' | 'mesa' | 'llevar'>([
		['domicilio', 48],
		['mesa', 30],
		['llevar', 22],
	]);
	const lineas = generarLineas(azar, pools, tipo);
	if (!lineas.length) return null;

	// Los primeros clientes piden más seguido (así hay "clientes frecuentes" reales).
	const cliente = azar.pesos(clientes.map((c, i) => [c, Math.max(1, clientes.length - i)] as const));
	const usaCliente = tipo === 'domicilio' || (tipo === 'llevar' && azar.siguiente() < 0.5) || azar.siguiente() < 0.1;
	const canal: FacturaDemo['orden']['canal'] =
		tipo === 'domicilio'
			? azar.pesos<'pos' | 'whatsapp' | 'web'>([
					['pos', 50],
					['whatsapp', 30],
					['web', 20],
				])
			: 'pos';
	const web = canal === 'web';
	const nombre = usaCliente || web ? cliente.nombre : tipo === 'mesa' ? `Mesa ${azar.entre(1, 8)}` : `Cliente Paso ${azar.entre(1, 40)}`;
	const telefono = usaCliente || web ? cliente.telefono : null;

	const dir = cliente.direcciones[0];
	const costoDomicilio = tipo === 'domicilio' ? dir.costoDomicilio : 0;
	const total = totalDeLineas(lineas) + costoDomicilio;

	// Cobro según el momento: lo antiguo se cobró (con algo de cancelaciones, saldos y abonos); lo de ahora está en marcha.
	let cobro: Cobro;
	let estadoOrden: FacturaDemo['orden']['estadoOrden'];
	if (modo === 'historica' || modo === 'completadaHoy') {
		const r = azar.siguiente();
		const permiteDeuda = telefono != null && total >= 8000 && modo === 'historica';
		if (r < 0.04) {
			cobro = sinCobro('cancelado');
			estadoOrden = 'cancelado';
		} else if (r < 0.08 && permiteDeuda) {
			cobro = sinCobro('pendiente');
			estadoOrden = 'completada';
		} else if (r < 0.12 && permiteDeuda) {
			cobro = cobroParcial(azar, total, fecha);
			estadoOrden = 'completada';
		} else {
			cobro = cobroPagado(azar, total, fecha);
			estadoOrden = 'completada';
		}
	} else if (activaIdx === 4) {
		// Ahora mismo: una ya prepagada y en preparación, una en preparación sin pagar, el resto pendiente.
		cobro = cobroPagado(azar, total, fecha);
		estadoOrden = 'en preparación';
	} else {
		cobro = sinCobro('pendiente');
		estadoOrden = activaIdx === 3 ? 'en preparación' : 'pendiente';
	}

	const entregada = estadoOrden === 'completada';
	const conductores = catalogo.domiciliarios;
	const asignado =
		conductores.length && (modo !== 'activa' || activaIdx < 3) ? conductores[ctx.contador.n % conductores.length].telefono : null;

	return {
		clave: `demo-${++ctx.contador.n}`,
		clienteNombre: nombre,
		telefonoCliente: telefono,
		descripcion: lineas.map((l) => `${l.cantidad} ${l.producto}`).join(', '),
		fecha,
		total,
		...cobro,
		orden: {
			tipoPedido: tipo,
			estadoOrden,
			fecha,
			canal,
			observaciones: azar.elegir(OBSERVACIONES),
			usuarioCreacionId: web ? cliente.telefono : canal === 'pos' ? 'demo-cajero' : null,
			lineas,
		},
		domicilio:
			tipo === 'domicilio'
				? {
						telefono: cliente.telefono,
						direccion: dir.direccion,
						referencia: dir.referencia,
						costo: costoDomicilio,
						telefonoDomiciliario: asignado,
						estado: cobro.estado === 'cancelado' ? 'cancelado' : entregada ? 'entregado' : 'pendiente',
					}
				: null,
	};
}

// ── Egresos ─────────────────────────────────────────────────────────────────

function generarGastos(azar: Azar, hoy: string, dias: number): GastoDemo[] {
	const gastos: GastoDemo[] = [];
	const nuevo = (g: Partial<GastoDemo> & Pick<GastoDemo, 'nombre' | 'total' | 'fecha' | 'categoria' | 'metodo'>): void => {
		gastos.push({
			descripcion: '',
			estado: 'pagado',
			tipoGasto: g.categoria === 'general' ? null : ['insumos', 'mercancia', 'empaques'].includes(g.categoria) ? 'costo' : 'gasto',
			cuentaOrigen: g.metodo === 'qr' ? cuentaAleatoria(azar) : null,
			...g,
		});
	};
	for (let d = dias; d >= 0; d--) {
		const fecha = sumarDias(hoy, -d);
		const dow = diaSemana(fecha);
		if (dow === 1 && d > 0) nuevo({nombre: 'Nómina cocina', total: 380000, fecha, categoria: 'nomina', metodo: 'qr', cuentaOrigen: 'Bancolombia'});
		if ((dow === 2 || dow === 5) && d > 0)
			nuevo({nombre: 'Queso y harina', total: redondear1000(azar.entre(200, 450) * 1000), fecha, categoria: 'insumos', metodo: 'efectivo_no_caja'});
		if (dow === 3 && d > 0)
			nuevo({nombre: 'Bebidas proveedor', total: redondear1000(azar.entre(150, 300) * 1000), fecha, categoria: 'mercancia', metodo: 'qr', cuentaOrigen: 'Nequi'});
		if (d % 10 === 3)
			nuevo({nombre: azar.elegir(['Luz', 'Gas', 'Internet', 'Agua']), total: redondear1000(azar.entre(60, 180) * 1000), fecha, categoria: 'servicios', metodo: 'qr'});
		if (d % 14 === 5)
			nuevo({nombre: 'Cajas y desechables', total: redondear1000(azar.entre(60, 120) * 1000), fecha, categoria: 'empaques', metodo: 'efectivo_no_caja'});
	}
	nuevo({nombre: 'Arriendo', total: 1200000, fecha: sumarDias(hoy, -Math.min(32, dias)), categoria: 'arriendo', metodo: 'qr', cuentaOrigen: 'Bancolombia'});
	nuevo({nombre: 'Arriendo', total: 1200000, fecha: sumarDias(hoy, -2), categoria: 'arriendo', metodo: 'qr', estado: 'pendiente', cuentaOrigen: 'Bancolombia'});
	nuevo({nombre: 'Volantes', total: 80000, fecha: sumarDias(hoy, -Math.min(20, dias)), categoria: 'publicidad', metodo: 'qr', cuentaOrigen: 'Nequi'});
	nuevo({nombre: 'Reparación horno', total: 150000, fecha: sumarDias(hoy, -Math.min(12, dias)), categoria: 'mantenimiento', metodo: 'efectivo_no_caja'});
	// Egreso del sistema anterior: categoría "general" y sin tipo (aparece como "sin clasificar").
	nuevo({nombre: 'Gasto antiguo', total: 45000, fecha: sumarDias(hoy, -Math.min(40, dias)), categoria: 'general', metodo: 'efectivo_no_caja', tipoGasto: null});
	return gastos;
}

// ── Inventario y ubicaciones ────────────────────────────────────────────────

function generarStock(c: Catalogo): StockDemo[] {
	const stock: StockDemo[] = [];
	const cajas: {cat: 'pequena' | 'mediana' | 'grande' | 'calzone'; nombre: string; cantidad: number; alerta: number}[] = [
		{cat: 'grande', nombre: 'Caja Pizza Grande', cantidad: 40, alerta: 15},
		{cat: 'mediana', nombre: 'Caja Pizza Mediana', cantidad: 12, alerta: 10}, // "bajo"
		{cat: 'pequena', nombre: 'Caja Pizza Pequeña', cantidad: 4, alerta: 10}, // "crítico"
		{cat: 'calzone', nombre: 'Caja Calzone', cantidad: 30, alerta: 10},
	];
	for (const caja of cajas) {
		const variantes = c.variantes
			.filter((v) => categoriaCajaDeVariante(v.categoria, v.producto, v.nombre) === caja.cat)
			.map((v) => ({varianteId: v.varianteId, soloParaLlevar: true}));
		stock.push({
			tipo: 'caja',
			nombre: caja.nombre,
			categoria: caja.cat,
			cantidad: caja.cantidad,
			alertaMinimo: caja.alerta,
			nivelObjetivo: 60,
			origen: `demo:caja-${caja.cat}`,
			variantes,
		});
	}
	const cantidades = [24, 6, 48, 3, 18];
	c.variantes
		.filter((v) => v.categoria === 'bebida' && /coca|sprite|quatro|agua|personal/i.test(v.nombre))
		.slice(0, 5)
		.forEach((v, i) => {
			stock.push({
				tipo: 'bebida',
				nombre: `${v.producto} ${v.nombre}`.slice(0, 150),
				categoria: /agua/i.test(v.nombre) ? 'agua' : 'gaseosa',
				cantidad: cantidades[i % cantidades.length],
				alertaMinimo: 8,
				nivelObjetivo: 48,
				origen: `variante:${v.varianteId}`,
				variantes: [{varianteId: v.varianteId, soloParaLlevar: false}],
			});
		});
	return stock;
}

function generarUbicaciones(c: Catalogo): UbicacionDemo[] {
	const minutos = [2, 11, 180];
	return c.domiciliarios.slice(0, 3).map((d, i) => ({
		telefono: d.telefono,
		latitud: 6.2442 + i * 0.012,
		longitud: -75.5812 + i * 0.01,
		haceMinutos: minutos[i],
	}));
}

// ── Entrada principal ───────────────────────────────────────────────────────

export interface OpcionesGenerador {
	/** "Ahora": las ventas nunca quedan en el futuro. */
	ahora?: Date;
	/** Cuántos días hacia atrás se generan ventas. */
	dias?: number;
	semilla?: number;
}

export function generarDatosDemo(catalogo: Catalogo, opciones: OpcionesGenerador = {}): DatasetDemo {
	const ahora = opciones.ahora ?? new Date();
	const dias = opciones.dias ?? 45;
	const azar = crearAzar(opciones.semilla ?? 20260606);
	const hoy = getBogotaDateString(ahora);
	const clientes = generarClientes(azar);
	const ctx: ContextoVentas = {azar, pools: armarPools(catalogo), clientes, catalogo, contador: {n: 0}};
	const horaActual = Number(new Intl.DateTimeFormat('en-GB', {timeZone: 'America/Bogota', hour: '2-digit', hour12: false}).format(ahora)) % 24;

	const facturas: FacturaDemo[] = [];
	for (let d = dias; d >= 1; d--) {
		const ymd = sumarDias(hoy, -d);
		const cantidad = PEDIDOS_POR_DIA[diaSemana(ymd)] + azar.entre(-1, 2);
		for (let i = 0; i < cantidad; i++) {
			const f = generarVenta(ctx, instante(ymd, azar.elegir(HORAS), azar.entre(0, 59)), 'historica');
			if (f) facturas.push(f);
		}
	}
	// Hoy: lo ya terminado antes de la hora actual y lo que está en marcha.
	const horasPasadas = HORAS.filter((h) => h < horaActual);
	const terminadasHoy = horasPasadas.length ? azar.entre(3, 6) : 0;
	for (let i = 0; i < terminadasHoy; i++) {
		const f = generarVenta(ctx, instante(hoy, azar.elegir(horasPasadas), azar.entre(0, 59)), 'completadaHoy');
		if (f) facturas.push(f);
	}
	for (let i = 0; i < 6; i++) {
		const f = generarVenta(ctx, new Date(ahora.getTime() - azar.entre(3, 85) * 60_000), 'activa', i);
		if (f) facturas.push(f);
	}
	facturas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

	// Una apertura de caja por día con movimiento, antes de la primera venta del día.
	const aperturas: AperturaDemo[] = [];
	const primeraDelDia = new Map<string, Date>();
	for (const f of facturas) {
		const ymd = getBogotaDateString(f.fecha);
		const previa = primeraDelDia.get(ymd);
		if (!previa || f.fecha < previa) primeraDelDia.set(ymd, f.fecha);
	}
	for (const [fecha, primera] of primeraDelDia) {
		const tentativa = instante(fecha, 10, 30);
		aperturas.push({
			fecha,
			instante: primera < tentativa ? minutosDespues(primera, -15) : tentativa,
			total: 100000,
			denominaciones: {'50000': 1, '20000': 2, '10000': 1},
		});
	}

	return {
		cuentas: CUENTAS_DEMO,
		clientes,
		facturas,
		gastos: generarGastos(azar, hoy, dias),
		aperturas,
		stock: generarStock(catalogo),
		ubicaciones: generarUbicaciones(catalogo),
	};
}
