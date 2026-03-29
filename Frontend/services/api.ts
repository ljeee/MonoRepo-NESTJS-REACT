import { createHttpClient, createApi, setAuthToken as sharedSetAuthToken } from '@monorepo/shared';

// ─── Platform-specific base URL ───────────────────────────────────────────────

export function getBaseUrl(): string {
  // 1. Prefer EXPO_PUBLIC_API_BASE_URL if set
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }

    // Production Domain (Cloudflare Tunnel)
    // If we are at pos.d-firu.com, the API is at api.d-firu.com
    if (hostname === 'pos.d-firu.com') {
      return 'https://api.d-firu.com';
    }

    // Default: use the current protocol to avoid Mixed Content errors
    // Assuming the API is on the same host but port 3000 (standard for your LAN setup)
    return `${protocol}//${hostname}:3000`;
  }

  return 'http://localhost:3000';
}

// ─── Singleton instance ───────────────────────────────────────────────────────

const http = createHttpClient({ baseURL: getBaseUrl() });
export const api = createApi(http);

export function setAuthToken(token: string | null) {
  sharedSetAuthToken(http, token);
}
