import React, { useState, useEffect, useRef } from 'react';
import {
    Platform,
    Keyboard,
    TouchableWithoutFeedback,
    Pressable,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    ScrollView,
    Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../../components/ui';
import { View, Text } from '../../tw';
import { useRouter } from 'expo-router';
import {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withDelay,
    withSequence,
    withRepeat,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated';
import { Animated } from '../../tw/animated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Orb decorativo animado ──────────────────────────────────────────────────
function AnimatedOrb({ delay = 0, size = 200, color = '#F5A524', style }: any) {
    const opacity = useSharedValue(0.15);
    const scale = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.25, { duration: 3000 + delay * 500 }),
                withTiming(0.12, { duration: 3000 + delay * 500 }),
            ),
            -1,
            true,
        );
        scale.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 4000 + delay * 600, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.95, { duration: 4000 + delay * 600, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View
            style={[
                animStyle,
                {
                    position: 'absolute',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                },
                style,
            ]}
        />
    );
}

// ── Input animado ──────────────────────────────────────────────────────────
function AnimatedInput({
    label,
    icon,
    error,
    secureTextEntry,
    inputRef,
    ...rest
}: any) {
    const [focused, setFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const borderColor = useSharedValue(0);
    const labelY = useSharedValue(0);

    useEffect(() => {
        borderColor.value = withTiming(focused ? 1 : 0, { duration: 200 });
        labelY.value = withSpring(focused ? -2 : 0, { damping: 15 });
    }, [focused]);

    const containerAnim = useAnimatedStyle(() => ({
        borderColor: interpolateColor(
            borderColor.value,
            [0, 1],
            [error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)', error ? 'rgba(239,68,68,0.8)' : 'rgba(245,165,36,0.6)'],
        ),
        shadowColor: interpolateColor(
            borderColor.value,
            [0, 1],
            ['transparent', error ? '#ef4444' : '#F5A524'],
        ),
        shadowOpacity: interpolate(borderColor.value, [0, 1], [0, 0.3]),
        shadowRadius: interpolate(borderColor.value, [0, 1], [0, 8]),
    }));

    return (
        <View className="mb-4">
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                {label}
            </Text>
            <Animated.View
                style={[
                    containerAnim,
                    {
                        borderWidth: 1.5,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        overflow: 'hidden',
                    },
                ]}
            >
                <View className="pl-4 pr-2">
                    <Icon name={icon} size={20} color={focused ? '#F5A524' : '#64748B'} />
                </View>
                <TextInput
                    ref={inputRef}
                    style={[
                        {
                            flex: 1,
                            height: 52,
                            color: '#F8FAFC',
                            fontSize: 16,
                            fontFamily: 'Outfit',
                            paddingRight: secureTextEntry ? 0 : 16,
                        } as any,
                        Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {},
                    ]}
                    placeholderTextColor="#475569"
                    cursorColor="#F5A524"
                    selectionColor="rgba(245,165,36,0.3)"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    secureTextEntry={secureTextEntry && !showPassword}
                    {...rest}
                />
                {secureTextEntry && (
                    <Pressable onPress={() => setShowPassword(!showPassword)} className="pr-4 pl-2">
                        <Icon
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color="#64748B"
                        />
                    </Pressable>
                )}
            </Animated.View>
            {error && (
                <Text className="text-red-400 text-[10px] font-bold mt-1.5 ml-1">
                    {error}
                </Text>
            )}
        </View>
    );
}

// ── Pantalla principal ─────────────────────────────────────────────────────
export default function LoginScreen() {
    const { login } = useAuth();
    const router = useRouter();
    const [usuario, setUsuario] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recordar, setRecordar] = useState(false);
    const passRef = useRef<TextInput>(null);

    // Animaciones de entrada
    const logoOpacity = useSharedValue(0);
    const logoY = useSharedValue(-30);
    const cardOpacity = useSharedValue(0);
    const cardY = useSharedValue(40);
    const btnScale = useSharedValue(1);
    const shakeX = useSharedValue(0);

    useEffect(() => {
        logoOpacity.value = withDelay(100, withTiming(1, { duration: 700 }));
        logoY.value = withDelay(100, withSpring(0, { damping: 14, stiffness: 80 }));
        cardOpacity.value = withDelay(350, withTiming(1, { duration: 600 }));
        cardY.value = withDelay(350, withSpring(0, { damping: 16, stiffness: 90 }));
    }, []);

    useEffect(() => {
        const loadCreds = async () => {
            try {
                const stored = await AsyncStorage.getItem('@App:credenciales');
                if (stored) {
                    const { user, pass } = JSON.parse(stored);
                    setUsuario(user);
                    setContrasena(pass);
                    setRecordar(true);
                }
            } catch {}
        };
        loadCreds();
    }, []);

    const shake = () => {
        shakeX.value = withSequence(
            withTiming(-10, { duration: 60 }),
            withTiming(10, { duration: 60 }),
            withTiming(-8, { duration: 60 }),
            withTiming(8, { duration: 60 }),
            withTiming(-4, { duration: 60 }),
            withTiming(0, { duration: 60 }),
        );
    };

    const handleLogin = async () => {
        if (!usuario || !contrasena) {
            setError('Por favor completa todos los campos');
            shake();
            return;
        }
        try {
            setLoading(true);
            setError('');
            await login(usuario, contrasena);
            if (recordar) {
                await AsyncStorage.setItem('@App:credenciales', JSON.stringify({ user: usuario, pass: contrasena }));
            } else {
                await AsyncStorage.removeItem('@App:credenciales');
            }
            router.replace('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Credenciales incorrectas o error de conexión');
            shake();
        } finally {
            setLoading(false);
        }
    };

    // Estilos animados
    const logoStyle = useAnimatedStyle(() => ({
        opacity: logoOpacity.value,
        transform: [{ translateY: logoY.value }],
    }));
    const cardStyle = useAnimatedStyle(() => ({
        opacity: cardOpacity.value,
        transform: [{ translateY: cardY.value }, { translateX: shakeX.value }],
    }));
    const btnStyle = useAnimatedStyle(() => ({
        transform: [{ scale: btnScale.value }],
    }));

    const isWeb = Platform.OS === 'web';

    const content = (
        <View
            className="flex-1 bg-(--color-pos-bg)"
            style={{ position: 'relative', overflow: 'hidden' }}
        >
            {/* Orbs de fondo */}
            <AnimatedOrb
                size={320}
                color="#F5A524"
                delay={0}
                style={{ top: -80, left: -80 }}
            />
            <AnimatedOrb
                size={260}
                color="#8B5CF6"
                delay={1}
                style={{ bottom: -60, right: -60 }}
            />
            <AnimatedOrb
                size={180}
                color="#F5A524"
                delay={2}
                style={{ top: '40%', right: -30 }}
            />

            {/* Patrón de puntos sutil */}
            <View
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    opacity: 0.04,
                    backgroundImage: isWeb
                        ? 'radial-gradient(circle, #ffffff 1px, transparent 1px)'
                        : undefined,
                    backgroundSize: isWeb ? '28px 28px' : undefined,
                } as any}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{
                        flexGrow: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 24,
                        paddingVertical: 40,
                    }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Sección Logo ── */}
                    <Animated.View style={[logoStyle, { alignItems: 'center', marginBottom: 36 }]}>
                        {/* Icono con glow */}
                        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            {/* Glow de fondo */}
                            <View
                                style={{
                                    position: 'absolute',
                                    width: 90,
                                    height: 90,
                                    borderRadius: 45,
                                    backgroundColor: 'rgba(245,165,36,0.2)',
                                    transform: [{ scale: 1.3 }],
                                }}
                            />
                            <View
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 22,
                                    backgroundColor: 'rgba(245,165,36,0.15)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(245,165,36,0.35)',
                                }}
                            >
                                <Icon name="pizza" size={38} color="#F5A524" />
                            </View>
                        </View>

                        <Text
                            style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 36, color: '#F8FAFC', letterSpacing: -1 }}
                        >
                            Dfiru{' '}
                            <Text style={{ color: '#F5A524' }}>POS</Text>
                        </Text>
                        <Text
                            style={{
                                fontFamily: 'Outfit',
                                fontSize: 13,
                                color: '#64748B',
                                marginTop: 4,
                                fontStyle: 'italic',
                                letterSpacing: 0.5,
                            }}
                        >
                            Sistema de Gestión de Alimentos
                        </Text>
                    </Animated.View>

                    {/* ── Card ── */}
                    <Animated.View
                        style={[
                            cardStyle,
                            {
                                width: '100%',
                                maxWidth: 400,
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                borderRadius: 24,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                                padding: 28,
                                // Shadow
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 20 },
                                shadowOpacity: 0.4,
                                shadowRadius: 30,
                                elevation: 20,
                            },
                        ]}
                    >
                        {/* Encabezado card */}
                        <Text
                            style={{
                                fontFamily: 'SpaceGrotesk-Bold',
                                fontSize: 22,
                                color: '#F8FAFC',
                                marginBottom: 4,
                            }}
                        >
                            Bienvenido 👋
                        </Text>
                        <Text
                            style={{
                                fontFamily: 'Outfit',
                                fontSize: 14,
                                color: '#64748B',
                                marginBottom: 24,
                            }}
                        >
                            Ingresa tus credenciales para continuar
                        </Text>

                        {/* Inputs */}
                        <AnimatedInput
                            label="USUARIO"
                            icon="account-outline"
                            value={usuario}
                            onChangeText={setUsuario}
                            placeholder="Ej. cajero01"
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="next"
                            onSubmitEditing={() => passRef.current?.focus()}
                            error={error && !usuario ? 'Requerido' : undefined}
                        />

                        <AnimatedInput
                            inputRef={passRef}
                            label="CONTRASEÑA"
                            icon="lock-outline"
                            secureTextEntry
                            value={contrasena}
                            onChangeText={setContrasena}
                            placeholder="••••••••"
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                            error={error && !contrasena ? 'Requerido' : undefined}
                        />

                        {/* Mantener sesión */}
                        <Pressable
                            onPress={() => setRecordar(!recordar)}
                            style={({ pressed }) => ({
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 14,
                                borderRadius: 14,
                                borderWidth: 1,
                                marginBottom: 20,
                                marginTop: 4,
                                backgroundColor: recordar
                                    ? 'rgba(245,165,36,0.08)'
                                    : pressed
                                    ? 'rgba(255,255,255,0.04)'
                                    : 'transparent',
                                borderColor: recordar
                                    ? 'rgba(245,165,36,0.25)'
                                    : 'rgba(255,255,255,0.06)',
                            })}
                        >
                            {/* Checkbox */}
                            <View
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 7,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                    backgroundColor: recordar ? '#F5A524' : 'transparent',
                                    borderWidth: recordar ? 0 : 1.5,
                                    borderColor: '#475569',
                                }}
                            >
                                {recordar && <Icon name="check-bold" size={13} color="#000" />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontFamily: 'SpaceGrotesk-Bold',
                                        fontSize: 13,
                                        color: recordar ? '#F5A524' : '#94A3B8',
                                        marginBottom: 2,
                                    }}
                                >
                                    Mantener sesión
                                </Text>
                                <Text
                                    style={{
                                        fontFamily: 'Outfit',
                                        fontSize: 11,
                                        color: '#475569',
                                    }}
                                >
                                    Recordar credenciales al volver
                                </Text>
                            </View>
                        </Pressable>

                        {/* Error global */}
                        {error && (
                            <View
                                style={{
                                    backgroundColor: 'rgba(239,68,68,0.1)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(239,68,68,0.25)',
                                    borderRadius: 12,
                                    padding: 12,
                                    marginBottom: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <Icon name="alert-circle-outline" size={16} color="#f87171" />
                                <Text
                                    style={{
                                        fontFamily: 'Outfit',
                                        fontSize: 13,
                                        color: '#f87171',
                                        flex: 1,
                                    }}
                                >
                                    {error}
                                </Text>
                            </View>
                        )}

                        {/* Botón login */}
                        <Pressable
                            onPress={loading ? undefined : handleLogin}
                            onPressIn={() => {
                                btnScale.value = withSpring(0.97, { damping: 12, stiffness: 200 });
                            }}
                            onPressOut={() => {
                                btnScale.value = withSpring(1, { damping: 12, stiffness: 200 });
                            }}
                            disabled={loading}
                        >
                            <Animated.View
                                style={[
                                    btnStyle,
                                    {
                                        height: 54,
                                        borderRadius: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'row',
                                        gap: 10,
                                        backgroundColor: loading ? '#92400e' : '#F5A524',
                                        shadowColor: '#F5A524',
                                        shadowOffset: { width: 0, height: 8 },
                                        shadowOpacity: loading ? 0.1 : 0.35,
                                        shadowRadius: 16,
                                        elevation: 8,
                                        opacity: loading ? 0.8 : 1,
                                    },
                                ]}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <>
                                        <Icon name="login" size={20} color="#000" />
                                        <Text
                                            style={{
                                                fontFamily: 'SpaceGrotesk-Bold',
                                                fontSize: 16,
                                                color: '#000',
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            Iniciar Sesión
                                        </Text>
                                    </>
                                )}
                            </Animated.View>
                        </Pressable>
                    </Animated.View>

                    {/* Footer */}
                    <Animated.View style={[logoStyle, { marginTop: 24, alignItems: 'center' }]}>
                        <Text style={{ fontFamily: 'Outfit', fontSize: 12, color: '#334155' }}>
                            © 2025 Dfiru POS · Todos los derechos reservados
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );

    if (isWeb) return content;

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {content}
        </TouchableWithoutFeedback>
    );
}
