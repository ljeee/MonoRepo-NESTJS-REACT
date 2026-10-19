import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/src/shared';

import { colors, radius, text } from '../lib/theme';

// Credenciales recordadas en Keychain/Keystore (no AsyncStorage) para no dejar
// la contraseña en texto plano. Persisten entre sesiones; solo las sobreescribe
// un login exitoso distinto.
const CRED_USERNAME_KEY = 'dfiru_rider_username';
const CRED_PASSWORD_KEY = 'dfiru_rider_password';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [u, p] = await Promise.all([
          SecureStore.getItemAsync(CRED_USERNAME_KEY),
          SecureStore.getItemAsync(CRED_PASSWORD_KEY),
        ]);
        if (u) setUsername(u);
        if (p) setPassword(p);
      } catch {
        // Sin acceso al almacenamiento seguro: solo tendrá que escribirlas.
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Toast.show({ type: 'error', text1: 'Faltan datos', text2: 'Ingresa usuario y contraseña' });
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      SecureStore.setItemAsync(CRED_USERNAME_KEY, username.trim()).catch(() => {});
      SecureStore.setItemAsync(CRED_PASSWORD_KEY, password).catch(() => {});
      // No se apaga `loading`: al autenticarse esta pantalla se desmonta.
    } catch {
      Toast.show({ type: 'error', text1: 'No se pudo entrar', text2: 'Usuario o contraseña incorrectos' });
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Columna centrada con ancho máximo: en tablet el formulario no se estira. */}
        <View style={styles.column}>
          <MaterialCommunityIcons name="moped" size={40} color={colors.brand} style={styles.logo} />
          <Text style={styles.title}>Dfiru Riders</Text>
          <Text style={styles.subtitle}>Entra para ver tus domicilios del día</Text>

          <Text style={styles.label}>Usuario</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="account-outline" size={18} color={colors.faint} />
            <TextInput
              style={styles.input}
              placeholder="Tu teléfono"
              placeholderTextColor={colors.ghost}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              returnKeyType="next"
              accessibilityLabel="Usuario"
            />
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Contraseña</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={colors.faint} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.ghost}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Contraseña"
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={12}
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.faint} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, loading && { opacity: 0.6 }, pressed && !loading && { opacity: 0.75 }]}
          >
            {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.buttonText}>Ingresar</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  column: { width: '100%', maxWidth: 400 },
  logo: { alignSelf: 'center', marginBottom: 14 },
  title: { ...text.h1, color: colors.ink, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 32 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 7, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '500' },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    height: 52,
    marginTop: 28,
  },
  buttonText: { color: colors.onBrand, fontWeight: '800', fontSize: 15 },
});
