'use client';

import { useSyncExternalStore } from 'react';
import { accountRequest, AUTH_EVENT, readAuthToken } from '@/lib/api';

const KEY = 'lumi-lane-favorites-v1';
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9-]{1,100}$/.test(id);
const empty: readonly string[] = [];
let saved: readonly string[] = empty;
let loaded = false;
let remoteToken: string | null = null;
let writeQueue = Promise.resolve();
const listeners = new Set<() => void>();

function update(value: string | null) {
  try {
    const ids: unknown = JSON.parse(value ?? 'null');
    saved = Array.isArray(ids) ? [...new Set(ids.filter(validId))] : empty;
  } catch { saved = empty; }
}

function loadLocal() {
  if (loaded) return;
  loaded = true;
  try { update(window.localStorage.getItem(KEY)); } catch { /* retain in-memory favorites */ }
}

function emit() { listeners.forEach((listener) => listener()); }

async function loadRemote() {
  const token = readAuthToken();
  if (!token || token === remoteToken) return;
  remoteToken = token;
  try {
    const result = await accountRequest<{ items: string[] }>('/api/account/favorites/');
    const serverItems = [...new Set(result.items.filter(validId))];
    if (serverItems.length === 0 && saved.length > 0) {
      writeQueue = writeQueue.then(() => accountRequest('/api/account/favorites/', { method: 'PUT', body: JSON.stringify({ items: [...saved] }) })).then(() => undefined).catch(() => undefined);
    } else {
      saved = serverItems;
    }
    window.localStorage.setItem(KEY, JSON.stringify(saved));
    emit();
  } catch { /* cached favorites remain available */ }
}

function subscribe(listener: () => void) {
  loadLocal();
  listeners.add(listener);
  void loadRemote();
  const sync = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    update(event.newValue);
    emit();
  };
  window.addEventListener('storage', sync);
  window.addEventListener(AUTH_EVENT, loadRemote);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', sync);
    window.removeEventListener(AUTH_EVENT, loadRemote);
  };
}

export const useFavorites = () => useSyncExternalStore(subscribe, () => saved, () => empty);

export function toggleFavorite(id: string) {
  if (!validId(id)) return;
  loadLocal();
  saved = saved.includes(id) ? saved.filter((entry) => entry !== id) : [...saved, id];
  try { window.localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* keep in memory */ }
  emit();
  if (readAuthToken()) {
    const items = [...saved];
    writeQueue = writeQueue.then(() => accountRequest('/api/account/favorites/', { method: 'PUT', body: JSON.stringify({ items }) })).then(() => undefined).catch(() => undefined);
  }
}
