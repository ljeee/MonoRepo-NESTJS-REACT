import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from '../../tw';
import { RefreshControl, ActivityIndicator } from 'react-native';
import { PageContainer, PageHeader, Card, Icon, ListSkeleton, Button } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, formatCurrency } from '@monorepo/shared';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ──────────────────────────────────────────────────────────────────

type DomiciliarioStat = {
    nombre: string;
    entregas: number;
    ganancia: number;
};

type DateRange = { label: string; days: number };

const DATE_RANGES: DateRange[] = [
    { label: 'Hoy', days: 0 },
    { label: '7 días', days: 7 },
    { label: '15 días', days: 15 },
    { label: '30 días', days: 30 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRangeDates(days: number): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    if (days > 0) from.setDate(from.getDate() - days + 1);
    return { from: toISO(from), to: toISO(to) };
}

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
        <Card className="flex-1 p-4 border border-white/5 items-center min-w-[100px]">
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
    const { user } = useAuth();

    const [stats, setStats] = useState<DomiciliarioStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeRange, setActiveRange] = useState(0); // index into DATE_RANGES

    const fetchStats = useCallback(async (rangeIdx: number) => {
        try {
            const { from, to } = getRangeDates(DATE_RANGES[rangeIdx].days);
            const data = await api.estadisticas.domiciliariosStats(from, to);
            // Sort by entregas descending
            const sorted = [...data].sort((a: DomiciliarioStat, b: DomiciliarioStat) => b.entregas - a.entregas);
            setStats(sorted);
        } catch (error) {
            console.error(error);
            showToast('Error al cargar estadísticas', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchStats(activeRange);
    }, [fetchStats, activeRange]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats(activeRange);
    };

    const handleRangeChange = (idx: number) => {
        setActiveRange(idx);
        setLoading(true);
    };

    // ── Computed ─────────────────────────────────────────────────────────────

    const totalEntregas = stats.reduce((s, d) => s + d.entregas, 0);
    const totalGanancia = stats.reduce((s, d) => s + d.ganancia, 0);
    const domiciliariosActivos = stats.filter(d => d.entregas > 0).length;
    const maxEntregas = stats.length > 0 ? stats[0].entregas : 1;
    const avgPorDom = domiciliariosActivos > 0 ? Math.round(totalEntregas / domiciliariosActivos) : 0;

    const rangeLabel = DATE_RANGES[activeRange].label;

    if (loading && !refreshing) {
        return <PageContainer><ListSkeleton count={5} /></PageContainer>;
    }

    return (
        <PageContainer>
            <PageHeader
                title="Analytics Domicilios"
                subtitle="Rendimiento del equipo de entrega"
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
                <View className="flex-row gap-2 mb-6">
                    {DATE_RANGES.map((r, idx) => {
                        const active = activeRange === idx;
                        return (
                            <TouchableOpacity
                                key={r.label}
                                className={`flex-1 py-2.5 rounded-xl border items-center ${
                                    active
                                        ? 'bg-(--color-pos-primary)/10 border-(--color-pos-primary)/30'
                                        : 'bg-white/5 border-white/5'
                                }`}
                                onPress={() => handleRangeChange(idx)}
                            >
                                <Text
                                    className={`text-xs font-black uppercase tracking-wider ${
                                        active ? 'text-(--color-pos-primary)' : 'text-slate-500'
                                    }`}
                                >
                                    {r.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

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
                        <Text className="text-emerald-400 font-black text-3xl" style={{ fontFamily: 'Space Grotesk' }}>
                            ${formatCurrency(totalGanancia)}
                        </Text>
                    </View>
                </Card>

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
