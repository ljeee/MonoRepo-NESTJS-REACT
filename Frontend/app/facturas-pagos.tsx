import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { useCreateFacturaPago, useDeleteFacturaPago, useFacturasPagosDia, useFacturasPagosRango, useUpdateFacturaPago } from '../hooks/use-create-factura-pago';
import { styles } from '../styles/facturas-pagos.styles';

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString('es-CO');
}

export default function FacturasPagosScreen() {
  const { createPago, loading: creating, error: createError, success } = useCreateFacturaPago();
  const { data: dataDia, loading: loadingDia, error: errorDia, fetchData: fetchDia } = useFacturasPagosDia();
  const { data: dataRango, loading: loadingRango, error: errorRango, from, to, setFrom, setTo, fetchData: fetchRango } = useFacturasPagosRango();
  const { updatePago, loading: updating } = useUpdateFacturaPago();
  const { deletePago, loading: deleting } = useDeleteFacturaPago();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showRangeFilter, setShowRangeFilter] = useState(false);

  const [total, setTotal] = useState('');
  const [nombreGasto, setNombreGasto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [fechaFactura, setFechaFactura] = useState(todayISO());
  const [metodo, setMetodo] = useState('efectivo');

  useEffect(() => { fetchDia(); }, [fetchDia]);

  const resetForm = () => {
    setTotal('');
    setNombreGasto('');
    setDescripcion('');
    setEstado('pendiente');
    setFechaFactura(todayISO());
    setMetodo('efectivo');
    setEditingId(null);
  };

  const onSubmit = async () => {
    // Validaciones
    const totalNum = Number(total);
    if (!total || isNaN(totalNum) || totalNum <= 0) {
      alert('El total debe ser un número mayor a 0');
      return;
    }

    if (!nombreGasto || !nombreGasto.trim()) {
      alert('El nombre del gasto es requerido');
      return;
    }

    if (fechaFactura) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(fechaFactura)) {
        alert('Formato de fecha inválido. Use YYYY-MM-DD');
        return;
      }
      const d = new Date(fechaFactura);
      if (isNaN(d.getTime())) {
        alert('Fecha inválida');
        return;
      }
    }

    const payload = {
      total: totalNum,
      nombreGasto: nombreGasto.trim(),
      descripcion: descripcion?.trim() || undefined,
      estado: estado?.trim() || undefined,
      fechaFactura: fechaFactura || undefined,
      metodo: metodo?.trim() || undefined,
    };

    let ok;
    if (editingId) {
      ok = await updatePago(editingId, payload);
    } else {
      ok = await createPago(payload);
    }

    if (ok) {
      resetForm();
      setShowForm(false);
      fetchDia();
      if (showRangeFilter && from && to) fetchRango();
    }
  };

  const onEdit = (item: any) => {
    setTotal(item.total?.toString() || '');
    setNombreGasto(item.nombreGasto || '');
    setDescripcion(item.descripcion || '');
    setEstado(item.estado || 'pendiente');
    setFechaFactura(item.fechaFactura || todayISO());
    setMetodo(item.metodo || 'efectivo');
    setEditingId(item.pagosId);
    setShowForm(true);
  };

  const onDelete = async (id: number) => {
    if (!id || id <= 0) {
      alert('ID de gasto inválido');
      return;
    }

    if (confirm('¿Está seguro de eliminar este gasto? Esta acción no se puede deshacer.')) {
      const ok = await deletePago(id);
      if (ok) {
        fetchDia();
        if (showRangeFilter && from && to) fetchRango();
      }
    }
  };

  // Determine which data to display
  const displayData = showRangeFilter && dataRango ? dataRango : (dataDia || []);
  const displayLoading = showRangeFilter ? loadingRango : loadingDia;
  const displayError = showRangeFilter ? errorRango : errorDia;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Facturas y Pagos</Text>

      <TouchableOpacity
        onPress={() => {
          if (showForm) {
            resetForm();
          }
          setShowForm(!showForm);
        }}
        style={styles.toggleFormButton}
      >
        <Text style={styles.buttonText}>{showForm ? 'Cerrar Formulario' : 'Nuevo Gasto'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>{editingId ? 'Editar Gasto' : 'Registrar Pago / Gasto'}</Text>
          <View style={styles.formRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Total (número)</Text>
              <TextInput
                value={total}
                onChangeText={setTotal}
                keyboardType="numeric"
                placeholder="45000"
                style={styles.input}
              />
            </View>
            <View style={styles.inputGroupMedium}>
              <Text style={styles.label}>Nombre gasto</Text>
              <TextInput
                value={nombreGasto}
                onChangeText={setNombreGasto}
                placeholder="Caja fuerte"
                style={styles.input}
              />
            </View>
            <View style={styles.inputGroupMedium}>
              <Text style={styles.label}>Estado</Text>
              <TextInput
                value={estado}
                onChangeText={setEstado}
                placeholder="pendiente"
                style={styles.input}
              />
            </View>
            <View style={styles.inputGroupMedium}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
              <TextInput
                value={fechaFactura}
                onChangeText={setFechaFactura}
                placeholder={todayISO()}
                style={styles.input}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Método</Text>
              <TextInput
                value={metodo}
                onChangeText={setMetodo}
                placeholder="efectivo"
                style={styles.input}
              />
            </View>
            <View style={styles.inputGroupFull}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                placeholder="Notas..."
                style={styles.inputMultiline}
              />
            </View>
          </View>
          {createError && <Text style={styles.errorText}>{createError}</Text>}
          {success && <Text style={styles.successText}>Guardado correctamente</Text>}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={(creating || updating) || !total || !nombreGasto}
              style={[styles.submitButton, (!total || !nombreGasto) ? styles.submitButtonDisabled : styles.submitButtonEnabled, { opacity: (creating || updating) ? 0.7 : 1 }]}
            >
              <Text style={styles.submitButtonText}>{(creating || updating) ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}</Text>
            </TouchableOpacity>
            {editingId && (
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(false); }}
                style={styles.cancelButton}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Gastos del Día</Text>
      <View style={styles.buttonRowWrap}>
        <TouchableOpacity onPress={fetchDia} style={styles.refreshButton} disabled={loadingDia}>
          <Text style={styles.buttonText}>{loadingDia ? 'Actualizando...' : 'Refrescar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowRangeFilter(!showRangeFilter)}
          style={styles.filterButton}
        >
          <Text style={styles.buttonText}>{showRangeFilter ? 'Ocultar Filtro' : 'Filtrar por Fechas'}</Text>
        </TouchableOpacity>
      </View>

      {showRangeFilter && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterTitle}>Filtrar por Calendario</Text>
          <View style={styles.filterRow}>
            <View style={styles.filterInputGroup}>
              <Text style={styles.labelWithMargin}>Desde:</Text>
              <TextInput
                value={from}
                onChangeText={setFrom}
                placeholder="2025-11-01"
                style={styles.input}
              />
            </View>
            <View style={styles.filterInputGroup}>
              <Text style={styles.labelWithMargin}>Hasta:</Text>
              <TextInput
                value={to}
                onChangeText={setTo}
                placeholder="2025-11-30"
                style={styles.input}
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                if (!from || !to) {
                  alert('Debe ingresar ambas fechas');
                  return;
                }
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(from) || !dateRegex.test(to)) {
                  alert('Formato de fecha inválido. Use YYYY-MM-DD');
                  return;
                }
                const fromDate = new Date(from);
                const toDate = new Date(to);
                if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                  alert('Fechas inválidas');
                  return;
                }
                if (fromDate > toDate) {
                  alert('La fecha "Desde" no puede ser posterior a "Hasta"');
                  return;
                }
                fetchRango();
              }}
              disabled={!from || !to || loadingRango}
              style={styles.searchButton}
            >
              <Text style={styles.buttonText}>{loadingRango ? 'Buscando...' : 'Buscar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {displayError && <ErrorState message={displayError} onRetry={showRangeFilter ? fetchRango : fetchDia} />}
      {displayLoading && !displayData.length && <LoadingState message="Cargando gastos..." />}

      {displayData.map((item, idx) => (
        <View key={item.pagosId?.toString() || idx.toString()} style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.nombreGasto || 'Sin nombre'}</Text>
              {item.total !== undefined && <Text style={styles.itemTotal}>Total: $ {formatNumber(item.total)}</Text>}
              {item.metodo && <Text style={styles.itemMetodo}>Método: {item.metodo}</Text>}
              {item.estado && <Text style={item.estado === 'pendiente' ? styles.itemEstadoPendiente : styles.itemEstadoCompletado}>Estado: {item.estado}</Text>}
              {item.fechaFactura && <Text style={styles.itemFecha}>Fecha: {item.fechaFactura}</Text>}
              {item.descripcion && <Text style={styles.itemDescripcion}>Desc: {item.descripcion}</Text>}
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                onPress={() => onEdit(item)}
                style={styles.editButton}
                disabled={deleting}
              >
                <Text style={styles.actionButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(item.pagosId!)}
                style={styles.deleteButton}
                disabled={deleting}
              >
                <Text style={styles.actionButtonText}>{deleting ? '...' : 'Eliminar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {!displayLoading && displayData.length === 0 && !displayError && (
        <EmptyState
          message="Sin gastos registrados"
          subMessage={showRangeFilter ? "No se encontraron gastos en el rango de fechas seleccionado." : "No hay gastos registrados para el día de hoy."}
          icon="cash-remove"
        />
      )}
    </ScrollView>
  );
}