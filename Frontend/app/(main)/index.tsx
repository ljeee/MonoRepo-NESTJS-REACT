import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import type { VentaHora, ResumenPeriodo, Orden } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';
import { PageContainer, Card, Icon } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';

const CHART_H = 140; // px fijos para las barras — evita height:'%' en RN native

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
        totalVentas: 0, totalEgresos: 0, balanceNeto: 0,
        facturas: facturasValidas.length, ordenes: ords.length,
        cancelados: 0, ticketPromedio: 0, tasaCancelacion: 0,
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ count, label, color, urgent }: { count: number; label: string; color: string; urgent?: boolean }) {
    return (
        <Card className="flex-row items-center gap-3 p-4 bg-white/5 border-white/10" style={{ flex: 1, minWidth: 130 }}>
            <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: color }} />
            <View>
                <Text style={{ fontFamily: 'Space Grotesk', color: urgent && count > 0 ? color : '#F8FAFC', fontSize: 22, fontWeight: '900' }}>
                    {count}
                </Text>
                <Text style={{ color: '#475569', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {label}
                </Text>
            </View>
        </Card>
    );
}

function KpiCard({ label, value, color, bg, border }: { label: string; value: string; color: string; bg: string; border: string }) {
    return (
        <Card style={{ flex: 1, minWidth: 130, padding: 16, alignItems: 'center', backgroundColor: bg, borderColor: border }}>
            <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                {label}
            </Text>
            <Text style={{ fontFamily: 'Space Grotesk', color, fontSize: 18, fontWeight: '900' }}>
                {value}
            </Text>
        </Card>
    );
}

function HourChart({ ventasHoraFull, maxHora }: { ventasHoraFull: VentaHora[]; maxHora: number }) {
    // Usa alturas en px — height:'%' no funciona con flex:1 en RN native
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 1 }}>
            {ventasHoraFull.map(v => {
                const barH = v.cantidad > 0 ? Math.max((v.cantidad / maxHora) * CHART_H, 4) : 0;
                return (
                    <View key={v.hora} style={{ flex: 1, height: CHART_H, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <View style={{
                            flex: 1, width: '100%', maxWidth: 18,
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderTopLeftRadius: 4, borderTopRightRadius: 4,
                            justifyContent: 'flex-end', overflow: 'hidden',
                        }}>
                            {barH > 0 && (
                                <View style={{
                                    width: '100%', height: barH,
                                    backgroundColor: '#F5A524',
                                    borderTopLeftRadius: 4, borderTopRightRadius: 4,
                                }} />
                            )}
                        </View>
                        {v.hora % 4 === 0 && (
                            <Text style={{ fontSize: 7, color: '#475569', marginTop: 2 }}>{v.hora}h</Text>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { isMobile } = useBreakpoint();
    const [clock, setClock] = useState(() =>
        new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    );
    const [dashboard, setDashboard] = useState<{
        loading: boolean;
        resumen: ResumenPeriodo | null;
        ventasHora: VentaHora[];
        ordenes: Orden[];
        pendientes: number;
        sinPagar: number;
        completadas: number;
        sinAsignar: number;
    }>({
        loading: true, resumen: null, ventasHora: [],
        ordenes: [], pendientes: 0, sinPagar: 0, completadas: 0, sinAsignar: 0,
    });
    const { loading, resumen, ventasHora, ordenes, pendientes, sinPagar, completadas, sinAsignar } = dashboard;

    useEffect(() => {
        const id = setInterval(() => {
            setClock(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
        }, 30000);
        return () => clearInterval(id);
    }, []);

    const fetchData = useCallback(async () => {
        setDashboard((prev) => ({ ...prev, loading: true }));
        const hoy = todayStr();
        try {
            const [r, vh, ords, facts, domSinAsignar] = await Promise.allSettled([
                api.estadisticas.resumenPeriodo(hoy, hoy),
                api.estadisticas.ventasPorHora(hoy),
                api.ordenes.getDay(),
                api.facturas.getDay(),
                api.domicilios.getSinAsignar(),
            ]);
            const ordData = ords.status === 'fulfilled' ? ords.value : [];
            const factsData = facts.status === 'fulfilled' ? facts.value : [];
            const sorted = [...ordData].sort((a, b) =>
                new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime()
            );
            const apiResumen = r.status === 'fulfilled' ? r.value : null;
            setDashboard({
                loading: false,
                resumen: buildResumenFallback(ordData, factsData, apiResumen),
                ventasHora: vh.status === 'fulfilled' ? vh.value : [],
                ordenes: sorted.slice(0, 6),
                pendientes: ordData.filter(o => o.estadoOrden === 'pendiente').length,
                completadas: ordData.filter(o => isCompletedEstado(o.estadoOrden)).length,
                sinPagar: factsData.filter(f => f.estado === 'pendiente').length,
                sinAsignar: domSinAsignar.status === 'fulfilled' ? domSinAsignar.value.length : 0,
            });
        } catch (err) {
            console.error('Dashboard fetch error', err);
            setDashboard((prev) => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => { void fetchData(); }, [fetchData]);
    useEffect(() => {
        const id = setInterval(fetchData, 60000);
        return () => clearInterval(id);
    }, [fetchData]);

    const ventasHoraFull = normalizeHourlySeries(ventasHora);
    const maxHora = Math.max(...ventasHoraFull.map(v => v.cantidad), 1);
    const userName = user?.name ?? 'Cajero';

    const [ready, setReady] = useState(Platform.OS !== 'web');
    useEffect(() => {
        if (Platform.OS === 'web') {
            const t = setTimeout(() => setReady(true), 50);
            return () => clearTimeout(t);
        }
    }, []);
    if (!ready) return null;

    return (
        <PageContainer>
            {/* ── Header ── */}
            <View className={`flex-row items-center border border-white/5 bg-white/5 overflow-hidden rounded-2xl mb-4 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
                <View className="flex-1">
                    <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>
                        {getGreeting()}
                    </Text>
                    <Text style={{ fontFamily: 'Space Grotesk', color: '#F8FAFC', fontSize: isMobile ? 16 : 20, fontWeight: '900', textTransform: 'uppercase' }}>
                        {userName}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: 'Space Grotesk', color: '#F5A524', fontSize: isMobile ? 22 : 28, fontWeight: '900' }}>
                        {clock}
                    </Text>
                    <Text style={{ color: '#475569', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </Text>
                </View>
            </View>

            {/* ── Quick actions ── */}
            <View className="flex-row flex-wrap gap-2 mb-5">
                <TouchableOpacity
                    className="flex-row items-center gap-2 px-5 py-3 rounded-2xl bg-(--color-pos-primary)"
                    onPress={() => router.push('/crear-orden')}
                >
                    <Icon name="plus" size={16} color="#000" />
                    <Text style={{ color: '#000', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Nueva Orden
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10"
                    onPress={() => router.push('/ordenes')}
                >
                    <Icon name="clipboard-list-outline" size={16} color="#64748B" />
                    <Text style={{ color: '#CBD5E1', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Pendientes
                    </Text>
                    {pendientes > 0 && (
                        <View style={{ backgroundColor: '#EF4444', borderRadius: 6, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{pendientes}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10"
                    onPress={() => router.push('/balance-fechas')}
                >
                    <Icon name="scale-balance" size={16} color="#64748B" />
                    <Text style={{ color: '#CBD5E1', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Balance
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ── Stat counters ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <StatCard count={pendientes} label="Pendientes" color={pendientes > 0 ? '#EF4444' : '#10B981'} urgent />
                <StatCard count={sinPagar} label="Por Pagar" color={sinPagar > 0 ? '#F5A524' : '#10B981'} urgent />
                <StatCard count={completadas} label="Entregadas" color="#10B981" />
                <TouchableOpacity style={{ flex: 1, minWidth: 130 }} onPress={() => router.push('/asignar-domiciliarios' as any)}>
                    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, flex: 1,
                        backgroundColor: sinAsignar > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                        borderColor: sinAsignar > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.1)' }}>
                        <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: sinAsignar > 0 ? '#F59E0B' : '#10B981' }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Space Grotesk', color: sinAsignar > 0 ? '#FCD34D' : '#F8FAFC', fontSize: 22, fontWeight: '900' }}>
                                {sinAsignar}
                            </Text>
                            <Text style={{ color: '#475569', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                                Sin Asignar
                            </Text>
                        </View>
                        {sinAsignar > 0 && <Icon name="chevron-right" size={14} color="#F59E0B" />}
                    </Card>
                </TouchableOpacity>
            </View>

            {loading && !resumen && (
                <ActivityIndicator size="large" color="#F5A524" style={{ paddingVertical: 40 }} />
            )}

            {/* ── KPIs ── */}
            {resumen && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                    <KpiCard label="Ventas Hoy" value={formatCurrency(resumen.totalVentas)}
                        color="#34D399" bg="rgba(16,185,129,0.08)" border="rgba(16,185,129,0.2)" />
                    <KpiCard label="Ticket Promedio" value={formatCurrency(resumen.ticketPromedio)}
                        color="#A78BFA" bg="rgba(139,92,246,0.08)" border="rgba(139,92,246,0.2)" />
                    <KpiCard label="Órdenes" value={String(resumen.ordenes)}
                        color="#F5A524" bg="rgba(245,165,36,0.08)" border="rgba(245,165,36,0.2)" />
                </View>
            )}

            {/* ── Chart + Recent ── */}
            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                {/* Hourly chart */}
                <Card style={{ flex: isMobile ? undefined : 1, padding: 16, marginBottom: isMobile ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                        <Icon name="chart-bar" size={14} color="#64748B" />
                        <Text style={{ fontFamily: 'Space Grotesk', color: '#F8FAFC', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Actividad por Hora
                        </Text>
                    </View>
                    {ventasHora.length > 0 ? (
                        <HourChart ventasHoraFull={ventasHoraFull} maxHora={maxHora} />
                    ) : (
                        <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#475569', fontSize: 13, fontStyle: 'italic' }}>Sin actividad registrada hoy</Text>
                        </View>
                    )}
                </Card>

                {/* Recent orders */}
                <Card style={{ flex: isMobile ? undefined : 1, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                        <Icon name="clipboard-text-outline" size={14} color="#64748B" />
                        <Text style={{ fontFamily: 'Space Grotesk', color: '#F8FAFC', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Órdenes Recientes
                        </Text>
                    </View>
                    {ordenes.map((o, idx) => (
                        <TouchableOpacity
                            key={o.ordenId}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
                                borderBottomWidth: idx < ordenes.length - 1 ? 1 : 0,
                                borderBottomColor: 'rgba(255,255,255,0.04)' }}
                            onPress={() => router.push(`/orden-detalle?id=${o.ordenId}` as any)}
                        >
                            <Text style={{ fontFamily: 'Space Grotesk', color: '#F5A524', fontSize: 11, fontWeight: '900', minWidth: 32 }}>
                                #{o.ordenId}
                            </Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontFamily: 'Space Grotesk', color: '#F8FAFC', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                                    {getOrdenDisplayName(o)}
                                </Text>
                                <Text style={{ color: '#475569', fontSize: 10, marginTop: 1 }}>
                                    {timeAgo(o.fechaOrden)}
                                </Text>
                            </View>
                            <View style={{
                                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
                                backgroundColor: o.estadoOrden === 'pendiente' ? 'rgba(245,165,36,0.12)' : 'rgba(16,185,129,0.12)',
                            }}>
                                <Text style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700',
                                    color: o.estadoOrden === 'pendiente' ? '#F5A524' : '#10B981' }}>
                                    {o.estadoOrden}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {ordenes.length === 0 && (
                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <Text style={{ color: '#475569', fontSize: 13, fontStyle: 'italic' }}>Sin órdenes recientes</Text>
                        </View>
                    )}
                </Card>
            </View>

            {isMobile && <View style={{ height: 80 }} />}
        </PageContainer>
    );
}
