import React, { ReactNode } from 'react';
import { View, Text } from '../../tw';
import { useBreakpoint } from '../../styles/responsive';
import Icon, { IconName } from './Icon';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: IconName;
    rightContent?: ReactNode;
    children?: ReactNode;
    style?: any;
    className?: string;
}

export default function PageHeader({
    title,
    subtitle,
    icon,
    rightContent,
    children,
    style,
    className = '',
}: PageHeaderProps) {
    const { isMobile } = useBreakpoint();

    return (
        <View 
          className={`flex-row justify-between items-center mb-6 gap-4 ${isMobile ? 'flex-col items-start w-full' : ''} ${className}`} 
          style={style}
        >
            <View className={`flex-row items-center gap-4 ${isMobile ? 'w-full' : 'flex-1'}`}>
                {icon && (
                    <View className="w-12 h-12 rounded-2xl bg-(--color-pos-primary)/10 items-center justify-center flex-shrink-0">
                        <Icon name={icon} size={isMobile ? 22 : 28} color="#F5A524" />
                    </View>
                )}
                <View className="flex-1 min-w-0">
                    {subtitle && (
                        <Text className="text-[10px] font-black text-(--color-pos-primary) uppercase tracking-[2px] mb-1 flex-shrink">
                            {subtitle}
                        </Text>
                    )}
                    <View className={`flex-row items-center ${isMobile ? 'flex-wrap' : ''} w-full`}>
                        <Text 
                            className="text-white font-black text-3xl tracking-tighter flex-shrink" 
                            style={{ fontFamily: 'Space Grotesk', flexBasis: 'auto' }}
                        >
                            {title}
                        </Text>
                        {children}
                    </View>
                </View>
            </View>
            
            {(rightContent || (isMobile && !rightContent && false)) && (
                <View className={`flex-row items-center gap-2 ${isMobile ? 'mt-4' : ''}`}>
                    {rightContent}
                </View>
            )}
        </View>
    );
}
