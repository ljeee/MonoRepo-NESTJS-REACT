import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card } from '../components/ui';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';

export default function LoginScreen() {
    const { login } = useAuth();
    const [usuario, setUsuario] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!usuario || !contrasena) {
            setError('Por favor completa todos los campos');
            return;
        }

        try {
            setLoading(true);
            setError('');
            await login(usuario, contrasena);
        } catch (err: any) {
            setError(
                err.response?.data?.message || 'Credenciales incorrectas o error de conexión'
            );
        } finally {
            setLoading(false);
        }
    };

    const isWeb = Platform.OS === 'web';

    const loginContent = (
        <View style={styles.inner}>
            <View style={styles.header}>
                <Text style={styles.title}>Dfiru POS</Text>
                <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
            </View>

            <Card padding="lg" style={styles.card}>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Usuario</Text>
                    <TextInput
                        style={styles.input}
                        value={usuario}
                        onChangeText={setUsuario}
                        placeholder="Ej. cajero"
                        autoCapitalize="none"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Contraseña</Text>
                    <TextInput
                        style={styles.input}
                        value={contrasena}
                        onChangeText={setContrasena}
                        placeholder="********"
                        secureTextEntry
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <Button
                    title="Ingresar"
                    onPress={handleLogin}
                    loading={loading}
                    fullWidth
                    variant="primary"
                    size="lg"
                />
            </Card>
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            {isWeb ? (
                loginContent
            ) : (
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    {loginContent}
                </TouchableWithoutFeedback>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 40,
        fontWeight: fontWeight.bold,
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
        backgroundColor: colors.bgLight,
    },
    errorText: {
        color: colors.danger,
        marginBottom: spacing.md,
        textAlign: 'center',
        fontSize: fontSize.sm,
    },
});
