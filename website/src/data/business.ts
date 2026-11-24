// Venue facts exactly as published in the original prototype.
// UNVERIFIED: the prototype carries the note "VERIFY LUMI LANE PHONE NUMBER WITH VENUE BEFORE LAUNCH".
export const SITE_URL = 'https://lumi-lane.vercel.app';

export const BUSINESS = {
  name: 'Lumi Lane',
  tagline: 'Coffee House & Bar',
  address: {
    line1: 'Shop 9, 163/169 Fosters Rd,',
    line2: 'Lightsview SA 5085',
    street: 'Shop 9, 163/169 Fosters Rd',
    locality: 'Lightsview',
    region: 'SA',
    postcode: '5085',
    country: 'AU',
  },
  phone: { display: '0405 555 442', href: 'tel:0405555442', e164: '+61405555442' },
  instagramHandle: '@lumilane.adl',
  hours: [
    {
      label: 'Monday to Saturday',
      time: '7:00am to 4:00pm',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '07:00',
      closes: '16:00',
    },
    { label: 'Sunday', time: '8:00am to 4:00pm', days: ['Sunday'], opens: '08:00', closes: '16:00' },
  ],
  social: [
    { id: 'instagram', label: 'Lumi Lane on Instagram', href: 'https://www.instagram.com/lumilane.adl/?hl=en' },
    { id: 'tiktok', label: 'Lumi Lane on TikTok', href: 'https://www.tiktok.com/@lumi.lane' },
    {
      id: 'facebook',
      label: 'Lumi Lane on Facebook',
      href: 'https://www.facebook.com/profile.php?id=61562074355905&mibextid=LQQJ4d',
    },
  ],
  /** Listed in the original footer but linked to "#" — no policy pages exist yet. */
  policies: ['Terms & Conditions', 'Refund Policy', 'Privacy Policy', 'Accessibility Statement'],
} as const;

export const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${BUSINESS.address.street}, ${BUSINESS.address.line2}, Australia`,
)}`;

export type SocialId = (typeof BUSINESS.social)[number]['id'];
