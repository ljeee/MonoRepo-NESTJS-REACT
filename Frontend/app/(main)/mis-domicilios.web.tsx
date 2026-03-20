import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { PageContainer, PageHeader, Button, Icon, Card, Badge, ListSkeleton } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, formatCurrency } from '@monorepo/shared';
import { getEstadoColor } from '../../constants/estados';

export default function MisDomiciliosScreen() {
    const { showToast } = showToastHook(); // Using local helper for now
    const [domicilios, setDomicilios] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDomicilios = useCallback(async () => {
        try {
            const data = await api.domicilios.getMe();
            setDomicilios(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDomicilios();
    }, [fetchDomicilios]);

    const handleComplete = async (id: number) => {
        try {
            await api.domicilios.update(id, { estadoDomicilio: 'entregado' });
            fetchDomicilios();
        } catch {
            alert('Error al actualizar el estado');
        }
    };

    const totalEntregados = domicilios.filter(d => d.estadoDomicilio === 'entregado').length;
    const totalGanado = domicilios
        .filter(d => d.estadoDomicilio === 'entregado')
        .reduce((acc, d) => acc + (Number(d.costoDomicilio) || 0), 0);
    const pendientes = domicilios.filter(d => d.estadoDomicilio !== 'entregado');

    if (loading && !refreshing) return <PageContainer><ListSkeleton count={4} /></PageContainer>;

    return (
        <PageContainer>
            <PageHeader title="Mis Domicilios" icon="truck-delivery-outline" />

            <ScrollView 
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={() => { setRefreshing(true); fetchDomicilios(); }} 
                        tintColor="#F5A524" 
                    />
                }
            >
                <View className="flex-row gap-4 mb-6">
                    <Card className="flex-1 p-5 border border-white/5 bg-(--color-pos-primary)/10">
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Entregados Hoy</Text>
                        <Text className="text-white font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>{totalEntregados}</Text>
                    </Card>
                    <Card className="flex-1 p-5 border border-white/5 bg-emerald-500/10">
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Ganancia Hoy</Text>
                        <Text className="text-emerald-400 font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>${formatCurrency(totalGanado)}</Text>
                    </Card>
                </View>

                <View className="mb-8">
                    <View className="flex-row items-center gap-2 mb-4 px-2">
                        <View className="w-2 h-2 rounded-full bg-(--color-pos-primary)" />
                        <Text className="text-white font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Pendientes Por Entregar</Text>
                    </View>

                    {pendientes.length > 0 ? (
                        pendientes.map(d => (
                            <DomicilioCard key={d.domicilioId} item={d} onComplete={() => handleComplete(d.domicilioId)} />
                        ))
                    ) : (
                        <View className="bg-white/5 rounded-3xl border border-dashed border-white/10 p-12 items-center">
                            <Icon name="check-decagram-outline" size={48} color="#34D399" />
                            <Text className="text-slate-500 font-bold mt-4 uppercase tracking-widest text-xs">¡Todo entregado por ahora!</Text>
                        </View>
                    )}
                </View>

                {totalEntregados > 0 && (
                    <View>
                        <View className="flex-row items-center gap-2 mb-4 px-2 opacity-50">
                            <View className="w-2 h-2 rounded-full bg-slate-500" />
                            <Text className="text-slate-500 font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Historial del Día</Text>
                        </View>
                        {domicilios.filter(d => d.estadoDomicilio === 'entregado').map(d => (
                            <DomicilioCard key={d.domicilioId} item={d} isCompleted />
                        ))}
                    </View>
                )}
            </ScrollView>
        </PageContainer>
    );
}

function DomicilioCard({ item, onComplete, isCompleted = false }: { item: any; onComplete?: () => void; isCompleted?: boolean }) {
    return (
        <Card className={`mb-4 p-6 border border-white/5 ${isCompleted ? 'bg-white/5 opacity-60' : 'bg-(--color-pos-surface)'}`}>
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1">
                    <Text className="text-white font-black text-lg uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                        {item.cliente?.clienteNombre || 'Cliente'}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                        <Icon name="map-marker-radius-outline" size={14} color="#94A3B8" />
                        <Text className="text-slate-400 text-xs font-bold">{item.direccionEntrega || 'Sin dirección'}</Text>
                    </View>
                </View>
                <Badge 
                    label={isCompleted ? 'Completado' : 'Asignado'} 
                    variant={isCompleted ? 'success' : 'primary'} 
                />
            </View>

            <View className="h-[1px] bg-white/5 my-4" />

            <View className="flex-row justify-between items-center">
                <View>
                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Pago Domicilio</Text>
                    <Text className="text-emerald-400 font-black text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                        ${formatCurrency(Number(item.costoDomicilio) || 0)}
                    </Text>
                </View>
                
                {!isCompleted && (
                    <Button 
                        title="Marcar Entregado" 
                        icon="check-circle-outline" 
                        variant="primary" 
                        size="sm"
                        onPress={() => onComplete && onComplete()}
                    />
                )}
            </View>
        </Card>
    );
}

function showToastHook() {
    return { showToast: (msg: string, type: any) => alert(msg) };
}
