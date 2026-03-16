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

    return (
        <PageContainer>
            {/* Welcome */}
            <View className={`flex-row items-center p-8 rounded-[40px] bg-amber-500/5 border border-amber-500/10 mb-8 ${isMobile ? 'flex-col items-start gap-4' : ''}`}>
                <View className="flex-1">
                    <Text className="text-white font-black text-3xl uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{getGreeting()}, {userName} 👋</Text>
                    <Text className="text-slate-400 text-sm mt-1 capitalize font-bold">
                        {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                </View>
                <Text className={`text-amber-500 font-black text-4xl tracking-tighter ${isMobile ? 'self-start' : ''}`} style={{ fontFamily: 'Space Grotesk' }}>{clock}</Text>
            </View>

            {/* Quick Actions */}
            <View className="flex-row flex-wrap gap-4 mb-10">
                <TouchableOpacity className="flex-row items-center gap-3 px-8 py-5 rounded-3xl bg-amber-500 shadow-xl shadow-amber-500/20 active:scale-[0.95] transition-all" onPress={() => router.push('/crear-orden')}>
                    <UIIcon name="plus-circle-outline" size={20} color="#000" />
                    <Text className="text-black font-black text-sm uppercase tracking-widest">Crear Orden</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-3 px-8 py-5 rounded-3xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.95] transition-all" onPress={() => router.push('/ordenes')}>
                    <UIIcon name="clipboard-list-outline" size={20} color="#F5A524" />
                    <Text className="text-white font-black text-sm uppercase tracking-widest">Pendientes</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-row items-center gap-3 px-8 py-5 rounded-3xl bg-(--color-pos-surface) border border-white/5 active:scale-[0.95] transition-all" onPress={() => router.push('/balance-fechas')}>
                    <UIIcon name="scale-balance" size={20} color="#8B5CF6" />
                    <Text className="text-white font-black text-sm uppercase tracking-widest">Balance</Text>
                </TouchableOpacity>
            </View>

            {/* Status cards */}
            <View className={`flex-row gap-4 mb-10 ${isMobile ? 'flex-wrap' : ''}`}>
                <Card className={`flex-1 flex-row items-center gap-5 p-6 border-white/5 bg-(--color-pos-surface) ${isMobile ? 'min-w-[48%]' : ''}`}>
                    <View className={`w-3 h-3 rounded-full ${pendientes > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-white font-black text-3xl tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{pendientes}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Pendientes</Text>
                    </View>
                </Card>
                <Card className={`flex-1 flex-row items-center gap-5 p-6 border-white/5 bg-(--color-pos-surface) ${isMobile ? 'min-w-[48%]' : ''}`}>
                    <View className={`w-3 h-3 rounded-full ${sinPagar > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <View>
                        <Text className="text-white font-black text-3xl tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{sinPagar}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Sin Pagar</Text>
                    </View>
                </Card>
                <Card className={`flex-1 flex-row items-center gap-5 p-6 border-white/5 bg-(--color-pos-surface) ${isMobile ? 'min-w-[48%]' : ''}`}>
                    <View className="w-3 h-3 rounded-full bg-emerald-500" />
                    <View>
                        <Text className="text-white font-black text-3xl tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{completadas}</Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Completadas</Text>
                    </View>
                </Card>
            </View>

            {loading && !resumen && <ActivityIndicator size="large" color="#F5A524" className="py-20" />}

            {/* KPIs */}
            {resumen && (
                <View className={`flex-row gap-4 mb-10 ${isMobile ? 'flex-wrap' : ''}`}>
                    <Card className="flex-1 p-6 items-center border-white/5 bg-(--color-pos-surface)">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Ventas Hoy</Text>
                        <Text className="text-emerald-400 font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.totalVentas)}</Text>
                    </Card>
                    <Card className="flex-1 p-6 items-center border-white/5 bg-(--color-pos-surface)">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Ticket Promedio</Text>
                        <Text className="text-violet-400 font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(resumen.ticketPromedio)}</Text>
                    </Card>
                    <Card className="flex-1 p-6 items-center border-white/5 bg-(--color-pos-surface)">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Órdenes</Text>
                        <Text className="text-amber-500 font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>{resumen.ordenes}</Text>
                    </Card>
                </View>
            )}

            {/* Hour Chart + Recent */}
            <View className={`flex-row gap-8 ${isMobile ? 'flex-col' : ''}`}>
                {/* Hour chart */}
                <Card className="flex-1 p-8 border-white/5 bg-(--color-pos-surface) min-h-[340px]">
                    <Text className="text-white font-black text-lg uppercase tracking-tight mb-8 pb-3 border-b border-white/10" style={{ fontFamily: 'Space Grotesk' }}>📊 Actividad por Hora</Text>
                    {ventasHora.length > 0 ? (
                        <View className="flex-row items-end flex-1 min-h-[200px] gap-1 mt-auto">
                            {ventasHoraFull.map(v => {
                                const pct = (v.cantidad / maxHora) * 100;
                                return (
                                    <View key={v.hora} className="flex-1 items-center h-full">
                                        <View className="flex-1 w-full max-w-[24px] bg-black/30 rounded-t-xl justify-end overflow-hidden">
                                            <View 
                                                className="w-full bg-amber-500 rounded-t-xl" 
                                                style={{ height: v.cantidad > 0 ? `${Math.max(pct, 2)}%` : '0%' }} 
                                            />
                                        </View>
                                        <Text className="text-[9px] text-slate-500 mt-2 font-black uppercase">{v.hora}h</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : <Text className="text-center text-slate-500 py-12 italic font-bold">Sin actividad registrada hoy</Text>}
                </Card>

                {/* Recent orders */}
                <Card className="flex-1 p-8 border-white/5 bg-(--color-pos-surface) min-h-[340px]">
                    <Text className="text-white font-black text-lg uppercase tracking-tight mb-8 pb-3 border-b border-white/10" style={{ fontFamily: 'Space Grotesk' }}>📋 Órdenes Recientes</Text>
                    {ordenes.map(o => (
                        <TouchableOpacity
                            key={o.ordenId}
                            className="flex-row items-center gap-5 py-4 border-b border-white/5 active:bg-white/5 transition-colors"
                            onPress={() => router.push(`/orden-detalle?id=${o.ordenId}` as any)}
                        >
                            <Text className="text-amber-500 font-black text-sm min-w-[40px]" style={{ fontFamily: 'Space Grotesk' }}>#{o.ordenId}</Text>
                            <View className="flex-1">
                                <Text className="text-white font-black text-base truncate" style={{ fontFamily: 'Space Grotesk' }}>{getOrdenDisplayName(o)}</Text>
                                <Text className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-0.5">{timeAgo(o.fechaOrden)}</Text>
                            </View>
                            <View className={`px-3 py-1 rounded-full ${o.estadoOrden === 'pendiente' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                                <Text className={`text-[10px] font-black uppercase tracking-widest ${o.estadoOrden === 'pendiente' ? 'text-amber-500' : 'text-emerald-500'}`}>{o.estadoOrden}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {ordenes.length === 0 && <Text className="text-center text-slate-500 py-12 italic font-bold">Sin órdenes recientes</Text>}
                </Card>
            </View>

            {isMobile && <View className="h-20" />}
        </PageContainer>
    );
}
