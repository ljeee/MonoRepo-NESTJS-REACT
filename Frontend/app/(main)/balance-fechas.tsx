import React, { useReducer, useCallback } from 'react';
import { FlatList, RefreshControl, ScrollView, Platform } from 'react-native';

import { useFacturasRango } from '@monorepo/shared';
import { useFacturasPagosRango } from '@monorepo/shared';
import { buildCombinedBalanceCsv, buildFacturasBackupCsv, downloadCsv } from '../../utils/csvExport';
import { exportPdf } from '../../utils/exportData';
import { validateFlexibleDateRange } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, TouchableOpacity } from '../../tw';

import { FacturaCard } from '../../components/facturas/FacturaShared';
import {
    PageContainer,
    PageHeader,
    Button,
    Input,
    Icon,
    ListSkeleton,
    Badge,
    Card,
} from '../../components/ui';

// ─── Balance card ─────────────────────────────────────────────────────────────

function BalanceCard({ ingresos, gastos }: { ingresos: number; gastos: number }) {
    const neto = ingresos - gastos;
    const isPositive = neto >= 0;

    return (
        <Card className="mb-8 overflow-hidden relative border-0 p-0 bg-transparent">
            {/* Background Gradient & Pattern */}
            <View className="absolute inset-0 bg-slate-900" />
            <View className={`absolute inset-0 ${isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
            
            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-white/60 font-black text-xs uppercase tracking-widest">Resumen del Período</Text>
                    <View className={`px-3 py-1 rounded-full border ${isPositive ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
                         <Text className={`text-[10px] font-black uppercase ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? 'Superávit' : 'Déficit'}
                         </Text>
                    </View>
                </View>

                <View className="gap-y-4">
                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center">
                                <Icon name="arrow-down" size={16} color="#34D399" />
                            </View>
                            <Text className="text-slate-400 text-sm font-bold">Ingresos Totales</Text>
                        </View>
                        <Text className="text-white font-black text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                             ${formatCurrency(ingresos)}
                        </Text>
                    </View>

                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-3">
                            <View className="w-8 h-8 rounded-full bg-red-500/20 items-center justify-center">
                                <Icon name="arrow-up" size={16} color="#F87171" />
                            </View>
                            <Text className="text-slate-400 text-sm font-bold">Gastos Totales</Text>
                        </View>
                        <Text className="text-red-400 font-black text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                             −${formatCurrency(gastos)}
                        </Text>
                    </View>

                    <View className="h-[1px] bg-white/5 my-2" />

                    <View className="flex-row justify-between items-center">
                         <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center">
                                <Icon name="scale-balance" size={20} color="#F5A524" />
                            </View>
                            <Text className="text-white font-black text-base" style={{ fontFamily: 'Space Grotesk' }}>BALANCE NETO</Text>
                        </View>
                        <Text className={`font-black text-3xl ${isPositive ? 'text-(--color-pos-primary)' : 'text-red-500'}`} style={{ fontFamily: 'Space Grotesk' }}>
                             ${formatCurrency(Math.abs(neto))}
                        </Text>
                    </View>
                </View>
            </View>
        </Card>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BalanceFechasScreen() {
    const { isMobile } = useBreakpoint();
    // ── Grouped UI/filter state to avoid fragmented updates ──
    type FilterState = {
        from: string;
        to: string;
        filterError: string;
        updatingId: number | null;
    };

    type FilterAction =
        | { type: 'setFrom'; value: string }
        | { type: 'setTo'; value: string }
        | { type: 'setFilterError'; value: string }
        | { type: 'setUpdatingId'; value: number | null }
        | { type: 'setRange'; from: string; to: string };

    const [filterState, dispatch] = useReducer((state: FilterState, action: FilterAction): FilterState => {
        switch (action.type) {
            case 'setFrom': return { ...state, from: action.value };
            case 'setTo': return { ...state, to: action.value };
            case 'setFilterError': return { ...state, filterError: action.value };
            case 'setUpdatingId': return { ...state, updatingId: action.value };
            case 'setRange': return { ...state, from: action.from, to: action.to };
            default: return state;
        }
    }, {
        from: '',
        to: '',
        filterError: '',
        updatingId: null,
    });

    const { from, to, filterError, updatingId } = filterState;

    // ── Facturas hook ──
    const {
        data: facturas,
        loading: loadingFacturas,
        error: errorFacturas,
        setFrom: setFromF,
        setTo: setToF,
        fetchData: fetchFacturas,
        stats,
        updateEstado,
        updateFactura,
    } = useFacturasRango();

    // ── Gastos hook ──
    const {
        data: gastos,
        loading: loadingGastos,
        error: errorGastos,
        setFrom: setFromG,
        setTo: setToG,
        fetchData: fetchGastos,
    } = useFacturasPagosRango();

    const handleSearch = useCallback(() => {
        const { from: fromParsed, to: toParsed, error } = validateFlexibleDateRange(from, to);
        if (error) {
            dispatch({ type: 'setFilterError', value: error });
            return;
        }

        dispatch({ type: 'setFilterError', value: '' });
        dispatch({ type: 'setRange', from: fromParsed, to: toParsed });

        // Push dates into both hooks and fetch with explicit range args.
        setFromF(fromParsed); setToF(toParsed);
        setFromG(fromParsed); setToG(toParsed);
        void fetchFacturas(fromParsed, toParsed);
        void fetchGastos(fromParsed, toParsed);
    }, [from, to, setFromF, setToF, setFromG, setToG, fetchFacturas, fetchGastos]);

    const handleToggleEstado = useCallback(async (facturaId: number, nuevoEstado: string, metodo?: string) => {
        dispatch({ type: 'setUpdatingId', value: facturaId });
        try {
            if (nuevoEstado === 'pagado' && metodo) {
                await updateFactura(facturaId, { estado: 'pagado', metodo });
            } else {
                await updateEstado(facturaId, nuevoEstado);
            }
        } catch (error) {
            console.error('Error updating factura estado:', error);
        }
        dispatch({ type: 'setUpdatingId', value: null });
    }, [updateEstado, updateFactura]);

    const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
        await updateFactura(facturaId, { total: newTotal });
    }, [updateFactura]);



    const loading = loadingFacturas || loadingGastos;
    const hasData = facturas.length > 0 || gastos.length > 0;
    const ingresos = stats?.totalPagado ?? 0;
    const totalGastos = gastos.reduce((sum, g) => sum + (Number(g.total) || 0), 0);

    const renderFacturaItem = useCallback(({ item }: { item: (typeof facturas)[number] }) => (
        <View className={`mb-4 flex-1 ${isMobile ? '' : 'px-2'}`}>
            <FacturaCard
                item={item}
                isUpdating={updatingId === item.facturaId}
                onToggleEstado={handleToggleEstado}
                onUpdateTotal={handleUpdateTotal}
            />
        </View>
    ), [handleToggleEstado, handleUpdateTotal, updatingId, isMobile]);

    return (
        <PageContainer scrollable={false} className="flex-1">
            <FlatList
                data={facturas}
                className="flex-1"
                keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
                contentContainerStyle={{ paddingBottom: 40 }}
                ListHeaderComponent={
                    <View className="px-4">
                        <PageHeader
                            title="Balance Histórico"
                            subtitle="Facturación por rango"
                            icon="scale-balance"
                        />

                        {/* Actions bar */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-0 overflow-visible">
                            <View className="flex-row items-center gap-2 pr-4">
                                {/* Exports removed for mobile */}
                            </View>
                        </ScrollView>

                        {/* ── Date range filter ─────────────── */}
                        <Card className="mb-8 p-4">
                            <View className={`${isMobile ? 'flex-col' : 'flex-row'} items-end gap-3`}>
                                <Input
                                    label="Desde"
                                    value={from}
                                    onChangeText={(value) => dispatch({ type: 'setFrom', value })}
                                    placeholder="2025-01-01"
                                    className="flex-1"
                                    size="sm"
                                    leftIcon={<Icon name="calendar" size={16} color="#475569" />}
                                />
                                <Input
                                    label="Hasta"
                                    value={to}
                                    onChangeText={(value) => dispatch({ type: 'setTo', value })}
                                    placeholder="2026-12-31"
                                    className="flex-1"
                                    size="sm"
                                    leftIcon={<Icon name="calendar" size={16} color="#475569" />}
                                />
                                <Button
                                    title={loading ? '...' : 'Buscar'}
                                    icon="magnify"
                                    variant="primary"
                                    size="sm"
                                    onPress={handleSearch}
                                    disabled={!from || !to || loading}
                                    loading={loading}
                                    className={isMobile ? 'w-full h-12' : 'h-11 px-6'}
                                />
                            </View>
                            {filterError ? (
                                <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl border border-red-500/20 mt-4">
                                    <Icon name="alert-circle-outline" size={14} color="#EF4444" />
                                    <Text className="text-red-400 text-xs font-bold">{filterError}</Text>
                                </View>
                            ) : null}
                        </Card>

                        {/* Balance summary */}
                        {hasData && <BalanceCard ingresos={ingresos} gastos={totalGastos} />}

                        {loading && <ListSkeleton count={4} />}

                        {/* ── Facturas section header ─────────────────────────── */}
                        {!loading && (
                            <View className="flex-row items-center gap-3 mb-6 mt-4">
                                <View className="w-1.5 h-6 bg-(--color-pos-primary) rounded-full" />
                                <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Facturación</Text>
                                <View className="bg-white/5 px-2 py-0.5 rounded-md">
                                    <Text className="text-slate-500 font-black text-xs">{facturas.length}</Text>
                                </View>
                            </View>
                        )}

                        {errorFacturas && (
                            <View className="flex-row items-center gap-3 bg-red-500/10 p-4 rounded-xl mb-6">
                                <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                                <Text className="text-red-400 text-xs font-bold">{errorFacturas}</Text>
                            </View>
                        )}

                        {!loading && facturas.length === 0 && (
                            <View className="items-center py-20 opacity-30">
                                <Icon
                                    name={from && to ? 'email-off-outline' : 'calendar-search'}
                                    size={64}
                                    color="#64748B"
                                />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                                    {from && to
                                        ? 'Sin facturas en este rango'
                                        : 'Selecciona un rango de fechas y presiona Buscar'}
                                </Text>
                            </View>
                        )}
                    </View>
                }
                key={isMobile ? 'col_1' : 'col_2'}
                numColumns={isMobile ? 1 : 2}
                renderItem={renderFacturaItem}
                ListFooterComponent={
                    !loading && gastos.length > 0 ? (
                        <View className="px-4 mt-8 pb-10">
                            {/* ── Gastos section ─────────────────────────────────── */}
                            <View className="flex-row items-center gap-3 mb-6">
                                <View className="w-1.5 h-6 bg-red-500 rounded-full" />
                                <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Gastos Operativos</Text>
                                <View className="bg-white/5 px-2 py-0.5 rounded-md">
                                    <Text className="text-slate-500 font-black text-xs">{gastos.length}</Text>
                                </View>
                            </View>

                            {errorGastos && (
                                <View className="flex-row items-center gap-3 bg-red-500/10 p-4 rounded-xl mb-6">
                                    <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                                    <Text className="text-red-400 text-xs font-bold">{errorGastos}</Text>
                                </View>
                            )}

                            <View className="gap-y-3">
                                {gastos.map((item, idx) => (
                                    <View key={item.pagosId?.toString() || idx.toString()} className="w-full">
                                        <Card className="flex-row items-center gap-4 p-4 border border-white/5 bg-white/5">
                                            <View className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center">
                                                <Icon
                                                    name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'}
                                                    size={20}
                                                    color="#F5A524"
                                                />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-white font-black text-sm uppercase" style={{ fontFamily: 'Space Grotesk' }}>{item.nombreGasto || 'Sin nombre'}</Text>
                                                <View className="flex-row items-center gap-2 mt-1">
                                                    <Text className="text-slate-500 text-[10px] font-bold uppercase">{item.fechaFactura}</Text>
                                                    <Badge label={item.metodo || '—'} variant="warning" size="sm" />
                                                </View>
                                            </View>
                                            <Text className="text-red-400 font-black text-base" style={{ fontFamily: 'Space Grotesk' }}>−${formatCurrency(item.total ?? 0)}</Text>
                                        </Card>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null
                }
            />
        </PageContainer>
    );
}
