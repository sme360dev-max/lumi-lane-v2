import Link from 'next/link';
import type { ComponentProps } from 'react';

type CtaVariant = 'editorial' | 'primary' | 'navigation';

interface CtaStyle {
  variant?: CtaVariant;
  compact?: boolean;
  className?: string;
}

export const ctaClass = ({ variant = 'primary', compact = false, className = '' }: CtaStyle = {}) =>
  `cta cta--${variant}${compact ? ' cta--compact' : ''} ${className}`.trim();

export function CtaLink({ variant, compact, className, ...props }: CtaStyle & ComponentProps<typeof Link>) {
  return <Link className={ctaClass({ variant, compact, className })} {...props} />;
}
