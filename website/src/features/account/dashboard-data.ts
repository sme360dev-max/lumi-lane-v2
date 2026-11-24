'use client';

import { useSyncExternalStore } from 'react';
import { accountRequest } from '@/lib/api';
import { updateSessionAccount, type AccountProfile } from './account-session';

export type Profile = AccountProfile;
export type Preferences = { compact: boolean };
export type AccountOrder = {
  id: string;
  date: string;
  status: string;
  statusLabel: string;
  totalCents: number;
  subtotalCents: number;
  rewardCents: number;
  items: { key: string; itemId: string; name: string; label: string; quantity: number; cents: number; subtotal: number }[];
};
export type Reservation = { id: string; date: string; time: string; guests: number; status: string; notes: string };
export type Rewards = {
  program: null | { active: boolean; pointsPerOrder: number; pointsForReward: number; rewardCents: number };
  points: number;
  rewardBalanceCents: number;
  entries: { kind: string; points: number; amountCents: number; description: string; createdAt: string }[];
};
export type DashboardData = {
  profile: Profile;
  preferences: Preferences;
  orders: AccountOrder[];
  reservations: Reservation[];
  rewards: Rewards;
  loaded: boolean;
};
export const EMPTY: DashboardData = {
  profile: { id: '', name: '', email: '', phone: '', avatar: 'clay' },
  preferences: { compact: false }, orders: [], reservations: [],
  rewards: { program: null, points: 0, rewardBalanceCents: 0, entries: [] }, loaded: false,
};
let data = EMPTY;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const emit = () => listeners.forEach((listener) => listener());
export const useDashboardData = () => useSyncExternalStore(subscribe, () => data, () => EMPTY);

export async function loadDashboard() {
  const next = await accountRequest<Omit<DashboardData, 'loaded' | 'profile'> & { account: Profile }>('/api/account/dashboard/');
  data = {
    profile: next.account,
    preferences: next.preferences,
    orders: next.orders,
    reservations: next.reservations,
    rewards: next.rewards,
    loaded: true,
  };
  updateSessionAccount(next.account);
  emit();
}

export async function saveDashboard(change: Partial<Pick<DashboardData, 'profile' | 'preferences'>>) {
  const previous = data;
  data = { ...data, ...change };
  emit();
  try {
    if (change.profile) {
      const result = await accountRequest<{ account: Profile }>('/api/account/me/', {
        method: 'PATCH', body: JSON.stringify(change.profile),
      });
      data = { ...data, profile: result.account };
      updateSessionAccount(result.account);
    }
    if (change.preferences) {
      const result = await accountRequest<{ preferences: Preferences }>('/api/account/preferences/', {
        method: 'PATCH', body: JSON.stringify(change.preferences),
      });
      data = { ...data, preferences: result.preferences };
    }
    emit();
  } catch (error) {
    data = previous;
    emit();
    throw error;
  }
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => [...word][0]).join('').toUpperCase();
}

export function validateProfile(profile: Profile) {
  const errors: Partial<Record<'name' | 'email' | 'phone', string>> = {};
  if (!profile.name.trim() || profile.name.trim().length > 80) errors.name = 'Enter a name of 1–80 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) errors.email = 'Enter a valid email address.';
  if (profile.phone.trim() && !/^\+?[\d .()-]{8,24}$/.test(profile.phone.trim())) errors.phone = 'Enter a valid phone number or leave this blank.';
  else if (profile.phone.trim() && !/^\d{8,15}$/.test(profile.phone.replace(/\D/g, ''))) errors.phone = 'Enter a phone number with 8–15 digits.';
  return errors;
}
