import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { FacturaCard } from '../../components/facturas/FacturaShared';
import {
    PageContainer,
    PageHeader,
    Input,
    Icon,
    ListSkeleton,
    Card,
    DateRangeFilter,
} from '../../components/ui';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function QrTransferenciasScreen() {
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
    const [nombreFilter, setNombreFilter] = useState('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // ── Cuentas QR ──
    const [cuentas, setCuentas] = useState<any[]>([]);
    const [selectedCuentaId, setSelectedCuentaId] = useState<number | 'sin_asignar' | undefined>(undefined);

    useEffect(() => {
        api.empresa.cuentasTransferencia.getAll()
            .then(res => setCuentas((res || []).filter((c: any) => c.activa)))
            .catch(() => {});
    }, [api]);

    // ── Data hooks — only QR/transferencia ──
    const {
        data: facturas, loading: loadingFacturas, error: errorFacturas,
        setFrom: setFromF, setTo: setToF,
        search: searchF, updateEstado, updateFactura, deleteFactura,
        page: pageF, totalPages: totalPagesF, total: totalF, goToPage: goToPageF,
        fetchData: fetchFacturas,
    } = useFacturasRango(50);

    // ── Handlers ──
    const doSearch = useCallback((f: string, t: string, nombre?: string, cuentaId?: number | 'sin_asignar') => {
        // Always filter by transferencia method
        const apiCuentaId = cuentaId === 'sin_asignar' ? -1 : (cuentaId as number | undefined);
        searchF(f, t, undefined, nombre || undefined, 'transferencia', apiCuentaId);
    }, [searchF]);

    const handleRefresh = useCallback(async () => {
        if (!hasSearched) return;
        setRefreshing(true);
        try {
            doSearch(searchedFrom, searchedTo, nombreFilter, selectedCuentaId);
        } catch { /* silent */ }
        setRefreshing(false);
    }, [hasSearched, searchedFrom, searchedTo, nombreFilter, selectedCuentaId, doSearch]);

    const handleSearch = useCallback((fromOverride?: string, toOverride?: string) => {
        const fromInput = fromOverride ?? from;
        const toInput = toOverride ?? to;
        const { from: fp, to: tp, error } = validateFlexibleDateRange(fromInput, toInput);
        if (error) return;
        setSearchedFrom(fp);
        setSearchedTo(tp);
        setFromF(fp); setToF(tp);
        doSearch(fp, tp, nombreFilter, selectedCuentaId);
        setHasSearched(true);
    }, [from, to, setFromF, setToF, nombreFilter, selectedCuentaId, doSearch]);

    const handleSelectCuenta = useCallback((cuentaId: number | 'sin_asignar' | undefined) => {
        setSelectedCuentaId(cuentaId);
        if (hasSearched) {
            doSearch(searchedFrom, searchedTo, nombreFilter, cuentaId);
        }
    }, [hasSearched, searchedFrom, searchedTo, nombreFilter, doSearch]);

    // Debounce nombre filter
    const doSearchRef = useRef(doSearch);
    useEffect(() => { doSearchRef.current = doSearch; }, [doSearch]);
    useEffect(() => {
        if (!hasSearched) return;
        const t = setTimeout(() => {
            doSearchRef.current(searchedFrom, searchedTo, nombreFilter, selectedCuentaId);
        }, 400);
        return () => clearTimeout(t);
    }, [nombreFilter, searchedFrom, searchedTo, hasSearched, selectedCuentaId]);

    const handleToggleEstado = useCallback(async (
        facturaId: number, nuevoEstado: string, metodo?: string,
        pagoEfectivo?: number, pagoTransferencia?: number,
        denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap,
        cuentaTransferenciaId?: number, cuentaTransferenciaNombre?: string
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
        } catch { /* silent */ }
        setUpdatingId(null);
    }, [updateEstado, updateFactura]);

    const handleAbono = useCallback(async (
        facturaId: number, monto: number, metodo: 'efectivo' | 'transferencia',
        denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap,
        cuentaTransferenciaId?: number, cuentaTransferenciaNombre?: string
    ) => {
        setUpdatingId(facturaId);
        try {
            await api.facturas.abono(facturaId, monto, metodo, denominaciones, cambioDenominaciones, cuentaTransferenciaId, cuentaTransferenciaNombre);
            await fetchFacturas();
        } catch { /* silent */ }
        setUpdatingId(null);
    }, [api, fetchFacturas]);

    const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
        await updateFactura(facturaId, { total: newTotal });
    }, [updateFactura]);

    const handleDeleteFactura = useCallback(async (facturaId: number): Promise<boolean> => {
        return deleteFactura(facturaId);
    }, [deleteFactura]);

    // ── Derived: breakdown by account ──
    const accountBreakdown = useMemo(() => {
        const breakdown: Record<string, { total: number; count: number }> = {};
        facturas.forEach(f => {
            const isPagado = f.estado === 'pagado' || f.estado === 'pagada';
            if (!isPagado) return;
            const esTransfer = f.metodo === 'transferencia' || f.metodo === 'qr';
            const esMixtoTrans = f.metodo === 'efectivo_transferencia' && (f.pagoTransferencia ?? 0) > 0;
            if (!esTransfer && !esMixtoTrans) return;

            const cuentaLocal = cuentas.find(c => c.id === f.cuentaTransferenciaId);
            const cuentaNom = cuentaLocal?.nombre || f.cuentaTransferenciaNombre || 'Sin asignar';
            const monto = esMixtoTrans ? (f.pagoTransferencia ?? 0) : (f.total ?? 0);
            if (!breakdown[cuentaNom]) breakdown[cuentaNom] = { total: 0, count: 0 };
            breakdown[cuentaNom].total += monto;
            breakdown[cuentaNom].count += 1;
        });
        return breakdown;
    }, [facturas, cuentas]);

    const sortedData = useMemo(() => {
        if (!sortAsc) return facturas;
        return [...facturas].reverse();
    }, [facturas, sortAsc]);

    const cardRows = useMemo(() => {
        const rows: any[][] = [];
        for (let i = 0; i < sortedData.length; i += numCols) {
            rows.push(sortedData.slice(i, i + numCols));
        }
        return rows;
    }, [sortedData, numCols]);

    const totalTransferencias = Object.values(accountBreakdown).reduce((s, v) => s + v.total, 0);
    const sinAsignarData = accountBreakdown['Sin asignar'];
    const loading = loadingFacturas;

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
                    title="QR / Transferencias"
                    subtitle="Desglose por cuenta de destino"
                    icon="qrcode-scan"
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
                        <Icon name="qrcode-scan" size={64} color="#64748B" />
                        <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                            Selecciona un rango de fechas para ver transferencias
                        </Text>
                    </View>
                )}

                {/* ── Results ── */}
                {hasSearched && (
                    <>
                        {/* ── Filter by Cuenta QR ── */}
                        <View
                            className="rounded-2xl mb-5 p-3"
                            style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}
                        >
                            {/* Cuenta chips */}
                            {cuentas.length > 0 && (
                                <View style={{ gap: 6 }}>
                                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Filtrar por Cuenta:
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        <TouchableOpacity
                                            onPress={() => handleSelectCuenta(undefined)}
                                            style={{
                                                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                                                backgroundColor: selectedCuentaId === undefined ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)',
                                                borderWidth: 1,
                                                borderColor: selectedCuentaId === undefined ? '#A78BFA' : 'rgba(255,255,255,0.08)',
                                            }}
                                        >
                                            <Text style={{ fontFamily: 'Outfit', color: selectedCuentaId === undefined ? '#F3E8FF' : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                                                Todas
                                            </Text>
                                        </TouchableOpacity>
                                        {cuentas.map(c => {
                                            const isSelected = selectedCuentaId === c.id;
                                            return (
                                                <TouchableOpacity
                                                    key={c.id}
                                                    onPress={() => handleSelectCuenta(c.id)}
                                                    style={{
                                                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                                                        backgroundColor: isSelected ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)',
                                                        borderWidth: 1,
                                                        borderColor: isSelected ? '#A78BFA' : 'rgba(255,255,255,0.08)',
                                                    }}
                                                >
                                                    <Text style={{ fontFamily: 'Outfit', color: isSelected ? '#F3E8FF' : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                                                        {c.nombre}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        <TouchableOpacity
                                            onPress={() => handleSelectCuenta('sin_asignar')}
                                            style={{
                                                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                                                backgroundColor: selectedCuentaId === 'sin_asignar' ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.04)',
                                                borderWidth: 1,
                                                borderColor: selectedCuentaId === 'sin_asignar' ? '#F43F5E' : 'rgba(255,255,255,0.08)',
                                            }}
                                        >
                                            <Text style={{ fontFamily: 'Outfit', color: selectedCuentaId === 'sin_asignar' ? '#FEE2E2' : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                                                ⚠ Sin asignar
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

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
                                    <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                                        {totalF} transferencias encontradas
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* ── Summary by Account ── */}
                        {Object.keys(accountBreakdown).length > 0 && (
                            <Card className="mb-8 p-5" style={{ overflow: 'hidden' }}>
                                <View className="flex-row justify-between items-center mb-5">
                                    <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Desglose por Cuenta
                                    </Text>
                                    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, backgroundColor: 'rgba(96,165,250,0.2)', borderColor: 'rgba(96,165,250,0.3)' }}>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, textTransform: 'uppercase', color: '#60A5FA' }}>
                                            QR / Transfer
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ gap: 12 }}>
                                    {/* Per account rows */}
                                    {Object.entries(accountBreakdown).map(([cuenta, data]) => {
                                        const isSinAsignar = cuenta === 'Sin asignar';
                                        return (
                                            <View key={cuenta} className="flex-row justify-between items-center">
                                                <View className="flex-row items-center gap-3">
                                                    <View style={{
                                                        width: 32, height: 32, borderRadius: 16,
                                                        backgroundColor: isSinAsignar ? 'rgba(244,63,94,0.2)' : 'rgba(167,139,250,0.2)',
                                                        alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Icon
                                                            name={isSinAsignar ? 'alert-circle-outline' : 'bank-outline'}
                                                            size={16}
                                                            color={isSinAsignar ? '#F43F5E' : '#A78BFA'}
                                                        />
                                                    </View>
                                                    <View>
                                                        <Text style={{ fontFamily: 'Outfit', color: isSinAsignar ? '#F87171' : '#CBD5E1', fontSize: 13, fontWeight: 'bold' }}>
                                                            {cuenta}
                                                        </Text>
                                                        <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase' }}>
                                                            {data.count} {data.count === 1 ? 'factura' : 'facturas'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: isSinAsignar ? '#F87171' : '#A78BFA', fontSize: 16 }}>
                                                    ${formatCurrency(data.total)}
                                                </Text>
                                            </View>
                                        );
                                    })}

                                    <View className="h-[1px] bg-white/5" />

                                    {/* Total */}
                                    <View className="flex-row justify-between items-center">
                                        <View className="flex-row items-center gap-3">
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(96,165,250,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon name="qrcode-scan" size={20} color="#60A5FA" />
                                            </View>
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15, textTransform: 'uppercase' }}>TOTAL TRANSFERENCIAS</Text>
                                        </View>
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, color: '#60A5FA' }}>
                                            ${formatCurrency(totalTransferencias)}
                                        </Text>
                                    </View>

                                    {/* Alert for unassigned */}
                                    {sinAsignarData && sinAsignarData.count > 0 && (
                                        <View style={{
                                            backgroundColor: 'rgba(244,63,94,0.08)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(244,63,94,0.2)',
                                            borderRadius: 14,
                                            padding: 12,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 10,
                                        }}>
                                            <Icon name="alert-outline" size={18} color="#F43F5E" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F87171', fontSize: 11, textTransform: 'uppercase' }}>
                                                    {sinAsignarData.count} {sinAsignarData.count === 1 ? 'factura sin cuenta asignada' : 'facturas sin cuenta asignada'}
                                                </Text>
                                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, marginTop: 2 }}>
                                                    {`Total: $${formatCurrency(sinAsignarData.total)} — Usa el filtro "Sin asignar" para verlas`}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </Card>
                        )}

                        {/* ── Facturas List ── */}
                        <View className="flex-row items-center gap-3 mb-4">
                            <View style={{ width: 6, height: 24, backgroundColor: '#60A5FA', borderRadius: 999 }} />
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 }}>
                                Facturas con Transferencia
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
                                <Icon name="qrcode-scan" size={48} color="#64748B" />
                                <Text className="text-slate-400 font-bold mt-4 uppercase text-center text-xs px-10">
                                    Sin transferencias en este rango
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
                                                    activeFilter="transferencia"
                                                    onToggleEstado={handleToggleEstado}
                                                    onUpdateTotal={handleUpdateTotal}
                                                    onDelete={handleDeleteFactura}
                                                    onAbono={handleAbono}
                                                    onUpdate={updateFactura}
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
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: pageF <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(96,165,250,0.15)', borderColor: pageF <= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(96,165,250,0.3)', opacity: pageF <= 1 ? 0.4 : 1 }}
                                >
                                    <Text style={{ color: '#60A5FA', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>← Anterior</Text>
                                </TouchableOpacity>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 }}>Pág {pageF} de {totalPagesF}</Text>
                                    <Text style={{ color: '#64748B', fontFamily: 'Outfit', fontSize: 11, marginTop: 2 }}>{totalF} transferencias</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => goToPageF(Math.min(totalPagesF, pageF + 1))}
                                    disabled={pageF >= totalPagesF || loadingFacturas}
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: pageF >= totalPagesF ? 'rgba(255,255,255,0.05)' : 'rgba(96,165,250,0.15)', borderColor: pageF >= totalPagesF ? 'rgba(255,255,255,0.08)' : 'rgba(96,165,250,0.3)', opacity: pageF >= totalPagesF ? 0.4 : 1 }}
                                >
                                    <Text style={{ color: '#60A5FA', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>Siguiente →</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>
        </PageContainer>
    );
}
