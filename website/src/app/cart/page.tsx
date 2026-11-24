import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { LegacyCart } from '@/features/cart/LegacyCart';

export const metadata: Metadata = {
  title: 'Shopping Bag',
  alternates: { canonical: '/menu/' },
  robots: { index: false },
};

export default function CartPage() {
  return (
    <PageShell>
      <LegacyCart />
    </PageShell>
  );
}
