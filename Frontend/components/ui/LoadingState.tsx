import React from 'react';
import { ActivityIndicator } from 'react-native';
import { View, Text } from '../../tw';

export interface LoadingStateProps {
    /** Texto bajo el indicador (opcional). */
    message?: string;
    size?: 'small' | 'large';
    /** Espacio vertical alrededor (por defecto sí: pensado para ocupar el hueco de una lista/pantalla). */
    padded?: boolean;
    className?: string;
}

/** Indicador de carga centrado. Para el spinner dentro de un botón usa `Button loading`; para listas, `ListSkeleton`. */
export function LoadingState({ message, size = 'large', padded = true, className = '' }: LoadingStateProps) {
    return (
        <View className={`items-center justify-center ${padded ? 'py-16' : ''} ${className}`} accessibilityRole="progressbar">
            <ActivityIndicator size={size} color="#F5A524" />
            {message ? <Text className="text-slate-500 font-bold mt-4">{message}</Text> : null}
        </View>
    );
}
