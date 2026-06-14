import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView } from '../../tw';
import { RefreshControl } from 'react-native';
import { PageContainer, PageHeader, Card, Icon, ListSkeleton, Button, DateRangeFilter } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, formatCurrency, getLocalDateString } from '@/src/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

type DomiciliarioStat = {
    nombre: string;
    entregas: number;
    ganancia: number;
};

function getInitials(name: string): string {
    return (name || '?')
        .split(' ')
        .slice(0, 2)
        .map(w => w[0] || '')
        .join('')
        .toUpperCase();
}

const AVATAR_COLORS = [
    '#F5A524', '#6366F1', '#10B981', '#EC4899', '#06B6D4', '#F43F5E', '#A855F7',
];

function getColor(idx: number): string {
    return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <Card className="flex-1 p-4 border border-white/5 items-center">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-2">{label}</Text>
            <Text
                className="font-black text-2xl"
                style={{ fontFamily: 'Space Grotesk', color: color || '#FFFFFF' }}
            >
                {value}
            </Text>
            {!!sub && <Text className="text-slate-500 text-[10px] mt-1">{sub}</Text>}
        </Card>
    );
}

function RankBadge({ rank }: { rank: number }) {
    const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    if (rank <= 3) {
        return (
            <View className="w-8 h-8 items-center justify-center">
                <Text style={{ fontSize: 20 }}>{medals[rank]}</Text>
            </View>
        );
    }
    return (
        <View className="w-8 h-8 rounded-full bg-white/5 border border-white/10 items-center justify-center">
            <Text className="text-slate-500 font-black text-xs">{rank}</Text>
        </View>
    );
}

function DomiciliarioCard({
    stat,
    rank,
    maxEntregas,
    colorIdx,
}: {
    stat: DomiciliarioStat;
    rank: number;
    maxEntregas: number;
    colorIdx: number;
}) {
    const color = getColor(colorIdx);
    const pct = maxEntregas > 0 ? (stat.entregas / maxEntregas) * 100 : 0;

    return (
        <Card className="mb-4 p-5 border border-white/5 overflow-hidden">
            {/* Top row */}
            <View className="flex-row items-center gap-4 mb-4">
                <RankBadge rank={rank} />

                {/* Avatar */}
                <View
                    className="w-12 h-12 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: color + '20', borderWidth: 1, borderColor: color + '40' }}
                >
                    <Text className="font-black text-sm" style={{ color, fontFamily: 'Space Grotesk' }}>
                        {getInitials(stat.nombre)}
                    </Text>
                </View>

                <View className="flex-1">
                    <Text className="text-white font-black text-base uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                        {stat.nombre}
                    </Text>
                    <View className="flex-row items-center gap-3 mt-0.5">
                        <View className="flex-row items-center gap-1">
                            <Icon name="truck-check-outline" size={12} color="#64748B" />
                            <Text className="text-slate-500 text-[11px] font-bold">
                                {stat.entregas} {stat.entregas === 1 ? 'entrega' : 'entregas'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Ganancia */}
                <View className="items-end">
                    <Text className="text-emerald-400 font-black text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                        ${formatCurrency(stat.ganancia)}
                    </Text>
                    <Text className="text-slate-600 text-[9px] font-black uppercase tracking-wider">ganancia</Text>
                </View>
            </View>

            {/* Progress bar */}
            <View className="h-2 bg-white/5 rounded-full overflow-hidden">
                <View
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                />
            </View>

            {/* Bottom stats */}
            <View className="flex-row mt-4 gap-4">
                <View className="flex-1 bg-white/5 rounded-xl p-3 items-center border border-white/5">
                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Viajes</Text>
                    <Text className="text-white font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>{stat.entregas}</Text>
                </View>
                <View className="flex-1 bg-emerald-500/5 rounded-xl p-3 items-center border border-emerald-500/10">
                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Ganancia</Text>
                    <Text className="text-emerald-400 font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>
                        ${formatCurrency(stat.ganancia)}
                    </Text>
                </View>
                {stat.entregas > 0 && (
                    <View className="flex-1 bg-indigo-500/5 rounded-xl p-3 items-center border border-indigo-500/10">
                        <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Promedio</Text>
                        <Text className="text-indigo-400 font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>
                            ${formatCurrency(Math.round(stat.ganancia / stat.entregas))}
                        </Text>
                    </View>
                )}
            </View>
        </Card>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EstadisticasDomiciliariosScreen() {
    const { showToast } = useToast();

    const today = getLocalDateString();
    const [from, setFrom] = useState(today);
    const [to, setTo] = useState(today);
    const [stats, setStats] = useState<DomiciliarioStat[]>([]);
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [completingId, setCompletingId] = useState<number | null>(null);

    const fetchStats = useCallback(async (fromDate: string, toDate: string) => {
        try {
            const data = await api.estadisticas.domiciliariosStats(fromDate, toDate);
            const sorted = [...data].sort((a: DomiciliarioStat, b: DomiciliarioStat) => b.entregas - a.entregas);
            setStats(sorted);

            const isToday = fromDate === toDate && fromDate === getLocalDateString();
            if (isToday) {
                const allToday = await api.domicilios.getAllDay();
                setPendingOrders(allToday.filter(d => d.estado === 'pendiente'));
            } else {
                setPendingOrders([]);
            }
        } catch (error) {
            console.error(error);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    const handleComplete = async (domicilioId: number) => {
        try {
            setCompletingId(domicilioId);
            await api.domicilios.update(domicilioId, { 
                estado: 'entregado',
                fechaEntrega: new Date().toISOString()
            });
            showToast('Domicilio completado correctamente', 'success');
            setConfirmingId(null);
            void fetchStats(from, to);
        } catch (error) {
            showToast('Error al completar domicilio', 'error');
        } finally {
            setCompletingId(null);
        }
    };

    useEffect(() => {
        void fetchStats(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchStats]);

    const onRefresh = () => {
        setRefreshing(true);
        void fetchStats(from, to);
    };

    // ── Computed ─────────────────────────────────────────────────────────────

    const totalEntregas = stats.reduce((s, d) => s + d.entregas, 0);
    const totalGanancia = stats.reduce((s, d) => s + d.ganancia, 0);
    const domiciliariosActivos = stats.filter(d => d.entregas > 0).length;
    const maxEntregas = stats.length > 0 ? stats[0].entregas : 1;
    const avgPorDom = domiciliariosActivos > 0 ? Math.round(totalEntregas / domiciliariosActivos) : 0;

    const rangeLabel = from === to ? from : `${from} — ${to}`;

    if (loading && !refreshing) {
        return <PageContainer><ListSkeleton count={5} /></PageContainer>;
    }

    return (
        <PageContainer>
            <PageHeader
                title="Domiciliarios"
                subtitle="Rendimiento de repartidores"
                icon="chart-bar"
                rightContent={
                    <Button
                        title="Actualizar"
                        icon="refresh"
                        variant="ghost"
                        size="sm"
                        onPress={onRefresh}
                    />
                }
            />

            <ScrollView
                contentContainerClassName="pb-12"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />}
            >
                {/* ── Date Range Selector ── */}
                <DateRangeFilter
                    from={from}
                    to={to}
                    onFromChange={setFrom}
                    onToChange={setTo}
                    onSearch={(f, t) => { setFrom(f); setTo(t); setLoading(true); void fetchStats(f, t); }}
                    loading={loading}
                />

                {/* ── KPI Row ── */}
                <View className="flex-row gap-3 mb-6 flex-wrap">
                    <StatCard
                        label={`Entregas (${rangeLabel})`}
                        value={totalEntregas}
                        color="#F5A524"
                    />
                    <StatCard
                        label="Activos"
                        value={domiciliariosActivos}
                        sub="domiciliarios"
                        color="#6366F1"
                    />
                    <StatCard
                        label="Promedio / Dom"
                        value={avgPorDom}
                        sub="viajes"
                        color="#06B6D4"
                    />
                </View>

                {/* ── Ganancia total banner ── */}
                <Card className="mb-6 p-5 border border-emerald-500/20 bg-emerald-500/5 flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 items-center justify-center">
                        <Icon name="cash-multiple" size={22} color="#10B981" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                            Total Ganado por el Equipo · {rangeLabel}
                        </Text>
                        <Text className="text-emerald-400 font-black text-xl sm:text-3xl" style={{ fontFamily: 'Space Grotesk' }}>
                            ${formatCurrency(totalGanancia)}
                        </Text>
                    </View>
                </Card>

                {/* ── Pending Deliveries (Today Only) ── */}
                {from === to && from === getLocalDateString() && pendingOrders.length > 0 && (
                    <View className="mb-8">
                        <View className="flex-row items-center gap-2 mb-4 px-1">
                            <View className="w-8 h-8 rounded-xl bg-orange-500/15 items-center justify-center">
                                <Icon name="clock-alert-outline" size={16} color="#F59E0B" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                                    Entregas Pendientes
                                </Text>
                                <Text className="text-slate-500 text-[10px] uppercase font-bold">Activas en este momento</Text>
                            </View>
                            <View className="bg-orange-500/20 px-2 py-0.5 rounded-full">
                                <Text className="text-orange-400 font-bold text-[10px]">{pendingOrders.length}</Text>
                            </View>
                        </View>

                        {pendingOrders.map((dom) => (
                            <Card key={dom.domicilioId} className="mb-3 p-4 border border-orange-500/10 bg-orange-500/5 flex-row items-center gap-4">
                                <View className="flex-1">
                                    <Text className="text-white font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                                        {dom.direccion}
                                    </Text>
                                    <Text className="text-slate-400 text-[10px] mt-0.5">
                                        Asignado a: <Text className="text-orange-400 font-bold capitalize">{dom.domiciliario?.nombre || 'Sin asignar'}</Text>
                                    </Text>
                                </View>

                                {confirmingId === dom.domicilioId ? (
                                    <View className="flex-row gap-2">
                                        <Button 
                                            title="No" 
                                            variant="ghost" 
                                            size="sm" 
                                            onPress={() => setConfirmingId(null)} 
                                        />
                                        <Button 
                                            title="Confirmar" 
                                            variant="secondary" 
                                            size="sm" 
                                            loading={completingId === dom.domicilioId}
                                            onPress={() => handleComplete(dom.domicilioId)} 
                                        />
                                    </View>
                                ) : (
                                    <Button 
                                        title="Completar" 
                                        variant="outline" 
                                        size="sm" 
                                        icon="check-circle-outline"
                                        onPress={() => setConfirmingId(dom.domicilioId)} 
                                    />
                                )}
                            </Card>
                        ))}
                    </View>
                )}

                {/* ── Ranking ── */}
                <View className="flex-row items-center gap-2 mb-4 px-1">
                    <View className="w-8 h-8 rounded-xl bg-amber-500/15 items-center justify-center">
                        <Icon name="trophy-outline" size={16} color="#F5A524" />
                    </View>
                    <Text className="text-white font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                        Ranking · {rangeLabel}
                    </Text>
                </View>

                {stats.length > 0 ? (
                    stats.map((s, idx) => (
                        <DomiciliarioCard
                            key={s.nombre + idx}
                            stat={s}
                            rank={idx + 1}
                            maxEntregas={maxEntregas}
                            colorIdx={idx}
                        />
                    ))
                ) : (
                    <View className="bg-white/5 rounded-3xl border border-dashed border-white/10 py-20 items-center">
                        <Icon name="chart-line-variant" size={60} color="#334155" />
                        <Text className="text-slate-600 font-black mt-5 uppercase tracking-widest text-xs">
                            Sin actividad en este período
                        </Text>
                        <Text className="text-slate-700 text-xs mt-2">
                            Ningún domicilio fue marcado como entregado
                        </Text>
                    </View>
                )}
            </ScrollView>
        </PageContainer>
    );
}
