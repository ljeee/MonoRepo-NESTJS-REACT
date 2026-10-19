import React from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import type { SaborGrupo } from '@/src/shared';
import { resolverPersonalizacion } from '@/src/shared';

/** Qué ofrece un producto al pedirlo: sabores de un grupo, base de jugo, o nada (se agrega directo). */
export interface PersonalizacionProducto {
    saborGrupoId: number | null;
    personalizacion: 'ninguna' | 'jugo';
}

interface PersonalizacionSelectorProps {
    grupos: SaborGrupo[];
    value: PersonalizacionProducto;
    onChange: (value: PersonalizacionProducto) => void;
    disabled?: boolean;
}

/** Valor inicial a partir de un producto guardado (los valores heredados 'pizza'/'calzone' cuentan como ninguna). */
export function personalizacionDeProducto(producto: {
    productoNombre: string;
    personalizacion?: string | null;
    saborGrupoId?: number | null;
}): PersonalizacionProducto {
    return {
        saborGrupoId: producto.saborGrupoId ?? null,
        personalizacion: resolverPersonalizacion(producto) === 'jugo' ? 'jugo' : 'ninguna',
    };
}

/** Único selector de "qué pide este producto": lo usan el formulario de producto y la pantalla de sabores. */
export function PersonalizacionSelector({ grupos, value, onChange, disabled }: PersonalizacionSelectorProps) {
    const opciones: { key: string; label: string; activa: boolean; valor: PersonalizacionProducto }[] = [
        {
            key: 'ninguna',
            label: 'Ninguno',
            activa: value.saborGrupoId == null && value.personalizacion === 'ninguna',
            valor: { saborGrupoId: null, personalizacion: 'ninguna' },
        },
        ...grupos
            .filter((g) => g.activo || g.id === value.saborGrupoId)
            .map((g) => ({
                key: `grupo-${g.id}`,
                label: `Sabores: ${g.nombre}`,
                activa: value.saborGrupoId === g.id,
                valor: { saborGrupoId: g.id, personalizacion: 'ninguna' as const },
            })),
        {
            key: 'jugo',
            label: 'Base jugo',
            activa: value.saborGrupoId == null && value.personalizacion === 'jugo',
            valor: { saborGrupoId: null, personalizacion: 'jugo' },
        },
    ];

    return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, opacity: disabled ? 0.5 : 1 }}>
            {opciones.map((op) => (
                <TouchableOpacity
                    key={op.key}
                    disabled={disabled}
                    onPress={() => onChange(op.valor)}
                    style={{
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 14,
                        borderWidth: 1,
                        backgroundColor: op.activa ? 'rgba(245,165,36,0.18)' : 'rgba(255,255,255,0.04)',
                        borderColor: op.activa ? 'rgba(245,165,36,0.45)' : 'rgba(255,255,255,0.08)',
                    }}
                >
                    <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', color: op.activa ? '#F5A524' : '#64748B' }}>
                        {op.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}
