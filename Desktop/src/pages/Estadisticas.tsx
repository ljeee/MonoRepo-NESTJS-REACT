import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type {
    ProductoTop, SaborTop, VentaDia,
    MetodoPago, ResumenPeriodo, ClienteFrecuente, VentaHora,
} from '../services/api';
import {
    BarChart3, TrendingUp, TrendingDown, DollarSign,
    ShoppingCart, Users, XCircle, RefreshCw,
    Award, Pizza, CreditCard, Clock
} from 'lucide-react';
import '../styles/estadisticas.css';

function formatCurrency(n: number) {
    return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
}

function getDefaultDateRange(): { from: string; to: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return {
        from: `${y}-${m}-01`,
        to: `${y}-${m}-${d}`,
    };
}

function today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function EstadisticasPage() {
    const defaults = getDefaultDateRange();
    const [from, setFrom] = useState(defaults.from);
    const [to, setTo] = useState(defaults.to);
    const [loading, setLoading] = useState(true);

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
                api.estadisticas.ventasPorHora(today()),
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

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const maxProducto = productosTop[0]?.totalVendido || 1;
    const maxSabor = saboresTop[0]?.cantidad || 1;
    const maxVentaHora = Math.max(...ventasHora.map(v => v.cantidad), 1);
    const maxVentaDia = Math.max(...ventasDia.map(v => v.total), 1);

    return (
        <div className="page-container stats-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <BarChart3 className="page-icon" />
                        Estadísticas
                    </h1>
                    <p className="page-description">Análisis del negocio en tiempo real</p>
                </div>
                <div className="header-actions stats-controls">
                    <div className="date-range-picker">
                        <label>Desde</label>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div className="date-range-picker">
                        <label>Hasta</label>
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <button className="btn-primary" onClick={fetchAll} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                        {loading ? 'Cargando...' : 'Actualizar'}
                    </button>
                </div>
            </header>

            {/* ── KPI Cards ── */}
            {resumen && (
                <div className="kpi-grid">
                    <div className="kpi-card kpi-ventas">
                        <div className="kpi-icon"><DollarSign size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-label">Total Ventas</span>
                            <span className="kpi-value">{formatCurrency(resumen.totalVentas)}</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-balance">
                        <div className="kpi-icon">{resumen.balanceNeto >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}</div>
                        <div className="kpi-content">
                            <span className="kpi-label">Balance Neto</span>
                            <span className="kpi-value">{formatCurrency(resumen.balanceNeto)}</span>
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
                            <span className="kpi-label">Órdenes</span>
                            <span className="kpi-value">{resumen.ordenes}</span>
                        </div>
                    </div>
                    <div className="kpi-card kpi-cancelados">
                        <div className="kpi-icon"><XCircle size={24} /></div>
                        <div className="kpi-content">
                            <span className="kpi-label">Cancelaciones</span>
                            <span className="kpi-value">{resumen.cancelados} <small>({resumen.tasaCancelacion}%)</small></span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Charts Grid ── */}
            <div className="stats-grid">
                {/* Top Productos */}
                <div className="stats-card">
                    <h3 className="stats-card-title"><Award size={18} /> Top Productos</h3>
                    <div className="bar-chart">
                        {productosTop.map((p, i) => (
                            <div key={p.producto} className="bar-row">
                                <span className="bar-label" title={p.producto}>
                                    <span className="bar-rank">#{i + 1}</span> {p.producto}
                                </span>
                                <div className="bar-track">
                                    <div
                                        className="bar-fill bar-fill-primary"
                                        style={{ width: `${(p.totalVendido / maxProducto) * 100}%` }}
                                    />
                                </div>
                                <span className="bar-value">{p.totalVendido}</span>
                            </div>
                        ))}
                        {productosTop.length === 0 && <p className="text-muted">Sin datos</p>}
                    </div>
                </div>

                {/* Top Sabores */}
                <div className="stats-card">
                    <h3 className="stats-card-title"><Pizza size={18} /> Top Sabores Pizza</h3>
                    <div className="bar-chart">
                        {saboresTop.map((s, i) => (
                            <div key={s.sabor} className="bar-row">
                                <span className="bar-label">
                                    <span className="bar-rank">#{i + 1}</span> {s.sabor}
                                </span>
                                <div className="bar-track">
                                    <div
                                        className="bar-fill bar-fill-accent"
                                        style={{ width: `${(s.cantidad / maxSabor) * 100}%` }}
                                    />
                                </div>
                                <span className="bar-value">{s.cantidad}</span>
                            </div>
                        ))}
                        {saboresTop.length === 0 && <p className="text-muted">Sin datos</p>}
                    </div>
                </div>

                {/* Ventas por Hora (hoy) */}
                <div className="stats-card">
                    <h3 className="stats-card-title"><Clock size={18} /> Ventas por Hora (Hoy)</h3>
                    <div className="hour-chart">
                        {ventasHora.map((v) => (
                            <div key={v.hora} className="hour-bar-col">
                                <span className="hour-value">{v.cantidad}</span>
                                <div className="hour-bar-track">
                                    <div
                                        className="hour-bar-fill"
                                        style={{ height: `${(v.cantidad / maxVentaHora) * 100}%` }}
                                    />
                                </div>
                                <span className="hour-label">{v.hora}h</span>
                            </div>
                        ))}
                        {ventasHora.length === 0 && <p className="text-muted">Sin ventas hoy</p>}
                    </div>
                </div>

                {/* Métodos de Pago */}
                <div className="stats-card">
                    <h3 className="stats-card-title"><CreditCard size={18} /> Métodos de Pago</h3>
                    <div className="metodo-list">
                        {metodos.map((m) => (
                            <div key={m.metodo} className="metodo-row">
                                <div className="metodo-info">
                                    <span className="metodo-name">{m.metodo}</span>
                                    <span className="metodo-count">{m.cantidad} facturas</span>
                                </div>
                                <div className="metodo-bar-track">
                                    <div
                                        className="metodo-bar-fill"
                                        style={{ width: `${m.porcentaje}%` }}
                                    />
                                </div>
                                <div className="metodo-stats">
                                    <span className="metodo-total">{formatCurrency(m.total)}</span>
                                    <span className="metodo-pct">{m.porcentaje}%</span>
                                </div>
                            </div>
                        ))}
                        {metodos.length === 0 && <p className="text-muted">Sin datos</p>}
                    </div>
                </div>

                {/* Ventas por Día */}
                <div className="stats-card stats-card-wide">
                    <h3 className="stats-card-title"><TrendingUp size={18} /> Ventas por Día</h3>
                    <div className="day-chart">
                        {ventasDia.map((v) => {
                            const label = new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
                            return (
                                <div key={v.fecha} className="day-bar-col" title={`${label}: ${formatCurrency(v.total)} (${v.cantidad} órdenes)`}>
                                    <span className="day-value">{formatCurrency(v.total)}</span>
                                    <div className="day-bar-track">
                                        <div
                                            className="day-bar-fill"
                                            style={{ height: `${(v.total / maxVentaDia) * 100}%` }}
                                        />
                                    </div>
                                    <span className="day-label">{label}</span>
                                </div>
                            );
                        })}
                        {ventasDia.length === 0 && <p className="text-muted">Sin datos</p>}
                    </div>
                </div>

                {/* Clientes Frecuentes */}
                <div className="stats-card">
                    <h3 className="stats-card-title"><Users size={18} /> Clientes Frecuentes</h3>
                    <div className="clientes-ranking">
                        {clientesFrec.map((c, i) => (
                            <div key={c.clienteNombre} className="cliente-rank-row">
                                <span className={`rank-badge rank-${i < 3 ? i + 1 : 'default'}`}>
                                    {i + 1}
                                </span>
                                <div className="cliente-rank-info">
                                    <span className="cliente-rank-name">{c.clienteNombre}</span>
                                    <span className="cliente-rank-detail">
                                        {c.totalOrdenes} órdenes · {formatCurrency(c.gastoTotal)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {clientesFrec.length === 0 && <p className="text-muted">Sin datos</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
