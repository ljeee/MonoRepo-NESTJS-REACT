import React from 'react';
import { RefreshControl } from 'react-native';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { useFacturasPagosScreen, todayISO } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import { ScrollView, View, Text, TouchableOpacity } from '../../tw';
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
        title="Gastos Operativos"
        subtitle="Control de caja y pagos"
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
              variant={showForm ? 'secondary' : 'primary'}
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
        <Card className="mb-8 overflow-hidden bg-slate-900 border-orange-500/20">
          <View className="flex-row items-center gap-3 mb-6 p-4 bg-orange-500/10">
            <Icon
              name={editingId ? 'pencil-outline' : 'plus-circle-outline'}
              size={22}
              color="#F5A524"
            />
            <Text className="text-white font-black text-base uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
              {editingId ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
            </Text>
          </View>

          <View className="px-6 pb-6 gap-y-4">
            <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
                <Input
                label="Monto *"
                value={total ? formatCurrency(Number(total)) : ''}
                onChangeText={(v: string) => setTotal(v.replace(/\./g, ''))}
                keyboardType="numeric"
                placeholder="$ 0"
                className="flex-1"
                size="md"
                />
                <Input
                label="Concepto *"
                value={nombreGasto}
                onChangeText={setNombreGasto}
                placeholder="Ej. Pago Proveedor"
                className="flex-1"
                size="md"
                />
            </View>

            <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
                <View className="flex-1">
                    <Text className="text-white/60 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Medio de Pago</Text>
                    <View className="flex-row gap-2">
                        {['efectivo', 'qr'].map((m) => (
                        <TouchableOpacity
                            key={m}
                            onPress={() => setMetodo(m)}
                            className={`flex-1 py-3 flex-row items-center justify-center gap-2 rounded-xl border ${metodo === m ? 'bg-orange-500/20 border-orange-500' : 'bg-white/5 border-white/10'}`}
                        >
                            <Icon
                            name={m === 'efectivo' ? 'cash' : 'qrcode'}
                            size={14}
                            color={metodo === m ? "#F5A524" : "#64748B"}
                            />
                            <Text className={`text-xs font-black uppercase ${metodo === m ? 'text-orange-400' : 'text-slate-500'}`}>{m}</Text>
                        </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
                <Input
                    label="Fecha de Registro"
                    value={fechaFactura}
                    onChangeText={setFechaFactura}
                    placeholder={todayISO()}
                    className="flex-1"
                    leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
                />
                <Input
                    label="Descripción / Notas"
                    value={descripcion}
                    onChangeText={setDescripcion}
                    multiline
                    placeholder="Detalles adicionales del gasto..."
                    className="flex-1"
                />
            </View>

            {(formError || createError) ? (
                <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                    <Icon name="alert-circle-outline" size={16} color="#EF4444" />
                    <Text className="text-red-400 text-xs font-black uppercase">{formError || createError}</Text>
                </View>
            ) : null}

            {success && (
                <View className="flex-row items-center gap-2 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                    <Icon name="check-circle-outline" size={16} color="#10B981" />
                    <Text className="text-emerald-400 text-xs font-black uppercase">¡Registro guardado con éxito!</Text>
                </View>
            )}

            <View className="flex-row justify-end gap-4 mt-2">
                {editingId && (
                <Button
                    title="Cancelar"
                    variant="ghost"
                    onPress={() => { resetForm(); setShowForm(false); }}
                />
                )}
                <Button
                title={(creating || updating) ? 'Guardando...' : editingId ? 'Actualizar Registro' : 'Confirmar Gasto'}
                variant="primary"
                icon="content-save-outline"
                onPress={onSubmit}
                loading={creating || updating}
                disabled={!total || !nombreGasto}
                className="px-8"
                />
            </View>
          </View>
        </Card>
      )}

      {/* Actions (Filter) */}
      <View className="flex-row gap-3 mb-8">
        <Button
          title={showRangeFilter ? 'Hoy' : 'Filtrar Historial'}
          icon={showRangeFilter ? 'calendar' : 'calendar-range'}
          variant="secondary"
          size="sm"
          onPress={() => setShowRangeFilter(!showRangeFilter)}
        />
      </View>

      {/* ── Range filter ── */}
      {showRangeFilter && (
        <Card className="mb-8 p-4 bg-slate-900 border-white/5">
          <View className="flex-row items-center gap-3 mb-4">
            <Icon name="calendar-range" size={20} color="#F5A524" />
            <Text className="text-white font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Filtro de Historial</Text>
          </View>
          <View className={`${isMobile ? 'flex-col' : 'flex-row'} items-end gap-3`}>
            <Input
              label="Desde"
              value={from}
              onChangeText={setFrom}
              placeholder="AAAA-MM-DD"
              className="flex-1"
              leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
            />
            <Input
              label="Hasta"
              value={to}
              onChangeText={setTo}
              placeholder="AAAA-MM-DD"
              className="flex-1"
              leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
            />
            <Button
                title={loadingRango ? '...' : 'Buscar'}
                icon="magnify"
                variant="primary"
                size="sm"
                onPress={handleSearchRange}
                loading={loadingRango}
                disabled={!from || !to}
                className={isMobile ? 'w-full h-12' : 'h-11 px-8'}
            />
          </View>
        </Card>
      )}

      {/* ── Error / Loading ── */}
      {displayError && <ErrorState message={displayError} onRetry={showRangeFilter ? fetchRango : fetchDia} />}
      {displayLoading && !displayData.length && <ListSkeleton count={3} />}

      {/* ── Expense list ── */}
      <View className="gap-y-4 pb-20">
        {displayData.map((item, idx) => (
            <Card key={item.pagosId?.toString() || idx.toString()} className="overflow-hidden border-white/5 bg-slate-900/40">
                <View className="flex-row items-start p-4">
                    <View className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center mr-4">
                        <Icon 
                            name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'} 
                            size={24} 
                            color={item.estado === 'pagado' ? '#F5A524' : '#64748B'} 
                        />
                    </View>

                    <View className="flex-1">
                        <View className="flex-row justify-between items-start mb-1 gap-4">
                            <Text className="text-white font-black text-base uppercase flex-1" style={{ fontFamily: 'Space Grotesk' }}>
                                {item.nombreGasto || 'Sin concepto'}
                            </Text>
                            <Text className="text-(--color-pos-primary) font-black text-xl flex-shrink-0" style={{ fontFamily: 'Space Grotesk' }}>
                                ${formatCurrency(item.total || 0)}
                            </Text>
                        </View>

                        <View className="flex-row items-center gap-3 mb-2">
                             <View className="flex-row items-center gap-1.5">
                                <Icon name="calendar-outline" size={12} color="#64748B" />
                                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{item.fechaFactura}</Text>
                            </View>
                            <Badge
                                label={item.estado || '—'}
                                variant={item.estado === 'pagado' ? 'success' : 'warning'}
                                size="sm"
                            />
                        </View>

                        {item.descripcion && (
                            <View className="pt-2 border-t border-white/5">
                                <Text className="text-slate-400 text-xs italic leading-tight">{item.descripcion}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View className="flex-row border-t border-white/5 bg-white/5">
                    <TouchableOpacity
                        onPress={() => onEdit(item)}
                        disabled={deleting}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2 border-r border-white/5 active:bg-white/10"
                    >
                        <Icon name="pencil" size={16} color="#94A3B8" />
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDeleteTarget({ id: item.pagosId!, name: item.nombreGasto || 'gasto' })}
                        disabled={deleting}
                        className="flex-1 py-3 flex-row items-center justify-center gap-2 active:bg-red-500/10"
                    >
                        <Icon name="trash-can-outline" size={16} color="#EF4444" />
                        <Text className="text-red-400 text-[10px] font-black uppercase tracking-widest">Eliminar</Text>
                    </TouchableOpacity>
                </View>
            </Card>
        ))}

        {!displayLoading && displayData.length === 0 && !displayError && (
            <View className="py-20">
                <EmptyState
                    message="Sin registros"
                    subMessage={
                        showRangeFilter
                        ? 'No se encontraron gastos en el rango seleccionado.'
                        : 'No hay gastos registrados hoy.'
                    }
                    icon="cash-remove"
                />
            </View>
        )}
      </View>

      {/* ── Delete Confirmation ── */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Eliminar registro"
        message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Esta acción será irreversible.`}
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
