'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';

export function CoffeeClubStepsMotion({ className, children }: { className: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const motion = gsap.context(() => {}, element);
      const steps = element.querySelectorAll('[data-coffee-step]');
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        motion.add(() => gsap.from(steps, {
          opacity: 0.8,
          y: 9,
          duration: 0.52,
          stagger: 0.095,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        }));
      }, { threshold: 0.22 });
      observer.observe(element);
      return () => {
        observer.disconnect();
        motion.revert();
      };
    });

    return () => media.revert();
  }, []);

  return <div ref={root} className={className}>{children}</div>;
}
