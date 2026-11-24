'use client';

import Link from 'next/link';
import { ACCOUNT_NAV } from '@/data/navigation';
import { useAccountSession } from '@/features/account/account-session';
import { isActive } from './navStyles';

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
        <span>{entry.label}</span>
      </Link>
      {signedOut && (
        <Link
          href={signup.href}
          className="site-account-link site-signup-link"
          aria-current={isActive(pathname, signup.href) ? 'page' : undefined}
          onClick={onNavigate}
        >
          <span>{signup.label}</span>
        </Link>
      )}
    </>
  );
}
