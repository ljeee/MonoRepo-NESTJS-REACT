import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, Platform, Text, View } from 'react-native';

import { useFacturasRango } from '../hooks/use-facturas';
import { useFacturasPagosRango } from '../hooks/use-create-factura-pago';
import { formatCurrency } from '../utils/formatNumber';
import { colors } from '../styles/theme';
import { spacing } from '../styles/tokens';
import { makeBStyles } from '../styles/facturas/balance-dia.styles';
import { useBreakpoint } from '../styles/responsive';

import { FacturaCard } from '../components/facturas/FacturaShared';
import {
    PageContainer,
    PageHeader,
    Button,
    Input,
    Icon,
    ListSkeleton,
    Badge,
} from '../components/ui';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function esc(v: string): string {
    return v.includes(',') || v.includes('"') || v.includes('\n')
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
}

function buildCombinedCsv(facturas: any[], gastos: any[]): string {
    const rows = ['Tipo,ID,Nombre/Cliente,Fecha,Total,Estado,Método'];
    for (const f of facturas) {
        const fecha = f.fechaFactura ? new Date(f.fechaFactura).toLocaleDateString('es-CO') : '';
        rows.push(`Factura,${f.facturaId ?? ''},${esc(f.clienteNombre || '')},${fecha},${f.total ?? 0},${f.estado || ''},${f.metodo || ''}`);
    }
    for (const g of gastos) {
        const fecha = g.fechaFactura ? new Date(g.fechaFactura).toLocaleDateString('es-CO') : '';
        rows.push(`Gasto,${g.pagosId ?? ''},${esc(g.nombreGasto || '')},${fecha},${g.total ?? 0},${g.estado || ''},${g.metodo || ''}`);
    }
    return rows.join('\n');
}

function downloadCsv(csv: string, filename: string) {
    if (Platform.OS !== 'web') return;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ─── Balance card ─────────────────────────────────────────────────────────────

type BStyles = ReturnType<typeof makeBStyles>;

function BalanceCard({ ingresos, gastos, s }: { ingresos: number; gastos: number; s: BStyles }) {
    const neto = ingresos - gastos;
    const netoStyle =
        neto > 0 ? s.balanceValuePositive
            : neto < 0 ? s.balanceValueNegative
                : s.balanceValueNeutral;

    return (
        <View style={s.balanceCard}>
            <View style={s.balanceCardGradient}>
                <Text style={s.balanceTitle}>📊 Balance del Período</Text>

                <View style={s.balanceRow}>
                    <View style={s.balanceLabelRow}>
                        <Icon name="arrow-down-circle-outline" size={18} color={colors.success} />
                        <Text style={s.balanceLabel}>Ingresos (facturas pagadas)</Text>
                    </View>
                    <Text style={[s.balanceValue, s.balanceValuePositive]}>${formatCurrency(ingresos)}</Text>
                </View>

                <View style={s.balanceRow}>
                    <View style={s.balanceLabelRow}>
                        <Icon name="arrow-up-circle-outline" size={18} color={colors.danger} />
                        <Text style={s.balanceLabel}>Gastos del período</Text>
                    </View>
                    <Text style={[s.balanceValue, s.balanceValueNegative]}>−${formatCurrency(gastos)}</Text>
                </View>

                <View style={s.balanceDivider} />

                <View style={s.balanceNetRow}>
                    <View style={s.balanceLabelRow}>
                        <Icon name="scale-balance" size={20} color={colors.primary} />
                        <Text style={s.balanceNetLabel}>Balance Neto</Text>
                    </View>
                    <Text style={[s.balanceNetValue, netoStyle]}>
                        {neto < 0 ? '−' : ''}${formatCurrency(Math.abs(neto))}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BalanceFechasScreen() {
    const { isMobile } = useBreakpoint();
    const s = makeBStyles(isMobile);
    // ── Screen-level date state (single source of truth for both hooks) ──
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [filterError, setFilterError] = useState('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    // Increment to fire useEffect after both hook setters have committed
    const [searchTrigger, setSearchTrigger] = useState(0);

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

    // Fetch fires after React has committed the setter calls (avoids stale closures)
    useEffect(() => {
        if (searchTrigger === 0) return;
        fetchFacturas();
        fetchGastos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTrigger]);

    const handleSearch = useCallback(() => {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!from || !to) { setFilterError('Ingresa ambas fechas'); return; }
        if (!dateRegex.test(from) || !dateRegex.test(to)) { setFilterError('Formato inválido. Use YYYY-MM-DD'); return; }
        if (new Date(from) > new Date(to)) { setFilterError('"Desde" no puede ser posterior a "Hasta"'); return; }
        setFilterError('');
        // Push dates into both hooks, then increment trigger → useEffect fires fetch
        setFromF(from); setToF(to);
        setFromG(from); setToG(to);
        setSearchTrigger((n) => n + 1);
    }, [from, to, setFromF, setToF, setFromG, setToG]);

    const handleToggleEstado = async (facturaId: number, currentEstado?: string) => {
        const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
        setUpdatingId(facturaId);
        try { await updateEstado(facturaId, nuevoEstado); }
        finally { setUpdatingId(null); }
    };

    const handleUpdateTotal = async (facturaId: number, newTotal: number) => {
        await updateFactura(facturaId, { total: newTotal });
    };

    const handleExportCsv = useCallback(() => {
        downloadCsv(buildCombinedCsv(facturas, gastos), `balance_${from}_${to}.csv`);
    }, [facturas, gastos, from, to]);

    const loading = loadingFacturas || loadingGastos;
    const hasData = facturas.length > 0 || gastos.length > 0;
    const ingresos = stats?.totalPagado ?? 0;
    const totalGastos = gastos.reduce((sum, g) => sum + (Number(g.total) || 0), 0);

    return (
        <PageContainer scrollable={false} contentContainerStyle={{ flex: 1 }}>
            <FlatList
                data={facturas}
                style={{ flex: 1 }}
                keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
                contentContainerStyle={{ paddingBottom: spacing.lg }}
                ListHeaderComponent={
                    <>
                        <PageHeader
                            title="Balance por Fechas"
                            subtitle="Facturación"
                            icon="scale-balance"
                        />

                        {/* Actions bar */}
                        <View style={s.actionsBar}>
                            <Button
                                title="Exportar CSV"
                                icon="download"
                                variant="outline"
                                size="sm"
                                onPress={handleExportCsv}
                                disabled={!hasData}
                            />
                        </View>

                        {/* ── Date range filter (drives both hooks) ─────────────── */}
                        <View style={s.filterRow}>
                            <Input
                                label="Desde"
                                value={from}
                                onChangeText={setFrom}
                                placeholder="2025-01-01"
                                containerStyle={{ flex: 1, minWidth: 140 }}
                                size="sm"
                                leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
                            />
                            <Input
                                label="Hasta"
                                value={to}
                                onChangeText={setTo}
                                placeholder="2026-12-31"
                                containerStyle={{ flex: 1, minWidth: 140 }}
                                size="sm"
                                leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
                            />
                            <View style={s.filterSearchBtn}>
                                <Button
                                    title={loading ? '...' : 'Buscar'}
                                    icon="magnify"
                                    variant="primary"
                                    size="sm"
                                    onPress={handleSearch}
                                    disabled={!from || !to || loading}
                                    loading={loading}
                                />
                            </View>
                        </View>

                        {filterError ? (
                            <View style={errorRowStyle}>
                                <Icon name="alert-circle-outline" size={14} color={colors.danger} />
                                <Text style={{ color: colors.danger, fontSize: 13 }}>{filterError}</Text>
                            </View>
                        ) : null}

                        {/* Balance summary — visible when any data is loaded */}
                        {hasData && <BalanceCard ingresos={ingresos} gastos={totalGastos} s={s} />}

                        {loading && <ListSkeleton count={4} />}

                        {/* ── Facturas section header ─────────────────────────── */}
                        {!loading && (
                            <View style={s.sectionHeader}>
                                <Icon name="receipt" size={18} color={colors.primary} />
                                <Text style={s.sectionTitle}>Facturas del Período</Text>
                                <Text style={s.sectionCount}>{facturas.length}</Text>
                            </View>
                        )}

                        {errorFacturas && (
                            <View style={errorRowStyle}>
                                <Icon name="alert-circle-outline" size={14} color={colors.danger} />
                                <Text style={{ color: colors.danger, fontSize: 13 }}>{errorFacturas}</Text>
                            </View>
                        )}

                        {!loading && facturas.length === 0 && (
                            <View style={s.emptySection}>
                                <Icon
                                    name={from && to ? 'email-off-outline' : 'calendar-search'}
                                    size={40}
                                    color={colors.textMuted}
                                />
                                <Text style={s.emptySectionText}>
                                    {from && to
                                        ? 'Sin facturas en este rango'
                                        : 'Selecciona un rango de fechas y presiona Buscar'}
                                </Text>
                            </View>
                        )}
                    </>
                }
                renderItem={({ item }) => (
                    <FacturaCard
                        item={item}
                        isUpdating={updatingId === item.facturaId}
                        onToggleEstado={handleToggleEstado}
                        onUpdateTotal={handleUpdateTotal}
                    />
                )}
                ListFooterComponent={
                    !loading && gastos.length > 0 ? (
                        <>
                            {/* ── Gastos section ─────────────────────────────────── */}
                            <View style={[s.sectionHeader, { marginTop: spacing['2xl'] }]}>
                                <Icon name="credit-card-minus-outline" size={18} color={colors.danger} />
                                <Text style={s.sectionTitle}>Gastos del Período</Text>
                                <Text style={s.sectionCount}>{gastos.length}</Text>
                            </View>

                            {errorGastos && (
                                <View style={errorRowStyle}>
                                    <Icon name="alert-circle-outline" size={14} color={colors.danger} />
                                    <Text style={{ color: colors.danger, fontSize: 13 }}>{errorGastos}</Text>
                                </View>
                            )}

                            {gastos.map((item, idx) => (
                                <View key={item.pagosId?.toString() || idx.toString()} style={s.gastoCard}>
                                    <View style={s.gastoIcon}>
                                        <Icon
                                            name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'}
                                            size={18}
                                            color={colors.primary}
                                        />
                                    </View>
                                    <View style={s.gastoInfo}>
                                        <Text style={s.gastoName}>{item.nombreGasto || 'Sin nombre'}</Text>
                                        <View style={s.gastoMeta}>
                                            {item.fechaFactura && (
                                                <Text style={s.gastoMetaText}>{item.fechaFactura}</Text>
                                            )}
                                            {item.metodo && (
                                                <Badge label={item.metodo} variant="warning" size="sm" />
                                            )}
                                        </View>
                                    </View>
                                    <Text style={s.gastoTotal}>−${formatCurrency(item.total ?? 0)}</Text>
                                </View>
                            ))}
                        </>
                    ) : null
                }
            />
        </PageContainer>
    );
}

// ─── Structural layout constants ──────────────────────────────────────────────
// (Static error row — same in all breakpoints)

const errorRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    marginBottom: spacing.md,
};
