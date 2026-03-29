import { Stack, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StatusBar, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
if (Platform.OS === 'web') {
  require('../src/global.web.css');
} else {
  require('../src/global.css');
}
import { View, Text } from '../tw';
import Navbar from '../components/Navbar';
import { GlobalStyles } from '../components/GlobalStyles';
import Icon from '../components/ui/Icon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrderProvider, ToastProvider, ApiProvider, OfflineQueueProvider, useOfflineQueue, useToast } from '@monorepo/shared';
import type { OrderStorageAdapter, OfflinePayment } from '@monorepo/shared';
import { ToastContainer } from '../components/ui';
import { useBreakpoint } from '../styles/responsive';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { useFonts, Outfit_400Regular, Outfit_700Bold, Outfit_900Black } from '@expo-google-fonts/outfit';
import { SpaceGrotesk_400Regular, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';

const asyncStorageAdapter: OrderStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};

function AppShell() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const isCompact = !isDesktop;
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const { isLoading, token } = useAuth();
  const { queue } = useOfflineQueue();
  const { showToast } = useToast();

  const pathname = usePathname();
  // Close mobile menu on ANY navigation (including query-param changes from content taps)
  const pathnameRef = React.useRef(pathname);
  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname;
    }
    setShowMobileMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!token) return;

    const checkStalePayments = () => {
      const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
      const staleItems = queue.filter(p => p.timestamp < fifteenMinutesAgo);

      if (staleItems.length > 0) {
        showToast(
          `Hay ${staleItems.length} pagos sin sincronizar hace más de 15 minutos.`,
          'warning'
        );
      }
    };

    const interval = setInterval(checkStalePayments, 5 * 60 * 1000);
    checkStalePayments();

    return () => clearInterval(interval);
  }, [queue, token, showToast]);

  const [fontsLoaded] = useFonts({
    'Outfit': Outfit_400Regular,
    'Outfit-Bold': Outfit_700Bold,
    'Outfit-Black': Outfit_900Black,
    'Space Grotesk': SpaceGrotesk_400Regular,
    'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
  });

  if (isLoading || !fontsLoaded) return null;

  const isLoginScreen = pathname === '/login' || pathname?.includes('login');
  const showAppShell = !!token && !isLoginScreen;

  return (
    <View className={`flex-1 bg-(--color-pos-bg) ${isCompact && showAppShell ? 'flex-col' : 'flex-row'}`}>
      <GlobalStyles />

      {showAppShell && isCompact && (
        <>
          <View
            style={{ paddingTop: insets.top + 16 }}
            className="px-6 pb-4 flex-row items-center justify-between border-b border-white/5 bg-(--color-pos-surface) z-50 min-h-[80px] shadow-sm shadow-black/30"
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-2xl bg-orange-500/20 items-center justify-center border border-orange-500/30">
                <Icon name="pizza" size={26} color="#F5A524" />
              </View>
            </View>
            <Pressable onPress={() => setShowMobileMenu(!showMobileMenu)} className="p-3 bg-white/5 active:bg-white/10 rounded-xl transition-colors">
              <Icon name={showMobileMenu ? "close" : "menu"} size={28} color="#94A3B8" />
            </Pressable>
          </View>

          {showMobileMenu && (
            <View className="absolute top-0 left-0 right-0 bottom-0 z-[100] flex-row">
              <Pressable
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onPress={() => setShowMobileMenu(false)}
              />
              <View className="w-72 h-full bg-(--color-pos-surface) shadow-2xl border-r border-white/5">
                <Navbar onClose={() => setShowMobileMenu(false)} />
              </View>
            </View>
          )}
        </>
      )}

      {showAppShell && !isCompact && <Navbar />}

      <View className="flex-1 h-full overflow-hidden">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <ToastContainer />
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => setReady(true), 50);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0C0F1A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#F5A524" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ApiProvider api={api}>
          <AuthProvider>
            <ToastProvider>
              <OfflineQueueProvider
                storage={asyncStorageAdapter}
                onSyncPayment={async (p: OfflinePayment) => {
                  await api.ordenes.completar(p.ordenId, p.metodo, p.idempotencyKey);
                }}
              >
                <OrderProvider storage={asyncStorageAdapter}>
                  <AppShell />
                </OrderProvider>
              </OfflineQueueProvider>
            </ToastProvider>
          </AuthProvider>
        </ApiProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
