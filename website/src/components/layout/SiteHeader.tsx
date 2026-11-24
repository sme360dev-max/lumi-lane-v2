'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountActions } from '@/components/navigation/AccountActions';
import { PrimaryNav } from '@/components/navigation/PrimaryNav';
import { BagIcon } from '@/components/ui/ExperienceIcons';
import { useOpenBag } from '@/features/cart/CartDrawer';
import { countItems, useCart } from '@/features/cart/cart-state';

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const quantity = countItems(useCart());
  const openBag = useOpenBag();

  return (
    <header className="site-header" data-home={pathname === '/'}>
      <div className="site-header-inner">
        <Link href="/" className="site-wordmark" aria-label="Lumi Lane, home">
          <span>LUMI LANE</span>
          <small>Coffee House &amp; Bar</small>
        </Link>
        <PrimaryNav />
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
