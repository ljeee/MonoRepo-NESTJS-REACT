import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, TextInput as RNTextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text, TouchableOpacity, View } from '../../tw';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { useFacturasPagosScreen, todayISO, useApi } from '@/src/shared';
import type { CajaResumen, DenominacionesMap } from '@/src/shared';
import { formatCurrency } from '@/src/shared';
import { getLocalDateString } from '../../src/shared/utils/dateRange';
import { useBreakpoint } from '../../styles/responsive';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Icon from '../../components/ui/Icon';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import { BillCounter, COLOMBIAN_BILLS } from '../../components/ui/BillCounter';
import CajaMovimientosWidget from '../../components/ui/CajaMovimientosWidget';

export default function FacturasPagosScreen() {
  const { isMobile } = useBreakpoint();
  const api = useApi();

  // ── Arqueo Caja de Gastos (backend-driven) ──────────────────────────────────
  const dateKey = getLocalDateString();
  const EMPTY_BILLS = Object.fromEntries(COLOMBIAN_BILLS.map((b) => [String(b), 0])) as Record<string, number>;

  const [billCountsGastos, setBillCountsGastos] = useState<Record<string, number>>(EMPTY_BILLS);
  const [monedasGastos, setMonedasGastos]     = useState('');
  const [isArqueoCollapsed, setIsArqueoCollapsed] = useState(true);
  const [cajaResumenGastos, setCajaResumenGastos] = useState<CajaResumen | null>(null);
  const [confirmandoApertura, setConfirmandoApertura] = useState(false);
  const [aperturaError, setAperturaError] = useState<string | null>(null);

  // ── Historial de gastos ─────────────────────────────────────────────────────
  const GASTOS_PAGE_SIZE = 15;
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialPage, setHistorialPage] = useState(0);

  const aperturaConfirmada = (cajaResumenGastos?.movimientos ?? []).some((m) => m.tipo === 'apertura');
  const baseGastos = (cajaResumenGastos?.movimientos ?? [])
    .filter((m) => m.tipo === 'apertura')
    .reduce((sum, m) => sum + (Number(m.total) || 0), 0);

  const fetchCajaResumenGastos = useCallback(async () => {
    try {
      const r = await api.cajaDenominaciones.getResumen(undefined, 'gastos');
      setCajaResumenGastos(r);
    } catch (err) {
      console.error('[FacturasPagos] Error fetching caja gastos:', err);
      setCajaResumenGastos(null);
    }
  }, [api]);

  useEffect(() => { fetchCajaResumenGastos(); }, [fetchCajaResumenGastos]);
  useFocusEffect(useCallback(() => { fetchCajaResumenGastos(); }, [fetchCajaResumenGastos]));

  const handleConfirmarAperturaGastos = useCallback(async () => {
    setConfirmandoApertura(true);
    setAperturaError(null);
    try {
      const denomMap: DenominacionesMap = {};
      for (const [key, count] of Object.entries(billCountsGastos)) {
        if (count > 0) denomMap[key] = count;
      }
      const coinsVal = Number(monedasGastos) || 0;
      if (coinsVal > 0) denomMap['coins'] = coinsVal;
      if (Object.keys(denomMap).length === 0) {
        setAperturaError('Ingresa al menos un billete o monto en monedas.');
        return;
      }
      await api.cajaDenominaciones.apertura(denomMap, 'Apertura caja gastos', 'gastos');
      await fetchCajaResumenGastos();
      setIsArqueoCollapsed(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error al confirmar apertura';
      setAperturaError(typeof msg === 'string' ? msg : 'Error al confirmar apertura');
    } finally {
      setConfirmandoApertura(false);
    }
  }, [api, billCountsGastos, monedasGastos, fetchCajaResumenGastos]);

  const handleUpdateBillGastos = (bill: string, count: number) => {
    setBillCountsGastos((prev) => ({ ...prev, [bill]: count }));
  };

  const handleClearConteoGastos = () => {
    setBillCountsGastos(EMPTY_BILLS);
    setMonedasGastos('');
  };
  // ───────────────────────────────────────────────────────────────────────────

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
        title="Balance gastos"
        subtitle="Gestión de caja y facturas"
        icon="credit-card-minus-outline"
        rightContent={
          <View style={{ flexDirection: 'row', alignItems: 'center' }} className="gap-2">
            <Button
              title={isMobile ? "" : "Refrescar"}
              icon="refresh"
              variant="ghost"
              size="sm"
              onPress={fetchDia}
              loading={loadingDia}
            />
            <Button
              title={showForm ? (isMobile ? '' : 'Cerrar') : (isMobile ? '' : 'Nuevo Gasto')}
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

      {/* ── Arqueo Caja de Gastos ─────────────────────────────────────────── */}
      {(() => {
        // Gastos en efectivo del día = total salidas registradas en caja gastos
        const gastosEfectivo = cajaResumenGastos?.totalSalidas ?? 0;

        // Antes de apertura: conteo desde inputs locales. Después: estado vivo del backend.
        const conteoFisico = aperturaConfirmada
          ? (cajaResumenGastos?.totalEfectivo ?? 0)
          : COLOMBIAN_BILLS.reduce((sum, b) => sum + (billCountsGastos[String(b)] ?? 0) * b, 0) +
            (Number(monedasGastos) || 0);

        const efectivoEsperado = baseGastos - gastosEfectivo;

        // Note: the `diferencia` in gastos works exactly the same as in Ventas
        // You input the *current* physical count, it compares against what is expected.
        const diferencia = conteoFisico - efectivoEsperado;
        const diferenciaLabel = diferencia === 0
          ? 'Caja Cuadrada'
          : diferencia > 0
            ? `Sobrante: +$${formatCurrency(diferencia)}`
            : `Faltante: −$${formatCurrency(Math.abs(diferencia))}`;
        const diferenciaVariant: 'success' | 'warning' | 'danger' =
          diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'danger';

        return (
          <>
          <Card className="mb-6 overflow-hidden border border-white/5 bg-slate-900/60 p-6 rounded-[28px] shadow-xl">
            {/* Cabecera */}
            <View className="flex-row justify-between items-center mb-4 flex-wrap gap-2 border-b border-white/5 pb-4">
              <View className="flex-row items-center gap-2">
                <View className="w-10 h-10 rounded-2xl bg-orange-500/10 items-center justify-center border border-orange-500/20">
                  <Icon name="cash-register" size={20} color="#F5A524" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'Outfit', color: '#F8FAFC', fontSize: 16, fontWeight: 'bold' }}>
                    Control y Arqueo de Caja
                  </Text>
                  <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>
                    Gestión de efectivo para gastos: {dateKey}
                  </Text>
                </View>
              </View>

              {/* Estados de conciliación badges */}
              <View className="flex-row items-center gap-2 flex-wrap">
                <Badge
                  label={diferenciaLabel}
                  variant={diferenciaVariant}
                  icon={diferencia === 0 ? 'check-circle' : 'alert-circle'}
                  size="sm"
                />
              </View>
            </View>

            {/* Caja de Gastos */}
            <View className="mb-2">
              <View className="flex-row justify-between items-center mb-3 mt-1 flex-wrap gap-2">
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  Caja de Gastos Operativos
                </Text>
              </View>

              <View className="mb-4">
                {/* Efectivo Esperado en Caja (Gastos) */}
                <View className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 justify-between">
                  <View>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Efectivo Esperado en Caja (Gastos)
                    </Text>
                    <View className="flex-row items-center gap-1 mt-1 flex-wrap">
                      {aperturaConfirmada ? (
                        <>
                          <Text className="text-slate-500 text-[10px]">
                            Base Gastos: ${formatCurrency(baseGastos)}
                          </Text>
                          <Text className="text-slate-500 text-[10px]">•</Text>
                          <Text className="text-red-500 text-[10px]">
                            Gastos Ef.: -${formatCurrency(gastosEfectivo)}
                          </Text>
                        </>
                      ) : (
                        <Text className="text-slate-500 text-[10px]">
                          Realiza el arqueo para registrar la base.
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="mt-3 flex-row justify-between items-center">
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 24, color: aperturaConfirmada ? '#F8FAFC' : '#64748B', letterSpacing: -0.5 }}>
                      {aperturaConfirmada ? `$${formatCurrency(Math.abs(efectivoEsperado))}` : '$0'}
                      {aperturaConfirmada && efectivoEsperado < 0 ? ' ⚠' : ''}
                    </Text>
                    <View className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 items-center justify-center">
                      <Icon name={aperturaConfirmada ? 'calculator' : 'cash-lock'} size={16} color={aperturaConfirmada ? '#94A3B8' : '#64748B'} />
                    </View>
                  </View>
                </View>
              </View>

              {/* Acordeón Arqueo de Billetes (Gastos) */}
              <TouchableOpacity
                onPress={() => setIsArqueoCollapsed(!isArqueoCollapsed)}
                className="flex-row justify-between items-center bg-white/5 border border-white/5 rounded-2xl p-4 active:bg-white/10"
              >
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <Icon
                    name={aperturaConfirmada ? 'check-circle' : 'cash-multiple'}
                    size={20}
                    color={aperturaConfirmada ? '#10B981' : '#F5A524'}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: 'Outfit', color: aperturaConfirmada ? '#10B981' : '#E2E8F0', fontSize: 14, fontWeight: 'bold' }} numberOfLines={1} ellipsizeMode="tail">
                      Arqueo de Apertura (Gastos)
                    </Text>
                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11 }} numberOfLines={1} ellipsizeMode="tail">
                      {aperturaConfirmada
                        ? `Registrado — $${formatCurrency(conteoFisico)} en caja`
                        : `Pendiente — conteo actual: $${formatCurrency(conteoFisico)}`
                      }
                    </Text>
                  </View>
                </View>
                {!aperturaConfirmada && (
                  <View className="mr-2 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 9, textTransform: 'uppercase' }}>Requerido</Text>
                  </View>
                )}
                <Icon name={isArqueoCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color="#E2E8F0" />
              </TouchableOpacity>

              {/* Contenido desplegable (Gastos) */}
              {!isArqueoCollapsed && (
                aperturaConfirmada ? (
                  /* ── Live state: from backend cajaResumenGastos ── */
                  <View className="mt-2 bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl">
                    <View className="flex-row items-center gap-2 mb-4">
                      <Icon name="check-circle" size={16} color="#10B981" />
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Estado actual de caja (Gastos)
                      </Text>
                    </View>

                    <View className="gap-1.5">
                      {/* Billetes */}
                      {COLOMBIAN_BILLS.map((den) => {
                        const qty = cajaResumenGastos?.estadoActual?.[String(den)] ?? 0;
                        if (qty === 0) return null;
                        return (
                          <View key={den} className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03]">
                            <View className="flex-row items-center gap-2">
                              <View className="w-1.5 h-1.5 rounded-full bg-green-400" />
                              <Text className="text-sm text-slate-300 w-20">${formatCurrency(den)}</Text>
                            </View>
                            <View className="flex-row items-center gap-3">
                              <Text className="text-slate-500 text-xs">×{qty}</Text>
                              <Text className="text-sm text-emerald-400 font-bold w-24 text-right">${formatCurrency(qty * den)}</Text>
                            </View>
                          </View>
                        );
                      })}

                      {/* Monedas */}
                      {(cajaResumenGastos?.estadoActual?.['coins'] ?? 0) > 0 && (
                        <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                          <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            <Text className="text-sm text-slate-300 w-20">Monedas</Text>
                          </View>
                          <View className="flex-row items-center gap-3">
                            <Text className="text-slate-500 text-xs">total</Text>
                            <Text className="text-sm text-yellow-400 font-bold w-24 text-right">${formatCurrency(cajaResumenGastos!.estadoActual!['coins'])}</Text>
                          </View>
                        </View>
                      )}

                      {(!cajaResumenGastos?.estadoActual || Object.values(cajaResumenGastos.estadoActual).every(v => (v ?? 0) <= 0)) && (
                        <Text className="text-slate-600 text-xs text-center py-2">Sin denominaciones en caja</Text>
                      )}
                    </View>

                    <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-white/5 flex-wrap gap-2">
                      <View>
                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 12 }}>
                          Total en caja:{' '}
                          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981' }}>
                            ${formatCurrency(cajaResumenGastos?.totalEfectivo ?? 0)}
                          </Text>
                        </Text>
                        <Text style={{ fontFamily: 'Outfit', color: '#334155', fontSize: 10 }}>
                          Apertura: ${formatCurrency(baseGastos)} • Salidas: ${formatCurrency(cajaResumenGastos?.totalSalidas ?? 0)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setIsArqueoCollapsed(true)}
                        className="px-3 py-2 bg-white/5 active:bg-white/10 rounded-xl border border-white/10"
                      >
                        <Text className="uppercase text-[11px]" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8' }}>Cerrar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* ── Editable: fill counts and confirm apertura ── */
                  <View className="mt-2 bg-slate-800/20 border border-white/5 p-4 rounded-2xl">
                    <View className="flex-row items-center gap-2 mb-4">
                      <Icon name="cash-multiple" size={16} color="#F5A524" />
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Ingresa las cantidades de billetes (Conteo Físico)
                      </Text>
                    </View>
                    
                    <View className="flex-row flex-wrap gap-2.5">
                      {COLOMBIAN_BILLS.map((den) => {
                        const qty = billCountsGastos[String(den)] || 0;
                        const subtotal = qty * den;
                        return (
                          <View key={den} className="w-[48%] md:w-[23%] bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                            <View className="flex-row justify-between items-center mb-1">
                              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 11 }}>${den >= 1000 ? `${den/1000}K` : den}</Text>
                              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 9 }}>x {den >= 1000 ? `${den/1000}k` : '1'}</Text>
                            </View>
                            <RNTextInput
                              className="text-white bg-white/5 border border-white/10 rounded-lg text-center font-bold text-sm h-8 p-0"
                              placeholder="0"
                              placeholderTextColor="#475569"
                              keyboardType="numeric"
                              value={qty ? qty.toString() : ''}
                              onChangeText={(val) => {
                                const v = Number(val.replace(/[^0-9]/g, '')) || 0;
                                handleUpdateBillGastos(String(den), v);
                              }}
                            />
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                              ${formatCurrency(subtotal)}
                            </Text>
                          </View>
                        );
                      })}

                      <View className="w-[48%] md:w-[23%] bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                        <View className="flex-row justify-between items-center mb-1">
                          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 11 }}>Monedas</Text>
                          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 9 }}>Monto total</Text>
                        </View>
                        <RNTextInput
                          className="text-white bg-white/5 border border-white/10 rounded-lg text-center font-bold text-sm h-8 p-0"
                          placeholder="0"
                          placeholderTextColor="#475569"
                          keyboardType="numeric"
                          value={monedasGastos}
                          onChangeText={(val) => setMonedasGastos(val.replace(/[^0-9]/g, ''))}
                        />
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                          ${formatCurrency(Number(monedasGastos) || 0)}
                        </Text>
                      </View>
                    </View>

                    {aperturaError && (
                      <View className="flex-row items-center gap-2 mt-3 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                        <Icon name="alert-circle-outline" size={14} color="#F43F5E" />
                        <Text style={{ fontFamily: 'Outfit', color: '#F87171', fontSize: 11, flex: 1 }}>{aperturaError}</Text>
                      </View>
                    )}
                    <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-white/5 flex-wrap gap-2">
                      <TouchableOpacity
                        onPress={handleClearConteoGastos}
                        className="flex-row items-center gap-1.5 px-3 py-2 bg-red-500/10 active:bg-red-500/20 rounded-xl border border-red-500/20"
                      >
                        <Icon name="trash-can-outline" size={14} color="#EF4444" />
                        <Text
                          className="uppercase text-[11px]"
                          style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444' }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          Limpiar
                        </Text>
                      </TouchableOpacity>

                      <View className="flex-row items-center gap-3 flex-wrap">
                        <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 }}>
                          Arqueado: <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC' }}>${formatCurrency(conteoFisico)}</Text>
                        </Text>
                        <Button
                          title={confirmandoApertura ? 'Confirmando...' : 'Confirmar Apertura'}
                          icon="check-circle-outline"
                          variant="primary"
                          size="sm"
                          onPress={handleConfirmarAperturaGastos}
                          loading={confirmandoApertura}
                          disabled={confirmandoApertura || conteoFisico === 0}
                        />
                      </View>
                    </View>
                  </View>
                )
              )}
            </View>
          </Card>

          {/* ── Widget de Movimientos de Caja Gastos ───────────────────── */}
          <CajaMovimientosWidget
            cajaResumen={cajaResumenGastos}
            onRefresh={fetchCajaResumenGastos}
            cajaOrigen="gastos"
            title="Movimientos de Caja Gastos"
          />
        </>
        );
      })()}
      {/* ── / Arqueo ─────────────────────────────────────────────────────── */}

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

          {/* Denominaciones — solo efectivo, no edición */}
          {metodo === 'efectivo' && !editingId && (
            <View className="mb-4 p-3 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-1.5 h-4 bg-amber-500 rounded-full" />
                <Text className="text-amber-300 text-xs font-black uppercase tracking-widest">Billetes entregados *</Text>
              </View>
              <View className="gap-1.5">
                {COLOMBIAN_BILLS.map((bill) => (
                  <BillCounter
                    key={bill}
                    bill={bill}
                    count={denominaciones[String(bill)] ?? 0}
                    onChange={(newCount) =>
                      setDenominaciones({ ...denominaciones, [String(bill)]: newCount })
                    }
                    // null = stock aún no cargado (o fetch fallido) → sin límite ni badge
                    // number = stock conocido → mostrar badge y limitar
                    enCaja={disponibleDenominaciones !== null ? (disponibleDenominaciones[String(bill)] ?? 0) : undefined}
                    limitByStock={disponibleDenominaciones !== null}
                    variant="expense"
                  />
                ))}
              </View>
              {/* Monedas — total en un solo campo */}
              <View className="mt-3 flex-row items-center gap-3">
                <Icon name="cash" size={14} color="#F5A524" />
                <Text className="text-amber-300 text-xs font-black uppercase tracking-widest flex-1">
                  Monedas (total)
                </Text>
                <Input
                  value={monedas}
                  onChangeText={setMonedas}
                  keyboardType="numeric"
                  placeholder="$0"
                  containerStyle={{ width: 130 }}
                />
              </View>
            </View>
          )}

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

      {/* ── Historial de Gastos (colapsado + paginado) ── */}
      {!displayLoading && !displayError && (() => {
        const totalPages = Math.ceil(displayData.length / GASTOS_PAGE_SIZE);
        const visibleData = showHistorial
          ? displayData.slice(historialPage * GASTOS_PAGE_SIZE, (historialPage + 1) * GASTOS_PAGE_SIZE)
          : [];
        const totalGastosImporte = displayData.reduce((s, g) => s + (Number(g.total) || 0), 0);

        return (
          <Card className="mb-12 p-5 border border-white/5 bg-slate-900/60 rounded-[28px]">
            {/* Resumen */}
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-2xl bg-red-500/10 items-center justify-center border border-red-500/20">
                  <Icon name="cash-remove" size={20} color="#EF4444" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15 }}>
                    Historial de Gastos
                  </Text>
                  <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>
                    {displayData.length} registro{displayData.length !== 1 ? 's' : ''}{showRangeFilter ? ' en rango' : ' hoy'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 18 }}>
                −${formatCurrency(totalGastosImporte)}
              </Text>
            </View>

            {/* Botón ver/ocultar */}
            {displayData.length > 0 ? (
              <TouchableOpacity
                className="mt-4 p-3 bg-white/5 border border-white/10 rounded-xl flex-row items-center justify-between active:bg-white/10"
                onPress={() => { setShowHistorial(v => !v); setHistorialPage(0); }}
              >
                <View className="flex-row items-center gap-2">
                  <Icon name="history" size={16} color="#94A3B8" />
                  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase' }}>
                    {showHistorial ? 'Ocultar historial' : `Ver historial (${displayData.length} gastos)`}
                  </Text>
                </View>
                <Icon name={showHistorial ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
              </TouchableOpacity>
            ) : (
              <View className="mt-4 p-4 items-center">
                <Icon name="cash-remove" size={36} color="#1E293B" />
                <Text style={{ fontFamily: 'Outfit', color: '#334155', fontSize: 12, marginTop: 8 }}>
                  {showRangeFilter ? 'Sin gastos en el rango seleccionado' : 'Sin gastos registrados hoy'}
                </Text>
              </View>
            )}

            {/* Lista paginada */}
            {showHistorial && (
              <>
                <View className="gap-3 mt-3">
                  {visibleData.map((item, idx) => (
                    <Card key={item.pagosId?.toString() || idx.toString()} padding="md" className="bg-white/[0.02] border border-white/5 rounded-[20px]">
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-1">
                          <Text className="text-base font-bold text-white mb-1">{item.nombreGasto || 'Sin nombre'}</Text>
                          <View className="flex-row gap-4">
                            {item.fechaFactura && (
                              <View className="flex-row items-center gap-1.5">
                                <Icon name="calendar-outline" size={11} color="#64748B" />
                                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10 }}>{item.fechaFactura}</Text>
                              </View>
                            )}
                            {item.metodo && (
                              <View className="flex-row items-center gap-1.5">
                                <Icon name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'} size={11} color="#64748B" />
                                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>{item.metodo}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View className="items-end gap-1.5">
                          {item.total !== undefined && (
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 16 }}>
                              −${formatCurrency(item.total)}
                            </Text>
                          )}
                          {item.estado && (
                            <Badge label={item.estado} variant={item.estado === 'pagado' ? 'success' : 'warning'} size="sm" />
                          )}
                        </View>
                      </View>
                      {item.descripcion && (
                        <Text className="text-xs text-slate-400 italic mb-3 pl-3 border-l-2 border-slate-700">{item.descripcion}</Text>
                      )}
                      <View className="flex-row justify-end gap-2 pt-3 border-t border-white/5">
                        <Button title="Editar" icon="pencil-outline" variant="ghost" size="sm" onPress={() => onEdit(item)} disabled={deleting} />
                        <Button title="Eliminar" icon="trash-can-outline" variant="ghost" size="sm" onPress={() => setDeleteTarget({ id: item.pagosId!, name: item.nombreGasto || 'gasto' })} disabled={deleting} className="opacity-70" />
                      </View>
                    </Card>
                  ))}
                </View>

                {/* Paginación */}
                {totalPages > 1 && (
                  <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <TouchableOpacity
                      onPress={() => setHistorialPage(p => Math.max(0, p - 1))}
                      disabled={historialPage === 0}
                      className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${historialPage === 0 ? 'border-white/5 opacity-30' : 'border-white/10 bg-white/5 active:bg-white/10'}`}
                    >
                      <Icon name="chevron-left" size={16} color="#94A3B8" />
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 11 }}>Anterior</Text>
                    </TouchableOpacity>
                    <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>
                      Pág. <Text style={{ color: '#94A3B8', fontWeight: 'bold' }}>{historialPage + 1}</Text> / {totalPages}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setHistorialPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={historialPage >= totalPages - 1}
                      className={`flex-row items-center gap-1 px-3 py-2 rounded-xl border ${historialPage >= totalPages - 1 ? 'border-white/5 opacity-30' : 'border-white/10 bg-white/5 active:bg-white/10'}`}
                    >
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 11 }}>Siguiente</Text>
                      <Icon name="chevron-right" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </Card>
        );
      })()}

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
