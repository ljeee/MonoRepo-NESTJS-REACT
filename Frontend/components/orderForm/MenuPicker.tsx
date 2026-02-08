import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useProductos, Producto, ProductoVariante } from '../../hooks/use-productos';
import { colors } from '../../styles/theme';
import { menuPickerStyles as s } from '../../styles/menu-picker.styles';
import { formatCurrency } from '../../utils/formatNumber';
import PizzaPersonalizadaModal from './PizzaPersonalizadaModal';

interface MenuPickerProps {
  onAdd: (producto: Producto, variante: ProductoVariante, sabores?: string[]) => void;
}

export default function MenuPicker({ onAdd }: MenuPickerProps) {
  const { productos, loading, error, fetchProductos } = useProductos();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<ProductoVariante | null>(null);

  useEffect(() => {
    fetchProductos(undefined, true);
  }, [fetchProductos]);

  const categories = useMemo(
    () =>
      productos.reduce<Record<string, Producto[]>>((acc, p) => {
        const cat = p.categoria || 'Otros';
        (acc[cat] ??= []).push(p);
        return acc;
      }, {}),
    [productos],
  );

  // Orden fijo: Pizzas primero, Adiciones al final
  const CATEGORY_ORDER: Record<string, number> = {
    'Pizzas': 0, 'Hamburguesas': 1, 'Chuzos': 2,
    'Pizza Burguer': 3, 'Tortiburger': 4, 'Calzones': 5, 'Adiciones': 99,
  };
  const categoryNames = Object.keys(categories).sort(
    (a, b) => (CATEGORY_ORDER[a] ?? 50) - (CATEGORY_ORDER[b] ?? 50),
  );

  // Orden de variantes: Pequeña → Mediana → Grande
  const SIZE_ORDER: Record<string, number> = { 'Pequeña': 0, 'Mediana': 1, 'Grande': 2 };
  const sortVariantes = (vs: ProductoVariante[]) =>
    [...vs].sort((a, b) => (SIZE_ORDER[a.nombre] ?? 50) - (SIZE_ORDER[b.nombre] ?? 50));

  useEffect(() => {
    if (categoryNames.length > 0 && !activeCategory) {
      setActiveCategory(categoryNames[0]);
    }
  }, [categoryNames, activeCategory]);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={s.loadingText}>Cargando menú...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.errorContainer}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => fetchProductos(undefined, true)} style={s.retryBtn}>
          <Text style={s.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentProducts = activeCategory ? categories[activeCategory] || [] : [];

  return (
    <View style={s.container}>
      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll}>
        <View style={s.tabs}>
          {categoryNames.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.tab, activeCategory === cat && s.tabActive]}
              onPress={() => {
                setActiveCategory(cat);
                setExpandedProductId(null);
              }}
            >
              <Text style={[s.tabText, activeCategory === cat && s.tabTextActive]}>
                {cat}
              </Text>
              <Text style={[s.tabCount, activeCategory === cat && s.tabCountActive]}>
                {categories[cat].length}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Products list */}
      <View style={s.productsContainer}>
        {currentProducts.map((producto) => {
          const isExpanded = expandedProductId === producto.productoId;
          return (
            <View key={producto.productoId} style={s.productCard}>
              <TouchableOpacity
                style={s.productHeader}
                onPress={() =>
                  setExpandedProductId(isExpanded ? null : producto.productoId)
                }
                activeOpacity={0.7}
              >
                <View style={s.productInfo}>
                  <Text style={s.productName}>{producto.productoNombre}</Text>
                  {producto.descripcion ? (
                    <Text style={s.productDesc} numberOfLines={1}>
                      {producto.descripcion}
                    </Text>
                  ) : null}
                </View>
                <Text style={s.expandIcon}>{isExpanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              {isExpanded && producto.variantes.length > 0 && (
                <View style={s.variantesContainer}>
                  {sortVariantes(producto.variantes)
                    .filter((v) => v.activo)
                    .map((variante) => (
                      <TouchableOpacity
                        key={variante.varianteId}
                        style={s.varianteRow}
                        onPress={() => {
                          if (producto.categoria === 'Pizzas') {
                            setSelectedProducto(producto);
                            setSelectedVariante(variante);
                            setModalVisible(true);
                          } else {
                            onAdd(producto, variante);
                          }
                        }}
                        activeOpacity={0.6}
                      >
                        <Text style={s.varianteName}>{variante.nombre}</Text>
                        <View style={s.varianteRight}>
                          <Text style={s.variantePrice}>
                            ${formatCurrency(Number(variante.precio))}
                          </Text>
                          <View style={s.addBtnSmall}>
                            <Text style={s.addBtnSmallText}>+</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {selectedProducto && selectedVariante && (
        <PizzaPersonalizadaModal
          visible={modalVisible}
          producto={selectedProducto}
          variante={selectedVariante}
          onAdd={(producto, variante, sabores) => {
            onAdd(producto, variante, sabores);
            setModalVisible(false);
            setSelectedProducto(null);
            setSelectedVariante(null);
          }}
          onClose={() => {
            setModalVisible(false);
            setSelectedProducto(null);
            setSelectedVariante(null);
          }}
        />
      )}
    </View>
  );
}
