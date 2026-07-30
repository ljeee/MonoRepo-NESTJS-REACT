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

import { colors, radius, shadow, text } from '../lib/theme';

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logo}>
          <MaterialCommunityIcons name="moped" size={38} color={colors.brand} />
        </View>

        <Text style={styles.title}>Dfiru Riders</Text>
        <Text style={styles.subtitle}>Entra para ver tus domicilios del día</Text>

        <View style={styles.form}>
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
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.faint}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              loading && { opacity: 0.6 },
              pressed && !loading && { opacity: 0.75 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <>
                <MaterialCommunityIcons name="login-variant" size={18} color={colors.onBrand} />
                <Text style={styles.buttonText}>INGRESAR</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 26 },
  logo: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: 'rgba(245,165,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 22,
  },
  title: { ...text.h1, color: colors.ink, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 30 },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 20,
    ...shadow.card,
  },
  label: { ...text.label, color: colors.muted, marginBottom: 7, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    height: 54,
    marginTop: 26,
    ...shadow.glow,
  },
  buttonText: { color: colors.onBrand, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});
