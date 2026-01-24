import React from 'react';
import { View } from 'react-native';
import CreateOrderForm from '../components/orderForm/CreateOrderForm';
import { colors } from '../styles/theme';

export default function CrearOrdenScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <CreateOrderForm />
        </View>
    );
}
