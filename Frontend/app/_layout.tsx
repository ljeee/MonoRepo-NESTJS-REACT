import { Stack } from "expo-router";
import { View } from "react-native";
import Navbar from "../components/Navbar";
import { colors } from "../components/theme";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Navbar />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
