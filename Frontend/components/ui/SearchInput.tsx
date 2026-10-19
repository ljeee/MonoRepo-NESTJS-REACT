import React from 'react';
import { StyleSheet } from 'react-native';
import { View, TextInput, TouchableOpacity } from '../../tw';
import Icon from './Icon';

export interface SearchInputProps {
  value: string;
  onChangeText: (texto: string) => void;
  placeholder?: string;
  /** 'lg' = barra principal de la pantalla (crear orden); 'md' = filtros de listas. */
  size?: 'md' | 'lg';
  className?: string;
  autoFocus?: boolean;
}

/** Caja de búsqueda con lupa y botón para limpiar. Reemplaza las copias de cada pantalla. */
export function SearchInput({ value, onChangeText, placeholder = 'Buscar…', size = 'md', className = '', autoFocus }: SearchInputProps) {
  return (
    <View className={`flex-row items-center bg-white/5 border border-white/10 rounded-2xl ${className}`} style={size === 'lg' ? styles.lg : styles.md}>
      <Icon name="magnify" size={size === 'lg' ? 20 : 18} color="#64748B" />
      <TextInput
        className="flex-1 text-white font-bold"
        style={size === 'lg' ? styles.inputLg : styles.inputMd}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Limpiar búsqueda">
          <Icon name="close-circle" size={18} color="#64748B" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  md: { minHeight: 46, paddingHorizontal: 14, gap: 10 },
  lg: { minHeight: 54, paddingHorizontal: 16, gap: 10 },
  inputMd: { fontSize: 14, paddingVertical: 10 },
  inputLg: { fontSize: 15, paddingVertical: 14 },
});
