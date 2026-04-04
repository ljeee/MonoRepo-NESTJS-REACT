import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Platform } from 'react-native';
import { ScrollView } from '../../tw';
import { useFacturasDia, useFacturasPagosDia, useDeleteFacturaPago } from '@monorepo/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportPdf } from '../../utils/exportData';
import type { FacturaPago } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, TouchableOpacity, TextInput } from '../../tw';

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
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 32, color: isPositive ? '#F5A524' : '#EF4444', letterSpacing: -1 }}>
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

    useEffect(() => { fetchGastos(); }, [fetchGastos]);

    const handleRefresh = async () => {
        setRefreshing(refreshing);
        await Promise.all([refetchFacturas(), fetchGastos()]);
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

    const ingresos = stats?.totalPagado ?? 0;
    const totalGastos = gastos.reduce((sum, g) => sum + (Number(g.total) || 0), 0);
    const loading = loadingFacturas || loadingGastos;

    const filteredFacturas = facturas.filter(f => 
        !searchQuery || 
        (f.clienteNombre && f.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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
            <View className="flex-row items-center justify-between mb-6 mt-4 flex-wrap gap-4">
                <View className="flex-row items-center gap-3">
                    <View className="w-1.5 h-6 bg-orange-500 rounded-full" />
                    <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Ventas Facturadas</Text>
                    <View className="bg-white/5 px-3 py-1 rounded-full border border-white/5 ml-2">
                        <Text className="text-slate-500 font-bold text-xs">{filteredFacturas.length} docs</Text>
                    </View>
                </View>

                {/* Buscador */}
                <View className="flex-row items-center bg-white/5 rounded-xl px-4 py-2 flex-1 min-w-[250px] border border-white/10 max-w-sm">
                    <Icon name="magnify" size={20} color="#94A3B8" />
                    <TextInput
                        className="text-white ml-3 flex-1 h-8 outline-none font-bold text-sm"
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
                {filteredFacturas.map((item, idx) => (
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
                {gastos.map((item, idx) => (
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
                confirmText="Eliminar permanentemente"
                loading={deleting}
                onConfirm={handleDeleteGasto}
                onCancel={() => setDeleteTarget(null)}
            />
        </PageContainer>
    );
}
