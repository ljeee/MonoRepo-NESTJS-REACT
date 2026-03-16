import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../services/api';
import type { VentaHora, ResumenPeriodo, Orden } from '@monorepo/shared';
import { formatCurrency as sharedFormatCurrency } from '@monorepo/shared';
import { useBreakpoint } from '../styles/responsive';
import Icon from '../components/ui/Icon';
import { useAuth } from '../contexts/AuthContext';

function formatCurrency(n: number) {
    return '$' + sharedFormatCurrency(n);
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

    return (
        <ScrollView className="flex-1 bg-(--color-pos-bg)" contentContainerClassName="p-6">
            {/* Welcome */}
            <View className={`flex-row items-center p-8 rounded-3xl bg-amber-500/5 border border-amber-500/20 mb-6 ${isMobile ? 'flex-col items-start gap-4' : ''}`}>
                <View className="flex-1">
                    <Text className="text-white font-black text-2xl uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{getGreeting()}, {userName} 👋</Text>
                    <Text className="text-slate-400 text-sm mt-1 capitalize">
                        {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                </View>
                <Text className={`text-amber-500 font-black text-2xl tracking-tighter ${isMobile ? 'self-start' : ''}`} style={{ fontFamily: 'Space Grotesk' }}>{clock}</Text>
            </View>

            {/* Quick Actions */}
            <View className="flex-row flex-wrap gap-2 mb-6">
                <TouchableOpacity className="flex-row items-center gap-3 px-6 py-4 rounded-2xl bg-(--color-pos-surface) border border-white/5 active:bg-white/10" onPress={() => router.push('/crear-orden')}>
                    <Icon name="plus-circle-outline" size={18} color="#F5A524" />
                    <Text className="text-white font-black text-sm uppercase tracking-widest">Crear Orden</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-3 px-6 py-4 rounded-2xl bg-(--color-pos-surface) border border-white/5 active:bg-white/10" onPress={() => router.push('/ordenes')}>
                    <Icon name="clipboard-list-outline" size={18} color="#F5A524" />
                    <Text className="text-white font-black text-sm uppercase tracking-widest">Pendientes</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-3 px-6 py-4 rounded-2xl bg-(--color-pos-surface) border border-white/5 active:bg-white/10" onPress={() => router.push('/balance-dia')}>
                    <Icon name="scale-balance" size={18} color="#F5A524" />
                    <Text className="text-white font-black text-sm uppercase tracking-widest">Balance</Text>
                </TouchableOpacity>
            </View>

            {/* Status cards */}
            <View className={`flex-row gap-4 mb-6 ${isMobile ? 'flex-wrap' : ''}`}>
                <TouchableOpacity className={`flex-1 flex-row items-center gap-4 p-6 rounded-3xl bg-(--color-pos-surface) border border-white/5 ${isMobile ? 'min-w-[48%]' : ''}`} onPress={() => router.push('/ordenes')}>
                    <View className={`w-3 h-3 rounded-full ${pendientes > 0 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{pendientes}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Pendientes</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity className={`flex-1 flex-row items-center gap-4 p-6 rounded-3xl bg-(--color-pos-surface) border border-white/5 ${isMobile ? 'min-w-[48%]' : ''}`} onPress={() => router.push('/facturas-dia' as any)}>
                    <View className={`w-3 h-3 rounded-full ${sinPagar > 0 ? 'bg-amber-500 shadow-lg shadow-amber-500/50' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{sinPagar}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Sin Pagar</Text>
                    </View>
                </TouchableOpacity>
                <View className={`flex-1 flex-row items-center gap-4 p-6 rounded-3xl bg-(--color-pos-surface) border border-white/5 ${isMobile ? 'min-w-[48%]' : ''}`}>
                    <View className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                    <View>
                        <Text className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{completadas}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Completadas</Text>
                    </View>
                </View>
            </View>

            {loading && !resumen && (
                <View className="py-20 items-center">
                    <ActivityIndicator size="large" color="#F5A524" />
                </View>
            )}

            {/* KPIs */}
            {resumen && (
                <View className={`flex-row gap-4 mb-6 ${isMobile ? 'flex-wrap' : ''}`}>
                    <View className={`flex-1 p-6 rounded-3xl bg-(--color-pos-surface) border border-white/5 items-center ${isMobile ? 'min-w-[48%]' : ''}`}>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ventas Hoy</Text>
                        <Text className="text-emerald-400 font-black text-xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.totalVentas)}</Text>
                    </View>
                    <View className={`flex-1 p-6 rounded-3xl bg-(--color-pos-surface) border border-white/5 items-center ${isMobile ? 'min-w-[48%]' : ''}`}>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ticket Promedio</Text>
                        <Text className="text-violet-400 font-black text-xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.ticketPromedio)}</Text>
                    </View>
                    <View className={`flex-1 p-6 rounded-3xl bg-(--color-pos-surface) border border-white/5 items-center ${isMobile ? 'min-w-[48%]' : ''}`}>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Órdenes</Text>
                        <Text className="text-amber-500 font-black text-xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{resumen.ordenes}</Text>
                    </View>
                </View>
            )}

            {/* Hour Chart + Recent */}
            <View className={`flex-row gap-6 ${isMobile ? 'flex-col' : ''}`}>
                {/* Hour chart */}
                <View className="flex-1 bg-(--color-pos-surface) rounded-3xl border border-white/5 p-6 min-h-[260px]">
                    <Text className="text-white font-black text-base uppercase tracking-tight mb-6 pb-2 border-b border-white/5" style={{ fontFamily: 'Space Grotesk' }}>📊 Actividad por Hora</Text>
                    {ventasHora.length > 0 ? (
                        <View className="flex-row items-end flex-1 min-h-[170px] gap-0.5 mt-auto">
                            {ventasHoraFull.map(v => {
                                const pct = (v.cantidad / maxHora) * 100;
                                return (
                                    <View key={v.hora} className="flex-1 items-center h-full">
                                        <View className="flex-1 w-full max-w-[20px] bg-black/20 rounded-t-lg justify-end overflow-hidden">
                                            <View 
                                                className="w-full bg-amber-500 rounded-t-lg" 
                                                style={{ height: v.cantidad > 0 ? `${Math.max(pct, 2)}%` : '0%' }} 
                                            />
                                        </View>
                                        <Text className="text-[8px] text-slate-500 mt-1 font-bold">{v.hora}h</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : <Text className="text-center text-slate-500 py-10 italic">Sin actividad registrada hoy</Text>}
                </View>

                {/* Recent orders */}
                <View className="flex-1 bg-(--color-pos-surface) rounded-3xl border border-white/5 p-6 min-h-[260px]">
                    <Text className="text-white font-black text-base uppercase tracking-tight mb-6 pb-2 border-b border-white/5" style={{ fontFamily: 'Space Grotesk' }}>📋 Recientes</Text>
                    {ordenes.map(o => (
                        <TouchableOpacity
                            key={o.ordenId}
                            className="flex-row items-center gap-4 py-3 border-b border-white/5 active:bg-white/5"
                            onPress={() => router.push(`/orden-detalle?id=${o.ordenId}` as any)}
                        >
                            <Text className="text-amber-500 font-black text-xs min-w-[30px]" style={{ fontFamily: 'Space Grotesk' }}>#{o.ordenId}</Text>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-sm" numberOfLines={1}>{getOrdenDisplayName(o)}</Text>
                                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">{timeAgo(o.fechaOrden)}</Text>
                            </View>
                            <View className={`px-2 py-0.5 rounded-full ${o.estadoOrden === 'pendiente' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                                <Text className={`text-[10px] font-black uppercase tracking-widest ${o.estadoOrden === 'pendiente' ? 'text-amber-500' : 'text-emerald-500'}`}>{o.estadoOrden}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {ordenes.length === 0 && <Text className="text-center text-slate-500 py-10 italic">Sin órdenes recientes</Text>}
                </View>
            </View>

            {isMobile && <View className="h-20" />}
        </ScrollView>
    );
}
