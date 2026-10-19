import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Text, TouchableOpacity, View } from '../../tw';
import { useRouter } from 'expo-router';
import { api, getBaseUrl } from '../../services/api';
import { Role, bogotaToday, nombreVisibleOrden, timeAgo, useOrdenesSocket } from '@/src/shared';
import type { HorariosAnalitica, Orden, ResumenAnalitica } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';
import { PageContainer, Card, Icon, StatCard, LoadingState, EstadoPill } from '../../components/ui';
import { ChartCard, ColumnChart, formatearValor } from '../../components/charts';
import { useAuth } from '../../contexts/AuthContext';
import { PosRefreshControl } from '../../components/ui/PosRefreshControl';

// Formatters hoisteados: crear un Intl.DateTimeFormat por render/tick es costoso
const CLOCK_FORMATTER = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });
const HEADER_DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
}

function isCompletedEstado(value?: string): boolean {
    const estado = String(value || '').toLowerCase();
    return estado === 'completado' || estado === 'completada' || estado === 'entregado';
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter();
    const { user, token } = useAuth();
    const { isMobile } = useBreakpoint();
    const { width: screenWidth } = useWindowDimensions();

    // Calcula ancho exacto de tarjeta para cuadrícula de 2 columnas en móvil.
    // PageContainer usa px-4 (16px c/lado) en móvil; gap entre tarjetas = 10px.
    const cardGap = 10;
    const hPad = isMobile ? 16 : 24;
    const col2Width = isMobile ? Math.floor((screenWidth - hPad * 2 - cardGap) / 2) : undefined;

    const [clock, setClock] = useState(() => CLOCK_FORMATTER.format(new Date()));
    const verAnalitica = !!user?.roles?.some((r) => r === Role.Admin || r === Role.Cajero || r === Role.Contador);
    const [dashboard, setDashboard] = useState<{
        loading: boolean;
        resumen: ResumenAnalitica | null;
        horarios: HorariosAnalitica | null;
        ordenes: Orden[];
        pendientes: number;
        sinPagar: number;
        completadas: number;
        sinAsignar: number;
    }>({
        loading: true, resumen: null, horarios: null,
        ordenes: [], pendientes: 0, sinPagar: 0, completadas: 0, sinAsignar: 0,
    });
    const { loading, resumen, horarios, ordenes, pendientes, sinPagar, completadas, sinAsignar } = dashboard;
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const id = setInterval(() => {
            setClock(CLOCK_FORMATTER.format(new Date()));
        }, 30000);
        return () => clearInterval(id);
    }, []);

    const fetchData = useCallback(async () => {
        setDashboard((prev) => ({ ...prev, loading: true }));
        setHasError(false);
        const hoy = bogotaToday();
        // KPIs de dinero solo para quien ve analítica (el mesero recibiría 403).
        const consulta = { from: hoy, to: hoy, comparar: true };
        const sinDatos = Promise.resolve(null);
        try {
            const [r, hr, ords, facts, domSinAsignar] = await Promise.allSettled([
                verAnalitica ? api.analitica.resumen(consulta) : sinDatos,
                verAnalitica ? api.analitica.horarios(consulta) : sinDatos,
                api.ordenes.getDay(),
                api.facturas.getDay(),
                api.domicilios.getSinAsignar(),
            ]);

            if (ords.status === 'rejected' && facts.status === 'rejected') {
                setHasError(true);
            }

            const ordData = ords.status === 'fulfilled' ? ords.value : [];
            const factsData = facts.status === 'fulfilled' ? facts.value : [];
            const sorted = [...ordData].sort((a, b) =>
                new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime()
            );
            setDashboard({
                loading: false,
                resumen: r.status === 'fulfilled' ? r.value : null,
                horarios: hr.status === 'fulfilled' ? hr.value : null,
                ordenes: sorted.slice(0, 6),
                pendientes: ordData.filter(o => o.estadoOrden === 'pendiente').length,
                completadas: ordData.filter(o => isCompletedEstado(o.estadoOrden)).length,
                sinPagar: factsData.filter(f => f.estado === 'pendiente').length,
                sinAsignar: domSinAsignar.status === 'fulfilled' ? domSinAsignar.value.length : 0,
            });
        } catch (err) {
            console.error('Dashboard fetch error', err);
            setDashboard((prev) => ({ ...prev, loading: false }));
            setHasError(true);
        }
    }, [verAnalitica]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    // Tiempo real en vez de polling: cada orden/pago emite varios eventos seguidos,
    // así que se agrupan antes de recargar.
    const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recargarPronto = useCallback(() => {
        if (temporizador.current) clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => { void fetchData(); }, 1500);
    }, [fetchData]);
    useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);
    useOrdenesSocket(getBaseUrl(), user?.roles?.[0] || 'cajero', recargarPronto, token, { onStats: recargarPronto });

    // Solo las horas con movimiento (± 1), para que la gráfica no sea casi toda vacía.
    const porHora = (() => {
        const filas = horarios?.porHora ?? [];
        const activas = filas.filter((h) => h.facturas > 0).map((h) => h.hora);
        if (!activas.length) return [];
        const desde = Math.max(0, Math.min(...activas) - 1);
        const hasta = Math.min(23, Math.max(...activas) + 1);
        return Array.from({ length: hasta - desde + 1 }, (_, i) => {
            const hora = desde + i;
            const fila = filas.find((h) => h.hora === hora);
            return { key: String(hora), label: `${hora}h`, value: fila?.facturas ?? 0 };
        });
    })();
    const kpi = resumen?.actual;
    const ayer = resumen?.anterior ?? undefined;
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
        <PageContainer refreshControl={
            <PosRefreshControl
                refreshing={loading}
                onRefresh={fetchData}
            />
        }>
            {/* Banner de error de conexión */}
            {hasError && (
                <View className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-red-500/20 items-center justify-center">
                        <Icon name="wifi-off" size={18} color="#EF4444" />
                    </View>
                    <View className="flex-1">
                        <Text style={{ fontFamily: 'Space Grotesk', color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}>
                            Error de conexión
                        </Text>
                        <Text style={{ color: '#F87171', fontSize: 11, marginTop: 1 }}>
                            No se pudieron cargar algunos datos en tiempo real. Desliza hacia abajo para reintentar.
                        </Text>
                    </View>
                </View>
            )}
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
                        {HEADER_DATE_FORMATTER.format(new Date())}
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: cardGap, marginBottom: 16 }}>
                <StatCard variant="counter" label="Pendientes" value={String(pendientes)} color={pendientes > 0 ? '#EF4444' : '#10B981'} urgent width={col2Width} />
                <StatCard variant="counter" label="Por Pagar" value={String(sinPagar)} color={sinPagar > 0 ? '#FB923C' : '#10B981'} urgent width={col2Width} />
                <StatCard variant="counter" label="Entregadas" value={String(completadas)} color="#10B981" width={col2Width} />
                <StatCard
                    variant="counter"
                    label="Sin Asignar"
                    value={String(sinAsignar)}
                    color={sinAsignar > 0 ? '#F59E0B' : '#10B981'}
                    urgent={sinAsignar > 0}
                    tinted={sinAsignar > 0}
                    width={col2Width}
                    onPress={() => router.push('/asignar-domiciliarios' as any)}
                />
            </View>

            {loading && verAnalitica && !resumen && (
                <LoadingState className="py-10" padded={false} />
            )}

            {/* ── KPIs (vs ayer a esta misma hora) ── */}
            {verAnalitica && kpi && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: cardGap, marginBottom: 16 }}>
                    <StatCard label="Ventas hoy" icon="cash-multiple" color="#10B981" value={formatearValor(kpi.facturado, 'moneda')}
                        current={kpi.facturado} previous={ayer?.facturado} sub={`Cobrado ${formatearValor(kpi.cobrado, 'monedaCompacta')}`}
                        onPress={() => router.push('/estadisticas' as any)} />
                    <StatCard label="Ticket promedio" icon="receipt" color="#A78BFA" value={formatearValor(kpi.ticket, 'moneda')}
                        current={kpi.ticket} previous={ayer?.ticket} />
                    <StatCard label="Órdenes" icon="clipboard-list-outline" color="#F5A524" value={formatearValor(kpi.ordenes)}
                        current={kpi.ordenes} previous={ayer?.ordenes} sub={`${formatearValor(kpi.pizzas)} pizzas`} />
                </View>
            )}

            {/* ── Chart + Recent ── */}
            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                {/* Hourly chart */}
                {verAnalitica && (
                    <ChartCard
                        className={isMobile ? 'mb-3' : 'flex-1'}
                        title="Actividad por hora"
                        subtitle="Pedidos de hoy"
                        icon="chart-bar"
                        color="#F5A524"
                        loading={loading && !horarios}
                        empty={!porHora.length}
                        emptyText="Sin actividad registrada hoy"
                    >
                        <ColumnChart data={porHora} showValues />
                    </ChartCard>
                )}

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
                                    {nombreVisibleOrden(o)}
                                </Text>
                                <Text style={{ color: '#475569', fontSize: 10, marginTop: 1 }}>
                                    {timeAgo(o.fechaOrden)}
                                </Text>
                            </View>
                            <EstadoPill estado={o.estadoOrden} />
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
