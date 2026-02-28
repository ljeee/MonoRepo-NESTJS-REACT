import { useEffect, useState } from 'react';
import { useCreateFacturaPago, useDeleteFacturaPago, useFacturasPagosDia, useFacturasPagosRango, useUpdateFacturaPago } from './use-create-factura-pago';
import type { CreateFacturaPagoDto, FacturaPago } from '../types/models';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function useFacturasPagosScreen() {
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
  const [estado, setEstado] = useState('pendiente');
  const [fechaFactura, setFechaFactura] = useState(todayISO());
  const [metodo, setMetodo] = useState('efectivo');

  useEffect(() => {
    fetchDia();
  }, [fetchDia]);

  const resetForm = () => {
    setTotal('');
    setNombreGasto('');
    setDescripcion('');
    setEstado('pendiente');
    setFechaFactura(todayISO());
    setMetodo('efectivo');
    setEditingId(null);
    setFormError('');
  };

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

    setFormError('');
    const payload: CreateFacturaPagoDto = {
      total: totalNum,
      nombreGasto: nombreGasto.trim(),
      descripcion: descripcion?.trim() || undefined,
      estado: estado?.trim() || undefined,
      fechaFactura: fechaFactura || undefined,
      metodo: metodo?.trim() || undefined,
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
    if (!from || !to) {
      setFormError('Debe ingresar ambas fechas');
      return;
    }
    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      setFormError('Formato inválido. Use YYYY-MM-DD');
      return;
    }
    if (new Date(from) > new Date(to)) {
      setFormError('"Desde" no puede ser posterior a "Hasta"');
      return;
    }
    setFormError('');
    fetchRango();
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
