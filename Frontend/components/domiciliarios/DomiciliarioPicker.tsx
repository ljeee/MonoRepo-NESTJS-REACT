import React from 'react';
import { Picker, PickerItem } from '../ui';

interface DomiciliarioOpcion {
  telefono: string | number;
  domiciliarioNombre?: string | null;
}

export interface DomiciliarioPickerProps {
  value: string;
  onChange: (telefono: string) => void;
  domiciliarios: DomiciliarioOpcion[];
  /** Texto de la opción vacía ("Sin asignar", "Seleccionar domiciliario…"). */
  placeholder: string;
  /** Texto cuando no hay domiciliarios registrados (por defecto el mismo placeholder). */
  emptyText?: string;
}

/** Selector de domiciliario (crear orden y asignar domicilios). El valor es el teléfono. */
export function DomiciliarioPicker({ value, onChange, domiciliarios, placeholder, emptyText }: DomiciliarioPickerProps) {
  return (
    <Picker
      selectedValue={value}
      onValueChange={(val) => onChange(String(val))}
      style={{ color: 'white' }}
      itemStyle={{ color: 'white', fontSize: 14 }}
      dropdownIconColor="#94A3B8"
    >
      <PickerItem label={domiciliarios.length === 0 ? (emptyText ?? placeholder) : placeholder} value="" color="#64748B" />
      {domiciliarios.map((d) => (
        <PickerItem key={String(d.telefono)} label={d.domiciliarioNombre || String(d.telefono)} value={String(d.telefono)} />
      ))}
    </Picker>
  );
}
