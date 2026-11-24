'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';

export type LoyaltyProgramData = { active: boolean; pointsPerOrder: number; pointsForReward: number; rewardCents: number };
const DEFAULT_PROGRAM: LoyaltyProgramData = { active: true, pointsPerOrder: 1, pointsForReward: 8, rewardCents: 2000 };

export function useLoyaltyProgram() {
  const [program, setProgram] = useState(DEFAULT_PROGRAM);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API_BASE_URL}/api/loyalty/`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unavailable')))
      .then((data: LoyaltyProgramData) => setProgram(data))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return program;
}
