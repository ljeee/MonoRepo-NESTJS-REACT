import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../styles/theme';
import { pizzaModalStyles as s } from '../../styles/pizza-modal.styles';
import { Producto, ProductoVariante } from '../../hooks/use-productos';
import { formatCurrency } from '../../utils/formatNumber';

// ── Sabores disponibles ───────────────────────────────────────────────
const SABORES_TRADICIONALES = [
  'De Casa', 'Napolitana', 'Ranchera', 'Hawaiana', 'Vegetales',
  'Mexicana', 'Carnes', 'Pollo Tocineta', 'Pollo Champiñones',
  'Pollo Maicitos', 'Jamón y Queso',
];

const SABORES_ESPECIALES = [
  'Quesuda', 'Boloñesa', 'Pollo BBQ', 'Aborrajada', 'Firu', 'Paisa',
];

// Recargo por sabor especial según tamaño
const PREMIUM_ESPECIAL: Record<string, number> = {
  'Pequeña': 1000,
  'Mediana': 2000,
  'Grande': 2000,
};

// Recargo adicional cuando se eligen 3 sabores
const EXTRA_3_SABORES = 3000;

// ── Helpers ───────────────────────────────────────────────────────────
function tieneEspecial(sabores: string[]): boolean {
  return sabores.some(s => SABORES_ESPECIALES.includes(s));
}

function calcularPrecio(variante: ProductoVariante | null, sabores: string[]): number {
  if (!variante) return 0;
  let precio = Number(variante.precio);
  if (tieneEspecial(sabores)) {
    precio += PREMIUM_ESPECIAL[variante.nombre] ?? 0;
  }
  if (sabores.length >= 3) {
    precio += EXTRA_3_SABORES;
  }
  return precio;
}

// ── Component ─────────────────────────────────────────────────────────
interface PizzaPersonalizadaModalProps {
  visible: boolean;
  variante: ProductoVariante | null;
  producto: Producto | null;
  onAdd: (producto: Producto, variante: ProductoVariante, sabores: string[]) => void;
  onClose: () => void;
}

export default function PizzaPersonalizadaModal({
  visible,
  variante,
  producto,
  onAdd,
  onClose,
}: PizzaPersonalizadaModalProps) {
  const [selectedSabores, setSelectedSabores] = useState<string[]>([]);

  const precioFinal = calcularPrecio(variante, selectedSabores);

  const handleSaborPress = (sabor: string) => {
    setSelectedSabores((prev) => {
      if (prev.includes(sabor)) return prev.filter((s) => s !== sabor);
      if (prev.length >= 3) return prev;
      return [...prev, sabor];
    });
  };

  const handleAdd = () => {
    if (selectedSabores.length === 0) return;
    if (producto && variante) {
      // Pass the variante with adjusted price
      const adjustedVariante = { ...variante, precio: precioFinal };
      onAdd(producto, adjustedVariante, selectedSabores);
      setSelectedSabores([]);
    }
  };

  const handleClose = () => {
    setSelectedSabores([]);
    onClose();
  };

  const renderSaborChip = (sabor: string, isEspecial: boolean) => {
    const isSelected = selectedSabores.includes(sabor);
    const accentColor = isEspecial ? colors.secondary : colors.primary;
    const bgColor = isSelected
      ? (isEspecial ? colors.secondaryLight : colors.primaryLight)
      : colors.bgLight;

    return (
      <TouchableOpacity
        key={sabor}
        onPress={() => handleSaborPress(sabor)}
        style={[
          s.chip,
          {
            borderColor: isSelected ? accentColor : colors.border,
            backgroundColor: bgColor,
          },
        ]}
      >
        <Text style={[s.chipText, { color: isSelected ? accentColor : colors.textSecondary }]}>
          {isEspecial ? '★ ' : ''}{sabor}{isSelected ? ' ✓' : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Header */}
          <Text style={s.headerTitle}>🍕 Pizza {variante?.nombre}</Text>
          <Text style={s.headerSubtitle}>
            Selecciona 1-3 sabores • Base ${formatCurrency(Number(variante?.precio))}
          </Text>

          {/* Sabores */}
          <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>Tradicionales</Text>
            <View style={s.chipGrid}>
              {SABORES_TRADICIONALES.map((sb) => renderSaborChip(sb, false))}
            </View>

            <Text style={s.sectionLabelEspecial}>Especiales ★</Text>
            <View style={s.chipGridLast}>
              {SABORES_ESPECIALES.map((sb) => renderSaborChip(sb, true))}
            </View>
          </ScrollView>

          {/* Price breakdown */}
          {selectedSabores.length > 0 && (
            <View style={s.breakdownBox}>
              <Text style={s.breakdownSabores}>
                {selectedSabores.join(' + ')}
              </Text>
              {tieneEspecial(selectedSabores) && (
                <Text style={s.breakdownEspecial}>
                  + ${formatCurrency(PREMIUM_ESPECIAL[variante?.nombre ?? ''] ?? 0)} sabor especial
                </Text>
              )}
              {selectedSabores.length >= 3 && (
                <Text style={s.breakdownTresSabores}>
                  + ${formatCurrency(EXTRA_3_SABORES)} por 3 sabores
                </Text>
              )}
            </View>
          )}

          {/* Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity onPress={handleClose} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAdd}
              disabled={selectedSabores.length === 0}
              style={[
                s.addBtn,
                { backgroundColor: selectedSabores.length === 0 ? colors.textMuted : colors.primary },
              ]}
            >
              <Text style={s.addBtnText}>
                {selectedSabores.length === 0
                  ? 'Elige sabores'
                  : `Agregar • $${formatCurrency(precioFinal)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
