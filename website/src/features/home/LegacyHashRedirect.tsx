'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Old prototype links used hashes (index.html#menu, #menu/bar, #reserve). Send them to the real routes. */
const ROUTES: Record<string, string> = {
  menu: '/menu/',
  about: '/about/',
  visit: '/visit/',
  reserve: '/book/',
  book: '/book/',
};

export function LegacyHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const [name = '', sub] = window.location.hash.slice(1).split('/');
    const target = ROUTES[name];
    if (target) router.replace(name === 'menu' && sub ? `${target}#${sub}` : target);
  }, [router]);
  return null;
}
