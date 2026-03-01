import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Navbar from '../components/Navbar';
import { colors } from '../styles/theme';
import { GlobalStyles } from '../components/GlobalStyles';
import { OrderProvider } from '../contexts/OrderContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ToastContainer } from '../components/ui';
import { useBreakpoint } from '../styles/responsive';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function AppShell() {
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;
  const { isLoading, token } = useAuth();

  if (isLoading) return null; // or a splash screen

  // if not logged in, just show stack so we can see login page
  if (!token) {
    return (
      <View style={layoutStyles.root}>
        <GlobalStyles />
        <Stack screenOptions={{ headerShown: false }} />
        <ToastContainer />
      </View>
    );
  }

  return (
    <View style={[layoutStyles.root, isCompact ? layoutStyles.shellColumn : layoutStyles.shellRow]}>
      <GlobalStyles />
      <Navbar />
      <View style={layoutStyles.content}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <ToastContainer />
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  shellRow: { flexDirection: 'row' },
  shellColumn: { flexDirection: 'column' },
  content: { flex: 1 },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <OrderProvider>
          <AppShell />
        </OrderProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
