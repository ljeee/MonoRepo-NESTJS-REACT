import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, Modal, SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';

import { styles } from '../styles/gestion-productos.styles';
import { useProductos, useProductOperations, Producto, ProductoVariante } from '../hooks/use-productos';
import { colors } from '../styles/theme';
import { formatCurrency } from '../utils/formatNumber';

export default function GestionProductosScreen() {
    const router = useRouter();
    const { productos, loading, error, fetchProductos } = useProductos();
    const {
        createProducto, updateProducto, deleteProducto,
        createVariante, updateVariante, deleteVariante,
        loading: opLoading
    } = useProductOperations();

    const [search, setSearch] = useState('');
    const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);

    // Modals state
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Producto | null>(null);

    const [showVariantModal, setShowVariantModal] = useState(false);
    const [editingVariant, setEditingVariant] = useState<ProductoVariante | null>(null);
    const [parentProductId, setParentProductId] = useState<number | null>(null);

    // Form states - Product
    const [prodName, setProdName] = useState('');
    const [prodCategory, setProdCategory] = useState('');
    const [prodDesc, setProdDesc] = useState('');
    const [prodActive, setProdActive] = useState(true);

    // Form states - Variant
    const [varName, setVarName] = useState('');
    const [varPrice, setVarPrice] = useState('');
    const [varDesc, setVarDesc] = useState('');

    useEffect(() => {
        fetchProductos();
    }, []);

    useEffect(() => {
        if (search.trim() === '') {
            setFilteredProductos(productos);
        } else {
            const lower = search.toLowerCase();
            setFilteredProductos(productos.filter(p =>
                p.productoNombre.toLowerCase().includes(lower) ||
                p.categoria.toLowerCase().includes(lower)
            ));
        }
    }, [search, productos]);

    const resetProductForm = () => {
        setProdName('');
        setProdCategory('');
        setProdDesc('');
        setProdActive(true);
        setEditingProduct(null);
    };

    const resetVariantForm = () => {
        setVarName('');
        setVarPrice('');
        setVarDesc('');
        setEditingVariant(null);
        setParentProductId(null);
    };

    const handeOpenProductModal = (product?: Producto) => {
        if (product) {
            setEditingProduct(product);
            setProdName(product.productoNombre);
            setProdCategory(product.categoria);
            setProdDesc(product.descripcion || '');
            setProdActive(product.activo);
        } else {
            resetProductForm();
        }
        setShowProductModal(true);
    };

    const handleOpenVariantModal = (productId: number, variant?: ProductoVariante) => {
        setParentProductId(productId);
        if (variant) {
            setEditingVariant(variant);
            setVarName(variant.nombre);
            setVarPrice(variant.precio.toString());
            setVarDesc(variant.descripcion || '');
        } else {
            resetVariantForm();
            setParentProductId(productId); // Ensure parent ID is set for new variant
        }
        setShowVariantModal(true);
    };

    const handleSaveProduct = async () => {
        if (!prodName || !prodCategory) {
            Alert.alert('Error', 'Nombre y Categoría son obligatorios');
            return;
        }

        const payload = {
            productoNombre: prodName,
            categoria: prodCategory,
            descripcion: prodDesc,
            activo: prodActive
        };

        try {
            if (editingProduct) {
                await updateProducto(editingProduct.productoId, payload);
            } else {
                await createProducto(payload);
            }
            setShowProductModal(false);
            resetProductForm();
            fetchProductos(); // Refresh list
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar el producto');
        }
    };

    const handleDeleteProduct = (id: number) => {
        Alert.alert(
            'Confirmar Eliminación',
            '¿Estás seguro de eliminar este producto y sus variantes?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteProducto(id);
                            fetchProductos();
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]
        );
    };

    const handleSaveVariant = async () => {
        if (!varName || !varPrice || !parentProductId) {
            Alert.alert('Error', 'Nombre, Precio y Producto son requeridos');
            return;
        }

        const payload = {
            nombre: varName,
            precio: Number(varPrice),
            descripcion: varDesc,
            activo: true
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
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar la variante');
        }
    };

    const handleDeleteVariant = (id: number) => {
        Alert.alert(
            'Confirmar',
            '¿Eliminar variante?',
            [
                { text: 'Cancelar' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteVariante(id);
                            fetchProductos();
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo eliminar');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.contentContainer}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.subtitle}>Gestión de Inventario</Text>
                        <Text style={styles.title}>Productos y Precios</Text>
                    </View>
                    <TouchableOpacity style={styles.addButton} onPress={() => handeOpenProductModal()}>
                        <Text style={styles.addButtonText}>+ Nuevo Producto</Text>
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={styles.searchBar}
                    placeholder="Buscar producto o categoría..."
                    placeholderTextColor={colors.textSecondary}
                    value={search}
                    onChangeText={setSearch}
                />

                {loading && <ActivityIndicator size="large" color={colors.primary} />}

                {!loading && filteredProductos.map(p => (
                    <View key={p.productoId} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.productName}>{p.productoNombre}</Text>
                                <View style={[styles.categoryBadge, { marginBottom: 8 }]}>
                                    <Text style={styles.categoryText}>{p.categoria}</Text>
                                </View>
                                {p.descripcion ? <Text style={styles.productDesc}>{p.descripcion}</Text> : null}
                            </View>
                            <TouchableOpacity onPress={() => handeOpenProductModal(p)} style={{ padding: 8 }}>
                                <Text style={{ fontSize: 20 }}>✏️</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.variantsContainer}>
                            <Text style={styles.variantsTitle}>Variantes y Precios</Text>
                            {p.variantes && p.variantes.map(v => (
                                <View key={v.varianteId} style={styles.variantRow}>
                                    <View style={styles.variantInfo}>
                                        <Text style={styles.variantName}>{v.nombre}</Text>
                                        {v.descripcion ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>{v.descripcion}</Text> : null}
                                    </View>
                                    <Text style={styles.variantPrice}>${formatCurrency(v.precio)}</Text>
                                    <View style={styles.variantActions}>
                                        <TouchableOpacity onPress={() => handleOpenVariantModal(p.productoId, v)}>
                                            <Text>✏️</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDeleteVariant(v.varianteId)}>
                                            <Text>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity
                                style={[styles.addButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, marginTop: 12 }]}
                                onPress={() => handleOpenVariantModal(p.productoId)}
                            >
                                <Text style={[styles.addButtonText, { color: colors.primary, textAlign: 'center' }]}>+ Agregar Variante</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Product Modal */}
            <Modal visible={showProductModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</Text>

                        <Text style={styles.label}>Nombre Producto</Text>
                        <TextInput style={styles.input} value={prodName} onChangeText={setProdName} placeholder="Ej: Pizza Hawaiana" placeholderTextColor="#666" />

                        <Text style={styles.label}>Categoría</Text>
                        <TextInput style={styles.input} value={prodCategory} onChangeText={setProdCategory} placeholder="Ej: Pizzas, Bebidas" placeholderTextColor="#666" />

                        <Text style={styles.label}>Descripción</Text>
                        <TextInput style={[styles.input, styles.textArea]} value={prodDesc} onChangeText={setProdDesc} multiline placeholder="Descripción corta" placeholderTextColor="#666" />

                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowProductModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProduct} disabled={opLoading}>
                                <Text style={styles.saveButtonText}>{opLoading ? 'Guardando...' : 'Guardar'}</Text>
                            </TouchableOpacity>
                        </View>

                        {editingProduct && (
                            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteProduct(editingProduct.productoId)}>
                                <Text style={styles.deleteButtonText}>Eliminar Producto</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Variant Modal */}
            <Modal visible={showVariantModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingVariant ? 'Editar Variante' : 'Nueva Variante'}</Text>

                        <Text style={styles.label}>Nombre (Tamaño/Sabor)</Text>
                        <TextInput style={styles.input} value={varName} onChangeText={setVarName} placeholder="Ej: Mediana, Pequeña" placeholderTextColor="#666" />

                        <Text style={styles.label}>Precio</Text>
                        <TextInput style={styles.input} value={varPrice} onChangeText={setVarPrice} keyboardType="numeric" placeholder="0" placeholderTextColor="#666" />

                        <Text style={styles.label}>Descripción (Opcional)</Text>
                        <TextInput style={[styles.input, styles.textArea]} value={varDesc} onChangeText={setVarDesc} multiline placeholder="Detalles extra" placeholderTextColor="#666" />

                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowVariantModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleSaveVariant} disabled={opLoading}>
                                <Text style={styles.saveButtonText}>{opLoading ? 'Guardando...' : 'Guardar'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}
