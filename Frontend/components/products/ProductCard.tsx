import React from 'react';
import { Text, View } from 'react-native';
import { Producto } from '../../hooks/use-productos';
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
}

export function ProductCard({
    product,
    onEdit,
    onEditVariant,
    onDeleteVariant,
    onAddVariant,
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
            {product.categoria.toLowerCase() === 'pizzas' && (
                <PizzaFlavorsSection />
            )}
        </Card>
    );
}

function PizzaFlavorsSection() {
    const SABORES_TRADICIONALES = [
        'De Casa', 'Napolitana', 'Ranchera', 'Hawaiana', 'Vegetales',
        'Mexicana', 'Carnes', 'Pollo Tocineta', 'Pollo Champiñones',
        'Pollo Maicitos', 'Jamón y Queso',
    ];

    const SABORES_ESPECIALES = [
        'Quesuda', 'Boloñesa', 'Pollo BBQ', 'Aborrajada', 'Firu', 'Paisa',
    ];

    const PREMIUM_ESPECIAL: Record<string, number> = {
        'Pequeña': 1000,
        'Mediana': 2000,
        'Grande': 2000,
    };

    return (
        <View style={styles.flavorsSection}>
            <View style={styles.flavorsHeader}>
                <Icon name="pizza" size={16} color={colors.secondary} />
                <Text style={styles.flavorsTitle}>Sabores Disponibles</Text>
            </View>

            {/* Traditional Flavors */}
            <Text style={styles.flavorCategoryLabel}>Tradicionales</Text>
            <View style={styles.flavorsGrid}>
                {SABORES_TRADICIONALES.map((sabor, idx) => (
                    <View key={idx} style={styles.flavorChip}>
                        <Text style={styles.flavorChipText}>{sabor}</Text>
                    </View>
                ))}
            </View>

            {/* Special Flavors */}
            <Text style={[styles.flavorCategoryLabel, { marginTop: spacing.md }]}>
                Especiales ★
            </Text>
            <View style={styles.flavorsGrid}>
                {SABORES_ESPECIALES.map((sabor, idx) => (
                    <View key={idx} style={[styles.flavorChip, styles.flavorChipSpecial]}>
                        <Text style={[styles.flavorChipText, { color: colors.secondary }]}>
                            ★ {sabor}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Pricing Info */}
            <View style={styles.flavorPricingInfo}>
                <Icon name="information-outline" size={14} color={colors.textMuted} />
                <Text style={styles.flavorPricingText}>
                    Sabores especiales: +${formatCurrency(PREMIUM_ESPECIAL['Pequeña'])} (Pequeña),
                    +${formatCurrency(PREMIUM_ESPECIAL['Mediana'])} (Mediana/Grande)
                </Text>
            </View>
        </View>
    );
}

