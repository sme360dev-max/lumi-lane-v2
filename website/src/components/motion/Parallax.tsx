'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Moves its content a few pixels against the scroll, inside a clipped frame.
 * `travel` is the total distance in px; the layer is oversized by the same amount so no edge shows.
 */
export function Parallax({ children, className = '', travel = 40 }: { children: ReactNode; className?: string; travel?: number }) {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = frame.current;
    const layer = element?.firstElementChild;
    if (!element || !layer) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        layer,
        { y: -travel / 2 },
        {
          y: travel / 2,
          ease: 'none',
          scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        },
      );
    });
    return () => media.revert();
  }, [travel]);

  return (
    <div ref={frame} className={`parallax ${className}`.trim()}>
      <div className="parallax-layer">{children}</div>
    </div>
  );
}
