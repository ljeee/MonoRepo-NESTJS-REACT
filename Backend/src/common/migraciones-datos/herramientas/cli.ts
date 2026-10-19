import 'reflect-metadata';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import {Client} from 'pg';
import {auditarBase, formatearAuditoria} from './auditoria';
import type {Ejecutar} from './esquema';
import {type LineaBase, capturarLineaBase} from './linea-base';
import {compararPreciosSabores} from './paridad-precios';
import {esperarPasos, formatearVerificacion, verificarMigracion} from './verificacion';

/**
 * Herramientas de la migración de producción. TODAS son de solo lectura (la sesión se abre con
 * `default_transaction_read_only = on`: aunque hubiera un error en el código, no podrían escribir).
 *
 *   npm run migracion:auditar                          # qué hay en la base y qué problemas traería migrarla
 *   npm run migracion:linea-base -- --salida base.json # foto de lo que NO debe cambiar (antes de desplegar)
 *   npm run migracion:verificar -- --base base.json    # compara la base migrada con esa foto (--esperar: aguarda el 2º plano)
 *   npm run migracion:precios                          # prueba que el precio de cada pizza no cambió
 *
 * La base sale de las variables DATABASE_* de Backend/.env, o del archivo indicado en DOTENV_CONFIG_PATH
 * (PowerShell: $env:DOTENV_CONFIG_PATH='.env.ensayo'). Sin dependencia de Nest ni de TypeORM: no ejecuta synchronize.
 */

function argumento(nombre: string): string | undefined {
	const i = process.argv.findIndex((a) => a === `--${nombre}` || a.startsWith(`--${nombre}=`));
	if (i < 0) return undefined;
	const a = process.argv[i];
	if (a.includes('=')) return a.slice(a.indexOf('=') + 1);
	const siguiente = process.argv[i + 1];
	return siguiente && !siguiente.startsWith('--') ? siguiente : 'true';
}

async function conectar(): Promise<{cliente: Client; q: Ejecutar}> {
	dotenv.config({path: process.env.DOTENV_CONFIG_PATH || '.env', quiet: true});
	const cliente = new Client({
		host: process.env.DATABASE_HOST || 'localhost',
		port: Number(process.env.DATABASE_PORT || 5432),
		user: process.env.DATABASE_USER || 'postgres',
		password: process.env.DATABASE_PASSWORD || undefined,
		database: process.env.DATABASE_NAME || 'postgres',
	});
	await cliente.connect();
	await cliente.query('SET default_transaction_read_only = on');
	await cliente.query(`SET TIME ZONE 'America/Bogota'`);
	console.log(`Conectado a ${cliente.host}:${cliente.port}/${cliente.database} (sesión de SOLO LECTURA)\n`);
	return {cliente, q: async (sql, params) => (await cliente.query(sql, params as unknown[])).rows};
}

async function principal(): Promise<number> {
	const comando = process.argv[2];
	if (!comando || !['auditar', 'linea-base', 'verificar', 'precios'].includes(comando)) {
		console.error(
			'Uso: cli.ts <auditar | linea-base | verificar | precios> [--salida archivo] [--base archivo] [--esperar]',
		);
		return 64;
	}
	const {cliente, q} = await conectar();
	try {
		if (comando === 'auditar') {
			const informe = await auditarBase(q);
			const texto = formatearAuditoria(informe);
			console.log(texto);
			const salida = argumento('salida');
			if (salida) {
				fs.writeFileSync(salida, texto, 'utf8');
				fs.writeFileSync(salida.replace(/\.\w+$/, '') + '.json', JSON.stringify(informe, null, 2), 'utf8');
				console.log(`Informe guardado en ${salida}`);
			}
			return informe.bloqueantes ? 2 : 0;
		}

		if (comando === 'linea-base') {
			const base = await capturarLineaBase(q);
			const salida =
				argumento('salida') ?? `linea-base-${base.capturadaEn.slice(0, 16).replace(/[:T]/g, '')}.json`;
			fs.writeFileSync(salida, JSON.stringify(base, null, 2), 'utf8');
			console.log(`Línea base guardada en ${salida}`);
			console.log(
				`  Tablas: ${Object.entries(base.tablas)
					.map(([t, n]) => `${t}=${n}`)
					.join(' · ')}`,
			);
			console.log(
				`  Meses de ventas: ${base.ventasPorMes.length} · Huellas: ${Object.keys(base.huellas).length}`,
			);
			return 0;
		}

		if (comando === 'precios') {
			const r = await compararPreciosSabores(q);
			if (r.omitido) console.log(`Omitido: ${r.omitido}`);
			console.log(
				`${r.combinaciones.toLocaleString('es-CO')} combinaciones de ${r.productos.join(', ') || '—'}: ${r.diferencias.length} diferencias`,
			);
			for (const d of r.diferencias.slice(0, 20))
				console.log(
					`  ${d.producto} ${d.variante} [${d.sabores.join(' + ')}] antes ${d.antes} → ahora ${d.ahora}`,
				);
			return r.diferencias.length ? 1 : 0;
		}

		// verificar
		const archivo = argumento('base');
		const base: LineaBase | null =
			archivo && archivo !== 'true' ? JSON.parse(fs.readFileSync(archivo, 'utf8')) : null;
		if (argumento('esperar')) {
			console.log('Esperando a que terminen los pasos de segundo plano…');
			await esperarPasos(q, {alAvanzar: (t) => process.stdout.write(`\r${t.slice(0, 200)}`)});
			console.log('');
		}
		const resultado = await verificarMigracion(q, base);
		console.log(formatearVerificacion(resultado));
		const salida = argumento('salida');
		if (salida) fs.writeFileSync(salida, JSON.stringify(resultado, null, 2), 'utf8');
		return resultado.ok ? 0 : 1;
	} finally {
		// Deja la sesión como estaba (con un pooler o PGlite la sesión es compartida y seguiría en solo lectura).
		await cliente.query('RESET default_transaction_read_only').catch(() => undefined);
		await cliente.end();
	}
}

principal()
	.then((codigo) => process.exit(codigo))
	.catch((error) => {
		console.error('❌', error?.message ?? error);
		process.exit(70);
	});
