import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { VisitView } from '@/features/visit/VisitView';

export const metadata: Metadata = {
  title: 'Visit Us',
  description:
    'Shop 9, 163/169 Fosters Rd, Lightsview SA 5085. Open 7:00am to 4:00pm Monday to Saturday, 8:00am to 4:00pm Sunday.',
  alternates: { canonical: '/visit/' },
};

export default function VisitPage() {
  return (
    <PageShell>
      <VisitView />
    </PageShell>
  );
}
