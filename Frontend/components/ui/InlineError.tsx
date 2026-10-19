import React from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from './Icon';

export interface InlineErrorProps {
    /** Texto del error. Vacío/undefined = no se muestra nada (así se puede pasar el estado directo). */
    message?: string | null;
    /** 'sm' para errores dentro de un formulario o modal; 'md' (por defecto) para avisos de página. */
    size?: 'sm' | 'md';
    /** Con este callback aparece una X para descartar el aviso. */
    onClose?: () => void;
    className?: string;
}

/** Aviso de error en línea (icono + texto en caja roja). Para una pantalla completa con reintento: `states/ErrorState`. */
export function InlineError({ message, size = 'md', onClose, className = '' }: InlineErrorProps) {
    if (!message) return null;
    const sm = size === 'sm';
    return (
        <View
            className={`flex-row items-center bg-red-500/10 border border-red-500/20 ${sm ? 'gap-2 p-3 rounded-xl' : 'gap-3 p-4 rounded-xl'} ${className}`}
            accessibilityRole="alert"
        >
            <Icon name="alert-circle-outline" size={sm ? 14 : 18} color="#EF4444" />
            <Text className="text-red-400 text-xs font-bold flex-1">{message}</Text>
            {onClose ? (
                <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar aviso" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="close" size={sm ? 14 : 16} color="#EF4444" />
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
