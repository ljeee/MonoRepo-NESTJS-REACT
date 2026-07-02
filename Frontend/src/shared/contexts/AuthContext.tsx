import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from '../services/api';
import type { AuthUser } from '../types/models';

interface AuthContextData {
    token: string | null;
    user: AuthUser | null;
    login: (usuario: string, contrasena: string) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [authState, setAuthState] = useState<{ token: string | null; user: AuthUser | null; isLoading: boolean }>({
        token: null,
        user: null,
        isLoading: true,
    });
    const { token, user, isLoading } = authState;
    const isRefreshingRef = useRef(false);
    const failedQueueRef = useRef<{ resolve: (v: any) => void; reject: (e: any) => void; config: any }[]>([]);

    const applySession = useCallback((nextToken: string | null, nextUser: AuthUser | null, nextLoading: boolean) => {
        setAuthState({ token: nextToken, user: nextUser, isLoading: nextLoading });
    }, []);

    const loadStorageData = useCallback(() => {
        return Promise.all([
            AsyncStorage.getItem('@Auth:token'),
            AsyncStorage.getItem('@Auth:user'),
        ])
            .then(([storedToken, storedUser]) => {
                if (storedToken && storedUser) {
                    let parsedUser: AuthUser | null = null;
                    try {
                        parsedUser = JSON.parse(storedUser);
                    } catch (parseErr) {
                        console.warn('[Auth] Stored user is corrupt, clearing session', parseErr);
                        void AsyncStorage.multiRemove(['@Auth:token', '@Auth:refreshToken', '@Auth:user']);
                        applySession(null, null, false);
                        return;
                    }
                    applySession(storedToken, parsedUser, false);
                    setAuthToken(api.http, storedToken);
                    return;
                }

                applySession(null, null, false);
            })
            .catch((e) => {
                console.error('[AuthContext] loadStorageData error:', e);
                applySession(null, null, false);
            })
            ;
    }, [applySession]);

    useEffect(() => {
        void loadStorageData();

        // Safety fallback: if AsyncStorage takes longer than 3 seconds, force isLoading to false
        const safetyTimer = setTimeout(() => {
            setAuthState(prev => {
                if (prev.isLoading) {
                    console.warn('[AuthContext] Safety timeout: AsyncStorage took > 3s. Forcing isLoading to false.');
                    return { ...prev, isLoading: false };
                }
                return prev;
            });
        }, 3000);

        return () => clearTimeout(safetyTimer);
    }, [loadStorageData]);

    const login = async (usuario: string, contrasena: string) => {
        const response = await api.auth.login(usuario, contrasena);

        const { accessToken, refreshToken, ...userData } = response;

        applySession(accessToken, userData, false);

        setAuthToken(api.http, accessToken);

        await Promise.all([
            AsyncStorage.setItem('@Auth:token', accessToken),
            AsyncStorage.setItem('@Auth:refreshToken', refreshToken),
            AsyncStorage.setItem('@Auth:user', JSON.stringify(userData))
        ]);
    };

    const logout = useCallback(async () => {
        applySession(null, null, false);
        setAuthToken(api.http, null);
        await Promise.all([
            AsyncStorage.removeItem('@Auth:token'),
            AsyncStorage.removeItem('@Auth:refreshToken'),
            AsyncStorage.removeItem('@Auth:user')
        ]);
    }, [applySession]);

    // Setup interceptor for 401s
    useEffect(() => {
        const processQueue = (error: any, token: string | null) => {
            failedQueueRef.current.forEach(({ resolve, reject, config }) => {
                if (token) {
                    config.headers['Authorization'] = `Bearer ${token}`;
                    resolve(api.http(config));
                } else {
                    reject(error);
                }
            });
            failedQueueRef.current = [];
        };

        const interceptor = api.http.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                if (originalRequest?.url?.includes('/auth/refresh')) {
                    return Promise.reject(error);
                }

                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    if (isRefreshingRef.current) {
                        return new Promise((resolve, reject) => {
                            failedQueueRef.current.push({ resolve, reject, config: originalRequest });
                        });
                    }

                    isRefreshingRef.current = true;

                    return AsyncStorage.getItem('@Auth:refreshToken')
                        .then(async (storedRefreshToken) => {
                            if (!storedRefreshToken) {
                                throw new Error('No refresh token');
                            }

                            const refreshResponse = await api.auth.refresh(storedRefreshToken);
                            const { accessToken, refreshToken: newRefreshToken, ...userData } = refreshResponse;

                            applySession(accessToken, userData, false);
                            setAuthToken(api.http, accessToken);

                            await Promise.all([
                                AsyncStorage.setItem('@Auth:token', accessToken),
                                AsyncStorage.setItem('@Auth:refreshToken', newRefreshToken),
                                AsyncStorage.setItem('@Auth:user', JSON.stringify(userData)),
                            ]);

                            processQueue(null, accessToken);

                            originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
                            return api.http(originalRequest);
                        })
                        .catch((refreshError) => {
                            console.error('[Auth] Error refreshing token:', refreshError.response?.data?.message || refreshError.message);
                            processQueue(refreshError, null);
                            logout();
                            return Promise.reject(refreshError);
                        })
                        .finally(() => {
                            isRefreshingRef.current = false;
                        });
                }

                return Promise.reject(error);
            }
        );
        return () => api.http.interceptors.response.eject(interceptor);
    }, [applySession, logout]);

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
