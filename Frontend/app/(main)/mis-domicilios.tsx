import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ActivityIndicator, Platform, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollView } from '../../tw';
import { Button, Icon, ListSkeleton, Badge, PageContainer } from '../../components/ui';
import { api } from '../../services/api';
import { useToast } from '@monorepo/shared';
import { useAuth } from '../../contexts/AuthContext';
import {
    useSharedValue, useAnimatedStyle, withTiming, withSpring,
    withRepeat, withSequence, Easing
} from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { FadeInUp } from 'react-native-reanimated';

// ─── Types ───────────────────────────────────────────────────────────────────

type Producto = {
    id?: number;
    producto?: string;
    productoNombre?: string;
    cantidad: number;
};

type Domicilio = {
    domicilioId: number;
    direccionEntrega?: string;
    estadoDomicilio?: string;
    fechaCreado?: string;
    costoDomicilio?: number;
    cliente?: { clienteNombre?: string };
    orden?: {
        ordenId?: number;
        productos?: Producto[];
        factura?: { clienteNombre?: string };
    };
};

type Tab = 'hoy' | 'historial';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getProductName(p: Producto): string {
    return p.productoNombre?.trim() || p.producto?.trim() || 'Producto';
}

function formatDateTime(dateStr?: string, showDate = false): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (showDate) {
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) +
               ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

type EstadoBadge = { label: string; color: string; colorRgb: string };

function getEstadoBadge(estado?: string): EstadoBadge {
    switch ((estado || '').toLowerCase()) {
        case 'pendiente':
            return { label: 'Pendiente', color: '#F5A524', colorRgb: '245,165,36' };
        case 'entregado':
        case 'completada':
        case 'completado':
            return { label: 'Entregado', color: '#10B981', colorRgb: '16,185,129' };
        default:
            return { label: estado || 'N/A', color: '#94A3B8', colorRgb: '148,163,184' };
    }
}

function isCompleted(estado?: string): boolean {
    return ['entregado', 'completado', 'completada'].includes((estado || '').toLowerCase());
}

// ─── Animaciones Base ────────────────────────────────────────────────────────

function AnimatedOrb({ delay = 0, size = 200, color = '#F5A524', style }: any) {
    const opacity = useSharedValue(0.12);
    const scale   = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.22, { duration: 3200 + delay * 500 }),
                withTiming(0.09, { duration: 3200 + delay * 500 }),
            ), -1, true,
        );
        scale.value = withRepeat(
            withSequence(
                withTiming(1.09, { duration: 4200 + delay * 600, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.94, { duration: 4200 + delay * 600, easing: Easing.inOut(Easing.sin) }),
            ), -1, true,
        );
    }, [delay, opacity, scale]);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View
            style={[animStyle, {
                position: 'absolute', width: size, height: size,
                borderRadius: size / 2, backgroundColor: color,
            }, style]}
        />
    );
}

// ─── Tab Selector ─────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
    return (
        <View style={{
            flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 20, padding: 4, marginBottom: 24,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        }}>
            {([
                { key: 'hoy',      label: 'Hoy',      icon: 'clock-outline' },
                { key: 'historial', label: 'Historial', icon: 'history' },
            ] as { key: Tab; label: string; icon: string }[]).map(tab => (
                <Pressable
                    key={tab.key}
                    onPress={() => onChange(tab.key)}
                    style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 8, paddingVertical: 12, borderRadius: 16,
                        backgroundColor: active === tab.key ? '#F5A524' : 'transparent',
                    }}
                >
                    <Icon name={tab.icon as any} size={16} color={active === tab.key ? '#000' : '#94A3B8'} />
                    <Text style={{
                        fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, textTransform: 'uppercase',
                        color: active === tab.key ? '#000' : '#94A3B8', letterSpacing: 1,
                    }}>
                        {tab.label}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ domicilios }: { domicilios: Domicilio[] }) {
    const entregados = domicilios.filter(d => isCompleted(d.estadoDomicilio)).length;
    const pendientes = domicilios.filter(d => !isCompleted(d.estadoDomicilio)).length;

    return (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <View style={{
                flex: 1, padding: 16, alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20,
                borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)',
            }}>
                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                    Pendientes
                </Text>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 28 }}>{pendientes}</Text>
            </View>
            <View style={{
                flex: 1, padding: 16, alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20,
                borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
            }}>
                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                    Entregados
                </Text>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 28 }}>{entregados}</Text>
            </View>
        </View>
    );
}

// ─── DomicilioCard (Hoy) ─────────────────────────────────────────────────────

function DomicilioCard({ 
    item, index, onComplete, confirming = false, onConfirm = () => {}, onCancel = () => {}, loading = false 
}: { 
    item: Domicilio; index: number; onComplete?: () => void; 
    confirming?: boolean; onConfirm?: () => void; onCancel?: () => void;
    loading?: boolean;
}) {
    const badge      = getEstadoBadge(item.estadoDomicilio);
    const done       = isCompleted(item.estadoDomicilio);
    const clienteNombre = item.cliente?.clienteNombre || item.orden?.factura?.clienteNombre || 'Cliente';
    const productos  = item.orden?.productos || [];

    return (
        <Animated.View entering={FadeInUp.delay(index * 60).springify()} className={`${Platform.OS === 'web' ? 'w-full md:w-[49.2%]' : 'w-full'}`}>
            <View className={`mb-4 bg-white/5 rounded-3xl border border-white/5 overflow-hidden shadow-2xl ${done ? 'opacity-60' : 'opacity-100'}`} style={{ borderTopWidth: 3, borderTopColor: badge.color }}>
                {/* Header Contextual */}
                <View className="flex-row items-center justify-between px-6 py-4 bg-white/5">
                    <View className="flex-1 mr-4">
                        <Text className="text-white font-black text-sm uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                            {clienteNombre}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-0.5">
                            {item.orden?.ordenId && (
                                <Text className="text-slate-500 font-bold text-[9px] uppercase tracking-widest">#{item.orden.ordenId}</Text>
                            )}
                            {item.fechaCreado && (
                                <Text className="text-slate-600 font-bold text-[9px] uppercase tracking-widest">• {formatDateTime(item.fechaCreado)}</Text>
                            )}
                        </View>
                    </View>
                    <Badge label={badge.label} variant={badge.label.toLowerCase() === 'entregado' ? 'success' : 'warning'} size="sm" />
                </View>

                <View className="p-5">
                    {/* Dirección */}
                    <View className="flex-row items-center gap-3 bg-violet-500/10 p-4 rounded-2xl border border-violet-500/20 mb-4">
                        <Icon name="map-marker" size={16} color="#A78BFA" />
                        <Text className="text-slate-200 font-bold text-xs flex-1 leading-tight" numberOfLines={2}>
                            {item.direccionEntrega || 'Sin dirección'}
                        </Text>
                    </View>

                    {/* Resumen Productos */}
                    {productos.length > 0 && (
                        <View className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden mb-6">
                            {productos.map((p, idx) => (
                                <View key={`${p.id ?? idx}`} className={`flex-row justify-between items-center px-4 py-2.5 ${idx < productos.length - 1 ? 'border-b border-white/5' : ''}`}>
                                    <Text className="text-slate-300 font-bold text-[11px] flex-1" numberOfLines={1}>
                                        {getProductName(p)}
                                    </Text>
                                    <View className="bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                                        <Text className="text-orange-500 font-black text-[10px]">x{p.cantidad}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Acción completar */}
                    {!done && onComplete && (
                        <View className="mt-4">
                            {confirming ? (
                                <View className="flex-row gap-3">
                                    <TouchableOpacity 
                                        onPress={onCancel} 
                                        className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 items-center justify-center"
                                    >
                                        <Text className="text-slate-400 font-black text-[10px] uppercase tracking-widest">No</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={onConfirm} 
                                        disabled={loading}
                                        className="flex-[2] h-12 rounded-2xl bg-orange-500 flex-row items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color="#000" />
                                        ) : (
                                            <>
                                                <Icon name="check-bold" size={16} color="#000" />
                                                <Text className="text-black font-black text-[10px] uppercase tracking-widest">Sí, Entregado</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity 
                                    onPress={onComplete} 
                                    className="h-12 rounded-2xl bg-emerald-500 flex-row items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                >
                                    <Icon name="check-circle-outline" size={18} color="#000" />
                                    <Text className="text-black font-black text-[10px] uppercase tracking-widest">Marcar como Entregado</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {done && (
                        <View className="h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex-row items-center justify-center gap-2">
                            <Icon name="check-decagram" size={16} color="#10B981" />
                            <Text className="text-emerald-500 font-black text-[10px] uppercase tracking-widest">Entregado</Text>
                        </View>
                    )}
                </View>
            </View>
        </Animated.View>
    );
}

// ─── HistoryRow (Historial) ───────────────────────────────────────────────────

function HistoryRow({ item }: { item: Domicilio }) {
    const badge = getEstadoBadge(item.estadoDomicilio);
    const clienteNombre = item.cliente?.clienteNombre || item.orden?.factura?.clienteNombre || 'Cliente';

    return (
        <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16,
            borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
        }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: badge.color }} />
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14 }} numberOfLines={1}>{clienteNombre}</Text>
                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 }} numberOfLines={1}>{item.direccionEntrega || 'Sin dirección'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={{
                    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                    backgroundColor: `rgba(${badge.colorRgb}, 0.15)`, borderWidth: 1, borderColor: `rgba(${badge.colorRgb}, 0.3)`,
                }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: badge.color, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {badge.label}
                    </Text>
                </View>
                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10 }}>{formatDateTime(item.fechaCreado, true)}</Text>
            </View>
        </View>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MisDomiciliosScreen() {
    const router        = useRouter();
    const { showToast } = useToast();
    const { user }      = useAuth();

    const [tab, setTab]                   = useState<Tab>('hoy');
    const [domiciliosHoy, setHoy]         = useState<Domicilio[]>([]);
    const [domiciliosAll, setAll]         = useState<Domicilio[]>([]);
    const [loadingHoy, setLoadingHoy]     = useState(true);
    const [loadingAll, setLoadingAll]     = useState(false);
    const [refreshing, setRefreshing]     = useState(false);
    const [historialLoaded, setHistorialLoaded] = useState(false);
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [completingId, setCompletingId] = useState<number | null>(null);

    const userName = user && (user as any).name ? String((user as any).name) : 'Domiciliario';
    const isWeb = Platform.OS === 'web';

    const isAdminOrCajero = user && ['admin', 'cajero'].includes((user as any).role?.toLowerCase());

    const fetchHoy = useCallback(async () => {
        try {
            const data = isAdminOrCajero ? await api.domicilios.getAllDay() : await api.domicilios.getMe(false);
            setHoy(data);
        } catch {
            showToast('Error al cargar domicilios de hoy', 'error');
        } finally {
            setLoadingHoy(false);
            setRefreshing(false);
        }
    }, [showToast, isAdminOrCajero]);

    const fetchHistorial = useCallback(async () => {
        setLoadingAll(true);
        try {
            const data = isAdminOrCajero ? await api.domicilios.getAllDay() : await api.domicilios.getMe(true);
            setAll(data);
            setHistorialLoaded(true);
        } catch {
            showToast('Error al cargar historial', 'error');
        } finally {
            setLoadingAll(false);
            setRefreshing(false);
        }
    }, [showToast, isAdminOrCajero]);

    useEffect(() => { fetchHoy(); }, [fetchHoy]);

    useEffect(() => {
        if (tab === 'historial' && !historialLoaded) {
            fetchHistorial();
        }
    }, [tab, historialLoaded, fetchHistorial]);

    const onRefresh = () => {
        setRefreshing(true);
        if (tab === 'hoy') {
            fetchHoy();
        } else {
            setHistorialLoaded(false);
            fetchHistorial();
        }
    };

    const handleComplete = async (id: number) => {
        try {
            setCompletingId(id);
            await api.domicilios.update(id, { 
                estadoDomicilio: 'entregado',
                fechaEntrega: new Date().toISOString()
            });
            showToast('¡Domicilio marcado como entregado! 🎉', 'success');
            setConfirmingId(null);
            fetchHoy();
        } catch {
            showToast('Error al actualizar estado', 'error');
        } finally {
            setCompletingId(null);
        }
    };

    const pendientes = domiciliosHoy.filter(d => !isCompleted(d.estadoDomicilio));
    const entregados = domiciliosHoy.filter(d =>  isCompleted(d.estadoDomicilio));

    if (isAdminOrCajero) {
        return (
            <PageContainer>
                <View className="flex-1 items-center justify-center p-10 bg-black/20 rounded-[40px] m-4 border border-white/5">
                    <View className="w-20 h-20 rounded-3xl bg-orange-500/10 items-center justify-center mb-8 border border-orange-500/20">
                        <Icon name="shield-lock-outline" size={48} color="#F5A524" />
                    </View>
                    <Text className="text-white font-black text-2xl text-center mb-3 uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>Vista de Gestión</Text>
                    <Text className="text-slate-500 text-center font-bold uppercase tracking-widest text-[9px] mb-10 leading-relaxed">
                        Como administrador, debe utilizar el panel de 'Analíticas Domiciliarios' para supervisar las entregas globales.
                    </Text>
                    <Button 
                        title="Ir a Analíticas" 
                        variant="primary"
                        icon="chart-bar"
                        className="w-full max-w-[240px]" 
                        onPress={() => router.push('/estadisticas-domiciliarios')} 
                    />
                </View>
            </PageContainer>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#060E1A', position: 'relative', overflow: 'hidden' }}>
            {/* Orbs de fondo */}
            <AnimatedOrb size={280} color="#F5A524" delay={0} style={{ top: -80, left: -60 }} />
            <AnimatedOrb size={220} color="#8B5CF6" delay={1} style={{ bottom: -60, right: -50 }} />
            <AnimatedOrb size={150} color="#10B981" delay={2} style={{ top: '40%', right: -40 }} />

            {/* Patrón de puntos */}
            {isWeb && (
                <View style={{
                    position: 'absolute', inset: 0, opacity: 0.03,
                    backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                } as any} />
            )}

            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
                {/* Header */}
                <Animated.View entering={FadeInUp.delay(0).duration(500)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <View className="flex-row items-center justify-between w-full">
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <View style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    backgroundColor: 'rgba(245,165,36,0.15)',
                                    alignItems: 'center', justifyContent: 'center',
                                    borderWidth: 1, borderColor: 'rgba(245,165,36,0.3)',
                                }}>
                                    <Icon name="truck-delivery-outline" size={22} color="#F5A524" />
                                </View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 26, color: '#F8FAFC', letterSpacing: -0.5 }}>
                                    Mis <Text style={{ color: '#F5A524' }}>Domicilios</Text>
                                </Text>
                            </View>
                            <Text style={{ fontFamily: 'Outfit', fontSize: 13, color: '#64748B', marginLeft: 50 }}>
                                {userName}
                            </Text>
                        </View>

                        <TouchableOpacity onPress={onRefresh} style={{
                            width: 44, height: 44, borderRadius: 14,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Icon name="refresh" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(100)}>
                     <TabBar active={tab} onChange={setTab} />
                </Animated.View>

                {tab === 'hoy' && (
                    loadingHoy ? <ListSkeleton count={5} /> : (
                        <ScrollView
                            contentContainerStyle={{ paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />}
                        >
                            <StatsRow domicilios={domiciliosHoy} />

                            {pendientes.length > 0 ? (
                                <>
                                    <View className="flex-row items-center gap-2 mb-4">
                                        <Icon name="clock-outline" size={16} color="#F5A524" />
                                        <Text className="text-white font-black text-xs uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Por Entregar ({pendientes.length})</Text>
                                    </View>
                                    <View className="flex-row flex-wrap gap-3">
                                        {pendientes.map((d, idx) => (
                                            <DomicilioCard 
                                                key={d.domicilioId} 
                                                item={d} 
                                                index={idx} 
                                                onComplete={() => setConfirmingId(d.domicilioId)}
                                                confirming={confirmingId === d.domicilioId}
                                                onConfirm={() => handleComplete(d.domicilioId)}
                                                onCancel={() => setConfirmingId(null)}
                                                loading={completingId === d.domicilioId}
                                            />
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <View className="bg-emerald-500/5 rounded-3xl border border-emerald-500/10 py-12 items-center mb-6">
                                    <Icon name="check-decagram-outline" size={48} color="#10B981" />
                                    <Text className="text-emerald-500 font-black text-[11px] uppercase tracking-widest mt-4">¡Todo entregado!</Text>
                                </View>
                            )}

                            {entregados.length > 0 && (
                                <View className="mt-6">
                                    <View className="flex-row items-center gap-2 mb-4">
                                        <Icon name="check-all" size={16} color="#10B981" />
                                        <Text className="text-white font-black text-xs uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Entregados ({entregados.length})</Text>
                                    </View>
                                    <View className="flex-row flex-wrap gap-3">
                                        {entregados.map((d, idx) => (
                                            <DomicilioCard key={d.domicilioId} item={d} index={idx} />
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    )
                )}

                {tab === 'historial' && (
                    loadingAll ? <ListSkeleton count={8} /> : (
                        <ScrollView
                            contentContainerStyle={{ paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />}
                        >
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                                <View style={{ flex: 1, padding: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Total</Text>
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 24 }}>{domiciliosAll.length}</Text>
                                </View>
                                <View style={{ flex: 1, padding: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
                                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Entreg.</Text>
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 24 }}>{domiciliosAll.filter(d => isCompleted(d.estadoDomicilio)).length}</Text>
                                </View>
                                <View style={{ flex: 1, padding: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)' }}>
                                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Pend.</Text>
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 24 }}>{domiciliosAll.filter(d => !isCompleted(d.estadoDomicilio)).length}</Text>
                                </View>
                            </View>

                            {domiciliosAll.length === 0 ? (
                                <View style={{
                                    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                                    borderStyle: 'dashed', paddingVertical: 40, alignItems: 'center',
                                }}>
                                    <Icon name="history" size={48} color="#334155" />
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', marginTop: 16, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 12 }}>
                                        Sin historial aún
                                    </Text>
                                </View>
                            ) : (
                                <View style={{
                                    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
                                    overflow: 'hidden',
                                }}>
                                    {domiciliosAll.map(d => (
                                        <HistoryRow key={d.domicilioId} item={d} />
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    )
                )}
            </View>
        </View>
    );
}
