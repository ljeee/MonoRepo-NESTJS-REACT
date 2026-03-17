import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface IconProps {
    name: IconName;
    size?: number;
    color?: string;
    style?: any;
}

export default function Icon({ name, size = 20, color = "#94A3B8", style }: IconProps) {
    return (
        <MaterialCommunityIcons
            name={name}
            size={size}
            color={color}
            style={style}
        />
    );
}

// ── Section Icon Mapping ──────────────────────────────────────────────────────
export const sectionIcons: Record<string, IconName> = {
    ordenes: 'clipboard-text-outline',
    facturas: 'cash-multiple',
    informacion: 'database-outline',
    crearOrden: 'plus-circle-outline',
    ordenesdia: 'calendar-today',
    ordenestodas: 'format-list-bulleted',
    facturasDia: 'chart-bar',
    facturasFechas: 'calendar-range',
    gastos: 'credit-card-minus-outline',
    clientes: 'account-group-outline',
    domiciliarios: 'motorbike',
    productos: 'food-variant',
};
