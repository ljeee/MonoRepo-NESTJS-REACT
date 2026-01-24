import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useProductos, useProductosPorCategoria } from '../../hooks/use-productos';
import { Producto, ProductoVariante } from '../../hooks/use-productos';

interface MenuProps {
  onSelectItem: (producto: Producto, variante: ProductoVariante, cantidad: number) => void;
  style?: any;
}

export function Menu({ onSelectItem, style }: MenuProps) {
  const { productos, loading: loadingProductos, fetchProductos } = useProductos();
  const { categorias, loading: loadingCategorias, fetchCategorias } = useProductosPorCategoria();
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [selectedVariantes, setSelectedVariantes] = useState<Record<number, ProductoVariante>>({});

  useEffect(() => {
    fetchCategorias();
    fetchProductos();
  }, []);

  const productosFiltrados = selectedCategoria
    ? productos.filter(p => p.categoria === selectedCategoria)
    : productos;

  const handleSelectVariante = (producto: Producto, variante: ProductoVariante) => {
    setSelectedVariantes(prev => ({
      ...prev,
      [variante.varianteId]: variante,
    }));
    setCantidades(prev => ({
      ...prev,
      [variante.varianteId]: (prev[variante.varianteId] || 0) + 1,
    }));
  };

  const handleAgregar = (producto: Producto, variante: ProductoVariante) => {
    const cantidad = cantidades[variante.varianteId] || 0;
    if (cantidad > 0) {
      onSelectItem(producto, variante, cantidad);
      setCantidades(prev => ({
        ...prev,
        [variante.varianteId]: 0,
      }));
      setSelectedVariantes(prev => {
        const newSelected = { ...prev };
        delete newSelected[variante.varianteId];
        return newSelected;
      });
    }
  };

  if (loadingCategorias || loadingProductos) {
    return <ActivityIndicator />;
  }

  return (
    <ScrollView style={style}>
      {/* Categorías */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, paddingHorizontal: 12 }}>
        <TouchableOpacity
          onPress={() => setSelectedCategoria(null)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginRight: 8,
            backgroundColor: selectedCategoria === null ? '#007AFF' : '#e0e0e0',
            borderRadius: 20,
          }}
        >
          <Text style={{ color: selectedCategoria === null ? 'white' : 'black', fontWeight: '600' }}>
            Todos
          </Text>
        </TouchableOpacity>
        {categorias.map(categoria => (
          <TouchableOpacity
            key={categoria}
            onPress={() => setSelectedCategoria(categoria)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginRight: 8,
              backgroundColor: selectedCategoria === categoria ? '#007AFF' : '#e0e0e0',
              borderRadius: 20,
            }}
          >
            <Text style={{ color: selectedCategoria === categoria ? 'white' : 'black', fontWeight: '600' }}>
              {categoria}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Productos */}
      {productosFiltrados.map(producto => (
        <View key={producto.productoId} style={{ marginBottom: 20, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            {producto.productoNombre}
          </Text>
          {producto.descripcion && (
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              {producto.descripcion}
            </Text>
          )}

          {/* Variantes */}
          {producto.variantes.map(variante => (
            <View key={variante.varianteId} style={{ marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => handleSelectVariante(producto, variante)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  backgroundColor: selectedVariantes[variante.varianteId] ? '#f0f8ff' : '#fafafa',
                  borderRadius: 8,
                  borderWidth: selectedVariantes[variante.varianteId] ? 2 : 0,
                  borderColor: selectedVariantes[variante.varianteId] ? '#007AFF' : 'transparent',
                }}
              >
                <View>
                  <Text style={{ fontWeight: '600' }}>{variante.nombre}</Text>
                  {variante.descripcion && (
                    <Text style={{ fontSize: 11, color: '#999' }}>
                      {variante.descripcion}
                    </Text>
                  )}
                </View>
                <Text style={{ fontWeight: 'bold', color: '#007AFF', fontSize: 14 }}>
                  ${Number(variante.precio).toLocaleString()}
                </Text>
              </TouchableOpacity>

              {/* Cantidad y Agregar */}
              {selectedVariantes[variante.varianteId] && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() =>
                        setCantidades(prev => ({
                          ...prev,
                          [variante.varianteId]: Math.max(0, (prev[variante.varianteId] || 0) - 1),
                        }))
                      }
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                    >
                      <Text style={{ fontSize: 18, color: '#007AFF' }}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ marginHorizontal: 8, fontWeight: 'bold' }}>
                      {cantidades[variante.varianteId] || 0}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setCantidades(prev => ({
                          ...prev,
                          [variante.varianteId]: (prev[variante.varianteId] || 0) + 1,
                        }))
                      }
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                    >
                      <Text style={{ fontSize: 18, color: '#007AFF' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleAgregar(producto, variante)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      backgroundColor: '#34C759',
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '600' }}>Agregar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
