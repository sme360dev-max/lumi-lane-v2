import { CtaLink } from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';

export default function NotFound() {
  return (
    <PageShell>
      <PageHeader eyebrow="Not found" title="This page has wandered off." emphasis="wandered off.">
        <p>The link may be old. Everything else is right where you left it.</p>
        <CtaLink href="/" variant="editorial">
          <span aria-hidden="true">←</span> Back to Lumi Lane
        </CtaLink>
      </PageHeader>
    </PageShell>
  );
}
