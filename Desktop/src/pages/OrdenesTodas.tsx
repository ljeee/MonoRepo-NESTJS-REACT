import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Orden, PaginatedResponse } from '../types/models';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import {
    ClipboardList,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Tag,
    AlertCircle
} from 'lucide-react';

const LIMIT = 20;

const FILTER_ESTADOS = [
    { value: '', label: 'Todas' },
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'completada', label: 'Completada' },
    { value: 'cancelado', label: 'Cancelado' }
];

type OrdenesQueryParams = {
    page: number;
    limit: number;
    estado?: string;
    from?: string;
    to?: string;
};

// Utils 
function getOrdenTotal(orden: Orden): number {
    if (typeof orden.factura?.totalFactura === 'number') {
        return orden.factura.totalFactura;
    }
    if (typeof orden.factura?.total === 'number') {
        return orden.factura.total;
    }
    return (
        orden.productos?.reduce(
            (sum, producto) => sum + (producto.precioUnitario ?? 0) * (producto.cantidad ?? 1),
            0,
        ) ?? 0
    );
}

function getProductoPreviewName(producto: NonNullable<Orden['productos']>[number]): string {
    if (typeof producto.productoNombre === 'string' && producto.productoNombre.trim()) {
        return producto.productoNombre;
    }
    if (typeof producto.producto === 'string' && producto.producto.trim()) {
        return producto.producto;
    }
    return 'Producto';
}

function getEstadoColorClass(estado?: string) {
    switch (estado) {
        case 'pendiente': return 'badge-warning';
        case 'entregado':
        case 'completada': return 'badge-success';
        case 'cancelado': return 'badge-danger';
        default: return 'badge-info';
    }
}

export function OrdenesTodasPage() {
    const navigate = useNavigate();

    const [page, setPage] = useState(1);
    const [estado, setEstado] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const [result, setResult] = useState<PaginatedResponse<Orden> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchData = useCallback(
        async (p: number) => {
            setLoading(true);
            setError('');
            try {
                const params: OrdenesQueryParams = { page: p, limit: LIMIT };
                if (estado) params.estado = estado;
                if (from) params.from = from;
                if (to) params.to = to;
                const data = await api.ordenes.getAll(params);
                setResult(data);
                setPage(p);
            } catch {
                setError('Error al cargar órdenes');
            } finally {
                setLoading(false);
            }
        },
        [estado, from, to],
    );

    useEffect(() => {
        fetchData(1);
    }, [fetchData]);

    const ordenes = result?.data ?? [];

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <ClipboardList className="page-icon" />
                        Todas las Órdenes
                    </h1>
                    <p className="page-description">Historial completo de pedidos realizados.</p>
                </div>
                <div className="header-actions">
                    <button type="button" className="btn-secondary" onClick={() => fetchData(1)} disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                        <span>Refrescar</span>
                    </button>
                </div>
            </header>

            {/* ── Filtros ── */}
            <div className="pos-card filters-section mb-4">

                {/* Estados */}
                <div className="estados-filters mb-3">
                    <span className="text-sm font-medium mr-2 text-muted">Estado:</span>
                    <div className="flex gap-2 flex-wrap">
                        {FILTER_ESTADOS.map((e) => (
                            <button
                                key={e.value}
                                onClick={() => setEstado(e.value)}
                                className={`filter-chip ${estado === e.value ? 'active' : ''}`}
                            >
                                {e.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fechas */}
                <div className="date-filters flex gap-4 flex-wrap">
                    <div className="form-group flex-1 min-w-[150px]">
                        <label className="text-xs text-muted mb-1 block">Desde</label>
                        <div className="input-with-icon">
                            <Calendar size={14} />
                            <input
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="form-group flex-1 min-w-[150px]">
                        <label className="text-xs text-muted mb-1 block">Hasta</label>
                        <div className="input-with-icon">
                            <Calendar size={14} />
                            <input
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="flex items-end flex-initial">
                        <button type="button" className="btn-primary" onClick={() => fetchData(1)}>
                            <Search size={16} /> Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Paginación Superior */}
            {result && (
                <div className="pagination-bar mb-4 flex justify-between items-center text-sm">
                    <span className="text-muted">
                        {result.total} órdenes encontradas
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            className="btn-icon border border-border bg-surface"
                            disabled={page <= 1}
                            onClick={() => page > 1 && fetchData(page - 1)}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="font-medium px-2">
                            {result.page} / {result.totalPages}
                        </span>
                        <button
                            className="btn-icon border border-border bg-surface"
                            disabled={page >= (result?.totalPages ?? 1)}
                            onClick={() => page < (result?.totalPages ?? 1) && fetchData(page + 1)}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Lista de Órdenes ── */}
            {error && (
                <div className="error-alert mb-4">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {loading && !ordenes.length && (
                <div className="loading-state">
                    <RefreshCw size={32} className="spinning text-muted mb-2" />
                    <p>Cargando órdenes...</p>
                </div>
            )}

            {!loading && !error && ordenes.length === 0 && (
                <div className="empty-state pos-card">
                    <ClipboardList size={48} className="text-muted mb-3" />
                    <h3>No se encontraron órdenes</h3>
                    <p className="text-muted">Intenta ajustando los filtros de búsqueda.</p>
                </div>
            )}

            {!loading && ordenes.length > 0 && (
                <div className="ordenes-grid">
                    {ordenes.map(orden => {
                        const total = getOrdenTotal(orden);
                        return (
                            <div
                                key={orden.ordenId}
                                className="orden-card pos-card clickable mb-4"
                                onClick={() => navigate(`/orden-detalle?ordenId=${orden.ordenId}`)}
                            >
                                <div className="orden-card-header flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="orden-id text-lg font-bold">#{orden.ordenId}</span>
                                        <span className={`badge ${getEstadoColorClass(orden.estadoOrden)} uppercase text-[0.65rem]`}>
                                            {orden.estadoOrden || 'N/A'}
                                        </span>
                                    </div>
                                    <span className="orden-total text-lg font-extrabold text-primary">
                                        ${formatCurrency(total)}
                                    </span>
                                </div>

                                <div className="orden-meta flex gap-4 mb-3 text-sm text-muted">
                                    <div className="flex items-center gap-1">
                                        <Tag size={14} />
                                        <span className="capitalize">{orden.tipoPedido}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        <span>{formatDate(orden.fechaOrden)}</span>
                                    </div>
                                </div>

                                {orden.productos && orden.productos.length > 0 && (
                                    <div className="orden-products bg-background rounded p-2 text-sm text-text-secondary">
                                        {orden.productos.slice(0, 3).map((p, i) => (
                                            <div key={i} className="py-[2px]">
                                                • {p.cantidad}x {getProductoPreviewName(p)}
                                            </div>
                                        ))}
                                        {orden.productos.length > 3 && (
                                            <div className="text-xs text-muted italic mt-1">
                                                +{orden.productos.length - 3} más...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Paginación Inferior */}
            {result && result.totalPages > 1 && (
                <div className="pagination-bar mt-6 flex justify-center items-center gap-4 text-sm pb-8">
                    <button
                        className="btn-outline flex items-center gap-2 px-3 py-1.5"
                        disabled={page <= 1}
                        onClick={() => page > 1 && fetchData(page - 1)}
                    >
                        <ChevronLeft size={16} /> Anterior
                    </button>
                    <span className="font-medium text-muted">
                        Página {page} de {result.totalPages}
                    </span>
                    <button
                        className="btn-outline flex items-center gap-2 px-3 py-1.5"
                        disabled={page >= result.totalPages}
                        onClick={() => page < result.totalPages && fetchData(page + 1)}
                    >
                        Siguiente <ChevronRight size={16} />
                    </button>
                </div>
            )}

        </div>
    );
}
