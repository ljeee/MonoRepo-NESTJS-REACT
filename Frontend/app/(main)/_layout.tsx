import { Stack } from 'expo-router';
import { SafeAreaView, View } from '@/src/tw';

export default function MobileAppLayout() {
  return (
    <SafeAreaView className="flex-1 bg-(--color-pos-bg)">
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </SafeAreaView>
  );
}
