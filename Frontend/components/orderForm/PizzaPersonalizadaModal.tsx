import React, { useState } from 'react';
import { ActivityIndicator, Modal } from 'react-native';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
import type { Producto, ProductoVariante, PizzaSabor } from '@monorepo/shared';
import { formatCurrency } from '@monorepo/shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRecargo(sabor: PizzaSabor, varianteNombre: string): number {
  if (varianteNombre === 'Pequeña') return Number(sabor.recargoPequena);
  if (varianteNombre === 'Mediana') return Number(sabor.recargoMediana);
  return Number(sabor.recargoGrande);
}

function calcularPrecio(
  variante: ProductoVariante | null,
  saboresSeleccionados: string[],
  saboresCatalogo: PizzaSabor[],
): number {
  if (!variante) return 0;
  let precio = Number(variante.precio);

  const maxRecargo = saboresSeleccionados.reduce((max, nombre) => {
    const entry = saboresCatalogo.find(s => s.nombre === nombre);
    if (!entry || entry.tipo !== 'especial') return max;
    return Math.max(max, getRecargo(entry, variante.nombre));
  }, 0);

  precio += maxRecargo;

  if (saboresSeleccionados.length >= 3) {
    const config3Sabores = saboresCatalogo.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
    const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 3000;
    precio += extra3SaboresAmount;
  }

  return precio;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PizzaPersonalizadaModalProps {
  visible: boolean;
  variante: ProductoVariante | null;
  producto: Producto | null;
  saboresCatalogo: PizzaSabor[];
  loadingSabores?: boolean;
  onAdd: (producto: Producto, variante: ProductoVariante, sabores: string[]) => void;
  onClose: () => void;
}

export default function PizzaPersonalizadaModal({
  visible,
  variante,
  producto,
  saboresCatalogo,
  loadingSabores,
  onAdd,
  onClose,
}: PizzaPersonalizadaModalProps) {
  const [selectedSabores, setSelectedSabores] = useState<string[]>([]);

  const tradicionales = saboresCatalogo.filter(s => s.tipo === 'tradicional' && s.activo);
  const especiales = saboresCatalogo.filter(s => s.tipo === 'especial' && s.activo);

  const precioFinal = calcularPrecio(variante, selectedSabores, saboresCatalogo);

  const config3Sabores = saboresCatalogo.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
  const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 3000;

  const recargoEspecial = saboresCatalogo
    .filter(s => s.tipo === 'especial' && selectedSabores.includes(s.nombre))
    .reduce((max, s) => Math.max(max, getRecargo(s, variante?.nombre ?? '')), 0);

  const handleSaborPress = (nombre: string) => {
    setSelectedSabores((prev) => {
      if (prev.includes(nombre)) return prev.filter(s => s !== nombre);
      if (prev.length >= 3) return prev;
      return [...prev, nombre];
    });
  };

  const handleAdd = () => {
    if (selectedSabores.length === 0) return;
    if (producto && variante) {
      const adjustedVariante = { ...variante, precio: precioFinal };
      onAdd(producto, adjustedVariante, selectedSabores);
      setSelectedSabores([]);
    }
  };

  const handleClose = () => {
    setSelectedSabores([]);
    onClose();
  };

  const renderChip = (sabor: PizzaSabor) => {
    const isSelected = selectedSabores.includes(sabor.nombre);
    const isEspecial = sabor.tipo === 'especial';
    const recargo = variante ? getRecargo(sabor, variante.nombre) : 0;
    
    return (
      <TouchableOpacity
        key={sabor.saborId}
        onPress={() => handleSaborPress(sabor.nombre)}
        className={`px-4 py-2 rounded-xl mb-2 mr-2 border ${isSelected ? (isEspecial ? 'bg-(--color-pos-secondary)/20 border-(--color-pos-secondary)' : 'bg-(--color-pos-primary)/20 border-(--color-pos-primary)') : 'bg-white/5 border-white/10'}`}
      >
        <Text className={`font-bold text-sm ${isSelected ? (isEspecial ? 'text-(--color-pos-secondary)' : 'text-(--color-pos-primary)') : 'text-slate-400'}`}>
          {isEspecial ? '★ ' : ''}{sabor.nombre}{isSelected ? ' ✓' : ''}
          {isEspecial && recargo > 0 ? `  +$${formatCurrency(recargo)}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-5">
        <View className="bg-(--color-pos-surface) w-full max-w-lg rounded-3xl p-6 border border-white/5 shadow-2xl">
          {/* Header */}
          <Text className="text-white font-black text-2xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>🍕 Pizza {variante?.nombre}</Text>
          <Text className="text-slate-400 text-sm mt-1 mb-6">
            Selecciona 1-3 sabores • Base ${formatCurrency(Number(variante?.precio))}
          </Text>

          {/* Sabores */}
          {loadingSabores ? (
            <View className="py-10 items-center justify-center">
              <ActivityIndicator color="#F5A524" />
            </View>
          ) : (
            <ScrollView className="max-h-[60vh]" showsVerticalScrollIndicator={false}>
              <Text className="text-white font-black text-xs uppercase tracking-widest mb-3 opacity-60">Tradicionales</Text>
              <View className="flex-row flex-wrap mb-6">
                {tradicionales.map(sb => renderChip(sb))}
              </View>

              <Text className="text-(--color-pos-secondary) font-black text-xs uppercase tracking-widest mb-3">Especiales ★</Text>
              <View className="flex-row flex-wrap mb-4">
                {especiales.map(sb => renderChip(sb))}
              </View>
            </ScrollView>
          )}

          {/* Price breakdown */}
          {selectedSabores.length > 0 && (
            <View className="bg-black/20 rounded-2xl p-4 my-4">
              <Text className="text-white font-bold text-sm" numberOfLines={2}>{selectedSabores.join(' + ')}</Text>
              {recargoEspecial > 0 && (
                <Text className="text-(--color-pos-secondary) text-xs font-bold mt-1">
                  + ${formatCurrency(recargoEspecial)} sabor especial
                </Text>
              )}
              {selectedSabores.length >= 3 && (
                <Text className="text-(--color-pos-primary) text-xs font-bold mt-1">
                  + ${formatCurrency(extra3SaboresAmount)} por 3 sabores
                </Text>
              )}
            </View>
          )}

          {/* Buttons */}
          <View className="flex-row -mx-2 mt-4">
            <TouchableOpacity 
              onPress={handleClose} 
              className="flex-1 mx-2 py-4 rounded-2xl bg-white/5 items-center border border-white/5 active:bg-white/10"
            >
              <Text className="text-slate-400 font-bold">Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleAdd}
              disabled={selectedSabores.length === 0}
              className={`flex-[2] mx-2 py-4 rounded-2xl items-center shadow-lg active:scale-[0.95] transition-transform ${selectedSabores.length === 0 ? 'bg-slate-700' : 'bg-(--color-pos-primary)'}`}
            >
              <Text className={`font-black uppercase tracking-wider ${selectedSabores.length === 0 ? 'text-slate-500' : 'text-slate-900'}`}>
                {selectedSabores.length === 0 ? 'Elige sabores' : `Agregar • $${formatCurrency(precioFinal)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
