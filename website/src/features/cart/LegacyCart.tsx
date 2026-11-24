'use client';

import { CtaLink } from '@/components/ui/Button';
import { useEffect } from 'react';

export function LegacyCart() {
  useEffect(() => {
    window.location.replace('/menu/#shopping-bag');
  }, []);

  return (
    <div className="site-container cart-legacy">
      <h1>Shopping bag</h1>
      <p>
        <CtaLink variant="editorial" href="/menu/">
          Continue to the menu
        </CtaLink>
      </p>
    </div>
  );
}
