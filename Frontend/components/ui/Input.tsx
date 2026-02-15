import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, radius, spacing, layout } from '../../styles/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    hint?: string;
    containerStyle?: ViewStyle;
    inputStyle?: ViewStyle;
    size?: 'sm' | 'md' | 'lg';
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const sizeMap = {
    sm: { height: 40, fontSize: fontSize.sm, padding: spacing.md },
    md: { height: layout.inputHeight, fontSize: fontSize.md, padding: spacing.lg },
    lg: { height: 58, fontSize: fontSize.lg, padding: spacing.xl },
};

export default function Input({
    label,
    error,
    hint,
    containerStyle,
    inputStyle,
    size = 'md',
    leftIcon,
    rightIcon,
    multiline,
    ...rest
}: InputProps) {
    const s = sizeMap[size];

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View
                style={[
                    styles.inputWrapper,
                    { height: multiline ? undefined : s.height, minHeight: multiline ? s.height * 2 : undefined },
                    error && styles.inputError,
                ]}
            >
                {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                <TextInput
                    style={[
                        styles.input,
                        {
                            fontSize: s.fontSize,
                            paddingHorizontal: s.padding,
                            paddingVertical: multiline ? s.padding : 0,
                        },
                        leftIcon && { paddingLeft: 0 },
                        rightIcon && { paddingRight: 0 },
                        multiline && { textAlignVertical: 'top' },
                        inputStyle,
                    ]}
                    placeholderTextColor={colors.placeholder}
                    selectionColor={colors.primary}
                    cursorColor={colors.primary}
                    multiline={multiline}
                    {...rest}
                />
                {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {hint && !error && <Text style={styles.hintText}>{hint}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.extrabold,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgLight,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    inputError: {
        borderColor: colors.danger,
    },
    input: {
        flex: 1,
        color: colors.text,
        height: '100%',
    },
    iconLeft: {
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
    },
    iconRight: {
        paddingRight: spacing.md,
        paddingLeft: spacing.sm,
    },
    errorText: {
        color: colors.danger,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
    hintText: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
});
