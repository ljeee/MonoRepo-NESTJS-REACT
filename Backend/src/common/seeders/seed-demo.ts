import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import {AppDataSource} from '../../data-source';
import {cargarCatalogo} from './demo/catalogo';
import {borrarDatosDemo, escribirDatosDemo, hayDatosDemo, PREFIJO_CLAVE_DEMO, type Ejecutar} from './demo/escritor';
import {generarDatosDemo} from './demo/generador';
import {PASSWORD_CLIENTE_DEMO} from './demo/generador';

/**
 * Datos de demostración para probar TODO el sistema en local: clientes con direcciones, ~45 días de ventas (mesa,
 * llevar y domicilio por POS/web/WhatsApp) con efectivo, QR por cuenta, mixtos, abonos a varias cuentas, saldos por
 * cobrar y cancelaciones; órdenes en marcha para la cocina, domicilios con repartidor, caja, egresos
 * (costos y gastos, QR y efectivo), inventario con reglas y la ubicación GPS de los domiciliarios.
 *
 * Uso (desde Backend/, con la BD y Redis arriba y el backend arrancado AL MENOS UNA VEZ para crear las tablas):
 *   npm run seed:users && npm run seed:productos && npm run seed:demo
 *   npm run seed:demo -- --reset        # borra lo que cargó este seeder y lo vuelve a crear
 *   npm run seed:demo -- --dias=90      # más historial
 *
 * Solo toca filas de demostración (facturas `demo-N`, clientes 3102…, egresos y ítems marcados): nunca ventas reales.
 */

const LOCALES = new Set(['localhost', '127.0.0.1', '::1', 'db', 'host.docker.internal']);

function argumento(nombre: string): string | undefined {
	const hallado = process.argv.find((a) => a === `--${nombre}` || a.startsWith(`--${nombre}=`));
	if (!hallado) return undefined;
	return hallado.includes('=') ? hallado.split('=')[1] : 'true';
}

export async function seedDemo(): Promise<void> {
	const host = process.env.DATABASE_HOST || 'localhost';
	if ((process.env.NODE_ENV === 'production' || !LOCALES.has(host)) && argumento('force') !== 'true') {
		console.error(`❌ Se niega a cargar datos de demostración en "${host}" (NODE_ENV=${process.env.NODE_ENV ?? '-'}).`);
		console.error('   Es solo para bases locales. Si de verdad es una base de pruebas remota, repite con --force.');
		process.exit(1);
	}

	const dataSource = await AppDataSource.initialize();
	const queryRunner = dataSource.createQueryRunner();
	await queryRunner.connect();
	const q: Ejecutar = (sql, params) => queryRunner.query(sql, params as any[]);

	try {
		const [{tablas}] = await q(
			`SELECT COUNT(*)::int AS tablas FROM unnest(ARRAY['facturas_ventas','ordenes','productos','caja_movimientos','inventario_items','clientes']) t
			 WHERE to_regclass('public.' || t) IS NOT NULL`,
		);
		if (tablas < 6) {
			console.error('❌ Faltan tablas: arranca el backend una vez (npm run start:dev) para que cree el esquema y vuelve a correr esto.');
			process.exit(1);
		}

		// Red de seguridad: en el equipo de producción el host también es localhost/db, pero esa base TIENE ventas reales.
		// Mezclarles datos falsos ensuciaría reportes y cierres, así que sin --force no se carga sobre una base con ventas propias.
		const [{reales}] = await q(
			`SELECT COUNT(*)::int AS reales FROM facturas_ventas WHERE idempotency_key IS NULL OR idempotency_key NOT LIKE '${PREFIJO_CLAVE_DEMO}%'`,
		);
		if (reales > 0 && argumento('force') !== 'true') {
			console.error(`❌ Esta base ya tiene ${reales} ventas que no son de demostración. No se cargan datos falsos encima.`);
			console.error('   Usa una base vacía (npm run db:down borra el volumen: SOLO en tu equipo de pruebas) o repite con --force.');
			process.exit(1);
		}

		if (argumento('reset') === 'true') {
			console.log('🧹 Borrando datos de demostración anteriores…');
			await borrarDatosDemo(q);
		} else if (await hayDatosDemo(q)) {
			console.log('ℹ️  Ya hay datos de demostración. Usa `npm run seed:demo -- --reset` para recrearlos.');
			return;
		}

		const catalogo = await cargarCatalogo(q);
		if (!catalogo.variantes.length) {
			console.error('❌ No hay productos. Carga el menú primero: npm run seed:productos (o seed-menu.sql con Docker).');
			process.exit(1);
		}
		if (!catalogo.sabores.length) {
			console.warn('⚠️  No hay sabores de pizza todavía (los crea el backend al arrancar). Las pizzas saldrán sin sabores.');
		}
		if (!catalogo.domiciliarios.length) {
			console.warn('⚠️  No hay domiciliarios: corre `npm run seed:users` para tener repartidores asignables.');
		}

		const dias = Math.min(366, Math.max(1, Number(argumento('dias')) || 45));
		const datos = generarDatosDemo(catalogo, {dias});
		console.log(`🚀 Generando ${datos.facturas.length} ventas de ${dias} días, ${datos.gastos.length} egresos y ${datos.clientes.length} clientes…`);

		const passwordHash = await bcrypt.hash(PASSWORD_CLIENTE_DEMO, 10);
		await queryRunner.startTransaction();
		try {
			const resumen = await escribirDatosDemo(q, datos, {passwordHash});
			await queryRunner.commitTransaction();
			console.log('✅ Datos de demostración cargados:', resumen);
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		}

		console.log('');
		console.log('Para probar:');
		console.log('  • Staff: admin / cajero01 / mesero01 / cocina01 / contador01 (ver seed-users.ts)');
		console.log(`  • ClientWeb: teléfono ${datos.clientes[0].telefono} · contraseña ${PASSWORD_CLIENTE_DEMO}`);
		console.log('  • Las órdenes de "ahora" quedan pendientes para la cocina; hay deudas y abonos a varias cuentas.');
	} catch (error) {
		console.error('❌ Error cargando datos de demostración:', error);
		throw error;
	} finally {
		await queryRunner.release();
		await dataSource.destroy();
	}
}

if (require.main === module) {
	seedDemo().catch(() => process.exit(1));
}
