'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Arch-topped photo frame that opens upward, once, the first time it scrolls into view. */
export function ArchReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.dataset.revealed = 'true';
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The outer box is what gets observed; only the inner frame is clipped, so it is always measurable.
  return (
    <div ref={frame} className={`arch-reveal ${className}`.trim()}>
      <div className="arch-frame">{children}</div>
    </div>
  );
}
