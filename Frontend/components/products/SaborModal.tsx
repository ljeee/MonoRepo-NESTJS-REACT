import React, { useState } from 'react';
import { Modal, Platform } from 'react-native';
import { View, Text, ScrollView, KeyboardAvoidingView } from '../../tw';
import type { PizzaSabor } from '@monorepo/shared';
import { Input, Button, Icon, Card } from '../ui';

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
                <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 1)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <SaborModalForm
                        key={`${sabor.saborId}-${visible ? 'open' : 'closed'}`}
                        sabor={sabor}
                        loading={loading}
                        onSave={onSave}
                        onClose={onClose}
                    />
                </View>
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
        <Card
            className="w-full max-w-[500px] bg-[#0F172A] border border-white/10 overflow-hidden rounded-[40px]"
        >
            <ScrollView contentContainerStyle={{ padding: 32 }}>
                <View className="flex-row items-center gap-4 mb-8">
                    <View className="w-12 h-12 rounded-2xl bg-purple-500/10 items-center justify-center border border-purple-500/20">
                        <Icon
                            name={isConfig ? 'cog-outline' : 'pizza'}
                            size={24}
                            color="#A855F7"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-black text-2xl uppercase tracking-tighter leading-none" style={{ fontFamily: 'Space Grotesk' }}>
                            {sabor.nombre}
                        </Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-1">
                            {isConfig ? 'Ajuste Global' : (isEspecial ? 'Sabor Especial' : 'Sabor Tradicional')}
                        </Text>
                    </View>
                </View>

                <View className="gap-y-6">
                    {sabor.tipo !== 'configuracion' && (
                        <View className="flex-row gap-4">
                            <View className="flex-1">
                                <Input
                                    label="Pequeña ($)"
                                    value={pequena}
                                    onChangeText={setPequena}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                                />
                            </View>
                            <View className="flex-1">
                                <Input
                                    label="Mediana ($)"
                                    value={mediana}
                                    onChangeText={setMediana}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
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
                        leftIcon={<Icon name="currency-usd" size={16} color="#F5A524" />}
                    />

                    {error && (
                        <View className="flex-row items-center gap-2 bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                            <Icon name="alert-circle" size={16} color="#EF4444" />
                            <Text className="text-red-400 font-bold text-xs">{error}</Text>
                        </View>
                    )}

                    <View className="flex-row gap-4 mt-2">
                        <Button 
                            title="Cancelar" 
                            variant="ghost" 
                            onPress={onClose} 
                            style={{ flex: 1 }} 
                        />
                        <Button 
                            title={loading ? 'Salvando...' : 'Guardar'} 
                            variant="primary"
                            onPress={handleSave} 
                            loading={loading} 
                            style={{ flex: 1 }} 
                        />
                    </View>
                </View>
            </ScrollView>
        </Card>
    );
}
