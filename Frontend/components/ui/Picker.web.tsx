import React from 'react';
import { StyleSheet } from 'react-native';

export interface PickerProps<T> {
  selectedValue?: T;
  onValueChange?: (itemValue: T, itemIndex: number) => void;
  enabled?: boolean;
  style?: any;
  itemStyle?: any;
  dropdownIconColor?: string;
  children?: React.ReactNode;
}

export interface PickerItemProps<T> {
  label: string;
  value: T;
  color?: string;
  style?: any;
}

export function Picker<T>({
  selectedValue,
  onValueChange,
  enabled = true,
  style,
  children,
}: PickerProps<T>) {
  const flatStyle = StyleSheet.flatten(style) || {};

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onValueChange) {
      const val = e.target.value;
      let originalValue: any = val;

      // Map string values back to their original type (e.g. number, boolean, or enum)
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.props) {
          const itemProps = child.props as PickerItemProps<T>;
          if (String(itemProps.value) === val) {
            originalValue = itemProps.value;
          }
        }
      });

      onValueChange(originalValue as T, e.target.selectedIndex);
    }
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: flatStyle.height || '100%',
    minHeight: flatStyle.height || '40px',
    backgroundColor: 'transparent',
    color: flatStyle.color || '#ffffff',
    fontSize: flatStyle.fontSize || '14px',
    border: 'none',
    outline: 'none',
    paddingLeft: '12px',
    paddingRight: '36px',
    appearance: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <select
        value={selectedValue !== undefined && selectedValue !== null ? String(selectedValue) : ''}
        onChange={handleChange}
        disabled={!enabled}
        style={selectStyle}
      >
        {children}
      </select>
      <div
        style={{
          position: 'absolute',
          right: '16px',
          pointerEvents: 'none',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '5px solid #94A3B8',
          width: '0',
          height: '0',
        }}
      />
    </div>
  );
}

export function PickerItem<T>({ label, value, color, style }: PickerItemProps<T>) {
  const flatStyle = StyleSheet.flatten(style) || {};
  return (
    <option
      value={value !== undefined && value !== null ? String(value) : ''}
      style={{
        backgroundColor: '#0F172A',
        color: color || flatStyle.color || '#F8FAFC',
        fontSize: flatStyle.fontSize || '14px',
      }}
    >
      {label}
    </option>
  );
}
