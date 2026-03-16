import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView } from '../../tw';
import { useFacturasDia } from '@monorepo/shared';
import { useFacturasPagosDia, useDeleteFacturaPago } from '@monorepo/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import type { FacturaPago } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, TouchableOpacity } from '../../tw';

import { FacturaCard } from '../../components/facturas/FacturaShared';
import {
    PageContainer,
    PageHeader,
    Button,
    Icon,
    ListSkeleton,
    ConfirmModal,
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
                    <Text className="text-white/60 font-black text-xs uppercase tracking-widest">Resumen Financiero Hoy</Text>
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
                            <Text className="text-slate-400 text-sm font-bold">Ingresos</Text>
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
                            <Text className="text-slate-400 text-sm font-bold">Gastos</Text>
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

// ─── Gasto item row ───────────────────────────────────────────────────────────

function GastoRow({ item, onDelete, deleting }: {
    item: FacturaPago;
    onDelete: () => void;
    deleting: boolean;
}) {
    return (
        <Card className="flex-row items-center gap-4 p-4 border border-white/5">
            <View className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center">
                <Icon
                    name={item.metodo === 'efectivo' ? 'cash' : 'qrcode'}
                    size={20}
                    color="#F5A524"
                />
            </View>

            <View className="flex-1">
                <Text className="text-white font-black text-sm uppercase" style={{ fontFamily: 'Space Grotesk' }}>{item.nombreGasto || 'Gasto General'}</Text>
                <View className="flex-row items-center gap-2 mt-1">
                    <Text className="text-slate-500 text-[10px] font-bold uppercase">{item.fechaFactura}</Text>
                    <Badge label={item.metodo || '—'} variant="warning" size="sm" />
                </View>
            </View>

            <View className="items-end mr-2">
                <Text className="text-red-400 font-black text-base" style={{ fontFamily: 'Space Grotesk' }}>
                    −${formatCurrency(item.total ?? 0)}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onDelete}
                disabled={deleting}
                className="w-10 h-10 items-center justify-center rounded-xl bg-red-500/10 active:bg-red-500/20"
            >
                <Icon name="trash-can-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
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

    const handleToggleEstado = async (facturaId: number, nuevoEstado: string, metodo?: string) => {
        setUpdatingId(facturaId);
        try {
            if (nuevoEstado === 'pagado' && metodo) {
                await updateFactura(facturaId, { estado: 'pagado', metodo });
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

    const handleExportCsv = useCallback(async () => {
        const csv = await buildCombinedBalanceCsv(facturas, gastos);
        const today = (() => {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        })();
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
                    tintColor="#F5A524"
                    colors={["#F5A524"]}
                />
            }
        >
            <PageHeader
                title="Balance Diario"
                subtitle="Estado de caja hoy"
                icon="scale-balance"
                rightContent={
                    <View className="flex-row items-center gap-2">
                         <Button
                            title=""
                            icon="refresh"
                            variant="ghost"
                            size="sm"
                            onPress={handleRefresh}
                            loading={loading}
                        />
                    </View>
                }
            />

            {/* Balance summary card */}
            <BalanceCard ingresos={ingresos} gastos={totalGastos} />

            {/* ── FACTURAS ───────────────────────────────────────────────────────── */}
            <View className="flex-row items-center gap-3 mb-6 mt-4">
                <View className="w-1.5 h-6 bg-(--color-pos-primary) rounded-full" />
                <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Facturación</Text>
                <View className="bg-white/5 px-2 py-0.5 rounded-md">
                    <Text className="text-slate-500 font-black text-xs">{facturas.length}</Text>
                </View>
            </View>

            {errorFacturas && (
                <View className="flex-row items-center gap-3 bg-red-500/10 p-4 rounded-xl mb-6">
                    <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                    <Text className="text-red-400 text-xs font-bold">{errorFacturas}</Text>
                </View>
            )}

            {loadingFacturas && !facturas.length && <ListSkeleton count={3} />}

            {!loadingFacturas && facturas.length === 0 && !errorFacturas && (
                <View className="items-center py-10 opacity-30">
                    <Icon name="receipt-outline" size={48} color="#64748B" />
                    <Text className="text-slate-400 font-bold mt-4 uppercase text-xs">Sin facturas hoy</Text>
                </View>
            )}

            <View className="flex-row flex-wrap gap-4 mb-10">
                {facturas.map((item, idx) => (
                    <View key={item.facturaId?.toString() || idx.toString()} className={`${isMobile ? 'w-full' : 'w-[48.5%]'}`}>
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

            {loadingGastos && !gastos.length && <ListSkeleton count={2} />}

            {!loadingGastos && gastos.length === 0 && !errorGastos && (
                <View className="items-center py-10 opacity-30">
                    <Icon name="cash-remove" size={48} color="#64748B" />
                    <Text className="text-slate-400 font-bold mt-4 uppercase text-xs">Sin gastos hoy</Text>
                </View>
            )}

            <View className="flex-direction-column gap-y-4 pb-20">
                {gastos.map((item, idx) => (
                    <View key={item.pagosId?.toString() || idx.toString()} className="w-full">
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
                title="Eliminar gasto"
                message={`¿Realmente deseas eliminar "${deleteTarget?.name}"? Esta acción será irreversible.`}
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
