import React, { useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    ViewStyle,
} from 'react-native';
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
    sm: { h: 36, px: spacing.md, fs: fontSize.sm, iconSize: 16 },
    md: { h: 44, px: spacing.lg, fs: fontSize.md, iconSize: 18 },
    lg: { h: 54, px: spacing.xl, fs: fontSize.lg, iconSize: 22 },
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
    const scale = useRef(new Animated.Value(1)).current;
    const v = variantStyles[variant];
    const s = sizeStyles[size];
    const isDisabled = disabled || loading;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: Platform.OS !== 'web',
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: Platform.OS !== 'web',
            speed: 50,
            bounciness: 4,
        }).start();
    };

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
                        transform: [{ scale }],
                    },
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
                        {icon && <Icon name={icon} size={s.iconSize} color={v.text} style={{ marginRight: spacing.sm }} />}
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
                        {iconRight && <Icon name={iconRight} size={s.iconSize} color={v.text} style={{ marginLeft: spacing.sm }} />}
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
});
