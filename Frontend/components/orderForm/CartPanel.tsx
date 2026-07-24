import React, { useState, useCallback } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from '../../tw';
import Icon from '../ui/Icon';
import { formatCurrency } from '@/src/shared';

export interface CartItem {
  id: string; // unique key for the cart row
  productoNombre: string;
  varianteNombre: string;
  varianteId: number;
  precioUnitario: number;
  /** Precio manual del cajero; cuando existe, es el que se cobra. */
  precioOverride?: number;
  cantidad: number;
  sabores?: string[]; // Optional: for Pizza Personalizada
  base?: 'leche' | 'agua'; // Optional: for juices
}

/** Precio efectivo de la línea: el manual si lo hay, si no el calculado. */
const precioDe = (i: CartItem) => i.precioOverride ?? i.precioUnitario;

interface CartPanelProps {
  items: CartItem[];
  onRemove: (id: string) => void;
  onUpdateCantidad: (id: string, cantidad: number) => void;
  /** `null` restaura el precio calculado del producto. */
  onUpdatePrecio?: (id: string, precio: number | null) => void;
  /** Copia el carrito como texto de cotización para enviar al cliente. */
  onCopyQuote?: () => void;
  costoDomicilio?: number;
}

const CartPanel = React.memo(({ items, onRemove, onUpdateCantidad, onUpdatePrecio, onCopyQuote, costoDomicilio = 0 }: CartPanelProps) => {
  const subtotal = items.reduce((sum, i) => sum + precioDe(i) * i.cantidad, 0);
  const total = subtotal + costoDomicilio;

  // Edición inline del precio unitario: solo una fila a la vez.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = useCallback((item: CartItem) => {
    if (!onUpdatePrecio) return;
    setEditingId(item.id);
    setDraft(String(precioDe(item)));
  }, [onUpdatePrecio]);

  // Confirmar: vacío = restaurar el precio calculado.
  const commitEdit = useCallback(() => {
    if (!editingId || !onUpdatePrecio) { setEditingId(null); return; }
    const digits = draft.replace(/\D/g, '');
    onUpdatePrecio(editingId, digits === '' ? null : Number(digits));
    setEditingId(null);
  }, [editingId, draft, onUpdatePrecio]);

  if (items.length === 0) {
    return (
      <View className="bg-(--color-pos-bg)/50 rounded-2xl p-6 items-center justify-center border border-white/5 border-dashed mb-5">
        <Text className="text-slate-500 font-medium">Agrega productos desde el menú</Text>
      </View>
    );
  }

  return (
    <View className="bg-(--color-pos-bg)/50 rounded-2xl p-5 border border-white/5 mb-5">
      <View className="flex-row items-center gap-2 mb-4">
        <Icon name="cart-outline" size={16} color="#94A3B8" />
        <Text className="text-white font-black uppercase tracking-widest text-base opacity-80">Resumen del pedido</Text>
      </View>

      <ScrollView className="max-h-72" nestedScrollEnabled>
        {items.map((item) => (
          <View key={item.id} className="py-3.5 border-b border-white/10">
            {/* Top Row: Name and Delete */}
            <View className="flex-row justify-between items-start mb-1">
              <View className="flex-1 mr-2">
                 <Text className="text-white font-black text-sm uppercase tracking-tight" numberOfLines={2}>
                   {item.productoNombre}
                 </Text>
                 <Text className="text-slate-500 text-[10px] uppercase font-bold italic">{item.varianteNombre}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => onRemove(item.id)} 
                className="w-7 h-7 items-center justify-center rounded-lg bg-red-500/10 active:bg-red-500/20"
              >
                <Text className="text-red-500 font-bold text-xs">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Row: Controls and Price */}
            <View className="flex-row items-center justify-between mt-2">
              <View className="flex-row items-center bg-black/30 rounded-xl p-1 px-2 border border-white/5">
                <TouchableOpacity
                  onPress={() =>
                    item.cantidad > 1
                      ? onUpdateCantidad(item.id, item.cantidad - 1)
                      : onRemove(item.id)
                  }
                  className="w-6 h-6 items-center justify-center rounded-lg bg-white/5 active:bg-white/10"
                >
                  <Text className="text-white font-black">−</Text>
                </TouchableOpacity>

                <Text className="text-white font-black mx-3 text-xs">{item.cantidad}</Text>

                <TouchableOpacity
                  onPress={() => onUpdateCantidad(item.id, item.cantidad + 1)}
                  className="w-6 h-6 items-center justify-center rounded-lg bg-white/5 active:bg-white/10"
                >
                  <Text className="text-white font-black">+</Text>
                </TouchableOpacity>
              </View>

              {editingId === item.id ? (
                <View className="flex-row items-center bg-black/40 rounded-xl border border-(--color-pos-primary)/50 px-2">
                  <Text className="text-(--color-pos-primary) font-black text-sm">$</Text>
                  <TextInput
                    className="text-white font-black text-sm px-1 py-1.5 min-w-[92px] text-right"
                    value={draft}
                    onChangeText={(v: string) => setDraft(v.replace(/\D/g, ''))}
                    keyboardType="numeric"
                    autoFocus
                    selectTextOnFocus
                    onBlur={commitEdit}
                    onSubmitEditing={commitEdit}
                    placeholder="0"
                    placeholderTextColor="#475569"
                  />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => startEdit(item)}
                  disabled={!onUpdatePrecio}
                  className="items-end active:opacity-60"
                >
                  <Text className="text-(--color-pos-primary) font-black text-base" style={{ fontFamily: 'Space Grotesk' }}>
                    ${formatCurrency(precioDe(item) * item.cantidad)}
                  </Text>
                  {onUpdatePrecio && (
                    <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">
                      ${formatCurrency(precioDe(item))} c/u · tocar para editar
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Precio manual: aviso + restaurar el calculado */}
            {item.precioOverride != null && (
              <TouchableOpacity
                onPress={() => onUpdatePrecio?.(item.id, null)}
                disabled={!onUpdatePrecio}
                className="flex-row items-center gap-1.5 mt-2 self-start bg-amber-500/15 px-2 py-1 rounded-full active:opacity-70"
              >
                <Icon name="tag-outline" size={10} color="#F5A524" />
                <Text className="text-amber-400 text-[9px] font-black uppercase tracking-widest">
                  Precio manual · antes ${formatCurrency(item.precioUnitario)} · restaurar
                </Text>
              </TouchableOpacity>
            )}

            {/* Base del jugo */}
            {item.base && (
              <View className="flex-row mt-1.5 gap-1">
                <View
                  className={`px-2 py-0.5 rounded-full ${item.base === 'leche' ? 'bg-amber-500/15' : 'bg-sky-500/15'}`}
                >
                  <Text
                    className={`text-[9px] font-black uppercase tracking-widest ${item.base === 'leche' ? 'text-amber-400' : 'text-sky-400'}`}
                  >
                    {item.base === 'leche' ? '🥛 Leche' : '💧 Agua'}
                  </Text>
                </View>
              </View>
            )}

            {/* Flavors (if any) */}
            {item.sabores && item.sabores.length > 0 && (
              <Text className="text-slate-400 text-[9px] font-bold mt-2 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md" numberOfLines={1}>
                {item.sabores.join(' — ')}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      <View className="mt-4 pt-4 border-t border-white/10">
        {costoDomicilio > 0 && (
          <View className="flex-row justify-between items-center mb-1">
            <View className="flex-row items-center gap-1.5">
              <Icon name="moped-outline" size={12} color="#94A3B8" />
              <Text className="text-slate-400 text-xs font-medium">DOMICILIO</Text>
            </View>
            <Text className="text-slate-400 text-xs font-bold">${formatCurrency(costoDomicilio)}</Text>
          </View>
        )}
        <View className="flex-row justify-between items-center">
          <Text className="text-white font-black text-lg">TOTAL</Text>
          <Text className="text-(--color-pos-primary) font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>
            ${formatCurrency(total)}
          </Text>
        </View>

        {onCopyQuote && (
          <TouchableOpacity
            onPress={onCopyQuote}
            className="flex-row items-center justify-center gap-2 mt-3 py-3 rounded-xl bg-white/5 border border-white/10 active:bg-white/10"
          >
            <Icon name="content-copy" size={15} color="#94A3B8" />
            <Text className="text-slate-300 font-black text-xs uppercase tracking-widest">Copiar cotización</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default CartPanel;
