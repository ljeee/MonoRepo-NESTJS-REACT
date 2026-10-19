import React from 'react';
import { TouchableOpacity } from '../../tw';
import Icon from './Icon';
import type { IconName } from './Icon';

export interface IconButtonProps {
    icon: IconName;
    onPress: () => void;
    /** Obligatorio: es un botón sin texto. */
    accessibilityLabel: string;
    tone?: 'neutral' | 'danger';
    /** sm = 36px, md = 40px (por defecto). */
    size?: 'sm' | 'md';
    disabled?: boolean;
}

const TONOS = {
    neutral: { clase: 'bg-white/5 border-white/10 active:bg-white/10', color: '#94A3B8' },
    danger: { clase: 'bg-red-500/10 border-red-500/20 active:bg-red-500/20', color: '#EF4444' },
} as const;

/** Botón cuadrado con solo un icono (editar, borrar, cerrar, anterior/siguiente…). */
export function IconButton({ icon, onPress, accessibilityLabel, tone = 'neutral', size = 'md', disabled = false }: IconButtonProps) {
    const t = TONOS[tone];
    const sm = size === 'sm';
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            accessibilityLabel={accessibilityLabel}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            className={`${sm ? 'w-9 h-9 rounded-lg' : 'w-10 h-10 rounded-xl'} items-center justify-center border ${t.clase} ${disabled ? 'opacity-30' : ''}`}
        >
            <Icon name={icon} size={sm ? 14 : 16} color={t.color} />
        </TouchableOpacity>
    );
}
