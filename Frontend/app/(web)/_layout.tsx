import React from 'react';
import { Stack } from 'expo-router';
import { View } from '../../tw';
import Navbar from '../../components/Navbar'; // We will refactor this to pure Tailwind next

export default function WebLayout() {
  return (
    <View className="flex-1 flex-row bg-(--color-pos-bg)">
      {/* Desktop Sidebar Navbar */}
      <Navbar />
      
      {/* Main Content Area */}
      <View className="flex-1 relative">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
