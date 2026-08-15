import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Text, TextInput, TouchableOpacity, View } from '../../tw';
import { useProductos, usePizzaSabores, formatCurrency, getProductEmoji, resolverPersonalizacion } from '@/src/shared';
import type { Producto, ProductoVariante } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';
import PizzaPersonalizadaModal from './PizzaPersonalizadaModal';
import JugoBaseModal from './JugoBaseModal';
import Icon from '../ui/Icon';
import { Button } from '../ui';

interface MenuPickerProps {
  onAdd: (producto: Producto, variante: ProductoVariante, sabores?: string[], base?: 'leche' | 'agua') => void;
  recargoLeche?: number;
}

// Normaliza para búsqueda: minúsculas, sin tildes, coma→punto (teclado numérico CO da coma).
// Así "1,5" matchea "1.5 LITROS" y viceversa.
const normalize = (s: string) =>
  (s || '').toLowerCase().replace(/,/g, '.').normalize('NFD').replace(/[̀-ͯ]/g, '');

const SIZE_ORDER: Record<string, number> = { 'Pequeña': 0, 'Mediana': 1, 'Grande': 2 };

function MenuPicker({ onAdd, recargoLeche }: MenuPickerProps) {
  const { productos, loading, error, fetchProductos } = useProductos();
  const { sabores: saboresCatalogo, loading: loadingSabores } = usePizzaSabores();
  const { isMobile, isTablet } = useBreakpoint();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<ProductoVariante | null>(null);
  // Config del modal de sabores: pizza (catálogo, 3) vs calzone (sabores propios, 2)
  const [modalCustomSabores, setModalCustomSabores] = useState<string[] | undefined>(undefined);
  const [modalMaxSabores, setModalMaxSabores] = useState(3);
  const [jugoModalVisible, setJugoModalVisible] = useState(false);
  const [selectedJugoProducto, setSelectedJugoProducto] = useState<Producto | null>(null);
  const [selectedJugoVariante, setSelectedJugoVariante] = useState<ProductoVariante | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [varianteSearch, setVarianteSearch] = useState('');

  useEffect(() => {
    fetchProductos(true);
  }, [fetchProductos]);

  // Limpiar la búsqueda de variante al cambiar/colapsar el producto expandido
  useEffect(() => {
    setVarianteSearch('');
  }, [expandedProductId]);

  const queryTokens = useMemo(() => {
    return normalize(searchQuery).split(/\s+/).filter(Boolean);
  }, [searchQuery]);

  const sortedProducts = useMemo(() => {
    return [...productos].sort((a, b) => a.productoNombre.localeCompare(b.productoNombre));
  }, [productos]);

  const filteredProducts = useMemo(() => {
    if (queryTokens.length === 0) return sortedProducts;

    return sortedProducts.filter(p => {
      const prodText = normalize(p.productoNombre) + ' ' + normalize(p.descripcion || '');
      // 1. Match en producto
      if (queryTokens.every(token => prodText.includes(token))) {
        return true;
      }
      // 2. Match en combinación de producto + variante activa
      return (p.variantes || []).some(v => {
        if (!v.activo) return false;
        const varText = normalize(v.nombre);
        return queryTokens.every(token => prodText.includes(token) || varText.includes(token));
      });
    });
  }, [sortedProducts, queryTokens]);

  // Auto-expandir el producto si hay una búsqueda activa y solo 1 resultado coincidente
  useEffect(() => {
    if (queryTokens.length > 0 && filteredProducts.length === 1) {
      setExpandedProductId(filteredProducts[0].productoId);
    }
  }, [queryTokens, filteredProducts]);

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

  // Estado para mostrar todas las variantes si se desea saltar el filtro de búsqueda
  const [showAllVariantesOverride, setShowAllVariantesOverride] = useState(false);
  useEffect(() => {
    setShowAllVariantesOverride(false);
  }, [expandedProductId, searchQuery]);

  // Buscador de variante: solo cuando hay muchas (p. ej. gaseosas con muchos tamaños/marcas)
  const showVarianteSearch = expandedVariantes.length > 6;
  const visibleVariantes = useMemo(() => {
    if (!expandedProducto) return [];

    // Si se busca específicamente en el input de variantes
    if (varianteSearch.trim()) {
      const q = normalize(varianteSearch);
      return expandedVariantes.filter(v => normalize(v.nombre).includes(q));
    }

    // Si el usuario pidió ver todas
    if (showAllVariantesOverride) {
      return expandedVariantes;
    }

    // Si hay búsqueda en el buscador principal, filtrar las variantes que calzan
    if (queryTokens.length > 0) {
      const prodText = normalize(expandedProducto.productoNombre) + ' ' + normalize(expandedProducto.descripcion || '');
      const matching = expandedVariantes.filter(v => {
        const varText = normalize(v.nombre);
        return queryTokens.every(token => prodText.includes(token) || varText.includes(token));
      });
      if (matching.length > 0) {
        return matching;
      }
    }

    return expandedVariantes;
  }, [expandedProducto, expandedVariantes, varianteSearch, queryTokens, showAllVariantesOverride]);

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
              className="flex-1 pr-3 py-4 text-white font-medium"
              placeholder="¿Qué deseas pedir hoy? (ej. Pizza, Grande, Doble carne...)"
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="pr-4 py-2" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
      </View>

      <View className="p-4 pb-6">
        <View className="flex-row flex-wrap -mx-2">
          {filteredProducts.length === 0 ? (
            <View className="w-full py-20 items-center opacity-50">
              <Icon name="tag-off-outline" size={64} color="#64748B" />
              <Text className="text-slate-400 font-bold mt-4 uppercase tracking-widest text-xs">Sin resultados para &ldquo;{searchQuery}&rdquo;</Text>
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
                queryTokens={queryTokens}
              />
            ))
          )}
        </View>
      </View>

      {/* ─── BARRA DE VARIANTES (DOCKABLE / NO OVERLAP) ─── */}
      {expandedProducto && (
        <View className="mt-2 px-2">
          <View className="bg-(--color-pos-surface) rounded-3xl border border-(--color-pos-primary)/30 shadow-2xl overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-3 border-b border-white/5 bg-white/5 flex-wrap gap-2">
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

              <View className="flex-row items-center gap-2">
                {visibleVariantes.length < expandedVariantes.length && !showAllVariantesOverride && (
                  <TouchableOpacity
                    onPress={() => setShowAllVariantesOverride(true)}
                    className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 flex-row items-center gap-1"
                  >
                    <Icon name="eye-outline" size={13} color="#F5A524" />
                    <Text className="text-[10px] font-bold text-amber-400">
                      Ver todas ({expandedVariantes.length})
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setExpandedProductId(null)}
                  className="p-2"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {showVarianteSearch && (
              <View className="px-4 pt-3">
                <View className="flex-row items-center bg-black/20 rounded-xl border border-white/10">
                  <View className="pl-3 pr-1">
                    <Icon name="magnify" size={16} color="#64748B" />
                  </View>
                  <TextInput
                    className="flex-1 pr-3 py-2.5 text-white text-sm font-medium"
                    placeholder="Buscar variante (ej. 1,5)…"
                    placeholderTextColor="#64748B"
                    value={varianteSearch}
                    onChangeText={setVarianteSearch}
                  />
                  {varianteSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setVarianteSearch('')} className="px-3" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="close" size={16} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <View className="flex-row flex-wrap p-4 gap-3">
              {visibleVariantes.length === 0 ? (
                <View className="w-full py-4 items-center gap-2">
                  <Text className="text-slate-500 italic">
                    {varianteSearch || searchQuery ? `Sin coincidencias para la búsqueda actual` : 'Sin variantes disponibles'}
                  </Text>
                  {expandedVariantes.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setVarianteSearch('');
                        setShowAllVariantesOverride(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20"
                    >
                      <Text className="text-amber-400 text-xs font-bold">Ver todas las variantes ({expandedVariantes.length})</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                visibleVariantes.map((variante) => {
                const producto = expandedProducto;
                return (
                  <TouchableOpacity
                    key={variante.varianteId}
                    className={`bg-[#1E293B] border border-white/10 p-4 rounded-2xl flex-col items-start active:bg-(--color-pos-primary)/20 active:border-(--color-pos-primary)/40 mb-1 ${isMobile ? 'w-[48%]' : 'w-[31%]'}`}
                    onPress={() => {
                      // Personalización data-driven (con fallback por nombre)
                      const pers = resolverPersonalizacion(producto);
                      const isCalzone = pers === 'calzone';

                      if (pers === 'pizza' || pers === 'calzone') {
                        setSelectedProducto(producto);
                        setSelectedVariante(variante);
                        // Calzone: sabores del catálogo con tipo === 'calzone' (precio plano), tope 2.
                        setModalCustomSabores(isCalzone ? (saboresCatalogo ?? []).filter(s => s.tipo === 'calzone' && s.activo).map(s => s.nombre) : undefined);
                        setModalMaxSabores(isCalzone ? 2 : 3);
                        setModalVisible(true);
                      } else if (pers === 'jugo') {
                        setSelectedJugoProducto(producto);
                        setSelectedJugoVariante(variante);
                        setJugoModalVisible(true);
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

      {selectedJugoProducto && selectedJugoVariante && (
        <JugoBaseModal
          visible={jugoModalVisible}
          producto={selectedJugoProducto}
          variante={selectedJugoVariante}
          recargoLeche={recargoLeche}
          onAdd={(p, v, base) => {
            onAdd(p, v, undefined, base);
            setJugoModalVisible(false);
            setSelectedJugoProducto(null);
            setSelectedJugoVariante(null);
          }}
          onClose={() => {
            setJugoModalVisible(false);
            setSelectedJugoProducto(null);
            setSelectedJugoVariante(null);
          }}
        />
      )}

      {selectedProducto && selectedVariante && (
        <PizzaPersonalizadaModal
          visible={modalVisible}
          producto={selectedProducto}
          variante={selectedVariante}
          saboresCatalogo={saboresCatalogo}
          loadingSabores={loadingSabores}
          maxSabores={modalMaxSabores}
          customSabores={modalCustomSabores}
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
  queryTokens: string[];
}

const ProductItem = React.memo(({
  producto, isSelected, onSelect, onAdd, isMobile, columnClass,
  setSelectedProducto, setSelectedVariante, setModalVisible, queryTokens
}: ProductItemProps) => {

  const emoji = getProductEmoji(producto.productoNombre, producto.emoji);
  const handlePress = useCallback(() => onSelect(producto.productoId), [onSelect, producto.productoId]);

  const matchingVariantNames = useMemo(() => {
    if (queryTokens.length === 0) return [];
    const prodText = normalize(producto.productoNombre) + ' ' + normalize(producto.descripcion || '');
    // Si el nombre del producto ya cubre todos los tokens, no es necesario destacar variantes individuales
    const prodMatchesAll = queryTokens.every(t => prodText.includes(t));
    if (prodMatchesAll) return [];

    return (producto.variantes || [])
      .filter(v => v.activo && queryTokens.every(t => prodText.includes(t) || normalize(v.nombre).includes(t)))
      .map(v => v.nombre);
  }, [producto, queryTokens]);

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

        {matchingVariantNames.length > 0 && (
          <View className="mb-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md max-w-full">
            <Text className="text-amber-400 text-[9px] font-black uppercase text-center" numberOfLines={1}>
              {matchingVariantNames.join(', ')}
            </Text>
          </View>
        )}

        <View className={`w-6 h-6 rounded-full items-center justify-center ${isSelected ? 'bg-(--color-pos-primary)' : 'bg-white/5'}`}>
             <Icon name={isSelected ? "check" : "chevron-down"} size={14} color={isSelected ? '#000' : '#64748B'} />
        </View>
      </TouchableOpacity>
    </View>
  );
});

ProductItem.displayName = 'ProductItem';

const MemoizedMenuPicker = React.memo(MenuPicker);
MemoizedMenuPicker.displayName = 'MenuPicker';

export default MemoizedMenuPicker;
