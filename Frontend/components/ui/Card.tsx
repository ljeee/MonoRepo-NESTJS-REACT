import React, { ReactNode, useEffect } from 'react';
import { Pressable } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { View } from '../../tw';

interface CardProps {
    children: ReactNode;
    onPress?: () => void;
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
    style?: any;
    delay?: number;
}

export default function Card({
    children,
    onPress,
    variant = 'default',
    padding = 'md',
    className = '',
    style,
    delay = 0,
}: CardProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(10);

    useEffect(() => {
        opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
        translateY.value = withDelay(delay, withSpring(0, { damping: 15, stiffness: 100 }));
    }, [delay]);

    const handlePressIn = () => {
        if (!onPress) return;
        scale.value = withSpring(0.98, { damping: 12, stiffness: 200 });
    };

    const handlePressOut = () => {
        if (!onPress) return;
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
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
    };

    const combinedClasses = `rounded-2xl ${paddingClasses[padding]} ${variantClasses[variant]} ${className}`;

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
