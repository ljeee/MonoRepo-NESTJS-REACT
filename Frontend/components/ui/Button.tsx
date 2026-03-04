import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    ViewStyle,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, radius, shadows, spacing } from '../../styles/tokens';
import Icon, { IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconRight?: IconName;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
    primary: { bg: colors.primary, text: '#ffffff', border: colors.primary },
    secondary: { bg: colors.secondary, text: '#ffffff', border: colors.secondary },
    danger: { bg: colors.danger, text: '#ffffff', border: colors.danger },
    ghost: { bg: 'transparent', text: colors.text, border: 'transparent' },
    outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
};

const sizeStyles: Record<ButtonSize, { h: number; px: number; fs: number; iconSize: number }> = {
    sm: { h: 40, px: spacing.md, fs: fontSize.sm, iconSize: 18 },
    md: { h: 50, px: spacing.lg, fs: fontSize.md, iconSize: 20 },
    lg: { h: 60, px: spacing.xl, fs: fontSize.lg, iconSize: 24 },
};

export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    disabled = false,
    fullWidth = false,
    style,
}: ButtonProps) {
    const scale = useSharedValue(1);
    const v = variantStyles[variant];
    const s = sizeStyles[size];
    const isDisabled = disabled || loading;

    const handlePressIn = () => {
        if (!isDisabled) {
            scale.set(withSpring(0.96, { damping: 12, stiffness: 200 }));
        }
    };

    const handlePressOut = () => {
        scale.set(withSpring(1, { damping: 12, stiffness: 200 }));
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.get() }],
        };
    });

    return (
        <Pressable
            onPress={isDisabled ? undefined : onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
        >
            <Animated.View
                style={[
                    styles.base,
                    {
                        backgroundColor: v.bg,
                        borderColor: v.border,
                        height: s.h,
                        paddingHorizontal: s.px,
                        opacity: isDisabled ? 0.5 : 1,
                    },
                    animatedStyle,
                    variant === 'outline' && { borderWidth: 1.5 },
                    variant !== 'ghost' && variant !== 'outline' && shadows.sm,
                    fullWidth && { width: '100%' },
                    style,
                ]}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={v.text} />
                ) : (
                    <>
                        {icon && <Icon name={icon} size={s.iconSize} color={v.text} style={styles.iconMarginRight} />}
                        <Text
                            style={[
                                styles.text,
                                {
                                    color: v.text,
                                    fontSize: s.fs,
                                },
                            ]}
                        >
                            {title}
                        </Text>
                        {iconRight && <Icon name={iconRight} size={s.iconSize} color={v.text} style={styles.iconMarginLeft} />}
                    </>
                )}
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: 0,
    },
    text: {
        fontWeight: fontWeight.bold,
        letterSpacing: 0.3,
    },
    iconMarginRight: {
        marginRight: spacing.sm,
    },
    iconMarginLeft: {
        marginLeft: spacing.sm,
    },
});
