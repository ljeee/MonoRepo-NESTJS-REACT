import type {PasoSync} from '../migraciones-datos.types';
import {contarActualizadas, existeColumna} from '../migraciones-datos.utils';

/**
 * Enlaza por id las facturas que solo guardaron el NOMBRE de su cuenta de transferencia.
 *
 * Las facturas viejas (y las importadas) traen `cuenta_transferencia_nombre` sin `cuenta_transferencia_id`. Los reportes
 * las unen a la cuenta por nombre EXACTO, así que "nequi" o "Nequi " aparecía como una cuenta distinta de "Nequi", y al
 * renombrar una cuenta (que propaga el nombre por id) esas facturas se quedaban con el nombre viejo. Aquí se les pone el
 * id y el nombre vigente de la tabla.
 *
 * Solo toca filas con nombre y sin id, y solo cuando UNA cuenta coincide (sin distinguir mayúsculas ni espacios de más).
 * Los nombres que no existen en la tabla, o que coinciden con varias cuentas, se dejan intactos y se reportan.
 * Idempotente. No cambia ningún monto.
 */
export const cuentasFacturaIdV1: PasoSync = {
	id: 'cuentas-factura-id-v1',
	descripcion: 'Enlaza por id las facturas que solo guardaron el nombre de su cuenta de transferencia',
	modo: 'sync',
	async run({manager, log}) {
		const faltantes: string[] = [];
		if (!(await existeColumna(manager, 'cuentas_transferencia'))) faltantes.push('cuentas_transferencia');
		if (!(await existeColumna(manager, 'facturas_ventas', 'cuenta_transferencia_id')))
			faltantes.push('facturas_ventas.cuenta_transferencia_id');
		if (!(await existeColumna(manager, 'facturas_ventas', 'cuenta_transferencia_nombre')))
			faltantes.push('facturas_ventas.cuenta_transferencia_nombre');
		if (faltantes.length) return {omitido: `Falta: ${faltantes.join(', ')}`};

		const enlazadas = await contarActualizadas(
			manager,
			`UPDATE facturas_ventas f
			 SET cuenta_transferencia_id = c.id, cuenta_transferencia_nombre = c.nombre
			 FROM cuentas_transferencia c
			 WHERE f.cuenta_transferencia_id IS NULL
			   AND NULLIF(btrim(f.cuenta_transferencia_nombre), '') IS NOT NULL
			   AND lower(btrim(f.cuenta_transferencia_nombre)) = lower(btrim(c.nombre))
			   AND (SELECT COUNT(*) FROM cuentas_transferencia c2 WHERE lower(btrim(c2.nombre)) = lower(btrim(c.nombre))) = 1
			 RETURNING 1`,
		);

		const sinCuenta: {nombre: string; facturas: number}[] = await manager.query(
			`SELECT btrim(f.cuenta_transferencia_nombre) AS nombre, COUNT(*)::int AS facturas
			 FROM facturas_ventas f
			 WHERE f.cuenta_transferencia_id IS NULL AND NULLIF(btrim(f.cuenta_transferencia_nombre), '') IS NOT NULL
			 GROUP BY 1 ORDER BY 2 DESC, 1`,
		);

		const resultado = {
			facturasEnlazadas: enlazadas,
			/** Nombres que ninguna cuenta (o varias) reconoce: se corrigen a mano desde "QR / Transferencias". */
			nombresSinCuenta: sinCuenta,
		};
		log(
			`cuentas-factura-id: ${JSON.stringify({facturasEnlazadas: enlazadas, nombresSinCuenta: sinCuenta.length})}`,
		);
		return resultado;
	},
};
