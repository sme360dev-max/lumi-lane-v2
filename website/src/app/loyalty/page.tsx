import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { CoffeeClubDetails, CoffeeClubGuide } from '@/features/loyalty/CoffeeClubGuide';
import { LoyaltyStatus } from '@/features/loyalty/LoyaltyStatus';

export const metadata: Metadata = {
  title: 'Loyalty',
  description: 'Explore Lumi Lane account rewards and track your current points.',
  alternates: { canonical: '/loyalty/' },
};

export default function LoyaltyPage() {
  return (
    <PageShell>
      <CoffeeClubGuide />
      <LoyaltyStatus />
      <CoffeeClubDetails />
    </PageShell>
  );
}
