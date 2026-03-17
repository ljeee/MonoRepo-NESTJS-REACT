import { createHttpClient, createApi, setAuthToken as sharedSetAuthToken, setApiBaseUrl as sharedSetApiBaseUrl } from '@monorepo/shared';

// ─── Platform-specific base URL ───────────────────────────────────────────────

export function getBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === 'tauri.localhost') return 'http://127.0.0.1:3000';
    return `http://${h}:3000`;
  }
  return 'http://127.0.0.1:3000';
}

// ─── Singleton instance ───────────────────────────────────────────────────────

const http = createHttpClient({ baseURL: getBaseUrl() });
export const api = createApi(http);

export function setAuthToken(token: string | null) {
  sharedSetAuthToken(http, token);
}

export function setApiBaseUrl(url: string) {
  sharedSetApiBaseUrl(http, url);
}
