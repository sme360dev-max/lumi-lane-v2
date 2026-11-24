'use client';

import { useSyncExternalStore } from 'react';
import { MENU } from '@/data/menu';
import type { MenuCategory } from '@/types/menu';
import { API_BASE_URL } from '@/lib/api';
import { setMenuCategories } from './catalog';

let categories = MENU;
let loading = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }

function load() {
  if (loading || loaded) return;
  loading = true;
  void fetch(`${API_BASE_URL}/api/menu/`)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('Menu unavailable')))
    .then((data: { categories?: MenuCategory[] }) => {
      if (Array.isArray(data.categories) && data.categories.length) {
        categories = data.categories;
        setMenuCategories(categories);
      }
    })
    .catch(() => undefined)
    .finally(() => { loading = false; loaded = true; window.dispatchEvent(new Event('lumi-lane-menu-change')); emit(); });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => { listeners.delete(listener); };
}

export const useMenuCategories = () => useSyncExternalStore(subscribe, () => categories, () => MENU);
