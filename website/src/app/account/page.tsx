import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { DemoAccountView } from '@/features/account/DemoAccountView';

export const metadata: Metadata = { title: 'My Account', robots: { index: false } };

export default function DemoAccountPage() {
  return (
    <PageShell>
      <DemoAccountView />
    </PageShell>
  );
}
