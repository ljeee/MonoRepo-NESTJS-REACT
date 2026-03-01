import React, { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useProductos, useProductOperations, Producto, ProductoVariante } from '../hooks/use-productos';
import { usePizzaSabores, useUpdatePizzaSabor, PizzaSabor } from '../hooks/use-pizza-sabores';
import { colors } from '../styles/theme';
import { spacing } from '../styles/tokens';
import {
    PageContainer,
    PageHeader,
    Button,
    Input,
    Icon,
    ConfirmModal,
    ListSkeleton,
} from '../components/ui';
import { ProductCard, ProductModal, VariantModal } from '../components/products';
import { SaborModal } from '../components/products/SaborModal';
import { gestionProductosStyles as styles } from '../styles/productos/gestion-productos.styles';



export default function GestionProductosScreen() {
    const { productos, loading, error, fetchProductos } = useProductos();
    const {
        createProducto, updateProducto, deleteProducto,
        createVariante, updateVariante, deleteVariante,
        loading: opLoading,
    } = useProductOperations();

    const [search, setSearch] = useState('');
    const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Modals
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
    const [showVariantModal, setShowVariantModal] = useState(false);
    const [editingVariant, setEditingVariant] = useState<ProductoVariante | null>(null);
    const [parentProductId, setParentProductId] = useState<number | null>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'product' | 'variant'; id: number; name: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Pizza Sabores
    const { sabores, fetchSabores } = usePizzaSabores();
    const { updateSabor, loading: saborLoading } = useUpdatePizzaSabor();
    const [editingSabor, setEditingSabor] = useState<PizzaSabor | null>(null);

    // Product form
    const [prodName, setProdName] = useState('');
    const [prodCategory, setProdCategory] = useState('');
    const [prodDesc, setProdDesc] = useState('');
    const [prodActive, setProdActive] = useState(true);
    const [prodError, setProdError] = useState('');

    // Variant form
    const [varName, setVarName] = useState('');
    const [varPrice, setVarPrice] = useState('');
    const [varDesc, setVarDesc] = useState('');
    const [varError, setVarError] = useState('');



    useEffect(() => { fetchProductos(); }, [fetchProductos]);

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

    const resetProductForm = () => {
        setProdName(''); setProdCategory(''); setProdDesc('');
        setProdActive(true); setEditingProduct(null); setProdError('');
    };

    const resetVariantForm = () => {
        setVarName(''); setVarPrice(''); setVarDesc('');
        setEditingVariant(null); setParentProductId(null); setVarError('');
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchProductos();
        setRefreshing(false);
    };

    const openProductModal = (product?: Producto) => {
        if (product) {
            setEditingProduct(product);
            setProdName(product.productoNombre);
            setProdCategory(product.categoria);
            setProdDesc(product.descripcion || '');
            setProdActive(product.activo);
        } else {
            resetProductForm();
        }
        setProdError('');
        setShowProductModal(true);
    };

    const openVariantModal = (productId: number, variant?: ProductoVariante) => {
        setParentProductId(productId);
        if (variant) {
            setEditingVariant(variant);
            setVarName(variant.nombre);
            setVarPrice(variant.precio.toString());
            setVarDesc(variant.descripcion || '');
        } else {
            resetVariantForm();
            setParentProductId(productId);
        }
        setVarError('');
        setShowVariantModal(true);
    };

    const handleSaveProduct = async () => {
        if (!prodName || !prodCategory) {
            setProdError('Nombre y Categoría son obligatorios');
            return;
        }
        const payload = {
            productoNombre: prodName,
            categoria: prodCategory,
            descripcion: prodDesc,
            activo: prodActive,
        };
        try {
            if (editingProduct) {
                await updateProducto(editingProduct.productoId, payload);
            } else {
                await createProducto(payload);
            }
            setShowProductModal(false);
            resetProductForm();
            fetchProductos();
        } catch {
            setProdError('No se pudo guardar el producto');
        }
    };

    const handleSaveVariant = async () => {
        if (!varName || !varPrice || !parentProductId) {
            setVarError('Nombre, Precio y Producto son requeridos');
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
            } else {
                await createVariante(parentProductId, payload);
            }
            setShowVariantModal(false);
            resetVariantForm();
            fetchProductos();
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
            } else {
                await deleteVariante(deleteTarget.id);
            }
            fetchProductos();
            setDeleteTarget(null);
        } catch {
            // Error handled
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
            fetchSabores();
        } catch { /* error shown inside modal */ }
    };

    return (
        <PageContainer
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                />
            }
        >
            <PageHeader
                title="Productos y Precios"
                subtitle="Gestión de Inventario"
                icon="food-variant"
                rightContent={
                    <Button
                        title="Nuevo Producto"
                        icon="plus"
                        variant="primary"
                        size="sm"
                        onPress={() => openProductModal()}
                    />
                }
            />

            {/* Search */}
            <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar producto o categoría..."
                leftIcon={<Icon name="magnify" size={16} color={colors.textMuted} />}
                containerStyle={localStyles.searchContainer}
            />

            {/* Loading */}
            {loading && <ListSkeleton count={3} />}

            {/* Error */}
            {error && (
                <View style={styles.errorBox}>
                    <Icon name="alert-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Products */}
            {!loading &&
                filteredProductos.map((p) => (
                    <ProductCard
                        key={p.productoId}
                        product={p}
                        onEdit={() => openProductModal(p)}
                        onEditVariant={(variantId) => {
                            const variant = p.variantes?.find(v => v.varianteId === variantId);
                            if (variant) openVariantModal(p.productoId, variant);
                        }}
                        onDeleteVariant={(variantId, variantName) => {
                            setDeleteTarget({
                                type: 'variant',
                                id: variantId,
                                name: variantName,
                            });
                        }}
                        onAddVariant={() => openVariantModal(p.productoId)}
                        sabores={p.categoria.toLowerCase() === 'pizzas' ? sabores : undefined}
                        onEditSabor={p.categoria.toLowerCase() === 'pizzas' ? setEditingSabor : undefined}
                    />
                ))}

            {!loading && filteredProductos.length === 0 && !error && (
                <View style={styles.emptyBox}>
                    <Icon name="food-off" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Sin productos encontrados</Text>
                </View>
            )}

            {/* ── Product Modal ── */}
            <ProductModal
                visible={showProductModal}
                editing={!!editingProduct}
                name={prodName}
                category={prodCategory}
                description={prodDesc}
                error={prodError}
                loading={opLoading}
                onClose={() => setShowProductModal(false)}
                onSave={handleSaveProduct}
                onDelete={editingProduct ? () => {
                    setShowProductModal(false);
                    setDeleteTarget({
                        type: 'product',
                        id: editingProduct.productoId,
                        name: editingProduct.productoNombre,
                    });
                } : undefined}
                onNameChange={setProdName}
                onCategoryChange={setProdCategory}
                onDescriptionChange={setProdDesc}
            />

            {/* ── Variant Modal ── */}
            <VariantModal
                visible={showVariantModal}
                editing={!!editingVariant}
                name={varName}
                price={varPrice}
                description={varDesc}
                error={varError}
                loading={opLoading}
                onClose={() => setShowVariantModal(false)}
                onSave={handleSaveVariant}
                onNameChange={setVarName}
                onPriceChange={setVarPrice}
                onDescriptionChange={setVarDesc}
            />

            {/* ── Delete Confirmation ── */}
            <ConfirmModal
                visible={!!deleteTarget}
                title={`Eliminar ${deleteTarget?.type === 'product' ? 'producto' : 'variante'}`}
                message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? ${deleteTarget?.type === 'product'
                    ? 'Esto también eliminará todas sus variantes.'
                    : ''
                    } Esta acción no se puede deshacer.`}
                icon="trash-can-outline"
                variant="danger"
                confirmText="Eliminar"
                loading={deleteLoading}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* ── Sabor Modal ── */}
            <SaborModal
                visible={!!editingSabor}
                sabor={editingSabor}
                loading={saborLoading}
                onSave={handleSaveSabor}
                onClose={() => setEditingSabor(null)}
            />
        </PageContainer>
    );
}

const localStyles = StyleSheet.create({
    searchContainer: {
        marginBottom: spacing.xl,
    },
});


