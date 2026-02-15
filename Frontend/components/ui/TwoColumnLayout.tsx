import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useBreakpoint } from '../../styles/responsive';
import { spacing } from '../../styles/tokens';

interface TwoColumnLayoutProps {
    left: ReactNode;
    right: ReactNode;
    leftWidth?: number; // Percentage (0-100)
    gap?: number;
    style?: ViewStyle;
    stackOnMobile?: boolean;
}

/**
 * Two-column layout that stacks on mobile and displays side-by-side on desktop.
 * Perfect for form + preview layouts, or main content + sidebar.
 */
export default function TwoColumnLayout({
    left,
    right,
    leftWidth = 60,
    gap = spacing.xl,
    style,
    stackOnMobile = true,
}: TwoColumnLayoutProps) {
    const { isMobile, isTablet } = useBreakpoint();
    const shouldStack = stackOnMobile && (isMobile || isTablet);

    const rightWidth = 100 - leftWidth;

    return (
        <View
            style={[
                styles.container,
                shouldStack ? styles.stacked : styles.sideBySide,
                { gap },
                style,
            ]}
        >
            <View
                style={[
                    styles.column,
                    shouldStack ? styles.fullWidth : { width: `${leftWidth}%` },
                ]}
            >
                {left}
            </View>
            <View
                style={[
                    styles.column,
                    shouldStack ? styles.fullWidth : { width: `${rightWidth}%` },
                ]}
            >
                {right}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    stacked: {
        flexDirection: 'column',
    },
    sideBySide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    column: {
        flexShrink: 0,
    },
    fullWidth: {
        width: '100%',
    },
});
