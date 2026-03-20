import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { View } from '../../tw';

export default function WebLayout() {
  const [ready, setReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => setReady(true), 50);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!ready) return null;

  return (
    <View className="flex-1 bg-(--color-pos-bg)">
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
