import React from 'react';
import { View } from 'react-native';
import OrdersOfDayPending from '../components/orders/OrdersOfDayPending';
import { ordenesStyles as styles } from '../styles/ordenes.styles';

export default function OrdenesDiaPendientesScreen() {
  return (
    <View style={styles.container}>
      <OrdersOfDayPending />
    </View>
  );
}

// styles imported from styles/ordenes.styles
