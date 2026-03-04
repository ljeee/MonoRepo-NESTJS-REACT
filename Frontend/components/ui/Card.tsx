import React, { ReactNode } from 'react';
import {
    Pressable,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors } from '../../styles/theme';
import { radius, shadows, spacing } from '../../styles/tokens';

interface CardProps {
    children: ReactNode;
    onPress?: () => void;
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    style?: ViewStyle;
}

const paddingMap = {
    none: 0,
    sm: spacing.md,
    md: spacing.lg,
    lg: spacing['2xl'],
};

export default function Card({
    children,
    onPress,
    variant = 'default',
    padding = 'md',
    style,
}: CardProps) {
    const scale = useSharedValue(1);

    const handlePressIn = () => {
        if (!onPress) return;
        scale.set(withSpring(0.98, { damping: 12, stiffness: 200 }));
    };

    const handlePressOut = () => {
        if (!onPress) return;
        scale.set(withSpring(1, { damping: 12, stiffness: 200 }));
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.get() }],
        };
    });

    const cardStyle: ViewStyle[] = [
        styles.base,
        { padding: paddingMap[padding] },
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        style,
    ].filter(Boolean) as ViewStyle[];

    if (onPress) {
        return (
            <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
                <Animated.View style={[...cardStyle, animatedStyle]}>
                    {children}
                </Animated.View>
            </Pressable>
        );
    }

    return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
    },
    elevated: {
        ...shadows.lg,
        borderColor: 'transparent',
    },
    outlined: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.border,
    },
});
