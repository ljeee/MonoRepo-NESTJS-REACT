import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, authStorage } from '../lib/api';
import type { AuthUser } from '../lib/types';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (telefono: string, password: string) => Promise<void>;
  registro: (telefono: string, password: string, nombre?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    authStorage.getToken() ? authStorage.getUser() : null,
  );

  const login = useCallback(async (telefono: string, password: string) => {
    const auth = await api.auth.loginCliente(telefono.trim(), password);
    authStorage.save(auth);
    setUser({ id: auth.id, username: auth.username, name: auth.name, roles: auth.roles });
  }, []);

  const registro = useCallback(async (telefono: string, password: string, nombre?: string) => {
    const auth = await api.auth.registroCliente(telefono.trim(), password, nombre?.trim() || undefined);
    authStorage.save(auth);
    setUser({ id: auth.id, username: auth.username, name: auth.name, roles: auth.roles });
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, registro, logout }),
    [user, login, registro, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
