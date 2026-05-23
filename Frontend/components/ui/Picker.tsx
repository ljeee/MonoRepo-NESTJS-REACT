import React from 'react';
import { Picker as RNPicker, PickerProps as RNPickerProps } from '@react-native-picker/picker';

export interface PickerProps<T> extends RNPickerProps<T> {
  children?: React.ReactNode;
}

export function Picker<T>({ children, ...props }: PickerProps<T>) {
  return <RNPicker<T> {...props}>{children}</RNPicker>;
}

export const PickerItem = RNPicker.Item;
