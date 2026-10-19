import React from 'react';
import { View, Text } from '../../tw';
import Icon from './Icon';
import type { IconName } from './Icon';

export interface SectionHeaderProps {
    title: string;
    /** Color del acento (barra o icono). */
    color?: string;
    /** Con icono se muestra el icono; sin icono, una barra vertical de color. */
    icon?: IconName;
    /** Cantidad de elementos de la sección (pastilla al lado del título). */
    count?: number;
    /** Acción u otro contenido alineado a la derecha. */
    right?: React.ReactNode;
}

/** Encabezado de sección: acento (barra/icono) + título en mayúsculas + cantidad + acción opcional. */
export function SectionHeader({ title, color = '#F5A524', icon, count, right }: SectionHeaderProps) {
    return (
        <View className="flex-row items-center gap-3 mb-4">
            {icon ? (
                <Icon name={icon} size={18} color={color} />
            ) : (
                <View style={{ width: 6, height: 24, backgroundColor: color, borderRadius: 999 }} />
            )}
            <Text
                style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', letterSpacing: 1 }}
            >
                {title}
            </Text>
            {count !== undefined && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12 }}>{count}</Text>
                </View>
            )}
            <View style={{ flex: 1 }} />
            {right}
        </View>
    );
}
