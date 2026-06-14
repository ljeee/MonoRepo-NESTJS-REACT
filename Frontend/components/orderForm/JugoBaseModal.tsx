import React from 'react';
import { Modal } from 'react-native';
import { View, Text, TouchableOpacity } from '../../tw';
import { formatCurrency } from '@/src/shared';
import type { Producto, ProductoVariante } from '@/src/shared';
import Icon from '../ui/Icon';

/** Recargo fijo cuando el jugo se pide con leche */
export const RECARGO_LECHE = 1000;

interface JugoBaseModalProps {
  visible: boolean;
  producto: Producto;
  variante: ProductoVariante;
  onAdd: (producto: Producto, variante: ProductoVariante, base: 'leche' | 'agua') => void;
  onClose: () => void;
}

export default function JugoBaseModal({
  visible,
  producto,
  variante,
  onAdd,
  onClose,
}: JugoBaseModalProps) {
  const precioAgua  = Number(variante.precio);
  const precioLeche = precioAgua + RECARGO_LECHE;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,9,20,0.97)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <View style={{
          backgroundColor: '#0F172A',
          borderRadius: 28,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          paddingBottom: 32,
          width: '100%',
          maxWidth: 500,
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
            borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                {producto.productoNombre}
              </Text>
              <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>
                {variante.nombre} — ¿Con qué base?
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              <Icon name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Opciones */}
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 20 }}>
            {/* AGUA */}
            <TouchableOpacity
              onPress={() => onAdd(producto, variante, 'agua')}
              style={{
                flex: 1, backgroundColor: '#1E293B', borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', alignItems: 'center', gap: 10,
              }}
              activeOpacity={0.75}
            >
              <View style={{
                width: 52, height: 52, borderRadius: 16,
                backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 26 }}>💧</Text>
              </View>
              <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Agua
              </Text>
              <Text style={{ color: '#38BDF8', fontWeight: '900', fontSize: 18 }}>
                ${formatCurrency(precioAgua)}
              </Text>
            </TouchableOpacity>

            {/* LECHE */}
            <TouchableOpacity
              onPress={() => onAdd(producto, variante, 'leche')}
              style={{
                flex: 1, backgroundColor: '#1E293B', borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', alignItems: 'center', gap: 10,
              }}
              activeOpacity={0.75}
            >
              <View style={{
                width: 52, height: 52, borderRadius: 16,
                backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 26 }}>🥛</Text>
              </View>
              <Text style={{ color: '#F8FAFC', fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Leche
              </Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#F5A524', fontWeight: '900', fontSize: 18 }}>
                  ${formatCurrency(precioLeche)}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '700', marginTop: 2 }}>
                  +${formatCurrency(RECARGO_LECHE)} leche
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
