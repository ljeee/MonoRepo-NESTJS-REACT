import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type {
  AuthResponse,
  AuthUser,
  CreateOrdenPayload,
  EmpresaConfig,
  PizzaSabor,
  Producto,
} from './types';

// El backend escucha en el puerto 3000 por defecto (Backend/src/main.ts)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ─── Sesión en localStorage ───────────────────────────────────────────────────

const TOKEN_KEY = 'dfiru:accessToken';
const REFRESH_KEY = 'dfiru:refreshToken';
const USER_KEY = 'dfiru:user';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },
  save(auth: AuthResponse) {
    const { accessToken, refreshToken, ...user } = auth;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// ─── Instancia axios con auth + refresh ───────────────────────────────────────

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Un solo refresh en vuelo aunque fallen varias peticiones a la vez
let refreshPromise: Promise<string | null> | null = null;

function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    const refreshToken = authStorage.getRefreshToken();
    refreshPromise = axios
      .post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((r) => {
        authStorage.save(r.data);
        return r.data.accessToken;
      })
      .catch(() => {
        authStorage.clear();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      authStorage.getRefreshToken()
    ) {
      original._retry = true;
      const newToken = await refreshSession();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      }
    }
    return Promise.reject(error);
  },
);

// ─── Mensajes de error legibles ───────────────────────────────────────────────

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
    const msg = (err.response.data as { message?: string | string[] } | undefined)?.message;
    if (Array.isArray(msg)) return msg.join('. ');
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}

// ─── API tipada ───────────────────────────────────────────────────────────────

function arr<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export const api = {
  auth: {
    loginCliente: (telefono: string, password: string) =>
      http.post<AuthResponse>('/auth/cliente/login', { telefono, password }).then((r) => r.data),

    registroCliente: (telefono: string, password: string, clienteNombre?: string) =>
      http
        .post<AuthResponse>('/auth/cliente/registro', { telefono, password, clienteNombre })
        .then((r) => r.data),
  },

  productos: {
    getAll: () =>
      http.get<Producto[]>('/productos', { params: { activo: true } }).then((r) => arr<Producto>(r.data)),
  },

  pizzaSabores: {
    getAll: () => http.get<PizzaSabor[]>('/pizza-sabores').then((r) => arr<PizzaSabor>(r.data)),
  },

  empresa: {
    get: () => http.get<EmpresaConfig>('/empresa').then((r) => r.data ?? {}),
  },

  ordenes: {
    create: (payload: CreateOrdenPayload) => http.post('/ordenes', payload).then((r) => r.data),
  },
};
