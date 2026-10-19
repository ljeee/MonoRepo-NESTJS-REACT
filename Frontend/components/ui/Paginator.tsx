import React from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import Icon from './Icon';

export interface PaginatorProps {
  /** Página actual, desde 1. */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Texto opcional (p. ej. "120 productos"). */
  caption?: string;
}

/** Anterior / "Página X de Y" / Siguiente. Reemplaza las ~15 copias de paginación. */
export function Paginator({ page, totalPages, onChange, caption }: PaginatorProps) {
  if (totalPages <= 1 && !caption) return null;
  const puedeAtras = page > 1;
  const puedeAdelante = page < totalPages;
  return (
    <View style={styles.fila}>
      <Pressable onPress={() => puedeAtras && onChange(page - 1)} disabled={!puedeAtras} style={[styles.boton, !puedeAtras && styles.deshabilitado]} accessibilityLabel="Página anterior">
        <Icon name="chevron-left" size={18} color="#E2E8F0" />
      </Pressable>
      <View style={styles.centro}>
        <Text className="text-slate-300 text-[11px] font-black uppercase tracking-wider">
          Página {Math.min(page, Math.max(totalPages, 1))} de {Math.max(totalPages, 1)}
        </Text>
        {!!caption && <Text className="text-slate-500 text-[10px] font-bold">{caption}</Text>}
      </View>
      <Pressable onPress={() => puedeAdelante && onChange(page + 1)} disabled={!puedeAdelante} style={[styles.boton, !puedeAdelante && styles.deshabilitado]} accessibilityLabel="Página siguiente">
        <Icon name="chevron-right" size={18} color="#E2E8F0" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  centro: { alignItems: 'center' },
  boton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  deshabilitado: { opacity: 0.3 },
});
