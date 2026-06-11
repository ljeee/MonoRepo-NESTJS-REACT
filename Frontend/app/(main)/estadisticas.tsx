import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { api } from '../../services/api';
import type {
    ProductoTop,
    SaborTop,
    VentaDia,
    VentaHora,
    MetodoPago,
    ResumenPeriodo,
    ClienteFrecuente,
} from '@/src/shared';
import { formatCompactCurrency as sharedFormatCompact, getLocalDateString } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, ScrollView } from '../../tw';
import { PageContainer, PageHeader, Card, Icon, DateRangeFilter } from '../../components/ui';

function formatCurrency(n: number) {
    return sharedFormatCompact(n);
}

function getDefaultDateRange() {
    const today = getLocalDateString();
    return { from: today, to: today };
}

function formatDayLabel(fecha: string): string {
    if (!fecha) return '--';
    const parsed = new Date(fecha);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    }
    const normalized = fecha.length > 10 ? fecha.slice(0, 10) : fecha;
    const retry = new Date(`${normalized}T12:00:00`);
    if (!Number.isNaN(retry.getTime())) {
        return retry.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    }
    return normalized;
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

// ── KPI Card ──
function KpiCard({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    return (
        <Card className="flex-1 min-w-[160px] bg-slate-900 border-white/5 overflow-hidden">
            <View className="flex-row items-center p-4">
                <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${color}20` }}>
                    <Icon name={icon} size={20} color={color} />
                </View>
                <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</Text>
                    <Text className="text-white text-lg font-black tracking-tight" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>{value}</Text>
                </View>
            </View>
            <View className="h-1 w-full opacity-30" style={{ backgroundColor: color }} />
        </Card>
    );
}

// ── Horizontal Bar ──
function HBar({ label, value, max, rank, color }: { label: string; value: number; max: number; rank: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <View className="mb-4">
            <View className="flex-row justify-between items-center mb-1.5">
                <View className="flex-row items-center gap-2 flex-1">
                    <Text className="font-black text-xs" style={{ color }}>#{rank}</Text>
                    <Text className="text-slate-300 text-xs font-bold uppercase truncate flex-1">{label}</Text>
                </View>
                <Text className="text-white font-black text-xs">{value}</Text>
            </View>
            <View className="h-2 bg-white/5 rounded-full overflow-hidden">
                <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </View>
        </View>
    );
}

export default function EstadisticasPage() {
    const defaults = getDefaultDateRange();
    const [from, setFrom] = useState(defaults.from);
    const [to, setTo] = useState(defaults.to);
    const [loading, setLoading] = useState(true);
    const { isMobile } = useBreakpoint();

    const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
    const [productosTop, setProductosTop] = useState<ProductoTop[]>([]);
    const [saboresTop, setSaboresTop] = useState<SaborTop[]>([]);
    const [ventasDia, setVentasDia] = useState<VentaDia[]>([]);
    const [ventasHora, setVentasHora] = useState<VentaHora[]>([]);
    const [metodos, setMetodos] = useState<MetodoPago[]>([]);
    const [clientesFrec, setClientesFrec] = useState<ClienteFrecuente[]>([]);

    const fetchAll = useCallback(async (f = from, t = to) => {
        setLoading(true);
        try {
            const [r, pt, st, vd, vh, mp, cf] = await Promise.all([
                api.estadisticas.resumenPeriodo(f, t),
                api.estadisticas.productosTop(f, t),
                api.estadisticas.saboresTop(f, t),
                api.estadisticas.ventasPorDia(f, t),
                api.estadisticas.ventasPorHora(undefined, f, t),
                api.estadisticas.metodosPago(f, t),
                api.estadisticas.clientesFrecuentes(8),
            ]);
            setResumen(r);
            setProductosTop(pt);
            setSaboresTop(st);
            setVentasDia(vd);
            setVentasHora(vh);
            setMetodos(mp);
            setClientesFrec(cf);
        } catch (err) {
            console.error('Error loading statistics:', err);
            setLoading(false);
            return;
        }
        setLoading(false);
    }, [from, to]);

    useEffect(() => {
        fetchAll();
    }, []);

    const maxProducto = productosTop[0]?.totalVendido || 1;
    const maxSabor = saboresTop[0]?.cantidad || 1;
    const ventasHoraFull = normalizeHourlySeries(ventasHora);
    const maxVentaHora = Math.max(...ventasHoraFull.map(v => v.cantidad), 1);
    const maxVentaDia = Math.max(...ventasDia.map(v => v.total), 1);

    return (
        <PageContainer 
            refreshControl={
                <RefreshControl refreshing={loading && !!resumen} onRefresh={fetchAll} tintColor="#F5A524" colors={["#F5A524"]} />
            }
        >
            <PageHeader title="Analítica" subtitle="Rendimiento del negocio" icon="chart-areaspline" />

            <DateRangeFilter
                from={from}
                to={to}
                onFromChange={setFrom}
                onToChange={setTo}
                onSearch={(f, t) => { setFrom(f); setTo(t); void fetchAll(f, t); }}
                loading={loading}
            />

            {loading && !resumen && (
                <View className="py-20 items-center">
                    <ActivityIndicator size="large" color="#F5A524" />
                    <Text className="text-slate-400 font-bold mt-4 uppercase tracking-widest text-xs">Calculando métricas...</Text>
                </View>
            )}

            {/* ── KPI Grid ── */}
            {resumen && (
                <View className="flex-row flex-wrap gap-4 mb-8">
                    <KpiCard icon="cash" label="Ventas Totales" value={formatCurrency(resumen.totalVentas)} color="#10B981" />
                    <KpiCard icon="trending-up" label="Balance Neto" value={formatCurrency(resumen.balanceNeto)} color="#3B82F6" />
                    <KpiCard icon="cart-outline" label="Ticket Medio" value={formatCurrency(resumen.ticketPromedio)} color="#3B82F6" />
                    <KpiCard icon="clipboard-list-outline" label="Órdenes" value={String(resumen.ordenes)} color="#F5A524" />
                </View>
            )}

            {/* ── Charts Grid ── */}
            <View className={`flex-row flex-wrap gap-6 pb-12`}>
                
                {/* Ranking Productos */}
                <Card className={`p-5 bg-slate-900 border-white/5 ${isMobile ? 'w-full' : 'w-[calc(50%-12px)]'}`}>
                    <View className="flex-row items-center gap-2 mb-6">
                        <View className="w-8 h-8 rounded-lg bg-emerald-500/10 items-center justify-center">
                            <Icon name="trophy-outline" size={16} color="#10B981" />
                        </View>
                        <Text className="text-white font-black uppercase text-xs tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Top 5 Productos</Text>
                    </View>
                    {productosTop.length > 0 ? productosTop.slice(0, 5).map((p, i) => (
                        <HBar key={p.producto} label={p.producto} value={p.totalVendido} max={maxProducto} rank={i + 1} color="#10B981" />
                    )) : <Text className="text-slate-600 italic text-center py-4">Sin datos de venta</Text>}
                </Card>

                {/* Top Sabores */}
                <Card className={`p-5 bg-slate-900 border-white/5 ${isMobile ? 'w-full' : 'w-[calc(50%-12px)]'}`}>
                    <View className="flex-row items-center gap-2 mb-6">
                        <View className="w-8 h-8 rounded-lg bg-orange-500/10 items-center justify-center">
                            <Icon name="pizza" size={16} color="#FB923C" />
                        </View>
                        <Text className="text-white font-black uppercase text-xs tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Sabores Favoritos</Text>
                    </View>
                    {saboresTop.length > 0 ? saboresTop.slice(0, 5).map((sb, i) => (
                        <HBar key={sb.sabor} label={sb.sabor} value={sb.cantidad} max={maxSabor} rank={i + 1} color="#FB923C" />
                    )) : <Text className="text-slate-600 italic text-center py-4">Sin datos de pizzas</Text>}
                </Card>

                {/* Métodos de Pago */}
                <Card className={`p-5 bg-slate-900 border-white/5 ${isMobile ? 'w-full' : 'w-[calc(50%-12px)]'}`}>
                    <View className="flex-row items-center gap-2 mb-6">
                        <View className="w-8 h-8 rounded-lg bg-orange-500/10 items-center justify-center">
                            <Icon name="credit-card-outline" size={16} color="#F5A524" />
                        </View>
                        <Text className="text-white font-black uppercase text-xs tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Distribución de Pagos</Text>
                    </View>
                    <View className="gap-y-5">
                    {metodos.length > 0 ? metodos.map((m) => (
                        <View key={m.metodo}>
                            <View className="flex-row justify-between mb-1">
                                <Text className="text-white text-xs font-black uppercase">{m.metodo}</Text>
                                <Text className="text-slate-400 text-[10px] font-bold">{m.cantidad} ops</Text>
                            </View>
                            <View className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <View className="h-full bg-orange-500" style={{ width: `${m.porcentaje}%` }} />
                            </View>
                            <View className="flex-row justify-between mt-1">
                                <Text className="text-orange-500 text-xs font-black">{formatCurrency(m.total)}</Text>
                                <Text className="text-white text-[10px] font-black">{m.porcentaje}%</Text>
                            </View>
                        </View>
                    )) : <Text className="text-slate-600 italic text-center py-4">Sin registros</Text>}
                    </View>
                </Card>

                {/* Clientes Frecuentes */}
                <Card className={`p-5 bg-slate-900 border-white/5 overflow-hidden ${isMobile ? 'w-full' : 'w-[calc(50%-12px)]'}`}>
                    <View className="flex-row items-center gap-2 mb-6">
                        <View className="w-8 h-8 rounded-lg bg-blue-500/10 items-center justify-center">
                            <Icon name="account-group-outline" size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-white font-black uppercase text-xs tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Clientes VIP</Text>
                    </View>
                    <View className="gap-y-3">
                    {clientesFrec.length > 0 ? clientesFrec.slice(0, 5).map((c, i) => (
                        <View key={c.clienteNombre} className="flex-row items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                            <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${i === 0 ? 'bg-orange-500' : 'bg-slate-800'}`}>
                                <Text className="text-white font-black text-xs">{i + 1}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-sm uppercase truncate" style={{ fontFamily: 'Space Grotesk' }}>{c.clienteNombre}</Text>
                                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
                                    {c.totalOrdenes} Órdenes · <Text className="text-emerald-400">{formatCurrency(c.gastoTotal)}</Text>
                                </Text>
                            </View>
                        </View>
                    )) : <Text className="text-slate-600 italic text-center py-4">Sin historial</Text>}
                    </View>
                </Card>

                {/* Ventas por Hora (Visual simple) */}
                <Card className="p-5 bg-slate-900 border-white/5 w-full">
                    <View className="flex-row items-center gap-2 mb-8">
                        <View className="w-8 h-8 rounded-lg bg-blue-500/10 items-center justify-center">
                            <Icon name="clock-outline" size={16} color="#3B82F6" />
                        </View>
                        <Text className="text-white font-black uppercase text-xs tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Actividad por Hora</Text>
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        <View className="flex-row items-end gap-x-3 px-2 h-40">
                        {ventasHoraFull.map((v) => {
                            const pct = maxVentaHora > 0 ? (v.cantidad / maxVentaHora) * 100 : 0;
                            return (
                                <View key={v.hora} className="items-center w-8">
                                    <Text className="text-white font-black text-[8px] mb-1">{v.cantidad > 0 ? v.cantidad : ''}</Text>
                                    <View className="w-4 bg-white/5 rounded-t-sm justify-end overflow-hidden" style={{ height: 100 }}>
                                        <View className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${Math.max(pct, 2)}%` }} />
                                    </View>
                                    <Text className="text-slate-500 font-black text-[8px] mt-2 uppercase">{v.hora}h</Text>
                                </View>
                            );
                        })}
                        </View>
                    </ScrollView>
                </Card>

                {/* Ventas por Día (Visual simple) */}
                <Card className="p-5 bg-slate-900 border-white/5 w-full">
                    <View className="flex-row items-center gap-2 mb-8">
                        <View className="w-8 h-8 rounded-lg bg-emerald-500/10 items-center justify-center">
                            <Icon name="trending-up" size={16} color="#10B981" />
                        </View>
                        <Text className="text-white font-black uppercase text-xs tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Evolución de Ventas</Text>
                    </View>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        <View className="flex-row items-end gap-x-6 px-4 h-48">
                        {ventasDia.map((v) => {
                            const pct = maxVentaDia > 0 ? (v.total / maxVentaDia) * 100 : 0;
                            return (
                                <View key={v.fecha} className="items-center min-w-[40px]">
                                    <Text className="text-emerald-400 font-black text-[8px] mb-1 rotate-[-45deg] translate-y-[-10px]">
                                        {v.total > 0 ? formatCurrency(v.total) : ''}
                                    </Text>
                                    <View className="w-8 bg-white/5 rounded-t-md justify-end overflow-hidden" style={{ height: 120 }}>
                                        <View className="w-full bg-emerald-500 rounded-t-md" style={{ height: `${Math.max(pct, 1)}%` }} />
                                    </View>
                                    <Text className="text-slate-500 font-black text-[9px] mt-3 uppercase">{formatDayLabel(v.fecha)}</Text>
                                </View>
                            );
                        })}
                        </View>
                    </ScrollView>
                </Card>

            </View>

            {isMobile && <View className="h-20" />}
        </PageContainer>
    );
}

