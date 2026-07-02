import { api, http, setApiBaseUrl, setAuthToken as sharedSetAuthToken } from '@/src/shared';

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

// ─── Shared singleton ─────────────────────────────────────────────────────────
// Reconfigura el singleton de @/src/shared (el mismo que usa AuthContext para
// inyectar el token y el interceptor de refresh) en lugar de crear una segunda
// instancia de axios — una instancia separada dejaría a las pantallas sin
// header Authorization tras el login.

setApiBaseUrl(http, getBaseUrl());

export { api };

export function setAuthToken(token: string | null) {
  sharedSetAuthToken(http, token);
}
