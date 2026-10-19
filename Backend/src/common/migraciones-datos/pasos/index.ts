import type {PasoMigracion} from '../migraciones-datos.types';
import {productosCategoriaV1} from './productos-categoria-v1';
import {ventasDetalleV1} from './ventas-detalle-v1';
import {inventarioUnificadoV1} from './inventario-unificado-v1';
import {saborGruposV1} from './sabor-grupos-v1';
import {cuentasFacturaIdV1} from './cuentas-factura-id-v1';
import {facturasMontosV1} from './facturas-montos-v1';

/**
 * Registro ORDENADO de migraciones de datos. Para agregar una: crear el archivo del
 * paso con un id versionado nuevo y añadirlo al final. Nunca cambiar el id de un paso
 * ya desplegado (se volvería a ejecutar).
 *
 * El orden importa: el detalle de ventas (segundo plano) lee el catálogo de sabores YA agrupado, así que va al final
 * y declara `dependeDe: ['sabor-grupos-v1']`. Los pasos `sync` corren uno tras otro en el arranque; el de segundo plano
 * arranca cuando todos los anteriores terminaron en 'ok'.
 */
export const PASOS_MIGRACION: PasoMigracion[] = [
	productosCategoriaV1,
	saborGruposV1,
	cuentasFacturaIdV1,
	facturasMontosV1,
	inventarioUnificadoV1,
	ventasDetalleV1,
];
