import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { VentaHora, ResumenPeriodo } from '../services/api';
import type { Orden } from '../types/models';
import {
    PlusCircle, ClipboardList, Scale, Clock,
    TrendingUp, ShoppingCart, DollarSign, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function formatCurrency(n: number) {
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
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
    if (mins < 1) return 'Ahora mismo';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
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

export function DashboardPage() {
    const { user } = useAuth();
    const [clock, setClock] = useState('');
    const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
    const [ventasHora, setVentasHora] = useState<VentaHora[]>([]);
    const [ordenes, setOrdenes] = useState<Orden[]>([]);
    const [pendientes, setPendientes] = useState(0);
    const [sinPagar, setSinPagar] = useState(0);
    const [completadas, setCompletadas] = useState(0);

    // Clock
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setClock(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
        };
        tick();
        const id = setInterval(tick, 30000);
        return () => clearInterval(id);
    }, []);

    const fetchData = useCallback(async () => {
        const hoy = todayStr();
        try {
            const [r, vh, ords, facts] = await Promise.allSettled([
                api.estadisticas.resumenPeriodo(hoy, hoy),
                api.estadisticas.ventasPorHora(hoy),
                api.ordenes.getDay(),
                api.facturas.getDay(),
            ]);

            if (r.status === 'fulfilled') setResumen(r.value);
            if (vh.status === 'fulfilled') setVentasHora(vh.value);

            const ordData = ords.status === 'fulfilled' ? ords.value : [];
            const factsData = facts.status === 'fulfilled' ? facts.value : [];
            const resumenApi = r.status === 'fulfilled' ? r.value : null;
            setResumen(buildResumenFallback(ordData, factsData, resumenApi));

            if (ords.status === 'fulfilled') {
                const sorted = [...ords.value].sort((a, b) =>
                    new Date(b.fechaOrden).getTime() - new Date(a.fechaOrden).getTime()
                );
                setOrdenes(sorted.slice(0, 8));
                setPendientes(ords.value.filter(o => o.estadoOrden === 'pendiente').length);
                setCompletadas(ords.value.filter(o => isCompletedEstado(o.estadoOrden)).length);
            }

            if (facts.status === 'fulfilled') {
                setSinPagar(facts.value.filter(f => f.estado === 'pendiente').length);
            }
        } catch (err) {
            console.error('Dashboard fetch error', err);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void fetchData();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchData]);

    // Auto refresh every 60s
    useEffect(() => {
        const id = setInterval(fetchData, 60000);
        return () => clearInterval(id);
    }, [fetchData]);

    const ventasHoraFull = normalizeHourlySeries(ventasHora);
    const maxHora = Math.max(...ventasHoraFull.map(v => v.cantidad), 1);
    const userName = user && (user as any).name ? String((user as any).name) : 'Cajero';

    return (
        <div className="page-container">
            {/* ── Welcome Banner ── */}
            <div className="dashboard-welcome">
                <div className="dashboard-welcome-text">
                    <h2>{getGreeting()}, {userName} 👋</h2>
                    <p>Resumen del día — {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="dashboard-clock">{clock}</div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="quick-actions">
                <Link to="/crear-orden" className="quick-action-btn">
                    <PlusCircle size={18} /> Crear Orden
                </Link>
                <Link to="/ordenes" className="quick-action-btn">
                    <ClipboardList size={18} /> Pendientes
                </Link>
                <Link to="/balance-fechas" className="quick-action-btn">
                    <Scale size={18} /> Balance
                </Link>
                <Link to="/estadisticas" className="quick-action-btn">
                    <TrendingUp size={18} /> Estadísticas
                </Link>
            </div>

            {/* ── Status Cards ── */}
            <div className="status-row">
                <Link to="/ordenes" className="status-card">
                    <div className={`status-dot ${pendientes > 0 ? 'red' : 'green'}`} />
                    <div className="status-info">
                        <div className="status-count">{pendientes}</div>
                        <div className="status-label">Pendientes</div>
                    </div>
                    <ChevronRight size={16} className="status-arrow" />
                </Link>
                <Link to="/facturas" className="status-card">
                    <div className={`status-dot ${sinPagar > 0 ? 'yellow' : 'green'}`} />
                    <div className="status-info">
                        <div className="status-count">{sinPagar}</div>
                        <div className="status-label">Facturas Sin Pagar</div>
                    </div>
                    <ChevronRight size={16} className="status-arrow" />
                </Link>
                <div className="status-card" style={{ cursor: 'default' }}>
                    <div className="status-dot green" />
                    <div className="status-info">
                        <div className="status-count">{completadas}</div>
                        <div className="status-label">Completadas Hoy</div>
                    </div>
                </div>
            </div>

            {/* ── KPI Mini Row ── */}
            {resumen && (
                <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
                    <div className="kpi-card kpi-ventas">
                        <div className="kpi-icon"><DollarSign size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-label">Ventas Hoy</span>
                            <span className="kpi-value">{formatCurrency(resumen.totalVentas)}</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-ticket">
                        <div className="kpi-icon"><ShoppingCart size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-label">Ticket Promedio</span>
                            <span className="kpi-value">{formatCurrency(resumen.ticketPromedio)}</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-ordenes">
                        <div className="kpi-icon"><ShoppingCart size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-label">Total Órdenes</span>
                            <span className="kpi-value">{resumen.ordenes}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Chart + Recent ── */}
            <div className="dashboard-grid">
                {/* Ventas por hora */}
                <div className="dashboard-card dashboard-card-hourly">
                    <h3 className="dashboard-card-title"><Clock size={18} /> Actividad por Hora</h3>
                    {ventasHora.length > 0 ? (
                        <div className="mini-hour-chart">
                            {ventasHoraFull.map(v => (
                                <div key={v.hora} className="mini-hour-col">
                                    <div className="mini-hour-track">
                                        <div
                                            className="mini-hour-fill"
                                            style={{ height: v.cantidad > 0 ? `${Math.max((v.cantidad / maxHora) * 100, 2)}%` : '0%' }}
                                        />
                                    </div>
                                    <span className="mini-hour-label">{v.hora}h</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>Sin actividad aún</p>
                    )}
                </div>

                {/* Órdenes recientes */}
                <div className="dashboard-card">
                    <h3 className="dashboard-card-title"><ClipboardList size={18} /> Órdenes Recientes</h3>
                    <div className="recent-orders-list">
                        {ordenes.map(o => (
                            <Link key={o.ordenId} to={`/ordenes/${o.ordenId}`} className="recent-order-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                                <span className="recent-order-id">#{o.ordenId}</span>
                                <div className="recent-order-detail">
                                    <div className="recent-order-name">{getOrdenDisplayName(o)}</div>
                                    <div className="recent-order-time">{timeAgo(o.fechaOrden)}</div>
                                </div>
                                <span className={`order-estado-badge ${o.estadoOrden?.replace(' ', '-')}`}>
                                    {o.estadoOrden}
                                </span>
                            </Link>
                        ))}
                        {ordenes.length === 0 && <p className="text-muted" style={{ textAlign: 'center' }}>Sin órdenes hoy</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
