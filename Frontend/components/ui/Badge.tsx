import React from 'react';
import { View, Text } from '../../tw';
import Icon, { IconName } from './Icon';
import { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'secondary';

interface BadgeProps {
    label: string;
    variant?: BadgeVariant;
    icon?: IconName;
    size?: 'sm' | 'md';
    className?: string;
    style?: any;
    delay?: number;
}

export default function Badge({ label, variant = 'neutral', icon, size = 'sm', className = '', style, delay = 0 }: BadgeProps) {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);

    React.useEffect(() => {
        opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
        scale.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 150 }));
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    const variantClasses = {
        success: 'bg-green-500/10 border-green-500/20 text-green-500',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
        danger: 'bg-red-500/10 border-red-500/20 text-red-500',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
        primary: 'bg-(--color-pos-primary)/10 border-(--color-pos-primary)/20 text-(--color-pos-primary)',
        secondary: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
        neutral: 'bg-white/5 border-white/10 text-slate-400',
    };

    const sizeClasses = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
    const textClasses = size === 'sm' ? 'text-[10px]' : 'text-xs';

    const vClass = variantClasses[variant];
    const textHexColor = vClass.split(' ').pop(); // This is a bit hacky but works for the Icon color if we use standard hex, but better pass a specific color.
    
    // Better map for icon color
    const iconColorMap = {
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        primary: '#F5A524',
        secondary: '#A855F7',
        neutral: '#64748B',
    };

    return (
        <Animated.View
            style={[animatedStyle, style]}
            className={`flex-row items-center rounded-full border self-start ${vClass.split(' ').slice(0, 2).join(' ')} ${sizeClasses} ${className}`}
        >
            {icon && (
                <View className="mr-1">
                    <Icon
                        name={icon}
                        size={size === 'sm' ? 10 : 12}
                        color={iconColorMap[variant]}
                    />
                </View>
            )}
            <Text
                className={`font-black uppercase tracking-wider ${vClass.split(' ').pop()} ${textClasses}`}
            >
                {label}
            </Text>
        </Animated.View>
    );
}
