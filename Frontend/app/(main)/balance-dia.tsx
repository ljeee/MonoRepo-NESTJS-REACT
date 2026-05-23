import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView } from '../../tw';
import { useFacturasDia, useFacturasPagosDia, useDeleteFacturaPago, useApi } from '@/src/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportPdf } from '../../utils/exportData';
import type { FacturaPago, CajaResumen, DenominacionesMap } from '@/src/shared';
import { formatCurrency, DENOMINACIONES_COP } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, TouchableOpacity, TextInput } from '../../tw';
import { getLocalDateString } from '../../src/shared/utils/dateRange';

import { FacturaCard, FacturaItem } from '../../components/facturas/FacturaShared';
import {
    PageContainer,
    PageHeader,
    Button,
    Icon,
    ListSkeleton,
    ConfirmModal,
    Badge,
    Card,
    DenominacionSelector,
} from '../../components/ui';

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

// ─── Gasto item row (Modernizado) ─────────────────────────────────────────────

function GastoRow({ item, onDelete, deleting }: {
    item: FacturaPago;
    onDelete: () => void;
    deleting: boolean;
}) {
    return (
        <Card className="flex-row items-center gap-4 p-5 bg-white/5 border border-white/5 rounded-[24px]">
            <View className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center border border-white/10">
                <Icon
                    name={item.metodo === 'efectivo' ? 'cash-multiple' : 'bank-transfer'}
                    size={22}
                    color="#F5A524"
                />
            </View>

            <View className="flex-1">
                <Text className="text-white font-black text-sm uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                    {item.nombreGasto || 'Gasto General'}
                </Text>
                <View className="flex-row items-center gap-2 mt-1">
                    <Text className="text-slate-500 font-bold text-[9px] uppercase tracking-widest">{item.fechaFactura}</Text>
                    <View className="bg-(--color-pos-primary)/10 px-2 py-0.5 rounded-md border border-(--color-pos-primary)/20">
                        <Text className="text-(--color-pos-primary) font-black text-[8px] uppercase">{item.metodo || '—'}</Text>
                    </View>
                </View>
            </View>

            <View className="items-end mr-2">
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 16 }}>
                    −${formatCurrency(item.total ?? 0)}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onDelete}
                disabled={deleting}
                className="w-10 h-10 items-center justify-center rounded-xl bg-red-500/10 active:bg-red-500/20 border border-red-500/20"
            >
                <Icon name="trash-can-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
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

    const { deletePago, loading: deleting } = useDeleteFacturaPago();

    const [refreshing, setRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPending, setFilterPending] = useState(false);

    // --- ESTADO DE BASE DE CAJA Y ARQUEO ---
    const dateKey = getLocalDateString();

    const [baseCaja, setBaseCaja] = useState<number>(0);
    const [baseCajaInput, setBaseCajaInput] = useState<string>('');
    const [baseGastos, setBaseGastos] = useState<number>(0);
    const [baseGastosInput, setBaseGastosInput] = useState<string>('');
    const [isArqueoCollapsed, setIsArqueoCollapsed] = useState<boolean>(true);
    const [isArqueoGastosCollapsed, setIsArqueoGastosCollapsed] = useState<boolean>(true);

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
    const [billCountsGastos, setBillCountsGastos] = useState<Record<string, number>>(DEFAULT_BILL_COUNTS);

    // Load from storage on mount/dateKey change
    useEffect(() => {
        const loadPersistedData = async () => {
            try {
                const storedBase = await AsyncStorage.getItem(`@base_caja_${dateKey}`);
                if (storedBase !== null) {
                    const parsedBase = Number(storedBase) || 0;
                    setBaseCaja(parsedBase);
                    setBaseCajaInput(parsedBase.toString());
                } else {
                    setBaseCaja(0);
                    setBaseCajaInput('');
                }

                const storedBaseGastos = await AsyncStorage.getItem(`@base_gastos_${dateKey}`);
                if (storedBaseGastos !== null) {
                    const parsedBaseGastos = Number(storedBaseGastos) || 0;
                    setBaseGastos(parsedBaseGastos);
                    setBaseGastosInput(parsedBaseGastos.toString());
                } else {
                    setBaseGastos(0);
                    setBaseGastosInput('');
                }

                const storedCounts = await AsyncStorage.getItem(`@conteo_billetes_${dateKey}`);
                if (storedCounts !== null) {
                    setBillCounts(JSON.parse(storedCounts));
                } else {
                    setBillCounts(DEFAULT_BILL_COUNTS);
                }

                const storedCountsGastos = await AsyncStorage.getItem(`@conteo_gastos_${dateKey}`);
                if (storedCountsGastos !== null) {
                    setBillCountsGastos(JSON.parse(storedCountsGastos));
                } else {
                    setBillCountsGastos(DEFAULT_BILL_COUNTS);
                }
            } catch (err) {
                console.error('Error loading finance metrics from AsyncStorage:', err);
            }
        };

        loadPersistedData();
    }, [dateKey]);

    const handleSaveBase = async (text: string) => {
        const cleanText = text.replace(/[^0-9]/g, '');
        setBaseCajaInput(cleanText);
        const numValue = Number(cleanText) || 0;
        setBaseCaja(numValue);
        try {
            await AsyncStorage.setItem(`@base_caja_${dateKey}`, numValue.toString());
        } catch (err) {
            console.error('Error saving base to AsyncStorage:', err);
        }
    };

    const handleSaveBaseGastos = async (text: string) => {
        const cleanText = text.replace(/[^0-9]/g, '');
        setBaseGastosInput(cleanText);
        const numValue = Number(cleanText) || 0;
        setBaseGastos(numValue);
        try {
            await AsyncStorage.setItem(`@base_gastos_${dateKey}`, numValue.toString());
        } catch (err) {
            console.error('Error saving base gastos to AsyncStorage:', err);
        }
    };

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

    const handleUpdateBillCountGastos = async (denomination: string, countText: string) => {
        const cleanText = countText.replace(/[^0-9]/g, '');
        const value = Number(cleanText) || 0;
        const updated = {
            ...billCountsGastos,
            [denomination]: value
        };
        setBillCountsGastos(updated);
        try {
            await AsyncStorage.setItem(`@conteo_gastos_${dateKey}`, JSON.stringify(updated));
        } catch (err) {
            console.error('Error saving bill counts gastos to AsyncStorage:', err);
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

    const handleClearConteoGastos = async () => {
        setBillCountsGastos(DEFAULT_BILL_COUNTS);
        try {
            await AsyncStorage.setItem(`@conteo_gastos_${dateKey}`, JSON.stringify(DEFAULT_BILL_COUNTS));
        } catch (err) {
            console.error('Error clearing bill counts gastos in AsyncStorage:', err);
        }
    };

    const api = useApi();
    const [cajaResumen, setCajaResumen] = useState<CajaResumen | null>(null);
    const [aperturaDenominaciones, setAperturaDenominaciones] = useState<DenominacionesMap>({});
    const [showApertura, setShowApertura] = useState(false);

    const fetchCajaResumen = useCallback(async () => {
        try {
            const r = await api.cajaDenominaciones.getResumen();
            setCajaResumen(r);
        } catch {
            setCajaResumen(null);
        }
    }, [api]);

    useEffect(() => { fetchGastos(); fetchCajaResumen(); }, [fetchGastos, fetchCajaResumen]);

    const handleRefresh = async () => {
        setRefreshing(refreshing);
        await Promise.all([refetchFacturas(), fetchGastos(), fetchCajaResumen()]);
    };

    const handleApertura = async () => {
        if (Object.keys(aperturaDenominaciones).length === 0) return;
        try {
            await api.cajaDenominaciones.apertura(aperturaDenominaciones, 'Apertura de caja');
            setAperturaDenominaciones({});
            setShowApertura(false);
            await fetchCajaResumen();
        } catch {}
    };

    const handleToggleEstado = async (
        facturaId: number,
        nuevoEstado: string,
        metodo?: string,
        pagoEfectivo?: number,
        pagoTransferencia?: number,
        denominaciones?: Record<string, number>
    ) => {
        setUpdatingId(facturaId);
        try {
            if (nuevoEstado === 'pagado' && metodo) {
                await updateFactura(facturaId, { estado: 'pagado', metodo, pagoEfectivo, pagoTransferencia, denominaciones });
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

    const handleDeleteGasto = async () => {
        if (!deleteTarget) return;
        const ok = await deletePago(deleteTarget.id);
        if (ok) fetchGastos();
        setDeleteTarget(null);
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

    const efectivoEsperado = baseCaja + efectivoVentas;
    const efectivoEsperadoGastos = baseGastos - gastosEfectivo;

    const conteoFisico = (billCounts['200000'] || 0) * 200000 +
        (billCounts['100000'] || 0) * 100000 +
        (billCounts['50000'] || 0) * 50000 +
        (billCounts['20000'] || 0) * 20000 +
        (billCounts['10000'] || 0) * 10000 +
        (billCounts['5000'] || 0) * 5000 +
        (billCounts['2000'] || 0) * 2000 +
        (billCounts['coins'] || 0);

    const diferencia = conteoFisico - efectivoEsperado;

    const conteoFisicoGastos = (billCountsGastos['200000'] || 0) * 200000 +
        (billCountsGastos['100000'] || 0) * 100000 +
        (billCountsGastos['50000'] || 0) * 50000 +
        (billCountsGastos['20000'] || 0) * 20000 +
        (billCountsGastos['10000'] || 0) * 10000 +
        (billCountsGastos['5000'] || 0) * 5000 +
        (billCountsGastos['2000'] || 0) * 2000 +
        (billCountsGastos['coins'] || 0);

    const diferenciaGastos = conteoFisicoGastos - efectivoEsperadoGastos;

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
                        <Badge
                            label={
                                diferenciaGastos === 0
                                    ? 'Caja Gastos: OK'
                                    : diferenciaGastos > 0
                                    ? `Gastos: +$${formatCurrency(diferenciaGastos)}`
                                    : `Gastos: -$${formatCurrency(Math.abs(diferenciaGastos))}`
                            }
                            variant={
                                diferenciaGastos === 0 ? 'success' : diferenciaGastos > 0 ? 'warning' : 'danger'
                            }
                            icon={diferenciaGastos === 0 ? 'check-circle' : 'alert-circle'}
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
                    <View className="flex-row flex-wrap gap-4 mb-4">
                        {/* Dinero Base */}
                        <View className={`${isMobile ? 'w-full' : 'flex-1'} bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4`}>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                Dinero Base (Cambio)
                            </Text>
                            <View className="flex-row items-center bg-white/5 rounded-xl border border-white/10 px-3 py-2">
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 18, marginRight: 4 }}>$</Text>
                                <TextInput
                                    className="text-white flex-1 font-bold text-lg p-0 h-8"
                                    style={{ color: '#FFFFFF' }}
                                    placeholder="0"
                                    placeholderTextColor="#64748B"
                                    keyboardType="numeric"
                                    value={baseCajaInput}
                                    onChangeText={handleSaveBase}
                                />
                                {baseCajaInput.length > 0 && (
                                    <TouchableOpacity onPress={() => handleSaveBase('')}>
                                        <Icon name="close-circle" size={18} color="#64748B" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text className="text-slate-500 text-[10px] mt-1.5">
                                Efectivo inicial disponible para cambio.
                            </Text>
                        </View>

                        {/* Efectivo Esperado en Caja */}
                        <View className={`${isMobile ? 'w-full' : 'flex-1'} bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 justify-between`}>
                            <View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Efectivo Esperado en Caja
                                </Text>
                                <View className="flex-row items-center gap-1 mt-1 flex-wrap">
                                    <Text className="text-slate-500 text-[10px]">
                                        Base: ${formatCurrency(baseCaja)}
                                    </Text>
                                    <Text className="text-slate-500 text-[10px]">•</Text>
                                    <Text className="text-emerald-500 text-[10px]">
                                        Ventas Ef.: +${formatCurrency(efectivoVentas)}
                                    </Text>
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
                            <Icon name="cash-multiple" size={20} color="#F5A524" />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontFamily: 'Outfit', color: '#E2E8F0', fontSize: 14, fontWeight: 'bold' }} numberOfLines={1} ellipsizeMode="tail">
                                    Arqueo de Billetes (Caja de Cambio)
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11 }} numberOfLines={1} ellipsizeMode="tail">
                                    Conteo físico: ${formatCurrency(conteoFisico)}
                                </Text>
                            </View>
                        </View>
                        <Icon name={isArqueoCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color="#E2E8F0" />
                    </TouchableOpacity>

                    {/* Contenido desplegable (Cambio) */}
                    {!isArqueoCollapsed && (
                        <View className="mt-2 pt-4 border-t border-white/5 bg-black/10 p-4 rounded-2xl border border-white/5">
                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                Cantidades de Denominaciones (Cambio)
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
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.8}
                                    >
                                        Limpiar Cambio
                                    </Text>
                                </TouchableOpacity>

                                <View className="flex-row items-center gap-3 flex-wrap">
                                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 }}>
                                        Arqueado: <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC' }}>${formatCurrency(conteoFisico)}</Text>
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setIsArqueoCollapsed(true)}
                                        className="px-3 py-2 bg-white/5 active:bg-white/10 rounded-xl border border-white/10"
                                    >
                                        <Text className="uppercase text-[11px]" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8' }} numberOfLines={1} ellipsizeMode="tail">
                                            Cerrar
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* Línea divisoria */}
                <View className="h-[1px] bg-white/5 my-5" />

                {/* Caja de Gastos Operativos */}
                <View className="mb-2">
                    <View className="flex-row justify-between items-center mb-3 mt-1 flex-wrap gap-2">
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                            Caja de Gastos Operativos
                        </Text>
                        <Badge
                            label={
                                diferenciaGastos === 0
                                    ? 'Gastos Cuadrados'
                                    : diferenciaGastos > 0
                                    ? `Sobrante: +$${formatCurrency(diferenciaGastos)}`
                                    : `Faltante: -$${formatCurrency(Math.abs(diferenciaGastos))}`
                            }
                            variant={
                                diferenciaGastos === 0 ? 'success' : diferenciaGastos > 0 ? 'warning' : 'danger'
                            }
                            icon={diferenciaGastos === 0 ? 'check-circle' : 'alert-circle'}
                            size="sm"
                        />
                    </View>
                    <View className="flex-row flex-wrap gap-4 mb-4">
                        {/* Dinero Base Gastos */}
                        <View className={`${isMobile ? 'w-full' : 'flex-1'} bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4`}>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                Dinero Base (Gastos)
                            </Text>
                            <View className="flex-row items-center bg-white/5 rounded-xl border border-white/10 px-3 py-2">
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 18, marginRight: 4 }}>$</Text>
                                <TextInput
                                    className="text-white flex-1 font-bold text-lg p-0 h-8"
                                    style={{ color: '#FFFFFF' }}
                                    placeholder="0"
                                    placeholderTextColor="#64748B"
                                    keyboardType="numeric"
                                    value={baseGastosInput}
                                    onChangeText={handleSaveBaseGastos}
                                />
                                {baseGastosInput.length > 0 && (
                                    <TouchableOpacity onPress={() => handleSaveBaseGastos('')}>
                                        <Icon name="close-circle" size={18} color="#64748B" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text className="text-slate-500 text-[10px] mt-1.5">
                                Fondo inicial destinado estrictamente para gastos.
                            </Text>
                        </View>

                        {/* Efectivo Restante de Gastos */}
                        <View className={`${isMobile ? 'w-full' : 'flex-1'} bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 justify-between`}>
                            <View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Efectivo Restante de Gastos
                                </Text>
                                <View className="flex-row items-center gap-1 mt-1 flex-wrap">
                                    <Text className="text-slate-500 text-[10px]">
                                        Base Gastos: ${formatCurrency(baseGastos)}
                                    </Text>
                                    <Text className="text-slate-500 text-[10px]">•</Text>
                                    <Text className="text-red-500 text-[10px]">
                                        Gastos Ef.: -${formatCurrency(gastosEfectivo)}
                                    </Text>
                                </View>
                            </View>
                            <View className="mt-3 flex-row justify-between items-center">
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 24, color: efectivoEsperadoGastos >= 0 ? '#F8FAFC' : '#EF4444', letterSpacing: -0.5 }}>
                                    ${formatCurrency(efectivoEsperadoGastos)}
                                </Text>
                                <View className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 items-center justify-center">
                                    <Icon name="cash-remove" size={16} color="#94A3B8" />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Acordeón Arqueo de Billetes (Gastos) */}
                    <TouchableOpacity
                        onPress={() => setIsArqueoGastosCollapsed(!isArqueoGastosCollapsed)}
                        className="flex-row justify-between items-center bg-white/5 border border-white/5 rounded-2xl p-4 active:bg-white/10"
                    >
                        <View className="flex-row items-center gap-3 flex-1 mr-2">
                            <Icon name="cash-multiple" size={20} color="#EF4444" />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontFamily: 'Outfit', color: '#E2E8F0', fontSize: 14, fontWeight: 'bold' }} numberOfLines={1} ellipsizeMode="tail">
                                    Arqueo de Billetes (Caja de Gastos)
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11 }} numberOfLines={1} ellipsizeMode="tail">
                                    Conteo físico: ${formatCurrency(conteoFisicoGastos)}
                                </Text>
                            </View>
                        </View>
                        <Icon name={isArqueoGastosCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color="#E2E8F0" />
                    </TouchableOpacity>

                    {/* Contenido desplegable (Gastos) */}
                    {!isArqueoGastosCollapsed && (
                        <View className="mt-2 pt-4 border-t border-white/5 bg-black/10 p-4 rounded-2xl border border-white/5">
                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                                Cantidades de Denominaciones (Gastos)
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
                                    const qty = billCountsGastos[den.key] || 0;
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
                                                onChangeText={(val) => handleUpdateBillCountGastos(den.key, val)}
                                            />
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                                                ${formatCurrency(subtotal)}
                                            </Text>
                                        </View>
                                    );
                                })}

                                <View className="w-[48%] md:w-[23%] bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 11 }}>Monedas</Text>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 9 }}>Monto total</Text>
                                    </View>
                                    <TextInput
                                        className="text-white bg-white/5 border border-white/10 rounded-lg text-center font-bold text-sm h-8 p-0"
                                        placeholder="0"
                                        placeholderTextColor="#475569"
                                        keyboardType="numeric"
                                        value={billCountsGastos['coins'] ? billCountsGastos['coins'].toString() : ''}
                                        onChangeText={(val) => handleUpdateBillCountGastos('coins', val)}
                                    />
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#EF4444', fontSize: 9, textAlign: 'right', marginTop: 4 }}>
                                        ${formatCurrency(billCountsGastos['coins'] || 0)}
                                    </Text>
                                </View>
                            </View>

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
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.8}
                                    >
                                        Limpiar Gastos
                                    </Text>
                                </TouchableOpacity>

                                <View className="flex-row items-center gap-3 flex-wrap">
                                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 }}>
                                        Arqueado: <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC' }}>${formatCurrency(conteoFisicoGastos)}</Text>
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setIsArqueoGastosCollapsed(true)}
                                        className="px-3 py-2 bg-white/5 active:bg-white/10 rounded-xl border border-white/10"
                                    >
                                        <Text className="uppercase text-[11px]" style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8' }} numberOfLines={1} ellipsizeMode="tail">
                                            Cerrar
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </Card>

            {/* Balance summary card */}
            <BalanceCard ingresos={ingresos} gastos={totalGastos} />

            {/* ── ARQUEADA DE CAJA (TRACKING) ────────────────────────────────── */}
            <Card className="mb-8 p-5">
                <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center gap-3">
                        <Icon name="cash-register" size={20} color="#F5A524" />
                        <Text className="text-white font-black text-base uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                            Arqueada de Caja
                        </Text>
                    </View>
                    <View className="flex-row gap-2">
                        <Button
                            title={showApertura ? 'Cancelar' : 'Apertura'}
                            icon={showApertura ? 'close' : 'bank-plus'}
                            variant="ghost"
                            size="sm"
                            onPress={() => { setShowApertura(!showApertura); setAperturaDenominaciones({}); }}
                        />
                        <Button title="" icon="refresh" variant="ghost" size="sm" onPress={fetchCajaResumen} />
                    </View>
                </View>

                {showApertura && (
                    <View className="mb-4 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/15">
                        <Text className="text-orange-300 text-xs font-bold mb-3 uppercase tracking-widest">Cargar billetes en caja</Text>
                        <DenominacionSelector value={aperturaDenominaciones} onChange={setAperturaDenominaciones} titulo="" />
                        <Button
                            title="Registrar Apertura"
                            icon="check"
                            variant="primary"
                            size="sm"
                            onPress={handleApertura}
                            disabled={Object.keys(aperturaDenominaciones).length === 0}
                            className="mt-3"
                        />
                    </View>
                )}

                {cajaResumen ? (
                    <View>
                        <View className="flex-row justify-between items-center mb-3 px-1">
                            <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">Estado actual en caja</Text>
                            <Text className="text-orange-400 font-black text-base" style={{ fontFamily: 'Space Grotesk' }}>
                                ${formatCurrency(cajaResumen.totalEfectivo)}
                            </Text>
                        </View>

                        <View className="gap-1.5">
                            {DENOMINACIONES_COP.map(({ valor, tipo, label }) => {
                                const qty = cajaResumen.estadoActual[String(valor)] ?? 0;
                                if (qty === 0) return null;
                                return (
                                    <View key={valor} className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03]">
                                        <View className="flex-row items-center gap-2">
                                            <View className={`w-1.5 h-1.5 rounded-full ${tipo === 'billete' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                                            <Text className="text-sm text-slate-300 w-20">{label}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-3">
                                            <Text className="text-slate-500 text-xs">×{qty}</Text>
                                            <Text className="text-sm text-emerald-400 font-bold w-20 text-right">{formatCurrency(qty * valor)}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {cajaResumen.totalEfectivo === 0 && (
                            <Text className="text-slate-600 text-xs text-center py-4">Sin movimientos de caja registrados hoy</Text>
                        )}

                        <View className="flex-row justify-between mt-3 pt-3 border-t border-white/5">
                            <Text className="text-slate-500 text-xs">Entradas: <Text className="text-emerald-400 font-bold">${formatCurrency(cajaResumen.totalEntradas)}</Text></Text>
                            <Text className="text-slate-500 text-xs">Salidas: <Text className="text-red-400 font-bold">${formatCurrency(cajaResumen.totalSalidas)}</Text></Text>
                        </View>
                    </View>
                ) : (
                    <Text className="text-slate-600 text-xs text-center py-4">No se pudo cargar el estado de caja</Text>
                )}
            </Card>

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
                <View className={`flex-row items-center gap-2 ${isMobile ? 'w-full' : 'flex-1 max-w-md'}`}>
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
                        />
                    </View>
                ))}
            </View>

            {/* ── GASTOS ─────────────────────────────────────────────────────────── */}
             <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-3">
                    <View className="w-1.5 h-6 bg-red-500 rounded-full" />
                    <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Gastos de Operación</Text>
                </View>
                <View className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <Text className="text-slate-500 font-bold text-xs">{gastos.length} items</Text>
                </View>
            </View>

            {errorGastos && (
                <View className="flex-row items-center gap-3 bg-red-500/10 p-5 rounded-3xl mb-8 border border-red-500/20">
                    <Icon name="alert-circle-outline" size={20} color="#EF4444" />
                    <Text className="text-red-400 text-xs font-bold leading-tight">{errorGastos}</Text>
                </View>
            )}

            {loadingGastos && !gastos.length && <ListSkeleton count={3} />}

            {!loadingGastos && gastos.length === 0 && !errorGastos && (
                <View className="items-center py-16 bg-white/5 rounded-[40px] border border-white/5 mb-10">
                    <Icon name="cash-remove" size={56} color="#1E293B" />
                    <Text className="text-slate-600 font-black mt-4 uppercase text-[10px] tracking-widest">No hay gastos reportados</Text>
                </View>
            )}

            <View className="flex-row flex-wrap gap-4 pb-20">
                {gastos.map((item: FacturaPago, idx: number) => (
                    <View key={item.pagosId?.toString() || idx.toString()} className={`${isWeb ? 'w-full lg:w-[49%]' : 'w-full'}`}>
                        <GastoRow
                            item={item}
                            onDelete={() => setDeleteTarget({ id: item.pagosId!, name: item.nombreGasto || 'gasto' })}
                            deleting={deleting}
                        />
                    </View>
                ))}
            </View>

            {/* Delete confirmation */}
            <ConfirmModal
                visible={!!deleteTarget}
                title="¿Eliminar registro de gasto?"
                message={`Estás a punto de borrar "${deleteTarget?.name}". Esta acción actualizará los balances diarios de forma permanente.`}
                icon="trash-can-outline"
                variant="danger"
                confirmText="Eliminar"
                loading={deleting}
                onConfirm={handleDeleteGasto}
                onCancel={() => setDeleteTarget(null)}
            />
        </PageContainer>
    );
}
