import React from 'react';
import { View, Text } from '../../tw';
import Icon, { IconName } from '../ui/Icon';

interface EmptyStateProps {
    message?: string;
    subMessage?: string;
    icon?: IconName;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    message = 'No se encontraron datos',
    subMessage = 'No hay información para mostrar en este momento.',
    icon = 'package-variant-closed'
}) => {
    return (
        <View className="flex-1 justify-center items-center p-8 min-h-[300px]">
            <View className="mb-4 opacity-50 bg-white/5 p-8 rounded-full">
                <Icon name={icon} size={64} color="#64748B" />
            </View>
            <Text className="text-xl font-black text-white mb-2 text-center" style={{ fontFamily: 'Space Grotesk' }}>
                {message}
            </Text>
            <Text className="text-slate-400 text-sm text-center max-w-[300px] leading-5">
                {subMessage}
            </Text>
        </View>
    );
};
