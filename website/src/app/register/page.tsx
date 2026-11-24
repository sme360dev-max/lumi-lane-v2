import type { Metadata } from 'next';
import { AccountPage } from '@/features/account/AccountPage';

export const metadata: Metadata = { title: 'Sign Up', alternates: { canonical: '/signup/' } };

export default function RegisterPage() {
  return <AccountPage mode="signup" />;
}
