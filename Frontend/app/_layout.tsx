import { Stack } from "expo-router";
import { View } from "react-native";
import Navbar from "../components/Navbar";
import { colors } from "../components/theme";
import { GlobalStyles } from "../components/GlobalStyles";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GlobalStyles />
      <Navbar />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
