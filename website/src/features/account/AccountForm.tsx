'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ctaClass } from '@/components/ui/Button';
import { accountRequest, ApiError } from '@/lib/api';
import { setAccountSession } from './account-session';
import {
  PASSWORD_MINIMUM,
  validateAccount,
  type AccountErrors,
  type AccountField,
  type AccountMode,
} from './validation';

const fieldId = (field: AccountField) => `account-${field}`;

function PasswordField({
  field,
  label,
  autoComplete,
  error,
  hint,
}: {
  field: 'password' | 'confirmPassword';
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = fieldId(field);
  const description = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');

  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <div className="account-password">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={description || undefined}
        />
        <button
          type="button"
          aria-controls={id}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && (
        <p className="account-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="account-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function TextField({ field, label, error }: { field: 'fullName' | 'email'; label: string; error?: string }) {
  const id = fieldId(field);
  const email = field === 'email';
  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={email ? 'email' : 'text'}
        autoComplete={email ? 'email' : 'name'}
        autoCapitalize={email ? 'none' : 'words'}
        spellCheck={!email}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p className="account-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function AccountForm({ mode, children }: { mode: AccountMode; children: ReactNode }) {
  const signup = mode === 'signup';
  const router = useRouter();
  const [errors, setErrors] = useState<AccountErrors>({});
  const [notice, setNotice] = useState('');
  const [formVersion, setFormVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [resetSending, setResetSending] = useState(false);

  const requestReset = async () => {
    setResetSending(true);
    setResetNotice('');
    try {
      const result = await accountRequest<{ message: string }>('/api/account/password-reset/', {
        method: 'POST', body: JSON.stringify({ email: resetEmail }),
      }, false);
      setResetNotice(result.message);
    } catch (error) {
      setResetNotice(error instanceof Error ? error.message : 'Could not request a reset email.');
    } finally { setResetSending(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    // Read by ID so a native submission cannot serialize credentials before hydration.
    const input = (field: AccountField) => form.elements.namedItem(fieldId(field)) as HTMLInputElement | null;
    const values = {
      fullName: input('fullName')?.value ?? '',
      email: input('email')?.value ?? '',
      password: input('password')?.value ?? '',
      confirmPassword: input('confirmPassword')?.value ?? '',
    };
    const next = validateAccount(mode, values);
    const first = Object.keys(next)[0] as AccountField | undefined;
    if (first) {
      flushSync(() => {
        setNotice('');
        setErrors(next);
      });
      input(first)?.focus();
      return;
    }

    setErrors({});
    setNotice('');
    setSubmitting(true);
    try {
      const data = await accountRequest<{ token: string; account: import('./account-session').AccountProfile }>(
        signup ? '/api/account/register/' : '/api/account/login/',
        {
          method: 'POST',
          body: JSON.stringify({ fullName: values.fullName, email: values.email, password: values.password }),
        },
        false,
      );
      setAccountSession(data.token, data.account);
      form.reset();
      setFormVersion((version) => version + 1);
      router.push('/account/');
    } catch (error) {
      if (error instanceof ApiError && error.errors) setErrors(error.errors as AccountErrors);
      setNotice(error instanceof Error ? error.message : 'The request could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <p className="account-mode-note">Your account and account data are saved securely with Lumi Lane.</p>
      <form
        className="account-form"
        noValidate
        onSubmit={submit}
        onChange={(event) => {
          setNotice('');
          const target = event.nativeEvent.target;
          if (!(target instanceof HTMLInputElement)) return;
          const field = target.id.slice('account-'.length) as AccountField;
          if (!errors[field]) return;
          setErrors({ ...errors, [field]: undefined });
        }}
      >
        {signup && <TextField field="fullName" label="Full name" error={errors.fullName} />}
        <TextField field="email" label="Email address" error={errors.email} />
        <PasswordField
          key={`password-${formVersion}`}
          field="password"
          label="Password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          error={errors.password}
          hint={signup ? `Use at least ${PASSWORD_MINIMUM} characters.` : undefined}
        />
        {signup ? (
          <PasswordField
            key={`confirm-${formVersion}`}
            field="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirmPassword}
          />
        ) : (
          <details className="account-recovery">
            <summary>Forgot password?</summary>
            <div className="dashboard-form">
              <label htmlFor="account-reset-email">Email address</label>
              <input id="account-reset-email" type="email" autoComplete="email" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
              <button type="button" className={ctaClass({ variant: 'editorial' })} disabled={resetSending || !resetEmail} onClick={() => void requestReset()}>{resetSending ? 'Sending…' : 'Send reset link'}</button>
              <p role="status">{resetNotice}</p>
            </div>
          </details>
        )}
        <button type="submit" className={ctaClass({ className: 'account-submit' })} disabled={submitting}>
          {submitting ? 'Please wait…' : signup ? 'Create account' : 'Log in'}
        </button>
        <div className="account-notice" role="status">
          {notice}
        </div>
      </form>
      <p className="account-switch">
        {signup ? 'Already have an account?' : 'New to Lumi Lane?'}{' '}
        <Link href={signup ? '/login/' : '/signup/'} className={ctaClass({ variant: 'editorial' })}>
          {signup ? 'Log in' : 'Sign up'}
        </Link>
      </p>
    </>
  );
}
