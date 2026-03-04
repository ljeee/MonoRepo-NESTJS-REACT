import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
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
    const shimmer = useSharedValue(-200);

    useEffect(() => {
        shimmer.set(withRepeat(
            withTiming(200, { duration: 1500, easing: Easing.linear }),
            -1,
            false
        ));
    }, [shimmer]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: shimmer.value }],
        };
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
                style={[skeletonStyles.shimmer, animatedStyle]}
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
            <Skeleton width="70%" height={14} style={skeletonStyles.marginTopMd} />
            <Skeleton width="50%" height={14} style={skeletonStyles.marginTopSm} />
            <Skeleton width="90%" height={14} style={skeletonStyles.marginTopSm} />
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
                <CardSkeleton key={`skeleton-${i}`} style={skeletonStyles.marginBottomMd} />
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
    shimmer: {
        width: '100%',
        height: '100%',
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    marginTopMd: {
        marginTop: spacing.md,
    },
    marginTopSm: {
        marginTop: spacing.sm,
    },
    marginBottomMd: {
        marginBottom: spacing.md,
    },
});
