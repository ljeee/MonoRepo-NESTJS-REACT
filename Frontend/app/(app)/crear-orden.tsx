import React from 'react';
import { View } from '../../tw';
import CreateOrderForm from '../../components/orderForm/CreateOrderForm';

export default function CrearOrdenScreen() {
    return (
        <View className="flex-1 bg-(--color-pos-bg)">
            <CreateOrderForm />
        </View>
    );
}
