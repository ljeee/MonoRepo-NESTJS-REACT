import * as Location from 'expo-location';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { useEffect, useState, useCallback } from 'react';

import { LOCATION_TASK_NAME, LOCATION_UPDATE_INTERVAL_MS } from '../tasks/locationTask';

// ─── Control del tracking de ubicación ────────────────────────────────────────
//
// Reglas duras aprendidas a los golpes:
//
//  1. NUNCA llamar `startLocationUpdatesAsync` con `foregroundService` si no
//     está concedido ACCESS_BACKGROUND_LOCATION: en Android 14 lanza un
//     SecurityException FATAL que tumba la app a nivel nativo.
//  2. El tracking NO puede vivir en el `useEffect` de una pantalla. Antes estaba
//     dentro de DashboardScreen y, como abrir Ajustes desmontaba esa pantalla,
//     el cleanup apagaba el GPS: la pantalla que existe para arreglar permisos
//     era justo la que rompía el rastreo. Ahora cuelga de la sesión.
//  3. Hay que re-verificar al volver a primer plano. Android 11+ obliga a
//     conceder "Permitir todo el tiempo" desde Ajustes del sistema; sin esta
//     re-verificación el domiciliario concedía el permiso, volvía a la app y
//     seguía sin reportar hasta reiniciarla. Además el SO puede matar el
//     servicio en segundo plano, y esto lo revive.

export type PermState = {
  foreground: Location.PermissionStatus | null;
  background: Location.PermissionStatus | null;
  running: boolean;
};

/**
 * Android 13+ exige POST_NOTIFICATIONS para mostrar CUALQUIER notificación,
 * incluida la persistente del foreground service de ubicación.
 */
async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    await PermissionsAndroid.request(
      // @ts-ignore — constante presente en runtime aunque el tipo de esta
      // versión de react-native aún no la incluya
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  } catch {
    // El tracking no depende de que acepte ver la notificación.
  }
}

/** ¿El servicio de ubicación está corriendo ahora mismo? */
export async function isTrackingRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}

/** Lee los permisos actuales SIN pedirlos (para pintar la pantalla de ajustes). */
export async function readPermissions(): Promise<PermState> {
  const [fg, bg, running] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    Location.getBackgroundPermissionsAsync().catch(() => null),
    isTrackingRunning(),
  ]);
  return {
    foreground: fg?.status ?? null,
    background: bg?.status ?? null,
    running,
  };
}

export type EnsureResult =
  | 'running' // ya estaba activo o quedó activo
  | 'sin-permiso-primer-plano'
  | 'sin-permiso-segundo-plano'
  | 'app-en-segundo-plano' // no se puede arrancar el servicio ahora
  | 'error';

/**
 * Deja el tracking corriendo si se puede. Idempotente y seguro de llamar
 * cuantas veces haga falta (al montar, al volver a foreground, desde un botón).
 *
 * @param ask  Si es `true` puede abrir diálogos de permiso; en las
 *             re-verificaciones automáticas va en `false` para no acosar
 *             al domiciliario con pop-ups cada vez que abre la app.
 */
export async function ensureTracking(ask: boolean): Promise<EnsureResult> {
  try {
    // ── 1. Primer plano ──────────────────────────────────────────────────
    let fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted' && ask && fg.canAskAgain) {
      fg = await Location.requestForegroundPermissionsAsync();
    }
    if (fg.status !== 'granted') return 'sin-permiso-primer-plano';

    // ── 2. Notificaciones (para la notificación del servicio) ────────────
    if (ask) await ensureNotificationPermission();

    // ── 3. Segundo plano — SIN esto, arrancar el servicio crashea ────────
    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && ask && bg.canAskAgain) {
      bg = await Location.requestBackgroundPermissionsAsync();
    }
    if (bg.status !== 'granted') return 'sin-permiso-segundo-plano';

    // ── 4. Arrancar solo si no está ya corriendo ─────────────────────────
    if (await isTrackingRunning()) return 'running';

    // Android 14+ (y más estricto en 15/16, que es nuestro targetSdk=36)
    // PROHÍBE arrancar un foreground service mientras la app está en segundo
    // plano: lanza ForegroundServiceStartNotAllowedException, que es FATAL y
    // no se puede atrapar desde JS de forma fiable. Puede pasar si el arranque
    // diferido o una re-verificación caen justo después de que el usuario
    // bloqueó la pantalla o mandó la app atrás. Si no estamos al frente, no se
    // arranca: quedará activo en el próximo AppState 'active'.
    if (AppState.currentState !== 'active') return 'app-en-segundo-plano';

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: LOCATION_UPDATE_INTERVAL_MS,
      // Si recorre 50 m antes de que venzan los 20 s, reporta de inmediato.
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      // ── iOS ──
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      // ── Android ──
      foregroundService: {
        notificationTitle: 'Dfiru Riders',
        notificationBody: 'Compartiendo tu ubicación en tiempo real',
        notificationColor: '#F5A524',
        // Sigue vivo aunque maten la app desde recientes.
        killServiceOnDestroy: false,
      },
    });
    return 'running';
  } catch (err: any) {
    // Nunca propagar: la app funciona sin rastreo antes que crashear.
    console.warn('[location] no se pudo iniciar el tracking:', err?.message ?? err);
    return 'error';
  }
}

/** Apaga el tracking. Solo al cerrar sesión. */
export async function stopTracking(): Promise<void> {
  try {
    if (await isTrackingRunning()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    // ya estaba detenido o el task no existe
  }
}

/**
 * Mantiene el tracking vivo mientras haya sesión. Debe montarse UNA sola vez,
 * por encima de la navegación, para que cambiar de pestaña no lo toque.
 */
export function useLocationTracking(enabled: boolean) {
  const [result, setResult] = useState<EnsureResult | null>(null);

  const refresh = useCallback(async (ask: boolean) => {
    const r = await ensureTracking(ask);
    setResult(r);
    return r;
  }, []);

  useEffect(() => {
    if (!enabled) {
      void stopTracking();
      setResult(null);
      return;
    }

    let cancelled = false;

    // Pequeño retraso al entrar: no competir con el fetch inicial y el socket.
    const timeout = setTimeout(() => {
      if (!cancelled) void refresh(true);
    }, 1200);

    // Al volver a primer plano: revivir el servicio si el SO lo mató y recoger
    // el permiso que el usuario acabe de conceder desde Ajustes del sistema.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !cancelled) void refresh(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.remove();
      // OJO: no se detiene el tracking aquí. Este efecto solo se limpia al
      // cerrar sesión (enabled → false), y esa rama ya llama a stopTracking.
    };
  }, [enabled, refresh]);

  return { result, refresh };
}
