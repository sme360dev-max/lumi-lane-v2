'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import styles from './home-editorial.module.css';

/** The real Lumi Lane photographs in /public/assets/img: five dishes and the shopfront. */
const PHOTOS = ['food', 'mezze', 'coffee', 'burger', 'choco', 'storefront'] as const;

/** Three passes over the photo set, so a quick sweep never has to reuse a tile that is still visible. */
const POOL = [...PHOTOS, ...PHOTOS, ...PHOTOS];

/** Cursor trail only where there is a real cursor, room to move, and no reduced-motion request. */
const TRAIL =
  '(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

function Tile({ name }: { name: (typeof PHOTOS)[number] }) {
  return (
    <span className={styles.tile} data-subject={name}>
      <picture>
        <source type="image/avif" srcSet={`/assets/img/${name}-480.avif`} />
        <img src={`/assets/img/${name}-480.webp`} alt="" width={480} height={480} loading="lazy" decoding="async" />
      </picture>
    </span>
  );
}

export function ExploreStage({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [choice, setChoice] = useState<boolean | null>(null);
  // The strip drifts by default, and starts still when the visitor asks for reduced motion.
  const paused = choice ?? reducedMotion;

  // Headline reveal (once) and pausing of everything that moves while the stage is off screen.
  useEffect(() => {
    const stage = frame.current;
    if (!stage) return;
    stage.dataset.reveal = 'pending';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        stage.dataset.offscreen = String(!entry.isIntersecting);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) delete stage.dataset.reveal;
      },
      { threshold: [0, 0.3] },
    );
    observer.observe(stage);
    return () => {
      observer.disconnect();
      delete stage.dataset.reveal;
      delete stage.dataset.offscreen;
    };
  }, []);

  useEffect(() => {
    const stage = frame.current;
    const pool = layer.current;
    if (!stage || !pool) return;
    const media = gsap.matchMedia();

    media.add(TRAIL, () => {
      const tiles = Array.from(pool.children) as HTMLElement[];
      const timelines = new Map<HTMLElement, gsap.core.Timeline>();
      let next = 0;
      let depth = 1;
      let last: { x: number; y: number; at: number } | null = null;

      gsap.set(tiles, { autoAlpha: 0, xPercent: -50, yPercent: -50 });

      const place = (x: number, y: number) => {
        const tile = tiles[next % tiles.length];
        if (!tile) return;
        next += 1;
        timelines.get(tile)?.kill();
        gsap.set(tile, { x, y, zIndex: depth++, rotation: gsap.utils.random(-4, 4), scale: 0.8, autoAlpha: 0 });
        timelines.set(
          tile,
          gsap
            .timeline()
            .to(tile, { autoAlpha: 1, duration: 0.28, ease: 'power1.out' }, 0)
            .to(tile, { scale: 1, duration: 0.9, ease: 'power3.out' }, 0)
            .to(tile, { autoAlpha: 0, scale: 0.95, duration: 1, ease: 'power2.inOut' }, 0.6),
        );
      };

      const onMove = (event: PointerEvent) => {
        if (stage.dataset.offscreen === 'true') return;
        const bounds = stage.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const now = performance.now();
        if (!last) {
          last = { x, y, at: now };
          return;
        }
        // A photo is set down only after the cursor has really travelled, never on a twitch.
        const threshold = Math.min(140, Math.max(92, bounds.width * 0.075));
        if (Math.hypot(x - last.x, y - last.y) < threshold || now - last.at < 70) return;
        last = { x, y, at: now };
        place(x, y);
      };
      const onLeave = () => {
        last = null;
      };

      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerleave', onLeave);
      return () => {
        stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerleave', onLeave);
        timelines.forEach((timeline) => timeline.kill());
        gsap.set(tiles, { clearProps: 'all' });
      };
    });

    return () => media.revert();
  }, []);

  return (
    <div ref={frame} className={styles.stage}>
      <div ref={layer} className={styles.trail} aria-hidden="true">
        {POOL.map((name, index) => (
          <Tile key={index} name={name} />
        ))}
      </div>
      <div className={styles.stageCopy}>{children}</div>
      <div className={styles.strip} data-paused={paused}>
        <div className={styles.stripViewport}>
          <div className={styles.stripTrack} aria-hidden="true">
            {[...PHOTOS, ...PHOTOS].map((name, index) => (
              <Tile key={index} name={name} />
            ))}
          </div>
        </div>
        <button type="button" className={styles.stripToggle} aria-pressed={paused} onClick={() => setChoice(!paused)}>
          {paused ? 'Play photos' : 'Pause photos'}
        </button>
      </div>
    </div>
  );
}
