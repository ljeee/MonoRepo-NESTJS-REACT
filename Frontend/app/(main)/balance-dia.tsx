import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView } from '../../tw';
import { useFacturasDia, useFacturasPagosDia, useApi } from '@/src/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportPdf } from '../../utils/exportData';
import type { FacturaPago, CajaResumen, DenominacionesMap } from '@/src/shared';
import { formatCurrency, DENOMINACIONES_COP } from '@/src/shared';
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

// ─── Balance card ─────────────────────────────────────────────────────────────

function BalanceCard({ ingresos, gastos }: { ingresos: number; gastos: number }) {
    const neto = ingresos - gastos;
    const isPositive = neto >= 0;
    const { isMobile } = useBreakpoint();

    return (
        <Card className="mb-8 overflow-hidden relative border-0 p-0 bg-transparent rounded-[32px] shadow-2xl shadow-black/40">
            {/* Background Gradient & Pattern */}
            <View className="absolute inset-0 bg-[#0F172A]" />
            <View className={`absolute inset-0 ${isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
            
            <View style={{ padding: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 'bold' }}>Caja Diaria</Text>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, backgroundColor: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderColor: isPositive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }}>
                         <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 9, textTransform: 'uppercase', color: isPositive ? '#10B981' : '#EF4444', letterSpacing: 1 }}>
                            {isPositive ? 'Balance Positivo' : 'Déficit Detectado'}
                         </Text>
                    </View>
                </View>

                <View style={{ gap: 20 }}>
                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center border border-emerald-500/20">
                                <Icon name="chart-line" size={18} color="#10B981" />
                            </View>
                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 13, fontWeight: 'bold' }}>Ventas Totales</Text>
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18 }}>
                             ${formatCurrency(ingresos)}
                        </Text>
                    </View>

                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 rounded-2xl bg-red-500/10 items-center justify-center border border-red-500/20">
                                <Icon name="chart-line-variant" size={18} color="#EF4444" />
                            </View>
                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 13, fontWeight: 'bold' }}>Gastos Operativos</Text>
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 18 }}>
                             −${formatCurrency(gastos)}
                        </Text>
                    </View>

                    <View className="h-[1px] bg-white/5 my-1" />

                    <View className="flex-row justify-between items-end">
                         <View className="gap-1">
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Efectivo Neto</Text>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: isMobile ? 22 : 32, color: isPositive ? '#F5A524' : '#EF4444', letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
                                 ${formatCurrency(Math.abs(neto))}
                            </Text>
                         </View>
                        <View className={`w-14 h-14 rounded-2xl ${isPositive ? 'bg-orange-500/20' : 'bg-red-500/20'} items-center justify-center border ${isPositive ? 'border-orange-500/30' : 'border-red-500/30'}`}>
                            <Icon name="scale-balance" size={28} color={isPositive ? '#F5A524' : '#EF4444'} />
                        </View>
                    </View>
                </View>
            </View>
        </Card>
    );
}

// ─── Métodos de Pago Card ─────────────────────────────────────────────────────

function MetodosPagoCard({
    efectivoVentas,
    qrVentas,
    gastosEfectivo,
    gastosQr,
}: {
    efectivoVentas: number;
    qrVentas: number;
    gastosEfectivo: number;
    gastosQr: number;
}) {
    const { isMobile } = useBreakpoint();
    const netoEfectivo = efectivoVentas - gastosEfectivo;
    const netoQr = qrVentas - gastosQr;

    return (
        <Card className="mb-8 overflow-hidden border-0 p-0 bg-transparent rounded-[32px]">
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
    const isWeb = Platform.OS === 'web';

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
        error: errorGastos,
        fetchData: fetchGastos,
    } = useFacturasPagosDia();

    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPending, setFilterPending] = useState(false);

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

    // Apertura de caja already done today when the backend has recorded entries
    const aperturaHecha = (cajaResumen?.totalEntradas ?? 0) > 0;

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
        await Promise.all([refetchFacturas(), fetchGastos(), fetchCajaResumen()]);
        setRefreshing(false);
    }, [refetchFacturas, fetchGastos, fetchCajaResumen]);

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
            await api.cajaDenominaciones.apertura(denomMap, 'Apertura de caja');
            await fetchCajaResumen();
        } catch (err: any) {
            console.error('[BalanceDia] Error en apertura:', err);
            const msg = err?.response?.data?.message ?? err?.message ?? 'Error al confirmar apertura';
            setAperturaError(typeof msg === 'string' ? msg : 'Error al confirmar apertura');
        } finally {
            setConfirmandoApertura(false);
        }
    }, [api, billCounts, fetchCajaResumen]);

    const handleToggleEstado = async (
        facturaId: number,
        nuevoEstado: string,
        metodo?: string,
        pagoEfectivo?: number,
        pagoTransferencia?: number,
        denominaciones?: Record<string, number>,
        cambioDenominaciones?: Record<string, number>
    ) => {
        setUpdatingId(facturaId);
        try {
            if (nuevoEstado === 'pagado' && metodo) {
                await updateFactura(facturaId, { estado: 'pagado', metodo, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones });
            } else {
                await updateEstado(facturaId, nuevoEstado);
            }
        } catch (error) {
            console.error('Error updating factura estado:', error);
        }
        setUpdatingId(null);
    };

    const handleUpdateTotal = async (facturaId: number, newTotal: number) => {
        await updateFactura(facturaId, { total: newTotal });
    };

    const ingresos = stats?.totalPagado ?? 0;
    const totalGastos = gastos.reduce((sum: number, g: FacturaPago) => sum + (Number(g.total) || 0), 0);

    // --- CÁLCULO DE EFECTIVO ESPERADO Y ARQUEO ---
    const efectivoVentas = facturas
        .filter((f: FacturaItem) => f.estado === 'pagado' || f.estado === 'pagada')
        .reduce((sum: number, f: FacturaItem) => {
            if (f.metodo === 'efectivo') {
                return sum + (f.total ?? 0);
            } else if (f.metodo === 'efectivo_transferencia') {
                return sum + (f.pagoEfectivo ?? 0);
            }
            return sum;
        }, 0);

    const gastosEfectivo = gastos
        .filter((g: FacturaPago) => g.metodo === 'efectivo')
        .reduce((sum: number, g: FacturaPago) => sum + (Number(g.total) || 0), 0);

    // ─── QR / transferencia breakdown ────────────────────────────────────────
    const qrVentas = facturas
        .filter((f: FacturaItem) => f.estado === 'pagado' || f.estado === 'pagada')
        .reduce((sum: number, f: FacturaItem) => {
            if (f.metodo === 'qr' || f.metodo === 'transferencia') {
                return sum + (f.total ?? 0);
            } else if (f.metodo === 'efectivo_transferencia') {
                return sum + (f.pagoTransferencia ?? 0);
            }
            return sum;
        }, 0);

    const gastosQr = gastos
        .filter((g: FacturaPago) => g.metodo === 'qr' || g.metodo === 'transferencia')
        .reduce((sum: number, g: FacturaPago) => sum + (Number(g.total) || 0), 0);

    const totalApertura = (cajaResumen?.movimientos ?? [])
        .filter((m: any) => m.tipo === 'apertura')
        .reduce((sum: number, m: any) => sum + (Number(m.total) || 0), 0);

    const efectivoEsperado = aperturaHecha
        ? totalApertura + efectivoVentas
        : efectivoVentas;

    const conteoFisico = (billCounts['200000'] || 0) * 200000 +
        (billCounts['100000'] || 0) * 100000 +
        (billCounts['50000'] || 0) * 50000 +
        (billCounts['20000'] || 0) * 20000 +
        (billCounts['10000'] || 0) * 10000 +
        (billCounts['5000'] || 0) * 5000 +
        (billCounts['2000'] || 0) * 2000 +
        (billCounts['coins'] || 0);

    const diferencia = conteoFisico - efectivoEsperado;

    const loading = loadingFacturas || loadingGastos;

    const filteredFacturas = facturas.filter((f: FacturaItem) => {
        const matchesSearch = !searchQuery || (f.clienteNombre && f.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesPending = !filterPending || f.estado === 'pendiente';
        return matchesSearch && matchesPending;
    });

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
                                Gestión de efectivo del día: {dateKey}
                            </Text>
                        </View>
                    </View>

                    {/* Estados de conciliación badges */}
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
                </View>

                {/* Caja de Cambio / Ventas */}
                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-3 mt-1 flex-wrap gap-2">
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                            Caja Principal (Ventas y Cambio)
                        </Text>
                        <Badge
                            label={
                                diferencia === 0
                                    ? 'Caja Cuadrada'
                                    : diferencia > 0
                                    ? `Sobrante: +$${formatCurrency(diferencia)}`
                                    : `Faltante: -$${formatCurrency(Math.abs(diferencia))}`
                            }
                            variant={
                                diferencia === 0 ? 'success' : diferencia > 0 ? 'warning' : 'danger'
                            }
                            icon={diferencia === 0 ? 'check-circle' : 'alert-circle'}
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
                                                Apertura: ${formatCurrency(totalApertura)}
                                            </Text>
                                            <Text className="text-slate-500 text-[10px]">•</Text>
                                            <Text className="text-emerald-500 text-[10px]">
                                                Ventas Ef.: +${formatCurrency(efectivoVentas)}
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
                                    Arqueo de Apertura
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11 }} numberOfLines={1} ellipsizeMode="tail">
                                    {aperturaHecha
                                        ? `Registrada — $${formatCurrency(totalApertura)} en caja`
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
                        aperturaHecha ? (
                            /* ── Live state: shows current denominations after all movements ── */
                            <View className="mt-2 bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl">
                                <View className="flex-row items-center gap-2 mb-4">
                                    <Icon name="check-circle" size={16} color="#10B981" />
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Estado actual de caja
                                    </Text>
                                </View>

                                <View className="gap-1.5">
                                    {/* Billetes */}
                                    {DENOMINACIONES_COP.map(({ valor, tipo, label }) => {
                                        const qty = cajaResumen?.estadoActual[String(valor)] ?? 0;
                                        if (qty === 0) return null;
                                        return (
                                            <View key={valor} className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03]">
                                                <View className="flex-row items-center gap-2">
                                                    <View className={`w-1.5 h-1.5 rounded-full ${tipo === 'billete' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                                                    <Text className="text-sm text-slate-300 w-20">{label}</Text>
                                                </View>
                                                <View className="flex-row items-center gap-3">
                                                    <Text className="text-slate-500 text-xs">×{qty}</Text>
                                                    <Text className="text-sm text-emerald-400 font-bold w-24 text-right">${formatCurrency(qty * valor)}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}

                                    {/* Monedas — stored as total value directly under 'coins' key */}
                                    {(cajaResumen?.estadoActual?.['coins'] ?? 0) > 0 && (
                                        <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                            <View className="flex-row items-center gap-2">
                                                <View className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                                <Text className="text-sm text-slate-300 w-20">Monedas</Text>
                                            </View>
                                            <View className="flex-row items-center gap-3">
                                                <Text className="text-slate-500 text-xs">total</Text>
                                                <Text className="text-sm text-yellow-400 font-bold w-24 text-right">${formatCurrency(cajaResumen!.estadoActual['coins'])}</Text>
                                            </View>
                                        </View>
                                    )}

                                    {(!cajaResumen?.estadoActual || Object.values(cajaResumen.estadoActual).every(v => (v ?? 0) <= 0)) && (
                                        <Text className="text-slate-600 text-xs text-center py-2">Sin denominaciones en caja</Text>
                                    )}
                                </View>

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
                            <View className="mt-2 pt-4 border-t border-white/5 bg-black/10 p-4 rounded-2xl border border-white/5">
                                {/* Warning if facturas already paid without arqueo */}
                                {(stats?.totalPagado ?? 0) > 0 && (
                                    <View className="flex-row items-start gap-2 mb-4 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                                        <Icon name="alert-circle-outline" size={14} color="#F43F5E" />
                                        <Text style={{ fontFamily: 'Outfit', color: '#F87171', fontSize: 11, flex: 1, lineHeight: 16 }}>
                                            Hay facturas cobradas sin apertura de caja. El estado no es congruente — realiza el arqueo ahora.
                                        </Text>
                                    </View>
                                )}

                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                    Ingresa las cantidades de billetes que hay en la caja
                                </Text>

                                <View className="flex-row flex-wrap gap-2.5">
                                    {[
                                        { key: '200000', label: '$200K' },
                                        { key: '100000', label: '$100K' },
                                        { key: '50000', label: '$50K' },
                                        { key: '20000', label: '$20K' },
                                        { key: '10000', label: '$10K' },
                                        { key: '5000', label: '$5K' },
                                        { key: '2000', label: '$2K' },
                                    ].map((den) => {
                                        const qty = billCounts[den.key] || 0;
                                        const subtotal = qty * Number(den.key);
                                        return (
                                            <View key={den.key} className="w-[48%] md:w-[23%] bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                                                <View className="flex-row justify-between items-center mb-1">
                                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 11 }}>{den.label}</Text>
                                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 9 }}>x {Number(den.key) / 1000}k</Text>
                                                </View>
                                                <TextInput
                                                    className="text-white bg-white/5 border border-white/10 rounded-lg text-center font-bold text-sm h-8 p-0"
                                                    placeholder="0"
                                                    placeholderTextColor="#475569"
                                                    keyboardType="numeric"
                                                    value={qty ? qty.toString() : ''}
                                                    onChangeText={(val) => handleUpdateBillCount(den.key, val)}
                                                />
                                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
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
                                        <TextInput
                                            className="text-white bg-white/5 border border-white/10 rounded-lg text-center font-bold text-sm h-8 p-0"
                                            placeholder="0"
                                            placeholderTextColor="#475569"
                                            keyboardType="numeric"
                                            value={billCounts['coins'] ? billCounts['coins'].toString() : ''}
                                            onChangeText={(val) => handleUpdateBillCount('coins', val)}
                                        />
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                                            ${formatCurrency(billCounts['coins'] || 0)}
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
                                        <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 }}>
                                            Total: <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC' }}>${formatCurrency(conteoFisico)}</Text>
                                        </Text>
                                        <Button
                                            title={confirmandoApertura ? 'Confirmando...' : 'Confirmar Apertura'}
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


            </Card>

            {/* Balance summary card */}
            <BalanceCard ingresos={ingresos} gastos={totalGastos} />

            {/* Efectivo vs QR breakdown */}
            <MetodosPagoCard
                efectivoVentas={efectivoVentas}
                qrVentas={qrVentas}
                gastosEfectivo={gastosEfectivo}
                gastosQr={gastosQr}
            />

            {/* ── MOVIMIENTOS DE CAJA (tracking de entradas/salidas durante el día) ── */}
            <CajaMovimientosWidget 
                cajaResumen={cajaResumen}
                onRefresh={fetchCajaResumen}
                isLoading={loadingFacturas}
            />

            {/* ── FACTURAS ───────────────────────────────────────────────────────── */}
            <View className={`mb-6 mt-4 gap-4 ${isMobile ? 'flex-col items-stretch' : 'flex-row items-center justify-between'}`}>
                <View className="flex-row items-center gap-3">
                    <View className="w-1.5 h-6 bg-orange-500 rounded-full" />
                    <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Ventas Facturadas</Text>
                    <View className="bg-white/5 px-3 py-1 rounded-full border border-white/5 ml-2">
                        <Text className="text-slate-500 font-bold text-xs">{filteredFacturas.length} docs</Text>
                    </View>
                </View>

                {/* Buscador y Filtro */}
                <View className={`flex-row items-center gap-2 ${isMobile ? '' : 'flex-1 max-w-md'}`}>
                    <View className="flex-row items-center bg-white/5 rounded-xl px-4 py-2 flex-1 border border-white/10">
                        <Icon name="magnify" size={20} color="#94A3B8" />
                        <TextInput
                            className="text-white ml-3 flex-1 h-8 font-bold text-sm"
                            placeholder="Buscar por cliente..."
                            placeholderTextColor="#64748B"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Icon name="close-circle" size={18} color="#64748B" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity 
                        onPress={() => setFilterPending(!filterPending)}
                        className={`px-3 h-12 rounded-xl border flex-row items-center gap-1 ${filterPending ? 'bg-orange-500/20 border-orange-500/40' : 'bg-white/5 border-white/10'}`}
                    >
                        <Icon name="alert-circle-outline" size={18} color={filterPending ? "#F5A524" : "#94A3B8"} />
                        {!isMobile && <Text className={`font-bold text-[10px] uppercase tracking-widest ${filterPending ? 'text-orange-400' : 'text-slate-400'}`}>Pend.</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {errorFacturas && (
                <View className="flex-row items-center gap-3 bg-red-500/10 p-5 rounded-3xl mb-8 border border-red-500/20">
                    <Icon name="alert-circle-outline" size={20} color="#EF4444" />
                    <Text className="text-red-400 text-xs font-bold leading-tight">{errorFacturas}</Text>
                </View>
            )}

            {loadingFacturas && !facturas.length && <ListSkeleton count={4} />}

            {!loadingFacturas && filteredFacturas.length === 0 && !errorFacturas && (
                <View className="items-center py-16 bg-white/5 rounded-[40px] border border-white/5 mb-10">
                    <Icon name={searchQuery ? "account-search-outline" : "receipt-outline"} size={56} color="#1E293B" />
                    <Text className="text-slate-600 font-black mt-4 uppercase text-[10px] tracking-widest">
                        {searchQuery ? "No se encontraron facturas" : "Sin facturas registradas hoy"}
                    </Text>
                </View>
            )}

            <View className="flex-row flex-wrap gap-4 mb-12">
                {filteredFacturas.map((item: FacturaItem, idx: number) => (
                    <View key={item.facturaId?.toString() || idx.toString()} className={`${isWeb ? 'w-full lg:w-[49%]' : 'w-full'}`}>
                        <FacturaCard
                            item={item}
                            isUpdating={updatingId === item.facturaId}
                            onToggleEstado={handleToggleEstado}
                            onUpdateTotal={handleUpdateTotal}
                            showPrint
                            aperturaHecha={aperturaHecha}
                        />
                    </View>
                ))}
            </View>

        </PageContainer>
    );
}
