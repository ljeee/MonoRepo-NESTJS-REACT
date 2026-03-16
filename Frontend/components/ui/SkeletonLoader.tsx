import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number | string;
    className?: string;
    style?: any;
}

export function Skeleton({
    width = '100%',
    height = 20,
    borderRadius = 8,
    className = '',
    style,
}: SkeletonProps) {
    const shimmer = useSharedValue(-200);

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(200, { duration: 1500, easing: Easing.linear }),
            -1,
            false
        );
    }, [shimmer]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: shimmer.value }],
        };
    });

    return (
        <View
            className={`bg-white/5 overflow-hidden ${className}`}
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius: typeof borderRadius === 'string' ? undefined : borderRadius,
                },
                style,
            ]}
        >
            <Animated.View
                style={animatedStyle}
                className="w-full h-full bg-white/10 opacity-50"
            />
        </View>
    );
}

export function CardSkeleton({ className = '', style }: { className?: string; style?: any }) {
    return (
        <View className={`bg-(--color-pos-surface) rounded-2xl p-5 border border-white/5 ${className}`} style={style}>
            <View className="flex-row justify-between items-center mb-4">
                <Skeleton width={120} height={16} />
                <Skeleton width={80} height={24} borderRadius={20} />
            </View>
            <Skeleton width="70%" height={14} className="mt-4" />
            <Skeleton width="50%" height={14} className="mt-2" />
            <Skeleton width="90%" height={14} className="mt-2" />
        </View>
    );
}

export function ListSkeleton({ count = 3, className = '', style }: { count?: number; className?: string; style?: any }) {
    return (
        <View className={className} style={style}>
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={`skeleton-${i}`} className="mb-4" />
            ))}
        </View>
    );
}
