import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { View, Text } from '../../tw';
import { Button, Icon, PageContainer } from '../../components/ui';
import CreateOrderForm from '../../components/orderForm/CreateOrderForm';
import { api } from '../../services/api';
import { mapOrdenToForm } from '@monorepo/shared';
import type { OrderFormState } from '@monorepo/shared';

export default function EditarOrdenScreen() {
    const { ordenId } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [initialData, setInitialData] = useState<Partial<OrderFormState> | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ordenId) {
            setError('No se proporcionó ID de orden');
            setLoading(false);
            return;
        }

        const fetchOrden = async () => {
            try {
                const orden = await api.ordenes.getById(Number(ordenId));
                setInitialData(mapOrdenToForm(orden));
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError('Error al cargar la orden para editar');
                setLoading(false);
            }
        };

        void fetchOrden();
    }, [ordenId]);

    if (loading) {
        return (
            <View className="flex-1 bg-(--color-pos-bg) justify-center items-center">
                <ActivityIndicator size="large" color="#F5A524" />
                <Text className="text-white mt-4 font-bold">Cargando datos del pedido...</Text>
            </View>
        );
    }

    if (error || !initialData) {
        return (
            <PageContainer className="justify-center items-center">
                <View className="items-center p-10 bg-(--color-pos-surface) rounded-3xl border border-red-500/10">
                    <Icon name="alert-circle-outline" size={64} color="#F43F5E" />
                    <Text className="text-white text-xl font-black mt-6 mb-8 uppercase tracking-tight">{error || 'Error desconocido'}</Text>
                    <Button title="Volver" icon="arrow-left" variant="ghost" onPress={() => router.back()} />
                </View>
            </PageContainer>
        );
    }

    return (
        <View className="flex-1 bg-(--color-pos-bg)">
            <CreateOrderForm 
                mode="edit" 
                initialItem={initialData} 
                ordenId={Number(ordenId)} 
            />
        </View>
    );
}
