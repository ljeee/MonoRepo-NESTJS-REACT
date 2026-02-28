import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { api, getBaseUrl } from '../services/api';
import axios from 'axios';

interface AuthContextData {
    token: string | null;
    user: any | null;
    login: (usuario: string, contrasena: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        loadStorageData();
    }, []);

    const loadStorageData = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('@Auth:token');
            const storedUser = await AsyncStorage.getItem('@Auth:user');
            // We can also retrieve the refresh token here but we only strictly need it in the interceptor

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                api.http.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === ('login' as any);

        if (!token && !inAuthGroup) {
            router.replace('/login' as any);
        } else if (token && inAuthGroup) {
            // Dashboard predeterminado
            router.replace('/ordenes' as any);
        }
    }, [token, segments, isLoading]);

    const login = async (usuario: string, contrasena: string) => {
        // Calling the endpoint directly as it's not in api.ts wrappers yet
        const response = await axios.post(`${getBaseUrl()}/auth/login`, {
            username: usuario,
            password: contrasena,
        });

        // The DTO from nestjs is accessToken and refreshToken
        const { accessToken, refreshToken, ...userData } = response.data;

        setToken(accessToken);
        setUser(userData);

        api.http.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        await AsyncStorage.setItem('@Auth:token', accessToken);
        await AsyncStorage.setItem('@Auth:refreshToken', refreshToken);
        await AsyncStorage.setItem('@Auth:user', JSON.stringify(userData));
    };

    const logout = async () => {
        setToken(null);
        setUser(null);
        delete api.http.defaults.headers.common['Authorization'];
        await AsyncStorage.removeItem('@Auth:token');
        await AsyncStorage.removeItem('@Auth:refreshToken');
        await AsyncStorage.removeItem('@Auth:user');
    };

    // Setup interceptor for 401s
    useEffect(() => {
        const interceptor = api.http.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    try {
                        const storedRefreshToken = await AsyncStorage.getItem('@Auth:refreshToken');
                        if (storedRefreshToken) {
                            const refreshResponse = await axios.post(`${getBaseUrl()}/auth/refresh`, {
                                refreshToken: storedRefreshToken
                            });

                            const { accessToken, refreshToken, ...userData } = refreshResponse.data;

                            setToken(accessToken);
                            setUser(userData);
                            api.http.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

                            await AsyncStorage.setItem('@Auth:token', accessToken);
                            await AsyncStorage.setItem('@Auth:refreshToken', refreshToken);
                            await AsyncStorage.setItem('@Auth:user', JSON.stringify(userData));

                            originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
                            return api.http(originalRequest);
                        }
                    } catch (refreshError) {
                        logout();
                        return Promise.reject(refreshError);
                    }
                    logout();
                }
                return Promise.reject(error);
            }
        );
        return () => api.http.interceptors.response.eject(interceptor);
    }, []);

    return (
        <AuthContext.Provider value={{ token, user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
