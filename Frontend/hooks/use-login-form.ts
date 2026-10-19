import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { isAxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';

const CLAVE_CREDENCIALES = '@App:credenciales';

/**
 * Estado y envío del formulario de login, compartido por login.tsx (nativo) y
 * login.web.tsx (pantalla dividida): cada uno solo conserva su diseño y animaciones.
 * `alFallar` dispara la animación de error de cada diseño.
 *
 * Nota: "Recordarme" guarda la contraseña en AsyncStorage (comportamiento existente,
 * pendiente de revisar — ver hallazgos fuera de alcance del plan).
 */
export function useLoginForm(alFallar?: () => void) {
  const { login } = useAuth();
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recordar, setRecordar] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_CREDENCIALES)
      .then((guardado) => {
        if (!guardado) return;
        const { user, pass } = JSON.parse(guardado) as { user: string; pass: string };
        setUsuario(user);
        setContrasena(pass);
        setRecordar(true);
      })
      .catch(() => undefined);
  }, []);

  const handleLogin = useCallback(async () => {
    if (!usuario || !contrasena) {
      setError('Por favor completa todos los campos');
      alFallar?.();
      return;
    }
    try {
      setLoading(true);
      setError('');
      await login(usuario, contrasena);
      if (recordar) {
        await AsyncStorage.setItem(CLAVE_CREDENCIALES, JSON.stringify({ user: usuario, pass: contrasena }));
      } else {
        await AsyncStorage.removeItem(CLAVE_CREDENCIALES);
      }
      router.replace('/');
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.message : undefined;
      setError(typeof msg === 'string' ? msg : 'Credenciales incorrectas o error de conexión');
      alFallar?.();
    } finally {
      setLoading(false);
    }
  }, [usuario, contrasena, recordar, login, router, alFallar]);

  return { usuario, setUsuario, contrasena, setContrasena, loading, error, setError, recordar, setRecordar, handleLogin };
}
