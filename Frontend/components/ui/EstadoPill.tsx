import React, { memo } from 'react';
import { View, Text } from '../../tw';
import Icon from './Icon';
import { getOrdenEstadoMeta } from '@/src/shared';

export interface EstadoPillProps {
    /** Estado de la orden tal como llega del servidor (tolera las grafías legadas de "en preparación"). */
    estado?: string | null;
    /** Muestra el ícono del estado. */
    icon?: boolean;
    /** 'sm' (por defecto) para tarjetas y listas; 'xs' para tarjetas muy densas (KDS/POS). */
    size?: 'sm' | 'xs';
}

/**
 * Único renderer del estado de una orden (etiqueta, color y fondo salen de `ORDEN_ESTADO_META`).
 * Reemplaza las píldoras que dashboard, historial de órdenes y tarjetas POS dibujaban cada una a su manera.
 */
export const EstadoPill = memo(function EstadoPill({ estado, icon = false, size = 'sm' }: EstadoPillProps) {
    const meta = getOrdenEstadoMeta(estado);
    const color = meta?.color ?? '#94A3B8';
    const xs = size === 'xs';
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 4,
                paddingHorizontal: xs ? 8 : 9,
                paddingVertical: xs ? 2 : 3,
                borderRadius: xs ? 6 : 999,
                backgroundColor: meta?.bg ?? 'rgba(148,163,184,0.12)',
                borderWidth: xs ? 1 : 0,
                borderColor: `${color}40`,
            }}
        >
            {icon && meta ? <Icon name={meta.icon as any} size={11} color={color} /> : null}
            <Text style={{ color, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {meta?.label ?? estado ?? 'N/A'}
            </Text>
        </View>
    );
});
