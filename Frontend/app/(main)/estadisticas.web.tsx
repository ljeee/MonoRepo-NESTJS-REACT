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
import { formatCompactCurrency as sharedFormatCompact } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from '../../tw';
import { PageContainer, PageHeader, Card, Icon, Button, ListSkeleton } from '../../components/ui';

function formatCurrency(n: number) {
    return sharedFormatCompact(n || 0);
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
        <Card style={{ flex: 1, minWidth: 150, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 0 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: `${color}15` }}>
                    <Icon name={icon} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</Text>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18 }} numberOfLines={1}>{value}</Text>
                </View>
            </View>
            <View style={{ height: 3, width: '100%', opacity: 0.3, backgroundColor: color, marginTop: 12, borderRadius: 2 }} />
        </Card>
    );
}

function HBar({ label, value, max, rank, color }: { label: string; value: number; max: number; rank: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 11, color }}>{`#${rank}`}</Text>
                    <Text style={{ fontFamily: 'Outfit', color: '#CBD5E1', fontSize: 11, textTransform: 'uppercase', flex: 1 }} numberOfLines={1}>{label}</Text>
                </View>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12 }}>{value}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <View style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: color }} />
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
            <Card style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-end', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginLeft: 2 }}>Fecha Inicial</Text>
                        <input
                            type="date"
                            value={from}
                            onChange={(e: any) => setFrom(e.target.value)}
                            style={{
                                width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'Outfit'
                            }}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginLeft: 2 }}>Fecha Final</Text>
                        <input
                            type="date"
                            value={to}
                            onChange={(e: any) => setTo(e.target.value)}
                            style={{
                                width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'Outfit'
                            }}
                        />
                    </View>
                    <Button
                        title={loading ? 'Actualizando...' : 'Recargar'}
                        icon="sync"
                        variant="primary"
                        onPress={fetchAll}
                        loading={loading}
                        className={isMobile ? 'w-full' : ''}
                    />
                </View>
            </Card>

            {loading && !resumen && <View className="py-12"><ListSkeleton count={4} /></View>}

            {/* ── KPIs ── */}
            {resumen && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                    <KpiCard icon="cash" label="Ventas Totales" value={formatCurrency(resumen.totalVentas)} color="#10B981" />
                    <KpiCard icon="trending-up" label="Balance Neto" value={formatCurrency(resumen.balanceNeto)} color="#3B82F6" />
                    <KpiCard icon="cart-outline" label="Ticket Medio" value={formatCurrency(resumen.ticketPromedio)} color="#8B5CF6" />
                    <KpiCard icon="clipboard-list-outline" label="Órdenes" value={String(resumen.ordenes)} color="#F5A524" />
                </View>
            )}

            {/* ── Main Dashboard Grid ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 40 }}>
                
                {/* Products Ranking */}
                <Card style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? '100%' : 300, width: isMobile ? '100%' : undefined }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="trophy-outline" size={18} color="#10B981" />
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Top Productos</Text>
                    </View>
                    {productosTop.slice(0, 6).map((p, i) => (
                        <HBar key={p.producto} label={p.producto} value={p.totalVendido} max={maxProducto} rank={i + 1} color="#10B981" />
                    ))}
                </Card>

                {/* Flavors Favoritos */}
                <Card style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? '100%' : 300, width: isMobile ? '100%' : undefined }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(168,85,247,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="pizza" size={18} color="#A855F7" />
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Sabores VIP</Text>
                    </View>
                    {saboresTop.slice(0, 6).map((sb, i) => (
                        <HBar key={sb.sabor} label={sb.sabor} value={sb.cantidad} max={maxSabor} rank={i + 1} color="#A855F7" />
                    ))}
                </Card>

                {/* Activity Hours */}
                <Card style={{ width: '100%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="clock-outline" size={18} color="#3B82F6" />
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Actividad por Hora</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 8, height: 180 }}>
                        {ventasHoraFull.map((v) => {
                            const pct = maxVentaHora > 0 ? (v.cantidad / maxVentaHora) * 100 : 0;
                            return (
                                <View key={v.hora} style={{ alignItems: 'center', width: 32 }}>
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 9, marginBottom: 4 }}>{v.cantidad > 0 ? v.cantidad : ''}</Text>
                                    <View style={{ width: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderTopLeftRadius: 4, borderTopRightRadius: 4, justifyContent: 'flex-end', overflow: 'hidden', height: 120 }}>
                                        <View style={{ width: '100%', backgroundColor: 'rgba(59,130,246,0.8)', borderTopLeftRadius: 4, borderTopRightRadius: 4, height: `${Math.max(pct, 2)}%` }} />
                                    </View>
                                    <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, marginTop: 6, textTransform: 'uppercase' }}>{v.hora}h</Text>
                                </View>
                            );
                        })}
                        </View>
                    </ScrollView>
                </Card>

                {/* Daily Evolution */}
                <Card style={{ width: '100%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="trending-up" size={18} color="#F5A524" />
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Evolución Ventas</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 20, paddingHorizontal: 12, height: 200 }}>
                        {ventasDia.map((v) => {
                            const pct = maxVentaDia > 0 ? (v.total / maxVentaDia) * 100 : 0;
                            return (
                                <View key={v.fecha} style={{ alignItems: 'center', minWidth: 50 }}>
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 9, marginBottom: 4 }}>
                                        {formatCurrency(v.total)}
                                    </Text>
                                    <View style={{ width: 30, backgroundColor: 'rgba(0,0,0,0.4)', borderTopLeftRadius: 8, borderTopRightRadius: 8, justifyContent: 'flex-end', overflow: 'hidden', height: 140 }}>
                                        <View style={{ width: '100%', backgroundColor: 'rgba(16,185,129,0.8)', borderTopLeftRadius: 8, borderTopRightRadius: 8, height: `${Math.max(pct, 1)}%` }} />
                                    </View>
                                    <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, marginTop: 6, textTransform: 'uppercase' }}>{formatDayLabel(v.fecha)}</Text>
                                </View>
                            );
                        })}
                        </View>
                    </ScrollView>
                </Card>

                {/* VIP Customers */}
                <Card style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? '100%' : 300, width: isMobile ? '100%' : undefined }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="account-group-outline" size={18} color="#F5A524" />
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Clientes VIP</Text>
                    </View>
                    <View style={{ gap: 8 }}>
                    {clientesFrec.slice(0, 6).map((c, i) => (
                        <View key={c.clienteNombre} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: i === 0 ? '#F5A524' : '#1E293B' }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12 }}>{i + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13, textTransform: 'uppercase' }} numberOfLines={1}>{c.clienteNombre}</Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {c.totalOrdenes} Órdenes · <Text style={{ color: '#34D399' }}>{formatCurrency(c.gastoTotal)}</Text>
                                </Text>
                            </View>
                        </View>
                    ))}
                    </View>
                </Card>

                {/* Payment Methods */}
                <Card style={{ flex: isMobile ? undefined : 1, minWidth: isMobile ? '100%' : 300, width: isMobile ? '100%' : undefined }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="credit-card-outline" size={18} color="#F5A524" />
                        </View>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Distribución Pagos</Text>
                    </View>
                    <View style={{ gap: 16 }}>
                    {metodos.map((m) => (
                        <View key={m.metodo}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{m.metodo}</Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10 }}>{m.cantidad} transacciones</Text>
                            </View>
                            <View style={{ height: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                                <View style={{ height: '100%', backgroundColor: '#F5A524', width: `${m.porcentaje}%`, borderRadius: 4 }} />
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 12 }}>{formatCurrency(m.total)}</Text>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 10 }}>{m.porcentaje}%</Text>
                            </View>
                        </View>
                    ))}
                    </View>
                </Card>

            </View>
        </PageContainer>
    );
}
