import { Stack } from 'expo-router';
import { View } from '../../tw';

export default function MobileAppLayout() {
  return (
    <View className="flex-1 bg-(--color-pos-bg)">
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
