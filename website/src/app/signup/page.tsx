import type { Metadata } from 'next';
import { AccountPage } from '@/features/account/AccountPage';

export const metadata: Metadata = { title: 'Sign Up', alternates: { canonical: '/signup/' } };

export default function SignupPage() {
  return <AccountPage mode="signup" />;
}
