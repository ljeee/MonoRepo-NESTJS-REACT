import React, { useState } from 'react';
import { Modal } from 'react-native';
import { Pressable } from '../../tw';
import { View, Text, TouchableOpacity } from '../../tw';
import { Button, Icon } from '../ui';
import type { IconName } from '../ui/Icon';

interface PaymentSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (method: string) => void;
    loading?: boolean;
}

const METHODS: { id: string; label: string; icon: IconName; color: string }[] = [
    { id: 'efectivo', label: 'Efectivo', icon: 'cash', color: '#10B981' },
    { id: 'transferencia', label: 'Transferencia', icon: 'bank', color: '#8B5CF6' },
];

export default function PaymentSelectionModal({ visible, onClose, onSelect, loading }: PaymentSelectionModalProps) {
    const [selected, setSelected] = useState('efectivo');

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable className="flex-1 bg-black/60 justify-center items-center p-5" onPress={onClose}>
                <Pressable 
                    className="bg-(--color-pos-surface) rounded-3xl p-8 w-full max-w-sm border border-white/5 shadow-2xl" 
                    onPress={(e) => e.stopPropagation()}
                >
                    <Text className="text-white font-black text-2xl mb-2" style={{ fontFamily: 'Space Grotesk' }}>Finalizar Venta</Text>
                    <Text className="text-slate-400 text-sm mb-6">Seleccione el método de pago recibido para cerrar la factura:</Text>

                    <View className="gap-3 mb-8">
                        {METHODS.map((m) => {
                            const isSelected = selected === m.id;
                            return (
                                <TouchableOpacity
                                    key={m.id}
                                    onPress={() => setSelected(m.id)}
                                    className={`flex-row items-center p-4 rounded-2xl border-2 transition-all ${
                                        isSelected ? 'bg-white/10 border-(--color-pos-primary)' : 'bg-black/20 border-white/5'
                                    }`}
                                >
                                    <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: m.color + '20' }}>
                                        <Icon name={m.icon} size={20} color={m.color} />
                                    </View>
                                    <Text className={`flex-1 font-black ${isSelected ? 'text-white' : 'text-slate-400'}`}>{m.label}</Text>
                                    {isSelected && <Icon name="check-circle" size={20} color="#F5A524" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={loading} />
                        </View>
                        <View className="flex-1">
                            <Button 
                                title="Confirmar" 
                                variant="primary" 
                                onPress={() => onSelect(selected)} 
                                loading={loading} 
                            />
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
