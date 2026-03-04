import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { api } from '../services/api';
import type {
    ProductoTop,
    SaborTop,
    VentaDia,
    VentaHora,
    MetodoPago,
    ResumenPeriodo,
    ClienteFrecuente,
} from '../services/api';
import { colors } from '../styles/theme';
import { useBreakpoint } from '../styles/responsive';
import { estadisticasStyles as s } from '../styles/estadisticas.styles';
import Icon, { IconName } from '../components/ui/Icon';

function formatCurrency(n: number) {
    return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function getDefaultDateRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    return { from: today, to: today };
}

function formatDayLabel(fecha: string): string {
    if (!fecha) return '--';
    const parsed = new Date(fecha);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    }

    // Fallback for API values like YYYY-MM-DD or unexpected strings.
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
function KpiCard({ icon, label, value, color }: { icon: IconName; label: string; value: string; color: string }) {
    return (
        <View style={s.kpiCard}>
            <View style={[s.kpiIcon, { backgroundColor: color + '20' }]}>
                <Icon name={icon} size={22} color={color} />
            </View>
            <View style={s.kpiContent}>
                <Text style={s.kpiLabel}>{label}</Text>
                <Text style={s.kpiValue} numberOfLines={1}>{value}</Text>
            </View>
        </View>
    );
}

// ── Horizontal Bar ──
function HBar({ label, value, max, rank, color }: { label: string; value: number; max: number; rank: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <View style={s.barRow}>
            <View style={s.barLabelWrap}>
                <Text style={[s.barRank, { color }]}>#{rank}</Text>
                <Text style={s.barLabel} numberOfLines={1}>{label}</Text>
            </View>
            <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={s.barValue}>{value}</Text>
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
            setLoading(false);
            return;
        }

        setLoading(false);
    }, [from, to]);

    useEffect(() => {
        const timer = setTimeout(() => { void fetchAll(); }, 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const maxProducto = productosTop[0]?.totalVendido || 1;
    const maxSabor = saboresTop[0]?.cantidad || 1;
    const ventasHoraFull = normalizeHourlySeries(ventasHora);
    const maxVentaHora = Math.max(...ventasHoraFull.map(v => v.cantidad), 1);
    const maxVentaDia = Math.max(...ventasDia.map(v => v.total), 1);

    return (
        <ScrollView style={s.page} contentContainerStyle={s.pageContent}>
            {/* ── Header ── */}
            <View style={s.header}>
                <View>
                    <Text style={s.pageTitle}>📊 Estadísticas</Text>
                    <Text style={s.pageSubtitle}>Análisis del negocio</Text>
                </View>
            </View>

            {/* ── Date Pickers ── */}
            <View style={[s.dateRow, isMobile && s.dateRowMobile]}>
                <View style={s.dateField}>
                    <Text style={s.dateLabel}>Desde</Text>
                    {Platform.OS === 'web' ? (
                        <input
                            type="date"
                            value={from}
                            onChange={(e: any) => setFrom(e.target.value)}
                            style={{
                                background: colors.card, color: colors.text, border: `1px solid ${colors.border}`,
                                borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none',
                            }}
                        />
                    ) : (
                        <TextInput style={s.dateInput} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
                    )}
                </View>
                <View style={s.dateField}>
                    <Text style={s.dateLabel}>Hasta</Text>
                    {Platform.OS === 'web' ? (
                        <input
                            type="date"
                            value={to}
                            onChange={(e: any) => setTo(e.target.value)}
                            style={{
                                background: colors.card, color: colors.text, border: `1px solid ${colors.border}`,
                                borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none',
                            }}
                        />
                    ) : (
                        <TextInput style={s.dateInput} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
                    )}
                </View>
                <TouchableOpacity style={s.refreshBtn} onPress={fetchAll} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <>
                            <Icon name="refresh" size={16} color={colors.white} />
                            <Text style={s.refreshBtnText}>Actualizar</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {loading && !resumen && (
                <View style={s.loadingBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={s.loadingText}>Cargando estadísticas...</Text>
                </View>
            )}

            {/* ── KPI Cards ── */}
            {resumen && (
                <View style={[s.kpiGrid, isMobile && s.kpiGridMobile]}>
                    <KpiCard icon="cash" label="Total Ventas" value={formatCurrency(resumen.totalVentas)} color="#22c55e" />
                    <KpiCard icon="trending-up" label="Balance Neto" value={formatCurrency(resumen.balanceNeto)} color="#3b82f6" />
                    <KpiCard icon="cart-outline" label="Ticket Promedio" value={formatCurrency(resumen.ticketPromedio)} color="#a855f7" />
                    <KpiCard icon="clipboard-list-outline" label="Órdenes" value={String(resumen.ordenes)} color={colors.primary} />
                    <KpiCard icon="close-circle-outline" label="Cancelaciones" value={`${resumen.cancelados} (${resumen.tasaCancelacion}%)`} color="#ef4444" />
                </View>
            )}

            {/* ── Charts ── */}
            <View style={[s.chartsGrid, isMobile && s.chartsGridMobile]}>
                {/* Top Productos */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <Icon name="trophy-outline" size={18} color={colors.primary} />
                        <Text style={s.cardTitle}>Top Productos</Text>
                    </View>
                    {productosTop.length > 0 ? productosTop.map((p, i) => (
                        <HBar key={p.producto} label={p.producto} value={p.totalVendido} max={maxProducto} rank={i + 1} color={colors.primary} />
                    )) : <Text style={s.emptyText}>Sin datos</Text>}
                </View>

                {/* Top Sabores */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <Icon name="pizza" size={18} color="#a855f7" />
                        <Text style={s.cardTitle}>Top Sabores Pizza</Text>
                    </View>
                    {saboresTop.length > 0 ? saboresTop.map((sb, i) => (
                        <HBar key={sb.sabor} label={sb.sabor} value={sb.cantidad} max={maxSabor} rank={i + 1} color="#a855f7" />
                    )) : <Text style={s.emptyText}>Sin datos</Text>}
                </View>

                {/* Ventas por Hora */}
                <View style={[s.card, s.hourlyCard]}>
                    <View style={s.cardHeader}>
                        <Icon name="clock-outline" size={18} color="#3b82f6" />
                        <Text style={s.cardTitle}>Ventas por Hora (Rango)</Text>
                    </View>
                    {ventasHora.length > 0 ? (
                        <View style={s.vBarChart}>
                            {ventasHoraFull.map((v) => {
                                const pct = maxVentaHora > 0 ? (v.cantidad / maxVentaHora) * 100 : 0;
                                return (
                                    <View key={v.hora} style={s.vBarCol}>
                                        <Text style={s.vBarValue}>{v.cantidad}</Text>
                                        <View style={s.vBarTrack}>
                                            <View style={[s.vBarFill, { height: v.cantidad > 0 ? `${Math.max(pct, 2)}%` : '0%' }]} />
                                        </View>
                                        <Text style={s.vBarLabel}>{v.hora}h</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : <Text style={s.emptyText}>Sin ventas hoy</Text>}
                </View>

                {/* Métodos de Pago */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <Icon name="credit-card-outline" size={18} color={colors.warning} />
                        <Text style={s.cardTitle}>Métodos de Pago</Text>
                    </View>
                    {metodos.length > 0 ? metodos.map((m) => (
                        <View key={m.metodo} style={s.metodoRow}>
                            <View style={s.metodoInfo}>
                                <Text style={s.metodoName}>{m.metodo}</Text>
                                <Text style={s.metodoCount}>{m.cantidad} facturas</Text>
                            </View>
                            <View style={s.metodoBarTrack}>
                                <View style={[s.metodoBarFill, { width: `${m.porcentaje}%` }]} />
                            </View>
                            <View style={s.metodoStatsRow}>
                                <Text style={s.metodoTotal}>{formatCurrency(m.total)}</Text>
                                <Text style={s.metodoPct}>{m.porcentaje}%</Text>
                            </View>
                        </View>
                    )) : <Text style={s.emptyText}>Sin datos</Text>}
                </View>

                {/* Ventas por Día */}
                <View style={[s.card, !isMobile && s.cardWide]}>
                    <View style={s.cardHeader}>
                        <Icon name="trending-up" size={18} color="#22c55e" />
                        <Text style={s.cardTitle}>Ventas por Día</Text>
                    </View>
                    {ventasDia.length > 0 ? (
                        <View style={s.vBarChart}>
                            {ventasDia.map((v) => {
                                const pct = maxVentaDia > 0 ? (v.total / maxVentaDia) * 100 : 0;
                                const label = formatDayLabel(v.fecha);
                                return (
                                    <View key={v.fecha} style={s.vBarCol}>
                                        <Text style={[s.vBarValue, { fontSize: 7 }]}>{formatCurrency(v.total)}</Text>
                                        <View style={s.vBarTrack}>
                                            <View style={[s.vBarFillGreen, { height: `${pct}%` }]} />
                                        </View>
                                        <Text style={s.vBarLabel}>{label}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    ) : <Text style={s.emptyText}>Sin datos</Text>}
                </View>

                {/* Clientes Frecuentes */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <Icon name="account-group-outline" size={18} color={colors.primary} />
                        <Text style={s.cardTitle}>Clientes Frecuentes</Text>
                    </View>
                    {clientesFrec.length > 0 ? clientesFrec.map((c, i) => (
                        <View key={c.clienteNombre} style={s.clienteRow}>
                            <View style={[s.rankBadge, i === 0 && s.rank1, i === 1 && s.rank2, i === 2 && s.rank3]}>
                                <Text style={s.rankBadgeText}>{i + 1}</Text>
                            </View>
                            <View style={s.clienteInfo}>
                                <Text style={s.clienteName} numberOfLines={1}>{c.clienteNombre}</Text>
                                <Text style={s.clienteDetail}>{c.totalOrdenes} órdenes · {formatCurrency(c.gastoTotal)}</Text>
                            </View>
                        </View>
                    )) : <Text style={s.emptyText}>Sin datos</Text>}
                </View>
            </View>

            {/* Bottom spacing for Android nav */}
            {isMobile && <View style={{ height: 80 }} />}
        </ScrollView>
    );
}

