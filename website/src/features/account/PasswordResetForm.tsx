'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ctaClass } from '@/components/ui/Button';
import { accountRequest } from '@/lib/api';

export function PasswordResetForm() {
  const [token] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return setNotice('This reset link is missing its token. Request a new link.');
    if (password.length < 8 || password.length > 128) return setNotice('Use a password between 8 and 128 characters.');
    if (password !== confirm) return setNotice('The passwords must match.');
    setBusy(true);
    setNotice('');
    try {
      const result = await accountRequest<{ message: string }>('/api/account/password-reset/confirm/', {
        method: 'POST', body: JSON.stringify({ token, password }),
      }, false);
      setDone(true);
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reset your password.');
    } finally { setBusy(false); }
  };

  return <div className="account-page" data-mode="signup"><div className="account-content"><div className="account-panel">
    <header className="account-intro"><p className="experience-kicker">Lumi Lane account</p><h1>Reset <em>password.</em></h1></header>
    {done ? <><p role="status">{notice}</p><Link href="/login/" className={ctaClass()}>Log in</Link></> : <form className="account-form" onSubmit={submit}>
      <div className="account-field"><label htmlFor="reset-password">New password</label><input id="reset-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
      <div className="account-field"><label htmlFor="reset-confirm">Confirm password</label><input id="reset-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div>
      <button type="submit" className={ctaClass()} disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      <p role="status" className="account-notice">{notice}</p>
    </form>}
  </div></div></div>;
}
