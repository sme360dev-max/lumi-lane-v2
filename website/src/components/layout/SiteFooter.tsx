import Link from 'next/link';
import { CtaLink, ctaClass } from '@/components/ui/Button';
import { ExternalArrow } from '@/components/ui/ExperienceIcons';
import { BUSINESS, DIRECTIONS_URL } from '@/data/business';
import { FOOTER } from '@/data/content';
import { HEADER_NAV } from '@/data/navigation';
import { SocialIcon } from './SocialIcon';
import { FooterMotion } from './FooterMotion';

const socialNames = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

export function SiteFooter() {
  return (
    <footer className="site-footer" id="site-footer">
      <FooterMotion>
        <div className="site-container">
          <div className="footer-signature">
            <Link href="/" className="footer-wordmark" aria-label="Back to the Lumi Lane homepage">
              <span aria-hidden="true">
                <span>LUMI</span>
              </span>{' '}
              <span aria-hidden="true">
                <span>LANE</span>
              </span>
            </Link>
          </div>
          <div className="footer-directory">
            <div>
              <h2 className="experience-kicker">Find us</h2>
              <address>
                {BUSINESS.address.line1}
                <br />
                {BUSINESS.address.line2}
              </address>
              <a className={ctaClass({ variant: 'editorial' })} href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer">
                Get directions <ExternalArrow />
              </a>
            </div>
            <div>
              <h2 className="experience-kicker">Opening hours</h2>
              <dl className="footer-hours">
                {BUSINESS.hours.map(({ label, time }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{time}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="experience-kicker">Contact</h2>
              <a className={ctaClass({ variant: 'editorial' })} href={BUSINESS.phone.href}>
                {BUSINESS.phone.display}
              </a>
              <small>Listed number · confirm with venue</small>
              <p className="footer-brand-note">{FOOTER.tagline.join(' · ')}</p>
            </div>
          </div>
          <div className="footer-links">
            <nav className="footer-nav" aria-label="Footer">
              {HEADER_NAV.map(({ href, label }) => (
                <CtaLink key={href} href={href} variant="navigation">
                  {label}
                </CtaLink>
              ))}
            </nav>
            <ul className="footer-social" aria-label="Social media">
              {BUSINESS.social.map(({ id, href, label }) => (
                <li key={id}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={socialNames[id]}>
                    <SocialIcon id={id} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-utility">
            <small>
              © {new Date().getFullYear()} {BUSINESS.name}
            </small>
            <details className="footer-policies">
              <summary>Policies &amp; accessibility</summary>
              <p>These documents are currently unavailable online.</p>
              <ul aria-label="Policy documents">
                {BUSINESS.policies.map((policy) => (
                  <li key={policy}>{policy}</li>
                ))}
              </ul>
              <p>
                For venue accessibility information,{' '}
                <a className="footer-policy-link" href={BUSINESS.phone.href}>
                  call Lumi Lane
                </a>
                .
              </p>
            </details>
            <a className={ctaClass({ variant: 'editorial' })} href="#main">
              Back to content <span aria-hidden="true">↑</span>
            </a>
          </div>
        </div>
      </FooterMotion>
    </footer>
  );
}
