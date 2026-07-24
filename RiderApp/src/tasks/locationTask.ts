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
    if (error) {
      console.warn('[LocationTask]', error.message);
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const last = locations?.[locations.length - 1];
    if (!last) return;
    
    try {
      // En modo headless no corrió el AuthProvider, necesitamos cargar el token manual
      const token = await AsyncStorage.getItem('@Auth:token');
      if (token) {
        setAuthToken(api.http, token);
      }
      
      await api.domiciliarios.actualizarUbicacion(last.coords.latitude, last.coords.longitude);
    } catch {
      // Sin red en este momento — se reintenta en el siguiente tick
    }
  });
} catch (e) {
  console.warn('[LocationTask] Failed to define task', e);
}
