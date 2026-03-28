import React, { ReactNode } from 'react';
import { RefreshControlProps, Platform } from 'react-native';
import { ScrollView, View, KeyboardAvoidingView } from '../../tw';
import { useBreakpoint } from '../../styles/responsive';

interface PageContainerProps {
    children: ReactNode;
    scrollable?: boolean;
    maxWidthVariant?: 'default' | 'narrow' | 'wide' | 'full';
    noPadding?: boolean;
    className?: string;
    style?: any;
    contentContainerStyle?: any;
    contentContainerClassName?: string;
    refreshControl?: React.ReactElement<RefreshControlProps>;
}

export default function PageContainer({
    children,
    scrollable = true,
    maxWidthVariant = 'default',
    noPadding = false,
    className = '',
    style,
    contentContainerStyle,
    contentContainerClassName,
    refreshControl,
}: PageContainerProps) {
    const { isMobile, isTablet } = useBreakpoint();
    const isCompact = isMobile || isTablet;

    const maxWidthClasses = {
        narrow: 'max-w-2xl',
        default: 'max-w-6xl',
        wide: 'max-w-7xl',
        full: 'max-w-none',
    };

    const paddingClasses = noPadding
        ? 'px-0'
        : isCompact
            ? 'px-4 pb-8 pt-3'
            : 'px-6 pb-12 pt-6';

    const innerClasses = `flex-1 w-full self-center ${maxWidthClasses[maxWidthVariant]} ${paddingClasses}`;

    const content = (
        <View className={`${innerClasses} ${contentContainerClassName || ''}`} style={contentContainerStyle}>
            {children}
        </View>
    );

    if (scrollable) {
        return (
            <KeyboardAvoidingView 
                className={`flex-1 ${className}`}
                style={[{ backgroundColor: '#060E1A' }, style]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={refreshControl}
                    automaticallyAdjustKeyboardInsets={true}
                >
                    {content}
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView 
            className={`flex-1 ${className}`} 
            style={[{ backgroundColor: '#0C0F1A' }, style]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
            {content}
        </KeyboardAvoidingView>
    );
}
