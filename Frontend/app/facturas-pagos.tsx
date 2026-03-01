import React from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { useFacturasPagosScreen, todayISO } from '../hooks/use-facturas-pagos-screen';
import { formatCurrency } from '../utils/formatNumber';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';
import { useBreakpoint } from '../styles/responsive';
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
} from '../components/ui';

export default function FacturasPagosScreen() {
  const { isMobile } = useBreakpoint();
  const localStyles = makeLocalStyles(isMobile);
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
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <PageHeader
        title="Gastos y Pagos"
        subtitle="Facturas"
        icon="credit-card-minus-outline"
        rightContent={
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
        }
      />

      {/* ── Create / Edit form ── */}
      {showForm && (
        <Card variant="elevated" padding="lg" style={localStyles.cardMarginXl}>
          <View style={localStyles.formHeader}>
            <Icon
              name={editingId ? 'pencil-outline' : 'plus-circle-outline'}
              size={22}
              color={colors.primary}
            />
            <Text style={localStyles.formTitle}>
              {editingId ? 'Editar Gasto' : 'Registrar Pago / Gasto'}
            </Text>
          </View>

          <View style={localStyles.formGrid}>
            <Input
              label="Total *"
              value={total ? formatCurrency(Number(total)) : ''}
              onChangeText={(v) => setTotal(v.replace(/\./g, ''))}
              keyboardType="numeric"
              placeholder="$"
              containerStyle={localStyles.inputContainerSm}
            />
            <Input
              label="Nombre del gasto *"
              value={nombreGasto}
              onChangeText={setNombreGasto}
              placeholder=""
              containerStyle={localStyles.inputContainerLg}
              leftIcon={<Icon name="tag-outline" size={16} color={colors.textMuted} />}
            />
          </View>

          <View style={localStyles.formGrid}>
            <View style={[localStyles.toggleRow, { flex: 1, minWidth: 150 }]}>
              <Text style={localStyles.toggleLabel}>Estado</Text>
              <View style={localStyles.chipRow}>
                {['pendiente', 'pagado'].map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[
                      localStyles.chip,
                      estado === e && localStyles.chipActive,
                    ]}
                    onPress={() => setEstado(e)}
                  >
                    <Text
                      style={[
                        localStyles.chipText,
                        estado === e && localStyles.chipTextActive,
                      ]}
                    >
                      {e}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[localStyles.toggleRow, { flex: 1, minWidth: 150 }]}>
              <Text style={localStyles.toggleLabel}>Método</Text>
              <View style={localStyles.chipRow}>
                {['efectivo', 'qr'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      localStyles.chip,
                      metodo === m && localStyles.chipActive,
                    ]}
                    onPress={() => setMetodo(m)}
                  >
                    <Icon
                      name={m === 'efectivo' ? 'cash' : 'qrcode'}
                      size={14}
                      color={metodo === m ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={[
                        localStyles.chipText,
                        metodo === m && localStyles.chipTextActive,
                      ]}
                    >
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
            leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
          />
          <Input
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            placeholder="Notas adicionales..."
          />

          {(formError || createError) ? (
            <View style={localStyles.inlineError}>
              <Icon name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={localStyles.inlineErrorText}>{formError || createError}</Text>
            </View>
          ) : null}

          {success && (
            <View style={localStyles.inlineSuccess}>
              <Icon name="check-circle-outline" size={14} color={colors.success} />
              <Text style={localStyles.inlineSuccessText}>Guardado correctamente</Text>
            </View>
          )}

          <View style={localStyles.formActions}>
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

      {/* ── Actions bar ── */}
      <View style={localStyles.actionsBar}>
        <Button
          title="Refrescar"
          icon="refresh"
          variant="ghost"
          size="sm"
          onPress={fetchDia}
          loading={loadingDia}
        />
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
        <Card padding="md" style={localStyles.cardMarginXl}>
          <View style={localStyles.formHeader}>
            <Icon name="calendar-range" size={20} color={colors.primary} />
            <Text style={localStyles.formTitle}>Filtrar por Calendario</Text>
          </View>
          <View style={localStyles.formGrid}>
            <Input
              label="Desde"
              value={from}
              onChangeText={setFrom}
              placeholder="2025-11-01"
              containerStyle={localStyles.dateInputContainer}
              leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
            />
            <Input
              label="Hasta"
              value={to}
              onChangeText={setTo}
              placeholder="2025-11-30"
              containerStyle={localStyles.dateInputContainer}
              leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
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
        <Card key={item.pagosId?.toString() || idx.toString()} padding="md" style={localStyles.cardMarginMd}>
          <View style={localStyles.itemHeader}>
            <View style={localStyles.flex1}>
              <Text style={localStyles.itemName}>{item.nombreGasto || 'Sin nombre'}</Text>
              <View style={localStyles.metaRow}>
                {item.fechaFactura && (
                  <View style={localStyles.metaItem}>
                    <Icon name="calendar-outline" size={12} color={colors.textMuted} />
                    <Text style={localStyles.metaText}>{item.fechaFactura}</Text>
                  </View>
                )}
                {item.metodo && (
                  <View style={localStyles.metaItem}>
                    <Icon name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'} size={12} color={colors.textMuted} />
                    <Text style={localStyles.metaText}>{item.metodo}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={localStyles.itemRight}>
              {item.total !== undefined && (
                <Text style={localStyles.itemTotal}>${formatCurrency(item.total)}</Text>
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
            <Text style={localStyles.itemDesc}>{item.descripcion}</Text>
          )}

          <View style={localStyles.itemActions}>
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
              style={localStyles.opacityMuted}
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

function makeLocalStyles(isMobile: boolean) {
  return StyleSheet.create({
    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    formTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    // En móvil los campos del form se apilan en columna
    formGrid: {
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: isMobile ? 'nowrap' : 'wrap',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    formActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    actionsBar: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xl,
      flexWrap: 'wrap',
    },
    toggleRow: {
      marginBottom: spacing.md,
    },
    toggleLabel: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.extrabold,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.bgLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      fontWeight: fontWeight.medium,
      textTransform: 'capitalize',
    },
    chipTextActive: {
      color: colors.primary,
      fontWeight: fontWeight.bold,
    },
    inlineError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
      padding: spacing.sm,
      backgroundColor: colors.dangerLight,
      borderRadius: radius.sm,
    },
    inlineErrorText: {
      color: colors.danger,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
    },
    inlineSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
      padding: spacing.sm,
      backgroundColor: colors.successLight,
      borderRadius: radius.sm,
    },
    inlineSuccessText: {
      color: colors.success,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
    },
    // List items
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    itemName: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    metaText: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    itemRight: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    itemTotal: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.extrabold,
      color: colors.primary,
    },
    itemDesc: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginBottom: spacing.sm,
      paddingLeft: spacing.sm,
      borderLeftWidth: 2,
      borderLeftColor: colors.divider,
    },
    itemActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    cardMarginXl: {
      marginBottom: spacing.xl,
    },
    inputContainerSm: {
      flex: 1,
      minWidth: 150,
    },
    inputContainerLg: {
      flex: 2,
      minWidth: 200,
    },
    dateInputContainer: {
      flex: 1,
      minWidth: 140,
    },
    cardMarginMd: {
      marginBottom: spacing.md,
    },
    flex1: {
      flex: 1,
    },
    opacityMuted: {
      opacity: 0.7,
    },
  });
}