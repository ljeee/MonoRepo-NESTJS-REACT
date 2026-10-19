import React, { memo, ReactNode, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable, ScrollView } from '../../tw';
import Icon from './Icon';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** Ancho fijo; sin él la columna se estira (flex). */
  width?: number;
  align?: 'left' | 'right';
  sortable?: boolean;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  onSort?: (key: string) => void;
  onRowPress?: (row: T) => void;
  /** Ancho mínimo de la tabla; en pantallas angostas se desplaza horizontalmente. */
  minWidth?: number;
  emptyText?: string;
}

/**
 * Tabla genérica con encabezado ordenable y filas memo. Es una lista acotada (página de
 * resultados), así que usa ScrollView en web y nativo.
 */
export function DataTable<T>({ columns, rows, rowKey, sortKey, onSort, onRowPress, minWidth = 560, emptyText = 'Sin resultados' }: DataTableProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={{ minWidth, flex: 1 }}>
        <View style={styles.encabezado}>
          {columns.map((c) => {
            const activa = sortKey === c.key;
            const contenido = (
              <>
                <Text style={[styles.titulo, activa && styles.tituloActivo, c.align === 'right' && styles.derecha]} numberOfLines={1}>
                  {c.label}
                </Text>
                {c.sortable && <Icon name={activa ? 'arrow-down' : 'swap-vertical'} size={11} color={activa ? '#F5A524' : '#475569'} />}
              </>
            );
            const estilo = [styles.celda, c.width ? { width: c.width } : styles.flex, c.align === 'right' && styles.celdaDerecha];
            return c.sortable && onSort ? (
              <Pressable key={c.key} onPress={() => onSort(c.key)} style={estilo} accessibilityRole="button" accessibilityLabel={`Ordenar por ${c.label}`}>
                {contenido}
              </Pressable>
            ) : (
              <View key={c.key} style={estilo}>
                {contenido}
              </View>
            );
          })}
        </View>
        {rows.length === 0 ? (
          <Text className="text-slate-500 text-xs italic text-center py-6">{emptyText}</Text>
        ) : (
          rows.map((r) => <Fila key={rowKey(r)} row={r} columns={columns} onPress={onRowPress} />)
        )}
      </View>
    </ScrollView>
  );
}

function FilaInterna<T>({ row, columns, onPress }: { row: T; columns: DataTableColumn<T>[]; onPress?: (row: T) => void }) {
  const handlePress = useCallback(() => onPress?.(row), [onPress, row]);
  const celdas = columns.map((c) => (
    <View key={c.key} style={[styles.celda, c.width ? { width: c.width } : styles.flex, c.align === 'right' && styles.celdaDerecha]}>
      {c.render(row)}
    </View>
  ));
  return onPress ? (
    <Pressable onPress={handlePress} style={styles.fila} className="active:bg-white/5" accessibilityRole="button">
      {celdas}
    </Pressable>
  ) : (
    <View style={styles.fila}>{celdas}</View>
  );
}

const Fila = memo(FilaInterna) as typeof FilaInterna;

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  encabezado: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', paddingVertical: 10 },
  celda: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  celdaDerecha: { justifyContent: 'flex-end' },
  flex: { flex: 1, minWidth: 0 },
  titulo: { color: '#64748B', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  tituloActivo: { color: '#F5A524' },
  derecha: { textAlign: 'right' },
});
