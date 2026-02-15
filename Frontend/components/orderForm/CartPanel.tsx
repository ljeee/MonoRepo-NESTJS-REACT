import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { cartPanelStyles as s } from '../../styles/ordenes/cart-panel.styles';
import { formatCurrency } from '../../utils/formatNumber';

export interface CartItem {
  id: string; // unique key for the cart row
  productoNombre: string;
  varianteNombre: string;
  varianteId: number;
  precioUnitario: number;
  cantidad: number;
  sabores?: string[]; // Optional: for Pizza Personalizada
}

interface CartPanelProps {
  items: CartItem[];
  onRemove: (id: string) => void;
  onUpdateCantidad: (id: string, cantidad: number) => void;
  costoDomicilio?: number;
}

export default function CartPanel({ items, onRemove, onUpdateCantidad, costoDomicilio = 0 }: CartPanelProps) {
  const subtotal = items.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0);
  const total = subtotal + costoDomicilio;

  if (items.length === 0) {
    return (
      <View style={s.emptyContainer}>
        <Text style={s.emptyText}>Agrega productos desde el menú</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.header}>🛒 Resumen del pedido</Text>

      <ScrollView style={s.list} nestedScrollEnabled>
        {items.map((item) => (
          <View key={item.id} style={s.row}>
            <View style={s.info}>
              <Text style={s.name} numberOfLines={1}>
                {item.productoNombre}
              </Text>
              <Text style={s.variant}>{item.varianteNombre}</Text>
              {item.sabores && item.sabores.length > 0 && (
                <Text style={s.variant} numberOfLines={1}>
                  Sabores: {item.sabores.join(', ')}
                </Text>
              )}
            </View>

            <View style={s.actions}>
              <TouchableOpacity
                onPress={() =>
                  item.cantidad > 1
                    ? onUpdateCantidad(item.id, item.cantidad - 1)
                    : onRemove(item.id)
                }
                style={s.qtyBtn}
              >
                <Text style={s.qtyBtnText}>−</Text>
              </TouchableOpacity>

              <Text style={s.qty}>{item.cantidad}</Text>

              <TouchableOpacity
                onPress={() => onUpdateCantidad(item.id, item.cantidad + 1)}
                style={s.qtyBtn}
              >
                <Text style={s.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.subtotal}>
              ${formatCurrency(item.precioUnitario * item.cantidad)}
            </Text>

            <TouchableOpacity onPress={() => onRemove(item.id)} style={s.removeBtn}>
              <Text style={s.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {costoDomicilio > 0 && (
        <View style={[s.totalRow, { borderTopWidth: 0, paddingTop: 2 }]}>
          <Text style={[s.totalLabel, { fontSize: 13, fontWeight: '400' }]}>🛵 Domicilio</Text>
          <Text style={[s.totalValue, { fontSize: 13, fontWeight: '400' }]}>${formatCurrency(costoDomicilio)}</Text>
        </View>
      )}
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>TOTAL</Text>
        <Text style={s.totalValue}>${formatCurrency(total)}</Text>
      </View>
    </View>
  );
}
