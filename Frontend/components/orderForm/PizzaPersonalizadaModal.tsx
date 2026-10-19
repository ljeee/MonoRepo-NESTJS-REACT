import React, { useState } from 'react';
import { Modal, useWindowDimensions } from 'react-native';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
import Icon from '../ui/Icon';
import { LoadingState } from '../ui/LoadingState';
import type { Producto, ProductoVariante, PizzaSabor, SaborGrupo } from '@/src/shared';
import { formatCurrency, getRecargoSabor, calcularRecargoSabores } from '@/src/shared';

// ── Component ─────────────────────────────────────────────────────────────────

interface SaboresModalProps {
  visible: boolean;
  variante: ProductoVariante | null;
  producto: Producto | null;
  /** Grupo de sabores del producto: define tope, tamaños y recargos. */
  grupo: SaborGrupo;
  /** Sabores de todos los grupos; el modal usa solo los del `grupo`. */
  saboresCatalogo: PizzaSabor[];
  loadingSabores?: boolean;
  onAdd: (producto: Producto, variante: ProductoVariante, sabores: string[]) => void;
  onClose: () => void;
}

/** Selector de sabores de cualquier producto con grupo (pizza, calzone o uno nuevo): las reglas salen del grupo. */
export default function PizzaPersonalizadaModal({
  visible, variante, producto, grupo, saboresCatalogo, loadingSabores, onAdd, onClose,
}: SaboresModalProps) {
  const [selectedSabores, setSelectedSabores] = useState<string[]>([]);
  const { height: screenHeight } = useWindowDimensions();

  const maxSabores = grupo.maxSabores;
  const sabores = saboresCatalogo
    .filter(s => s.grupoId === grupo.id && s.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const recargo = calcularRecargoSabores(grupo, saboresCatalogo, selectedSabores, variante);
  const precioFinal = Number(variante?.precio ?? 0) + recargo.total;
  const extraDesde = grupo.recargoExtraDesde;

  const handleSaborPress = (nombre: string) => {
    setSelectedSabores(prev => {
      if (prev.includes(nombre)) return prev.filter(s => s !== nombre);
      if (prev.length >= maxSabores) return prev;
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
    const recargoSabor = variante ? getRecargoSabor(sabor, variante, grupo) : 0;
    const hasSurcharge = recargoSabor > 0;
    return (
      <TouchableOpacity
        key={sabor.saborId}
        onPress={() => handleSaborPress(sabor.nombre)}
        className={`px-3 py-1.5 rounded-xl mb-1.5 mr-1.5 border flex-row items-center gap-1.5 ${isSelected ? 'bg-(--color-pos-primary)/20 border-(--color-pos-primary)' : 'bg-white/5 border-white/10'}`}
      >
        {hasSurcharge && <Icon name="star" size={10} color={isSelected ? '#F5A524' : '#475569'} />}
        <Text
          className={`font-bold text-sm ${isSelected ? 'text-(--color-pos-primary)' : 'text-slate-400'}`}
          numberOfLines={2}
        >
          {sabor.nombre}{isSelected ? ' ✓' : ''}
          {hasSurcharge ? `  +$${formatCurrency(recargoSabor)}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* Backdrop */}
      <View className="flex-1 bg-black/85 p-4" style={{ justifyContent: 'center', alignItems: 'center' }}>
        {/* Modal card */}
        <View
          className="bg-(--color-pos-surface) w-full border border-white/5 shadow-2xl overflow-hidden"
          style={{ borderRadius: 24, maxHeight: screenHeight * 0.88, maxWidth: 700 }}
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
                {grupo.varianteEsSabor ? (producto?.productoNombre ?? grupo.nombre) : `${producto?.productoNombre ?? grupo.nombre} ${variante?.nombre ?? ''}`}
              </Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                Hasta {maxSabores} sabores • Base ${formatCurrency(Number(variante?.precio))}
              </Text>
            </View>
          </View>

          {/* Slot indicators */}
          <View className="flex-row gap-1.5 px-5 pb-3">
            {Array.from({ length: maxSabores }, (_, i) => i).map(i => (
              <View
                key={i}
                className={`flex-1 h-1 rounded-full ${i < selectedSabores.length ? 'bg-(--color-pos-primary)' : 'bg-white/10'}`}
              />
            ))}
          </View>

          {/* Scrollable chips */}
          <ScrollView
            style={{ maxHeight: screenHeight * 0.55 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loadingSabores ? (
              <LoadingState size="small" className="py-10" padded={false} />
            ) : (
              <>
                <Text className="text-white font-black text-[10px] uppercase tracking-widest mb-2 mt-1 opacity-60">Sabores Disponibles</Text>
                <View className="flex-row flex-wrap">
                  {sabores.length === 0 ? (
                    <Text className="text-slate-500 text-xs italic">Este grupo aún no tiene sabores activos.</Text>
                  ) : (
                    sabores.map(sb => renderChip(sb))
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Fixed footer */}
          <View className="px-5 pt-3 border-t border-white/5" style={{ paddingBottom: 20 }}>
            {selectedSabores.length > 0 && (
              <View className="bg-black/20 rounded-2xl p-3 mb-3">
                <Text className="text-white font-bold text-xs" numberOfLines={1}>{selectedSabores.join(' + ')}</Text>
                {recargo.porSabor > 0 && (
                  <Text className="text-(--color-pos-secondary) text-[10px] font-bold mt-0.5">
                    + ${formatCurrency(recargo.porSabor)} recargo de sabor
                  </Text>
                )}
                {recargo.porCantidad > 0 && (
                  <Text className="text-(--color-pos-primary) text-[10px] font-bold mt-0.5">
                    + ${formatCurrency(recargo.porCantidad)} por {extraDesde} sabores
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
