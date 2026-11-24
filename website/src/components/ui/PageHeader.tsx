import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  emphasis?: string;
  tone?: 'cocoa' | 'olive' | 'plum';
  children?: ReactNode;
  image?: ReactNode;
}

export function PageHeader({ eyebrow, title, emphasis, tone = 'cocoa', children, image }: PageHeaderProps) {
  const accentStart = emphasis && title.endsWith(emphasis) ? title.length - emphasis.length : -1;

  return (
    <header className="page-masthead" data-tone={tone} data-illustrated={Boolean(image)}>
      <div className="site-container masthead-grid">
        <div className="masthead-copy">
          <p className="editorial-label">{eyebrow}</p>
          <h1 className="display-title">
            {accentStart < 0 ? (
              title
            ) : (
              <>
                <span className="title-line">
                  <span>{title.slice(0, accentStart).trimEnd()}</span>
                </span>{' '}
                <span className="title-line">
                  <em>{emphasis}</em>
                </span>
              </>
            )}
          </h1>
          {children && <div className="masthead-lede">{children}</div>}
        </div>
        {image && <div className="masthead-visual">{image}</div>}
      </div>
    </header>
  );
}
