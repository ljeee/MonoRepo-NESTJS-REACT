import React, { useState } from 'react';
import { Modal, Platform } from 'react-native';
import { View, Text, Pressable, KeyboardAvoidingView } from '../../tw';
import type { PizzaSabor } from '@monorepo/shared';
import { Input, Button, Icon } from '../ui';

interface SaborModalProps {
    visible: boolean;
    sabor: PizzaSabor | null;
    loading?: boolean;
    onSave: (saborId: number, data: { recargoPequena: number; recargoMediana: number; recargoGrande: number }) => void;
    onClose: () => void;
}

export function SaborModal({ visible, sabor, loading, onSave, onClose }: SaborModalProps) {
    if (!sabor) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <Pressable
                    className="flex-1 bg-black/60 items-center justify-center p-6"
                    onPress={onClose}
                >
                    <SaborModalForm
                        key={`${sabor.saborId}-${visible ? 'open' : 'closed'}`}
                        sabor={sabor}
                        loading={loading}
                        onSave={onSave}
                        onClose={onClose}
                    />
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function SaborModalForm({
    sabor,
    loading,
    onSave,
    onClose,
}: {
    sabor: PizzaSabor;
    loading?: boolean;
    onSave: (saborId: number, data: { recargoPequena: number; recargoMediana: number; recargoGrande: number }) => void;
    onClose: () => void;
}) {
    const [pequena, setPequena] = useState(() => String(sabor.recargoPequena));
    const [mediana, setMediana] = useState(() => String(sabor.recargoMediana));
    const [grande, setGrande] = useState(() => String(sabor.recargoGrande));
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => {
        const p = Number(pequena);
        const m = Number(mediana);
        const g = Number(grande);
        if (isNaN(p) || isNaN(m) || isNaN(g) || p < 0 || m < 0 || g < 0) {
            setError('Los recargos deben ser números positivos');
            return;
        }
        onSave(sabor.saborId, { recargoPequena: p, recargoMediana: m, recargoGrande: g });
    };

    const isEspecial = sabor.tipo === 'especial';
    const isConfig = sabor.tipo === 'configuracion';

    return (
        <Pressable
            className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl overflow-hidden"
            onPress={e => e.stopPropagation()}
        >
            <View className="flex-row items-center gap-3 p-6 bg-white/5 border-b border-white/5">
                <View className="w-10 h-10 rounded-xl bg-purple-500/10 items-center justify-center">
                    <Icon
                        name={isConfig ? 'cog-outline' : 'pizza'}
                        size={20}
                        color="#A855F7"
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-white font-black uppercase tracking-widest text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                        {isEspecial ? '★ ' : ''}{sabor.nombre}
                    </Text>
                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
                        {isConfig ? 'Ajuste Global' : (isEspecial ? 'Sabor Especial' : 'Sabor Tradicional')}
                    </Text>
                </View>
            </View>

            <View className="p-6 gap-y-4">
                {sabor.tipo !== 'configuracion' && (
                    <View className="flex-row gap-4">
                        <View className="flex-1">
                            <Input
                                label="Pequena ($)"
                                value={pequena}
                                onChangeText={setPequena}
                                keyboardType="numeric"
                                placeholder="0"
                                className="bg-black/20"
                            />
                        </View>
                        <View className="flex-1">
                            <Input
                                label="Mediana ($)"
                                value={mediana}
                                onChangeText={setMediana}
                                keyboardType="numeric"
                                placeholder="0"
                                className="bg-black/20"
                            />
                        </View>
                    </View>
                )}
                
                <Input
                    label={isConfig ? "Valor Adicional ($)" : "Grande ($)"}
                    value={grande}
                    onChangeText={setGrande}
                    keyboardType="numeric"
                    placeholder="0"
                    className="bg-black/20"
                />

                {error && (
                    <View className="flex-row items-center gap-2 bg-red-500/10 p-2 rounded-xl">
                        <Icon name="alert-circle" size={14} color="#EF4444" />
                        <Text className="text-red-400 font-bold text-xs">{error}</Text>
                    </View>
                )}

                <View className="flex-row gap-3 mt-2">
                    <Button 
                        title="Cancelar" 
                        variant="ghost" 
                        onPress={onClose} 
                        className="flex-1" 
                    />
                    <Button 
                        title={loading ? '...' : 'Guardar'} 
                        variant="primary"
                        onPress={handleSave} 
                        loading={loading} 
                        className="flex-1" 
                    />
                </View>
            </View>
        </Pressable>
    );
}
