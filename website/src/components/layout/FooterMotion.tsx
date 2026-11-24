'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function FooterMotion({ children }: { children: ReactNode }) {
  const curtain = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = curtain.current;
    const footer = layer?.parentElement;
    if (!layer || !footer) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        layer,
        { y: () => -Math.min(115, window.innerHeight * 0.13) },
        {
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: footer,
            start: 'top bottom',
            end: () => `+=${Math.min(window.innerHeight * 0.42, footer.offsetHeight * 0.75)}`,
            scrub: 0.18,
            invalidateOnRefresh: true,
          },
        },
      );
    });
    return () => media.revert();
  }, []);

  return (
    <div ref={curtain} className="footer-curtain">
      {children}
    </div>
  );
}
