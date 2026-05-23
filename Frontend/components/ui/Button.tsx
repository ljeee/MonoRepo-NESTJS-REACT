import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { View, Text, Pressable } from '../../tw';
import Icon, { IconName } from './Icon';
import { springs, timings } from '../../styles/tokens';

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
        opacity.value = withTiming(1, { duration: timings.slow });
        translateY.value = withSpring(0, springs.slow);
    }, []);

    const handlePressIn = () => {
        if (!isDisabled) {
            scale.value = withSpring(0.96, springs.fast);
        }
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, springs.fast);
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
        secondary: 'bg-white/5 border border-white/15 text-slate-300',
        danger: 'bg-red-500/15 border border-red-500/30 text-red-400',
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
        if (variant === 'danger') return '#F87171';
        if (variant === 'secondary') return '#CBD5E1';
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
                            <View className={title ? "mr-2" : ""}>
                                <Icon name={icon} size={iconSize} color={getIconColor()} />
                            </View>
                        )}
                        {title ? (
                            <Text 
                                className={textClasses} 
                                numberOfLines={1} 
                                ellipsizeMode="tail"
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                            >
                                {title}
                            </Text>
                        ) : null}
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
