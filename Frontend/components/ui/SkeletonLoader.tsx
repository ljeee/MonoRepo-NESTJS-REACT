import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../styles/theme';
import { radius, spacing } from '../../styles/tokens';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Skeleton loader with shimmer animation for loading states.
 * Use instead of plain "Cargando..." text.
 */
export function Skeleton({
    width = '100%',
    height = 20,
    borderRadius = radius.sm,
    style,
}: SkeletonProps) {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(shimmer, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            }),
        );
        animation.start();
        return () => animation.stop();
    }, [shimmer]);

    const translateX = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
    });

    return (
        <View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: colors.card,
                    overflow: 'hidden',
                },
                style,
            ]}
        >
            <Animated.View
                style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: colors.border,
                    opacity: 0.5,
                    transform: [{ translateX }],
                }}
            />
        </View>
    );
}

/**
 * Pre-built skeleton for a typical card layout.
 */
export function CardSkeleton({ style }: { style?: ViewStyle }) {
    return (
        <View style={[skeletonStyles.card, style]}>
            <View style={skeletonStyles.cardHeader}>
                <Skeleton width={120} height={16} />
                <Skeleton width={80} height={24} borderRadius={radius.full} />
            </View>
            <Skeleton width="70%" height={14} style={{ marginTop: spacing.md }} />
            <Skeleton width="50%" height={14} style={{ marginTop: spacing.sm }} />
            <Skeleton width="90%" height={14} style={{ marginTop: spacing.sm }} />
        </View>
    );
}

/**
 * Pre-built skeleton for list views.
 */
export function ListSkeleton({ count = 3, style }: { count?: number; style?: ViewStyle }) {
    return (
        <View style={style}>
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} style={{ marginBottom: spacing.md }} />
            ))}
        </View>
    );
}

const skeletonStyles = StyleSheet.create({
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});
