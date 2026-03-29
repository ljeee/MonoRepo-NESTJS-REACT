import React from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from '../ui/Icon';

interface ErrorStateProps {
    message?: string;
    onRetry?: () => void;
    title?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    message = 'Ha ocurrido un error inesperado.',
    onRetry,
    title = '¡Ups! Algo salió mal'
}) => {
    return (
        <View className="flex-1 justify-center items-center p-8 min-h-[300px]">
            <View className="mb-6 p-6 bg-red-500/10 rounded-full">
                <Icon name="alert-circle-outline" size={48} color="#EF4444" />
            </View>
            <Text className="text-lg font-black text-white mb-2 text-center" style={{ fontFamily: 'Space Grotesk' }}>
                {title}
            </Text>
            <Text className="text-slate-400 text-sm text-center mb-6 leading-6 max-w-[300px]">
                {message}
            </Text>

            {onRetry && (
                <TouchableOpacity 
                    className="bg-(--color-pos-primary) py-3 px-8 rounded-xl" 
                    onPress={onRetry}
                >
                    <Text className="text-black font-black uppercase tracking-wider text-sm">Intentar de nuevo</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
