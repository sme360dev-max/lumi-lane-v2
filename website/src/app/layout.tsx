import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { BUSINESS, SITE_URL } from '@/data/business';
import { ShoppingBag } from '@/features/cart/CartDrawer';
import '@/styles/globals.css';

const DESCRIPTION =
  'Lumi Lane is a modern Australian coffee house and bar in Lightsview, Adelaide. All-day brunch with a Middle Eastern accent, specialty coffee, açai bowls and South Australian wine.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Lumi Lane · Coffee House & Bar', template: '%s · Lumi Lane' },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' }, apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    siteName: 'Lumi Lane',
    title: 'Lumi Lane · Coffee House & Bar',
    description: 'All-day brunch, coffee, açai and evening pours on Fosters Rd, Lightsview SA.',
    url: '/',
    locale: 'en_AU',
    images: [{ url: '/og.jpg', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#241811', width: 'device-width', initialScale: 1 };

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrCoffeeShop',
  name: BUSINESS.name,
  url: `${SITE_URL}/`,
  image: `${SITE_URL}/og.jpg`,
  telephone: BUSINESS.phone.e164,
  servesCuisine: ['Modern Australian', 'Middle Eastern', 'Coffee'],
  address: {
    '@type': 'PostalAddress',
    streetAddress: BUSINESS.address.street,
    addressLocality: BUSINESS.address.locality,
    addressRegion: BUSINESS.address.region,
    postalCode: BUSINESS.address.postcode,
    addressCountry: BUSINESS.address.country,
  },
  openingHoursSpecification: BUSINESS.hours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: h.days,
    opens: h.opens,
    closes: h.closes,
  })),
  sameAs: ['https://www.instagram.com/lumilane.adl/', 'https://www.tiktok.com/@lumi.lane'],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className="scroll-smooth">
      <head>
        <link
          rel="preload"
          href="/fonts/PlayfairDisplay-latin-daeff530.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Archivo-latin-65449f16.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          // Static, build-time JSON from our own data module; "<" is escaped so it cannot close the tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className="font-body antialiased">
        <a
          href="#main"
          className="sr-only z-[60] rounded-sm bg-cocoa px-5 py-3 text-sm text-shell focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <ShoppingBag>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ShoppingBag>
      </body>
    </html>
  );
}
