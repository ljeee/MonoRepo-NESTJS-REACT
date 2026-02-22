import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, Text, View } from 'react-native';

import { useFacturasDia } from '../hooks/use-facturas';
import { useFacturasPagosDia, useDeleteFacturaPago } from '../hooks/use-create-factura-pago';
import { formatCurrency } from '../utils/formatNumber';
import { colors } from '../styles/theme';
import { spacing } from '../styles/tokens';
import { makeBStyles } from '../styles/facturas/balance-dia.styles';
import { fStyles } from '../styles/facturas/facturas.styles';
import { useBreakpoint } from '../styles/responsive';

import { FacturaCard, FacturaItem } from '../components/facturas/FacturaShared';
import {
    PageContainer,
    PageHeader,
    Button,
    Icon,
    ListSkeleton,
    ConfirmModal,
    Badge,
} from '../components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type BStyles = ReturnType<typeof makeBStyles>;

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function esc(v: string): string {
    return v.includes(',') || v.includes('"') || v.includes('\n')
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
}

function buildCombinedCsv(facturas: FacturaItem[], gastos: any[]): string {
    const rows: string[] = ['Tipo,ID,Nombre/Cliente,Fecha,Total,Estado,Método'];
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

function BalanceCard({ ingresos, gastos, s }: { ingresos: number; gastos: number; s: BStyles }) {
    const neto = ingresos - gastos;
    const netoColor =
        neto > 0 ? s.balanceValuePositive
            : neto < 0 ? s.balanceValueNegative
                : s.balanceValueNeutral;

    return (
        <View style={s.balanceCard}>
            <View style={s.balanceCardGradient}>
                <Text style={s.balanceTitle}>💼 Balance del Día</Text>

                <View style={s.balanceRow}>
                    <View style={s.balanceLabelRow}>
                        <Icon name="arrow-down-circle-outline" size={18} color={colors.success} />
                        <Text style={s.balanceLabel}>Ingresos (facturas pagadas)</Text>
                    </View>
                    <Text style={[s.balanceValue, s.balanceValuePositive]}>
                        ${formatCurrency(ingresos)}
                    </Text>
                </View>

                <View style={s.balanceRow}>
                    <View style={s.balanceLabelRow}>
                        <Icon name="arrow-up-circle-outline" size={18} color={colors.danger} />
                        <Text style={s.balanceLabel}>Gastos del día</Text>
                    </View>
                    <Text style={[s.balanceValue, s.balanceValueNegative]}>
                        −${formatCurrency(gastos)}
                    </Text>
                </View>

                <View style={s.balanceDivider} />

                <View style={s.balanceNetRow}>
                    <View style={s.balanceLabelRow}>
                        <Icon name="scale-balance" size={20} color={colors.primary} />
                        <Text style={s.balanceNetLabel}>Balance Neto</Text>
                    </View>
                    <Text style={[s.balanceNetValue, netoColor]}>
                        ${formatCurrency(Math.abs(neto))}
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ─── Gasto item row ───────────────────────────────────────────────────────────

function GastoRow({ item, onDelete, deleting, s }: {
    item: any;
    onDelete: () => void;
    deleting: boolean;
    s: BStyles;
}) {
    return (
        <View style={s.gastoCard}>
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

            <View style={s.gastoActions}>
                <Button
                    title=""
                    icon="trash-can-outline"
                    variant="ghost"
                    size="sm"
                    onPress={onDelete}
                    disabled={deleting}
                    style={{ opacity: 0.7 }}
                />
            </View>
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BalanceDiaScreen() {
    const { isMobile } = useBreakpoint();
    const s = makeBStyles(isMobile);

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

    useEffect(() => { fetchGastos(); }, [fetchGastos]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchFacturas(), fetchGastos()]);
        setRefreshing(false);
    };

    const handleToggleEstado = async (facturaId: number, currentEstado?: string) => {
        const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
        setUpdatingId(facturaId);
        try { await updateEstado(facturaId, nuevoEstado); }
        finally { setUpdatingId(null); }
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

    const handleExportCsv = useCallback(() => {
        const csv = buildCombinedCsv(facturas, gastos);
        const today = new Date().toISOString().slice(0, 10);
        downloadCsv(csv, `balance_${today}.csv`);
    }, [facturas, gastos]);

    const ingresos = stats?.totalPagado ?? 0;
    const totalGastos = gastos.reduce((sum, g) => sum + (Number(g.total) || 0), 0);
    const loading = loadingFacturas || loadingGastos;

    return (
        <PageContainer
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                />
            }
        >
            <PageHeader
                title="Balance del Día"
                subtitle="Facturación"
                icon="scale-balance"
            />

            {/* Actions bar */}
            <View style={s.actionsBar}>
                <Button
                    title="Refrescar"
                    icon="refresh"
                    variant="ghost"
                    size="sm"
                    onPress={handleRefresh}
                    loading={loading}
                />
                <Button
                    title="Exportar CSV"
                    icon="download"
                    variant="outline"
                    size="sm"
                    onPress={handleExportCsv}
                    disabled={facturas.length === 0 && gastos.length === 0}
                />
            </View>

            {/* Balance summary card */}
            <BalanceCard ingresos={ingresos} gastos={totalGastos} s={s} />

            {/* ── FACTURAS ───────────────────────────────────────────────────────── */}
            <View style={s.sectionHeader}>
                <Icon name="receipt" size={18} color={colors.primary} />
                <Text style={s.sectionTitle}>Facturas del Día</Text>
                <Text style={s.sectionCount}>{facturas.length}</Text>
            </View>

            {errorFacturas && (
                <View style={fStyles.estadoRow}>
                    <Icon name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 13 }}>{errorFacturas}</Text>
                </View>
            )}

            {loadingFacturas && !facturas.length && <ListSkeleton count={3} />}

            {!loadingFacturas && facturas.length === 0 && !errorFacturas && (
                <View style={s.emptySection}>
                    <Icon name="receipt-outline" size={36} color={colors.textMuted} />
                    <Text style={s.emptySectionText}>Sin facturas hoy</Text>
                </View>
            )}

            {facturas.map((item, idx) => (
                <FacturaCard
                    key={item.facturaId?.toString() || idx.toString()}
                    item={item}
                    isUpdating={updatingId === item.facturaId}
                    onToggleEstado={handleToggleEstado}
                    onUpdateTotal={handleUpdateTotal}
                    showPrint
                />
            ))}

            {/* ── GASTOS ─────────────────────────────────────────────────────────── */}
            <View style={[s.sectionHeader, { marginTop: spacing['2xl'] }]}>
                <Icon name="credit-card-minus-outline" size={18} color={colors.danger} />
                <Text style={s.sectionTitle}>Gastos del Día</Text>
                <Text style={s.sectionCount}>{gastos.length}</Text>
            </View>

            {errorGastos && (
                <View style={fStyles.estadoRow}>
                    <Icon name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 13 }}>{errorGastos}</Text>
                </View>
            )}

            {loadingGastos && !gastos.length && <ListSkeleton count={2} />}

            {!loadingGastos && gastos.length === 0 && !errorGastos && (
                <View style={s.emptySection}>
                    <Icon name="cash-remove" size={36} color={colors.textMuted} />
                    <Text style={s.emptySectionText}>Sin gastos registrados hoy</Text>
                </View>
            )}

            {gastos.map((item, idx) => (
                <GastoRow
                    key={item.pagosId?.toString() || idx.toString()}
                    item={item}
                    onDelete={() => setDeleteTarget({ id: item.pagosId!, name: item.nombreGasto || 'gasto' })}
                    deleting={deleting}
                    s={s}
                />
            ))}

            {/* Delete confirmation */}
            <ConfirmModal
                visible={!!deleteTarget}
                title="Eliminar gasto"
                message={`¿Eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
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
