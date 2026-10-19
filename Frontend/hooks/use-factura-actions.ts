import { useCallback, useState } from 'react';
import { useApi } from '@/src/shared';
import type { DenominacionesMap, FacturaVenta } from '@/src/shared';

type ActualizarFactura = (facturaId: number, cambios: Partial<FacturaVenta> & Record<string, unknown>) => Promise<unknown>;

export interface OpcionesFacturaActions {
  updateEstado: (facturaId: number, estado: string) => Promise<unknown>;
  updateFactura: ActualizarFactura;
  deleteFactura?: (facturaId: number) => Promise<boolean>;
  /** Recarga la lista (tras un abono el backend recalcula estado y saldos). */
  recargar: () => Promise<unknown> | void;
  /** Efecto tras cualquier cambio (recargar resumen, caja…). */
  alCambiar?: () => void;
}

/**
 * Acciones de FacturaCard (cobrar, abonar, cambiar total, borrar, asignar cuenta). Antes
 * cada pantalla de facturas tenía su copia de ~60 líneas, con diferencias sutiles (unas
 * refrescaban el resumen y otras no).
 */
export function useFacturaActions({ updateEstado, updateFactura, deleteFactura, recargar, alCambiar }: OpcionesFacturaActions) {
  const api = useApi();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const onToggleEstado = useCallback(
    async (
      facturaId: number,
      nuevoEstado: string,
      metodo?: string,
      pagoEfectivo?: number,
      pagoTransferencia?: number,
      denominaciones?: DenominacionesMap,
      cambioDenominaciones?: DenominacionesMap,
      cuentaTransferenciaId?: number,
      cuentaTransferenciaNombre?: string,
    ) => {
      setUpdatingId(facturaId);
      try {
        if (nuevoEstado === 'pagado' && metodo) {
          await updateFactura(facturaId, {
            estado: 'pagado',
            metodo,
            pagoEfectivo,
            pagoTransferencia,
            denominaciones,
            cambioDenominaciones,
            cuentaTransferenciaId,
            cuentaTransferenciaNombre,
          });
        } else {
          await updateEstado(facturaId, nuevoEstado);
        }
        alCambiar?.();
      } catch {
        /* el hook de datos muestra el error */
      }
      setUpdatingId(null);
    },
    [updateEstado, updateFactura, alCambiar],
  );

  const onAbono = useCallback(
    async (
      facturaId: number,
      monto: number,
      metodo: 'efectivo' | 'transferencia',
      denominaciones?: DenominacionesMap,
      cambioDenominaciones?: DenominacionesMap,
      cuentaTransferenciaId?: number,
      cuentaTransferenciaNombre?: string,
    ) => {
      setUpdatingId(facturaId);
      try {
        await api.facturas.abono(facturaId, monto, metodo, denominaciones, cambioDenominaciones, cuentaTransferenciaId, cuentaTransferenciaNombre);
        await recargar();
        alCambiar?.();
      } catch {
        /* el hook de datos muestra el error */
      }
      setUpdatingId(null);
    },
    [api, recargar, alCambiar],
  );

  const onUpdateTotal = useCallback(
    async (facturaId: number, total: number) => {
      await updateFactura(facturaId, { total });
      alCambiar?.();
    },
    [updateFactura, alCambiar],
  );

  const onDelete = useCallback(
    async (facturaId: number): Promise<boolean> => {
      if (!deleteFactura) return false;
      const ok = await deleteFactura(facturaId);
      if (ok) alCambiar?.();
      return ok;
    },
    [deleteFactura, alCambiar],
  );

  /** Cambios sueltos (p. ej. asignar la cuenta de una transferencia). */
  const onUpdate = useCallback(
    async (facturaId: number, cambios: Partial<FacturaVenta>) => {
      await updateFactura(facturaId, cambios);
      alCambiar?.();
    },
    [updateFactura, alCambiar],
  );

  return {
    updatingId,
    accionesFactura: deleteFactura ? { onToggleEstado, onAbono, onUpdateTotal, onDelete } : { onToggleEstado, onAbono, onUpdateTotal },
    onUpdate,
  };
}
