import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from './Icon';
import { useToast } from '@monorepo/shared';
import type { ToastVariant } from '@monorepo/shared';

function getToastConfig(variant: ToastVariant) {
    switch (variant) {
        case 'success':
            return { 
                classes: 'bg-green-500/10 border-green-500/30 text-green-500',
                iconColor: '#22C55E',
                icon: 'check-circle' as const 
            };
        case 'error':
            return { 
                classes: 'bg-red-500/10 border-red-500/30 text-red-500',
                iconColor: '#EF4444',
                icon: 'alert-circle' as const 
            };
        case 'warning':
            return { 
                classes: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
                iconColor: '#F59E0B',
                icon: 'alert' as const 
            };
        case 'info':
        default:
            return { 
                classes: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
                iconColor: '#3B82F6',
                icon: 'information' as const 
            };
    }
}

interface ToastItemProps {
    id: string;
    message: string;
    variant: ToastVariant;
    onDismiss: (id: string) => void;
    toastWidth: number;
}

function ToastItem({ id, message, variant, onDismiss, toastWidth }: ToastItemProps) {
    const slideAnim = useSharedValue(-100);
    const opacityAnim = useSharedValue(0);
    const { classes, iconColor, icon } = getToastConfig(variant);

    useEffect(() => {
        slideAnim.value = withSpring(0, { damping: 15, stiffness: 150 });
        opacityAnim.value = withTiming(1, { duration: 200 });
    }, [opacityAnim, slideAnim]);

    const handleDismiss = () => {
        slideAnim.value = withTiming(-100, { duration: 200 });
        opacityAnim.value = withTiming(0, { duration: 200 }, (finished) => {
            if (finished) {
                runOnJS(onDismiss)(id);
            }
        });
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: slideAnim.value }],
            opacity: opacityAnim.value,
        };
    });

    return (
        <Animated.View
            style={[{ width: toastWidth }, animatedStyle]}
            className={`flex-row items-center gap-4 p-5 rounded-2xl border-2 shadow-2xl ${classes}`}
        >
            <Icon name={icon} size={22} color={iconColor} />
            <Text className="flex-1 font-black leading-5 text-sm" numberOfLines={3}>
                {message}
            </Text>
            <TouchableOpacity onPress={handleDismiss} className="p-1 opacity-60">
                <Icon name="close" size={18} color={iconColor} />
            </TouchableOpacity>
        </Animated.View>
    );
}

export function ToastContainer() {
    const { toasts, hideToast } = useToast();
    const { width } = useWindowDimensions();
    const toastWidth = Math.min(width - 40, 420);

    if (toasts.length === 0) return null;

    return (
        <View className="absolute top-16 left-0 right-0 items-center z-[9999] gap-3" pointerEvents="box-none">
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    id={toast.id}
                    message={toast.message}
                    variant={toast.variant}
                    onDismiss={hideToast}
                    toastWidth={toastWidth}
                />
            ))}
        </View>
    );
}
