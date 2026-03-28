import React, { useState, useEffect, useRef } from 'react';
import { Platform, Pressable, TextInput, ActivityIndicator } from 'react-native';
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

// ── Orb decorativo ─────────────────────────────────────────────────────────
function Orb({ size = 300, color = '#F5A524', style }: any) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.18);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.92, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
            true,
        );
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.28, { duration: 4000 }),
                withTiming(0.12, { duration: 4000 }),
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
                    filter: [{ blur: 60 }],
                },
                style,
            ]}
        />
    );
}

// ── Feature item lado izquierdo ────────────────────────────────────────────
function FeatureItem({ icon, title, desc, delay }: any) {
    const opacity = useSharedValue(0);
    const x = useSharedValue(-20);

    useEffect(() => {
        opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
        x.value = withDelay(delay, withSpring(0, { damping: 14 }));
    }, []);

    const anim = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateX: x.value }],
    }));

    return (
        <Animated.View style={[anim, { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 }]}>
            <View
                style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: 'rgba(245,165,36,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(245,165,36,0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                    flexShrink: 0,
                }}
            >
                <Icon name={icon} size={22} color="#F5A524" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 15, color: '#F8FAFC', marginBottom: 3 }}>
                    {title}
                </Text>
                <Text style={{ fontFamily: 'Outfit', fontSize: 13, color: '#64748B', lineHeight: 18 }}>
                    {desc}
                </Text>
            </View>
        </Animated.View>
    );
}

// ── Input con animaciones ──────────────────────────────────────────────────
function LoginInput({ label, icon, error, secureTextEntry, inputRef, ...rest }: any) {
    const [focused, setFocused] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const borderAnim = useSharedValue(0);

    useEffect(() => {
        borderAnim.value = withTiming(focused ? 1 : 0, { duration: 200 });
    }, [focused]);

    const containerAnim = useAnimatedStyle(() => ({
        borderColor: interpolateColor(
            borderAnim.value,
            [0, 1],
            [error ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)', error ? 'rgba(239,68,68,0.7)' : 'rgba(245,165,36,0.55)'],
        ),
        shadowColor: error ? '#ef4444' : '#F5A524',
        shadowOpacity: interpolate(borderAnim.value, [0, 1], [0, 0.25]),
        shadowRadius: interpolate(borderAnim.value, [0, 1], [0, 12]),
    }));

    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 }}>
                {label}
            </Text>
            <Animated.View
                style={[
                    containerAnim,
                    {
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                    },
                ]}
            >
                <View style={{ paddingLeft: 16, paddingRight: 10 }}>
                    <Icon name={icon} size={18} color={focused ? '#F5A524' : '#475569'} />
                </View>
                <TextInput
                    ref={inputRef}
                    style={[
                        {
                            flex: 1,
                            height: 50,
                            color: '#F8FAFC',
                            fontSize: 15,
                            fontFamily: 'Outfit',
                        } as any,
                        { outlineStyle: 'none' } as any,
                    ]}
                    placeholderTextColor="#334155"
                    cursorColor="#F5A524"
                    selectionColor="rgba(245,165,36,0.25)"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    secureTextEntry={secureTextEntry && !showPass}
                    {...rest}
                />
                {secureTextEntry && (
                    <Pressable
                        onPress={() => setShowPass(!showPass)}
                        style={{ paddingRight: 14, paddingLeft: 8 }}
                    >
                        <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#475569" />
                    </Pressable>
                )}
            </Animated.View>
            {error && (
                <Text style={{ fontFamily: 'Outfit', fontSize: 11, color: '#f87171', marginTop: 6, marginLeft: 2 }}>
                    {error}
                </Text>
            )}
        </View>
    );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function LoginScreenWeb() {
    const { login } = useAuth();
    const router = useRouter();
    const [usuario, setUsuario] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recordar, setRecordar] = useState(false);
    const passRef = useRef<TextInput>(null);

    // Animaciones
    const leftPanelX = useSharedValue(-60);
    const leftOpacity = useSharedValue(0);
    const rightY = useSharedValue(40);
    const rightOpacity = useSharedValue(0);
    const btnScale = useSharedValue(1);
    const shakeX = useSharedValue(0);

    useEffect(() => {
        leftPanelX.value = withSpring(0, { damping: 16, stiffness: 70 });
        leftOpacity.value = withTiming(1, { duration: 800 });
        rightY.value = withDelay(200, withSpring(0, { damping: 16, stiffness: 80 }));
        rightOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
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
            withTiming(-12, { duration: 55 }),
            withTiming(12, { duration: 55 }),
            withTiming(-8, { duration: 55 }),
            withTiming(8, { duration: 55 }),
            withTiming(-3, { duration: 55 }),
            withTiming(0, { duration: 55 }),
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

    const leftStyle = useAnimatedStyle(() => ({
        opacity: leftOpacity.value,
        transform: [{ translateX: leftPanelX.value }],
    }));
    const rightStyle = useAnimatedStyle(() => ({
        opacity: rightOpacity.value,
        transform: [{ translateY: rightY.value }, { translateX: shakeX.value }],
    }));
    const btnAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: btnScale.value }],
    }));

    return (
        <View style={{ flex: 1, backgroundColor: '#0C0F1A', flexDirection: 'row', overflow: 'hidden' }}>

            {/* ── Panel Izquierdo — Branding ── */}
            <Animated.View
                style={[
                    leftStyle,
                    {
                        flex: 1,
                        position: 'relative',
                        overflow: 'hidden',
                        backgroundColor: '#080A12',
                        borderRightWidth: 1,
                        borderRightColor: 'rgba(255,255,255,0.06)',
                        justifyContent: 'center',
                        padding: 56,
                    },
                ]}
            >
                {/* Orbs decorativos */}
                <Orb size={500} color="#F5A524" style={{ top: -150, left: -150 }} />
                <Orb size={400} color="#7C3AED" style={{ bottom: -120, right: -100 }} />

                {/* Grid pattern */}
                <View
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        opacity: 0.03,
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    } as any}
                />

                {/* Luz central decorativa */}
                <View
                    style={{
                        position: 'absolute',
                        top: '30%',
                        left: '50%',
                        width: 1,
                        height: '40%',
                        backgroundColor: 'rgba(245,165,36,0.06)',
                        transform: [{ rotate: '15deg' }],
                    }}
                />

                {/* Logo + título */}
                <View style={{ marginBottom: 48, position: 'relative', zIndex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <View
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 20,
                                backgroundColor: 'rgba(245,165,36,0.12)',
                                borderWidth: 1,
                                borderColor: 'rgba(245,165,36,0.3)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 16,
                            }}
                        >
                            <Icon name="pizza" size={34} color="#F5A524" />
                        </View>
                        <View>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 32, color: '#F8FAFC', letterSpacing: -0.5 }}>
                                Dfiru <Text style={{ color: '#F5A524' }}>POS</Text>
                            </Text>
                            <Text style={{ fontFamily: 'Outfit', fontSize: 13, color: '#475569', marginTop: 2 }}>
                                Sistema de Gestión de Alimentos
                            </Text>
                        </View>
                    </View>

                    <Text
                        style={{
                            fontFamily: 'SpaceGrotesk-Bold',
                            fontSize: 26,
                            color: '#F8FAFC',
                            lineHeight: 34,
                            marginBottom: 12,
                        }}
                    >
                        Gestiona tu restaurante{'\n'}con{' '}
                        <Text style={{ color: '#F5A524' }}>total control</Text>
                    </Text>
                    <Text style={{ fontFamily: 'Outfit', fontSize: 15, color: '#475569', lineHeight: 22 }}>
                        Toma órdenes, controla inventario y analiza tus ventas en tiempo real desde cualquier dispositivo.
                    </Text>
                </View>

                {/* Features */}
                <View style={{ position: 'relative', zIndex: 1 }}>
                    <FeatureItem
                        icon="receipt"
                        title="Órdenes en tiempo real"
                        desc="Gestiona mesas, domicilios y puntos de venta simultáneamente"
                        delay={400}
                    />
                    <FeatureItem
                        icon="chart-line"
                        title="Estadísticas avanzadas"
                        desc="Reportes de ventas, productos más vendidos y análisis por fecha"
                        delay={550}
                    />
                    <FeatureItem
                        icon="wifi-off"
                        title="Modo sin conexión"
                        desc="Sigue operando aunque no haya internet, sincroniza al reconectar"
                        delay={700}
                    />
                </View>

                {/* Footer */}
                <Text style={{ fontFamily: 'Outfit', fontSize: 12, color: '#1e293b', marginTop: 40, position: 'relative', zIndex: 1 }}>
                    © 2025 Dfiru POS · Todos los derechos reservados
                </Text>
            </Animated.View>

            {/* ── Panel Derecho — Formulario ── */}
            <Animated.View
                style={[
                    rightStyle,
                    {
                        width: 480,
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 48,
                        backgroundColor: '#0C0F1A',
                        position: 'relative',
                    },
                ]}
            >
                {/* Orb sutil derecha */}
                <Orb size={300} color="#F5A524" style={{ top: -80, right: -80, opacity: 0.08 }} />

                {/* Card formulario */}
                <View
                    style={{
                        width: '100%',
                        maxWidth: 380,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.07)',
                        padding: 36,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 24 },
                        shadowOpacity: 0.35,
                        shadowRadius: 40,
                    }}
                >
                    {/* Encabezado */}
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 26, color: '#F8FAFC', marginBottom: 6 }}>
                            Iniciar sesión
                        </Text>
                        <Text style={{ fontFamily: 'Outfit', fontSize: 14, color: '#475569' }}>
                            Accede a tu panel de gestión
                        </Text>
                    </View>

                    {/* Inputs */}
                    <LoginInput
                        label="Usuario"
                        icon="account-outline"
                        value={usuario}
                        onChangeText={setUsuario}
                        placeholder="Ej. cajero01"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={() => passRef.current?.focus()}
                        error={error && !usuario ? 'Campo requerido' : undefined}
                    />
                    <LoginInput
                        inputRef={passRef}
                        label="Contraseña"
                        icon="lock-outline"
                        secureTextEntry
                        value={contrasena}
                        onChangeText={setContrasena}
                        placeholder="••••••••"
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                        error={error && !contrasena ? 'Campo requerido' : undefined}
                    />

                    {/* Mantener sesión */}
                    <Pressable
                        onPress={() => setRecordar(!recordar)}
                        style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            marginTop: 4,
                            marginBottom: 20,
                            backgroundColor: recordar
                                ? 'rgba(245,165,36,0.07)'
                                : pressed
                                ? 'rgba(255,255,255,0.03)'
                                : 'transparent',
                            borderColor: recordar ? 'rgba(245,165,36,0.22)' : 'rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                        } as any)}
                    >
                        <View
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: 6,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                                backgroundColor: recordar ? '#F5A524' : 'transparent',
                                borderWidth: recordar ? 0 : 1.5,
                                borderColor: '#334155',
                            }}
                        >
                            {recordar && <Icon name="check-bold" size={12} color="#000" />}
                        </View>
                        <View>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, color: recordar ? '#F5A524' : '#94A3B8' }}>
                                Mantener sesión activa
                            </Text>
                            <Text style={{ fontFamily: 'Outfit', fontSize: 11, color: '#334155', marginTop: 1 }}>
                                Recordar credenciales al volver
                            </Text>
                        </View>
                    </Pressable>

                    {/* Error */}
                    {error && (
                        <View
                            style={{
                                backgroundColor: 'rgba(239,68,68,0.08)',
                                borderWidth: 1,
                                borderColor: 'rgba(239,68,68,0.22)',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <Icon name="alert-circle-outline" size={16} color="#f87171" />
                            <Text style={{ fontFamily: 'Outfit', fontSize: 13, color: '#f87171', flex: 1 }}>
                                {error}
                            </Text>
                        </View>
                    )}

                    {/* Botón */}
                    <Pressable
                        onPress={loading ? undefined : handleLogin}
                        onPressIn={() => { btnScale.value = withSpring(0.97, { damping: 12, stiffness: 200 }); }}
                        onPressOut={() => { btnScale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
                        disabled={loading}
                        style={{ cursor: 'pointer' } as any}
                    >
                        <Animated.View
                            style={[
                                btnAnimStyle,
                                {
                                    height: 52,
                                    borderRadius: 14,
                                    backgroundColor: loading ? 'rgba(245,165,36,0.6)' : '#F5A524',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'row',
                                    gap: 10,
                                    shadowColor: '#F5A524',
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: loading ? 0.1 : 0.3,
                                    shadowRadius: 20,
                                },
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <>
                                    <Icon name="login" size={18} color="#000" />
                                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 15, color: '#000', letterSpacing: 0.3 }}>
                                        Iniciar Sesión
                                    </Text>
                                </>
                            )}
                        </Animated.View>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
}
