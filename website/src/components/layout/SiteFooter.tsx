import Link from 'next/link';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { BUSINESS, DIRECTIONS_URL } from '@/data/business';
import { HEADER_NAV } from '@/data/navigation';
import { SocialIcon } from './SocialIcon';
import { FooterMotion } from './FooterMotion';

const socialNames = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

/** "7:00am Monday to Saturday, 8:00am Sunday", read straight from the published hours. */
const OPENS = BUSINESS.hours.map(({ label, time }) => `${time.split(' to ')[0]} ${label}`).join(', ');

export function SiteFooter() {
  return (
    <footer className="site-footer" id="site-footer">
      <FooterMotion>
        <span className="footer-hairline" aria-hidden="true" />
        <div className="site-container footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              {/* Sits in the empty side of the brand block, so it can never cover text or links. */}
              <div className="footer-drift" aria-hidden="true">
                <ResponsivePicture name="coffee" widths={[480]} sizes="208px" width={480} height={480} alt="" />
                <ResponsivePicture name="choco" widths={[480]} sizes="128px" width={480} height={480} alt="" />
              </div>
              <Link href="/" className="footer-wordmark" aria-label="Back to the Lumi Lane homepage">
                LUMI LANE
              </Link>
              <p className="footer-wordmark-sub">{BUSINESS.tagline}</p>
              <p className="footer-tagline">
                A coffee house <em>with a long table.</em>
              </p>
              <p className="footer-open">Open from {OPENS}.</p>
              <span className="footer-rule" aria-hidden="true" />
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

            <nav className="footer-nav" aria-label="Footer">
              <h2>Explore</h2>
              <ul>
                {HEADER_NAV.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="footer-link">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="footer-visit">
              <h2>Visit</h2>
              <address>
                {BUSINESS.address.line1}
                <br />
                {BUSINESS.address.line2}
              </address>
              <dl className="footer-hours">
                {BUSINESS.hours.map(({ label, time }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{time}</dd>
                  </div>
                ))}
              </dl>
              <p className="footer-phone">
                <a className="footer-link" href={BUSINESS.phone.href}>
                  {BUSINESS.phone.display}
                </a>
                <small>Listed number · confirm with venue</small>
              </p>
              <a className="footer-link footer-directions" href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer">
                Get directions
              </a>
            </div>
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
            <a className="footer-link footer-top" href="#main">
              Back to top
            </a>
          </div>
        </div>
      </FooterMotion>
    </footer>
  );
}
