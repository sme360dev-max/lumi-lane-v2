// Geometry of the V2 hero: a large round tabletop whose centre sits off-screen; plates ride on its rim
// and the whole table turns to bring the selected dish into the featured seat.
// Pure functions only (no DOM), so the maths is unit-tested in tests/unit/hero-table.test.ts.

/** Plates on the table. The 5 hero dishes are laid twice, on opposite halves, like a shared table. */
export const SLOT_COUNT = 10;
/** Degrees between neighbouring plates. */
export const STEP = 360 / SLOT_COUNT;
/** Plate centres sit on this fraction of the table radius. */
export const RING = 0.8;
/** Plate diameter as a fraction of the table radius. */
export const PLATE = 0.46;

/** Angle (deg, clockwise from 12 o'clock) of slot j on the table itself. */
export const slotAngle = (j: number) => j * STEP;

/** Plate centre of slot j in % of the table box (for inline left/top). */
export function slotPosition(j: number): { left: number; top: number } {
  const a = (slotAngle(j) * Math.PI) / 180;
  return {
    left: +(50 + 50 * RING * Math.sin(a)).toFixed(4),
    top: +(50 - 50 * RING * Math.cos(a)).toFixed(4),
  };
}

/** Which dish (0..dishCount-1) sits on slot j. */
export const dishOfSlot = (j: number, dishCount: number) => ((j % dishCount) + dishCount) % dishCount;

/** Table rotation (deg) that puts slot j in the featured seat. Moving to j+1 turns the table anticlockwise. */
export const rotationForSlot = (j: number, featuredAngle: number) => featuredAngle - slotAngle(j);

/**
 * Nearest slot that carries `dish`, measured from `current`. The table never turns more than half a
 * dish cycle, and ties go forward (anticlockwise, the same way "next" turns).
 */
export function nearestSlotForDish(dish: number, current: number, dishCount: number): number {
  const delta = (((dish - current) % dishCount) + dishCount) % dishCount; // 0..dishCount-1 forward
  return delta <= dishCount / 2 ? current + delta : current + delta - dishCount;
}

export type HeroMode = 'split' | 'stacked';

export interface TableLayout {
  mode: HeroMode;
  /** Table centre and radius in px, relative to the hero box. */
  cx: number;
  cy: number;
  r: number;
  /** Screen angle of the featured seat (deg, clockwise from 12 o'clock). */
  featuredAngle: number;
  /** Intro pose: the whole table, centred, before it glides into place. */
  intro: { cx: number; cy: number; scale: number };
}

export interface LayoutInput {
  width: number;
  height: number;
  /** Right edge (split) / bottom edge (stacked) of the text panel, px from the hero's left / top. */
  textRight: number;
  textBottom: number;
  /** Layout chosen by the CSS media query (viewport incl. scrollbar); defaults to modeFor(width, height). */
  mode?: HeroMode;
}

/** Wide screens use the reference's split composition; portrait and small screens stack text over table. */
export const modeFor = (width: number, height: number): HeroMode =>
  width >= 1024 && width / height >= 1.1 ? 'split' : 'stacked';

/** Featured seat sits up-and-left of the table centre on wide screens, straight up when stacked. */
export const SPLIT_ANGLE = -33;
export const STACKED_ANGLE = 0;

/** Same rule as the split media query in hero.css; the component passes the live matchMedia result. */
export const SPLIT_QUERY = '(min-width: 1024px) and (min-aspect-ratio: 11/10)';

export function computeLayout({ width: w, height: h, textRight, textBottom, mode: forced }: LayoutInput): TableLayout {
  const mode = forced ?? modeFor(w, h);
  if (mode === 'split') {
    const margin = 32;
    const plate = Math.min(PLATE * 1.13 * h, 0.48 * w, w - textRight - margin * 2);
    const r = plate / PLATE;
    const a = (SPLIT_ANGLE * Math.PI) / 180;
    const fx = Math.max(0.635 * w, textRight + margin + plate / 2);
    const fy = 0.565 * h;
    const cx = fx - RING * r * Math.sin(a);
    const cy = fy + RING * r * Math.cos(a);
    return { mode, cx, cy, r, featuredAngle: SPLIT_ANGLE, intro: introPose(w, h, r, 0.54) };
  }
  // Stacked: the featured plate is centred under the text; neighbours peek in from both edges.
  const gap = 18;
  const room = h - textBottom - gap - 20;
  const plate = Math.max(100, Math.min(0.68 * w, 0.44 * h, 460, room));
  const r = plate / PLATE;
  const fx = w / 2;
  const fy = textBottom + gap + plate / 2;
  return { mode, cx: fx, cy: fy + RING * r, r, featuredAngle: STACKED_ANGLE, intro: introPose(w, h, r, 0.52) };
}

/** Whole table centred in the hero, sized to fit the smaller side. */
function introPose(w: number, h: number, r: number, cyRatio: number) {
  const fit = (0.88 * Math.min(w, h)) / (2 * r);
  return { cx: w / 2, cy: h * cyRatio, scale: +fit.toFixed(4) };
}
