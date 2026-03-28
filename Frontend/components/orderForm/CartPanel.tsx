import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
import { formatCurrency } from '@monorepo/shared';

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

const CartPanel = React.memo(({ items, onRemove, onUpdateCantidad, costoDomicilio = 0 }: CartPanelProps) => {
  const subtotal = items.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0);
  const total = subtotal + costoDomicilio;

  if (items.length === 0) {
    return (
      <View className="bg-(--color-pos-bg)/50 rounded-2xl p-8 items-center justify-center border border-white/5 border-dashed mb-5">
        <Text className="text-slate-500 font-medium">Agrega productos desde el menú</Text>
      </View>
    );
  }

  return (
    <View className="bg-(--color-pos-bg)/50 rounded-2xl p-5 border border-white/5 mb-5">
      <Text className="text-white font-black uppercase tracking-widest text-base mb-4 opacity-80">🛒 Resumen del pedido</Text>

      <ScrollView className="max-h-72" nestedScrollEnabled>
        {items.map((item) => (
          <View key={item.id} className="flex-row items-center py-3 border-b border-white/5">
            <View className="flex-1 mr-2">
              <Text className="text-white font-bold text-base" numberOfLines={1}>
                {item.productoNombre}
              </Text>
              <Text className="text-slate-400 text-xs uppercase font-medium">{item.varianteNombre}</Text>
              {item.sabores && item.sabores.length > 0 && (
                <Text className="text-(--color-pos-primary) text-[10px] font-bold mt-0.5" numberOfLines={1}>
                  SABORES: {item.sabores.join(', ')}
                </Text>
              )}
            </View>

            <View className="flex-row items-center bg-black/20 rounded-lg p-1 mr-3">
              <TouchableOpacity
                onPress={() =>
                  item.cantidad > 1
                    ? onUpdateCantidad(item.id, item.cantidad - 1)
                    : onRemove(item.id)
                }
                className="w-7 h-7 items-center justify-center rounded-md bg-white/5 active:bg-white/10"
              >
                <Text className="text-white font-bold">−</Text>
              </TouchableOpacity>

              <Text className="text-white font-black mx-3 text-sm">{item.cantidad}</Text>

              <TouchableOpacity
                onPress={() => onUpdateCantidad(item.id, item.cantidad + 1)}
                className="w-7 h-7 items-center justify-center rounded-md bg-white/5 active:bg-white/10"
              >
                <Text className="text-white font-bold">+</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-white font-black text-sm w-20 text-right">
              ${formatCurrency(item.precioUnitario * item.cantidad)}
            </Text>

            <TouchableOpacity 
              onPress={() => onRemove(item.id)} 
              className="ml-3 w-8 h-8 items-center justify-center rounded-full bg-red-500/10 active:bg-red-500/20"
            >
              <Text className="text-red-500 font-bold text-xs">✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View className="mt-4 pt-4 border-t border-white/10">
        {costoDomicilio > 0 && (
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-slate-400 text-xs font-medium">🛵 DOMICILIO</Text>
            <Text className="text-slate-400 text-xs font-bold">${formatCurrency(costoDomicilio)}</Text>
          </View>
        )}
        <View className="flex-row justify-between items-center">
          <Text className="text-white font-black text-lg">TOTAL</Text>
          <Text className="text-(--color-pos-primary) font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>
            ${formatCurrency(total)}
          </Text>
        </View>
      </View>
    </View>
  );
});

export default CartPanel;
