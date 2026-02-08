import { Stack } from "expo-router";
import { View } from "react-native";
import Navbar from "../components/Navbar";
import { colors } from "../styles/theme";
import { GlobalStyles } from "../components/GlobalStyles";
import { OrderProvider } from "../contexts/OrderContext";

export default function RootLayout() {
  return (
    <OrderProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <GlobalStyles />
        <Navbar />
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </OrderProvider>
  );
}
