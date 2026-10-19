import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { haceCuanto, leerEstadoGps, type GpsStatus } from './gps-status';
import { readPermissions, type PermState } from './location';

/** Un envío más viejo que esto (con el servicio corriendo) se considera atrasado: 3 ticks de 20 s. */
const ATRASO_MS = 90 * 1000;
/** Cada cuánto se vuelve a leer el estado mientras la pantalla está abierta. */
const REFRESCO_MS = 15 * 1000;

export type NivelGps = 'ok' | 'atrasado' | 'inactivo';

export interface EstadoGps {
  nivel: NivelGps;
  /** Frase corta y concreta para el domiciliario ("GPS apagado en el teléfono", "Enviando · hace 20 s"…). */
  texto: string;
  /** Qué hacer, cuando hay algo que hacer. */
  ayuda?: string;
  perms: PermState | null;
  status: GpsStatus;
}

/** Decide el estado del rastreo a partir de permisos, GPS del teléfono, servicio y último envío. Pura: se prueba sola. */
export function evaluarEstadoGps(perms: PermState | null, status: GpsStatus, ahora = Date.now()): EstadoGps {
  const base = { perms, status };
  if (!perms) return { ...base, nivel: 'atrasado', texto: 'Revisando ubicación…' };

  if (perms.foreground !== 'granted' || perms.background !== 'granted') {
    return {
      ...base,
      nivel: 'inactivo',
      texto: 'Falta permiso de ubicación',
      ayuda: 'Pon la ubicación en “Permitir todo el tiempo” desde los ajustes del teléfono.',
    };
  }
  if (!perms.servicesEnabled) {
    return { ...base, nivel: 'inactivo', texto: 'GPS apagado en el teléfono', ayuda: 'Enciende la ubicación (GPS) del teléfono.' };
  }
  if (!perms.running) {
    return { ...base, nivel: 'inactivo', texto: 'Ubicación detenida', ayuda: 'Toca “Activar ubicación” para reanudar el envío.' };
  }
  if (status.error?.tipo === 'sesion' && (!status.ultimoEnvio || status.error.en >= status.ultimoEnvio)) {
    return { ...base, nivel: 'inactivo', texto: 'Sesión vencida', ayuda: 'Cierra sesión y vuelve a entrar para que el despacho te vea.' };
  }
  // El teléfono llega al servidor pero ningún domiciliario tiene ese número: el despacho nunca lo verá, por más
  // que el GPS funcione. Antes el servidor respondía OK sin guardar y la app decía "enviando".
  if (status.error?.tipo === 'no-registrado' && (!status.ultimoEnvio || status.error.en >= status.ultimoEnvio)) {
    return {
      ...base,
      nivel: 'inactivo',
      texto: 'No estás registrado como domiciliario',
      ayuda: 'Pide al administrador que te registre con tu mismo número de teléfono.',
    };
  }
  if (!status.ultimoEnvio) {
    return { ...base, nivel: 'atrasado', texto: 'Esperando la primera posición…' };
  }
  if (ahora - status.ultimoEnvio > ATRASO_MS) {
    const sinRed = status.error?.tipo === 'red';
    return {
      ...base,
      nivel: 'atrasado',
      texto: `Sin enviar ${haceCuanto(status.ultimoEnvio, ahora).replace('hace ', 'desde hace ')}`,
      ayuda: sinRed ? 'No hay conexión a internet: se reintenta solo.' : 'Si sigues sin señal o con el teléfono en ahorro de batería, el envío se retrasa.',
    };
  }
  return { ...base, nivel: 'ok', texto: `Enviando ubicación · ${haceCuanto(status.ultimoEnvio, ahora)}` };
}

/** Estado del rastreo en vivo: se relee al volver a primer plano y cada 15 s mientras la pantalla está montada. */
export function useGpsEstado() {
  const [perms, setPerms] = useState<PermState | null>(null);
  const [status, setStatus] = useState<GpsStatus>({});
  const [ahora, setAhora] = useState(() => Date.now());

  const refrescar = useCallback(async () => {
    const [p, s] = await Promise.all([readPermissions(), leerEstadoGps()]);
    setPerms(p);
    setStatus(s);
    setAhora(Date.now());
    return p;
  }, []);

  useEffect(() => {
    void refrescar();
    const intervalo = setInterval(() => void refrescar(), REFRESCO_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refrescar();
    });
    return () => {
      clearInterval(intervalo);
      sub.remove();
    };
  }, [refrescar]);

  return { estado: evaluarEstadoGps(perms, status, ahora), refrescar };
}
