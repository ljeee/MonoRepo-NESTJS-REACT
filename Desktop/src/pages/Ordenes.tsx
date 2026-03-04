import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Orden, OrdenProducto } from '../types/models';
import { useOrdenesSocket } from '../hooks/use-ordenes-socket';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import {
    Clock, ChevronRight, CheckCircle, ClipboardList,
    PlusCircle, RefreshCw, MapPin, User, Phone, MessageSquare
} from 'lucide-react';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}

export function OrdersOfDayPending() {
    const navigate = useNavigate();
    const [ordenes, setOrdenes] = useState<Orden[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filtroEstado, setFiltroEstado] = useState('pendiente');

    const fetchOrdenes = useCallback(async () => {
        try {
            const data = await api.ordenes.getDay();
            // Keep ALL day orders — let UI filter chips handle display
            setOrdenes(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrdenes();
    }, [fetchOrdenes]);

    // Timer tick every 30s for live "time ago"
    useEffect(() => {
        const id = setInterval(() => setOrdenes(o => [...o]), 30000);
        return () => clearInterval(id);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchOrdenes();
        setIsRefreshing(false);
    };

    const handleCompletarOrden = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await api.ordenes.update(id, { estadoOrden: 'completada' });
            fetchOrdenes();
        } catch (error) {
            console.error('Error completing order:', error);
        }
    };

    useOrdenesSocket('cajero', fetchOrdenes);

    const filtered = filtroEstado
        ? filtroEstado === 'completada'
            ? ordenes.filter((o) => o.estadoOrden === 'completada' || o.estadoOrden === 'entregado')
            : ordenes.filter((o) => o.estadoOrden === filtroEstado)
        : ordenes;

    const pendientes = ordenes.filter(o => o.estadoOrden === 'pendiente').length;
    const listos = ordenes.filter(o => o.estadoOrden === 'listo_entregar').length;
    const completadasCount = ordenes.filter(o => o.estadoOrden === 'completada' || o.estadoOrden === 'entregado').length;

    if (loading) {
        return (
            <div className="page-container orders-page">
                <div className="loading-state">
                    <RefreshCw size={32} className="spinning text-muted mb-2" />
                    <p>Cargando órdenes en vivo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container orders-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <ClipboardList className="page-icon" />
                        Órdenes Activas
                    </h1>
                    <p className="page-description">
                        Gestiona las órdenes del día en tiempo real.
                        {ordenes.length > 0 && (
                            <span className="text-muted"> — {ordenes.length} en curso</span>
                        )}
                    </p>
                </div>
                <div className="header-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        title="Refrescar"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} />
                    </button>
                    <Link to="/crear-orden" className="btn-primary" style={{ textDecoration: 'none' }}>
                        <PlusCircle size={18} />
                        <span>Nueva Orden</span>
                    </Link>
                </div>
            </header>

            {/* Filter pills */}
            <div className="orders-filters">
                {[
                    { value: '', label: 'Todas', count: ordenes.length },
                    { value: 'pendiente', label: 'Pendiente', count: pendientes },
                    { value: 'listo_entregar', label: 'Listo', count: listos },
                    { value: 'completada', label: 'Completadas', count: completadasCount },
                ].map((f) => (
                    <button
                        key={f.value}
                        className={`filter-chip ${filtroEstado === f.value ? 'active' : ''}`}
                        onClick={() => setFiltroEstado(f.value)}
                    >
                        {f.label}
                        {f.count > 0 && (
                            <span className="filter-chip-count">{f.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="orders-empty">
                    <Clock size={48} className="orders-empty-icon" />
                    <h3>No hay órdenes en curso</h3>
                    <p>Las nuevas órdenes enviadas aparecerán aquí automáticamente.</p>
                </div>
            ) : (
                <div className="orders-grid-cards">
                    {filtered.map((orden) => (
                        <div
                            key={orden.ordenId}
                            className="orders-card"
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/ordenes/${orden.ordenId}`)}
                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/ordenes/${orden.ordenId}`)}
                        >
                            <div className="orders-card-header">
                                <div>
                                    <h3 className="orders-card-title">
                                        Orden #{orden.ordenId}
                                    </h3>
                                    <span className="orders-card-date">
                                        <Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                        {timeAgo(orden.fechaOrden)} — {formatDate(orden.fechaOrden)}
                                    </span>
                                </div>
                                <StatusBadge estado={orden.estadoOrden} tipo={orden.tipoPedido} mesa={orden.mesa} />
                            </div>

                            <div className="orders-card-body">
                                <div className="orders-customer">
                                    <div className="text-label">
                                        <User size={14} style={{ marginRight: 6, opacity: 0.6, flexShrink: 0 }} />
                                        <span className="text-label-value">
                                            {orden.tipoPedido === 'mesa' ? `Mesa ${orden.mesa}` : orden.nombreCliente || 'Sin Nombre'}
                                        </span>
                                    </div>
                                    {orden.telefonoCliente && (
                                        <div className="text-label">
                                            <Phone size={14} style={{ marginRight: 6, opacity: 0.6, flexShrink: 0 }} />
                                            <span className="text-label-value">{orden.telefonoCliente}</span>
                                        </div>
                                    )}
                                    {orden.tipoPedido === 'domicilio' && orden.domicilios?.[0]?.direccionEntrega && (
                                        <div className="text-label">
                                            <MapPin size={14} style={{ marginRight: 6, opacity: 0.6, flexShrink: 0 }} />
                                            <span className="text-label-value">{orden.domicilios[0].direccionEntrega}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="orders-products">
                                    {orden.productos?.map((p) => (
                                        <div key={`${p.producto}-${p.cantidad}`} className="orders-product-row">
                                            <span className="orders-product-name">
                                                {p.cantidad}x{' '}
                                                {getProductoNombre(p)}
                                            </span>
                                            <span className="orders-product-price">
                                                {formatCurrency((p.precioUnitario || 0) * (p.cantidad || 1))}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {orden.observaciones && (
                                    <div className="orders-obs">
                                        <MessageSquare size={14} />
                                        <span>{orden.observaciones}</span>
                                    </div>
                                )}
                            </div>

                            <div className="orders-card-footer">
                                <div>
                                    <span className="orders-total-label">Total a pagar</span>
                                    <span className="orders-total-value">{formatCurrency(getOrdenTotal(orden))}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="orders-complete-btn"
                                        onClick={(e) => handleCompletarOrden(orden.ordenId, e)}
                                        aria-label={`Completar orden ${orden.ordenId}`}
                                    >
                                        <CheckCircle size={16} />
                                        Completar
                                    </button>
                                    <button
                                        className="orders-manage-btn"
                                        aria-label={`Gestionar orden ${orden.ordenId}`}
                                        onClick={(e) => { e.stopPropagation(); navigate(`/ordenes/${orden.ordenId}`); }}
                                    >
                                        Gestionar
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ estado, tipo, mesa }: { estado: string; tipo: string; mesa?: string }) {
    const stateClass = getStatusClassName(estado);

    return (
        <div className="status-badge">
            <span className={`status-badge-state ${stateClass}`}>
                {estado.replace('_', ' ')}
            </span>
            <span className="status-badge-type">
                {tipo} {tipo === 'mesa' && mesa ? `- ${mesa}` : ''}
            </span>
        </div>
    );
}

function getStatusClassName(estado: string): string {
    const map: Record<string, string> = {
        pendiente: 'status-pendiente',
        preparacion: 'status-preparacion',
        listo_entregar: 'status-listo-entregar',
        en_camino: 'status-en-camino',
        completada: 'status-completada',
        cancelado: 'status-cancelado',
    };
    return map[estado] || 'status-default';
}

function getOrdenTotal(orden: Orden): number {
    if (typeof orden.factura?.totalFactura === 'number') {
        return orden.factura.totalFactura;
    }
    if (typeof orden.factura?.total === 'number') {
        return orden.factura.total;
    }
    return (
        orden.productos?.reduce(
            (sum, producto) => sum + (producto.precioUnitario || 0) * (producto.cantidad || 1),
            0
        ) || 0
    );
}

function getProductoNombre(producto: OrdenProducto): string {
    if (producto.productoNombre && producto.productoNombre.trim().length > 0) {
        return producto.productoNombre;
    }

    if (typeof producto.producto === 'string' && producto.producto.trim().length > 0) {
        return producto.producto;
    }

    return 'Producto';
}
