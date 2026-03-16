import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView } from '../../tw';
import { RefreshControl, ActivityIndicator } from 'react-native';
import { PageContainer, PageHeader, Card, Icon, ListSkeleton } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, formatCurrency } from '@monorepo/shared';

export default function EstadisticasDomiciliariosScreen() {
    const { showToast } = useToast();
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const today = (() => {
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            })();
            const data = await api.estadisticas.domiciliariosStats(today, today);
            setStats(data);
        } catch (error) {
            console.error(error);
            showToast('Error al cargar estadísticas', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (loading && !refreshing) return <PageContainer><ListSkeleton count={4} /></PageContainer>;

    return (
        <PageContainer>
            <PageHeader title="Rendimiento Domicilios" icon="chart-bar" />

            <ScrollView 
                contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={() => { setRefreshing(true); fetchStats(); }} 
                        tintColor="#F5A524" 
                    />
                }
            >
                <View className="mb-8 px-2">
                    <Text className="text-white font-black text-xl mb-2" style={{ fontFamily: 'Space Grotesk' }}>Resumen del Día</Text>
                    <Text className="text-slate-400 text-xs uppercase tracking-widest font-bold">Consolidado de entregas y ganancias</Text>
                </View>

                {stats.length > 0 ? (
                    stats.map((s, i) => (
                        <Card key={i} className="mb-4 p-6 border border-white/5 bg-(--color-pos-surface)">
                            <View className="flex-row items-center gap-4">
                                <View className="w-12 h-12 rounded-2xl bg-(--color-pos-primary)/10 items-center justify-center border border-(--color-pos-primary)/20">
                                    <Text className="text-xl">🛵</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-black text-lg uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                                        {s.nombre}
                                    </Text>
                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Colaborador d'firu</Text>
                                </View>
                            </View>

                            <View className="h-[1px] bg-white/5 my-5" />

                            <View className="flex-row gap-6">
                                <View className="flex-1">
                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Viajes</Text>
                                    <View className="flex-row items-end gap-2">
                                        <Text className="text-white font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>{s.entregas}</Text>
                                        <Text className="text-slate-500 text-xs font-bold mb-1">completados</Text>
                                    </View>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Pro producido</Text>
                                    <Text className="text-emerald-400 font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                                        ${formatCurrency(s.ganancia)}
                                    </Text>
                                </View>
                            </View>
                        </Card>
                    ))
                ) : (
                    <View className="bg-white/5 rounded-3xl border border-dashed border-white/10 p-20 items-center">
                        <Icon name="chart-line-variant" size={64} color="#475569" />
                        <Text className="text-slate-500 font-bold mt-6 uppercase tracking-widest text-xs">Sin actividad registrada hoy</Text>
                    </View>
                )}
            </ScrollView>
        </PageContainer>
    );
}
