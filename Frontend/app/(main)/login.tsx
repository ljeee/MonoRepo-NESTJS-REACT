import React, { useState, useEffect } from 'react';
import { Platform, Keyboard, TouchableWithoutFeedback, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, Input, Icon } from '../../components/ui';
import { View, Text } from '../../tw';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';

export default function LoginScreen() {
    const { login } = useAuth();
    const [usuario, setUsuario] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [recordar, setRecordar] = useState(false);

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
            } catch (e) {
                // Ignore parsing errors
            }
        };
        loadCreds();
    }, []);

    const handleLogin = async () => {
        if (!usuario || !contrasena) {
            setError('Por favor completa todos los campos');
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
        } catch (err: any) {
            setError(
                err.response?.data?.message || 'Credenciales incorrectas o error de conexión'
            );
            setLoading(false);
            return;
        }

        setLoading(false);
    };

    const isWeb = Platform.OS === 'web';

    const loginContent = (
        <View className="flex-1 justify-center items-center p-6 bg-(--color-pos-bg)">
            <Animated.View entering={FadeInUp.duration(600).delay(200)} className="items-center mb-10">
                <View className="w-16 h-16 rounded-2xl bg-(--color-pos-primary-light) items-center justify-center mb-4 border border-(--color-pos-primary)/20">
                    <Icon name="pizza" size={36} color="#F5A524" />
                </View>
                <Text className="text-4xl font-black text-white tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>
                    Dfiru <Text className="text-(--color-pos-primary)">POS</Text>
                </Text>
                <Text className="text-(--color-pos-text-secondary) mt-1 font-medium italic">
                    Sistema de Gestión de Alimentos
                </Text>
            </Animated.View>

            <Card className="w-full max-w-sm border border-white/5 bg-white/5 backdrop-blur-xl p-8 rounded-3xl">
                <Text className="text-xl font-bold text-white mb-1">Bienvenido</Text>
                <Text className="text-sm text-(--color-pos-text-secondary) mb-8">Ingresa tus credenciales para continuar</Text>

                <View className="gap-2">
                    <Input
                        label="USUARIO"
                        value={usuario}
                        onChangeText={setUsuario}
                        placeholder="Ej. cajero01"
                        autoCapitalize="none"
                        leftIcon={<Icon name="account-outline" size={20} color="#64748B" />}
                        error={error && !usuario ? "Requerido" : undefined}
                    />

                    <Input
                        label="CONTRASEÑA"
                        value={contrasena}
                        onChangeText={setContrasena}
                        placeholder="••••••••"
                        secureTextEntry
                        leftIcon={<Icon name="lock-outline" size={20} color="#64748B" />}
                        error={error && !contrasena ? "Requerido" : undefined}
                    />

                    <Pressable 
                        className={`flex-row items-center mt-3 mb-6 p-4 border rounded-2xl ${recordar ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5 active:bg-white/10'}`} 
                        onPress={() => setRecordar(!recordar)}
                    >
                        <View className={`w-6 h-6 rounded-lg items-center justify-center mr-3 ${recordar ? 'bg-orange-500' : 'border-2 border-slate-600 bg-black/40'}`}>
                            {recordar && <Icon name="check-bold" size={14} color="black" />}
                        </View>
                        <View className="flex-1">
                            <Text className={`font-black text-sm uppercase tracking-wider mb-0.5 ${recordar ? 'text-orange-500' : 'text-slate-300'}`}>Mantener sesión</Text>
                            <Text className="text-slate-500 text-[10px] font-bold">Recordar credenciales al volver</Text>
                        </View>
                    </Pressable>
                </View>

                {error && (
                    <View className="bg-red-500/10 p-3 rounded-xl mb-6 border border-red-500/20">
                        <Text className="text-red-400 text-xs text-center font-bold">{error}</Text>
                    </View>
                )}

                <Button
                    title="Iniciar Sesión"
                    onPress={handleLogin}
                    loading={loading}
                    fullWidth
                    variant="primary"
                    size="lg"
                    className="mt-4 shadow-lg shadow-amber-500/20"
                />


            </Card>
        </View>
    );

    if (isWeb) return loginContent;

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {loginContent}
        </TouchableWithoutFeedback>
    );
}
