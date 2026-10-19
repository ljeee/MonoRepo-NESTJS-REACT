import React, { ReactNode } from 'react';
import { Modal, Platform } from 'react-native';
import { View, Text, Pressable, KeyboardAvoidingView } from '../../tw';
import Icon, { IconName } from './Icon';

export interface ModalShellProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  /** Color del ícono y del halo de fondo. */
  color?: string;
  subtitle?: string;
  /** Ancho máximo de la tarjeta (por defecto 384). */
  maxWidth?: number;
  /** Tocar fuera cierra (por defecto sí; apagarlo mientras se guarda). */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * Fondo oscuro + tarjeta con encabezado (ícono y título). Base de los modales simples:
 * PromptModal, OptionPickerModal… Antes cada modal repetía este marco.
 */
export function ModalShell({
  visible,
  onClose,
  title,
  icon,
  color = '#F5A524',
  subtitle,
  maxWidth = 384,
  closeOnBackdrop = true,
  children,
}: ModalShellProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable className="flex-1 bg-black/90 justify-center items-center p-6" onPress={closeOnBackdrop ? onClose : undefined}>
          <Pressable className="w-full" style={{ maxWidth }} onPress={(e) => e.stopPropagation()}>
            <View className="border border-white/10 rounded-3xl p-6 overflow-hidden" style={{ backgroundColor: '#0F172A' }}>
              <View className="flex-row items-center justify-center gap-3 mb-2">
                {icon && (
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${color}33` }}>
                    <Icon name={icon} size={20} color={color} />
                  </View>
                )}
                <Text className="text-white font-black text-xl uppercase" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                  {title}
                </Text>
              </View>
              {subtitle ? <Text className="text-slate-400 text-xs text-center mb-2">{subtitle}</Text> : null}
              <View className="mt-4">{children}</View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
