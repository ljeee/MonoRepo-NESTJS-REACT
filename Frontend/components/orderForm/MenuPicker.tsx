import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from '../../tw';
import { useProductos, usePizzaSabores, formatCurrency } from '@monorepo/shared';
import type { Producto, ProductoVariante } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import PizzaPersonalizadaModal from './PizzaPersonalizadaModal';
import Icon from '../ui/Icon';
import { Button } from '../ui';

interface MenuPickerProps {
  onAdd: (producto: Producto, variante: ProductoVariante, sabores?: string[]) => void;
}

export default function MenuPicker({ onAdd }: MenuPickerProps) {
  const { productos, loading, error, fetchProductos } = useProductos();
  const { sabores: saboresCatalogo, loading: loadingSabores } = usePizzaSabores();
  const { isMobile, isTablet } = useBreakpoint();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<ProductoVariante | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProductos(undefined, true);
  }, [fetchProductos]);

  const categories = useMemo(
    () =>
      productos.reduce<Record<string, Producto[]>>((acc, p) => {
        const cat = p.categoria || 'Otros';
        if (!acc[cat]) {
          acc[cat] = [];
        }
        acc[cat].push(p);
        return acc;
      }, {}),
    [productos],
  );

  const CATEGORY_ORDER: Record<string, number> = {
    'Pizzas': 0, 'Hamburguesas': 1, 'Chuzos': 2,
    'Pizza Burguer': 3, 'Tortiburger': 4, 'Calzones': 5, 'Adiciones': 99,
  };
  const categoryNames = Object.keys(categories).sort(
    (a, b) => (CATEGORY_ORDER[a] ?? 50) - (CATEGORY_ORDER[b] ?? 50),
  );

  const SIZE_ORDER: Record<string, number> = { 'Pequeña': 0, 'Mediana': 1, 'Grande': 2 };
  const sortVariantes = (vs: ProductoVariante[]) =>
    [...vs].sort((a, b) => (SIZE_ORDER[a.nombre] ?? 50) - (SIZE_ORDER[b.nombre] ?? 50));

  const selectedCategory = useMemo(() => {
    if (activeCategory && categories[activeCategory]) {
      return activeCategory;
    }
    return categoryNames[0] ?? null;
  }, [activeCategory, categories, categoryNames]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];
    const products = categories[selectedCategory] || [];
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(p =>
      p.productoNombre.toLowerCase().includes(query) ||
      p.descripcion?.toLowerCase().includes(query)
    );
  }, [selectedCategory, categories, searchQuery]);

  if (loading) {
    return (
      <View className="py-20 items-center justify-center">
        <ActivityIndicator color="#F5A524" size="large" />
        <Text className="text-(--color-pos-text-secondary) mt-4 font-medium italic">Cargando el menú...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="py-12 px-6 items-center justify-center bg-red-500/10 rounded-3xl border border-red-500/20">
        <Icon name="alert-circle-outline" size={48} color="#EF4444" />
        <Text className="text-red-400 font-bold text-center mt-4 mb-6">{error}</Text>
        <Button 
          title="Reintentar" 
          icon="refresh"
          onPress={() => fetchProductos(undefined, true)}
          variant="danger"
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Search bar */}
      <View className="mb-6 relative">
          <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
              <Icon name="magnify" size={20} color="#64748B" />
          </View>
          <TextInput
              className="bg-white/5 rounded-2xl border border-white/10 pl-12 pr-5 py-4 text-white font-medium"
              placeholder="¿Qué deseas pedir hoy?"
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
          />
      </View>

      {/* Category tabs */}
      <View className="mb-8">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {categoryNames.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                className={`flex-row items-center px-5 py-3 rounded-2xl mr-3 border transition-all ${isActive ? 'bg-(--color-pos-primary) border-(--color-pos-primary) shadow-lg shadow-amber-500/20' : 'bg-white/5 border-white/5 active:bg-white/10'}`}
                onPress={() => {
                  setActiveCategory(cat);
                  setExpandedProductId(null);
                }}
              >
                <Text className={`font-black text-xs uppercase tracking-widest ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                  {cat}
                </Text>
                <View className={`ml-2 px-2 py-0.5 rounded-lg ${isActive ? 'bg-black/10' : 'bg-white/10'}`}>
                  <Text className={`text-[10px] font-black ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                    {categories[cat].length}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Products list */}
      <View className="flex-row flex-wrap -mx-2">
        {filteredProducts.length === 0 && searchQuery ? (
          <View className="w-full py-20 items-center opacity-50">
            <Icon name="tag-off-outline" size={64} color="#64748B" />
            <Text className="text-slate-400 font-bold mt-4 uppercase tracking-widest text-xs">Sin resultados</Text>
          </View>
        ) : (
          filteredProducts.map((producto) => (
            <ProductItem 
              key={producto.productoId}
              producto={producto}
              isExpanded={expandedProductId === producto.productoId}
              onToggle={() => setExpandedProductId(expandedProductId === producto.productoId ? null : producto.productoId)}
              onAdd={onAdd}
              isMobile={isMobile}
              setSelectedProducto={setSelectedProducto}
              setSelectedVariante={setSelectedVariante}
              setModalVisible={setModalVisible}
            />
          ))
        )}
      </View>

      {selectedProducto && selectedVariante && (
        <PizzaPersonalizadaModal
          visible={modalVisible}
          producto={selectedProducto}
          variante={selectedVariante}
          saboresCatalogo={saboresCatalogo}
          loadingSabores={loadingSabores}
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

// ─── Memoized Product Item ──────────────────────────────────────────────────

interface ProductItemProps {
  producto: Producto;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd: (p: Producto, v: ProductoVariante, s?: string[]) => void;
  isMobile: boolean;
  setSelectedProducto: (p: Producto) => void;
  setSelectedVariante: (v: ProductoVariante) => void;
  setModalVisible: (v: boolean) => void;
}

const ProductItem = React.memo(({ 
  producto, isExpanded, onToggle, onAdd, isMobile, 
  setSelectedProducto, setSelectedVariante, setModalVisible 
}: ProductItemProps) => {
  
  const SIZE_ORDER: Record<string, number> = { 'Pequeña': 0, 'Mediana': 1, 'Grande': 2 };
  const sortedVariantes = [...producto.variantes].sort(
    (a, b) => (SIZE_ORDER[a.nombre] ?? 50) - (SIZE_ORDER[b.nombre] ?? 50)
  );

  return (
    <View className={`px-2 mb-4 w-full md:w-1/2 lg:w-1/3 xl:w-1/4`}>
      <View className={`bg-(--color-pos-surface) rounded-3xl border transition-all overflow-hidden ${isExpanded ? 'border-(--color-pos-primary)/30 bg-(--color-pos-surface-hover)' : 'border-white/5'}`}>
        <TouchableOpacity
          className={`flex-row items-center p-5 ${isExpanded ? 'bg-white/5' : ''}`}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <View className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center mr-4">
              <Text className="text-2xl">{producto.emoji || '🍕'}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-black text-base uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{producto.productoNombre}</Text>
            {producto.descripcion ? (
              <Text className="text-(--color-pos-text-muted) text-xs mt-0.5 italic" numberOfLines={1}>
                {producto.descripcion}
              </Text>
            ) : null}
          </View>
          <View className={`w-8 h-8 rounded-full items-center justify-center bg-white/5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
               <Icon name="chevron-down" size={20} color={isExpanded ? '#F5A524' : '#64748B'} />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View className="bg-black/20 p-3 pt-0">
            {sortedVariantes.length > 0 ? (
              sortedVariantes
              .filter((v) => v.activo)
              .map((variante) => (
                <TouchableOpacity
                  key={variante.varianteId}
                  className="flex-row items-center justify-between p-4 rounded-2xl bg-white/5 active:bg-(--color-pos-primary) active:scale-[0.98] transition-all mb-2 border border-white/5"
                  onPress={() => {
                    if (producto.categoria === 'Pizzas') {
                      setSelectedProducto(producto);
                      setSelectedVariante(variante);
                      setModalVisible(true);
                    } else {
                      onAdd(producto, variante);
                    }
                  }}
                >
                  <Text className="text-slate-200 font-bold">{variante.nombre}</Text>
                  <View className="flex-row items-center">
                    <Text className="text-(--color-pos-primary) font-black mr-4" style={{ fontFamily: 'Space Grotesk' }}>
                      ${formatCurrency(Number(variante.precio))}
                    </Text>
                    <View className="w-8 h-8 bg-(--color-pos-primary) rounded-xl items-center justify-center shadow-lg shadow-amber-500/30">
                      <Icon name="plus" size={20} color="#000" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View className="p-4 items-center">
                   <Text className="text-slate-500 text-xs italic">No hay variantes disponibles</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
});
