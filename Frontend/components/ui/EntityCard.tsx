import React from 'react';
import { View, Text } from '../../tw';
import Card from './Card';
import Icon from './Icon';
import type { IconName } from './Icon';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';

export interface EntityMeta {
    icon: IconName;
    text: string;
    color?: string;
}

export interface EntityCardProps {
    /** Nombre (o teléfono/usuario): también da la inicial del avatar. */
    title: string;
    subtitle?: string;
    /** Líneas con ícono bajo el título (teléfono, usuario, direcciones…). */
    meta?: EntityMeta[];
    /** Contenido a la derecha (badges de rol, estado…). */
    aside?: React.ReactNode;
    /** Acción al pulsar la tarjeta entera. */
    onPress?: () => void;
    /** Acción para ver perfil o historial. */
    onViewProfile?: () => void;
    /** Acciones de la tarjeta: botones de ícono a la derecha. */
    onEdit?: () => void;
    onDelete?: () => void;
    /** Cuerpo debajo de la cabecera (estadísticas, notas…). */
    children?: React.ReactNode;
}

/**
 * Tarjeta única de una persona (cliente, usuario, domiciliario): avatar, nombre, líneas de contacto,
 * contenido a la derecha, acciones de editar/eliminar y un cuerpo opcional. Va dentro de `CardGrid kind="persona"`.
 */
export const EntityCard = React.memo(function EntityCard({ title, subtitle, meta, aside, onPress, onViewProfile, onEdit, onDelete, children }: EntityCardProps) {
    return (
        <Card className="overflow-hidden" padding="md" onPress={onPress}>
            <View className="flex-row items-center gap-3">
                <Avatar nombre={title} size="lg" />
                <View className="flex-1 min-w-0">
                    <Text className="text-white font-black text-sm uppercase tracking-wide" style={{ fontFamily: 'SpaceGrotesk-Bold' }} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text className="text-slate-500 font-bold text-[11px] mt-0.5" numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                    {(meta ?? []).map((m, i) => (
                        <View key={i} className="flex-row items-center gap-1.5 mt-1">
                            <Icon name={m.icon} size={12} color={m.color ?? '#64748B'} />
                            <Text className="text-slate-400 text-[11px] flex-1" numberOfLines={1}>
                                {m.text}
                            </Text>
                        </View>
                    ))}
                </View>
                {aside ? <View className="items-end gap-2">{aside}</View> : null}
                {(onViewProfile || onEdit || onDelete) && (
                    <View className="flex-row gap-2">
                        {onViewProfile && <IconButton icon="chart-box-outline" accessibilityLabel={`Ver perfil ${title}`} onPress={onViewProfile} size="sm" />}
                        {onEdit && <IconButton icon="pencil-outline" accessibilityLabel={`Editar ${title}`} onPress={onEdit} size="sm" />}
                        {onDelete && <IconButton icon="trash-can-outline" tone="danger" accessibilityLabel={`Eliminar ${title}`} onPress={onDelete} size="sm" />}
                    </View>
                )}
            </View>
            {children ? <View className="mt-3">{children}</View> : null}
        </Card>
    );
});
