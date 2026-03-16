import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { api } from '../../services/api';
import type {
    ProductoTop,
    SaborTop,
    VentaDia,
    VentaHora,
    MetodoPago,
    ResumenPeriodo,
    ClienteFrecuente,
} from '@monorepo/shared';
import { formatCurrency as sharedFormatCurrency } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from '../../tw';
import { PageContainer, PageHeader, Card, Icon, Button, ListSkeleton } from '../../components/ui';

function formatCurrency(n: number) {
    return '$' + sharedFormatCurrency(n || 0);
}

function getDefaultDateRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return { from: `${y}-${m}-${d}`, to: `${y}-${m}-${d}` };
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

function KpiCard({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    return (
        <Card className="flex-1 min-w-[160px] bg-slate-900 border-white/5 overflow-hidden">
            <View className="flex-row items-center p-5">
                <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: `${color}15` }}>
                    <Icon name={icon} size={24} color={color} />
                </View>
                <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</Text>
                    <Text className="text-white text-xl font-black tracking-tight" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>{value}</Text>
                </View>
            </View>
            <View className="h-1 w-full opacity-30" style={{ backgroundColor: color }} />
        </Card>
    );
}

function HBar({ label, value, max, rank, color }: { label: string; value: number; max: number; rank: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <View className="mb-5">
            <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-3 flex-1">
                    <Text className="font-black text-sm" style={{ color }}>#{rank}</Text>
                    <Text className="text-slate-200 text-xs font-black uppercase truncate flex-1" style={{ fontFamily: 'Space Grotesk' }}>{label}</Text>
                </View>
                <Text className="text-white font-black text-sm" style={{ fontFamily: 'Space Grotesk' }}>{value}</Text>
            </View>
            <View className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
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

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [r, pt, st, vd, vh, mp, cf] = await Promise.all([
                api.estadisticas.resumenPeriodo(from, to),
                api.estadisticas.productosTop(from, to),
                api.estadisticas.saboresTop(from, to),
                api.estadisticas.ventasPorDia(from, to),
                api.estadisticas.ventasPorHora(undefined, from, to),
                api.estadisticas.metodosPago(from, to),
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
        } finally {
            setLoading(false);
        }
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
            <PageHeader title="Analítica" subtitle="Inteligencia de negocio y tendencias" icon="chart-areaspline" />

            {/* ── Filter Bar ── */}
            <Card className="mb-8 p-6 bg-slate-900 border-white/5">
                <View className={`${isMobile ? 'flex-col' : 'flex-row'} items-end gap-6`}>
                    <View className="flex-1 w-full">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Fecha Inicial</Text>
                        <input
                            type="date"
                            value={from}
                            onChange={(e: any) => setFrom(e.target.value)}
                            style={{
                                width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none'
                            }}
                        />
                    </View>
                    <View className="flex-1 w-full">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Fecha Final</Text>
                        <input
                            type="date"
                            value={to}
                            onChange={(e: any) => setTo(e.target.value)}
                            style={{
                                width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none'
                            }}
                        />
                    </View>
                    <Button
                        title={loading ? 'Actualizando...' : 'Recargar Datos'}
                        icon="sync"
                        variant="primary"
                        onPress={fetchAll}
                        loading={loading}
                        className={isMobile ? 'w-full' : 'px-10'}
                    />
                </View>
            </Card>

            {loading && !resumen && <View className="py-20"><ListSkeleton count={6} /></View>}

            {/* ── KPIs ── */}
            {resumen && (
                <View className="flex-row flex-wrap gap-4 mb-10">
                    <KpiCard icon="cash" label="Ventas Totales" value={formatCurrency(resumen.totalVentas)} color="#10B981" />
                    <KpiCard icon="trending-up" label="Balance Neto" value={formatCurrency(resumen.balanceNeto)} color="#3B82F6" />
                    <KpiCard icon="cart-outline" label="Ticket Medio" value={formatCurrency(resumen.ticketPromedio)} color="#8B5CF6" />
                    <KpiCard icon="clipboard-list-outline" label="Órdenes" value={String(resumen.ordenes)} color="#F5A524" />
                </View>
            )}

            {/* ── Main Dashboard Grid ── */}
            <View className={`flex-row flex-wrap gap-6 pb-20`}>
                
                {/* Products Ranking */}
                <Card className={`p-6 bg-slate-900 border-white/5 ${isMobile ? 'w-full' : 'flex-1 min-w-[340px]'}`}>
                    <View className="flex-row items-center gap-3 mb-8 pb-4 border-b border-white/10">
                        <View className="w-10 h-10 rounded-xl bg-emerald-500/10 items-center justify-center">
                            <Icon name="trophy-outline" size={20} color="#10B981" />
                        </View>
                        <Text className="text-white font-black uppercase text-sm tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Top Productos</Text>
                    </View>
                    {productosTop.slice(0, 6).map((p, i) => (
                        <HBar key={p.producto} label={p.producto} value={p.totalVendido} max={maxProducto} rank={i + 1} color="#10B981" />
                    ))}
                </Card>

                {/* Flavors Favoritos */}
                <Card className={`p-6 bg-slate-900 border-white/5 ${isMobile ? 'w-full' : 'flex-1 min-w-[340px]'}`}>
                    <View className="flex-row items-center gap-3 mb-8 pb-4 border-b border-white/10">
                        <View className="w-10 h-10 rounded-xl bg-purple-500/10 items-center justify-center">
                            <Icon name="pizza" size={20} color="#A855F7" />
                        </View>
                        <Text className="text-white font-black uppercase text-sm tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Sabores VIP</Text>
                    </View>
                    {saboresTop.slice(0, 6).map((sb, i) => (
                        <HBar key={sb.sabor} label={sb.sabor} value={sb.cantidad} max={maxSabor} rank={i + 1} color="#A855F7" />
                    ))}
                </Card>

                {/* Activity Hours */}
                <Card className={`p-6 bg-slate-900 border-white/5 w-full`}>
                    <View className="flex-row items-center gap-3 mb-10">
                        <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center">
                            <Icon name="clock-outline" size={20} color="#3B82F6" />
                        </View>
                        <Text className="text-white font-black uppercase text-sm tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Actividad por Hora</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View className="flex-row items-end gap-x-5 px-4 h-52">
                        {ventasHoraFull.map((v) => {
                            const pct = maxVentaHora > 0 ? (v.cantidad / maxVentaHora) * 100 : 0;
                            return (
                                <View key={v.hora} className="items-center w-10">
                                    <Text className="text-white font-black text-[10px] mb-2">{v.cantidad > 0 ? v.cantidad : ''}</Text>
                                    <View className="w-5 bg-black/40 rounded-t-lg justify-end overflow-hidden" style={{ height: 140 }}>
                                        <View className="w-full bg-blue-500/80 rounded-t-lg" style={{ height: `${Math.max(pct, 2)}%` }} />
                                    </View>
                                    <Text className="text-slate-500 font-black text-[10px] mt-4 uppercase">{v.hora}h</Text>
                                </View>
                            );
                        })}
                        </View>
                    </ScrollView>
                </Card>

                {/* Daily Evolution */}
                <Card className={`p-6 bg-slate-900 border-white/5 w-full`}>
                    <View className="flex-row items-center gap-3 mb-12">
                        <View className="w-10 h-10 rounded-xl bg-orange-500/10 items-center justify-center">
                            <Icon name="trending-up" size={20} color="#F5A524" />
                        </View>
                        <Text className="text-white font-black uppercase text-sm tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Evolución Ventas</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View className="flex-row items-end gap-x-10 px-8 h-60">
                        {ventasDia.map((v) => {
                            const pct = maxVentaDia > 0 ? (v.total / maxVentaDia) * 100 : 0;
                            return (
                                <View key={v.fecha} className="items-center min-w-[60px]">
                                    <Text className="text-emerald-400 font-black text-[9px] mb-2 rotate-[-30deg] translate-y-[-10px]">
                                        {formatCurrency(v.total)}
                                    </Text>
                                    <View className="w-10 bg-black/40 rounded-t-xl justify-end overflow-hidden" style={{ height: 160 }}>
                                        <View className="w-full bg-emerald-500/80 rounded-t-xl" style={{ height: `${Math.max(pct, 1)}%` }} />
                                    </View>
                                    <Text className="text-slate-500 font-black text-[10px] mt-4 uppercase">{formatDayLabel(v.fecha)}</Text>
                                </View>
                            );
                        })}
                        </View>
                    </ScrollView>
                </Card>

                {/* VIP Customers */}
                <Card className={`p-6 bg-slate-900 border-white/5 ${isMobile ? 'w-full' : 'flex-1 min-w-[340px]'}`}>
                    <View className="flex-row items-center gap-3 mb-8 pb-4 border-b border-white/10">
                        <View className="w-10 h-10 rounded-xl bg-amber-500/10 items-center justify-center">
                            <Icon name="account-group-outline" size={20} color="#F5A524" />
                        </View>
                        <Text className="text-white font-black uppercase text-sm tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Clientes VIP</Text>
                    </View>
                    <View className="gap-y-4">
                    {clientesFrec.slice(0, 6).map((c, i) => (
                        <View key={c.clienteNombre} className="flex-row items-center bg-white/5 p-4 rounded-3xl border border-white/10">
                            <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${i === 0 ? 'bg-amber-500' : 'bg-slate-800'}`}>
                                <Text className="text-white font-black text-sm">{i + 1}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-black text-base uppercase truncate" style={{ fontFamily: 'Space Grotesk' }}>{c.clienteNombre}</Text>
                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                    {c.totalOrdenes} Órdenes · <Text className="text-emerald-400">{formatCurrency(c.gastoTotal)}</Text>
                                </Text>
                            </View>
                        </View>
                    ))}
                    </View>
                </Card>

                {/* Payment Methods */}
                <Card className={`p-6 bg-slate-900 border-white/5 ${isMobile ? 'w-full' : 'flex-1 min-w-[340px]'}`}>
                    <View className="flex-row items-center gap-3 mb-10 pb-4 border-b border-white/10">
                        <View className="w-10 h-10 rounded-xl bg-orange-500/10 items-center justify-center">
                            <Icon name="credit-card-outline" size={20} color="#F5A524" />
                        </View>
                        <Text className="text-white font-black uppercase text-sm tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Distribución Pagos</Text>
                    </View>
                    <View className="gap-y-8">
                    {metodos.map((m) => (
                        <View key={m.metodo}>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-white text-xs font-black uppercase tracking-widest">{m.metodo}</Text>
                                <Text className="text-slate-500 text-[10px] font-black">{m.cantidad} transacciones</Text>
                            </View>
                            <View className="h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                <View className="h-full bg-orange-500 shadow-lg shadow-orange-500/50" style={{ width: `${m.porcentaje}%` }} />
                            </View>
                            <View className="flex-row justify-between mt-2">
                                <Text className="text-emerald-400 text-sm font-black" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(m.total)}</Text>
                                <Text className="text-white text-[10px] font-black">{m.porcentaje}%</Text>
                            </View>
                        </View>
                    ))}
                    </View>
                </Card>

            </View>
        </PageContainer>
    );
}
