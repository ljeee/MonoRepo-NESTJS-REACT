import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ActivityIndicator, Platform, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { ScrollView } from '../../tw';
import { Button, Icon, ListSkeleton } from '../../components/ui';
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
            return { label: 'Pendiente', color: '#F5A524', colorRgb: '245,165,36' }; // Naranja login
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
    }, []);

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
        <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
            <View style={{
                marginBottom: 16,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: `rgba(${badge.colorRgb}, 0.2)`,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 6,
                opacity: done ? 0.6 : 1,
            }}>
                {/* Acento superior */}
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    backgroundColor: `rgba(${badge.colorRgb}, 0.5)`,
                    borderTopLeftRadius: 20, borderTopRightRadius: 20,
                }} />

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16, textTransform: 'uppercase' }} numberOfLines={1}>
                            {clienteNombre}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            {item.orden?.ordenId && (
                                <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 }}>Orden #{item.orden.ordenId}</Text>
                            )}
                            {item.fechaCreado && (
                                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 12 }}>• {formatDateTime(item.fechaCreado)}</Text>
                            )}
                        </View>
                    </View>
                    <View style={{
                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                        backgroundColor: `rgba(${badge.colorRgb}, 0.15)`,
                        borderWidth: 1, borderColor: `rgba(${badge.colorRgb}, 0.3)`,
                    }}>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: badge.color, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {badge.label}
                        </Text>
                    </View>
                </View>

                {/* Dirección */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: 'rgba(139,92,246,0.05)', padding: 12, borderRadius: 14,
                    borderWidth: 1, borderColor: 'rgba(139,92,246,0.15)', marginBottom: 12,
                }}>
                    <Icon name="map-marker-radius-outline" size={18} color="#A78BFA" />
                    <Text style={{ fontFamily: 'Outfit', color: '#F8FAFC', fontSize: 14, flex: 1 }} numberOfLines={3}>
                        {item.direccionEntrega || 'Dirección no especificada'}
                    </Text>
                </View>

                {/* Productos */}
                {productos.length > 0 && (
                    <View style={{
                        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14,
                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                        marginBottom: 16,
                    }}>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                                Productos
                            </Text>
                        </View>
                        {productos.map((p, idx) => (
                            <View key={`${p.id ?? idx}`} style={{
                                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                                paddingHorizontal: 16, paddingVertical: 10,
                                borderBottomWidth: idx < productos.length - 1 ? 1 : 0,
                                borderBottomColor: 'rgba(255,255,255,0.05)',
                            }}>
                                <Text style={{ fontFamily: 'Outfit', color: '#CBD5E1', fontSize: 13, flex: 1 }} numberOfLines={1}>
                                    {getProductName(p)}
                                </Text>
                                <View style={{ backgroundColor: 'rgba(245,165,36,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 12 }}>x{p.cantidad}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Acción completar */}
                {!done && onComplete && (
                    <View>
                        {confirming ? (
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity 
                                    onPress={onCancel} 
                                    style={{
                                        flex: 1, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
                                        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 13, textTransform: 'uppercase' }}>No</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={onConfirm} 
                                    disabled={loading}
                                    style={{
                                        flex: 2, height: 48, borderRadius: 14, backgroundColor: '#F5A524',
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        opacity: loading ? 0.7 : 1
                                    }}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#000" />
                                    ) : (
                                        <>
                                            <Icon name="check-bold" size={18} color="#000" />
                                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#000', fontSize: 13, textTransform: 'uppercase' }}>Sí, Entregado</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={onComplete} style={{
                                height: 48, borderRadius: 14, backgroundColor: '#10B981',
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                            }}>
                                <Icon name="check-circle-outline" size={20} color="#000" />
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#000', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Marcar como Entregado
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {done && (
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        backgroundColor: 'rgba(16,185,129,0.1)', paddingVertical: 12, borderRadius: 14,
                        borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
                    }}>
                        <Icon name="check-decagram" size={16} color="#10B981" />
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Entregado
                        </Text>
                    </View>
                )}
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
            // Nota: Para admin/cajero, tal vez se deba usar getAll en lugar de getMe(true), 
            // pero si getMe con all=true funciona como historial personal, se deja para domiciliarios.
            // Para admin, deberíamos usar facturas/ordenes históricas del Admin en su lugar.
            // Para este caso, mostraremos getMe(true).
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <Icon name="clock-time-five-outline" size={18} color="#F5A524" />
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
                                            Por Entregar ({pendientes.length})
                                        </Text>
                                    </View>
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
                                </>
                            ) : (
                                <View style={{
                                    backgroundColor: 'rgba(16,185,129,0.05)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)',
                                    paddingVertical: 40, alignItems: 'center', marginBottom: 24,
                                }}>
                                    <Icon name="check-decagram-outline" size={52} color="#10B981" />
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', marginTop: 16, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 }}>
                                        ¡Todo entregado!
                                    </Text>
                                </View>
                            )}

                            {entregados.length > 0 && (
                                <View style={{ marginTop: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <Icon name="check-all" size={18} color="#10B981" />
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
                                            Entregados ({entregados.length})
                                        </Text>
                                    </View>
                                    {entregados.map((d, idx) => (
                                        <DomicilioCard key={d.domicilioId} item={d} index={idx} />
                                    ))}
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
