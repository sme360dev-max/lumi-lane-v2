import type { Metadata } from 'next';
import { AccountPage } from '@/features/account/AccountPage';

export const metadata: Metadata = { title: 'Log In', alternates: { canonical: '/login/' } };

export default function LoginPage() {
  return <AccountPage mode="login" />;
}
