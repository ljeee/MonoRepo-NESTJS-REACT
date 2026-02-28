import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Producto } from '../../hooks/use-productos';
import { PizzaSabor } from '../../hooks/use-pizza-sabores';
import { colors } from '../../styles/theme';
import { spacing } from '../../styles/tokens';
import { formatCurrency } from '../../utils/formatNumber';
import { Button, Card, Icon, Badge } from '../ui';
import { productCardStyles as styles } from '../../styles/components/ProductCard.styles';


interface ProductCardProps {
    product: Producto;
    onEdit: () => void;
    onEditVariant: (variantId: number) => void;
    onDeleteVariant: (variantId: number, variantName: string) => void;
    onAddVariant: () => void;
    /** Only relevant if product.categoria === 'Pizzas' */
    sabores?: PizzaSabor[];
    onEditSabor?: (sabor: PizzaSabor) => void;
}

export function ProductCard({
    product,
    onEdit,
    onEditVariant,
    onDeleteVariant,
    onAddVariant,
    sabores,
    onEditSabor,
}: ProductCardProps) {
    return (
        <Card padding="lg" style={{ marginBottom: spacing.lg }}>
            {/* Product header */}
            <View style={styles.productHeader}>
                <View style={{ flex: 1 }}>
                    <View style={styles.productTitleRow}>
                        <Text style={styles.productName}>{product.productoNombre}</Text>
                        <Badge label={product.categoria} variant="primary" size="sm" />
                    </View>
                    {product.descripcion ? (
                        <Text style={styles.productDesc}>{product.descripcion}</Text>
                    ) : null}
                </View>
                <Button
                    title="Editar"
                    icon="pencil-outline"
                    variant="ghost"
                    size="sm"
                    onPress={onEdit}
                />
            </View>

            {/* Variants */}
            <View style={styles.variantsSection}>
                <View style={styles.variantsHeader}>
                    <Icon name="format-list-bulleted-type" size={16} color={colors.textMuted} />
                    <Text style={styles.variantsTitle}>Variantes y Precios</Text>
                </View>

                {product.variantes &&
                    product.variantes.map((v) => (
                        <View key={v.varianteId} style={styles.variantRow}>
                            <View style={styles.variantInfo}>
                                <Text style={styles.variantName}>{v.nombre}</Text>
                                {v.descripcion ? (
                                    <Text style={styles.variantDesc}>{v.descripcion}</Text>
                                ) : null}
                            </View>
                            <Text style={styles.variantPrice}>
                                ${formatCurrency(v.precio)}
                            </Text>
                            <View style={styles.variantActions}>
                                <Button
                                    title=""
                                    icon="pencil-outline"
                                    variant="ghost"
                                    size="sm"
                                    onPress={() => onEditVariant(v.varianteId)}
                                    style={{ paddingHorizontal: 6, minWidth: 0 }}
                                />
                                <Button
                                    title=""
                                    icon="trash-can-outline"
                                    variant="ghost"
                                    size="sm"
                                    onPress={() => onDeleteVariant(v.varianteId, v.nombre)}
                                    style={{ paddingHorizontal: 6, minWidth: 0 }}
                                />
                            </View>
                        </View>
                    ))}

                <Button
                    title="Agregar Variante"
                    icon="plus"
                    variant="outline"
                    size="sm"
                    fullWidth
                    onPress={onAddVariant}
                    style={{ marginTop: spacing.md }}
                />
            </View>

            {/* Pizza Flavors Section - Only for Pizzas */}
            {product.categoria.toLowerCase() === 'pizzas' && sabores && (
                <PizzaFlavorsSection sabores={sabores} onEditSabor={onEditSabor} />
            )}
        </Card>
    );
}

interface PizzaFlavorsSectionProps {
    sabores: PizzaSabor[];
    onEditSabor?: (sabor: PizzaSabor) => void;
}

function PizzaFlavorsSection({ sabores, onEditSabor }: PizzaFlavorsSectionProps) {
    const tradicionales = sabores.filter(s => s.tipo === 'tradicional' && s.activo);
    const especiales = sabores.filter(s => s.tipo === 'especial' && s.activo);

    const renderChip = (sabor: PizzaSabor) => {
        const isEspecial = sabor.tipo === 'especial';
        const hasRecargo = isEspecial && (sabor.recargoPequena > 0 || sabor.recargoMediana > 0);
        return (
            <TouchableOpacity
                key={sabor.saborId}
                style={[styles.flavorChip, isEspecial && styles.flavorChipSpecial]}
                onPress={() => onEditSabor?.(sabor)}
                activeOpacity={0.7}
            >
                <Text style={[styles.flavorChipText, isEspecial && { color: colors.secondary }]}>
                    {isEspecial ? '★ ' : ''}{sabor.nombre}
                </Text>
                {hasRecargo && (
                    <Text style={{ fontSize: 10, color: colors.secondary, marginTop: 1 }}>
                        +${formatCurrency(sabor.recargoPequena)}/{formatCurrency(sabor.recargoMediana)}
                    </Text>
                )}
                {onEditSabor && (
                    <Icon name="pencil-outline" size={10} color={colors.textMuted} style={{ marginTop: 2 }} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.flavorsSection}>
            <View style={styles.flavorsHeader}>
                <Icon name="pizza" size={16} color={colors.secondary} />
                <Text style={styles.flavorsTitle}>Sabores y Recargos</Text>
                {onEditSabor && (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginLeft: 6 }}>
                        (toca para editar)
                    </Text>
                )}
            </View>

            <Text style={styles.flavorCategoryLabel}>Tradicionales (sin recargo)</Text>
            <View style={styles.flavorsGrid}>
                {tradicionales.map(s => renderChip(s))}
            </View>

            <Text style={[styles.flavorCategoryLabel, { marginTop: spacing.md }]}>Especiales ★</Text>
            <View style={styles.flavorsGrid}>
                {especiales.map(s => renderChip(s))}
            </View>

            {/* Recargo de 3 sabores */}
            <View style={styles.flavorPricingInfo}>
                <Icon name="information-outline" size={14} color={colors.textMuted} />
                <Text style={styles.flavorPricingText}>
                    3 sabores: +$3.000 adicional
                </Text>
            </View>
        </View>
    );
}
