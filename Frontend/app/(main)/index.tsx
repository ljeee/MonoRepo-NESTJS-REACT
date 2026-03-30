import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import type { VentaHora, ResumenPeriodo, Orden } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import Icon from '../../components/ui/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { PageContainer, PageHeader, Card, Icon as UIIcon } from '../../components/ui';

function formatCurrency(n: number) {
    return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function todayStr(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

function isCompletedEstado(value?: string): boolean {
    const estado = String(value || '').toLowerCase();
    return estado === 'completado' || estado === 'completada' || estado === 'entregado';
}

function getOrdenDisplayName(o: Orden): string {
    const nombre = (o.nombreCliente || '').trim();
    if (nombre) return nombre;

    const nombreFactura = String((o as any)?.factura?.clienteNombre || '').trim();
    if (nombreFactura) return nombreFactura;

    if ((o.tipoPedido || '').toLowerCase() === 'mesa') {
        const mesa = String((o as any)?.mesa || '').trim();
        if (mesa) return `Mesa ${mesa}`;
    }

    return 'Sin nombre';
}

function buildResumenFallback(ords: Orden[], facts: any[], resumenApi: ResumenPeriodo | null): ResumenPeriodo {
    const facturasValidas = facts.filter((f) => f?.estado !== 'cancelado');
    const totalFacturas = facturasValidas.reduce((sum, f) => sum + (Number(f?.total) || 0), 0);
    const ticketFacturas = facturasValidas.length > 0 ? totalFacturas / facturasValidas.length : 0;

    const base: ResumenPeriodo = resumenApi || {
        totalVentas: 0,
        totalEgresos: 0,
        balanceNeto: 0,
        facturas: facturasValidas.length,
        ordenes: ords.length,
        cancelados: 0,
        ticketPromedio: 0,
        tasaCancelacion: 0,
    };

    const hasActivity = ords.length > 0 || facturasValidas.length > 0;
    if (!hasActivity) return base;

    return {
        ...base,
        totalVentas: base.totalVentas > 0 ? base.totalVentas : totalFacturas,
        ticketPromedio: base.ticketPromedio > 0 ? base.ticketPromedio : ticketFacturas,
        ordenes: base.ordenes > 0 ? base.ordenes : ords.length,
        facturas: base.facturas > 0 ? base.facturas : facturasValidas.length,
    };
}

function normalizeHourlySeries(items: VentaHora[]): VentaHora[] {
    const byHour = new Map<number, VentaHora>();
    for (const item of items) {
        const hour = Number(item.hora);
        if (Number.isNaN(hour)) continue;
        byHour.set(hour, { ...item, hora: hour });
    }
    return Array.from({ length: 24 }, (_, hora) => byHour.get(hora) || { hora, cantidad: 0, total: 0 });
}

export default function DashboardPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { isMobile } = useBreakpoint();
    const [clock, setClock] = useState(() => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
    const [dashboard, setDashboard] = useState<{
        loading: boolean;
        resumen: ResumenPeriodo | null;
        ventasHora: VentaHora[];
        ordenes: Orden[];
        pendientes: number;
        sinPagar: number;
        completadas: number;
    }>({
        loading: true,
        resumen: null,
        ventasHora: [],
        ordenes: [],
        pendientes: 0,
        sinPagar: 0,
        completadas: 0,
    });
    const { loading, resumen, ventasHora, ordenes, pendientes, sinPagar, completadas } = dashboard;

    useEffect(() => {
        const tick = () => {
            setClock(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
        };
        const id = setInterval(tick, 30000);
        return () => clearInterval(id);
    }, []);

    const fetchData = useCallback(async () => {
        setDashboard((prev) => ({ ...prev, loading: true }));
        const hoy = todayStr();
        try {
            const [r, vh, ords, facts] = await Promise.allSettled([
                api.estadisticas.resumenPeriodo(hoy, hoy),
                api.estadisticas.ventasPorHora(hoy),
                api.ordenes.getDay(),
                api.facturas.getDay(),
            ]);

            const ordData = ords.status === 'fulfilled' ? ords.value : [];
            const factsData = facts.status === 'fulfilled' ? facts.value : [];
            const sorted = [...ordData].sort((a, b) => new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime());

            const apiResumen = r.status === 'fulfilled' ? r.value : null;
            const resumen = buildResumenFallback(ordData, factsData, apiResumen);

            setDashboard({
                loading: false,
                resumen,
                ventasHora: vh.status === 'fulfilled' ? vh.value : [],
                ordenes: sorted.slice(0, 6),
                pendientes: ordData.filter(o => o.estadoOrden === 'pendiente').length,
                completadas: ordData.filter(o => isCompletedEstado(o.estadoOrden)).length,
                sinPagar: factsData.filter(f => f.estado === 'pendiente').length,
            });
        } catch (err) {
            console.error('Dashboard fetch error', err);
            setDashboard((prev) => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchData();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchData]);
    useEffect(() => {
        const id = setInterval(fetchData, 60000);
        return () => clearInterval(id);
    }, [fetchData]);

    const ventasHoraFull = normalizeHourlySeries(ventasHora);
    const maxHora = Math.max(...ventasHoraFull.map(v => v.cantidad), 1);
    const userName = user && (user as any).name ? String((user as any).name) : 'Cajero';

    const [ready, setReady] = useState(Platform.OS !== 'web');

    useEffect(() => {
        if (Platform.OS === 'web') {
            const timer = setTimeout(() => setReady(true), 50);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!ready) return null;

    return (
        <PageContainer>
            {/* Welcome Compact */}
            <View className={`flex-row items-center border border-white/5 bg-white/5 overflow-hidden ${isMobile ? 'px-4 py-3 rounded-2xl mb-4' : 'px-6 py-4 rounded-3xl mb-6'}`}>
                <View className="flex-1">
                    <Text className="text-white font-black text-xs uppercase tracking-widest opacity-50 mb-0.5" style={{ fontFamily: 'Space Grotesk' }}>{getGreeting()}</Text>
                    <Text className="text-white font-black text-lg uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{userName} 👋</Text>
                </View>
                <View className="items-end">
                    <Text className="text-(--color-pos-primary) font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{clock}</Text>
                    <Text className="text-slate-500 font-bold text-[9px] uppercase tracking-widest">
                       {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </Text>
                </View>
            </View>

            {/* Quick Actions - High Density */}
            <View className="flex-row flex-wrap gap-2 mb-6">
                <TouchableOpacity 
                    className="flex-row items-center gap-2 px-6 py-3 rounded-2xl bg-(--color-pos-primary) shadow-lg shadow-(--color-pos-primary)/20" 
                    onPress={() => router.push('/crear-orden')}
                >
                    <UIIcon name="plus" size={18} color="#000" />
                    <Text className="text-black font-black text-[10px] uppercase tracking-widest">Nueva Orden</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    className="flex-row items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10" 
                    onPress={() => router.push('/ordenes')}
                >
                    <UIIcon name="clipboard-list-outline" size={16} color="#64748B" />
                    <Text className="text-slate-300 font-black text-[10px] uppercase tracking-widest">Pendientes</Text>
                    {pendientes > 0 && (
                        <View className="bg-red-500 px-1.5 rounded-md min-w-[1.2rem] items-center">
                            <Text className="text-white text-[9px] font-black">{pendientes}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    className="flex-row items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10" 
                    onPress={() => router.push('/balance-fechas')}
                >
                    <UIIcon name="scale-balance" size={16} color="#64748B" />
                    <Text className="text-slate-300 font-black text-[10px] uppercase tracking-widest">Balance</Text>
                </TouchableOpacity>
            </View>

            {/* Operative Stats Grid */}
            <View className="flex-row flex-wrap gap-3 mb-6">
                <Card className="flex-1 min-w-[140px] p-4 flex-row items-center gap-4 bg-white/5 border-white/10">
                    <View className={`w-2 h-10 rounded-full ${pendientes > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-white font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{pendientes}</Text>
                        <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Pendientes</Text>
                    </View>
                </Card>
                
                <Card className="flex-1 min-w-[140px] p-4 flex-row items-center gap-4 bg-white/5 border-white/10">
                    <View className={`w-2 h-10 rounded-full ${sinPagar > 0 ? 'bg-(--color-pos-primary)' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-white font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{sinPagar}</Text>
                        <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Por Pagar</Text>
                    </View>
                </Card>

                <Card className="flex-1 min-w-[140px] p-4 flex-row items-center gap-4 bg-white/5 border-white/10">
                    <View className="w-2 h-10 rounded-full bg-emerald-500" />
                    <View>
                        <Text className="text-white font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{completadas}</Text>
                        <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest">Entregadas</Text>
                    </View>
                </Card>
            </View>

            {loading && !resumen && <ActivityIndicator size="large" color="#F5A524" className="py-20" />}

            {/* Main KPIs Row */}
            {resumen && (
                <View className="flex-row flex-wrap gap-3 mb-8">
                    <Card className="flex-1 min-w-[160px] p-5 items-center bg-emerald-500/10 border-emerald-500/20">
                        <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-1.5">Ventas Hoy</Text>
                        <Text className="text-emerald-400 font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.totalVentas)}</Text>
                    </Card>
                    
                    <Card className="flex-1 min-w-[160px] p-5 items-center bg-violet-500/10 border-violet-500/20">
                        <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-1.5">Ticket Promedio</Text>
                        <Text className="text-violet-400 font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.ticketPromedio)}</Text>
                    </Card>

                    <Card className="flex-1 min-w-[160px] p-5 items-center bg-(--color-pos-primary)/10 border-(--color-pos-primary)/20">
                        <Text className="text-slate-500 font-black text-[9px] uppercase tracking-widest mb-1.5">Órdenes Totales</Text>
                        <Text className="text-(--color-pos-primary) font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>{resumen.ordenes}</Text>
                    </Card>
                </View>
            )}

            {/* Hour Chart + Recent */}
            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                {/* Hour chart */}
                <Card style={{ flex: 1, minHeight: 280 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>📊 Actividad por Hora</Text>
                    {ventasHora.length > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flex: 1, minHeight: 180, gap: 2 }}>
                            {ventasHoraFull.map(v => {
                                const pct = (v.cantidad / maxHora) * 100;
                                return (
                                    <View key={v.hora} style={{ flex: 1, alignItems: 'center', height: '100%' }}>
                                        <View style={{ flex: 1, width: '100%', maxWidth: 20, backgroundColor: 'rgba(0,0,0,0.3)', borderTopLeftRadius: 6, borderTopRightRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' }}>
                                            <View 
                                                style={{ width: '100%', backgroundColor: '#F5A524', borderTopLeftRadius: 6, borderTopRightRadius: 6, height: v.cantidad > 0 ? `${Math.max(pct, 3)}%` : '0%' }} 
                                            />
                                        </View>
                                        <Text style={{ fontFamily: 'Outfit', fontSize: 8, color: '#475569', marginTop: 4 }}>{v.hora}h</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : <Text style={{ fontFamily: 'Outfit', textAlign: 'center', color: '#475569', paddingVertical: 40, fontStyle: 'italic' }}>Sin actividad registrada hoy</Text>}
                </Card>

                {/* Recent orders */}
                <Card style={{ flex: 1, minHeight: 280 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>📋 Órdenes Recientes</Text>
                    {ordenes.map(o => (
                        <TouchableOpacity
                            key={o.ordenId}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}
                            onPress={() => router.push(`/orden-detalle?id=${o.ordenId}` as any)}
                        >
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 12, minWidth: 36 }}>#{o.ordenId}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13 }} numberOfLines={1}>{getOrdenDisplayName(o)}</Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10, marginTop: 1 }}>{timeAgo(o.fechaOrden)}</Text>
                            </View>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: o.estadoOrden === 'pendiente' ? 'rgba(245,165,36,0.1)' : 'rgba(16,185,129,0.1)' }}>
                                <Text style={{ fontFamily: 'Outfit', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: o.estadoOrden === 'pendiente' ? '#F5A524' : '#10B981' }}>{o.estadoOrden}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {ordenes.length === 0 && <Text style={{ fontFamily: 'Outfit', textAlign: 'center', color: '#475569', paddingVertical: 40, fontStyle: 'italic' }}>Sin órdenes recientes</Text>}
                </Card>
            </View>

            {isMobile && <View className="h-20" />}
        </PageContainer>
    );
}
