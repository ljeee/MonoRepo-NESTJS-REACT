import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, radius, spacing } from '../../styles/tokens';
import Icon, { IconName } from './Icon';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
    label: string;
    variant?: BadgeVariant;
    icon?: IconName;
    size?: 'sm' | 'md';
    style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: colors.successLight, text: colors.success },
    warning: { bg: colors.warningLight, text: colors.warning },
    danger: { bg: colors.dangerLight, text: colors.danger },
    info: { bg: colors.infoLight, text: colors.info },
    primary: { bg: colors.primaryLight, text: colors.primary },
    neutral: { bg: colors.card, text: colors.textMuted },
};

export default function Badge({ label, variant = 'neutral', icon, size = 'sm', style }: BadgeProps) {
    const v = variantColors[variant];

    return (
        <View
            style={[
                styles.base,
                {
                    backgroundColor: v.bg,
                    paddingVertical: size === 'sm' ? spacing.xs : spacing.sm,
                    paddingHorizontal: size === 'sm' ? spacing.sm : spacing.md,
                },
                style,
            ]}
        >
            {icon && (
                <Icon
                    name={icon}
                    size={size === 'sm' ? 12 : 14}
                    color={v.text}
                    style={{ marginRight: spacing.xs }}
                />
            )}
            <Text
                style={[
                    styles.text,
                    {
                        color: v.text,
                        fontSize: size === 'sm' ? fontSize.xs : fontSize.sm,
                    },
                ]}
            >
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.full,
        alignSelf: 'flex-start',
    },
    text: {
        fontWeight: fontWeight.bold,
        letterSpacing: 0.3,
        textTransform: 'capitalize',
    },
});
