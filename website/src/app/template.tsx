import type { ReactNode } from 'react';
import { RouteCurtain } from '@/components/motion/RouteCurtain';

/** Re-mounted on every navigation, which is what lets the curtain play once per route change. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      <RouteCurtain />
      {children}
    </>
  );
}
