import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Text, TextInput, TouchableOpacity, View } from '../../tw';
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
    fetchProductos(true);
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

  const productColumnClass = isMobile
    ? 'w-1/2'
    : isTablet
      ? 'w-1/4'
      : 'w-[16.66%]';

  const expandedProducto = useMemo(
    () => productos.find(p => p.productoId === expandedProductId) ?? null,
    [productos, expandedProductId]
  );

  const expandedVariantes = useMemo(() => {
    if (!expandedProducto) return [];
    return [...expandedProducto.variantes]
      .sort((a, b) => (SIZE_ORDER[a.nombre] ?? 50) - (SIZE_ORDER[b.nombre] ?? 50))
      .filter(v => v.activo);
  }, [expandedProducto]);

  const handleSelectProduct = useCallback((id: number) => {
    setExpandedProductId(prev => (prev === id ? null : id));
  }, []);

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
          onPress={() => fetchProductos(true)}
          variant="danger"
        />
      </View>
    );
  }

  return (
    <View className="pb-4">
      {/* Search bar */}
      <View className="mb-6 flex-row items-center bg-white/5 rounded-2xl border border-white/10">
          <View className="pl-4 pr-2">
              <Icon name="magnify" size={20} color="#64748B" />
          </View>
          <TextInput
              className="flex-1 pr-5 py-4 text-white font-medium"
              placeholder="¿Qué deseas pedir hoy?"
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
          />
      </View>

      <View className="p-4 pb-6">
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
                isSelected={expandedProductId === producto.productoId}
                onSelect={handleSelectProduct}
                onAdd={onAdd}
                isMobile={isMobile}
                columnClass={productColumnClass}
                setSelectedProducto={setSelectedProducto}
                setSelectedVariante={setSelectedVariante}
                setModalVisible={setModalVisible}
              />
            ))
          )}
        </View>
      </View>

      {/* ─── BARRA DE VARIANTES (DOCKABLE / NO OVERLAP) ─── */}
      {expandedProducto && (
        <View className="mt-2 px-2">
          <View className="bg-(--color-pos-surface) rounded-3xl border border-(--color-pos-primary)/30 shadow-2xl overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-3 border-b border-white/5 bg-white/5">
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-8 h-8 rounded-xl bg-(--color-pos-primary)/20 items-center justify-center mr-3">
                  <Text className="text-lg">
                    {getProductEmoji(expandedProducto.productoNombre, expandedProducto.emoji)}
                  </Text>
                </View>
                <Text
                  className="text-white font-black text-xs uppercase tracking-widest flex-1"
                  numberOfLines={1}
                >
                  {expandedProducto.productoNombre}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setExpandedProductId(null)}
                className="p-3"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap p-4 gap-3">
              {expandedVariantes.length === 0 ? (
                <Text className="text-slate-500 italic py-2">Sin variantes disponibles</Text>
              ) : (
                expandedVariantes.map((variante) => {
                const producto = expandedProducto;
                return (
                  <TouchableOpacity
                    key={variante.varianteId}
                    className={`bg-[#1E293B] border border-white/10 p-4 rounded-2xl flex-col items-start active:bg-(--color-pos-primary)/20 active:border-(--color-pos-primary)/40 mb-1 ${isMobile ? 'w-[48%]' : 'w-[31%]'}`}
                    onPress={() => {
                      const nameLower = producto.productoNombre.toLowerCase();
                      const isPizza = nameLower.includes('pizza') && !nameLower.includes('burguer');
                      
                      if (isPizza) {
                        setSelectedProducto(producto);
                        setSelectedVariante(variante);
                        setModalVisible(true);
                      } else {
                        onAdd(producto, variante);
                      }
                    }}
                  >
                    <View className="w-full mb-3">
                      <Text className="text-slate-100 font-bold text-[13px] uppercase tracking-tight leading-tight mb-1">
                        {variante.nombre}
                      </Text>
                      <Text className="text-(--color-pos-primary) font-black text-sm">
                        ${formatCurrency(Number(variante.precio))}
                      </Text>
                    </View>
                    <View className="w-full flex-row justify-end">
                      <View className="w-8 h-8 bg-(--color-pos-primary) rounded-xl items-center justify-center shadow-lg">
                        <Icon name="plus" size={18} color="#000" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
                })
              )}
            </View>
          </View>
        </View>
      )}

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
  isSelected: boolean;
  onSelect: (id: number) => void;
  onAdd: (p: Producto, v: ProductoVariante, s?: string[]) => void;
  isMobile: boolean;
  columnClass: string;
  setSelectedProducto: (p: Producto) => void;
  setSelectedVariante: (v: ProductoVariante) => void;
  setModalVisible: (v: boolean) => void;
}

const ProductItem = React.memo(({
  producto, isSelected, onSelect, onAdd, isMobile, columnClass,
  setSelectedProducto, setSelectedVariante, setModalVisible
}: ProductItemProps) => {

  const emoji = getProductEmoji(producto.productoNombre, producto.emoji);
  const handlePress = useCallback(() => onSelect(producto.productoId), [onSelect, producto.productoId]);

  return (
    <View className={`px-1 mb-2 ${columnClass}`}>
      <TouchableOpacity
        className={`bg-(--color-pos-surface) rounded-2xl border p-3 items-center ${isSelected ? 'border-(--color-pos-primary) bg-(--color-pos-surface-hover) shadow-2xl shadow-(--color-pos-primary)/20' : 'border-white/5'}`}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text className={`text-white font-black text-[10px] uppercase tracking-tighter text-center mb-1 min-h-[2.5rem] flex items-center justify-center ${isSelected ? 'text-(--color-pos-primary)' : ''}`} numberOfLines={2} style={{ fontFamily: 'Space Grotesk' }}>
          {producto.productoNombre}
        </Text>

        <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-1 border ${isSelected ? 'bg-(--color-pos-primary)/10 border-(--color-pos-primary)/20' : 'bg-white/5 border-white/8'}`}>
            <Text style={{ fontSize: 26 }}>{emoji}</Text>
        </View>

        <View className={`w-6 h-6 rounded-full items-center justify-center ${isSelected ? 'bg-(--color-pos-primary)' : 'bg-white/5'}`}>
             <Icon name={isSelected ? "check" : "chevron-down"} size={14} color={isSelected ? '#000' : '#64748B'} />
        </View>
      </TouchableOpacity>
    </View>
  );
});
