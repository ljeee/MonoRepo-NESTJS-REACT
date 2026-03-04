import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, spacing, radius, shadows } from '../../styles/tokens';
import Icon from './Icon';
import { useToast, ToastVariant } from '../../contexts/ToastContext';

function getToastColors(variant: ToastVariant) {
    switch (variant) {
        case 'success':
            return { bg: colors.successLight, border: colors.success, icon: 'check-circle' as const };
        case 'error':
            return { bg: colors.dangerLight, border: colors.danger, icon: 'alert-circle' as const };
        case 'warning':
            return { bg: colors.warningLight, border: colors.warning, icon: 'alert' as const };
        case 'info':
        default:
            return { bg: colors.infoLight, border: colors.info, icon: 'information' as const };
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
    const { bg, border, icon } = getToastColors(variant);

    useEffect(() => {
        // Slide in
        slideAnim.set(withSpring(0, { damping: 15, stiffness: 150 }));
        opacityAnim.set(withTiming(1, { duration: 200 }));
    }, [opacityAnim, slideAnim]);

    const handleDismiss = () => {
        slideAnim.set(withTiming(-100, { duration: 200 }));
        opacityAnim.set(withTiming(0, { duration: 200 }, (finished) => {
            if (finished) {
                runOnJS(onDismiss)(id);
            }
        }));
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: slideAnim.get() }],
            opacity: opacityAnim.get(),
        };
    });

    return (
        <Animated.View
            style={[
                styles.toast,
                { backgroundColor: bg, borderColor: border, width: toastWidth },
                animatedStyle,
            ]}
        >
            <Icon name={icon} size={20} color={border} />
            <Text style={[styles.message, { color: border }]} numberOfLines={3}>
                {message}
            </Text>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
                <Icon name="close" size={18} color={border} />
            </TouchableOpacity>
        </Animated.View>
    );
}

export function ToastContainer() {
    const { toasts, hideToast } = useToast();
    const { width } = useWindowDimensions();
    const toastWidth = Math.min(width - spacing['2xl'] * 2, 400);

    if (toasts.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="box-none">
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

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: spacing['3xl'],
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        gap: spacing.md,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        ...shadows.lg,
    },
    message: {
        flex: 1,
        fontSize: fontSize.md,
        fontWeight: fontWeight.medium,
    },
    closeButton: {
        padding: spacing.xs,
    },
});
