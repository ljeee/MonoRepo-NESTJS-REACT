import Constants from 'expo-constants';

/**
 * Etiqueta del JS empaquetado. Cambiarla en cada release (R0, A1, A2, B…): si un APK
 * recién instalado muestra una etiqueta vieja, está corriendo el bundle viejo versionado
 * en git (`android/app/src/main/assets/index.android.bundle`) y no el JS nuevo.
 */
export const BUILD_JS = 'H2 · 2026-10-19';

/** Versión nativa (app.json) + JS, visible al pie del menú. */
export const BUILD_LABEL = `v${Constants.expoConfig?.version ?? '?'} · ${BUILD_JS}`;
