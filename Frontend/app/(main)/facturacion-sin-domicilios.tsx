import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TouchableOpacity, RefreshControl } from 'react-native';
import { View, Text } from '../../tw';
import {
    useFacturasRango,
    useApi,
    validateFlexibleDateRange,
    formatCurrency,
} from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';
import { FacturaCard, FacturaItem } from '../../components/facturas/FacturaShared';
import {
    PageContainer,
    PageHeader,
    Input,
    Icon,
    ListSkeleton,
    Card,
    DateRangeFilter,
    MethodFilterChips,
} from '../../components/ui';
import type { MethodFilterValue } from '../../components/ui';

// ─── Helper: calcula costo domicilio de una factura ──────────────────────────
function getDomicilioCost(f: FacturaItem): number {
    if (!f.domicilios || f.domicilios.length === 0) return 0;
    return f.domicilios.reduce((sum, d) => sum + (Number(d.costoDomicilio) || 0), 0);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FacturacionSinDomiciliosScreen() {
    const { isMobile, width } = useBreakpoint();
    const api = useApi();
    const [sortAsc, setSortAsc] = useState(false);
    const numCols = isMobile ? 1 : width >= 1500 ? 4 : width >= 1100 ? 3 : 2;

    // ── State ──
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [searchedFrom, setSearchedFrom] = useState('');
    const [searchedTo, setSearchedTo] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [periodStats, setPeriodStats] = useState<any>(null);
    const [metodoStats, setMetodoStats] = useState<any[]>([]);
    const [metodoFilter, setMetodoFilter] = useState<MethodFilterValue>('todos');
    const [nombreFilter, setNombreFilter] = useState('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // ── Data hooks ──
    const {
        data: facturas, loading: loadingFacturas, error: errorFacturas,
        setFrom: setFromF, setTo: setToF,
        search: searchF, updateEstado, updateFactura, deleteFactura,
        page: pageF, totalPages: totalPagesF, total: totalF, goToPage: goToPageF,
        fetchData: fetchFacturas,
    } = useFacturasRango(50);

    // ── Handlers ──
    const getApiFilters = useCallback((key: MethodFilterValue) => {
        let est: string | undefined = undefined;
        let met: string | undefined = undefined;
        if (key === 'pendiente') {
            est = 'pendiente';
        } else if (key !== 'todos') {
            met = key;
        }
        return { est, met };
    }, []);

    const fetchStats = useCallback(async (f: string, t: string) => {
        try {
            const [s, mp] = await Promise.all([
                api.estadisticas.resumenPeriodo(f, t),
                api.estadisticas.metodosPago(f, t),
            ]);
            setPeriodStats(s);
            setMetodoStats(mp);
        } catch { /* silent */ }
    }, [api]);

    const handleRefresh = useCallback(async () => {
        if (!hasSearched) return;
        setRefreshing(true);
        try {
            const { est, met } = getApiFilters(metodoFilter);
            await Promise.all([
                searchF(searchedFrom, searchedTo, est, nombreFilter || undefined, met),
                fetchStats(searchedFrom, searchedTo),
            ]);
        } catch { /* silent */ }
        setRefreshing(false);
    }, [hasSearched, searchedFrom, searchedTo, searchF, fetchStats, nombreFilter, metodoFilter, getApiFilters]);

    const handleSearch = useCallback((fromOverride?: string, toOverride?: string) => {
        const fromInput = fromOverride ?? from;
        const toInput = toOverride ?? to;
        const { from: fp, to: tp, error } = validateFlexibleDateRange(fromInput, toInput);
        if (error) return;
        setSearchedFrom(fp);
        setSearchedTo(tp);
        setFromF(fp); setToF(tp);
        const { est, met } = getApiFilters(metodoFilter);
        searchF(fp, tp, est, nombreFilter || undefined, met);
        void fetchStats(fp, tp);
        setHasSearched(true);
    }, [from, to, setFromF, setToF, searchF, fetchStats, nombreFilter, metodoFilter, getApiFilters]);

    const handleSelectMetodo = useCallback((key: MethodFilterValue) => {
        setMetodoFilter(key);
        if (hasSearched) {
            const { est, met } = getApiFilters(key);
            searchF(searchedFrom, searchedTo, est, nombreFilter || undefined, met);
        }
    }, [searchedFrom, searchedTo, nombreFilter, searchF, hasSearched, getApiFilters]);

    // Debounce nombre filter
    const searchFRef = useRef(searchF);
    useEffect(() => { searchFRef.current = searchF; }, [searchF]);
    useEffect(() => {
        if (!hasSearched) return;
        const t = setTimeout(() => {
            const { est, met } = getApiFilters(metodoFilter);
            searchFRef.current(searchedFrom, searchedTo, est, nombreFilter || undefined, met);
        }, 400);
        return () => clearTimeout(t);
    }, [nombreFilter, searchedFrom, searchedTo, metodoFilter, hasSearched, getApiFilters]);

    const handleToggleEstado = useCallback(async (
        facturaId: number, nuevoEstado: string, metodo?: string,
        pagoEfectivo?: number, pagoTransferencia?: number,
        denominaciones?: DenominacionesMap,
        cambioDenominaciones?: DenominacionesMap,
        cuentaTransferenciaId?: number,
        cuentaTransferenciaNombre?: string
    ) => {
        setUpdatingId(facturaId);
        try {
            if (nuevoEstado === 'pagado' && metodo)
                await updateFactura(facturaId, {
                    estado: 'pagado', metodo, pagoEfectivo, pagoTransferencia,
                    denominaciones, cambioDenominaciones, cuentaTransferenciaId, cuentaTransferenciaNombre,
                });
            else
                await updateEstado(facturaId, nuevoEstado);
            if (searchedFrom && searchedTo) fetchStats(searchedFrom, searchedTo);
        } catch { /* silent */ }
        setUpdatingId(null);
    }, [updateEstado, updateFactura, searchedFrom, searchedTo, fetchStats]);

    const handleAbono = useCallback(async (
        facturaId: number, monto: number, metodo: 'efectivo' | 'transferencia',
        denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap,
        cuentaTransferenciaId?: number, cuentaTransferenciaNombre?: string
    ) => {
        setUpdatingId(facturaId);
        try {
            await api.facturas.abono(facturaId, monto, metodo, denominaciones, cambioDenominaciones, cuentaTransferenciaId, cuentaTransferenciaNombre);
            await fetchFacturas();
            if (searchedFrom && searchedTo) fetchStats(searchedFrom, searchedTo);
        } catch { /* silent */ }
        setUpdatingId(null);
    }, [api, fetchFacturas, searchedFrom, searchedTo, fetchStats]);

    const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
        await updateFactura(facturaId, { total: newTotal });
        if (searchedFrom && searchedTo) fetchStats(searchedFrom, searchedTo);
    }, [updateFactura, searchedFrom, searchedTo, fetchStats]);

    const handleDeleteFactura = useCallback(async (facturaId: number): Promise<boolean> => {
        const ok = await deleteFactura(facturaId);
        if (ok && searchedFrom && searchedTo) fetchStats(searchedFrom, searchedTo);
        return ok;
    }, [deleteFactura, searchedFrom, searchedTo, fetchStats]);

    // ── Derived — Stats sin domicilios ──────────────────────────────────────────
    const loading = loadingFacturas;

    const totalDomiciliosCost = facturas.reduce((sum, f) => sum + getDomicilioCost(f as FacturaItem), 0);

    const ingresos = periodStats?.totalIngresosPagados ?? 0;
    const ingresosSinDom = ingresos - totalDomiciliosCost;

    const metodoCount = (m: string) => metodoStats.find((x) => x.metodo === m)?.cantidad ?? 0;
    const metodoCounts = {
        todos:         periodStats?.facturas ?? 0,
        efectivo:      metodoCount('efectivo') + metodoCount('mixto'),
        transferencia: metodoCount('transferencia') + metodoCount('mixto'),
        mixto:         metodoCount('mixto'),
        pendiente:     periodStats?.countIngresosPendientes ?? 0,
    };

    // Count facturas that are domicilio
    const countDomicilios = facturas.filter(f => (f as FacturaItem).ordenes?.some(o => o.tipoPedido === 'domicilio')).length;

    const sortedData = React.useMemo(() => {
        if (!sortAsc) return facturas;
        return [...facturas].reverse();
    }, [facturas, sortAsc]);

    const cardRows = React.useMemo(() => {
        const rows: any[][] = [];
        for (let i = 0; i < sortedData.length; i += numCols) {
            rows.push(sortedData.slice(i, i + numCols));
        }
        return rows;
    }, [sortedData, numCols]);

    return (
        <PageContainer
            scrollable
            maxWidthVariant="full"
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F5A524" colors={['#F5A524']} />
            }
        >
            <View className="px-4 pb-20">

                <PageHeader
                    title="Facturación Neta"
                    subtitle="Facturación sin costos de domicilio"
                    icon="cash-remove"
                />

                <DateRangeFilter
                    from={from}
                    to={to}
                    onFromChange={setFrom}
                    onToChange={setTo}
                    onSearch={(f, t) => { setFrom(f); setTo(t); handleSearch(f, t); }}
                    loading={loading}
                />

                {/* ── Empty prompt ── */}
                {!hasSearched && (
                    <View className="items-center py-24 opacity-30">
                        <Icon name="calendar-search" size={64} color="#64748B" />
                        <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                            Selecciona un rango de fechas y presiona Buscar
                        </Text>
                    </View>
                )}

                {/* ── Results ── */}
                {hasSearched && (
                    <>
                        {/* Filter chips */}
                        <View
                            className="rounded-2xl mb-5 p-3"
                            style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}
                        >
                            <MethodFilterChips value={metodoFilter} onChange={handleSelectMetodo} counts={metodoCounts} />

                            <Input
                                placeholder="Buscar por nombre de cliente..."
                                value={nombreFilter}
                                onChangeText={setNombreFilter}
                                size="sm"
                                containerStyle={{ marginBottom: 0 }}
                                leftIcon={<Icon name="account-search-outline" size={15} color="#475569" />}
                            />

                            <View className="flex-row items-center justify-between gap-3 flex-wrap">
                                <TouchableOpacity
                                    onPress={() => setSortAsc(prev => !prev)}
                                    className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 active:bg-white/10"
                                >
                                    <Icon name={sortAsc ? "sort-clock-ascending" : "sort-clock-descending"} size={16} color="#F5A524" />
                                    <Text className="text-xs font-bold text-slate-300">
                                        {sortAsc ? "Más antiguas" : "Más recientes"}
                                    </Text>
                                </TouchableOpacity>

                                {totalF > 0 && (
                                    <View className="flex-row items-center gap-3">
                                        <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                                            {totalF} resultados
                                        </Text>
                                        {countDomicilios > 0 && (
                                            <Text style={{ color: '#FB923C', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                                                {countDomicilios} con domicilio
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* ── Balance summary SIN domicilios ── */}
                        {!!periodStats && (
                            <Card className="mb-8 p-5" style={{ overflow: 'hidden' }}>
                                <View className="flex-row justify-between items-center mb-5">
                                    <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Resumen Neto (Sin Domicilios)
                                    </Text>
                                </View>

                                <View style={{ gap: 16 }}>
                                    {/* Ingresos Totales */}
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="arrow-down" size={16} color="#34D399" />
                                            </View>
                                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 13, fontWeight: 'bold' }}>Ingresos Totales</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18 }}>${formatCurrency(ingresos)}</Text>
                                    </View>

                                    {/* Costo Domicilios */}
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="moped-outline" size={16} color="#FB923C" />
                                            </View>
                                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 13, fontWeight: 'bold' }}>Costos de Domicilio</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#FB923C', fontSize: 18 }}>−${formatCurrency(totalDomiciliosCost)}</Text>
                                    </View>

                                    <View className="h-[1px] bg-white/5" />

                                    {/* Neto sin domicilios */}
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,165,36,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="cash-check" size={20} color="#F5A524" />
                                            </View>
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15, textTransform: 'uppercase' }}>FACTURACIÓN NETA</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, color: '#F5A524' }}>
                                            ${formatCurrency(Math.abs(ingresosSinDom))}
                                        </Text>
                                    </View>
                                </View>
                            </Card>
                        )}

                        {/* ── Facturas List ── */}
                        <View className="flex-row items-center gap-3 mb-4">
                            <View style={{ width: 6, height: 24, backgroundColor: '#F5A524', borderRadius: 999 }} />
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Facturas emitidas
                            </Text>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12 }}>{totalF}</Text>
                            </View>
                        </View>

                        {!!errorFacturas && (
                            <View className="flex-row items-center gap-3 bg-red-500/10 p-4 rounded-xl mb-4">
                                <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                                <Text className="text-red-400 text-xs font-bold">{errorFacturas}</Text>
                            </View>
                        )}

                        {loadingFacturas ? (
                            <ListSkeleton count={4} />
                        ) : sortedData.length === 0 ? (
                            <View className="items-center py-16 opacity-30">
                                <Icon name="email-off-outline" size={48} color="#64748B" />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                                    Sin facturas en este rango
                                </Text>
                            </View>
                        ) : (
                            <View className="gap-4 pb-4">
                                {cardRows.map((row, rIdx) => (
                                    <View key={rIdx} className="flex-row gap-4">
                                        {row.map((item: any, idx: number) => (
                                            <View key={item.facturaId?.toString() || String(idx)} className="flex-1">
                                                <FacturaCard
                                                    item={item}
                                                    isUpdating={updatingId === item.facturaId}
                                                    activeFilter={metodoFilter}
                                                    onToggleEstado={handleToggleEstado}
                                                    onUpdateTotal={handleUpdateTotal}
                                                    onDelete={handleDeleteFactura}
                                                    onAbono={handleAbono}
                                                />
                                            </View>
                                        ))}
                                        {row.length < numCols && Array.from({ length: numCols - row.length }).map((_, i) => (
                                            <View key={`empty-${i}`} className="flex-1" />
                                        ))}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Pagination */}
                        {totalPagesF > 1 && (
                            <View className="flex-row justify-center items-center gap-3 py-5">
                                <TouchableOpacity
                                    onPress={() => goToPageF(Math.max(1, pageF - 1))}
                                    disabled={pageF <= 1 || loadingFacturas}
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: pageF <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(245,165,36,0.15)', borderColor: pageF <= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(245,165,36,0.3)', opacity: pageF <= 1 ? 0.4 : 1 }}
                                >
                                    <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>← Anterior</Text>
                                </TouchableOpacity>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 }}>Pág {pageF} de {totalPagesF}</Text>
                                    <Text style={{ color: '#64748B', fontFamily: 'Outfit', fontSize: 11, marginTop: 2 }}>{totalF} facturas</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => goToPageF(Math.min(totalPagesF, pageF + 1))}
                                    disabled={pageF >= totalPagesF || loadingFacturas}
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: pageF >= totalPagesF ? 'rgba(255,255,255,0.05)' : 'rgba(245,165,36,0.15)', borderColor: pageF >= totalPagesF ? 'rgba(255,255,255,0.08)' : 'rgba(245,165,36,0.3)', opacity: pageF >= totalPagesF ? 0.4 : 1 }}
                                >
                                    <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>Siguiente →</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>
        </PageContainer>
    );
}
