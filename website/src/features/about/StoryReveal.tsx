'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';

export function StoryReveal({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = gsap.context(() => {}, element);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        animation.add(() => {
          gsap.from(element, {
            y: 14,
            opacity: 0.75,
            duration: 0.65,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
          });
        });
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      animation.revert();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
