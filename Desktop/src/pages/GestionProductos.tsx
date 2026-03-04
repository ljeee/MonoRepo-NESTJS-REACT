import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useProductos, useProductOperations, Producto, ProductoVariante } from '../hooks/use-productos';
import { usePizzaSabores, useUpdatePizzaSabor, PizzaSabor } from '../hooks/use-pizza-sabores';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/formatNumber';
import * as Dialog from '@radix-ui/react-dialog';
import {
    Package,
    PlusCircle,
    Search,
    RefreshCw,
    Edit,
    Trash2,
    AlertCircle,
    List,
    Pizza,
    Info
} from 'lucide-react';

// --- Subcomponents ---

function SaborModal({
    visible,
    sabor,
    loading,
    onSave,
    onClose
}: {
    visible: boolean;
    sabor: PizzaSabor | null;
    loading: boolean;
    onSave: (id: number, data: any) => void;
    onClose: () => void;
}) {
    const [recargoPequena, setRecargoPequena] = useState(() => String(sabor?.recargoPequena || 0));
    const [recargoMediana, setRecargoMediana] = useState(() => String(sabor?.recargoMediana || 0));
    const [recargoGrande, setRecargoGrande] = useState(() => String(sabor?.recargoGrande || 0));

    if (!sabor) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(sabor.saborId, {
            recargoPequena: Number(recargoPequena),
            recargoMediana: Number(recargoMediana),
            recargoGrande: Number(recargoGrande),
        });
    };

    return (
        <Dialog.Root open={visible} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay" />
                <Dialog.Content className="dialog-content">
                    <Dialog.Title className="dialog-title">
                        <Edit size={20} className="mr-2 inline" />
                        Editar Recargos: {sabor.nombre}
                    </Dialog.Title>
                    <Dialog.Description className="dialog-description mb-4">
                        Ajusta el precio adicional que se cobra por este sabor según el tamaño.
                    </Dialog.Description>

                    <form onSubmit={handleSubmit} className="cliente-form">
                        <div className="form-group mb-3">
                            <label htmlFor="recargo-pequena">Recargo Extra Pequeña</label>
                            <div className="input-with-icon">
                                <span className="text-muted pointer-events-none">$</span>
                                <input
                                    id="recargo-pequena"
                                    type="number"
                                    value={recargoPequena}
                                    onChange={(e) => setRecargoPequena(e.target.value)}
                                    min="0"
                                    step="500"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group mb-3">
                            <label htmlFor="recargo-mediana">Recargo Extra Mediana / Familiar</label>
                            <div className="input-with-icon">
                                <span className="text-muted pointer-events-none">$</span>
                                <input
                                    id="recargo-mediana"
                                    type="number"
                                    value={recargoMediana}
                                    onChange={(e) => setRecargoMediana(e.target.value)}
                                    min="0"
                                    step="500"
                                    required
                                />
                            </div>
                        </div>

                        {sabor.tipo === 'configuracion' && (
                            <div className="form-group mb-3">
                                <label htmlFor="recargo-grande">Recargo Extra Grande (MultiSabor)</label>
                                <div className="input-with-icon">
                                    <span className="text-muted pointer-events-none">$</span>
                                    <input
                                        id="recargo-grande"
                                        type="number"
                                        value={recargoGrande}
                                        onChange={(e) => setRecargoGrande(e.target.value)}
                                        min="0"
                                        step="500"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="dialog-actions mt-4">
                            <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar Recargos'}
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

// --- Main Page Component ---

export function GestionProductosPage() {
    const { productos, loading, error, fetchProductos } = useProductos();
    const {
        createProducto, updateProducto, deleteProducto,
        createVariante, updateVariante, deleteVariante,
        loading: opLoading,
    } = useProductOperations();

    const { sabores, fetchSabores } = usePizzaSabores();
    const { updateSabor, loading: saborLoading } = useUpdatePizzaSabor();
    const { showToast } = useToast();

    const [search, setSearch] = useState('');
    const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Modals
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Producto | null>(null);

    const [showVariantModal, setShowVariantModal] = useState(false);
    const [editingVariant, setEditingVariant] = useState<ProductoVariante | null>(null);
    const [parentProductId, setParentProductId] = useState<number | null>(null);

    const [editingSabor, setEditingSabor] = useState<PizzaSabor | null>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'product' | 'variant'; id: number; name: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Form States
    const [prodName, setProdName] = useState('');
    const [prodCategory, setProdCategory] = useState('');
    const [prodDesc, setProdDesc] = useState('');
    const [prodError, setProdError] = useState('');

    const [varName, setVarName] = useState('');
    const [varPrice, setVarPrice] = useState('0');
    const [varDesc, setVarDesc] = useState('');
    const [varError, setVarError] = useState('');

    useEffect(() => {
        fetchProductos(undefined, true);
        fetchSabores();
    }, [fetchProductos, fetchSabores]);

    useEffect(() => {
        if (search.trim() === '') {
            setFilteredProductos(productos);
        } else {
            const lower = search.toLowerCase();
            setFilteredProductos(
                productos.filter(
                    (p) =>
                        p.productoNombre.toLowerCase().includes(lower) ||
                        p.categoria.toLowerCase().includes(lower),
                ),
            );
        }
    }, [search, productos]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchProductos(undefined, true);
        await fetchSabores();
        setIsRefreshing(false);
    };

    // Product Actions
    const openProductModal = (product?: Producto) => {
        if (product) {
            setEditingProduct(product);
            setProdName(product.productoNombre);
            setProdCategory(product.categoria);
            setProdDesc(product.descripcion || '');
        } else {
            setEditingProduct(null);
            setProdName('');
            setProdCategory('');
            setProdDesc('');
        }
        setProdError('');
        setShowProductModal(true);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prodName || !prodCategory) {
            setProdError('Nombre y Categoría son obligatorios');
            return;
        }
        const payload = {
            productoNombre: prodName,
            categoria: prodCategory,
            descripcion: prodDesc,
            activo: true,
        };
        try {
            if (editingProduct) {
                await updateProducto(editingProduct.productoId, payload);
                showToast('Producto actualizado', 'success');
            } else {
                await createProducto(payload);
                showToast('Producto creado', 'success');
            }
            setShowProductModal(false);
            fetchProductos(undefined, true);
        } catch {
            setProdError('No se pudo guardar el producto');
        }
    };

    // Variant Actions
    const openVariantModal = (productId: number, variant?: ProductoVariante) => {
        setParentProductId(productId);
        if (variant) {
            setEditingVariant(variant);
            setVarName(variant.nombre);
            setVarPrice(variant.precio.toString());
            setVarDesc(variant.descripcion || '');
        } else {
            setEditingVariant(null);
            setVarName('');
            setVarPrice('');
            setVarDesc('');
        }
        setVarError('');
        setShowVariantModal(true);
    };

    const handleSaveVariant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!varName || !varPrice || !parentProductId) {
            setVarError('Nombre y Precio son requeridos');
            return;
        }
        const payload = {
            nombre: varName,
            precio: Number(varPrice),
            descripcion: varDesc,
            activo: true,
        };
        try {
            if (editingVariant) {
                await updateVariante(editingVariant.varianteId, payload);
                showToast('Variante actualizada', 'success');
            } else {
                await createVariante(parentProductId, payload);
                showToast('Variante agregada', 'success');
            }
            setShowVariantModal(false);
            fetchProductos(undefined, true);
        } catch {
            setVarError('No se pudo guardar la variante');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            if (deleteTarget.type === 'product') {
                await deleteProducto(deleteTarget.id);
                showToast('Producto eliminado', 'success');
            } else {
                await deleteVariante(deleteTarget.id);
                showToast('Variante eliminada', 'success');
            }
            fetchProductos(undefined, true);
            setDeleteTarget(null);
        } catch {
            showToast('Error al eliminar', 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSaveSabor = async (
        saborId: number,
        data: { recargoPequena: number; recargoMediana: number; recargoGrande: number },
    ) => {
        try {
            await updateSabor(saborId, data);
            setEditingSabor(null);
            showToast('Recargos de sabor actualizados', 'success');
            fetchSabores();
        } catch {
            showToast('Error al actualizar el sabor', 'error');
        }
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Package className="page-icon" />
                        Catálogo y Menú
                    </h1>
                    <p className="page-description">Gestiona productos, tamaños, variantes y precios del restaurante.</p>
                </div>
                <div className="header-actions">
                    <button type="button" className="btn-primary" onClick={() => openProductModal()}>
                        <PlusCircle size={18} />
                        <span>Nuevo Producto</span>
                    </button>
                </div>
            </header>

            {/* ── Búsqueda ── */}
            <div className="pos-card search-section mb-4">
                <div className="search-form">
                    <div className="input-with-icon search-input">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Buscar producto o categoría..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        title="Recargar catálogo"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'spinning' : ''} />
                    </button>
                </div>
            </div>

            {/* ── Lista de Productos ── */}
            {error && (
                <div className="error-alert mb-4">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {loading && !filteredProductos.length && (
                <div className="loading-state">
                    <RefreshCw size={32} className="spinning text-muted mb-2" />
                    <p>Cargando inventario...</p>
                </div>
            )}

            {!loading && filteredProductos.length === 0 && (
                <div className="empty-state pos-card">
                    <Package size={48} className="text-muted mb-3" />
                    <h3>Sin productos encontrados</h3>
                    <p className="text-muted">Añade productos o flexibiliza tu búsqueda.</p>
                </div>
            )}

            {!loading && filteredProductos.length > 0 && (
                <div className="productos-list">
                    {filteredProductos.map((p) => (
                        <div key={p.productoId} className="producto-card pos-card mb-4">
                            {/* Card Header */}
                            <div className="producto-header">
                                <div>
                                    <h3 className="producto-name">{p.productoNombre}</h3>
                                    <p className="producto-categoria">Categoría: {p.categoria}</p>
                                    {p.descripcion && <p className="producto-desc mt-1">{p.descripcion}</p>}
                                </div>
                                <div className="producto-actions">
                                    <button type="button" className="btn-ghost" onClick={() => openProductModal(p)}>
                                        <Edit size={16} className="mr-1 inline" /> Editar
                                    </button>
                                    <button type="button" className="btn-ghost text-danger" onClick={() => setDeleteTarget({ type: 'product', id: p.productoId, name: p.productoNombre })}>
                                        <Trash2 size={16} className="mr-1 inline" />
                                    </button>
                                </div>
                            </div>

                            {/* Variants Section */}
                            <div className="variants-section">
                                <div className="variants-header">
                                    <List size={16} className="mr-2 inline text-muted" />
                                    <h4>Tamaños y Precios</h4>
                                </div>

                                <div className="variants-list">
                                    {p.variantes && p.variantes.map(v => (
                                        <div key={v.varianteId} className="variant-row">
                                            <div className="variant-info">
                                                <strong>{v.nombre}</strong>
                                                {v.descripcion && <span className="variant-desc"> - {v.descripcion}</span>}
                                            </div>
                                            <div className="variant-price font-mono font-semibold">
                                                ${formatCurrency(v.precio)}
                                            </div>
                                            <div className="variant-actions">
                                                <button type="button" className="btn-icon" onClick={() => openVariantModal(p.productoId, v)}>
                                                    <Edit size={14} />
                                                </button>
                                                <button type="button" className="btn-icon text-danger" onClick={() => setDeleteTarget({ type: 'variant', id: v.varianteId, name: v.nombre })}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button type="button" className="btn-outline add-variant-btn mt-2" onClick={() => openVariantModal(p.productoId)}>
                                        <PlusCircle size={14} className="mr-2 inline" /> Agregar Variante
                                    </button>
                                </div>
                            </div>

                            {/* Sabores Section (Only for Pizzas) */}
                            {p.categoria.toLowerCase() === 'pizzas' && sabores.length > 0 && (
                                <div className="sabores-section">
                                    <div className="sabores-header">
                                        <Pizza size={16} className="mr-2 inline text-orange-500" />
                                        <h4>Sabores y Costos Extra</h4>
                                        <span className="text-xs text-muted ml-2">(Click para editar)</span>
                                    </div>

                                    <div className="sabores-categories">
                                        <div className="sabor-category">
                                            <h5>Tradicionales (Sin recargo)</h5>
                                            <div className="sabores-chips">
                                                {sabores.filter(s => s.tipo === 'tradicional' && s.activo).map(s => (
                                                    <button key={s.saborId} type="button" className="sabor-chip" onClick={() => setEditingSabor(s)}>
                                                        {s.nombre}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="sabor-category mt-3">
                                            <h5>Especiales ★</h5>
                                            <div className="sabores-chips">
                                                {sabores.filter(s => s.tipo === 'especial' && s.activo).map(s => {
                                                    const hasRecargo = (Number(s.recargoPequena) > 0 || Number(s.recargoMediana) > 0);
                                                    return (
                                                        <button key={s.saborId} type="button" className={`sabor-chip especial ${hasRecargo ? 'has-recargo' : ''}`} onClick={() => setEditingSabor(s)}>
                                                            ★ {s.nombre}
                                                            {hasRecargo && <span className="recargo-badge">+${formatCurrency(Number(s.recargoPequena))}/${formatCurrency(Number(s.recargoMediana))}</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {(() => {
                                        const config3Sabores = sabores.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
                                        const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 0;
                                        return config3Sabores && (
                                            <button type="button" className="sabor-config-btn mt-3" onClick={() => setEditingSabor(config3Sabores)}>
                                                <Info size={14} className="mr-2 inline" />
                                                Pizza 3 sabores requiere recargo de +${formatCurrency(extra3SaboresAmount)} extra
                                            </button>
                                        )
                                    })()}

                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Modal Producto ── */}
            <Dialog.Root open={showProductModal} onOpenChange={(open) => !open && setShowProductModal(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title">
                            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                        </Dialog.Title>

                        <form onSubmit={handleSaveProduct} className="cliente-form mt-4">
                            <div className="form-group mb-3">
                                <label htmlFor="prod-nombre">Nombre del Producto *</label>
                                <input
                                    id="prod-nombre"
                                    type="text"
                                    className="w-full form-input"
                                    value={prodName}
                                    onChange={(e) => setProdName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group mb-3">
                                <label htmlFor="prod-categoria">Categoría *</label>
                                <input
                                    id="prod-categoria"
                                    type="text"
                                    className="w-full form-input"
                                    value={prodCategory}
                                    onChange={(e) => setProdCategory(e.target.value)}
                                    placeholder="Ej: Pizzas, Bebidas..."
                                    required
                                />
                            </div>
                            <div className="form-group mb-3">
                                <label htmlFor="prod-descripcion">Descripción</label>
                                <textarea
                                    id="prod-descripcion"
                                    className="w-full form-input"
                                    rows={2}
                                    value={prodDesc}
                                    onChange={(e) => setProdDesc(e.target.value)}
                                />
                            </div>

                            {prodError && (
                                <div className="error-alert mb-3">
                                    <AlertCircle size={16} />
                                    <span>{prodError}</span>
                                </div>
                            )}

                            <div className="dialog-actions mt-4">
                                <button type="button" className="btn-ghost" onClick={() => setShowProductModal(false)} disabled={opLoading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={opLoading}>
                                    {opLoading ? 'Guardando...' : 'Guardar Producto'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* ── Modal Variante ── */}
            <Dialog.Root open={showVariantModal} onOpenChange={(open) => !open && setShowVariantModal(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title">
                            {editingVariant ? 'Editar Variante' : 'Nueva Variante'}
                        </Dialog.Title>

                        <form onSubmit={handleSaveVariant} className="cliente-form mt-4">
                            <div className="form-group mb-3">
                                <label htmlFor="var-nombre">Tamaño / Nombre de variante *</label>
                                <input
                                    id="var-nombre"
                                    type="text"
                                    className="w-full form-input"
                                    value={varName}
                                    onChange={(e) => setVarName(e.target.value)}
                                    placeholder="Ej: Mediana, Pequeña..."
                                    required
                                />
                            </div>
                            <div className="form-group mb-3">
                                <label htmlFor="var-precio">Precio *</label>
                                <div className="input-with-icon">
                                    <span className="pointer-events-none">$</span>
                                    <input
                                        id="var-precio"
                                        type="number"
                                        value={varPrice}
                                        onChange={(e) => setVarPrice(e.target.value)}
                                        min="0"
                                        step="100"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group mb-3">
                                <label htmlFor="var-detalle">Detalle adicional (opcional)</label>
                                <input
                                    id="var-detalle"
                                    type="text"
                                    className="w-full form-input"
                                    value={varDesc}
                                    onChange={(e) => setVarDesc(e.target.value)}
                                />
                            </div>

                            {varError && (
                                <div className="error-alert mb-3">
                                    <AlertCircle size={16} />
                                    <span>{varError}</span>
                                </div>
                            )}

                            <div className="dialog-actions mt-4">
                                <button type="button" className="btn-ghost" onClick={() => setShowVariantModal(false)} disabled={opLoading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={opLoading}>
                                    {opLoading ? 'Guardando...' : 'Guardar Variante'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* ── Dialogo Eliminar ── */}
            <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title">Eliminar {deleteTarget?.type === 'product' ? 'Producto' : 'Variante'}</Dialog.Title>
                        <Dialog.Description className="dialog-description mt-2">
                            ¿Estás seguro de eliminar <strong>{deleteTarget?.name}</strong>?
                            {deleteTarget?.type === 'product' && ' Esto eliminará todas las variantes asociadas también.'}
                            <br /><br />Esta acción no se puede deshacer.
                        </Dialog.Description>
                        <div className="dialog-actions mt-4">
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleteLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={handleDelete}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* ── Modal Sabor ── */}
            <SaborModal
                key={editingSabor?.saborId}
                visible={!!editingSabor}
                sabor={editingSabor}
                loading={saborLoading}
                onSave={handleSaveSabor}
                onClose={() => setEditingSabor(null)}
            />

        </div>
    );
}
