import type {PasoSync} from '../migraciones-datos.types';
import {contarActualizadas, existeColumna} from '../migraciones-datos.utils';

/**
 * Completa los montos que las facturas COBRADAS antiguas dejaron en NULL, con lo que ya se asume al leerlas.
 *
 * Los reportes (`common/domain/ventas.ts`) tratan una factura pagada sin `monto_pagado` como pagada por su total, y una
 * pagada en efectivo/transferencia como si todo hubiera entrado por ese medio: facturado, cobrado y por cobrar NO cambian.
 * (Única excepción visible: en un pago MIXTO con una sola parte conocida, la otra parte pasaba a "sin repartir" en los
 * reportes por medio; completarla la devuelve a su medio.)
 * Pero editar el total de una factura cobrada y el reverso de caja SÍ leen las columnas crudas: con `pago_efectivo` en
 * NULL, subir el total de una factura en efectivo registraba en caja el total completo en vez de la diferencia.
 *
 *  - `monto_pagado` NULL            → el total (solo facturas pagadas).
 *  - efectivo / transferencia / qr   → la columna del medio = total, la otra = 0 (solo donde estaba en NULL).
 *  - mixtas con UNA parte conocida   → la otra parte = total − la conocida.
 * Nunca pisa un valor existente, no toca `total`, y deja intactas las mixtas sin desglose (no se pueden deducir): la
 * auditoría previa las lista para corregirlas a mano. Idempotente.
 */
export const facturasMontosV1: PasoSync = {
	id: 'facturas-montos-v1',
	descripcion: 'Completa monto_pagado y el desglose por medio de las facturas pagadas antiguas',
	modo: 'sync',
	async run({manager, log}) {
		for (const columna of ['monto_pagado', 'pago_efectivo', 'pago_transferencia']) {
			if (!(await existeColumna(manager, 'facturas_ventas', columna))) {
				return {omitido: `Falta facturas_ventas.${columna}`};
			}
		}
		const PAGADA = `estado IN ('pagado', 'pagada') AND total IS NOT NULL`;

		const montoPagado = await contarActualizadas(
			manager,
			`UPDATE facturas_ventas SET monto_pagado = total WHERE ${PAGADA} AND monto_pagado IS NULL RETURNING 1`,
		);
		const efectivo = await contarActualizadas(
			manager,
			`UPDATE facturas_ventas SET pago_efectivo = total
			 WHERE ${PAGADA} AND metodo = 'efectivo' AND pago_efectivo IS NULL RETURNING 1`,
		);
		const transferencia = await contarActualizadas(
			manager,
			`UPDATE facturas_ventas SET pago_transferencia = total
			 WHERE ${PAGADA} AND metodo IN ('transferencia', 'qr') AND pago_transferencia IS NULL RETURNING 1`,
		);
		// La parte que no se usó vale 0 (queda explícito en vez de NULL).
		const ceros = await contarActualizadas(
			manager,
			`UPDATE facturas_ventas SET
				pago_efectivo = COALESCE(pago_efectivo, 0), pago_transferencia = COALESCE(pago_transferencia, 0)
			 WHERE ${PAGADA} AND metodo IN ('efectivo', 'transferencia', 'qr')
			   AND (pago_efectivo IS NULL OR pago_transferencia IS NULL) RETURNING 1`,
		);
		const mixtasEfectivo = await contarActualizadas(
			manager,
			`UPDATE facturas_ventas SET pago_efectivo = total - pago_transferencia
			 WHERE ${PAGADA} AND metodo = 'efectivo_transferencia' AND pago_efectivo IS NULL
			   AND pago_transferencia IS NOT NULL AND pago_transferencia BETWEEN 0 AND total RETURNING 1`,
		);
		const mixtasTransferencia = await contarActualizadas(
			manager,
			`UPDATE facturas_ventas SET pago_transferencia = total - pago_efectivo
			 WHERE ${PAGADA} AND metodo = 'efectivo_transferencia' AND pago_transferencia IS NULL
			   AND pago_efectivo IS NOT NULL AND pago_efectivo BETWEEN 0 AND total RETURNING 1`,
		);

		const [pendientes]: {mixtasSinDesglose: number; pagadasSinMetodo: number}[] = await manager.query(
			`SELECT
				COUNT(*) FILTER (WHERE metodo = 'efectivo_transferencia'
					AND (pago_efectivo IS NULL OR pago_transferencia IS NULL OR ABS(pago_efectivo + pago_transferencia - total) > 1))::int AS "mixtasSinDesglose",
				COUNT(*) FILTER (WHERE NULLIF(btrim(metodo), '') IS NULL)::int AS "pagadasSinMetodo"
			 FROM facturas_ventas WHERE ${PAGADA}`,
		);

		const resultado = {
			montoPagadoCompletado: montoPagado,
			efectivoCompletado: efectivo,
			transferenciaCompletado: transferencia,
			cerosCompletados: ceros,
			mixtasCompletadas: mixtasEfectivo + mixtasTransferencia,
			/** Siguen sin poder deducirse: corregirlas a mano (la auditoría las lista). */
			mixtasSinDesglose: Number(pendientes?.mixtasSinDesglose) || 0,
			pagadasSinMetodo: Number(pendientes?.pagadasSinMetodo) || 0,
		};
		log(`facturas-montos: ${JSON.stringify(resultado)}`);
		return resultado;
	},
};
