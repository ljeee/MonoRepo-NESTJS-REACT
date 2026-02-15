import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useBreakpoint } from '../../styles/responsive';
import { spacing } from '../../styles/tokens';

interface ResponsiveGridProps {
    children: ReactNode;
    columns?: {
        mobile?: number;
        tablet?: number;
        desktop?: number;
        largeDesktop?: number;
    };
    gap?: number;
    style?: ViewStyle;
}

/**
 * Responsive grid component that automatically adjusts columns based on screen size.
 * Perfect for card layouts, product grids, and list views.
 */
export default function ResponsiveGrid({
    children,
    columns = {
        mobile: 1,
        tablet: 2,
        desktop: 3,
        largeDesktop: 4,
    },
    gap = spacing.md,
    style,
}: ResponsiveGridProps) {
    const breakpoint = useBreakpoint();

    const numColumns = breakpoint.isMobile
        ? columns.mobile || 1
        : breakpoint.isTablet
            ? columns.tablet || 2
            : breakpoint.isDesktop
                ? columns.desktop || 3
                : columns.largeDesktop || 4;

    const childArray = React.Children.toArray(children);

    return (
        <View style={[styles.container, { gap }, style]}>
            {childArray.map((child, index) => (
                <View
                    key={index}
                    style={[
                        styles.item,
                        {
                            width: numColumns === 1 ? '100%' : `${100 / numColumns}%`,
                            paddingHorizontal: gap / 2,
                            marginBottom: gap,
                        },
                    ]}
                >
                    {child}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -spacing.md / 2,
    },
    item: {
        flexShrink: 0,
    },
});
