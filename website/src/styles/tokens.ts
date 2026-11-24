// Tailwind reads the font stacks defined alongside the local faces in fonts.css.
export const colors = {
  shell: '#FAEDDD',
  olive: '#2C342A',
  ember: '#C45441',
  cocoa: '#1C1814',
  cream: '#DACDB5',
} as const;

export const fontFamily = {
  body: 'var(--font-body)',
  heading: 'var(--font-heading)',
};

/** Shared easing used by page, mega-menu and form transitions. */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
