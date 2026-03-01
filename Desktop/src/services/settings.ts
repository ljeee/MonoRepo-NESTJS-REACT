import { Store, load } from '@tauri-apps/plugin-store';

let storeRef: Store | null = null;

export function normalizeBackendUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function ensureProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `http://${value}`;
}

export function validateBackendUrl(value: string): boolean {
  const normalized = normalizeBackendUrl(value);
  if (!normalized) {
    return false;
  }

  const safeValue = ensureProtocol(normalized);

  try {
    const parsed = new URL(safeValue);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function getStore() {
  if (!storeRef) {
    storeRef = await load('settings.json', { autoSave: false, defaults: {} });
  }
  return storeRef;
}

export async function getBackendUrl() {
  const store = await getStore();
  const savedUrl = await store.get<{ value: string }>('backend_url');
  return normalizeBackendUrl(savedUrl?.value || '');
}

export async function setBackendUrl(value: string) {
  const store = await getStore();
  const normalized = normalizeBackendUrl(value);
  await store.set('backend_url', { value: normalized });
  await store.save();
  return normalized;
}