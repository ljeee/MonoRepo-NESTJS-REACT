import React from 'react';
import { View, Text } from '../../tw';

export interface AvatarProps {
    /** Nombre (o teléfono/usuario) del que se toma la inicial. */
    nombre?: string | null;
    size?: 'md' | 'lg';
}

/** Inicial en un cuadro redondeado (clientes, usuarios). */
export function Avatar({ nombre, size = 'md' }: AvatarProps) {
    const lg = size === 'lg';
    return (
        <View
            className={`${lg ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-xl'} bg-orange-500/10 items-center justify-center border border-orange-500/20`}
        >
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: lg ? 18 : 16 }}>
                {(nombre ?? '').trim().charAt(0).toUpperCase() || '?'}
            </Text>
        </View>
    );
}
