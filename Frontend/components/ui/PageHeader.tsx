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
          className={`flex-row justify-between items-center gap-3 ${isMobile ? 'mb-4' : 'mb-6'} ${className}`} 
          style={style}
        >
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
                {icon && (
                    <View style={{
                        width: isMobile ? 38 : 44, height: isMobile ? 38 : 44,
                        borderRadius: isMobile ? 12 : 14,
                        backgroundColor: 'rgba(245,165,36,0.12)',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        borderWidth: 1, borderColor: 'rgba(245,165,36,0.25)',
                    }}>
                        <Icon name={icon} size={isMobile ? 20 : 22} color="#F5A524" />
                    </View>
                )}
                <View className="flex-1 min-w-0">
                    {subtitle && (
                        <Text style={{ fontFamily: 'Outfit', fontSize: 10, color: '#F5A524', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>
                            {subtitle}
                        </Text>
                    )}
                    <View className="flex-row items-center flex-wrap">
                        <Text 
                            style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: isMobile ? 20 : 24, color: '#F8FAFC', letterSpacing: -0.5, flexShrink: 1 }}
                            numberOfLines={1}
                        >
                            {title}
                        </Text>
                        {children}
                    </View>
                </View>
            </View>
            
            {rightContent && (
                <View className="flex-row items-center gap-2 flex-shrink-0">
                    {rightContent}
                </View>
            )}
        </View>
    );
}
