import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import type { VentaHora, ResumenPeriodo, Orden } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import Icon from '../../components/ui/Icon';
import { useAuth } from '../../contexts/AuthContext';

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

function DashboardPage() {
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
            const [r, vh, ords] = await Promise.allSettled([
                api.estadisticas.resumenPeriodo(hoy, hoy),
                api.estadisticas.ventasPorHora(hoy),
                api.ordenes.getDay(),
            ]);

            const ordData = ords.status === 'fulfilled' ? ords.value : [];
            const factsData: any[] = [];
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
                sinPagar: 0,
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

    return (
        <ScrollView className="flex-1 bg-(--color-pos-bg)" contentContainerClassName="p-4 md:p-6 lg:p-8">
            {/* Welcome */}
            <View className={`flex-row items-center p-5 rounded-2xl bg-(--color-pos-surface) border border-white/5 shadow-sm mb-6 ${isMobile ? 'flex-col items-start gap-4' : ''}`}>
                <View className="flex-1">
                    <Text className="text-xl md:text-2xl font-black text-white tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{getGreeting()}, {userName} 👋</Text>
                    <Text className="text-sm text-(--color-pos-text-muted) mt-1 capitalize">
                        {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                </View>
                <Text className={`text-2xl font-black text-(--color-pos-primary) ${isMobile ? 'text-xl leading-6 self-start' : ''}`} style={{ fontFamily: 'Space Grotesk' }}>{clock}</Text>
            </View>

            {/* Quick Actions */}
            <View className="flex-row flex-wrap gap-3 mb-6">
                <TouchableOpacity className="flex-row items-center gap-2 px-5 py-3 rounded-xl bg-(--color-pos-primary) shadow-amber-500/20 active:scale-[0.95] transition-transform" onPress={() => router.push('/crear-orden')}>
                    <Icon name="plus-circle-outline" size={18} color="#ffffff" />
                    <Text className="text-sm font-bold text-white">Crear Orden</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-2 px-5 py-3 rounded-xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.95] transition-transform hover:bg-(--color-pos-surface-hover)" onPress={() => router.push('/ordenes')}>
                    <Icon name="clipboard-list-outline" size={18} color="#F5A524" />
                    <Text className="text-sm font-bold text-(--color-pos-text)">Pendientes</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-2 px-5 py-3 rounded-xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.95] transition-transform hover:bg-(--color-pos-surface-hover)" onPress={() => router.push('/balance-fechas')}>
                    <Icon name="scale-balance" size={18} color="#8B5CF6" />
                    <Text className="text-sm font-bold text-(--color-pos-text)">Balance</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-2 px-5 py-3 rounded-xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.95] transition-transform hover:bg-(--color-pos-surface-hover)" onPress={() => router.push('/gestion-sabores' as any)}>
                    <Icon name="pizza" size={18} color="#a855f7" />
                    <Text className="text-sm font-bold text-(--color-pos-text)">Sabores</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-2 px-5 py-3 rounded-xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.95] transition-transform hover:bg-(--color-pos-surface-hover)" onPress={() => router.push('/ajustes-negocio' as any)}>
                    <Icon name="storefront-edit-outline" size={18} color="#06b6d4" />
                    <Text className="text-sm font-bold text-(--color-pos-text)">Negocio</Text>
                </TouchableOpacity>
            </View>

            {/* Status cards */}
            <View className={`flex-row gap-4 mb-6 ${isMobile ? 'flex-wrap' : ''}`}>
                <TouchableOpacity className={`flex-1 flex-row items-center gap-4 p-5 rounded-2xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.98] transition-all hover:bg-(--color-pos-surface-hover) min-w-[140px] ${isMobile ? 'min-w-[48%] flex-auto' : ''}`} onPress={() => router.push('/ordenes')}>
                    <View className={`w-3 h-3 rounded-full ${pendientes > 0 ? 'bg-rose-500 shadow-rose-500/50 shadow-sm' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-2xl font-black text-white" style={{ fontFamily: 'Space Grotesk' }}>{pendientes}</Text>
                        <Text className="text-xs text-(--color-pos-text-muted) font-medium">Pendientes</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity className={`flex-1 flex-row items-center gap-4 p-5 rounded-2xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.98] transition-all hover:bg-(--color-pos-surface-hover) min-w-[140px] ${isMobile ? 'min-w-[48%] flex-auto' : ''}`} onPress={() => router.push('/facturas-dia' as any)}>
                    <View className={`w-3 h-3 rounded-full ${sinPagar > 0 ? 'bg-amber-500 shadow-amber-500/50 shadow-sm' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-2xl font-black text-white" style={{ fontFamily: 'Space Grotesk' }}>{sinPagar}</Text>
                        <Text className="text-xs text-(--color-pos-text-muted) font-medium">Sin Pagar</Text>
                    </View>
                </TouchableOpacity>
                <View className={`flex-1 flex-row items-center gap-4 p-5 rounded-2xl bg-(--color-pos-surface) border border-white/5 min-w-[140px] ${isMobile ? 'min-w-[48%] flex-auto' : ''}`}>
                    <View className="w-3 h-3 rounded-full bg-emerald-500" />
                    <View>
                        <Text className="text-2xl font-black text-white" style={{ fontFamily: 'Space Grotesk' }}>{completadas}</Text>
                        <Text className="text-xs text-(--color-pos-text-muted) font-medium">Completadas</Text>
                    </View>
                </View>
            </View>

            {loading && !resumen && (
                <ActivityIndicator size="large" color="#F5A524" className="py-8" />
            )}

            {/* KPIs */}
            {resumen && (
                <View className={`flex-row gap-4 mb-6 ${isMobile ? 'flex-wrap' : ''}`}>
                    <View className={`flex-1 p-5 rounded-2xl bg-(--color-pos-surface) border border-white/5 items-center min-w-[140px] ${isMobile ? 'min-w-[48%] flex-auto' : ''}`}>
                        <Text className="text-xs font-bold text-(--color-pos-text-muted) uppercase tracking-wider mb-2">Ventas Hoy</Text>
                        <Text className="text-[22px] font-black text-emerald-400" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.totalVentas)}</Text>
                    </View>
                    <View className={`flex-1 p-5 rounded-2xl bg-(--color-pos-surface) border border-white/5 items-center min-w-[140px] ${isMobile ? 'min-w-[48%] flex-auto' : ''}`}>
                        <Text className="text-xs font-bold text-(--color-pos-text-muted) uppercase tracking-wider mb-2">Ticket Prom</Text>
                        <Text className="text-[22px] font-black text-(--color-pos-secondary)" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.ticketPromedio)}</Text>
                    </View>
                    <View className={`flex-1 p-5 rounded-2xl bg-(--color-pos-surface) border border-white/5 items-center min-w-[140px] ${isMobile ? 'min-w-[48%] flex-auto' : ''}`}>
                        <Text className="text-xs font-bold text-(--color-pos-text-muted) uppercase tracking-wider mb-2">Órdenes</Text>
                        <Text className="text-[22px] font-black text-(--color-pos-primary)" style={{ fontFamily: 'Space Grotesk' }}>{resumen.ordenes}</Text>
                    </View>
                </View>
            )}

            {/* Hour Chart + Recent */}
            <View className={`flex-row gap-6 flex-wrap ${isMobile ? 'flex-col' : ''}`}>
                {/* Hour chart */}
                <View className="flex-1 bg-(--color-pos-surface) rounded-2xl border border-white/5 p-5 min-w-[280px] min-h-[260px] flex-col">
                    <Text className="text-base font-bold text-white mb-4 pb-3 border-b border-white/5">📊 Actividad por Hora</Text>
                    {ventasHora.length > 0 ? (
                        <View className="flex-row items-end flex-1 min-h-[170px] gap-0.5 mt-auto">
                            {ventasHoraFull.map(v => {
                                const pct = (v.cantidad / maxHora) * 100;
                                return (
                                    <View key={v.hora} className="flex-1 items-center h-full flex-col">
                                        <View className="flex-1 w-full max-w-[20px] bg-black/20 rounded-t-sm justify-end overflow-hidden">
                                            <View className={`w-full rounded-t-sm bg-(--color-pos-secondary) ${v.cantidad > 0 ? '' : 'min-h-0'}`} style={{ height: v.cantidad > 0 ? `${Math.max(pct, 2)}%` : '0%' }} />
                                        </View>
                                        <Text className="text-[9px] text-(--color-pos-text-muted) mt-1">{v.hora}h</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : <Text className="text-center text-(--color-pos-text-muted) py-8">Sin actividad</Text>}
                </View>

                {/* Recent orders */}
                <View className="flex-1 bg-(--color-pos-surface) rounded-2xl border border-white/5 p-5 min-w-[280px]">
                    <Text className="text-base font-bold text-white mb-4 pb-3 border-b border-white/5">📋 Recientes</Text>
                    {ordenes.map(o => (
                        <TouchableOpacity
                            key={o.ordenId}
                            className="flex-row items-center gap-4 py-3 border-b border-white/5 active:opacity-70 transition-opacity"
                            onPress={() => router.push(`/orden-detalle?id=${o.ordenId}` as any)}
                        >
                            <Text className="text-xs font-black text-(--color-pos-primary) min-w-[40px]" style={{ fontFamily: 'Space Grotesk' }}>#{o.ordenId}</Text>
                            <View className="flex-1">
                                <Text className="text-sm font-bold text-white" numberOfLines={1}>{getOrdenDisplayName(o)}</Text>
                                <Text className="text-xs text-(--color-pos-text-muted)">{timeAgo(o.fechaOrden)}</Text>
                            </View>
                            <Text className={`text-[10px] px-2.5 py-1 rounded-full font-bold overflow-hidden capitalize
                                ${o.estadoOrden === 'pendiente' ? 'bg-amber-500/15 text-amber-500' :
                                    isCompletedEstado(o.estadoOrden) ? 'bg-emerald-500/15 text-emerald-500' :
                                        'bg-white/10 text-(--color-pos-text-muted)'}`}
                            >
                                {o.estadoOrden}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    {ordenes.length === 0 && <Text className="text-center text-(--color-pos-text-muted) py-8">Sin órdenes</Text>}
                </View>
            </View>

            {isMobile && <View className="h-20" />}
        </ScrollView>
    );
}

export default function SafeDashboardWrapper() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        // Retrasamos el render 1 tick para que react-native-css 
        // compile e inyecte los estilos globales antes de pintar la ruta inicial
        const timer = setTimeout(() => setReady(true), 10);
        return () => clearTimeout(timer);
    }, []);

    if (!ready) {
        return (
            <View className="flex-1 bg-[#0C0F1A] items-center justify-center">
                <ActivityIndicator size="large" color="#F5A524" />
            </View>
        );
    }

    return <DashboardPage />;
}
