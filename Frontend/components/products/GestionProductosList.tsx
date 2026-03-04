import React from 'react';
import { Text, View } from 'react-native';
import { Producto } from '../../hooks/use-productos';
import { PizzaSabor } from '../../hooks/use-pizza-sabores';
import { colors } from '../../styles/theme';
import { spacing } from '../../styles/tokens';
import { gestionProductosStyles as styles } from '../../styles/productos/gestion-productos.styles';
import Input from '../ui/Input';
import Icon from '../ui/Icon';
import { ListSkeleton } from '../ui';
import { ProductCard } from './ProductCard';

interface GestionProductosListProps {
    search: string;
    loading: boolean;
    error: string | null;
    productos: Producto[];
    sabores: PizzaSabor[];
    onSearchChange: (value: string) => void;
    onEditProduct: (product: Producto) => void;
    onAddVariant: (productId: number) => void;
    onEditVariant: (productId: number, variantId: number) => void;
    onDeleteVariant: (variantId: number, variantName: string) => void;
    onEditSabor: (sabor: PizzaSabor) => void;
}

export function GestionProductosList({
    search,
    loading,
    error,
    productos,
    sabores,
    onSearchChange,
    onEditProduct,
    onAddVariant,
    onEditVariant,
    onDeleteVariant,
    onEditSabor,
}: GestionProductosListProps) {
    return (
        <>
            <Input
                value={search}
                onChangeText={onSearchChange}
                placeholder="Buscar producto o categoria..."
                leftIcon={<Icon name="magnify" size={16} color={colors.textMuted} />}
                containerStyle={{ marginBottom: spacing.xl }}
            />

            {loading && <ListSkeleton count={3} />}

            {error && (
                <View style={styles.errorBox}>
                    <Icon name="alert-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {!loading &&
                productos.map((p) => (
                    <ProductCard
                        key={p.productoId}
                        product={p}
                        onEdit={() => onEditProduct(p)}
                        onEditVariant={(variantId) => onEditVariant(p.productoId, variantId)}
                        onDeleteVariant={onDeleteVariant}
                        onAddVariant={() => onAddVariant(p.productoId)}
                        sabores={p.categoria.toLowerCase() === 'pizzas' ? sabores : undefined}
                        onEditSabor={p.categoria.toLowerCase() === 'pizzas' ? onEditSabor : undefined}
                    />
                ))}

            {!loading && productos.length === 0 && !error && (
                <View style={styles.emptyBox}>
                    <Icon name="food-off" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Sin productos encontrados</Text>
                </View>
            )}
        </>
    );
}
