import React from 'react';
import { RefreshControl } from 'react-native';
import { Text, TouchableOpacity, View } from '../../tw';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { useFacturasPagosScreen, todayISO } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Input,
  Icon,
  Badge,
  ConfirmModal,
  ListSkeleton,
} from '../../components/ui';

export default function FacturasPagosScreen() {
  const { isMobile } = useBreakpoint();
  const {
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
  } = useFacturasPagosScreen();

  return (
    <PageContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#F5A524"
          colors={["#F5A524"]}
        />
      }
    >
      <PageHeader
        title="Gastos y Pagos"
        subtitle="Facturas"
        icon="credit-card-minus-outline"
        rightContent={
          <View className="flex-row gap-2">
            <Button
              title="Refrescar"
              icon="refresh"
              variant="ghost"
              size="sm"
              onPress={fetchDia}
              loading={loadingDia}
            />
            <Button
              title={showForm ? 'Cerrar' : 'Nuevo Gasto'}
              icon={showForm ? 'close' : 'plus'}
              variant={showForm ? 'ghost' : 'primary'}
              size="sm"
              onPress={() => {
                if (showForm) resetForm();
                setShowForm(!showForm);
              }}
            />
          </View>
        }
      />

      {/* ── Create / Edit form ── */}
      {showForm && (
        <Card variant="elevated" padding="lg" className="mb-10">
          <View className="flex-row items-center gap-3 mb-8">
            <Icon
              name={editingId ? 'pencil-outline' : 'plus-circle-outline'}
              size={22}
              color="#F5A524"
            />
            <Text className="text-lg font-bold text-white">
              {editingId ? 'Editar Gasto' : 'Registrar Pago / Gasto'}
            </Text>
          </View>

          <View className={`flex-row gap-6 mb-2 ${isMobile ? 'flex-col' : ''}`}>
            <Input
              label="Total *"
              value={total ? formatCurrency(Number(total)) : ''}
              onChangeText={(v) => setTotal(v.replace(/\./g, ''))}
              keyboardType="numeric"
              placeholder="$"
              containerStyle={{ flex: 1, minWidth: 150 }}
            />
            <Input
              label="Nombre del gasto *"
              value={nombreGasto}
              onChangeText={setNombreGasto}
              placeholder=""
              containerStyle={{ flex: 2, minWidth: 200 }}
              leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
            />
          </View>

          <View className={`flex-row gap-6 mb-2 ${isMobile ? 'flex-col' : ''}`}>
            <View className={`mb-6 ${!isMobile ? 'flex-1 min-w-[300px]' : ''}`}>
              <Text className="text-[10px] font-black text-slate-400 mb-3 ml-1 uppercase tracking-widest">Método de Pago</Text>
              <View className="flex-row gap-3">
                {['efectivo', 'qr'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    className={`flex-row items-center gap-3 py-2.5 px-8 rounded-full border ${metodo === m ? 'bg-amber-500/10 border-amber-500/20' : 'bg-black/20 border-white/5'}`}
                    onPress={() => setMetodo(m)}
                  >
                    <Icon
                      name={m === 'efectivo' ? 'cash' : 'qrcode'}
                      size={16}
                      color={metodo === m ? '#F5A524' : '#64748B'}
                    />
                    <Text className={`text-sm tracking-tight capitalize ${metodo === m ? 'text-amber-500 font-black' : 'text-slate-500 font-bold'}`}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Input
            label="Fecha (YYYY-MM-DD)"
            value={fechaFactura}
            onChangeText={setFechaFactura}
            placeholder={todayISO()}
            leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
          />
          <Input
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            placeholder="Notas adicionales..."
          />

          {(formError || createError) ? (
            <View className="flex-row items-center gap-2 mb-6 p-3 bg-red-500/10 rounded-lg">
              <Icon name="alert-circle-outline" size={14} color="#F43F5E" />
              <Text className="text-red-500 text-sm font-medium">{formError || createError}</Text>
            </View>
          ) : null}

          {success && (
            <View className="flex-row items-center gap-2 mb-6 p-3 bg-emerald-500/10 rounded-lg">
              <Icon name="check-circle-outline" size={14} color="#34D399" />
              <Text className="text-emerald-500 text-sm font-medium">Guardado correctamente</Text>
            </View>
          )}

          <View className="flex-row justify-end gap-4 mt-4">
            {editingId && (
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => { resetForm(); setShowForm(false); }}
              />
            )}
            <Button
              title={(creating || updating) ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
              variant="primary"
              icon="content-save-outline"
              onPress={onSubmit}
              loading={creating || updating}
              disabled={!total || !nombreGasto}
            />
          </View>
        </Card>
      )}

      {/* Actions (Filter) */}
      <View className="flex-row gap-4 mb-10 flex-wrap">
        <Button
          title={showRangeFilter ? 'Ocultar Filtro' : 'Filtrar por Fechas'}
          icon={showRangeFilter ? 'close' : 'calendar-range'}
          variant="outline"
          size="sm"
          onPress={() => setShowRangeFilter(!showRangeFilter)}
        />
      </View>

      {/* ── Range filter ── */}
      {showRangeFilter && (
        <Card padding="md" className="mb-10">
          <View className="flex-row items-center gap-3 mb-8">
            <Icon name="calendar-range" size={20} color="#F5A524" />
            <Text className="text-lg font-bold text-white">Filtrar por Calendario</Text>
          </View>
          <View className={`flex-row gap-4 mb-2 ${isMobile ? 'flex-col' : ''}`}>
            <Input
              label="Desde"
              value={from}
              onChangeText={setFrom}
              placeholder="2025-11-01"
              containerStyle={{ flex: 1, minWidth: 140 }}
              leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
            />
            <Input
              label="Hasta"
              value={to}
              onChangeText={setTo}
              placeholder="2025-11-30"
              containerStyle={{ flex: 1, minWidth: 140 }}
              leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
            />
          </View>
          <Button
            title={loadingRango ? 'Buscando...' : 'Buscar'}
            icon="magnify"
            variant="primary"
            size="sm"
            onPress={handleSearchRange}
            loading={loadingRango}
            disabled={!from || !to}
          />
        </Card>
      )}

      {/* ── Error / Loading ── */}
      {displayError && <ErrorState message={displayError} onRetry={showRangeFilter ? fetchRango : fetchDia} />}
      {displayLoading && !displayData.length && <ListSkeleton count={3} />}

      {/* ── Expense list ── */}
      {displayData.map((item, idx) => (
        <Card key={item.pagosId?.toString() || idx.toString()} padding="md" className="mb-4">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-white mb-2">{item.nombreGasto || 'Sin nombre'}</Text>
              <View className="flex-row gap-6">
                {item.fechaFactura && (
                  <View className="flex-row items-center gap-2">
                    <Icon name="calendar-outline" size={12} color="#64748B" />
                    <Text className="text-[10px] text-slate-500 font-bold uppercase">{item.fechaFactura}</Text>
                  </View>
                )}
                {item.metodo && (
                  <View className="flex-row items-center gap-2">
                    <Icon name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'} size={12} color="#64748B" />
                    <Text className="text-[10px] text-slate-500 font-bold uppercase">{item.metodo}</Text>
                  </View>
                )}
              </View>
            </View>
            <View className="items-end gap-2">
              {item.total !== undefined && (
                <Text className="text-xl font-black text-amber-500 tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>${formatCurrency(item.total)}</Text>
              )}
              {item.estado && (
                <Badge
                  label={item.estado}
                  variant={item.estado === 'pagado' ? 'success' : 'warning'}
                  size="sm"
                />
              )}
            </View>
          </View>

          {item.descripcion && (
            <Text className="text-sm text-slate-400 italic mb-4 pl-3 border-l-2 border-slate-700">{item.descripcion}</Text>
          )}

          <View className="flex-row justify-end gap-2 pt-3 border-t border-white/5">
            <Button
              title="Editar"
              icon="pencil-outline"
              variant="ghost"
              size="sm"
              onPress={() => onEdit(item)}
              disabled={deleting}
            />
            <Button
              title="Eliminar"
              icon="trash-can-outline"
              variant="ghost"
              size="sm"
              onPress={() => setDeleteTarget({ id: item.pagosId!, name: item.nombreGasto || 'gasto' })}
              disabled={deleting}
              className="opacity-70"
            />
          </View>
        </Card>
      ))}

      {!displayLoading && displayData.length === 0 && !displayError && (
        <EmptyState
          message="Sin gastos registrados"
          subMessage={
            showRangeFilter
              ? 'No se encontraron gastos en el rango seleccionado.'
              : 'No hay gastos registrados hoy.'
          }
          icon="cash-remove"
        />
      )}

      {/* ── Delete Confirmation ── */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Eliminar gasto"
        message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        icon="trash-can-outline"
        variant="danger"
        confirmText="Eliminar"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}
