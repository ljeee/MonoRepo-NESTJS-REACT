import { createHttpClient, createApi, setAuthToken as sharedSetAuthToken } from '@monorepo/shared';

// ─── Platform-specific base URL ───────────────────────────────────────────────

export function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3000';
    return `http://${h}:3000`;
  }
  return 'http://localhost:3000';
}

// ─── Singleton instance ───────────────────────────────────────────────────────

const http = createHttpClient({ baseURL: getBaseUrl() });
export const api = createApi(http);

export function setAuthToken(token: string | null) {
  sharedSetAuthToken(http, token);
}
