import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import Navbar from '../components/Navbar';
import { colors } from '../styles/theme';
import { GlobalStyles } from '../components/GlobalStyles';
import { OrderProvider } from '../contexts/OrderContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ToastContainer } from '../components/ui';
import { useBreakpoint } from '../styles/responsive';

function AppShell() {
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, flexDirection: isCompact ? 'column' : 'row' }}>
      <GlobalStyles />
      <Navbar />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <ToastContainer />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ToastProvider>
      <OrderProvider>
        <AppShell />
      </OrderProvider>
    </ToastProvider>
  );
}
