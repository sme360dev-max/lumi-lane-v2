'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';

export function HomeEditorialMotion({ className, children }: { className?: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const motion = gsap.context(() => {}, element);
      const observer = new IntersectionObserver(
        (entries) => {
          const entering = entries.filter(({ isIntersecting }) => isIntersecting).map(({ target }) => target);
          if (!entering.length) return;
          for (const target of entering) observer.unobserve(target);
          motion.add(() => {
            gsap.from(entering, {
              y: 12,
              opacity: 0.78,
              duration: 0.56,
              stagger: 0.075,
              ease: 'power2.out',
              clearProps: 'transform,opacity',
            });
          });
        },
        { threshold: 0.18 },
      );
      element.querySelectorAll('[data-home-reveal]').forEach((item) => observer.observe(item));

      return () => {
        observer.disconnect();
        motion.revert();
      };
    });
    return () => media.revert();
  }, []);

  return <div ref={root} className={className}>{children}</div>;
}
