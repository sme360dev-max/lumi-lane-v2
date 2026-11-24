'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ctaClass } from '@/components/ui/Button';
import { accountRequest } from '@/lib/api';

type Props = { compact?: boolean };

export function PasswordResetForm({ compact = false }: Props) {
  const [step, setStep] = useState<'email' | 'verify' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const result = await accountRequest<{ message: string }>('/api/account/password-reset/', {
        method: 'POST', body: JSON.stringify({ email }),
      }, false);
      setNotice(result.message);
      setStep('verify');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not request a reset code.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setNotice('Enter the six-digit code from your email.');
    if (password.length < 8 || password.length > 128) return setNotice('Use a password between 8 and 128 characters.');
    if (password !== confirm) return setNotice('The passwords must match.');
    setBusy(true);
    setNotice('');
    try {
      const result = await accountRequest<{ message: string }>('/api/account/password-reset/confirm/', {
        method: 'POST', body: JSON.stringify({ email, code, password }),
      }, false);
      setNotice(result.message);
      setStep('done');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setBusy(true);
    setNotice('');
    try {
      const result = await accountRequest<{ message: string }>('/api/account/password-reset/', {
        method: 'POST', body: JSON.stringify({ email }),
      }, false);
      setNotice(result.message);
      setCode('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`password-reset-flow${compact ? ' is-compact' : ''}`} aria-label="Reset your password">
      {!compact && step !== 'done' && (
        <header className="password-reset-heading">
          <p className="experience-kicker">Lumi Lane account</p>
          <h1>Reset <em>password.</em></h1>
          <p>We’ll email you a one-time code to verify it’s you.</p>
        </header>
      )}

      {step === 'email' && (
        <form className="password-reset-form" onSubmit={requestCode}>
          <div className="password-reset-field">
            <label htmlFor="reset-email">Email address</label>
            <input id="reset-email" type="email" autoComplete="email" autoCapitalize="none" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <small>Enter the email you used for your Lumi Lane account.</small>
          </div>
          <button type="submit" className={ctaClass({ variant: 'editorial' })} disabled={busy}>
            {busy ? 'Sending code…' : 'Email me a reset code'}
          </button>
          <p className="password-reset-notice" role="status">{notice}</p>
        </form>
      )}

      {step === 'verify' && (
        <form className="password-reset-form" onSubmit={resetPassword}>
          <p className="password-reset-sent">If <strong>{email}</strong> is registered, a six-digit code is on its way. It expires in 10 minutes.</p>
          <div className="password-reset-field">
            <label htmlFor="reset-code">Email code</label>
            <input id="reset-code" className="password-reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
          </div>
          <div className="password-reset-field">
            <label htmlFor="reset-new-password">New password</label>
            <input id="reset-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <small>Use 8 to 128 characters.</small>
          </div>
          <div className="password-reset-field">
            <label htmlFor="reset-confirm-password">Confirm new password</label>
            <input id="reset-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </div>
          <button type="submit" className={ctaClass({ variant: 'editorial' })} disabled={busy}>
            {busy ? 'Updating password…' : 'Set new password'}
          </button>
          <div className="password-reset-actions">
            <button type="button" onClick={() => { setStep('email'); setNotice(''); }} disabled={busy}>Change email</button>
            <button type="button" onClick={() => void resendCode()} disabled={busy}>{busy ? 'Sending…' : 'Send a new code'}</button>
          </div>
          <p className="password-reset-notice" role="status">{notice}</p>
        </form>
      )}

      {step === 'done' && (
        <div className="password-reset-complete">
          <p className="experience-kicker">Password updated</p>
          <h2>You’re all <em>set.</em></h2>
          <p role="status">{notice}</p>
          <Link href="/login/" className={ctaClass({ variant: 'editorial' })}>Return to log in</Link>
        </div>
      )}
    </section>
  );
}
