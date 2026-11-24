import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { PasswordResetForm } from '@/features/account/PasswordResetForm';

export const metadata: Metadata = { title: 'Reset Password', robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <PageShell><PasswordResetForm /></PageShell>;
}
