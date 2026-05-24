import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, TouchableOpacity } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { useFacturasRango, validateFlexibleDateRange, formatCurrency, useApi } from '@/src/shared';
import { useFacturasPagosRango } from '@/src/shared';
import type { FacturaVenta, FacturaPago, ResumenPeriodo } from '@/src/shared';
import {
    buildCombinedBalanceCsv,
    buildFacturasBackupCsv,
    downloadCsv,
} from '../../utils/csvExport';
import {
    exportFacturasPdf,
    exportLibroDiario,
    exportBalanceDePrueba,
    exportBalancePorTercero,
    exportInformeImpuesto,
} from '../../utils/exportData';
import {
    PageContainer,
    PageHeader,
    Button,
    Input,
    Icon,
    Card,
    Badge,
    ListSkeleton,
} from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'resumen' | 'ventas' | 'egresos' | 'reportes';

const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'resumen', label: 'Resumen', icon: 'chart-box-outline' },
    { id: 'ventas', label: 'Ventas', icon: 'receipt' },
    { id: 'egresos', label: 'Egresos', icon: 'cash-minus' },
    { id: 'reportes', label: 'Reportes', icon: 'file-chart-outline' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
}

function metodoLabel(m?: string) {
    const map: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transfer.', tarjeta: 'Tarjeta', nequi: 'Nequi', daviplata: 'Daviplata' };
    return map[m?.toLowerCase() ?? ''] ?? m ?? '—';
}

function estadoBadge(estado?: string): 'success' | 'warning' | 'danger' | 'info' {
    if (estado === 'pagado') return 'success';
    if (estado === 'pendiente') return 'warning';
    if (estado === 'cancelado') return 'danger';
    return 'info';
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color, accent }: {
    icon: any; label: string; value: string; sub?: string; color: string; accent: string;
}) {
    return (
        <View style={{ flex: 1, minWidth: 140, backgroundColor: '#0C1828', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={icon} size={15} color={color} />
                </View>
                <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, flex: 1 }}>{label}</Text>
            </View>
            <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, letterSpacing: -0.5 }}>{value}</Text>
            {sub ? <Text style={{ color: '#475569', fontSize: 11, marginTop: 3 }}>{sub}</Text> : null}
        </View>
    );
}

// ─── Balance Banner ───────────────────────────────────────────────────────────

function BalanceBanner({ ingresos, gastos }: { ingresos: number; gastos: number }) {
    const neto = ingresos - gastos;
    const isPos = neto >= 0;
    const margen = ingresos > 0 ? ((neto / ingresos) * 100).toFixed(1) : '0.0';

    return (
        <View style={{ borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: isPos ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', backgroundColor: '#0A1520', overflow: 'hidden' }}>
            <View style={{ padding: 20, gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Balance del Período</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, backgroundColor: isPos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderColor: isPos ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)' }}>
                        <Icon name={isPos ? 'trending-up' : 'trending-down'} size={12} color={isPos ? '#10B981' : '#EF4444'} />
                        <Text style={{ color: isPos ? '#10B981' : '#EF4444', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{isPos ? 'Superávit' : 'Déficit'}</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 14 }}>
                    {[
                        { label: 'Ingresos', value: `$${formatCurrency(ingresos)}`, color: '#10B981' },
                        { label: 'Egresos', value: `−$${formatCurrency(gastos)}`, color: '#EF4444' },
                        { label: 'Margen', value: `${margen}%`, color: isPos ? '#F5A524' : '#EF4444' },
                    ].map(({ label, value, color }) => (
                        <View key={label} style={{ flex: 1 }}>
                            <Text style={{ color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
                            <Text style={{ color, fontFamily: 'SpaceGrotesk-Bold', fontSize: 17 }}>{value}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isPos ? 'rgba(245,165,36,0.15)' : 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="scale-balance" size={18} color={isPos ? '#F5A524' : '#EF4444'} />
                        </View>
                        <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, textTransform: 'uppercase' }}>Balance Neto</Text>
                    </View>
                    <Text style={{ color: isPos ? '#F5A524' : '#EF4444', fontFamily: 'SpaceGrotesk-Bold', fontSize: 24, letterSpacing: -1 }}>
                        {isPos ? '' : '−'}${formatCurrency(Math.abs(neto))}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ─── Métodos breakdown ────────────────────────────────────────────────────────

function MetodosBreakdown({ metodos }: { metodos: { metodo: string; total: number; porcentaje?: number }[] }) {
    if (!metodos || !metodos.length) return null;
    const total = metodos.reduce((s, m) => s + m.total, 0);

    return (
        <Card className="mb-4">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="credit-card-multiple-outline" size={15} color="#F5A524" />
                <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Métodos de Pago</Text>
            </View>
            {metodos.map((item) => {
                const pct = total > 0 ? (item.total / total) * 100 : 0;
                return (
                    <View key={item.metodo} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>{metodoLabel(item.metodo)}</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Text style={{ color: '#475569', fontSize: 11 }}>{pct.toFixed(1)}%</Text>
                                <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12 }}>${formatCurrency(item.total)}</Text>
                            </View>
                        </View>
                        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                            <View style={{ height: 4, borderRadius: 2, backgroundColor: '#F5A524', width: `${pct}%` as any }} />
                        </View>
                    </View>
                );
            })}
        </Card>
    );
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function TableHeader({ cols }: { cols: string[] }) {
    return (
        <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 8 }}>
            {cols.map((c, i) => (
                <Text key={i} style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: i === 1 ? 1 : undefined, width: i === 0 ? 44 : i === cols.length - 1 ? 80 : 72 }}>
                    {c}
                </Text>
            ))}
        </View>
    );
}

function VentaRow({ f, isMobile }: { f: FacturaVenta; isMobile: boolean }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 8 }}>
            <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'SpaceGrotesk-Bold', width: 44 }}>#{f.facturaId}</Text>
            <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{f.clienteNombre || '—'}</Text>
            {!isMobile && <Text style={{ color: '#475569', fontSize: 11, width: 72 }}>{fmtDate(f.fechaFactura)}</Text>}
            {!isMobile && <Text style={{ color: '#64748B', fontSize: 11, width: 72 }}>{metodoLabel(f.metodo)}</Text>}
            <Badge label={f.estado || 'N/A'} variant={estadoBadge(f.estado)} size="sm" />
            <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, textAlign: 'right', minWidth: 80 }}>${formatCurrency(f.total ?? 0)}</Text>
        </View>
    );
}

function GastoRow({ g, isMobile }: { g: FacturaPago; isMobile: boolean }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)', gap: 8 }}>
            <Text style={{ color: '#64748B', fontSize: 11, fontFamily: 'SpaceGrotesk-Bold', width: 44 }}>#{g.pagosId}</Text>
            <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{g.nombreGasto || '—'}</Text>
            {!isMobile && <Text style={{ color: '#475569', fontSize: 11, width: 72 }}>{fmtDate(g.fechaFactura)}</Text>}
            {!isMobile && <Text style={{ color: '#64748B', fontSize: 11, width: 72 }}>{metodoLabel(g.metodo)}</Text>}
            <Badge label={g.estado || 'N/A'} variant={estadoBadge(g.estado)} size="sm" />
            <Text style={{ color: '#EF4444', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, textAlign: 'right', minWidth: 80 }}>−${formatCurrency(g.total ?? 0)}</Text>
        </View>
    );
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({ icon, title, description, tag, onPress, loading, disabled }: {
    icon: any; title: string; description: string; tag?: string;
    onPress: () => void; loading?: boolean; disabled?: boolean;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.78}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: '#0C1828', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', opacity: disabled ? 0.4 : 1, marginBottom: 10 }}
        >
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)', flexShrink: 0 }}>
                {loading ? <ActivityIndicator size="small" color="#F5A524" /> : <Icon name={icon} size={22} color="#F5A524" />}
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <Text style={{ color: '#F1F5F9', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 }}>{title}</Text>
                    {tag ? <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)' }}>
                        <Text style={{ color: '#60A5FA', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }}>{tag}</Text>
                    </View> : null}
                </View>
                <Text style={{ color: '#475569', fontSize: 12, lineHeight: 17 }}>{description}</Text>
            </View>
            <Icon name="open-in-new" size={16} color="#334155" />
        </TouchableOpacity>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ContabilidadScreen() {
    const { isMobile } = useBreakpoint();
    const api = useApi();
    const [activeTab, setActiveTab] = useState<TabId>('resumen');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [validRange, setValidRange] = useState({ from: '', to: '' });
    const [filterError, setFilterError] = useState('');
    const [exportLoading, setExportLoading] = useState('');
    const [searched, setSearched] = useState(false);

    const {
        data: facturas, loading: loadingF, error: errorF,
        setFrom: setFromF, setTo: setToF, search: searchF, stats,
        page: pageF, totalPages: totalPagesF, goToPage: goToPageF,
        total: totalFacturasCount,
    } = useFacturasRango(50);

    const {
        data: gastos, loading: loadingG, error: errorG,
        setFrom: setFromG, setTo: setToG, fetchData: fetchGastos,
        page: pageG, totalPages: totalPagesG, total: totalGastosCount, goToPage: goToPageG,
    } = useFacturasPagosRango(50);

    // Server-side calculated period statistics and payment methods
    const [periodStats, setPeriodStats] = useState<ResumenPeriodo | null>(null);
    const [metodosData, setMetodosData] = useState<any[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);

    const fetchAllPeriod = useCallback(async (f?: string, t?: string) => {
        const queryFrom = f ?? validRange.from;
        const queryTo = t ?? validRange.to;
        if (!queryFrom || !queryTo) return { allF: [] as any[], allG: [] as FacturaPago[] };
        const [fRes, gRes] = await Promise.all([
            api.facturas.getAll({ from: queryFrom, to: queryTo, page: 1, limit: 9999 }),
            api.pagos.getAll({ from: queryFrom, to: queryTo, page: 1, limit: 9999 }),
        ]);
        return { allF: fRes.data, allG: gRes.data };
    }, [api, validRange]);

    const handleSearch = useCallback(() => {
        const { from: f, to: t, error } = validateFlexibleDateRange(from, to);
        if (error) { setFilterError(error); return; }
        setFilterError('');
        setValidRange({ from: f, to: t });
        setFromF(f); setToF(t);
        setFromG(f); setToG(t);
        searchF(f, t);
        fetchGastos(f, t, 1);
        setSearched(true);

        setLoadingStats(true);
        Promise.all([
            api.estadisticas.resumenPeriodo(f, t),
            api.estadisticas.metodosPago(f, t)
        ])
            .then(([statsRes, metodosRes]) => {
                setPeriodStats(statsRes);
                setMetodosData(metodosRes);
            })
            .catch((err) => {
                console.error('Error fetching period statistics/methods:', err);
            })
            .finally(() => setLoadingStats(false));
    }, [from, to, setFromF, setToF, setFromG, setToG, searchF, fetchGastos, api]);

    const totalIngresos = periodStats?.totalIngresosPagados ?? 0;
    const totalGastos = periodStats?.totalEgresosPagados ?? 0;
    const pendientesF = periodStats?.totalIngresosPendientes ?? 0;
    const ticketProm = periodStats?.countIngresosPagados && periodStats.countIngresosPagados > 0
        ? totalIngresos / periodStats.countIngresosPagados
        : 0;

    const isWeb = Platform.OS === 'web';
    const loading = loadingF || loadingG;
    const periodLabel = searched ? `${validRange.from} al ${validRange.to}` : '';
    const totalRegistros = totalFacturasCount + totalGastosCount;
    const hasData = totalFacturasCount > 0 || totalGastosCount > 0;

    const runExport = useCallback(async (key: string, fn: (allF: any[], allG: FacturaPago[]) => void | Promise<void>) => {
        setExportLoading(key);
        try {
            const { allF, allG } = await fetchAllPeriod();
            await fn(allF, allG);
        } finally { setExportLoading(''); }
    }, [fetchAllPeriod]);

    // ── Date range bar ──────────────────────────────────────────────────────────
    const DateBar = (
        <Card className="mb-5 p-4">
            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                <View style={{ flex: 1 }}>
                    <Input
                        label="Desde"
                        value={from}
                        onChangeText={setFrom}
                        placeholder="Ej: 2026-05-24"
                        size={isMobile ? 'md' : 'sm'}
                        leftIcon={<Icon name="calendar-start" size={14} color="#475569" />}
                        containerStyle={{ marginBottom: 0 }}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Input
                        label="Hasta"
                        value={to}
                        onChangeText={setTo}
                        placeholder="Ej: 2026-05-31"
                        size={isMobile ? 'md' : 'sm'}
                        leftIcon={<Icon name="calendar-end" size={14} color="#475569" />}
                        containerStyle={{ marginBottom: 0 }}
                    />
                </View>
                <Button title="Consultar" icon="magnify" variant="primary" size={isMobile ? 'md' : 'sm'} onPress={handleSearch} loading={loading} />
            </View>
            {filterError ? <Text style={{ color: '#F87171', fontSize: 12, marginTop: 8 }}>{filterError}</Text> : null}
        </Card>
    );

    // ── Tab bar ─────────────────────────────────────────────────────────────────
    const TabBar = (
        <View style={{ flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveTab(tab.id)}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: active ? 'rgba(245,165,36,0.14)' : 'transparent', borderWidth: 1, borderColor: active ? 'rgba(245,165,36,0.28)' : 'transparent' }}
                    >
                        <Icon name={tab.icon} size={14} color={active ? '#F5A524' : '#475569'} />
                        {!isMobile && <Text style={{ color: active ? '#F5A524' : '#475569', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{tab.label}</Text>}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    if (!searched) {
        return (
            <PageContainer>
                <PageHeader title="Contabilidad" subtitle="Libro contable" icon="book-account-outline" />
                {DateBar}
                <View style={{ alignItems: 'center', paddingTop: 60, opacity: 0.6 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245,165,36,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.15)', marginBottom: 16 }}>
                        <Icon name="book-account-outline" size={36} color="#F5A524" />
                    </View>
                    <Text style={{ color: '#475569', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Selecciona un período</Text>
                    <Text style={{ color: '#334155', fontSize: 12, marginTop: 6 }}>Ingresa las fechas y pulsa Consultar</Text>
                </View>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <PageHeader
                title="Contabilidad"
                subtitle="Libro contable"
                icon="book-account-outline"
                rightContent={
                    loading
                        ? <ActivityIndicator size="small" color="#F5A524" />
                        : <Badge label={`${totalRegistros} registros`} variant="neutral" icon="database-outline" size="sm" />
                }
            />

            {DateBar}
            {TabBar}

            {/* ── RESUMEN ─────────────────────────────────────────────────────── */}
            {activeTab === 'resumen' && (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {(loadingF || loadingStats) ? <ListSkeleton count={4} /> : (
                        <>
                            <BalanceBanner ingresos={totalIngresos} gastos={totalGastos} />

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                                <KpiCard icon="arrow-down-circle-outline" label="Ingresos cobrados" value={`$${formatCurrency(totalIngresos)}`} sub={`${periodStats?.countIngresosPagados ?? 0} facturas`} color="#10B981" accent="rgba(16,185,129,0.15)" />
                                <KpiCard icon="arrow-up-circle-outline" label="Egresos pagados" value={`$${formatCurrency(totalGastos)}`} sub={`${periodStats?.countEgresosPagados ?? 0} gastos`} color="#EF4444" accent="rgba(239,68,68,0.15)" />
                                <KpiCard icon="clock-alert-outline" label="Por cobrar" value={`$${formatCurrency(pendientesF)}`} sub={`${periodStats?.countIngresosPendientes ?? 0} facturas`} color="#F59E0B" accent="rgba(245,158,11,0.15)" />
                                <KpiCard icon="ticket-percent-outline" label="Ticket promedio" value={`$${formatCurrency(ticketProm)}`} sub={`${periodStats?.facturas ?? 0} facturas totales`} color="#60A5FA" accent="rgba(96,165,250,0.15)" />
                            </View>

                            <MetodosBreakdown metodos={metodosData} />

                            {(errorF || errorG) && (
                                <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(239,68,68,0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                                    <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                                    <Text style={{ color: '#F87171', fontSize: 13, flex: 1 }}>{errorF ?? errorG}</Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            )}

            {/* ── VENTAS ──────────────────────────────────────────────────────── */}
            {activeTab === 'ventas' && (
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                            {stats.count} ventas · <Text style={{ color: '#10B981' }}>${formatCurrency(stats.totalPagado)}</Text>
                        </Text>
                        {totalPagesF > 1 && <Badge label={`Pág ${pageF}/${totalPagesF}`} variant="neutral" size="sm" />}
                    </View>
                    {loadingF ? <ListSkeleton count={6} /> : (
                        <Card className="p-0 overflow-hidden mb-4">
                            <TableHeader cols={isMobile ? ['#', 'Cliente', 'Est.', 'Total'] : ['#', 'Cliente', 'Fecha', 'Método', 'Estado', 'Total']} />
                            {facturas.length === 0 ? (
                                <View style={{ padding: 32, alignItems: 'center' }}><Text style={{ color: '#334155', fontSize: 13 }}>Sin ventas en el período</Text></View>
                            ) : (
                                facturas.map(f => <VentaRow key={String(f.facturaId)} f={f} isMobile={isMobile} />)
                            )}
                        </Card>
                    )}
                    {totalPagesF > 1 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: 16 }}>
                            <Button title="Ant." icon="chevron-left" variant="ghost" size="sm" onPress={() => goToPageF(pageF - 1)} disabled={pageF <= 1} />
                            <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' }}>
                                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800' }}>{pageF} / {totalPagesF}</Text>
                            </View>
                            <Button title="Sig." iconRight="chevron-right" variant="ghost" size="sm" onPress={() => goToPageF(pageF + 1)} disabled={pageF >= totalPagesF} />
                        </View>
                    )}
                </View>
            )}

            {/* ── EGRESOS ─────────────────────────────────────────────────────── */}
            {activeTab === 'egresos' && (
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                            {totalGastosCount} gastos · <Text style={{ color: '#EF4444' }}>−${formatCurrency(totalGastos)}</Text>
                        </Text>
                        {totalPagesG > 1 && <Badge label={`Pág ${pageG}/${totalPagesG}`} variant="neutral" size="sm" />}
                    </View>
                    {loadingG ? <ListSkeleton count={6} /> : (
                        <Card className="p-0 overflow-hidden mb-4">
                            <TableHeader cols={isMobile ? ['#', 'Concepto', 'Est.', 'Total'] : ['#', 'Concepto', 'Fecha', 'Método', 'Estado', 'Total']} />
                            {gastos.length === 0 ? (
                                <View style={{ padding: 32, alignItems: 'center' }}><Text style={{ color: '#334155', fontSize: 13 }}>Sin egresos en el período</Text></View>
                            ) : (
                                gastos.map(g => <GastoRow key={String(g.pagosId)} g={g} isMobile={isMobile} />)
                            )}
                        </Card>
                    )}
                    {totalPagesG > 1 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: 16 }}>
                            <Button title="Ant." icon="chevron-left" variant="ghost" size="sm" onPress={() => goToPageG(pageG - 1)} disabled={pageG <= 1} />
                            <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' }}>
                                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800' }}>{pageG} / {totalPagesG}</Text>
                            </View>
                            <Button title="Sig." iconRight="chevron-right" variant="ghost" size="sm" onPress={() => goToPageG(pageG + 1)} disabled={pageG >= totalPagesG} />
                        </View>
                    )}
                </View>
            )}

            {/* ── REPORTES ────────────────────────────────────────────────────── */}
            {activeTab === 'reportes' && (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {!isWeb && (
                        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(96,165,250,0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', marginBottom: 16 }}>
                            <Icon name="information-outline" size={18} color="#60A5FA" />
                            <Text style={{ color: '#60A5FA', fontSize: 13, flex: 1 }}>Los reportes solo están disponibles en la versión web del POS.</Text>
                        </View>
                    )}

                    {!hasData && (
                        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(245,158,11,0.08)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: 16 }}>
                            <Icon name="alert-outline" size={18} color="#F59E0B" />
                            <Text style={{ color: '#F59E0B', fontSize: 13, flex: 1 }}>No hay datos para el período consultado. Cambia el rango de fechas.</Text>
                        </View>
                    )}

                    {/* Balances */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Balances Contables</Text>

                    <ReportCard
                        icon="scale-balance"
                        title="Balance de Prueba"
                        tag="PDF"
                        description="Estado de cuentas del período: activos, ingresos, gastos y resultado neto"
                        onPress={() => runExport('balance', (allF, allG) => exportBalanceDePrueba(allF, allG, validRange.from, validRange.to))}
                        loading={exportLoading === 'balance'}
                        disabled={!isWeb || !hasData}
                    />
                    <ReportCard
                        icon="account-group-outline"
                        title="Balance de Prueba por Tercero"
                        tag="PDF"
                        description="Resumen por cliente: total facturado, cobrado y saldo pendiente por cada tercero"
                        onPress={() => runExport('tercero', (allF) => exportBalancePorTercero(allF, validRange.from, validRange.to))}
                        loading={exportLoading === 'tercero'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />

                    {/* Libros */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>Libros Contables</Text>

                    <ReportCard
                        icon="book-open-page-variant-outline"
                        title="Libro Diario"
                        tag="PDF"
                        description="Todos los asientos del período ordenados por fecha: ventas (débito) y gastos (crédito)"
                        onPress={() => runExport('diario', (allF, allG) => exportLibroDiario(allF, allG, validRange.from, validRange.to))}
                        loading={exportLoading === 'diario'}
                        disabled={!isWeb || !hasData}
                    />
                    <ReportCard
                        icon="receipt"
                        title="Libro de Ventas"
                        tag="PDF"
                        description="Detalle de facturas de ventas con cliente, método de pago y estado"
                        onPress={() => runExport('ventas-pdf', (allF) => exportFacturasPdf(allF, periodLabel))}
                        loading={exportLoading === 'ventas-pdf'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />

                    {/* Impuestos */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>Informes Fiscales</Text>

                    <ReportCard
                        icon="percent-outline"
                        title="Informe de IVA"
                        tag="PDF"
                        description="Base gravable, IVA generado (8% restaurantes) e IVA total del período por método de pago"
                        onPress={() => runExport('iva', (allF) => exportInformeImpuesto(allF, validRange.from, validRange.to))}
                        loading={exportLoading === 'iva'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />

                    {/* CSV exports */}
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 }}>Exportar CSV</Text>

                    <ReportCard
                        icon="file-table-outline"
                        title="Balance Contable Completo"
                        tag="CSV"
                        description="Ventas + egresos + resumen por método de pago y productos más vendidos"
                        onPress={() => runExport('combined', async (allF, allG) => {
                            const csv = await buildCombinedBalanceCsv(allF, allG);
                            downloadCsv(csv, `balance_${validRange.from}_${validRange.to}.csv`);
                        })}
                        loading={exportLoading === 'combined'}
                        disabled={!isWeb || !hasData}
                    />
                    <ReportCard
                        icon="file-chart-outline"
                        title="Backup de Ventas"
                        tag="CSV"
                        description="Facturas con datos de cliente para importar al sistema o enviar al contador"
                        onPress={() => runExport('backup', async (allF) => {
                            const csv = await buildFacturasBackupCsv(allF);
                            downloadCsv(csv, `ventas_backup_${validRange.from}_${validRange.to}.csv`);
                        })}
                        loading={exportLoading === 'backup'}
                        disabled={!isWeb || totalFacturasCount === 0}
                    />
                </ScrollView>
            )}
        </PageContainer>
    );
}
