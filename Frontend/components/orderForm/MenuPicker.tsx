import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from '@/src/tw';
import { useProductos, usePizzaSabores, formatCurrency, getProductEmoji } from '@monorepo/shared';
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
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<ProductoVariante | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProductos(undefined, true);
  }, [fetchProductos]);

  const sortedProducts = useMemo(() => {
    return [...productos].sort((a, b) => a.productoNombre.localeCompare(b.productoNombre));
  }, [productos]);

  const SIZE_ORDER: Record<string, number> = { 'Pequeña': 0, 'Mediana': 1, 'Grande': 2 };
  const sortVariantes = (vs: ProductoVariante[]) =>
    [...vs].sort((a, b) => (SIZE_ORDER[a.nombre] ?? 50) - (SIZE_ORDER[b.nombre] ?? 50));

  // No longer using selectedCategory

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return sortedProducts;

    const query = searchQuery.toLowerCase();
    return sortedProducts.filter(p =>
      p.productoNombre.toLowerCase().includes(query) ||
      p.descripcion?.toLowerCase().includes(query)
    );
  }, [sortedProducts, searchQuery]);

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

      {/* No Category Filters - Direct Search Only */}

      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-20">
        <View className="flex-row flex-wrap -mx-2">
          {filteredProducts.length === 0 ? (
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
      </ScrollView>

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

  const emoji = getProductEmoji(producto.productoNombre, producto.categoria, producto.emoji);

  return (
    <View className={`px-1 mb-2 w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-[12.5%]`}>
      <View className={`bg-(--color-pos-surface) rounded-2xl border overflow-hidden ${isExpanded ? 'border-(--color-pos-primary)/40 bg-(--color-pos-surface-hover)' : 'border-white/5'}`}>
        <TouchableOpacity
          className={`items-center p-3 ${isExpanded ? 'bg-white/5' : ''}`}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          {/* Pequeño nombre arriba */}
          <Text className="text-white font-black text-[9px] uppercase tracking-tighter text-center mb-1 h-3" numberOfLines={1} style={{ fontFamily: 'Space Grotesk' }}>
            {producto.productoNombre}
          </Text>

          <View className="w-14 h-14 rounded-2xl bg-white/5 items-center justify-center mb-1">
              <Text className="text-3xl">{emoji}</Text>
          </View>

          <View className={`w-6 h-6 rounded-full items-center justify-center bg-white/5 ${isExpanded ? 'rotate-180' : ''}`}>
               <Icon name="chevron-down" size={14} color={isExpanded ? '#F5A524' : '#64748B'} />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View className="bg-black/20 p-2">
            <View className="flex-row flex-wrap gap-2">
              {sortedVariantes.length > 0 ? (
                sortedVariantes
                .filter((v) => v.activo)
                .map((variante) => (
                    <View key={variante.varianteId} className="flex-1 min-w-[140px] max-w-[200px]">
                      <TouchableOpacity
                        className="flex-row items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 h-full active:bg-(--color-pos-primary)/10 active:border-(--color-pos-primary)/30 transition-all"
                        onPress={() => {
                          if (producto.productoNombre.toLowerCase().includes('pizza')) {
                            setSelectedProducto(producto);
                            setSelectedVariante(variante);
                            setModalVisible(true);
                          } else {
                            onAdd(producto, variante);
                          }
                        }}
                      >
                        <View className="flex-1 mr-1">
                          <Text className="text-white font-black text-[9px] uppercase tracking-tight leading-tight" numberOfLines={2}>{variante.nombre}</Text>
                          <Text className="text-(--color-pos-primary) font-black text-[10px] mt-0.5" style={{ fontFamily: 'Space Grotesk' }}>
                            ${formatCurrency(Number(variante.precio))}
                          </Text>
                        </View>
                        <View className="w-6 h-6 bg-(--color-pos-primary) rounded-lg items-center justify-center">
                          <Icon name="plus" size={14} color="#000" />
                        </View>
                      </TouchableOpacity>
                    </View>
                ))
              ) : (
                <View className="p-4 w-full items-center">
                     <Text className="text-slate-500 text-xs italic">No hay variantes disponibles</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
});
