import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface IconProps {
    name: IconName;
    size?: number;
    color?: string;
    style?: any;
}

/**
 * Wrapper around MaterialCommunityIcons for consistent icon usage.
 * Replaces emoji icons with proper vector icons.
 */
export default function Icon({ name, size = 20, color = colors.text, style }: IconProps) {
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
// Replaces emoji icons in navigation and headers
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
