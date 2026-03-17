import { Stack } from 'expo-router';
import { Platform, StatusBar } from 'react-native';
import { View } from '../../tw';

export default function MobileAppLayout() {
  const paddingTop = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

  return (
    <View className="flex-1 bg-(--color-pos-bg)">
      <View className="flex-1" style={{ paddingTop }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      {/* Mobile Bottom Navigation could go here later if requested,
          for now keeping the full screen stack since Navbar handled mobile drawer.
          We will migrate Navbar functionality into this or a dedicated component. */}
    </View>
  );
}
