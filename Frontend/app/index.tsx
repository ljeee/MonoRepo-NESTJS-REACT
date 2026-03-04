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
import type { VentaHora, ResumenPeriodo } from '../services/api';
import type { Orden } from '../types/models';
import { colors } from '../styles/theme';
import { spacing } from '../styles/tokens';
import { useBreakpoint } from '../styles/responsive';
import { dashboardStyles as s } from '../styles/dashboard.styles';
import Icon from '../components/ui/Icon';
import { useAuth } from '../contexts/AuthContext';

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
        <ScrollView style={s.page} contentContainerStyle={s.content}>
            {/* Welcome */}
            <View style={[s.welcomeCard, isMobile && s.welcomeCardMobile]}>
                <View style={{ flex: 1 }}>
                    <Text style={s.greeting}>{getGreeting()}, {userName} 👋</Text>
                    <Text style={s.dateText}>
                        {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                </View>
                <Text style={[s.clock, isMobile && s.clockMobile]}>{clock}</Text>
            </View>

            {/* Quick Actions */}
            <View style={s.quickRow}>
                <TouchableOpacity style={s.quickBtn} onPress={() => router.push('/crear-orden')}>
                    <Icon name="plus-circle-outline" size={18} color={colors.primary} />
                    <Text style={s.quickBtnText}>Crear Orden</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn} onPress={() => router.push('/ordenes')}>
                    <Icon name="clipboard-list-outline" size={18} color={colors.primary} />
                    <Text style={s.quickBtnText}>Pendientes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn} onPress={() => router.push('/balance-fechas')}>
                    <Icon name="scale-balance" size={18} color={colors.primary} />
                    <Text style={s.quickBtnText}>Balance</Text>
                </TouchableOpacity>
            </View>

            {/* Status cards */}
            <View style={[s.statusRow, isMobile && s.statusRowMobile]}>
                <TouchableOpacity style={[s.statusCard, isMobile && s.statusCardMobile]} onPress={() => router.push('/ordenes')}>
                    <View style={[s.statusDot, pendientes > 0 ? s.dotRed : s.dotGreen]} />
                    <View style={s.statusInfo}>
                        <Text style={s.statusCount}>{pendientes}</Text>
                        <Text style={s.statusLabel}>Pendientes</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={[s.statusCard, isMobile && s.statusCardMobile]} onPress={() => router.push('/facturas-dia' as any)}>
                    <View style={[s.statusDot, sinPagar > 0 ? s.dotYellow : s.dotGreen]} />
                    <View style={s.statusInfo}>
                        <Text style={s.statusCount}>{sinPagar}</Text>
                        <Text style={s.statusLabel}>Sin Pagar</Text>
                    </View>
                </TouchableOpacity>
                <View style={[s.statusCard, isMobile && s.statusCardMobile]}>
                    <View style={[s.statusDot, s.dotGreen]} />
                    <View style={s.statusInfo}>
                        <Text style={s.statusCount}>{completadas}</Text>
                        <Text style={s.statusLabel}>Completadas</Text>
                    </View>
                </View>
            </View>

            {loading && !resumen && (
                <ActivityIndicator size="large" color={colors.primary} style={{ paddingVertical: spacing['2xl'] }} />
            )}

            {/* KPIs */}
            {resumen && (
                <View style={[s.kpiRow, isMobile && s.kpiRowMobile]}>
                    <View style={[s.kpiCard, isMobile && s.kpiCardMobile]}>
                        <Text style={s.kpiLabel}>Ventas Hoy</Text>
                        <Text style={[s.kpiValue, { color: '#22c55e' }]}>{formatCurrency(resumen.totalVentas)}</Text>
                    </View>
                    <View style={[s.kpiCard, isMobile && s.kpiCardMobile]}>
                        <Text style={s.kpiLabel}>Ticket Promedio</Text>
                        <Text style={[s.kpiValue, { color: '#a855f7' }]}>{formatCurrency(resumen.ticketPromedio)}</Text>
                    </View>
                    <View style={[s.kpiCard, isMobile && s.kpiCardMobile]}>
                        <Text style={s.kpiLabel}>Órdenes</Text>
                        <Text style={[s.kpiValue, { color: colors.primary }]}>{resumen.ordenes}</Text>
                    </View>
                </View>
            )}

            {/* Hour Chart + Recent */}
            <View style={[s.gridRow, isMobile && s.gridRowMobile]}>
                {/* Hour chart */}
                <View style={[s.card, s.hourlyCard]}>
                    <Text style={s.cardTitle}>📊 Actividad por Hora</Text>
                    {ventasHora.length > 0 ? (
                        <View style={s.hourChart}>
                            {ventasHoraFull.map(v => {
                                const pct = (v.cantidad / maxHora) * 100;
                                return (
                                    <View key={v.hora} style={s.hourCol}>
                                        <View style={s.hourTrack}>
                                            <View style={[s.hourFill, { height: v.cantidad > 0 ? `${Math.max(pct, 2)}%` : '0%' }]} />
                                        </View>
                                        <Text style={s.hourLabel}>{v.hora}h</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : <Text style={s.emptyText}>Sin actividad</Text>}
                </View>

                {/* Recent orders */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>📋 Recientes</Text>
                    {ordenes.map(o => (
                        <TouchableOpacity
                            key={o.ordenId}
                            style={s.orderRow}
                            onPress={() => router.push(`/orden-detalle?id=${o.ordenId}` as any)}
                        >
                            <Text style={s.orderId}>#{o.ordenId}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={s.orderName} numberOfLines={1}>{getOrdenDisplayName(o)}</Text>
                                <Text style={s.orderTime}>{timeAgo(o.fechaOrden)}</Text>
                            </View>
                            <Text style={[s.orderBadge, o.estadoOrden === 'pendiente' && s.badgePending, isCompletedEstado(o.estadoOrden) && s.badgeComplete]}>{o.estadoOrden}</Text>
                        </TouchableOpacity>
                    ))}
                    {ordenes.length === 0 && <Text style={s.emptyText}>Sin órdenes</Text>}
                </View>
            </View>

            {isMobile && <View style={{ height: 80 }} />}
        </ScrollView>
    );
}
