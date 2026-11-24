'use client';

import Link from 'next/link';
import type { PointerEvent } from 'react';
import { ACCOUNT_NAV } from '@/data/navigation';
import { useAccountSession } from '@/features/account/account-session';
import { isActive } from './navStyles';

function movePill(event: PointerEvent<HTMLAnchorElement>) {
  if (
    event.pointerType !== 'mouse' ||
    !window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches
  )
    return;
  const { currentTarget, clientX, clientY } = event;
  const { left, top, width, height } = currentTarget.getBoundingClientRect();
  currentTarget.style.setProperty('--magnet-x', `${(clientX - left - width / 2) * 0.07}px`);
  currentTarget.style.setProperty('--magnet-y', `${(clientY - top - height / 2) * 0.12}px`);
}

function resetPill({ currentTarget }: PointerEvent<HTMLAnchorElement>) {
  currentTarget.style.removeProperty('--magnet-x');
  currentTarget.style.removeProperty('--magnet-y');
}

export function AccountActions({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [login, signup] = ACCOUNT_NAV;
  const session = useAccountSession();
  const active = session.status === 'active';
  const signedOut = session.status === 'signed-out';
  const entry = active ? { href: '/account/', label: 'Account' } : login;
  return (
    <>
      <Link
        href={entry.href}
        className="site-account-link site-login-link"
        aria-label={active ? 'Account' : undefined}
        aria-current={isActive(pathname, entry.href) ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className="site-login-window">
          <span>{entry.label}</span>
          <span aria-hidden="true">{entry.label}</span>
        </span>
      </Link>
      {signedOut && (
        <Link
          href={signup.href}
          className="site-account-link site-signup-link"
          aria-current={isActive(pathname, signup.href) ? 'page' : undefined}
          onClick={onNavigate}
          onPointerMove={movePill}
          onPointerLeave={resetPill}
        >
          <span className="site-signup-pill">{signup.label}</span>
        </Link>
      )}
    </>
  );
}
