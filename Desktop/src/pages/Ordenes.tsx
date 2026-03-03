import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Orden, OrdenProducto } from '../types/models';
import { useOrdenesSocket } from '../hooks/use-ordenes-socket';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import { Clock, ChevronRight, CheckCircle } from 'lucide-react';

export function OrdersOfDayPending() {
    const navigate = useNavigate();
    const [ordenes, setOrdenes] = useState<Orden[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('');

    const fetchOrdenes = useCallback(async () => {
        try {
            const data = await api.ordenes.getDay();
            // Mostrar solo órdenes activas (ni entregadas si es domicilio, ni completadas)
            setOrdenes(
                data.filter(
                    (o) =>
                        o.estadoOrden !== 'completada' &&
                        o.estadoOrden !== 'entregado' &&
                        o.estadoOrden !== 'cancelado'
                )
            );
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrdenes();
    }, [fetchOrdenes]);

    const handleCompletarOrden = async (id: number) => {
        try {
            await api.ordenes.update(id, { estadoOrden: 'completada' });
            fetchOrdenes(); // refresh list
        } catch (error) {
            console.error('Error completing order:', error);
        }
    };

    useOrdenesSocket('cajero', fetchOrdenes);

    if (loading) {
        return (
            <div className="orders-loading">
                Cargando órdenes en vivo...
            </div>
        );
    }

    return (
        <div className="orders-page">
            <header className="orders-header">
                <h1 className="orders-title">Órdenes Activas</h1>
                <div className="orders-header-actions">
                    <Link
                        to="/crear-orden"
                        className="orders-pill orders-pill-primary"
                    >
                        + Nueva Orden
                    </Link>
                    <span className="orders-pill orders-pill-muted">
                        En preparación: {ordenes.length}
                    </span>
                </div>
            </header>

            {/* Filter pills */}
            <div className="orders-filters">
                {[
                    { value: '', label: 'Todas' },
                    { value: 'pendiente', label: 'Pendiente' },
                    { value: 'listo_entregar', label: 'Listo' },
                ].map((f) => (
                    <button
                        key={f.value}
                        className={`filter-chip ${filtroEstado === f.value ? 'active' : ''}`}
                        onClick={() => setFiltroEstado(f.value)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {(() => {
                const filtered = filtroEstado
                    ? ordenes.filter((o) => o.estadoOrden === filtroEstado)
                    : ordenes;

                return filtered.length === 0 ? (
                    <div className="orders-empty">
                        <Clock size={48} color="#334155" className="orders-empty-icon" />
                        <h3>No hay órdenes en curso</h3>
                        <p>Las nuevas órdenes enviadas aparecerán aquí automáticamente.</p>
                    </div>
                ) : (
                    <div className="orders-grid-cards">
                        {filtered.map((orden) => (
                            <div key={orden.ordenId} className="orders-card" onClick={() => navigate(`/ordenes/${orden.ordenId}`)} style={{ cursor: 'pointer' }}>
                                <div className="orders-card-header">
                                    <div>
                                        <h3 className="orders-card-title">
                                            Orden #{orden.ordenId}
                                        </h3>
                                        <span className="orders-card-date">{formatDate(orden.fechaOrden)}</span>
                                    </div>
                                    <StatusBadge estado={orden.estadoOrden} tipo={orden.tipoPedido} mesa={orden.mesa} />
                                </div>

                                <div className="orders-card-body">
                                    <div className="orders-customer">
                                        <TextLabel label="Cliente" value={orden.tipoPedido === 'mesa' ? `Mesa ${orden.mesa}` : orden.nombreCliente || 'Sin Nombre'} />
                                        {orden.telefonoCliente && <TextLabel label="Teléfono" value={orden.telefonoCliente} />}
                                    </div>

                                    <div className="orders-products">
                                        {orden.productos?.map((p, i) => (
                                            <div key={i} className="orders-product-row">
                                                <span className="orders-product-name">
                                                    {p.cantidad}x{' '}
                                                    {getProductoNombre(p)}
                                                </span>
                                                <span className="orders-product-price">
                                                    ${formatCurrency((p.precioUnitario || 0) * (p.cantidad || 1))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="orders-card-footer">
                                    <div>
                                        <span className="orders-total-label">Total a pagar</span>
                                        <span className="orders-total-value">${formatCurrency(getOrdenTotal(orden))}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            className="orders-manage-btn"
                                            style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#10b981' }}
                                            onClick={() => handleCompletarOrden(orden.ordenId)}
                                            aria-label={`Completar orden ${orden.ordenId}`}
                                        >
                                            Completar
                                            <CheckCircle size={16} />
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
                );
            })()}
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

function TextLabel({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-label">
            <span className="text-label-key">{label}:</span>
            <span className="text-label-value">{value}</span>
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
