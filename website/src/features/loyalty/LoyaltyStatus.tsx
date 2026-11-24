'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ctaClass } from '@/components/ui/Button';
import { useAccountSession } from '@/features/account/account-session';
import { accountRequest } from '@/lib/api';
import { money } from '@/features/menu/catalog';
import styles from './loyalty-status.module.css';

type RewardData = { points: number; rewardBalanceCents: number; program: null | { active: boolean; pointsForReward: number; rewardCents: number } };

export function LoyaltyStatus() {
  const session = useAccountSession();
  const sessionAccountId = session.account?.id;
  const [data, setData] = useState<{ accountId: string; result: RewardData } | null>(null);
  useEffect(() => {
    if (session.status !== 'active' || !sessionAccountId) return;
    let current = true;
    const accountId = sessionAccountId;
    void accountRequest<RewardData>('/api/account/rewards/')
      .then((result) => { if (current) setData({ accountId, result }); })
      .catch(() => { if (current) setData({ accountId, result: { program: null, points: 0, rewardBalanceCents: 0 } }); });
    return () => { current = false; };
  }, [session.status, sessionAccountId]);
  const currentData = data && data.accountId === sessionAccountId ? data.result : null;
  const program = currentData?.program;
  const progress = program?.active && program.pointsForReward > 0 ? Math.min(100, ((currentData?.points ?? 0) / program.pointsForReward) * 100) : 0;

  return <section className={styles.panel} aria-labelledby="loyalty-status-title">
    <div className="site-container">
      <p className="experience-kicker">Your Coffee Club</p>
      <h2 id="loyalty-status-title">Your <em>rewards.</em></h2>
      {session.status === 'active' ? currentData ? program?.active ? <>
        <p>{currentData.points} of {program.pointsForReward} points toward {money(program.rewardCents)} AUD reward credit.</p>
        <div className={styles.track} role="progressbar" aria-label="Points toward reward" aria-valuemin={0} aria-valuemax={program.pointsForReward} aria-valuenow={currentData.points}><span style={{ width: `${progress}%` }} /></div>
        <p>Available reward credit: <strong>{money(currentData.rewardBalanceCents)} AUD</strong>. Points are added after an order is completed.</p>
      </> : <p>The loyalty program is temporarily paused.</p> : <p>Loading your points and reward balance…</p> : <p>Sign in to see your points and available reward credit.</p>}
      <div className={styles.actions}>{session.status === 'active' ? <Link href="/account/#rewards" className={ctaClass()}>Open account rewards</Link> : <><Link href="/login/" className={ctaClass()}>Log in</Link><Link href="/signup/" className={ctaClass({ variant: 'editorial' })}>Create account</Link></>}</div>
    </div>
  </section>;
}
