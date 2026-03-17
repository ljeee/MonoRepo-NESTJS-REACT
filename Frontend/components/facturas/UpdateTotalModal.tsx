import React, { useState } from 'react';
import { Modal } from 'react-native';
import { View, Text, TextInput, Pressable } from '../../tw';
import { Button, Icon, Card } from '../ui';

interface UpdateTotalModalProps {
    visible: boolean;
    currentTotal: number;
    loading?: boolean;
    onConfirm: (newTotal: number) => void;
    onCancel: () => void;
}

export default function UpdateTotalModal({
    visible,
    currentTotal,
    loading = false,
    onConfirm,
    onCancel,
}: UpdateTotalModalProps) {
    const [value, setValue] = useState(() => currentTotal.toString());

    // Force re-render of input when modal opens to show latest total
    const inputKey = `${visible ? 'open' : 'closed'}-${currentTotal}`;

    const handleConfirm = () => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
            onConfirm(num);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable 
                className="flex-1 bg-black/60 justify-center items-center p-6" 
                onPress={onCancel}
            >
                <Pressable 
                    className="w-full max-w-sm"
                    onPress={(e) => e.stopPropagation()}
                >
                    <Card className="bg-slate-900 border border-white/10 p-6 overflow-hidden relative">
                         {/* Background Pattern */}
                        <View className="absolute -top-10 -right-10 w-32 h-32 bg-(--color-pos-primary)/10 rounded-full blur-3xl" />
                        
                        <View className="flex-row items-center justify-center gap-3 mb-6">
                            <View className="w-10 h-10 rounded-xl bg-(--color-pos-primary)/20 items-center justify-center">
                                <Icon name="pencil" size={20} color="#F5A524" />
                            </View>
                            <Text className="text-white font-black text-xl uppercase" style={{ fontFamily: 'Space Grotesk' }}>Editar Total</Text>
                        </View>

                        <View className="mb-6">
                            <Text className="text-slate-500 text-[10px] font-black uppercase mb-2 ml-1">Nuevo Valor de Factura</Text>
                            <View className="relative">
                                <View className="absolute left-4 top-4 z-10">
                                    <Text className="text-(--color-pos-primary) font-black text-lg">$</Text>
                                </View>
                                <TextInput
                                    key={inputKey}
                                    className="bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white text-2xl font-black text-center"
                                    style={{ fontFamily: 'Space Grotesk' }}
                                    defaultValue={currentTotal.toString()}
                                    onChangeText={setValue}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#475569"
                                    selectTextOnFocus
                                    autoFocus
                                />
                            </View>
                            <Text className="text-slate-600 text-[9px] font-bold text-center mt-2 uppercase tracking-widest italic">Anterior: ${currentTotal}</Text>
                        </View>

                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <Button
                                    title="Cancelar"
                                    onPress={onCancel}
                                    variant="ghost"
                                    size="md"
                                    disabled={loading}
                                />
                            </View>
                            <View className="flex-1">
                                <Button
                                    title="Guardar"
                                    onPress={handleConfirm}
                                    variant="primary"
                                    size="md"
                                    loading={loading}
                                />
                            </View>
                        </View>
                    </Card>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
