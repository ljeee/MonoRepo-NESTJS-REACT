import { useCallback, useEffect, useState } from 'react';
import { useCreateFacturaPago, useDeleteFacturaPago, useFacturasPagosDia, useFacturasPagosRango, useUpdateFacturaPago } from './use-create-factura-pago';
import type { CreateFacturaPagoDto, DenominacionesMap, FacturaPago } from '../types/models';
import { useApi } from '../contexts/ApiContext';

import { validateFlexibleDateRange, getLocalDateString } from '../utils/dateRange';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO() {
  return getLocalDateString();
}

export function useFacturasPagosScreen() {
  const api = useApi();
  const { createPago, loading: creating, error: createError, success } = useCreateFacturaPago();
  const { data: dataDia, loading: loadingDia, error: errorDia, fetchData: fetchDia } = useFacturasPagosDia();
  const {
    data: dataRango,
    loading: loadingRango,
    error: errorRango,
    from,
    to,
    setFrom,
    setTo,
    fetchData: fetchRango,
  } = useFacturasPagosRango();
  const { updatePago, loading: updating } = useUpdateFacturaPago();
  const { deletePago, loading: deleting } = useDeleteFacturaPago();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showRangeFilter, setShowRangeFilter] = useState(false);
  const [formError, setFormError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const [total, setTotal] = useState('');
  const [nombreGasto, setNombreGasto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState('pagado');
  const [fechaFactura, setFechaFactura] = useState(todayISO());
  const [metodo, setMetodo] = useState('qr');
  const [monedas, setMonedas] = useState('');
  const [denominaciones, setDenominaciones] = useState<DenominacionesMap>({});
  const [disponibleDenominaciones, setDisponibleDenominaciones] = useState<DenominacionesMap | null>(null);

  const fetchDisponible = useCallback(async () => {
    try {
      const estado = await api.cajaDenominaciones.getEstado();
      setDisponibleDenominaciones(estado);
    } catch {
      setDisponibleDenominaciones(null);
    }
  }, [api]);

  useEffect(() => {
    fetchDia();
  }, [fetchDia]);

  const resetForm = () => {
    setTotal('');
    setNombreGasto('');
    setDescripcion('');
    setEstado('pagado');
    setFechaFactura(todayISO());
    setMetodo('qr');
    setDenominaciones({});
    setMonedas('');
    setEditingId(null);
    setFormError('');
  };

  useEffect(() => {
    if (metodo === 'efectivo') fetchDisponible();
  }, [metodo, fetchDisponible]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDia();
    if (showRangeFilter && from && to) await fetchRango();
    setRefreshing(false);
  };

  const onSubmit = async () => {
    const totalNum = Number(total);
    if (!total || isNaN(totalNum) || totalNum <= 0) {
      setFormError('El total debe ser un número mayor a 0');
      return;
    }
    if (!nombreGasto?.trim()) {
      setFormError('El nombre del gasto es requerido');
      return;
    }
    if (fechaFactura && !DATE_REGEX.test(fechaFactura)) {
      setFormError('Formato de fecha inválido. Use YYYY-MM-DD');
      return;
    }

    // Para gastos en efectivo, exigir al menos un billete o monedas
    if (metodo === 'efectivo' && !editingId) {
      const hayBilletes = Object.keys(denominaciones).length > 0;
      const hayMonedas = (Number(monedas) || 0) > 0;
      if (!hayBilletes && !hayMonedas) {
        setFormError('Ingresa los billetes o monedas entregados para el gasto en efectivo');
        return;
      }
    }

    setFormError('');
    const monedasNum = Number(monedas) || 0;
    const denFinal: DenominacionesMap | undefined = metodo === 'efectivo' && !editingId
      ? { ...denominaciones, ...(monedasNum > 0 ? { monedas: monedasNum } : {}) }
      : undefined;

    const payload: CreateFacturaPagoDto = {
      total: totalNum,
      nombreGasto: nombreGasto.trim(),
      descripcion: descripcion?.trim() || undefined,
      estado: estado?.trim() || undefined,
      fechaFactura: fechaFactura || undefined,
      metodo: metodo?.trim() || undefined,
      denominaciones: denFinal && Object.keys(denFinal).length > 0 ? denFinal : undefined,
    };

    const ok = editingId ? await updatePago(editingId, payload) : await createPago(payload);
    if (!ok) return;

    resetForm();
    setShowForm(false);
    fetchDia();
    if (showRangeFilter && from && to) fetchRango();
  };

  const onEdit = (item: FacturaPago) => {
    if (!item.pagosId) return;
    setTotal(item.total?.toString() || '');
    setNombreGasto(item.nombreGasto || '');
    setDescripcion(item.descripcion || '');
    setEstado(item.estado || 'pendiente');
    setFechaFactura(item.fechaFactura || todayISO());
    setMetodo(item.metodo || 'efectivo');
    setDenominaciones({});
    setMonedas('');
    setEditingId(item.pagosId);
    setFormError('');
    setShowForm(true);
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deletePago(deleteTarget.id);
    if (ok) {
      fetchDia();
      if (showRangeFilter && from && to) fetchRango();
    }
    setDeleteTarget(null);
  };

  const handleSearchRange = () => {
    const { from: fromParsed, to: toParsed, error } = validateFlexibleDateRange(from, to);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError('');
    setFrom(fromParsed);
    setTo(toParsed);
    fetchRango(fromParsed, toParsed);
  };

  const displayData = showRangeFilter && dataRango ? dataRango : (dataDia || []);
  const displayLoading = showRangeFilter ? loadingRango : loadingDia;
  const displayError = showRangeFilter ? errorRango : errorDia;

  return {
    creating,
    createError,
    success,
    loadingDia,
    loadingRango,
    updating,
    deleting,
    showForm,
    setShowForm,
    editingId,
    showRangeFilter,
    setShowRangeFilter,
    formError,
    refreshing,
    deleteTarget,
    setDeleteTarget,
    total,
    setTotal,
    nombreGasto,
    setNombreGasto,
    descripcion,
    setDescripcion,
    estado,
    setEstado,
    fechaFactura,
    setFechaFactura,
    metodo,
    setMetodo,
    denominaciones,
    setDenominaciones,
    monedas,
    setMonedas,
    disponibleDenominaciones,
    from,
    to,
    setFrom,
    setTo,
    fetchDia,
    fetchRango,
    resetForm,
    handleRefresh,
    onSubmit,
    onEdit,
    onDelete,
    handleSearchRange,
    displayData,
    displayLoading,
    displayError,
  };
}
