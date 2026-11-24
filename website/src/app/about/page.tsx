import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { AboutView } from '@/features/about/AboutView';

export const metadata: Metadata = {
  title: 'About',
  description: 'A modern Australian coffee house and bar in Lightsview, cooking brunch with a Middle Eastern accent.',
  alternates: { canonical: '/about/' },
};

export default function AboutPage() {
  return (
    <PageShell>
      <AboutView />
    </PageShell>
  );
}
