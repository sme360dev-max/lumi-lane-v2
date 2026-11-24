import type { Metadata } from 'next';
import { CtaLink } from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { MENU_PAGE } from '@/data/content';
import { MenuTabs } from '@/features/menu/MenuTabs';

export const metadata: Metadata = {
  title: 'Menu',
  description: 'All-day brunch, açai bowls, coffee and drinks, and the Lumi Lane bar list with prices.',
  alternates: { canonical: '/menu/' },
};

export default function MenuPage() {
  return (
    <PageShell>
      <div className="lane-page lane-menu">
        <div className="site-container">
          <header className="lane-menu-intro">
            <h1 className="lane-title">
              The <em>menu.</em>
            </h1>
            <p>{MENU_PAGE.intro}</p>
          </header>
          <MenuTabs />
          <aside className="lane-menu-end">
            <div>
              <h2>{MENU_PAGE.ctaTitle}</h2>
              <p>{MENU_PAGE.ctaText}</p>
            </div>
            <CtaLink href="/book/">
              {MENU_PAGE.ctaLabel}
            </CtaLink>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
