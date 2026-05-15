import React from 'react';
import { View, Text } from '../../tw';
import Icon, { IconName } from './Icon';
import { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { springs, timings } from '../../styles/tokens';

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
        opacity.value = withDelay(delay, withTiming(1, { duration: timings.medium }));
        scale.value = withDelay(delay, withSpring(1, springs.medium));
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    const variantClasses = {
        success: 'bg-green-500/10 border-green-500/20 text-green-400',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        danger: 'bg-red-500/10 border-red-500/20 text-red-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        primary: 'bg-(--color-pos-primary)/10 border-(--color-pos-primary)/20 text-(--color-pos-primary)',
        secondary: 'bg-white/5 border-white/20 text-slate-300',
        neutral: 'bg-white/5 border-white/20 text-slate-300',
    };

    const sizeClasses = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
    const textClasses = size === 'sm' ? 'text-[10px]' : 'text-xs';

    const vClass = variantClasses[variant];
    const iconColorMap = {
        success: '#4ADE80',
        warning: '#FCD34D',
        danger: '#F87171',
        info: '#60A5FA',
        primary: '#F5A524',
        secondary: '#94A3B8',
        neutral: '#94A3B8',
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
