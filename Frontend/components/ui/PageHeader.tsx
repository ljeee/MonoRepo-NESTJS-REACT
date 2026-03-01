import React, { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, spacing } from '../../styles/tokens';
import { useBreakpoint } from '../../styles/responsive';
import Icon, { IconName } from './Icon';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: IconName;
    rightContent?: ReactNode;
    style?: ViewStyle;
}

/**
 * Consistent page header with title, optional subtitle, icon, and right-side actions.
 */
export default function PageHeader({
    title,
    subtitle,
    icon,
    rightContent,
    style,
}: PageHeaderProps) {
    const { isMobile } = useBreakpoint();

    return (
        <View style={[styles.container, isMobile && styles.containerMobile, style]}>
            <View style={styles.left}>
                {icon && (
                    <View style={[styles.iconContainer, isMobile && styles.iconContainerMobile]}>
                        <Icon name={icon} size={isMobile ? 22 : 28} color={colors.primary} />
                    </View>
                )}
                <View style={[styles.textContainer, isMobile && styles.textContainerMobile]}>
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                    <Text style={[styles.title, isMobile && styles.titleMobile]}>{title}</Text>
                </View>
            </View>
            {rightContent && <View style={[styles.right, isMobile && styles.rightMobile]}>{rightContent}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing['2xl'],
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    containerMobile: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: fontSize['3xl'],
        fontWeight: fontWeight.black,
        color: colors.text,
        letterSpacing: -0.5,
    },
    titleMobile: {
        fontSize: fontSize['2xl'],
    },
    subtitle: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.xs,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconContainerMobile: {
        width: 38,
        height: 38,
    },
    textContainerMobile: {
        marginLeft: 0,
    },
    rightMobile: {
        marginTop: spacing.md,
    },
});
