import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect } from 'expo-router';
import { Text, TouchableOpacity, View } from '../../tw';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { useFacturasPagosScreen, todayISO, useApi } from '@/src/shared';
import type { CajaResumen, DenominacionesMap } from '@/src/shared';
import { formatCurrency, sumDenominaciones, CATEGORIAS_GASTO, TIPO_GASTO_META, nombreCategoria, tipoDeGasto } from '@/src/shared';
import { ChipGroup, DateRangeFilter, CardGrid } from '../../components/ui';
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
import { Paginator } from '../../components/ui/Paginator';
import { ArqueoSwitch } from '../../components/ui/ArqueoSwitch';
import { useArqueoActivo, aperturaVigente } from '../../hooks/use-arqueo';
import { useCuentasTransferencia } from '../../hooks/use-cuentas-transferencia';
import { BILLETES_COP } from '@/src/shared';
import { DenominacionCounter } from '../../components/ui/DenominacionCounter';
import { ConteoCajaGrid, EstadoCajaLista } from '../../components/ui/ConteoCaja';
import CajaMovimientosWidget from '../../components/ui/CajaMovimientosWidget';
import { PosRefreshControl } from '../../components/ui/PosRefreshControl';
import { GastoCard } from '../../components/facturas/GastoCard';

export default function FacturasPagosScreen() {
  const { isMobile } = useBreakpoint();
  const api = useApi();

  // ── Arqueo Caja de Gastos (backend-driven) ──────────────────────────────────
  const dateKey = getLocalDateString();
  const EMPTY_BILLS = Object.fromEntries(BILLETES_COP.map((b) => [String(b), 0])) as Record<string, number>;

  const [billCountsGastos, setBillCountsGastos] = useState<Record<string, number>>(EMPTY_BILLS);
  const [monedasGastos, setMonedasGastos]     = useState('');
  const [isArqueoCollapsed, setIsArqueoCollapsed] = useState(true);
  const [cajaResumenGastos, setCajaResumenGastos] = useState<CajaResumen | null>(null);
  const [confirmandoApertura, setConfirmandoApertura] = useState(false);
  const [aperturaError, setAperturaError] = useState<string | null>(null);
  const { arqueoActivo, arqueoDesde } = useArqueoActivo();
  const [reArqueando, setReArqueando] = useState(false);

  // ── Historial de gastos ─────────────────────────────────────────────────────
  const GASTOS_PAGE_SIZE = 15;
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialPage, setHistorialPage] = useState(0);

  // Cuenta como arqueada solo con un conteo posterior al último encendido del arqueo.
  const aperturaConfirmada = !!aperturaVigente(cajaResumenGastos?.movimientos, arqueoDesde);
  // Recién reactivado y sin conteo nuevo: abrir el formulario para que se cuente a mano.
  const conteoPendientePorReactivacion = arqueoActivo && !!arqueoDesde && !aperturaConfirmada && cajaResumenGastos !== null;
  useEffect(() => {
    if (conteoPendientePorReactivacion) setIsArqueoCollapsed(false);
  }, [conteoPendientePorReactivacion]);
  // El saldo parte del ÚLTIMO arqueo del día (igual que el backend): un conteo nuevo reemplaza al anterior.
  const movimientosGastos = cajaResumenGastos?.movimientos ?? [];
  const idxUltimoArqueo = movimientosGastos.map((m) => m.tipo).lastIndexOf('apertura');
  const desdeArqueo = idxUltimoArqueo >= 0 ? movimientosGastos.slice(idxUltimoArqueo) : movimientosGastos;
  const baseGastos = idxUltimoArqueo >= 0 ? Number(movimientosGastos[idxUltimoArqueo].total) || 0 : 0;
  const salidasDesdeArqueo = desdeArqueo.filter((m) => m.tipo === 'salida').reduce((sum, m) => sum + (Number(m.total) || 0), 0);

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
      await api.cajaDenominaciones.apertura(denomMap, aperturaConfirmada ? 'Arqueo caja gastos (nuevo conteo)' : 'Apertura caja gastos', 'gastos');
      await fetchCajaResumenGastos();
      setReArqueando(false);
      setIsArqueoCollapsed(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error al confirmar apertura';
      setAperturaError(typeof msg === 'string' ? msg : 'Error al confirmar apertura');
    } finally {
      setConfirmandoApertura(false);
    }
  }, [api, billCountsGastos, monedasGastos, fetchCajaResumenGastos, aperturaConfirmada]);

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
    displayData,
    displayLoading,
    displayError,
  } = useFacturasPagosScreen();

  // Cuentas de las que puede salir un pago QR: las activas, más la que ya tenía un egreso en edición.
  const { cuentas: todasCuentas } = useCuentasTransferencia({ incluirInactivas: true });
  const cuentasOrigen = useMemo(() => todasCuentas.filter((c) => c.activa || c.id === cuentaOrigenId), [todasCuentas, cuentaOrigenId]);

  return (
    <PageContainer
      refreshControl={
        <PosRefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
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
        const gastosEfectivo = salidasDesdeArqueo;

        // Antes de apertura: conteo desde inputs locales. Después: estado vivo del backend.
        const conteoFisico = aperturaConfirmada
          ? (cajaResumenGastos?.totalEfectivo ?? 0)
          : sumDenominaciones(billCountsGastos, monedasGastos);

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

        if (!arqueoActivo) {
          return (
            <Card className="mb-6 overflow-hidden border border-white/5 bg-slate-900/60 p-6 rounded-[28px]">
              <ArqueoSwitch />
              <View className="flex-row items-center gap-2 mb-1">
                <Icon name="cash-lock-open" size={18} color="#94A3B8" />
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Caja de gastos sin arqueo
                </Text>
              </View>
              <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>
                Los gastos en efectivo se registran sin contar billetes ni validar contra el conteo.
              </Text>
            </Card>
          );
        }

        return (
          <>
          <Card className="mb-6 overflow-hidden border border-white/5 bg-slate-900/60 p-6 rounded-[28px] shadow-xl">
            <ArqueoSwitch />
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
                      Arqueo de caja (Gastos)
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
                aperturaConfirmada && !reArqueando ? (
                  /* ── Live state: from backend cajaResumenGastos ── */
                  <View className="mt-2 bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl">
                    <View className="flex-row items-center gap-2 mb-4">
                      <Icon name="check-circle" size={16} color="#10B981" />
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Estado actual de caja (Gastos)
                      </Text>
                    </View>

                    <EstadoCajaLista estado={cajaResumenGastos?.estadoActual} />

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
                      <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => setReArqueando(true)}
                        className="px-3 py-2 bg-amber-500/10 active:bg-amber-500/20 rounded-xl border border-amber-500/25"
                      >
                        <Text className="uppercase text-[11px]" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524' }}>Nuevo arqueo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setIsArqueoCollapsed(true)}
                        className="px-3 py-2 bg-white/5 active:bg-white/10 rounded-xl border border-white/10"
                      >
                        <Text className="uppercase text-[11px]" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8' }}>Cerrar</Text>
                      </TouchableOpacity>
                    </View>
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
                    
                    <ConteoCajaGrid
                      value={{ ...billCountsGastos, coins: Number(monedasGastos) || 0 }}
                      onChangeValue={(clave, cantidad) =>
                        clave === 'coins' ? setMonedasGastos(cantidad ? String(cantidad) : '') : handleUpdateBillGastos(clave, cantidad)
                      }
                    />

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
                        {reArqueando && (
                          <TouchableOpacity onPress={() => setReArqueando(false)} className="px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                            <Text className="uppercase text-[11px]" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8' }}>Cancelar</Text>
                          </TouchableOpacity>
                        )}
                        <Button
                          title={confirmandoApertura ? 'Confirmando...' : aperturaConfirmada ? 'Confirmar nuevo arqueo' : 'Confirmar arqueo'}
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
              <View className="flex-row flex-wrap gap-2">
                {([
                  { id: 'efectivo',        label: 'Efectivo',       icon: 'cash'               },
                  { id: 'qr',              label: 'QR',             icon: 'qrcode'             },
                  { id: 'efectivo_no_caja', label: 'Ef. No Caja',  icon: 'cash-off'           },
                ] as { id: string; label: string; icon: string }[]).map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    className={`flex-row items-center gap-2 py-2.5 px-5 rounded-full border ${metodo === m.id ? 'bg-amber-500/10 border-amber-500/20' : 'bg-black/20 border-white/5'}`}
                    onPress={() => setMetodo(m.id)}
                  >
                    <Icon
                      name={m.icon}
                      size={16}
                      color={metodo === m.id ? '#F5A524' : '#64748B'}
                    />
                    <Text className={`text-sm tracking-tight ${metodo === m.id ? 'text-amber-500 font-black' : 'text-slate-500 font-bold'}`}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {metodo === 'qr' && (
                <View className="mt-4">
                  <Text className="text-[10px] font-black text-slate-400 mb-3 ml-1 uppercase tracking-widest">Sale de la cuenta *</Text>
                  <ChipGroup
                    options={cuentasOrigen.map((c) => ({ value: c.id, label: c.activa ? c.nombre : `${c.nombre} (inactiva)`, icon: 'bank-outline' as const }))}
                    value={cuentaOrigenId}
                    onChange={(v) => setCuentaOrigenId(v ?? null)}
                    color="#A78BFA"
                  />
                  {cuentasOrigen.length === 0 && (
                    <Text className="text-[10px] text-red-400 mt-2 ml-1">No hay cuentas de transferencia activas: créalas en Ajustes del negocio.</Text>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Clasificación contable: costo vs gasto operativo, y categoría (nómina, servicios, insumos…) */}
          <View className="mb-6">
            <Text className="text-[10px] font-black text-slate-400 mb-3 ml-1 uppercase tracking-widest">Tipo de egreso *</Text>
            <ChipGroup
              size="md"
              options={[
                { value: 'costo', label: 'Costo', icon: 'package-variant-closed' as const },
                { value: 'gasto', label: 'Gasto operativo', icon: 'domain' as const },
              ]}
              value={tipoGasto}
              onChange={(v) => v && setTipoGasto(v as 'costo' | 'gasto')}
              color={tipoGasto ? TIPO_GASTO_META[tipoGasto].color : '#F5A524'}
            />
            <Text className="text-[10px] text-slate-500 mt-2 ml-1">
              {tipoGasto ? TIPO_GASTO_META[tipoGasto].descripcion : 'Costo = lo que cuesta producir lo que se vende. Gasto = lo que cuesta operar el negocio.'}
            </Text>
            <Text className="text-[10px] font-black text-slate-400 mt-5 mb-3 ml-1 uppercase tracking-widest">Categoría *</Text>
            <ChipGroup
              options={CATEGORIAS_GASTO.map((c) => ({ value: c.id, label: c.corto, icon: c.icon as any }))}
              value={categoria === 'general' ? null : categoria}
              onChange={(v) => v && setCategoria(v)}
              color="#F5A524"
            />
          </View>

          {/* Denominaciones — solo efectivo (de caja), no edición */}
          {metodo === 'efectivo' && !editingId && (
            <View className="mb-4 p-3 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-1.5 h-4 bg-amber-500 rounded-full" />
                <Text className="text-amber-300 text-xs font-black uppercase tracking-widest">Billetes entregados *</Text>
              </View>
              <DenominacionCounter
                value={denominaciones}
                onChange={setDenominaciones}
                // null = stock aún no cargado (o fetch fallido) → sin límite ni badge
                // mapa = stock conocido → mostrar badge y limitar
                disponible={disponibleDenominaciones}
                limitarPorDisponible
                variant="expense"
              />
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
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onSearch={(f, t) => {
            setFrom(f);
            setTo(t);
            fetchRango(f, t);
          }}
          loading={loadingRango}
        />
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
                <View className="mt-3">
                  <CardGrid
                    kind="panel"
                    data={visibleData}
                    keyExtractor={(item, i) => item.pagosId?.toString() ?? String(i)}
                    renderItem={(item) => (
                      <GastoCard
                        gasto={item}
                        nombreCuenta={item.cuentaOrigenId != null ? todasCuentas.find((c) => c.id === item.cuentaOrigenId)?.nombre : undefined}
                        onEdit={onEdit}
                        onDelete={(g) => setDeleteTarget({ id: g.pagosId!, name: g.nombreGasto || 'gasto' })}
                        disabled={deleting}
                      />
                    )}
                  />
                </View>

                {/* Paginación */}
                {totalPages > 1 && (
                  <Paginator page={historialPage + 1} totalPages={totalPages} onChange={(p) => setHistorialPage(p - 1)} />
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
