'use client';

import { useSyncExternalStore } from 'react';
import { accountRequest, AUTH_EVENT, readAuthToken, writeAuthToken } from '@/lib/api';

export type AccountProfile = { id: string; name: string; email: string; phone: string; avatar: 'clay' | 'espresso' };
export type AccountSession = { status: 'loading' | 'signed-out' | 'active'; account: AccountProfile | null };

let state: AccountSession = { status: 'loading', account: null };
let initialized = false;
const listeners = new Set<() => void>();
const snapshotOnServer = (): AccountSession => ({ status: 'loading', account: null });

function emit() {
  for (const listener of listeners) listener();
}

export function setAccountSession(token: string, account: AccountProfile) {
  writeAuthToken(token);
  state = { status: 'active', account };
  emit();
}

export function updateSessionAccount(account: AccountProfile) {
  state = { status: 'active', account };
  emit();
}

export function clearAccountSession() {
  writeAuthToken(null);
  state = { status: 'signed-out', account: null };
  emit();
}

async function restoreSession() {
  if (!readAuthToken()) {
    state = { status: 'signed-out', account: null };
    emit();
    return;
  }
  try {
    const data = await accountRequest<{ account: AccountProfile }>('/api/account/me/');
    state = { status: 'active', account: data.account };
  } catch {
    state = { status: 'signed-out', account: null };
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    void restoreSession();
  }
  const sync = () => {
    if (!readAuthToken()) {
      state = { status: 'signed-out', account: null };
      emit();
    }
  };
  window.addEventListener(AUTH_EVENT, sync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener(AUTH_EVENT, sync);
  };
}

export const useAccountSession = () => useSyncExternalStore(subscribe, () => state, snapshotOnServer);
