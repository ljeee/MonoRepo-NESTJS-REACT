import React, { ReactNode, useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { View, Pressable } from '../../tw';
import { springs, timings } from '../../styles/tokens';

interface CardProps {
    children?: ReactNode;
    onPress?: () => void;
    /** solid = panel sólido (KPI, gráficas, modales); inset = caja dentro de otra tarjeta. */
    variant?: 'default' | 'elevated' | 'outlined' | 'solid' | 'inset';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    /** Escala de `styles/tokens.ts` → `radius`: sm 8 · md 12 · lg 16 (por defecto) · xl 24. Úsala en vez de `rounded-*` en `className`. */
    radius?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    style?: any;
    delay?: number;
}

export default function Card({
    children,
    onPress,
    variant = 'default',
    padding = 'md',
    radius = 'lg',
    className = '',
    style,
    delay = 0,
}: CardProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(10);

    useEffect(() => {
        // Only animate when the Animated.View branch is actually rendered (onPress path)
        if (!onPress) return;
        opacity.value = withDelay(delay, withTiming(1, { duration: timings.slow }));
        translateY.value = withDelay(delay, withSpring(0, springs.slow));
    }, [delay, onPress]);

    const handlePressIn = () => {
        if (!onPress) return;
        scale.value = withSpring(0.98, springs.fast);
    };

    const handlePressOut = () => {
        if (!onPress) return;
        scale.value = withSpring(1, springs.fast);
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [
                { scale: scale.value },
                { translateY: translateY.value }
            ],
        };
    });

    const paddingClasses = {
        none: 'p-0',
        sm: 'p-2.5',
        md: 'p-4',
        lg: 'p-6',
    };

    const variantClasses = {
        default: 'bg-white/[0.04] border border-white/[0.07]',
        elevated: 'bg-white/[0.05] border border-white/[0.08] shadow-xl',
        outlined: 'bg-transparent border border-white/10',
        solid: 'bg-slate-900 border border-white/5',
        inset: 'bg-black/20 border border-white/5',
    };

    const radiusClasses = {
        sm: 'rounded-lg',
        md: 'rounded-xl',
        lg: 'rounded-2xl',
        xl: 'rounded-3xl',
    };

    const combinedClasses = `${radiusClasses[radius]} ${paddingClasses[padding]} ${variantClasses[variant]} ${className}`;

    if (onPress) {
        return (
            <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
                <Animated.View style={[animatedStyle, style]} className={combinedClasses}>
                    {children}
                </Animated.View>
            </Pressable>
        );
    }

    return (
        <View className={combinedClasses} style={style}>
            {children}
        </View>
    );
}
