import type { ReactNode } from 'react';

export function SectionLabel({
  children,
  className = '',
  as: Tag = 'h2',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'p';
}) {
  return <Tag className={`editorial-label ${className}`}>{children}</Tag>;
}
