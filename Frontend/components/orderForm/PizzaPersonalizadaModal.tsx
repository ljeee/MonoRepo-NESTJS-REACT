import React, { useState } from 'react';
import { ActivityIndicator, Modal, useWindowDimensions } from 'react-native';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
import Icon from '../ui/Icon';
import type { Producto, ProductoVariante, PizzaSabor } from '@/src/shared';
import { formatCurrency } from '@/src/shared';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRecargo(sabor: PizzaSabor, varianteNombre: string): number {
  const v = (varianteNombre || '').toLowerCase().trim();
  if (v.includes('pequeña') || v.includes('pequena') || v.includes('personal')) return Number(sabor.recargoPequena) || 0;
  if (v.includes('mediana') || v.includes('mediano')) return Number(sabor.recargoMediana) || 0;
  return Number(sabor.recargoGrande) || 0;
}

function calcularPrecio(variante: ProductoVariante | null, saboresSeleccionados: string[], saboresCatalogo: PizzaSabor[]): number {
  if (!variante) return 0;
  let precio = Number(variante.precio);
  const maxRecargo = saboresSeleccionados.reduce((max, nombre) => {
    const entry = saboresCatalogo.find(s => s.nombre === nombre);
    if (!entry || entry.tipo !== 'especial') return max;
    return Math.max(max, getRecargo(entry, variante.nombre));
  }, 0);
  precio += maxRecargo;
  if (saboresSeleccionados.length >= 3) {
    const cfg = saboresCatalogo.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
    precio += cfg ? getRecargo(cfg, variante.nombre) : 3000;
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
  visible, variante, producto, saboresCatalogo, loadingSabores, onAdd, onClose,
}: PizzaPersonalizadaModalProps) {
  const [selectedSabores, setSelectedSabores] = useState<string[]>([]);
  const { height: screenHeight } = useWindowDimensions();

  const tradicionales = saboresCatalogo.filter(s => s.tipo === 'tradicional' && s.activo);
  const especiales = saboresCatalogo.filter(s => s.tipo === 'especial' && s.activo);
  const precioFinal = calcularPrecio(variante, selectedSabores, saboresCatalogo);
  const cfg3 = saboresCatalogo.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
  const extra3 = cfg3 ? getRecargo(cfg3, variante?.nombre ?? '') : 3000;
  const recargoEspecial = saboresCatalogo
    .filter(s => s.tipo === 'especial' && selectedSabores.includes(s.nombre))
    .reduce((max, s) => Math.max(max, getRecargo(s, variante?.nombre ?? '')), 0);

  const handleSaborPress = (nombre: string) => {
    setSelectedSabores(prev => {
      if (prev.includes(nombre)) return prev.filter(s => s !== nombre);
      if (prev.length >= 3) return prev;
      return [...prev, nombre];
    });
  };

  const handleAdd = () => {
    if (!selectedSabores.length || !producto || !variante) return;
    onAdd(producto, { ...variante, precio: precioFinal }, selectedSabores);
    setSelectedSabores([]);
  };

  const handleClose = () => { setSelectedSabores([]); onClose(); };

  const renderChip = (sabor: PizzaSabor) => {
    const isSelected = selectedSabores.includes(sabor.nombre);
    const isEspecial = sabor.tipo === 'especial';
    const recargo = variante ? getRecargo(sabor, variante.nombre) : 0;
    return (
      <TouchableOpacity
        key={sabor.saborId}
        onPress={() => handleSaborPress(sabor.nombre)}
        className={`px-3 py-1.5 rounded-xl mb-1.5 mr-1.5 border flex-row items-center gap-1.5 ${isSelected ? (isEspecial ? 'bg-white/5 border-white/20' : 'bg-(--color-pos-primary)/20 border-(--color-pos-primary)') : 'bg-white/5 border-white/10'}`}
      >
        {isEspecial && <Icon name="star" size={10} color={isSelected ? '#94A3B8' : '#475569'} />}
        <Text
          className={`font-bold text-sm ${isSelected ? (isEspecial ? 'text-slate-300' : 'text-(--color-pos-primary)') : 'text-slate-400'}`}
          numberOfLines={2}
        >
          {sabor.nombre}{isSelected ? ' ✓' : ''}
          {isEspecial && recargo > 0 ? `  +$${formatCurrency(recargo)}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* Backdrop */}
      <View className="flex-1 bg-black/85" style={{ justifyContent: 'flex-end' }}>
        {/* Bottom-sheet card — className carries static styles, style only for dynamic maxHeight */}
        <View
          className="bg-(--color-pos-surface) w-full border border-white/5 shadow-2xl overflow-hidden"
          style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: screenHeight * 0.88 }}
        >
          {/* Drag handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-9 h-1 rounded-full bg-white/15" />
          </View>

          {/* Header */}
          <View className="flex-row items-center gap-3 px-5 pt-2 pb-2">
            <View className="w-10 h-10 rounded-xl bg-orange-500/15 items-center justify-center border border-orange-500/25">
              <Icon name="pizza" size={20} color="#F5A524" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-black text-xl tracking-tighter" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                Pizza {variante?.nombre}
              </Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                Hasta 3 sabores • Base ${formatCurrency(Number(variante?.precio))}
              </Text>
            </View>
          </View>

          {/* Slot indicators */}
          <View className="flex-row gap-1.5 px-5 pb-3">
            {[0, 1, 2].map(i => (
              <View
                key={i}
                className={`flex-1 h-1 rounded-full ${i < selectedSabores.length ? 'bg-(--color-pos-primary)' : 'bg-white/10'}`}
              />
            ))}
          </View>

          {/* Scrollable chips */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loadingSabores ? (
              <View className="py-10 items-center justify-center">
                <ActivityIndicator color="#F5A524" />
              </View>
            ) : (
              <>
                <Text className="text-white font-black text-[10px] uppercase tracking-widest mb-2 mt-1 opacity-60">Tradicionales</Text>
                <View className="flex-row flex-wrap mb-4">
                  {tradicionales.map(sb => renderChip(sb))}
                </View>
                {especiales.length > 0 && (
                  <>
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <Icon name="star" size={10} color="#475569" />
                      <Text className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Especiales</Text>
                    </View>
                    <View className="flex-row flex-wrap">
                      {especiales.map(sb => renderChip(sb))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          {/* Fixed footer */}
          <View className="px-5 pt-3 border-t border-white/5" style={{ paddingBottom: 20 }}>
            {selectedSabores.length > 0 && (
              <View className="bg-black/20 rounded-2xl p-3 mb-3">
                <Text className="text-white font-bold text-xs" numberOfLines={1}>{selectedSabores.join(' + ')}</Text>
                {recargoEspecial > 0 && (
                  <Text className="text-(--color-pos-secondary) text-[10px] font-bold mt-0.5">
                    + ${formatCurrency(recargoEspecial)} sabor especial
                  </Text>
                )}
                {selectedSabores.length >= 3 && (
                  <Text className="text-(--color-pos-primary) text-[10px] font-bold mt-0.5">
                    + ${formatCurrency(extra3)} por 3 sabores
                  </Text>
                )}
              </View>
            )}
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                onPress={handleClose}
                className="flex-1 py-3.5 rounded-2xl bg-white/5 items-center border border-white/5 active:bg-white/10"
              >
                <Text className="text-slate-400 font-bold text-sm">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAdd}
                disabled={selectedSabores.length === 0}
                className={`flex-[2] py-3.5 rounded-2xl items-center ${selectedSabores.length === 0 ? 'bg-slate-800' : 'bg-(--color-pos-primary)'}`}
              >
                <Text className={`font-black text-sm tracking-wide ${selectedSabores.length === 0 ? 'text-slate-500' : 'text-slate-900'}`}>
                  {selectedSabores.length === 0 ? 'Elige sabores' : `Agregar • $${formatCurrency(precioFinal)}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
