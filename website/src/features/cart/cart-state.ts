'use client';

import { useSyncExternalStore } from 'react';
import { CART_CHOICES } from '../menu/catalog';
import { accountRequest, AUTH_EVENT, readAuthToken } from '@/lib/api';

type Cart = Readonly<Record<string, number>>;
const EMPTY: Cart = {};
const STORAGE_KEY = 'lumi-lane-cart-v1';
const validCartKey = (key: string) => /^[a-z0-9-]{1,100}:(standard|glass|bottle|size-\d+-\d+)$/.test(key);
let cart = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();
let remoteToken: string | null = null;
let writeQueue = Promise.resolve();

function decode(value: string | null): Cart {
  if (!value) return EMPTY;
  try {
    const raw: unknown = JSON.parse(value);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY;
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([key, quantity]) => validCartKey(key) && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 99,
      ),
    );
  } catch {
    return EMPTY;
  }
}

function readStorage() {
  try {
    cart = decode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Keep the in-memory bag if storage is blocked.
  }
  hydrated = true;
}

function persistLocal() {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* in-memory cart remains usable */ }
}

function saveRemote() {
  if (!readAuthToken()) return;
  writeQueue = writeQueue.then(() => accountRequest('/api/account/cart/', {
    method: 'PUT', body: JSON.stringify({ items: cart }),
  })).then(() => undefined).catch(() => undefined);
}

async function loadRemote() {
  const token = readAuthToken();
  if (!token || token === remoteToken) return;
  remoteToken = token;
  try {
    const result = await accountRequest<{ items: Cart }>('/api/account/cart/');
    if (!Object.keys(result.items).length && Object.keys(cart).length) {
      saveRemote();
    } else {
      cart = decode(JSON.stringify(result.items));
      persistLocal();
      listeners.forEach((listener) => listener());
    }
  } catch { /* keep the device's cached cart */ }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!hydrated) readStorage();
  void loadRemote();
  const update = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    cart = decode(event.newValue);
    listener();
  };
  window.addEventListener('storage', update);
  const menuChanged = () => listeners.forEach((listener) => listener());
  window.addEventListener('lumi-lane-menu-change', menuChanged);
  window.addEventListener(AUTH_EVENT, loadRemote);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', update);
    window.removeEventListener('lumi-lane-menu-change', menuChanged);
    window.removeEventListener(AUTH_EVENT, loadRemote);
  };
}

export const useCart = () =>
  useSyncExternalStore(
    subscribe,
    () => cart,
    () => EMPTY,
  );

export function setQuantity(key: string, quantity: number) {
  if (!validCartKey(key) || !Number.isSafeInteger(quantity)) return;
  if (!hydrated) readStorage();
  const next = { ...cart };
  if (quantity < 1) delete next[key];
  else next[key] = Math.min(99, quantity);
  cart = next;
  persistLocal();
  listeners.forEach((listener) => listener());
  saveRemote();
}

export function changeQuantity(key: string, delta: number) {
  if (!hydrated) readStorage();
  setQuantity(key, (cart[key] ?? 0) + delta);
}

export function clearCart() {
  if (!hydrated) readStorage();
  cart = EMPTY;
  persistLocal();
  listeners.forEach((listener) => listener());
  if (readAuthToken()) {
    writeQueue = writeQueue.then(() => accountRequest('/api/account/cart/', { method: 'DELETE' })).then(() => undefined).catch(() => undefined);
  }
}

export const countItems = (cart: Cart) => Object.values(cart).reduce((total, quantity) => total + quantity, 0);

export function getCartLines(cart: Cart) {
  return Object.entries(cart).flatMap(([key, quantity]) => {
    const choice = CART_CHOICES.get(key);
    return choice ? [{ ...choice, quantity, subtotal: choice.cents * quantity }] : [];
  });
}
