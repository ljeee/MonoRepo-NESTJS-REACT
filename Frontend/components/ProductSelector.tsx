import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useProductos } from '../../hooks/use-productos';
import { Producto, ProductoVariante } from '../../hooks/use-productos';

interface ProductSelectorProps {
  onSelect: (producto: Producto, variante: ProductoVariante) => void;
  categoria?: string;
}

export function ProductSelector({ onSelect, categoria }: ProductSelectorProps) {
  const { productos, loading, error, fetchProductos } = useProductos();
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [selectedVariante, setSelectedVariante] = useState<ProductoVariante | null>(null);

  useEffect(() => {
    fetchProductos(categoria, true);
  }, [categoria, fetchProductos]);

  const handleSelectVariante = (variante: ProductoVariante) => {
    if (selectedProducto) {
      setSelectedVariante(variante);
      onSelect(selectedProducto, variante);
    }
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  if (error) {
    return <Text style={{ color: 'red' }}>{error}</Text>;
  }

  return (
    <ScrollView>
      {productos.map(producto => (
        <View key={producto.productoId} style={{ marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setSelectedProducto(selectedProducto?.productoId === producto.productoId ? null : producto)}
            style={{
              padding: 12,
              backgroundColor: selectedProducto?.productoId === producto.productoId ? '#007AFF' : '#f0f0f0',
              borderRadius: 8,
            }}
          >
            <Text style={{ fontWeight: 'bold', color: selectedProducto?.productoId === producto.productoId ? 'white' : 'black' }}>
              {producto.productoNombre}
            </Text>
            {producto.descripcion && (
              <Text style={{ fontSize: 12, color: selectedProducto?.productoId === producto.productoId ? '#ddd' : '#666' }}>
                {producto.descripcion}
              </Text>
            )}
          </TouchableOpacity>

          {selectedProducto?.productoId === producto.productoId && producto.variantes.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {producto.variantes.map(variante => (
                <TouchableOpacity
                  key={variante.varianteId}
                  onPress={() => handleSelectVariante(variante)}
                  style={{
                    padding: 10,
                    marginLeft: 16,
                    backgroundColor: selectedVariante?.varianteId === variante.varianteId ? '#34C759' : '#e8e8e8',
                    borderRadius: 6,
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: selectedVariante?.varianteId === variante.varianteId ? 'white' : 'black' }}>
                    {variante.nombre} - ${variante.precio.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
