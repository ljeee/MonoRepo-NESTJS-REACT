import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFacturaActions } from '../../hooks/use-factura-actions';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFacturasDia, useFacturasPagosDia, useApi, useOrdenesSocket, bogotaToday, sumDenominaciones } from '@/src/shared';
import { useResumenGeneral } from '../../hooks/use-resumen-general';
import { ResumenDiaCompleto } from '../../components/contabilidad/ResumenDiaCompleto';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import type { CajaResumen, DenominacionesMap } from '@/src/shared';
import { formatCurrency } from '@/src/shared';
import { ConteoCajaGrid, EstadoCajaLista } from '../../components/ui/ConteoCaja';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, TouchableOpacity, TextInput } from '../../tw';
import { getLocalDateString } from '../../src/shared/utils/dateRange';

import { FacturaCard, FacturaItem } from '../../components/facturas/FacturaShared';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import CajaMovimientosWidget from '../../components/ui/CajaMovimientosWidget';
import { MethodFilterChips, MethodFilterValue, matchesMetodoFilter, SearchInput, ArqueoSwitch, InlineError, CardGrid } from '../../components/ui';
import { useArqueoActivo, aperturaVigente } from '../../hooks/use-arqueo';
import { useAuth } from '../../contexts/AuthContext';
import { getBaseUrl } from '../../services/api';
import { PosRefreshControl } from '../../components/ui/PosRefreshControl';

// ─── Caja sin arqueo ───────────────────────────────────────────────────────────

/** Con el arqueo apagado: se cobra y se da cambio sin desglosar; aquí solo el efectivo del día. */
function SinArqueo({ efectivoVentas, gastosEfectivo }: { efectivoVentas: number; gastosEfectivo: number }) {
    const neto = efectivoVentas - gastosEfectivo;
    return (
        <View className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 mb-2">
            <View className="flex-row items-center gap-2 mb-3">
                <Icon name="cash-lock-open" size={18} color="#94A3B8" />
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Caja sin arqueo
                </Text>
            </View>
            <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11, marginBottom: 12 }}>
                Los cobros en efectivo no piden desglosar el cambio. Al cobrar verás cuánto entró y cuánto devolver.
            </Text>
            <View className="flex-row justify-between items-end">
                <View>
                    <Text className="text-emerald-500 text-[10px]">Cobrado en efectivo: ${formatCurrency(efectivoVentas)}</Text>
                    <Text className="text-red-400 text-[10px]">Gastos en efectivo: −${formatCurrency(gastosEfectivo)}</Text>
                </View>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 24, color: '#F8FAFC', letterSpacing: -0.5 }}>
                    ${formatCurrency(neto)}
                </Text>
            </View>
        </View>
    );
}

// ─── Métodos de Pago Card ─────────────────────────────────────────────────────

function MetodosPagoCard({
    efectivoVentas,
    qrVentas,
    gastosEfectivo,
    gastosQr,
    qrPorCuenta = {},
}: {
    efectivoVentas: number;
    qrVentas: number;
    gastosEfectivo: number;
    gastosQr: number;
    qrPorCuenta?: Record<string, number>;
}) {
    const { isMobile } = useBreakpoint();
    const netoEfectivo = efectivoVentas - gastosEfectivo;
    const netoQr = qrVentas - gastosQr;
    const cuentasList = Object.entries(qrPorCuenta);

    return (
        <Card className="mb-4 overflow-hidden border-0 p-0 bg-transparent rounded-[32px]">
            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                {/* ── Efectivo ── */}
                <View
                    style={{
                        flex: isMobile ? undefined : 1,
                        backgroundColor: '#0F172A',
                        borderRadius: 28,
                        borderWidth: 1,
                        borderColor: 'rgba(16,185,129,0.18)',
                        padding: 20,
                        gap: 14,
                    }}
                >
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <View
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                backgroundColor: 'rgba(16,185,129,0.1)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(16,185,129,0.2)',
                            }}
                        >
                            <Icon name="cash-multiple" size={18} color="#10B981" />
                        </View>
                        <View>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Efectivo
                            </Text>
                            <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                del día
                            </Text>
                        </View>
                    </View>

                    {/* Ventas */}
                    <View>
                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                            Ventas
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 20, letterSpacing: -0.5 }}>
                            ${formatCurrency(efectivoVentas)}
                        </Text>
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                    {/* Gastos */}
                    <View>
                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                            Gastos
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 16 }}>
                            −${formatCurrency(gastosEfectivo)}
                        </Text>
                    </View>

                    {/* Neto */}
                    <View
                        style={{
                            backgroundColor: netoEfectivo >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            borderRadius: 14,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: netoEfectivo >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        }}
                    >
                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                            Neto efectivo
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: netoEfectivo >= 0 ? '#10B981' : '#EF4444', fontSize: 18, letterSpacing: -0.5 }}>
                            ${formatCurrency(Math.abs(netoEfectivo))}
                        </Text>
                    </View>
                </View>

                {/* ── QR / Transferencia ── */}
                <View
                    style={{
                        flex: isMobile ? undefined : 1,
                        backgroundColor: '#0F172A',
                        borderRadius: 28,
                        borderWidth: 1,
                        borderColor: 'rgba(96,165,250,0.18)',
                        padding: 20,
                        gap: 14,
                    }}
                >
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <View
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                backgroundColor: 'rgba(96,165,250,0.1)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(96,165,250,0.2)',
                            }}
                        >
                            <Icon name="qrcode-scan" size={18} color="#60A5FA" />
                        </View>
                        <View>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#60A5FA', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                                QR / Transfer
                            </Text>
                            <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                del día
                            </Text>
                        </View>
                    </View>

                    {/* Ventas */}
                    <View>
                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                            Ventas
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 20, letterSpacing: -0.5 }}>
                            ${formatCurrency(qrVentas)}
                        </Text>
                        {cuentasList.length > 0 && (
                            <View style={{ marginTop: 6, gap: 2 }}>
                                {cuentasList.map(([cuenta, monto]) => (
                                    <View key={cuenta} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontFamily: 'Outfit', color: '#A78BFA', fontSize: 10, fontWeight: '600' }}>
                                            {cuenta}
                                        </Text>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#CBD5E1', fontSize: 11 }}>
                                            ${formatCurrency(monto)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                    {/* Gastos */}
                    <View>
                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                            Gastos
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 16 }}>
                            −${formatCurrency(gastosQr)}
                        </Text>
                    </View>

                    {/* Neto */}
                    <View
                        style={{
                            backgroundColor: netoQr >= 0 ? 'rgba(96,165,250,0.08)' : 'rgba(239,68,68,0.08)',
                            borderRadius: 14,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: netoQr >= 0 ? 'rgba(96,165,250,0.2)' : 'rgba(239,68,68,0.2)',
                        }}
                    >
                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                            Neto digital
                        </Text>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: netoQr >= 0 ? '#60A5FA' : '#EF4444', fontSize: 18, letterSpacing: -0.5 }}>
                            ${formatCurrency(Math.abs(netoQr))}
                        </Text>
                    </View>
                </View>
            </View>
        </Card>
    );
}


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BalanceDiaScreen() {
    const { isMobile } = useBreakpoint();

    const {
        data: facturas,
        loading: loadingFacturas,
        error: errorFacturas,
        refetch: refetchFacturas,
        stats,
        updateEstado,
        updateFactura,
    } = useFacturasDia();

    const {
        data: gastos,
        loading: loadingGastos,
        fetchData: fetchGastos,
    } = useFacturasPagosDia();

    const [refreshing, setRefreshing] = useState(false);

    // Totales del día desde el servidor (mismas definiciones que todas las pantallas).
    // Se recarga cada vez que cambian las facturas o los gastos cargados.
    const hoy = bogotaToday();
    const [versionResumen, setVersionResumen] = useState(0);
    const { data: resumen } = useResumenGeneral(hoy, hoy, versionResumen);
    const primeraCarga = useRef(true);
    useEffect(() => {
        if (primeraCarga.current) {
            primeraCarga.current = false;
            return;
        }
        setVersionResumen((v) => v + 1);
    }, [facturas, gastos]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMethod, setFilterMethod] = useState<MethodFilterValue>('todos');

    // --- ESTADO DE BASE DE CAJA Y ARQUEO ---
    const dateKey = getLocalDateString();

    const [isArqueoCollapsed, setIsArqueoCollapsed] = useState<boolean>(true);

    const DEFAULT_BILL_COUNTS = {
        '200000': 0,
        '100000': 0,
        '50000': 0,
        '20000': 0,
        '10000': 0,
        '5000': 0,
        '2000': 0,
        'coins': 0,
    };
    const [billCounts, setBillCounts] = useState<Record<string, number>>(DEFAULT_BILL_COUNTS);

    // Load from storage on mount/dateKey change
    useEffect(() => {
        const loadPersistedData = async () => {
            try {
                const storedCounts = await AsyncStorage.getItem(`@conteo_billetes_${dateKey}`);
                if (storedCounts !== null) {
                    setBillCounts(JSON.parse(storedCounts));
                } else {
                    setBillCounts(DEFAULT_BILL_COUNTS);
                }
            } catch (err) {
                console.error('Error loading finance metrics from AsyncStorage:', err);
            }
        };

        loadPersistedData();
    }, [dateKey]);

    const handleUpdateBillCount = async (denomination: string, countText: string) => {
        const cleanText = countText.replace(/[^0-9]/g, '');
        const value = Number(cleanText) || 0;
        const updated = {
            ...billCounts,
            [denomination]: value
        };
        setBillCounts(updated);
        try {
            await AsyncStorage.setItem(`@conteo_billetes_${dateKey}`, JSON.stringify(updated));
        } catch (err) {
            console.error('Error saving bill counts to AsyncStorage:', err);
        }
    };

    const handleClearConteo = async () => {
        setBillCounts(DEFAULT_BILL_COUNTS);
        try {
            await AsyncStorage.setItem(`@conteo_billetes_${dateKey}`, JSON.stringify(DEFAULT_BILL_COUNTS));
        } catch (err) {
            console.error('Error clearing bill counts in AsyncStorage:', err);
        }
    };

    const api = useApi();
    const [cajaResumen, setCajaResumen] = useState<CajaResumen | null>(null);
    const [confirmandoApertura, setConfirmandoApertura] = useState(false);
    const [aperturaError, setAperturaError] = useState<string | null>(null);

    // Arqueo opcional: lo enciende/apaga el admin. Apagado = se cobra sin bloqueos ni desglose de cambio.
    const { arqueoActivo, arqueoDesde } = useArqueoActivo();
    // Hay arqueo cuando existe un movimiento "apertura" posterior al último encendido del arqueo (antes
    // bastaba cualquier entrada). Si el admin lo apagó y lo volvió a encender, hay que contar de nuevo.
    const aperturaVigenteHoy = aperturaVigente(cajaResumen?.movimientos, arqueoDesde);
    const aperturaHecha = !!aperturaVigenteHoy;
    // Recién reactivado y sin conteo nuevo: abrir el formulario para que se cuente a mano.
    const conteoPendientePorReactivacion = arqueoActivo && !!arqueoDesde && !aperturaHecha && cajaResumen !== null;
    useEffect(() => {
        if (conteoPendientePorReactivacion) setIsArqueoCollapsed(false);
    }, [conteoPendientePorReactivacion]);
    // Volver a contar la caja aunque ya haya un arqueo (p. ej. el admin se va y la deja arqueada).
    const [reArqueando, setReArqueando] = useState(false);

    const fetchCajaResumen = useCallback(async () => {
        try {
            const r = await api.cajaDenominaciones.getResumen();
            setCajaResumen(r);
        } catch {
            setCajaResumen(null);
        }
    }, [api]);

    useEffect(() => { fetchGastos(); fetchCajaResumen(); }, [fetchGastos, fetchCajaResumen]);

    // Refresh caja resumen every time the screen comes into focus
    useFocusEffect(useCallback(() => { fetchCajaResumen(); }, [fetchCajaResumen]));

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setVersionResumen((v) => v + 1);
        await Promise.all([refetchFacturas(), fetchGastos(), fetchCajaResumen()]);
        setRefreshing(false);
    }, [refetchFacturas, fetchGastos, fetchCajaResumen]);

    // Sin esto la pantalla solo se actualizaba con refresh manual: un abono o
    // cobro hecho desde otra pantalla/dispositivo no se reflejaba aquí.
    const { user, token } = useAuth();
    useOrdenesSocket(getBaseUrl(), user?.roles?.[0] || 'cajero', handleRefresh, token);

    /** Confirms the arqueo by sending current billCounts to the backend as apertura */
    const handleConfirmarApertura = useCallback(async () => {
        setConfirmandoApertura(true);
        setAperturaError(null);
        try {
            const denomMap: DenominacionesMap = {};
            for (const [key, count] of Object.entries(billCounts)) {
                if (count > 0) denomMap[key] = count;
            }
            if (Object.keys(denomMap).length === 0) {
                setAperturaError('Ingresa al menos un billete o monto en monedas.');
                return;
            }
            await api.cajaDenominaciones.apertura(denomMap, aperturaHecha ? 'Arqueo de caja (nuevo conteo)' : 'Apertura de caja');
            await fetchCajaResumen();
            setReArqueando(false);
            setIsArqueoCollapsed(true);
        } catch (err: any) {
            console.error('[BalanceDia] Error en apertura:', err);
            const msg = err?.response?.data?.message ?? err?.message ?? 'Error al confirmar apertura';
            setAperturaError(typeof msg === 'string' ? msg : 'Error al confirmar apertura');
        } finally {
            setConfirmandoApertura(false);
        }
    }, [api, billCounts, fetchCajaResumen, aperturaHecha]);

    const { updatingId, accionesFactura, onUpdate } = useFacturaActions({
        updateEstado,
        updateFactura,
        recargar: () => Promise.all([refetchFacturas(), fetchCajaResumen()]),
    });

    // Cobrado por método y gastos por método: definiciones únicas del servidor (incluyen
    // abonos parciales y excluyen anuladas; antes solo se contaban facturas pagadas).
    const efectivoVentas = resumen?.ventas.cobradoPorMetodo.efectivo ?? 0;
    const qrVentas = resumen?.ventas.cobradoPorMetodo.transferencia ?? 0;
    const qrPorCuenta = Object.fromEntries((resumen?.ventas.porCuenta ?? []).map((c) => [c.cuenta, c.monto]));
    const gastoPorMetodo = (...metodos: string[]) =>
        (resumen?.gastos.porMetodo ?? []).filter((g) => metodos.includes(g.metodo)).reduce((t, g) => t + g.pagados, 0); // solo PAGADOS: un gasto pendiente no ha movido caja ni cuenta
    const gastosEfectivo = gastoPorMetodo('efectivo');
    const gastosQr = gastoPorMetodo('qr', 'transferencia');

    // El saldo parte del ÚLTIMO arqueo del día (igual que el backend): un conteo nuevo reemplaza
    // al anterior, lo cobrado antes ya está dentro de él.
    const totalApertura = Number(aperturaVigenteHoy?.total) || 0;

    // Fuente de verdad: el neto de movimientos físicos en caja principal.
    // Fallback a la fórmula derivada de facturas si aún no llegó el resumen.
    const efectivoEsperado = cajaResumen?.totalEfectivo
        ?? (aperturaHecha ? totalApertura + efectivoVentas : efectivoVentas);

    // Lo que se movió en caja desde el último arqueo (cobros, cambio, gastos, ajustes).
    const movimientosDesdeArqueo = (cajaResumen?.totalEfectivo ?? 0) - totalApertura;

    const conteoFisico = sumDenominaciones(billCounts);

    const diferencia = conteoFisico - efectivoEsperado;

    const loading = loadingFacturas || loadingGastos;

    const noPendiente = (f: FacturaItem) => f.estado !== 'pendiente' && f.estado !== 'parcial';
    const searchFilteredFacturas = facturas.filter((f: FacturaItem) =>
        !searchQuery || (f.clienteNombre && f.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const methodCounts = {
        todos:         searchFilteredFacturas.length,
        efectivo:      searchFilteredFacturas.filter((f: FacturaItem) => matchesMetodoFilter(f, 'efectivo') && noPendiente(f)).length,
        transferencia: searchFilteredFacturas.filter((f: FacturaItem) => matchesMetodoFilter(f, 'transferencia') && noPendiente(f)).length,
        mixto:         searchFilteredFacturas.filter((f: FacturaItem) => matchesMetodoFilter(f, 'mixto') && noPendiente(f)).length,
        pendiente:     searchFilteredFacturas.filter((f: FacturaItem) => f.estado === 'pendiente' || f.estado === 'parcial').length,
    };
    const filteredFacturas = searchFilteredFacturas.filter((f: FacturaItem) => {
        if (filterMethod === 'todos') return true;
        if (filterMethod === 'pendiente') return f.estado === 'pendiente' || f.estado === 'parcial';
        return matchesMetodoFilter(f, filterMethod) && noPendiente(f);
    });

    const filteredTotal = filteredFacturas.reduce((sum: number, f: FacturaItem) => {
        if (filterMethod === 'efectivo') {
            if (f.metodo === 'efectivo') return sum + (f.total ?? 0);
            if (f.metodo === 'efectivo_transferencia') return sum + (f.pagoEfectivo ?? 0);
            return sum + (f.total ?? 0);
        }
        if (filterMethod === 'transferencia') {
            if (f.metodo === 'qr' || f.metodo === 'transferencia') return sum + (f.total ?? 0);
            if (f.metodo === 'efectivo_transferencia') return sum + (f.pagoTransferencia ?? 0);
            return sum;
        }
        return sum + (f.total ?? 0);
    }, 0);

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
                title="Finanzas"
                subtitle="Seguimiento de caja y gastos hoy"
                icon="scale-balance"
                rightContent={
                    <Button
                        title={isMobile ? "" : "Refrescar"}
                        icon="refresh"
                        variant="ghost"
                        size="sm"
                        onPress={handleRefresh}
                        loading={loading}
                    />
                }
            />

            {/* Control y Arqueo de Caja */}
            <Card className="mb-4 overflow-hidden border border-white/5 bg-slate-900/60 p-6 rounded-[28px] shadow-xl">
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
                                Gestión de efectivo del día: {dateKey}
                            </Text>
                        </View>
                    </View>

                    {/* Estados de conciliación badges (solo con arqueo) */}
                    {arqueoActivo && (
                        <View className="flex-row items-center gap-2 flex-wrap">
                            <Badge
                                label={
                                    diferencia === 0
                                        ? 'Caja Cambio: OK'
                                        : diferencia > 0
                                        ? `Cambio: +$${formatCurrency(diferencia)}`
                                        : `Cambio: -$${formatCurrency(Math.abs(diferencia))}`
                                }
                                variant={
                                    diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'danger'
                                }
                                icon={diferencia === 0 ? 'check-circle' : 'alert-circle'}
                                size="sm"
                            />
                        </View>
                    )}
                </View>

                {/* Interruptor (solo admin): apagado, el cobro en efectivo no exige arqueo */}
                <ArqueoSwitch />

                {!arqueoActivo ? (
                    <SinArqueo efectivoVentas={efectivoVentas} gastosEfectivo={gastosEfectivo} />
                ) : (
                /* Caja de Cambio / Ventas */
                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-3 mt-1 flex-wrap gap-2">
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                            Caja Principal (Ventas y Cambio)
                        </Text>
                        <Badge
                            label={
                                aperturaHecha
                                    ? 'Caja Abierta'
                                    : diferencia === 0
                                        ? 'Caja Cuadrada'
                                        : diferencia > 0
                                            ? `Sobrante: +$${formatCurrency(diferencia)}`
                                            : `Faltante: -$${formatCurrency(Math.abs(diferencia))}`
                            }
                            variant={
                                aperturaHecha ? 'primary' : diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'danger'
                            }
                            icon={aperturaHecha ? 'info' : diferencia === 0 ? 'check-circle' : 'alert-circle'}
                            size="sm"
                        />
                    </View>
                    <View className="mb-4">
                        {/* Efectivo Esperado en Caja */}
                        <View className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 justify-between">
                            <View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Efectivo Esperado en Caja
                                </Text>
                                <View className="flex-row items-center gap-1 mt-1 flex-wrap">
                                    {aperturaHecha ? (
                                        <>
                                            <Text className="text-slate-500 text-[10px]">
                                                Arqueo: ${formatCurrency(totalApertura)}
                                            </Text>
                                            <Text className="text-slate-500 text-[10px]">•</Text>
                                            <Text className={`text-[10px] ${movimientosDesdeArqueo >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                                Movimientos: {movimientosDesdeArqueo >= 0 ? '+' : '-'}${formatCurrency(Math.abs(movimientosDesdeArqueo))}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text className="text-emerald-500 text-[10px]">
                                            Ventas Ef.: ${formatCurrency(efectivoVentas)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <View className="mt-3 flex-row justify-between items-center">
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 24, color: '#F8FAFC', letterSpacing: -0.5 }}>
                                    ${formatCurrency(efectivoEsperado)}
                                </Text>
                                <View className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 items-center justify-center">
                                    <Icon name="calculator" size={16} color="#94A3B8" />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Acordeón Arqueo de Billetes (Cambio) */}
                    <TouchableOpacity
                        onPress={() => setIsArqueoCollapsed(!isArqueoCollapsed)}
                        className="flex-row justify-between items-center bg-white/5 border border-white/5 rounded-2xl p-4 active:bg-white/10"
                    >
                        <View className="flex-row items-center gap-3 flex-1 mr-2">
                            <Icon
                                name={aperturaHecha ? 'check-circle' : 'cash-multiple'}
                                size={20}
                                color={aperturaHecha ? '#10B981' : '#F5A524'}
                            />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontFamily: 'Outfit', color: '#E2E8F0', fontSize: 14, fontWeight: 'bold' }} numberOfLines={1} ellipsizeMode="tail">
                                    Arqueo de caja
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11 }} numberOfLines={1} ellipsizeMode="tail">
                                    {aperturaHecha
                                        ? `Último arqueo — $${formatCurrency(totalApertura)}`
                                        : `Pendiente — conteo actual: $${formatCurrency(conteoFisico)}`
                                    }
                                </Text>
                            </View>
                        </View>
                        {!aperturaHecha && (
                            <View className="mr-2 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 9, textTransform: 'uppercase' }}>Requerido</Text>
                            </View>
                        )}
                        <Icon name={isArqueoCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color="#E2E8F0" />
                    </TouchableOpacity>

                    {/* Contenido desplegable (Cambio) */}
                    {!isArqueoCollapsed && (
                        aperturaHecha && !reArqueando ? (
                            /* ── Live state: shows current denominations after all movements ── */
                            <View className="mt-2 bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl">
                                <View className="flex-row items-center gap-2 mb-4">
                                    <Icon name="check-circle" size={16} color="#10B981" />
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Estado actual de caja
                                    </Text>
                                </View>

                                <EstadoCajaLista estado={cajaResumen?.estadoActual} />

                                <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-white/5 flex-wrap gap-2">
                                    <View>
                                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 12 }}>
                                            Total en caja:{' '}
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981' }}>
                                                ${formatCurrency(cajaResumen?.totalEfectivo ?? 0)}
                                            </Text>
                                        </Text>
                                        <Text style={{ fontFamily: 'Outfit', color: '#334155', fontSize: 10 }}>
                                            Entradas: ${formatCurrency(cajaResumen?.totalEntradas ?? 0)}  •  Salidas: ${formatCurrency(cajaResumen?.totalSalidas ?? 0)}
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
                            <View className="mt-2 pt-4 border-t border-white/5 bg-black/10 p-4 rounded-2xl border border-white/5">
                                {/* Warning if facturas already paid without arqueo */}
                                {!aperturaHecha && (stats?.totalPagado ?? 0) > 0 && (
                                    <View className="flex-row items-start gap-2 mb-4 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                                        <Icon name="alert-circle-outline" size={14} color="#F43F5E" />
                                        <Text style={{ fontFamily: 'Outfit', color: '#F87171', fontSize: 11, flex: 1, lineHeight: 16 }}>
                                            Hay facturas cobradas antes del arqueo. Al confirmar, la caja parte de este conteo y lo cobrado antes queda incluido.
                                        </Text>
                                    </View>
                                )}

                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                    Ingresa las cantidades de billetes que hay en la caja
                                </Text>

                                <ConteoCajaGrid
                                    value={billCounts}
                                    onChangeValue={(clave, cantidad) => handleUpdateBillCount(clave, String(cantidad))}
                                />

                                {aperturaError && (
                                    <View className="flex-row items-center gap-2 mt-3 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                                        <Icon name="alert-circle-outline" size={14} color="#F43F5E" />
                                        <Text style={{ fontFamily: 'Outfit', color: '#F87171', fontSize: 11, flex: 1 }}>{aperturaError}</Text>
                                    </View>
                                )}
                                <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-white/5 flex-wrap gap-2">
                                    <TouchableOpacity
                                        onPress={handleClearConteo}
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
                                        {reArqueando && (
                                            <TouchableOpacity onPress={() => setReArqueando(false)} className="px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                                                <Text className="uppercase text-[11px]" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8' }}>Cancelar</Text>
                                            </TouchableOpacity>
                                        )}
                                        <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 }}>
                                            Total: <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC' }}>${formatCurrency(conteoFisico)}</Text>
                                        </Text>
                                        <Button
                                            title={confirmandoApertura ? 'Confirmando...' : aperturaHecha ? 'Confirmar nuevo arqueo' : 'Confirmar arqueo'}
                                            icon="check-circle-outline"
                                            variant="primary"
                                            size="sm"
                                            onPress={handleConfirmarApertura}
                                            loading={confirmandoApertura}
                                            disabled={confirmandoApertura || conteoFisico === 0}
                                        />
                                    </View>
                                </View>
                            </View>
                        )
                    )}
                </View>
                )}

            </Card>

            {/* Resumen del día (servidor) */}
            {/* Mismas secciones y orden que la pantalla de cierre y el correo de cierre */}
            {!!resumen && (
                <View className="mb-4">
                    <ResumenDiaCompleto resumen={resumen} />
                </View>
            )}

            {/* Efectivo vs QR breakdown */}
            <MetodosPagoCard
                efectivoVentas={efectivoVentas}
                qrVentas={qrVentas}
                gastosEfectivo={gastosEfectivo}
                gastosQr={gastosQr}
                qrPorCuenta={qrPorCuenta}
            />

            {/* ── MOVIMIENTOS DE CAJA (tracking de entradas/salidas durante el día) ── */}
            <CajaMovimientosWidget 
                cajaResumen={cajaResumen}
                onRefresh={fetchCajaResumen}
                isLoading={loadingFacturas}
            />

            {/* ── FACTURAS ───────────────────────────────────────────────────────── */}
            <View className={`mb-4 mt-4 gap-4 ${isMobile ? 'flex-col items-stretch' : 'flex-row items-center justify-between'}`}>
                <View className="flex-row items-center gap-3">
                    <View className="w-1.5 h-6 bg-orange-500 rounded-full" />
                    <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Ventas Facturadas</Text>
                    <View className="bg-white/5 px-3 py-1 rounded-full border border-white/5 ml-2">
                        <Text className="text-slate-400 font-bold text-xs">{filteredFacturas.length} docs • ${formatCurrency(filteredTotal)}</Text>
                    </View>
                </View>

                {/* Buscador y Filtro */}
                <View className={`flex-col gap-3 ${isMobile ? 'w-full' : 'flex-1 max-w-xl'}`}>
                    <View className="flex-row items-center gap-2">
                        <SearchInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar por cliente..." className="flex-1" />
                    </View>
                    <MethodFilterChips value={filterMethod} onChange={setFilterMethod} counts={methodCounts} />
                </View>
            </View>

            <InlineError message={errorFacturas} className="mb-4" />

            {loadingFacturas && !facturas.length && <ListSkeleton count={4} />}

            {!loadingFacturas && filteredFacturas.length === 0 && !errorFacturas && (
                <View className="items-center py-16 bg-white/5 rounded-[40px] border border-white/5 mb-4">
                    <Icon name={searchQuery ? "account-search-outline" : "receipt-outline"} size={56} color="#1E293B" />
                    <Text className="text-slate-600 font-black mt-4 uppercase text-[10px] tracking-widest">
                        {searchQuery ? "No se encontraron facturas" : "Sin facturas registradas hoy"}
                    </Text>
                </View>
            )}

            <View className="mb-12">
                <CardGrid
                    kind="factura"
                    data={filteredFacturas}
                    keyExtractor={(item: FacturaItem, i) => item.facturaId?.toString() ?? String(i)}
                    renderItem={(item: FacturaItem) => (
                        <FacturaCard
                            item={item}
                            isUpdating={updatingId === item.facturaId}
                            activeFilter={filterMethod}
                            {...accionesFactura}
                            onUpdate={onUpdate}
                            showPrint
                            aperturaHecha={arqueoActivo ? aperturaHecha : undefined}
                        />
                    )}
                />
            </View>

        </PageContainer>
    );
}
