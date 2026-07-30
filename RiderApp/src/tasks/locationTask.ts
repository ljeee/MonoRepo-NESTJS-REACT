import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from '@/src/shared';

export const LOCATION_TASK_NAME = 'dfiru-rider-location-task';
export const LOCATION_UPDATE_INTERVAL_MS = 20 * 1000; // 20 segundos — tracking estilo WhatsApp

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
      const token = await AsyncStorage.getItem('@Auth:token');
      if (!token) return; // sesión cerrada: nada que reportar
      setAuthToken(api.http, token);

      await api.domiciliarios.actualizarUbicacion(lat, lng);
    } catch (e: any) {
      // Sin red, token vencido o cualquier fallo nativo: se reintenta en el
      // siguiente tick. Jamás se propaga.
      console.warn('[LocationTask] tick fallido:', e?.message ?? e);
    }
  });
} catch (e) {
  console.warn('[LocationTask] Failed to define task', e);
}
