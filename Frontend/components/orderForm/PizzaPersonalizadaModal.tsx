import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../styles/theme';
import { pizzaModalStyles as s } from '../../styles/ordenes/pizza-modal.styles';
import { Producto, ProductoVariante } from '../../hooks/use-productos';
import { PizzaSabor } from '../../hooks/use-pizza-sabores';
import { formatCurrency } from '../../utils/formatNumber';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Obtiene el recargo de un sabor según el nombre del tamaño de la variante */
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

  // Máximo recargo especial de los sabores seleccionados (no se acumula por sabor, se toma el mayor)
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

  // Extract config
  const config3Sabores = saboresCatalogo.find(s => s.tipo === 'configuracion' && s.nombre === 'RECARGO_3_SABORES');
  const extra3SaboresAmount = config3Sabores ? Number(config3Sabores.recargoGrande) : 3000;

  // Recargo que aplica al precio actual dada la selección
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
    const accentColor = isEspecial ? colors.secondary : colors.primary;
    const bgColor = isSelected
      ? (isEspecial ? colors.secondaryLight : colors.primaryLight)
      : colors.bgLight;

    return (
      <TouchableOpacity
        key={sabor.saborId}
        onPress={() => handleSaborPress(sabor.nombre)}
        style={[s.chip, { borderColor: isSelected ? accentColor : colors.border, backgroundColor: bgColor }]}
      >
        <Text style={[s.chipText, { color: isSelected ? accentColor : colors.textSecondary }]}>
          {isEspecial ? '★ ' : ''}{sabor.nombre}{isSelected ? ' ✓' : ''}
          {isEspecial && recargo > 0 ? `  +$${formatCurrency(recargo)}` : ''}
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
          {loadingSabores ? (
            <View style={localStyles.loadingCenter}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false}>
              <Text style={s.sectionLabel}>Tradicionales</Text>
              <View style={s.chipGrid}>
                {tradicionales.map(sb => renderChip(sb))}
              </View>

              <Text style={s.sectionLabelEspecial}>Especiales ★</Text>
              <View style={s.chipGridLast}>
                {especiales.map(sb => renderChip(sb))}
              </View>
            </ScrollView>
          )}

          {/* Price breakdown */}
          {selectedSabores.length > 0 && (
            <View style={s.breakdownBox}>
              <Text style={s.breakdownSabores}>{selectedSabores.join(' + ')}</Text>
              {recargoEspecial > 0 && (
                <Text style={s.breakdownEspecial}>
                  + ${formatCurrency(recargoEspecial)} sabor especial
                </Text>
              )}
              {selectedSabores.length >= 3 && (
                <Text style={s.breakdownTresSabores}>
                  + ${formatCurrency(extra3SaboresAmount)} por 3 sabores
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
              style={[s.addBtn, { backgroundColor: selectedSabores.length === 0 ? colors.textMuted : colors.primary }]}
            >
              <Text style={s.addBtnText}>
                {selectedSabores.length === 0 ? 'Elige sabores' : `Agregar • $${formatCurrency(precioFinal)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
    loadingCenter: {
        alignItems: 'center',
        padding: 24,
    },
});
