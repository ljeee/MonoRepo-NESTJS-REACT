import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TouchableOpacity, RefreshControl } from 'react-native';
import { View, Text } from '../../tw';
import {
    useFacturasRango,
    useFacturasPagosRango,
    useApi,
    mapFactura,
    validateFlexibleDateRange,
    formatCurrency,
} from '@/src/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportPdf } from '../../utils/exportData';
import { useBreakpoint } from '../../styles/responsive';
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
    DateRangeFilter,
    MethodFilterChips,
} from '../../components/ui';
import type { MethodFilterValue } from '../../components/ui';



export default function BalanceFechasScreen() {
    const { isMobile } = useBreakpoint();
    const api = useApi();

    // ── State ──────────────────────────────────────────────────────────────────
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    /** Normalized dates used for API calls (validated on last Buscar) */
    const [searchedFrom, setSearchedFrom] = useState('');
    const [searchedTo, setSearchedTo] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [periodStats, setPeriodStats] = useState<any>(null);
    const [metodoStats, setMetodoStats] = useState<any[]>([]);
    const [exporting, setExporting] = useState(false);
    const [metodoFilter, setMetodoFilter] = useState<MethodFilterValue>('todos');
    const [nombreFilter, setNombreFilter] = useState('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const getApiFilters = useCallback((key: MethodFilterValue) => {
        let est: string | undefined = undefined;
        let met: string | undefined = undefined;
        if (key === 'pendiente') {
            est = 'pendiente';
        } else if (key !== 'todos') {
            est = 'pagado';
            met = key;
        }
        return { est, met };
    }, []);

    // ── Data hooks ─────────────────────────────────────────────────────────────
    const {
        data: facturas, loading: loadingFacturas, error: errorFacturas,
        setFrom: setFromF, setTo: setToF,
        search: searchF, updateEstado, updateFactura, deleteFactura,
        page: pageF, totalPages: totalPagesF, total: totalF, goToPage: goToPageF,
    } = useFacturasRango(50);

    const {
        data: gastos, loading: loadingGastos, error: errorGastos,
        setFrom: setFromG, setTo: setToG, fetchData: fetchGastos,
        page: pageG, totalPages: totalPagesG, total: totalG, goToPage: goToPageG,
    } = useFacturasPagosRango(50);

    // ── Handlers ───────────────────────────────────────────────────────────────
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
                fetchGastos(searchedFrom, searchedTo, 1),
                fetchStats(searchedFrom, searchedTo)
            ]);
        } catch { /* silent */ }
        setRefreshing(false);
    }, [hasSearched, searchedFrom, searchedTo, searchF, fetchGastos, fetchStats, nombreFilter, metodoFilter, getApiFilters]);

    const handleSearch = useCallback((fromOverride?: string, toOverride?: string) => {
        const fromInput = fromOverride ?? from;
        const toInput = toOverride ?? to;
        const { from: fp, to: tp, error } = validateFlexibleDateRange(fromInput, toInput);
        if (error) return;
        setSearchedFrom(fp);
        setSearchedTo(tp);
        setFromF(fp); setToF(tp);
        setFromG(fp); setToG(tp);
        const { est, met } = getApiFilters(metodoFilter);
        searchF(fp, tp, est, nombreFilter || undefined, met);
        void fetchGastos(fp, tp, 1);
        void fetchStats(fp, tp);
        setHasSearched(true);
    }, [from, to, setFromF, setToF, setFromG, setToG, searchF, fetchGastos, fetchStats, nombreFilter, metodoFilter, getApiFilters]);

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
        denominaciones?: Record<string, number>
    ) => {
        setUpdatingId(facturaId);
        try {
            if (nuevoEstado === 'pagado' && metodo)
                await updateFactura(facturaId, { estado: 'pagado', metodo, pagoEfectivo, pagoTransferencia, denominaciones });
            else
                await updateEstado(facturaId, nuevoEstado);
            if (searchedFrom && searchedTo) fetchStats(searchedFrom, searchedTo);
        } catch { /* silent */ }
        setUpdatingId(null);
    }, [updateEstado, updateFactura, searchedFrom, searchedTo, fetchStats]);

    const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
        await updateFactura(facturaId, { total: newTotal });
        if (searchedFrom && searchedTo) fetchStats(searchedFrom, searchedTo);
    }, [updateFactura, searchedFrom, searchedTo, fetchStats]);

    const handleDeleteFactura = useCallback(async (facturaId: number): Promise<boolean> => {
        const ok = await deleteFactura(facturaId);
        if (ok && searchedFrom && searchedTo) fetchStats(searchedFrom, searchedTo);
        return ok;
    }, [deleteFactura, searchedFrom, searchedTo, fetchStats]);

    const fetchAllForExport = async () => {
        setExporting(true);
        try {
            const { est, met } = getApiFilters(metodoFilter);
            const [fr, gr] = await Promise.all([
                api.facturas.getAll({ from: searchedFrom, to: searchedTo, page: 1, limit: 9999, estado: est, metodo: met, clienteNombre: nombreFilter || undefined }),
                api.pagos.getAll({ from: searchedFrom, to: searchedTo, page: 1, limit: 9999 }),
            ]);
            return { mf: fr.data.map(mapFactura), mg: gr.data || [] };
        } catch { return { mf: [], mg: [] }; }
        finally { setExporting(false); }
    };

    const handleExportPdf = useCallback(async () => {
        const { mf, mg } = await fetchAllForExport();
        if (!mf.length && !mg.length) return;
        exportPdf({
            title: `Balance ${searchedFrom || 'inicio'} – ${searchedTo || 'fin'}`,
            subtitle: `${mf.length + mg.length} registros`,
            headers: ['Tipo', 'ID', 'Nombre', 'Fecha', 'Total', 'Estado', 'Método'],
            rows: [
                ...mf.map(f => ['Ingreso', f.facturaId ?? '', f.clienteNombre || '—', f.fechaFactura || '', `$${formatCurrency(Number(f.total) || 0)}`, f.estado || '', f.metodo || '']),
                ...mg.map(g => ['Gasto', g.pagosId ?? '', g.nombreGasto || '—', g.fechaFactura || '', `$${formatCurrency(Number(g.total) || 0)}`, g.estado || '', g.metodo || '']),
            ],
        });
    }, [searchedFrom, searchedTo, metodoFilter, nombreFilter, api]);

    const handleExportCsv = useCallback(async () => {
        const { mf, mg } = await fetchAllForExport();
        if (!mf.length && !mg.length) return;
        const csv = await buildCombinedBalanceCsv(mf, mg);
        downloadCsv(csv, `contabilidad_${searchedFrom || 'inicio'}_${searchedTo || 'fin'}.csv`);
    }, [searchedFrom, searchedTo, metodoFilter, nombreFilter, api]);

    // ── Derived values ─────────────────────────────────────────────────────────
    const loading = loadingFacturas || loadingGastos || exporting;
    const ingresos = periodStats?.totalIngresosPagados ?? 0;
    const egresos = periodStats?.totalEgresos ?? 0;
    const neto = ingresos - egresos;

    // Conteos por método del período (metodosPago ya tiene bucket 'mixto' propio).
    // El filtrado real es server-side; estos números son del rango completo (no de la página).
    const metodoCount = (m: string) => metodoStats.find((x) => x.metodo === m)?.cantidad ?? 0;
    const metodoCounts = {
        todos:         periodStats?.facturas ?? 0,
        efectivo:      metodoCount('efectivo'),
        transferencia: metodoCount('transferencia'),
        mixto:         metodoCount('mixto'),
        pendiente:     periodStats?.countIngresosPendientes ?? 0,
    };

    return (
        <PageContainer
            scrollable
            maxWidthVariant="full"
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#F5A524"
                    colors={['#F5A524']}
                />
            }
        >
            <View className="px-4 pb-20">

                <PageHeader
                    title="Balance Histórico"
                    subtitle="Facturación por rango"
                    icon="scale-balance"
                />

                <DateRangeFilter
                    from={from}
                    to={to}
                    onFromChange={setFrom}
                    onToChange={setTo}
                    onSearch={(f, t) => { setFrom(f); setTo(t); handleSearch(f, t); }}
                    loading={loading}
                />

                {/* ── Empty prompt (before first search) ─────────────────── */}
                {!hasSearched && (
                    <View className="items-center py-24 opacity-30">
                        <Icon name="calendar-search" size={64} color="#64748B" />
                        <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                            Selecciona un rango de fechas y presiona Buscar
                        </Text>
                    </View>
                )}

                {/* ── Results — only mounts after first search ────────────── */}
                {hasSearched && (
                    <>
                        {/* Filter chips + export */}
                        <View
                            className="rounded-2xl mb-5 p-3"
                            style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}
                        >
                            {/* Chips de filtro unificados por método de pago y estado pendiente */}
                            <MethodFilterChips value={metodoFilter} onChange={handleSelectMetodo} counts={metodoCounts} />

                            <Input
                                placeholder="Buscar por nombre de cliente..."
                                value={nombreFilter}
                                onChangeText={setNombreFilter}
                                size="sm"
                                containerStyle={{ marginBottom: 0 }}
                                leftIcon={<Icon name="account-search-outline" size={15} color="#475569" />}
                            />

                            <View className="flex-row flex-wrap items-center gap-2">
                                <Button title="PDF" icon="file-pdf-outline" variant="secondary" size="sm" onPress={handleExportPdf} disabled={!periodStats || exporting} loading={exporting} className="bg-purple-600/20 border-purple-500/30" />
                                <Button title="CSV" icon="table-large" variant="secondary" size="sm" onPress={handleExportCsv} disabled={!periodStats || exporting} loading={exporting} className="bg-emerald-600/20 border-emerald-500/30" />
                                {totalF > 0 && (
                                    <View className="flex-1 items-end">
                                        <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{totalF} resultados</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Balance summary */}
                        {!!periodStats && (
                            <Card className="mb-8 p-5" style={{ overflow: 'hidden' }}>
                                <View className="flex-row justify-between items-center mb-5">
                                    <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Resumen del Período
                                    </Text>
                                    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, backgroundColor: neto >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', borderColor: neto >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, textTransform: 'uppercase', color: neto >= 0 ? '#34D399' : '#F87171' }}>
                                            {neto >= 0 ? 'Superávit' : 'Déficit'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ gap: 16 }}>
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="arrow-down" size={16} color="#34D399" />
                                            </View>
                                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 13, fontWeight: 'bold' }}>Ingresos Totales</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18 }}>${formatCurrency(ingresos)}</Text>
                                    </View>

                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="arrow-up" size={16} color="#F87171" />
                                            </View>
                                            <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 13, fontWeight: 'bold' }}>Gastos Totales</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F87171', fontSize: 18 }}>−${formatCurrency(egresos)}</Text>
                                    </View>

                                    <View className="h-[1px] bg-white/5" />

                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,165,36,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="scale-balance" size={20} color="#F5A524" />
                                            </View>
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15, textTransform: 'uppercase' }}>BALANCE NETO</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, color: neto >= 0 ? '#F5A524' : '#EF4444' }}>
                                            ${formatCurrency(Math.abs(neto))}
                                        </Text>
                                    </View>
                                </View>
                            </Card>
                        )}

                        {/* ── Facturas emitidas ────────────────────────────── */}
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
                        ) : facturas.length === 0 ? (
                            <View className="items-center py-16 opacity-30">
                                <Icon name="email-off-outline" size={48} color="#64748B" />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                                    Sin facturas en este rango
                                </Text>
                            </View>
                        ) : (
                            <View style={{ flexDirection: isMobile ? 'column' : 'row', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: 12, marginBottom: 4 }}>
                                {facturas.map((item: any, idx: number) => (
                                    <View
                                        key={item.facturaId?.toString() || String(idx)}
                                        style={isMobile ? { width: '100%' } : { width: '48%' }}
                                    >
                                        <FacturaCard
                                            item={item}
                                            isUpdating={updatingId === item.facturaId}
                                            onToggleEstado={handleToggleEstado}
                                            onUpdateTotal={handleUpdateTotal}
                                            onDelete={handleDeleteFactura}
                                        />
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Pagination — Facturas */}
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

                        {/* ── Gastos operativos ────────────────────────────── */}
                        {(gastos.length > 0 || loadingGastos) && (
                            <View className="mt-8 mb-4">
                                <View className="flex-row items-center gap-3 mb-5">
                                    <View style={{ width: 6, height: 24, backgroundColor: '#EF4444', borderRadius: 999 }} />
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Gastos Operativos
                                    </Text>
                                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12 }}>{totalG}</Text>
                                    </View>
                                </View>

                                {!!errorGastos && (
                                    <View className="flex-row items-center gap-3 bg-red-500/10 p-4 rounded-xl mb-4">
                                        <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                                        <Text className="text-red-400 text-xs font-bold">{errorGastos}</Text>
                                    </View>
                                )}

                                {loadingGastos ? (
                                    <ListSkeleton count={3} />
                                ) : (
                                    <View style={{ gap: 10 }}>
                                        {gastos.map((item: any, idx: number) => (
                                            <Card
                                                key={item.pagosId?.toString() || String(idx)}
                                                className="flex-row items-center gap-4 p-4 border border-white/5 bg-white/5"
                                            >
                                                <View className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center">
                                                    <Icon name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'} size={20} color="#F5A524" />
                                                </View>
                                                <View className="flex-1">
                                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14, textTransform: 'uppercase' }}>
                                                        {item.nombreGasto || 'Gasto General'}
                                                    </Text>
                                                    <View className="flex-row items-center gap-2 mt-1">
                                                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase', fontWeight: 'bold' }}>
                                                            {item.fechaFactura}
                                                        </Text>
                                                        <Badge label={item.metodo || '—'} variant="warning" size="sm" />
                                                    </View>
                                                </View>
                                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F87171', fontSize: 15 }}>
                                                    −${formatCurrency(item.total ?? 0)}
                                                </Text>
                                            </Card>
                                        ))}
                                    </View>
                                )}

                                {/* Pagination — Gastos */}
                                {totalPagesG > 1 && (
                                    <View className="flex-row justify-center items-center gap-3 py-5">
                                        <TouchableOpacity
                                            onPress={() => goToPageG(Math.max(1, pageG - 1))}
                                            disabled={pageG <= 1 || loadingGastos}
                                            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: pageG <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.15)', borderColor: pageG <= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.3)', opacity: pageG <= 1 ? 0.4 : 1 }}
                                        >
                                            <Text style={{ color: '#EF4444', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>← Anterior</Text>
                                        </TouchableOpacity>
                                        <View style={{ alignItems: 'center' }}>
                                            <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 }}>Pág {pageG} de {totalPagesG}</Text>
                                            <Text style={{ color: '#64748B', fontFamily: 'Outfit', fontSize: 11, marginTop: 2 }}>{totalG} gastos</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => goToPageG(Math.min(totalPagesG, pageG + 1))}
                                            disabled={pageG >= totalPagesG || loadingGastos}
                                            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: pageG >= totalPagesG ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.15)', borderColor: pageG >= totalPagesG ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.3)', opacity: pageG >= totalPagesG ? 0.4 : 1 }}
                                        >
                                            <Text style={{ color: '#EF4444', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>Siguiente →</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                    </>
                )}

            </View>
        </PageContainer>
    );
}
