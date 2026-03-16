import React from 'react';
import { TextInputProps } from 'react-native';
import { View, Text, TextInput } from '../../tw';

interface InputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    hint?: string;
    containerStyle?: any;
    inputStyle?: any;
    size?: 'sm' | 'md' | 'lg';
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    className?: string;
}

export default function Input({
    label,
    error,
    hint,
    containerStyle,
    inputStyle,
    size = 'md',
    leftIcon,
    rightIcon,
    multiline,
    className = '',
    ...rest
}: InputProps) {
    const sizeClasses = {
        sm: 'h-10 text-sm px-3',
        md: 'h-12 text-base px-4',
        lg: 'h-14 text-lg px-5',
    };

    const wrapperClasses = `flex-row items-center bg-white/5 rounded-xl border-2 ${error ? 'border-red-500/50' : 'border-white/5 focus-within:border-(--color-pos-primary)/50'} overflow-hidden`;

    return (
        <View className={`mb-4 w-full ${className}`} style={containerStyle}>
            {label && (
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    {label}
                </Text>
            )}
            <View className={wrapperClasses}>
                {leftIcon && <View className="pl-3">{leftIcon}</View>}
                <TextInput
                    className={`flex-1 text-white focus:outline-none ${sizeClasses[size]} ${leftIcon ? 'pl-2' : ''} ${rightIcon ? 'pr-2' : ''} ${multiline ? 'h-auto py-3' : ''}`}
                    placeholderTextColor="#64748B"
                    cursorColor="#F5A524"
                    selectionColor="#F5A524"
                    multiline={multiline}
                    style={[{ outlineStyle: 'none' } as any, { textAlignVertical: multiline ? 'top' : 'center' }, inputStyle]}
                    {...rest}
                />
                {rightIcon && <View className="pr-3">{rightIcon}</View>}
            </View>
            {error ? (
                <Text className="text-red-400 text-[10px] font-bold mt-1 ml-1">{error}</Text>
            ) : hint ? (
                <Text className="text-slate-500 text-[10px] mt-1 ml-1">{hint}</Text>
            ) : null}
        </View>
    );
}
