import { CtaLink } from '@/components/ui/Button';
import { BUSINESS } from '@/data/business';
import { MEGA } from '@/data/content';
import { MEGA_COLUMNS } from '@/data/navigation';

interface MegaMenuProps {
  open: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onPanelEnter: () => void;
  onPanelLeave: () => void;
}

export function MegaMenu({ open, onClose, onDismiss, onPanelEnter, onPanelLeave }: MegaMenuProps) {
  return (
    <div className="menu-overview-wrap" data-open={open} inert={!open}>
      <div className="menu-overview-scrim" onClick={onClose} aria-hidden="true" />
      <div
        id="mega"
        role="dialog"
        aria-label="Menu overview"
        className="menu-overview"
        onMouseEnter={onPanelEnter}
        onMouseLeave={onPanelLeave}
        onFocus={onPanelEnter}
      >
        <div className="site-container">
          <div className="overview-heading">
            <div>
              <p className="editorial-label">{MEGA.eyebrow}</p>
              <h2 className="section-title">{MEGA.title}</h2>
            </div>
            <button type="button" className="overview-close" aria-label="Close menu" onClick={onDismiss}>
              ×
            </button>
          </div>
          <ul className="overview-categories">
            {MEGA_COLUMNS.map(({ tab, lines }) => (
              <li key={tab}>
                <CtaLink variant="navigation" href={`/menu/#${tab}`} onClick={onClose}>
                  {lines.join(' ')}
                </CtaLink>
              </li>
            ))}
          </ul>
          <div className="overview-foot">
            <span>{MEGA.hoursLine}</span>
            <a href={BUSINESS.phone.href}>{BUSINESS.phone.display}</a>
            <CtaLink variant="editorial" href="/menu/" onClick={onClose}>
              {MEGA.fullMenuLabel}
            </CtaLink>
          </div>
        </div>
      </div>
    </div>
  );
}
