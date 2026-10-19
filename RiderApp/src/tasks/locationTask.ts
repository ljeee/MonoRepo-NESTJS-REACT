import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from '@/src/shared/services/api';

import { marcarEnvioOk, marcarErrorEnvio } from '../lib/gps-status';

export const LOCATION_TASK_NAME = 'dfiru-rider-location-task';
export const LOCATION_UPDATE_INTERVAL_MS = 20 * 1000; // 20 segundos — tracking estilo WhatsApp

const TOKEN_KEY = '@Auth:token';
const REFRESH_KEY = '@Auth:refreshToken';

type ErrorHttp = { response?: { status?: number }; message?: string };

/**
 * El token de acceso dura 8 h. Con la app en segundo plano y el proceso reiniciado por el servicio, el
 * AuthProvider (que renueva el token ante un 401) NO está montado: sin esto el rastreo moría en silencio a
 * las 8 h. Renueva con el refresh token y guarda el par nuevo. Si otro código ya renovó (el token guardado
 * cambió), solo lo reutiliza: el refresh token rota y usarlo dos veces lo invalidaría.
 */
let renovando: Promise<boolean> | null = null;
function renovarSesion(tokenUsado: string): Promise<boolean> {
  if (renovando) return renovando;
  renovando = (async () => {
    try {
      const guardado = await AsyncStorage.getItem(TOKEN_KEY);
      if (guardado && guardado !== tokenUsado) {
        setAuthToken(api.http, guardado);
        return true;
      }
      const refresh = await AsyncStorage.getItem(REFRESH_KEY);
      if (!refresh) return false;
      const r = await api.auth.refresh(refresh);
      await AsyncStorage.multiSet([
        [TOKEN_KEY, r.accessToken],
        [REFRESH_KEY, r.refreshToken],
      ]);
      setAuthToken(api.http, r.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      renovando = null;
    }
  })();
  return renovando;
}

// El task se define en el scope global (no dentro de un componente UI):
// Android puede relanzar el JS en modo "headless", sin montar ningún
// componente, solo para ejecutar este callback cuando llega una ubicación
// con la app en background.
try {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    // TODO EL cuerpo va dentro de un try: esta función corre en modo headless
    // con la app cerrada, donde una excepción no atrapada no tiene ningún
    // ErrorBoundary por encima y se convierte en un crash del proceso.
    try {
      if (error) {
        console.warn('[LocationTask]', error.message);
        return;
      }

      const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
      const last = locations?.[locations.length - 1];
      // Coordenadas defensivas: si el SO entrega un payload raro, se descarta
      // en vez de mandar NaN al backend.
      const lat = last?.coords?.latitude;
      const lng = last?.coords?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
        return;
      }

      // En modo headless no corrió el AuthProvider: hay que cargar el token a mano.
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return; // sesión cerrada: nada que reportar
      setAuthToken(api.http, token);

      // Hora en que el GPS tomó la posición (si llegó tarde por falta de red, el POS no la verá como reciente).
      const capturadaEn = typeof last?.timestamp === 'number' ? last.timestamp : undefined;

      try {
        await api.domiciliarios.actualizarUbicacion(lat, lng, capturadaEn);
      } catch (e) {
        if ((e as ErrorHttp)?.response?.status !== 401) throw e;
        // Token vencido: renovar y reintentar UNA vez.
        if (!(await renovarSesion(token))) {
          await marcarErrorEnvio('sesion');
          return;
        }
        await api.domiciliarios.actualizarUbicacion(lat, lng, capturadaEn);
      }
      await marcarEnvioOk();
    } catch (e) {
      // Sin red o cualquier fallo nativo: se reintenta en el siguiente tick. Jamás se propaga.
      const status = (e as ErrorHttp)?.response?.status;
      await marcarErrorEnvio(status === 401 ? 'sesion' : status === 404 ? 'no-registrado' : status == null ? 'red' : 'otro');
      console.warn('[LocationTask] tick fallido:', (e as ErrorHttp)?.message ?? e);
    }
  });
} catch (e) {
  console.warn('[LocationTask] Failed to define task', e);
}
