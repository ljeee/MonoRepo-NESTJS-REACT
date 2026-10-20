// ─── Resúmenes contables de LISTAS ya cargadas (exportaciones, vistas filtradas) ──────────
// Mismas definiciones que el servidor (GET /estadisticas/resumen): cobrado topado al total,
// anuladas fuera, abonos de las parciales cuentan, mixtas repartidas entre efectivo y QR,
// y lo cobrado por QR repartido por cuenta. Las exportaciones y PDF pasan por aquí para que
// sus cifras cuadren con las pantallas (antes sumaban `total` de las 'pagado' sin ver las
// parciales, las anuladas ni las mixtas).
// RN/TS puro: RiderApp compila este archivo vía @/src/shared.

import type { CobradoPorCuenta, DesgloseTransferencia, GastosPorCategoria, GastosPorTipo } from '../types/models';
import { CATEGORIA_GENERAL, tipoDeGasto } from '../constants/gastos';
import type { TipoGastoFiltro } from '../constants/gastos';
import { cobrado, isAnulada, montoEfectivo, montoTransferencia, porCobrar } from './factura';
import type { FacturaMontosLike } from './factura';

export interface FacturaContable extends FacturaMontosLike {
  cuentaTransferenciaId?: number | null;
  cuentaTransferenciaNombre?: string | null;
  desgloseTransferencia?: DesgloseTransferencia[] | null;
}

export interface GastoContable {
  total?: number | string | null;
  estado?: string | null;
  metodo?: string | null;
  categoria?: string | null;
  tipoGasto?: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Lo cobrado por QR/transferencia de UNA factura, por cuenta. Con desglose (abonos a cuentas
 * distintas) una entrada por cuenta; sin él, todo a la cuenta de la factura (o sin asignar).
 */
export function transferenciasPorCuenta(f: FacturaContable): { cuentaId: number | null; cuenta: string | null; monto: number }[] {
  const monto = montoTransferencia(f);
  if (monto <= 0) return [];
  if (f.desgloseTransferencia?.length) {
    return f.desgloseTransferencia.filter((e) => num(e.monto) > 0).map((e) => ({ cuentaId: e.cuentaId ?? null, cuenta: e.cuenta ?? null, monto: num(e.monto) }));
  }
  return [{ cuentaId: f.cuentaTransferenciaId ?? null, cuenta: f.cuentaTransferenciaNombre?.trim() || null, monto }];
}

export interface ResumenFacturas {
  /** Facturas válidas (no anuladas). */
  facturas: number;
  anuladas: number;
  facturado: number;
  cobrado: number;
  porCobrar: number;
  efectivo: number;
  transferencia: number;
  porCuenta: CobradoPorCuenta[];
}

/** Resumen de dinero de una lista de facturas con las definiciones únicas. */
export function resumirFacturas(lista: FacturaContable[]): ResumenFacturas {
  const r: ResumenFacturas = { facturas: 0, anuladas: 0, facturado: 0, cobrado: 0, porCobrar: 0, efectivo: 0, transferencia: 0, porCuenta: [] };
  const cuentas = new Map<string, CobradoPorCuenta & { ids: Set<number> }>();

  lista.forEach((f, i) => {
    if (isAnulada(f)) {
      r.anuladas += 1;
      return;
    }
    r.facturas += 1;
    r.facturado += num(f.total);
    r.cobrado += cobrado(f);
    r.porCobrar += porCobrar(f);
    r.efectivo += montoEfectivo(f);
    r.transferencia += montoTransferencia(f);

    for (const t of transferenciasPorCuenta(f)) {
      const clave = t.cuentaId != null ? `id:${t.cuentaId}` : t.cuenta ? `n:${t.cuenta}` : 'sin';
      const fila = cuentas.get(clave) ?? { cuentaId: t.cuentaId, cuenta: t.cuenta ?? 'Sin asignar', sinAsignar: t.cuentaId == null && !t.cuenta, facturas: 0, monto: 0, ids: new Set<number>() };
      fila.monto += t.monto;
      // Una factura abonada a la misma cuenta varias veces cuenta una sola vez.
      const id = (f as { facturaId?: number }).facturaId ?? -(i + 1);
      if (!fila.ids.has(id)) {
        fila.ids.add(id);
        fila.facturas += 1;
      }
      cuentas.set(clave, fila);
    }
  });

  r.porCuenta = [...cuentas.values()].map(({ ids: _ids, ...fila }) => fila).sort((a, b) => b.monto - a.monto);
  return r;
}

export function isGastoPagado(g: { estado?: string | null }): boolean {
  return g.estado === 'pagado' || g.estado === 'pagada';
}

export interface ResumenGastos {
  cantidad: number;
  total: number;
  pagados: number;
  pendientes: number;
  porTipo: GastosPorTipo[];
  porCategoria: GastosPorCategoria[];
}

/** Resumen de egresos de una lista: totales, pagados y desglose por tipo y categoría. */
export function resumirGastos(lista: GastoContable[]): ResumenGastos {
  const porCategoria = new Map<string, GastosPorCategoria>();
  let total = 0;
  let pagados = 0;

  for (const g of lista) {
    const monto = num(g.total);
    const pagado = isGastoPagado(g) ? monto : 0;
    total += monto;
    pagados += pagado;
    const tipo = tipoDeGasto(g);
    const categoria = g.categoria || CATEGORIA_GENERAL;
    const clave = `${categoria}|${tipo}`;
    const fila = porCategoria.get(clave) ?? { categoria, tipo, cantidad: 0, total: 0, pagados: 0 };
    fila.cantidad += 1;
    fila.total += monto;
    fila.pagados += pagado;
    porCategoria.set(clave, fila);
  }

  const filas = [...porCategoria.values()].sort((a, b) => b.total - a.total);
  const tipos: TipoGastoFiltro[] = ['costo', 'gasto', 'sin_clasificar'];
  const porTipo = tipos.map((tipo) => {
    const delTipo = filas.filter((f) => f.tipo === tipo);
    return {
      tipo,
      cantidad: delTipo.reduce((t, f) => t + f.cantidad, 0),
      total: delTipo.reduce((t, f) => t + f.total, 0),
      pagados: delTipo.reduce((t, f) => t + f.pagados, 0),
    };
  });
  return { cantidad: lista.length, total, pagados, pendientes: total - pagados, porTipo, porCategoria: filas };
}

/** ¿La factura (válida) cobró algo por QR/transferencia? Mismo criterio de la lista de Transferencias. */
export function tieneCobroTransferencia(f: FacturaContable): boolean {
  return !isAnulada(f) && montoTransferencia(f) > 0;
}

/**
 * Nombre del archivo del libro diario: `libro-diario[-transferencias|-cuenta-<nombre>]-<día | desde_a_hasta>.<pdf|csv>`,
 * p. ej. `libro-diario-2026-10-18.pdf`. Espejo de `nombreArchivoLibro` del servidor (libro-diario.formato.ts), que
 * nombra los adjuntos del correo del cierre: así el PDF que se descarga en el POS se llama igual que el que llega
 * por correo. `nombre-libro-paridad.spec.ts` (backend) los compara.
 */
export function nombreArchivoLibroDiario(
  l: { from: string; to: string; filtro?: string | null; cuentaNombre?: string | null },
  extension: 'pdf' | 'csv',
): string {
  const cuenta = (l.cuentaNombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const tipo =
    l.filtro === 'solo_transferencias'
      ? '-transferencias'
      : l.filtro === 'cuenta_especifica'
        ? `-cuenta${cuenta ? `-${cuenta}` : ''}`
        : '';
  const fechas = l.from === l.to ? l.from : `${l.from}_a_${l.to}`;
  return `libro-diario${tipo}-${fechas}.${extension}`;
}
