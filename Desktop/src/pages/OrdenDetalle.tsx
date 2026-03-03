import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import { getEstadoColor } from '../utils/estados';
import { useToast } from '../contexts/ToastContext';
import * as Dialog from '@radix-ui/react-dialog';
import {
    ClipboardList,
    ArrowLeft,
    Copy,
    XOctagon,
    Info,
    Tag,
    User,
    Phone,
    MapPin,
    CreditCard,
    Flag,
    Calendar,
    Truck,
    MessageSquare,
    FileText,
    Utensils,
    Palette,
    AlertCircle
} from 'lucide-react';
import {
    FacturaVenta,
    Domicilio as BaseDomicilio,
    OrdenProducto as BaseOrdenProducto,
    Producto,
    ProductoVariante
} from '../types/models';

type Domicilio = BaseDomicilio & {
    costoDomicilio?: number;
};

type Factura = FacturaVenta & {
    clienteNombre?: string;
    descripcion?: string;
};

export type OrdenProducto = BaseOrdenProducto & {
    productoObj?: Producto;
    variante?: ProductoVariante;
    tipo?: string;
    tamano?: string;
    sabor1?: string;
    sabor2?: string;
    sabor3?: string;
    sabor4?: string;
};

export interface OrdenDetalle {
    ordenId: number;
    tipoPedido?: string;
    estadoOrden?: string;
    fechaOrden?: string;
    observaciones?: string;
    factura?: Factura;
    productos?: OrdenProducto[];
    domicilios?: Domicilio[];
}

function normalizeOrdenDetalle(ordenData: unknown): OrdenDetalle {
    const normalized = ordenData as OrdenDetalle;
    if (!Array.isArray(normalized.productos)) {
        normalized.productos = [];
    }
    return normalized;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

export function OrdenDetallePage() {
    const { ordenId } = useParams<{ ordenId: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [orden, setOrden] = useState<OrdenDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [canceling, setCanceling] = useState(false);

    useEffect(() => {
        if (!ordenId) {
            setError('ID de orden no proporcionado');
            setLoading(false);
            return;
        }

        const fetchOrden = async () => {
            try {
                const ordenData = await api.ordenes.getById(Number(ordenId));
                setOrden(normalizeOrdenDetalle(ordenData));
            } catch (error: unknown) {
                setError(getErrorMessage(error, 'Error cargando orden'));
            } finally {
                setLoading(false);
            }
        };

        fetchOrden();
    }, [ordenId]);

    const getProductName = (p: OrdenProducto) => {
        if (p.producto) return p.producto;
        const baseName = p.productoObj?.productoNombre;
        const varianteName = p.variante?.nombre;
        if (baseName && varianteName) return `${baseName} — ${varianteName}`;
        if (baseName) return baseName;
        const parts = [];
        if (p.tipo) parts.push(p.tipo);
        if (p.tamano) parts.push(p.tamano);
        return parts.length > 0 ? parts.join(' ') : 'Producto sin nombre';
    };

    const getUnitPrice = (p: OrdenProducto): number | null => {
        if (p.precioUnitario != null) return Number(p.precioUnitario);
        if (p.variante?.precio != null) return Number(p.variante.precio);
        return null;
    };

    const getProductDetails = (p: OrdenProducto) => {
        const flavors = [p.sabor1, p.sabor2, p.sabor3, p.sabor4].filter(Boolean);
        return flavors.length > 0 ? flavors.join(' / ') : null;
    };

    const handleCopy = async () => {
        if (!orden) return;
        const productLines = (orden.productos || []).map((p: OrdenProducto) => {
            const name = getProductName(p);
            const qty = p.cantidad || 1;
            const details = getProductDetails(p);
            const price = getUnitPrice(p);
            let line = `${qty} ${name}`;
            if (details) line += `  ${details}`;
            if (price != null) line += `  $${formatCurrency(price * qty)}`;
            return line;
        });

        const textoACopiar = [
            `Cliente: ${orden.factura?.clienteNombre || 'Sin nombre'}`,
            orden.domicilios?.[0]?.telefono ? `Teléfono: ${orden.domicilios[0].telefono}` : '',
            orden.domicilios?.[0]?.direccionEntrega ? `Dirección: ${orden.domicilios[0].direccionEntrega}` : '',
            productLines.length > 0 ? `Productos:\n${productLines.join('\n')}` : '',
            `Método de pago: ${orden.factura?.metodo || 'No especificado'}`,
            orden.factura?.total != null ? `Total: $${formatCurrency(Number(orden.factura.total))}` : '',
        ]
            .filter(Boolean)
            .join('\n');

        try {
            await navigator.clipboard.writeText(textoACopiar);
            showToast('Datos copiados al portapapeles', 'success');
        } catch {
            showToast('No se pudo copiar', 'error');
        }
    };

    const handleCancelOrder = async () => {
        if (!orden) return;

        setCanceling(true);
        try {
            await api.ordenes.cancel(orden.ordenId);
            showToast('Orden cancelada exitosamente', 'success');
            setShowCancelModal(false);

            // Refresh order data
            const ordenData = await api.ordenes.getById(Number(ordenId));
            setOrden(normalizeOrdenDetalle(ordenData));
        } catch (error: unknown) {
            showToast(getErrorMessage(error, 'Error al cancelar la orden'), 'error');
        } finally {
            setCanceling(false);
        }
    };

    const canCancelOrder = () => {
        if (!orden) return false;
        const estado = orden.estadoOrden?.toLowerCase();
        return estado === 'pendiente' || estado === 'en preparación' || estado === 'preparacion';
    };

    if (loading) {
        return (
            <div className="page-container flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center text-muted">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p>Cargando detalles de la orden...</p>
                </div>
            </div>
        );
    }

    if (error || !orden) {
        return (
            <div className="page-container flex flex-col items-center justify-center min-h-[50vh]">
                <AlertCircle size={48} className="text-danger mb-4" />
                <h2 className="text-xl font-bold mb-2">Orden no encontrada</h2>
                <p className="text-muted mb-6">{error || 'No se pudo cargar la información de la orden.'}</p>
                <button className="btn-primary" onClick={() => navigate('/ordenes-todas')}>
                    <ArrowLeft size={16} className="mr-2 inline" /> Volver al Historial
                </button>
            </div>
        );
    }

    const ec = getEstadoColor(orden.estadoOrden);

    return (
        <div className="page-container">
            <header className="page-header items-center pb-2 border-b border-border">
                <div className="flex flex-col">
                    <button className="text-primary text-sm font-medium hover:underline flex items-center mb-2" onClick={() => navigate(-1)}>
                        <ArrowLeft size={14} className="mr-1" /> Volver
                    </button>
                    <h1 className="page-title !mb-0 flex items-center">
                        <ClipboardList className="mr-3 text-primary" size={28} />
                        Orden #{orden.ordenId}
                    </h1>
                </div>

                <div className="header-actions flex gap-2">
                    {canCancelOrder() && (
                        <button
                            type="button"
                            className="btn-danger flex items-center"
                            onClick={() => setShowCancelModal(true)}
                        >
                            <XOctagon size={16} className="mr-1" /> Cancelar
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn-outline flex items-center"
                        onClick={handleCopy}
                    >
                        <Copy size={16} className="mr-1" /> Copiar Info
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                {/* ── INFO GENERAL COLUMN ── */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="pos-card p-5">
                        <h3 className="section-title text-primary border-b border-border pb-2 mb-4">
                            <Info size={18} /> Información General
                        </h3>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-start">
                                <Tag size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                <div>
                                    <span className="text-xs text-muted block">Tipo de Pedido</span>
                                    <span className="font-medium text-sm text-text capitalize">{orden.tipoPedido || 'No especificado'}</span>
                                </div>
                            </div>

                            {orden.factura?.clienteNombre && (
                                <div className="flex items-start">
                                    <User size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Cliente</span>
                                        <span className="font-medium text-sm text-text">{orden.factura.clienteNombre}</span>
                                    </div>
                                </div>
                            )}

                            {orden.domicilios?.[0]?.telefono && (
                                <div className="flex items-start">
                                    <Phone size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Teléfono</span>
                                        <span className="font-medium text-sm text-text">{orden.domicilios[0].telefono}</span>
                                    </div>
                                </div>
                            )}

                            {orden.domicilios?.[0]?.direccionEntrega && (
                                <div className="flex items-start">
                                    <MapPin size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Dirección</span>
                                        <span className="font-medium text-sm text-text">{orden.domicilios[0].direccionEntrega}</span>
                                    </div>
                                </div>
                            )}

                            {orden.factura?.metodo && (
                                <div className="flex items-start">
                                    <CreditCard size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Método de Pago</span>
                                        <span className="font-medium text-sm text-text uppercase">{orden.factura.metodo}</span>
                                    </div>
                                </div>
                            )}

                            {orden.estadoOrden && (
                                <div className="flex items-center">
                                    <Flag size={16} className="text-muted mr-3 shrink-0" />
                                    <span className="text-xs text-muted mr-2">Estado:</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase`} style={{ backgroundColor: ec.bg, color: ec.text }}>
                                        {orden.estadoOrden}
                                    </span>
                                </div>
                            )}

                            {orden.fechaOrden && (
                                <div className="flex items-start">
                                    <Calendar size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Fecha de Orden</span>
                                        <span className="font-medium text-sm text-text">{formatDate(orden.fechaOrden)}</span>
                                    </div>
                                </div>
                            )}

                            {orden.domicilios?.[0]?.costoDomicilio != null && (
                                <div className="flex items-start">
                                    <Truck size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Costo Domicilio</span>
                                        <span className="font-medium text-sm text-text">${formatCurrency(orden.domicilios[0].costoDomicilio)}</span>
                                    </div>
                                </div>
                            )}

                            {orden.observaciones && (
                                <div className="flex items-start">
                                    <MessageSquare size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Observaciones</span>
                                        <span className="text-sm text-text italic">{orden.observaciones}</span>
                                    </div>
                                </div>
                            )}

                            {orden.factura?.descripcion && (
                                <div className="flex items-start">
                                    <FileText size={16} className="text-muted mt-0.5 mr-3 shrink-0" />
                                    <div>
                                        <span className="text-xs text-muted block">Notas Adicionales</span>
                                        <span className="text-sm text-text italic">{orden.factura.descripcion}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── PRODUCTOS COLUMN ── */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="pos-card p-0 overflow-hidden">
                        <div className="p-5 border-b border-border bg-surface">
                            <h3 className="section-title text-primary m-0">
                                <Utensils size={18} /> Detalle de Productos
                            </h3>
                        </div>

                        <div className="p-0">
                            {orden.productos && orden.productos.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {orden.productos.map((p: OrdenProducto, index: number) => {
                                        const price = getUnitPrice(p);
                                        const details = getProductDetails(p);
                                        return (
                                            <div key={index} className="flex flex-col sm:flex-row p-4 hover:bg-surface/50 transition-colors gap-4">
                                                <div className="flex items-center justify-center bg-primary-light text-primary font-bold h-8 w-8 rounded shrink-0">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-text text-[1.05rem]">{getProductName(p)}</h4>
                                                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-surface-dark rounded text-xs font-semibold text-text-secondary">
                                                                Cant: {p.cantidad || 1}
                                                            </span>
                                                        </div>
                                                        {price != null && (
                                                            <div className="text-right">
                                                                <span className="block text-xl font-extrabold text-primary">
                                                                    ${formatCurrency(price * Number(p.cantidad || 1))}
                                                                </span>
                                                                <span className="text-xs text-muted block">
                                                                    ${formatCurrency(price)} c/u
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {details && (
                                                        <div className="flex items-start mt-2 text-sm text-text-secondary">
                                                            <Palette size={14} className="mt-0.5 mr-1.5 shrink-0 text-secondary" />
                                                            <span>{details}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 flex flex-col items-center justify-center text-muted">
                                    <Utensils size={48} className="mb-4 opacity-50" />
                                    <p>No se encontraron productos en esta orden.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── TOTALES ── */}
                    {orden.factura?.total != null && (
                        <div className="pos-card p-6 bg-surface border-2 border-primary/20">
                            {orden.domicilios?.[0]?.costoDomicilio != null && orden.domicilios[0].costoDomicilio > 0 && (
                                <div className="mb-3 pb-3 border-b border-border/50">
                                    <div className="flex justify-between text-sm text-muted mb-1">
                                        <span>Subtotal Productos</span>
                                        <span>${formatCurrency(Number(orden.factura.total) - Number(orden.domicilios[0].costoDomicilio))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-muted">
                                        <span>Costo Domicilio</span>
                                        <span>${formatCurrency(Number(orden.domicilios[0].costoDomicilio))}</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-gradient-to-r from-primary-light to-transparent p-4 rounded-lg -mx-4 -mb-4 mt-2">
                                <span className="text-lg font-bold text-text uppercase tracking-wide">Total a Pagar</span>
                                <span className="text-3xl font-black text-primary drop-shadow-sm">
                                    ${formatCurrency(Number(orden.factura.total))}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── CANCELAR MODAL ── */}
            <Dialog.Root open={showCancelModal} onOpenChange={setShowCancelModal}>
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title text-danger flex items-center">
                            <AlertCircle size={20} className="mr-2 inline" /> Cancelar Orden
                        </Dialog.Title>
                        <Dialog.Description className="dialog-description mt-2">
                            ¿Estás seguro de cancelar la orden <strong>#{orden.ordenId}</strong>?
                            <br /><br />Esta acción cambiará el estado de la misma a "Cancelado" y afectará los reportes.
                        </Dialog.Description>
                        <div className="dialog-actions mt-6 border-t border-border pt-4">
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setShowCancelModal(false)}
                                disabled={canceling}
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={handleCancelOrder}
                                disabled={canceling}
                            >
                                {canceling ? 'Cancelando...' : 'Sí, Cancelar Orden'}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

        </div>
    );
}
