import React from 'react';
import { StyleSheet, View } from 'react-native';
import CreateOrderForm from '../components/orderForm/CreateOrderForm';
import { colors } from '../styles/theme';

export default function CrearOrdenScreen() {
    return (
        <View style={crearStyles.root}>
            <CreateOrderForm />
        </View>
    );
}

const crearStyles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
});
