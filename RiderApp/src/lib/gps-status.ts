import AsyncStorage from '@react-native-async-storage/async-storage';

// Diagnóstico del envío de ubicación. Lo escribe la tarea en segundo plano (`tasks/locationTask.ts`, que
// corre incluso sin UI) y lo lee la app para decirle al domiciliario POR QUÉ el despacho no lo ve, en vez
// de un "GPS inactivo" genérico. Solo AsyncStorage: no importa React ni nada pesado (corre en modo headless).

export const GPS_STATUS_KEY = '@Rider:gps';

/** 'no-registrado': el servidor no encontró un domiciliario con el teléfono de este usuario (404). */
export type TipoErrorGps = 'sesion' | 'red' | 'no-registrado' | 'otro';

export interface GpsStatus {
  /** Momento (ms) del último envío exitoso al servidor. */
  ultimoEnvio?: number;
  /** Último fallo de envío (se borra con el siguiente envío exitoso). */
  error?: { en: number; tipo: TipoErrorGps };
}

export async function leerEstadoGps(): Promise<GpsStatus> {
  try {
    const raw = await AsyncStorage.getItem(GPS_STATUS_KEY);
    return raw ? (JSON.parse(raw) as GpsStatus) : {};
  } catch {
    return {};
  }
}

export async function marcarEnvioOk(): Promise<void> {
  try {
    await AsyncStorage.setItem(GPS_STATUS_KEY, JSON.stringify({ ultimoEnvio: Date.now() } satisfies GpsStatus));
  } catch {
    // el diagnóstico nunca debe romper el envío
  }
}

export async function marcarErrorEnvio(tipo: TipoErrorGps): Promise<void> {
  try {
    const previo = await leerEstadoGps();
    await AsyncStorage.setItem(
      GPS_STATUS_KEY,
      JSON.stringify({ ultimoEnvio: previo.ultimoEnvio, error: { en: Date.now(), tipo } } satisfies GpsStatus),
    );
  } catch {
    // idem
  }
}

/** "hace 40 s" / "hace 3 min" / "hace 2 h". */
export function haceCuanto(desde: number, ahora = Date.now()): string {
  const s = Math.max(0, Math.round((ahora - desde) / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}
