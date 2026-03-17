import React, { ReactNode } from 'react';
import { RefreshControlProps } from 'react-native';
import { ScrollView, View } from '../../tw';
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
            ? 'px-4 pb-10 pt-4'
            : 'px-8 pb-16 pt-8';

    const innerClasses = `w-full self-center ${maxWidthClasses[maxWidthVariant]} ${paddingClasses}`;

    const content = (
        <View className={`${innerClasses} ${contentContainerClassName || ''}`} style={contentContainerStyle}>
            {children}
        </View>
    );

    if (scrollable) {
        return (
            <ScrollView
                className={`flex-1 bg-(--color-pos-bg) ${className}`}
                style={style}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={refreshControl}
            >
                {content}
            </ScrollView>
        );
    }

    return (
        <View className={`flex-1 bg-(--color-pos-bg) ${className}`} style={style}>
            {content}
        </View>
    );
}
