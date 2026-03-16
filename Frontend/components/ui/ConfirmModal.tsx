import React from 'react';
import { Modal } from 'react-native';
import { Pressable } from '../../tw';
import { View, Text } from '../../tw';
import Button from './Button';
import Icon, { IconName } from './Icon';

interface ConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    icon?: IconName;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    children?: React.ReactNode;
}

export default function ConfirmModal({
    visible,
    title,
    message,
    icon,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    loading = false,
    onConfirm,
    onCancel,
    children,
}: ConfirmModalProps) {
    const variantColor =
        variant === 'danger' ? '#EF4444' :
            variant === 'warning' ? '#F59E0B' :
                '#3B82F6';

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable className="flex-1 bg-black/60 justify-center items-center p-5" onPress={onCancel}>
                <Pressable className="bg-(--color-pos-surface) rounded-3xl p-8 w-full max-w-sm items-center border border-white/5 shadow-2xl" onPress={(e) => e.stopPropagation()}>
                    {/* Icon */}
                    {icon && (
                        <View className="w-16 h-16 rounded-full items-center justify-center mb-6" style={{ backgroundColor: variantColor + '20' }}>
                            <Icon name={icon} size={32} color={variantColor} />
                        </View>
                    )}

                    {/* Text */}
                    <Text className="text-white font-black text-xl text-center mb-2" style={{ fontFamily: 'Space Grotesk' }}>{title}</Text>
                    <Text className="text-slate-400 text-sm text-center mb-8 leading-5">{message}</Text>

                    {children && (
                        <View className="w-full mb-6">
                            {children}
                        </View>
                    )}

                    {/* Actions */}
                    <View className="flex-row gap-3 w-full">
                        <View className="flex-1">
                            <Button
                                title={cancelText}
                                onPress={onCancel}
                                variant="ghost"
                                size="md"
                                fullWidth
                                disabled={loading}
                            />
                        </View>
                        <View className="flex-1">
                            <Button
                                title={confirmText}
                                onPress={onConfirm}
                                variant={variant === 'danger' ? 'danger' : 'primary'}
                                size="md"
                                fullWidth
                                loading={loading}
                            />
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
