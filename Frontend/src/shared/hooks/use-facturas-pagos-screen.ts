import { useCallback, useEffect, useState } from 'react';
import { useCreateFacturaPago, useDeleteFacturaPago, useFacturasPagosDia, useFacturasPagosRango, useUpdateFacturaPago } from './use-create-factura-pago';
import type { CreateFacturaPagoDto, DenominacionesMap, FacturaPago, TipoGasto } from '../types/models';
import { CATEGORIA_GENERAL, tipoPorCategoria } from '../constants/gastos';
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
  /** Cuenta de transferencia de la que sale un egreso por QR (obligatoria con método QR). */
  const [cuentaOrigenId, setCuentaOrigenId] = useState<number | null>(null);
  /** Categoría contable y tipo (costo | gasto). El tipo sigue a la categoría hasta que se elige a mano. */
  const [categoria, setCategoriaState] = useState<string>(CATEGORIA_GENERAL);
  const [tipoGasto, setTipoGastoState] = useState<TipoGasto | null>(null);
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
    setCuentaOrigenId(null);
    setCategoriaState(CATEGORIA_GENERAL);
    setTipoGastoState(null);
    setDenominaciones({});
    setMonedas('');
    setEditingId(null);
    setFormError('');
  };

  /** Elegir categoría fija el tipo por defecto de esa categoría (se puede cambiar después). */
  const setCategoria = (id: string) => {
    setCategoriaState(id);
    setTipoGastoState(tipoPorCategoria(id));
  };
  const setTipoGasto = (tipo: TipoGasto) => setTipoGastoState(tipo);

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
    if (categoria === CATEGORIA_GENERAL || !tipoGasto) {
      setFormError('Elige la categoría del gasto (costo o gasto operativo) para la contabilidad');
      return;
    }

    if (metodo === 'qr' && cuentaOrigenId == null) {
      setFormError('Elige la cuenta de la que sale el pago por QR');
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
    // Las monedas viajan bajo la llave 'coins' (valor total, no conteo): es la que
    // entiende caja-movimientos al validar y sumar. Con otra llave la salida de caja falla.
    const denFinal: DenominacionesMap | undefined = metodo === 'efectivo' && !editingId
      ? { ...denominaciones, ...(monedasNum > 0 ? { coins: monedasNum } : {}) }
      : undefined;

    const payload: CreateFacturaPagoDto = {
      total: totalNum,
      nombreGasto: nombreGasto.trim(),
      descripcion: descripcion?.trim() || undefined,
      estado: estado?.trim() || undefined,
      fechaFactura: fechaFactura || undefined,
      metodo: metodo?.trim() || undefined,
      cuentaOrigenId: metodo === 'qr' ? cuentaOrigenId : null,
      categoria,
      tipoGasto,
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
    setCuentaOrigenId(item.cuentaOrigenId ?? null);
    setCategoriaState(item.categoria || CATEGORIA_GENERAL);
    setTipoGastoState(item.tipoGasto ?? null);
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
    cuentaOrigenId,
    setCuentaOrigenId,
    categoria,
    setCategoria,
    tipoGasto,
    setTipoGasto,
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
    dataDia,
  };
}
