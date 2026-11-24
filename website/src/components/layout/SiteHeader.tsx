'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { AccountActions } from '@/components/navigation/AccountActions';
import { PrimaryNav } from '@/components/navigation/PrimaryNav';
import { BagIcon } from '@/components/ui/ExperienceIcons';
import { BUSINESS } from '@/data/business';
import { useOpenBag } from '@/features/cart/CartDrawer';
import { countItems, useCart } from '@/features/cart/cart-state';

const subscribeToScroll = (onChange: () => void) => {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
};

/** True once the page has moved under the masthead, which is when its hairline appears. */
const useScrolled = () =>
  useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 4,
    () => false,
  );

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const quantity = countItems(useCart());
  const openBag = useOpenBag();
  const scrolled = useScrolled();

  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="site-header-inner">
        <PrimaryNav />
        <Link href="/" className="site-wordmark" aria-label="Lumi Lane, home">
          <span>LUMI LANE</span>
          <small>{BUSINESS.tagline}</small>
        </Link>
        <nav className="site-header-actions" aria-label="Account and shopping">
          <div className="site-desktop-account">
            <AccountActions pathname={pathname} />
          </div>
          <button
            type="button"
            id="site-bag-trigger"
            className="site-cart-link"
            aria-label={quantity ? `Shopping bag, ${quantity} ${quantity === 1 ? 'item' : 'items'}` : 'Shopping bag'}
            aria-haspopup="dialog"
            aria-controls="shopping-bag"
            onClick={(event) => openBag(event.currentTarget)}
          >
            <BagIcon />
            {quantity > 0 && (
              <span className="lane-bag-count" aria-hidden="true">
                {quantity > 99 ? '99+' : quantity}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
