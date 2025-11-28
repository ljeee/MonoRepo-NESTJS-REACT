// index screen
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import CreateOrderForm from "../components/orderForm/CreateOrderForm";
import { colors } from "../components/theme";
import { indexStyles as styles } from "../styles/index.styles";


export default function Index() {
  const [showForm, setShowForm] = useState(false);
  return (
    <View style={styles.container}>
      {!showForm ? (
        <TouchableOpacity
          style={{
            backgroundColor: colors.success,
            paddingVertical: 18,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 48,
            marginBottom: 12,
            width: 260,
            alignSelf: 'center',
            elevation: 2,
          }}
          onPress={() => setShowForm(true)}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20, letterSpacing: 1 }}>Crear nueva orden</Text>
        </TouchableOpacity>
      ) : (
        <CreateOrderForm />
      )}
      {/* Removed buttons for invoices as they are now in Navbar */}
    </View>
  );
}
