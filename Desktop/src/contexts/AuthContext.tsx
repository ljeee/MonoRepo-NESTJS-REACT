import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        loadStorageData();
    }, []);

    const loadStorageData = async () => {
        try {
            const storedToken = localStorage.getItem('@Auth:token');
            const storedUser = localStorage.getItem('@Auth:user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                setAuthToken(storedToken);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = location.pathname.startsWith('/login');

        if (!token && !inAuthGroup) {
            navigate('/login', { replace: true });
        } else if (token && inAuthGroup) {
            // Dashboard predeterminado
            navigate('/ordenes', { replace: true });
        }
    }, [token, location.pathname, isLoading]);

    const login = async (usuario: string, contrasena: string) => {
        const response = await api.auth.login(usuario, contrasena);

        // The DTO from nestjs is accessToken and refreshToken
        const { accessToken, refreshToken, ...userData } = response;

        setToken(accessToken);
        setUser(userData);

        setAuthToken(accessToken);

        localStorage.setItem('@Auth:token', accessToken);
        localStorage.setItem('@Auth:refreshToken', refreshToken);
        localStorage.setItem('@Auth:user', JSON.stringify(userData));
    };

    const logout = async () => {
        setToken(null);
        setUser(null);
        setAuthToken(null);
        localStorage.removeItem('@Auth:token');
        localStorage.removeItem('@Auth:refreshToken');
        localStorage.removeItem('@Auth:user');
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
                        const storedRefreshToken = localStorage.getItem('@Auth:refreshToken');
                        if (storedRefreshToken) {
                            const refreshResponse = await api.auth.refresh(storedRefreshToken);

                            const { accessToken, refreshToken, ...userData } = refreshResponse;

                            setToken(accessToken);
                            setUser(userData);
                            setAuthToken(accessToken);

                            localStorage.setItem('@Auth:token', accessToken);
                            localStorage.setItem('@Auth:refreshToken', refreshToken);
                            localStorage.setItem('@Auth:user', JSON.stringify(userData));

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
