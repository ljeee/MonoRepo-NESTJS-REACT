import React, { ReactNode } from 'react';
import { Platform, RefreshControlProps, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../styles/theme';
import { spacing, layout } from '../../styles/tokens';
import { useBreakpoint } from '../../styles/responsive';

interface PageContainerProps {
    children: ReactNode;
    scrollable?: boolean;
    maxWidth?: number;
    maxWidthVariant?: 'default' | 'narrow' | 'wide' | 'full';
    noPadding?: boolean;
    style?: ViewStyle;
    contentContainerStyle?: ViewStyle;
    refreshControl?: React.ReactElement<RefreshControlProps>;
}

/**
 * Consistent page wrapper that handles:
 * - Max-width clamping for readability on large screens
 * - Responsive padding (more on desktop, less on mobile)
 * - Top padding offset for mobile menu button
 * - Optional scrolling
 * - Bottom padding for mobile nav bar
 * - Pull-to-refresh support
 */
export default function PageContainer({
    children,
    scrollable = true,
    maxWidth,
    maxWidthVariant = 'default',
    noPadding = false,
    style,
    contentContainerStyle,
    refreshControl,
}: PageContainerProps) {
    const { isMobile } = useBreakpoint();

    // Determine max width based on variant
    const effectiveMaxWidth = maxWidth || (
        maxWidthVariant === 'narrow' ? layout.maxContentWidthNarrow :
            maxWidthVariant === 'wide' ? layout.maxContentWidthWide :
                maxWidthVariant === 'full' ? undefined :
                    layout.maxContentWidth
    );

    const containerPadding = noPadding
        ? 0
        : isMobile
            ? spacing.lg
            : spacing['2xl'];

    const topPadding = isMobile
        ? 120
        : spacing['2xl'];

    const content = (
        <View
            style={[
                styles.inner,
                {
                    maxWidth: effectiveMaxWidth,
                    paddingHorizontal: containerPadding,
                    paddingTop: topPadding,
                    paddingBottom: isMobile ? 150 : spacing['3xl'],
                },
                contentContainerStyle,
            ]}
        >
            {children}
        </View>
    );

    if (scrollable) {
        return (
            <ScrollView
                style={[styles.container, style]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={refreshControl}
            >
                {content}
            </ScrollView>
        );
    }

    return (
        <View style={[styles.container, styles.fixedContent, style]}>
            {content}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
    },
    fixedContent: {
        alignItems: 'center',
    },
    inner: {
        width: '100%',
    },
});
