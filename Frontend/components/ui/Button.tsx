import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { View, Text } from '../../tw';
import Icon, { IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: IconName;
    iconRight?: IconName;
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    className?: string;
    style?: any;
}

export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    style,
}: ButtonProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(5);
    const isDisabled = disabled || loading;

    React.useEffect(() => {
        opacity.value = withTiming(1, { duration: 400 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
    }, []);

    const handlePressIn = () => {
        if (!isDisabled) {
            scale.value = withSpring(0.96, { damping: 12, stiffness: 200 });
        }
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    };

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [
                { scale: scale.value },
                { translateY: translateY.value }
            ],
        };
    });

    const variantClasses = {
        primary: 'bg-(--color-pos-primary) text-black',
        secondary: 'bg-(--color-pos-secondary) text-white',
        danger: 'bg-red-500 text-white',
        ghost: 'bg-transparent text-slate-400',
        outline: 'bg-transparent border-2 border-(--color-pos-primary) text-(--color-pos-primary)',
    };

    const sizeClasses = {
        sm: 'h-11 px-4 text-sm',
        md: 'h-12 px-6 text-base',
        lg: 'h-14 px-8 text-lg',
    };

    const iconSize = size === 'sm' ? 16 : size === 'md' ? 20 : 24;
    
    // Determine text color for icon
    const getIconColor = () => {
        if (isDisabled) return '#64748B';
        if (variant === 'primary') return '#000';
        if (variant === 'secondary' || variant === 'danger') return '#FFF';
        if (variant === 'outline') return '#F5A524';
        return '#94A3B8';
    };

    const combinedClasses = `flex-row items-center justify-center rounded-xl ${variantClasses[variant].split(' ')[0]} ${sizeClasses[size].split(' ').slice(0, 2).join(' ')} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''} ${className}`;

    const textClasses = `font-black uppercase tracking-wider ${variantClasses[variant].split(' ').pop()} ${sizeClasses[size].split(' ').pop()}`;

    return (
        <Pressable
            onPress={isDisabled ? undefined : onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isDisabled}
        >
            <Animated.View
                style={[animatedStyle, style]}
                className={combinedClasses}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={getIconColor()} />
                ) : (
                    <>
                        {icon && (
                            <View className="mr-2">
                                <Icon name={icon} size={iconSize} color={getIconColor()} />
                            </View>
                        )}
                        <Text className={textClasses}>
                            {title}
                        </Text>
                        {iconRight && (
                            <View className="ml-2">
                                <Icon name={iconRight} size={iconSize} color={getIconColor()} />
                            </View>
                        )}
                    </>
                )}
            </Animated.View>
        </Pressable>
    );
}
