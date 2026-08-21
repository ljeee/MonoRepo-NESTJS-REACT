import React, { useState, useEffect } from 'react';
import { Modal, ScrollView } from 'react-native';
import { View, Text, Pressable, TouchableOpacity } from '../../tw';
import { Button, Icon } from '../ui';
import { useApi } from '@/src/shared';

interface AssignCuentaModalProps {
    visible: boolean;
    loading?: boolean;
    onConfirm: (cuentaId: number, cuentaNombre: string) => void;
    onCancel: () => void;
}

export default function AssignCuentaModal({
    visible,
    loading = false,
    onConfirm,
    onCancel,
}: AssignCuentaModalProps) {
    const api = useApi();
    const [cuentas, setCuentas] = useState<any[]>([]);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (visible) {
            setFetching(true);
            api.empresa.cuentasTransferencia.getAll()
                .then(res => setCuentas((res || []).filter((c: any) => c.activa)))
                .catch(() => {})
                .finally(() => setFetching(false));
        }
    }, [visible, api]);

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable 
                className="flex-1 bg-black/90 justify-center items-center p-6"
                onPress={onCancel}
            >
                <Pressable 
                    className="w-full max-w-sm"
                    onPress={(e) => e.stopPropagation()}
                >
                    <View 
                        className="bg-slate-900 border border-white/10 rounded-3xl p-6 overflow-hidden relative shadow-2xl"
                        style={{ backgroundColor: '#0F172A' }}
                    >
                        <View className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
                        
                        <View className="flex-row items-center justify-center gap-3 mb-6">
                            <View className="w-10 h-10 rounded-xl bg-purple-500/20 items-center justify-center">
                                <Icon name="bank-outline" size={20} color="#A78BFA" />
                            </View>
                            <Text className="text-white font-black text-xl uppercase" style={{ fontFamily: 'Space Grotesk' }}>Asignar Cuenta</Text>
                        </View>

                        <Text className="text-slate-400 text-xs text-center mb-4">
                            Selecciona la cuenta destino para esta transferencia.
                        </Text>

                        <ScrollView style={{ maxHeight: 250 }} className="mb-6">
                            {fetching ? (
                                <Text className="text-slate-500 text-center py-4">Cargando...</Text>
                            ) : cuentas.length === 0 ? (
                                <Text className="text-slate-500 text-center py-4">No hay cuentas activas.</Text>
                            ) : (
                                <View className="gap-2">
                                    {cuentas.map(c => (
                                        <TouchableOpacity
                                            key={c.id}
                                            onPress={() => onConfirm(c.id, c.nombre)}
                                            disabled={loading}
                                            className="flex-row items-center gap-3 p-4 rounded-xl bg-black/30 border border-white/10 active:bg-purple-500/20 active:border-purple-500/50"
                                        >
                                            <Icon name="bank" size={16} color="#A78BFA" />
                                            <Text className="text-slate-300 font-bold text-sm">{c.nombre}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <Button
                            title="Cancelar"
                            onPress={onCancel}
                            variant="ghost"
                            size="md"
                            disabled={loading}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
