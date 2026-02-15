import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, spacing, radius, shadows } from '../../styles/tokens';
import Icon from './Icon';
import { useToast, ToastVariant } from '../../contexts/ToastContext';

const { width } = Dimensions.get('window');
const TOAST_WIDTH = Math.min(width - spacing['2xl'] * 2, 400);

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
}

function ToastItem({ id, message, variant, onDismiss }: ToastItemProps) {
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const { bg, border, icon } = getToastColors(variant);

    useEffect(() => {
        // Slide in
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 8,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
    }, [slideAnim, opacityAnim]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => onDismiss(id));
    };

    return (
        <Animated.View
            style={[
                styles.toast,
                { backgroundColor: bg, borderColor: border },
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
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
        width: TOAST_WIDTH,
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
