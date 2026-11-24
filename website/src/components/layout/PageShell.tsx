import type { ReactNode } from 'react';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="page-shell">
      {children}
    </main>
  );
}
