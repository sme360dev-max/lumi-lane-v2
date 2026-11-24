const icons = {
  overview: 'M3 10l9-7 9 7v10H3z M9 20v-6h6v6',
  orders: 'M6 8h12l2 12H4z M9 10V6a3 3 0 1 1 6 0v4',
  history: 'M8 4h8l4 4v12H4V4z M15 4v5h5 M8 13h8 M8 16h6',
  rewards: 'M4 11h16v9H4z M3 7h18v4H3z M12 7v13 M12 7H8a2 2 0 1 1 2-2z M12 7h4a2 2 0 1 0-2-2z',
  reservations: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14h3 M13 14h3',
  profile: 'M5 20v-2a7 7 0 0 1 14 0v2 M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  favorites: 'M12 20.4 4.7 13a4.5 4.5 0 0 1 6.4-6.4l.9.9.9-.9a4.5 4.5 0 0 1 6.4 6.4z',
  preferences: 'M3 6h18 M3 12h18 M3 18h18 M8 3v6 M16 9v6 M10 15v6',
  support: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2 M12 17h.01',
  exit: 'M11 4H4v16h7 M9 12h12 M17 8l4 4-4 4',
};

export type AccountIconName = keyof typeof icons;

export function AccountIcon({ name }: { name: AccountIconName }) {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d={icons[name]} stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
