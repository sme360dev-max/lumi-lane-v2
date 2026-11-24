import { PageShell } from '@/components/layout/PageShell';
import { ResponsivePicture } from '@/components/ui/ResponsivePicture';
import { HERO } from '@/data/content';
import { AccountForm } from './AccountForm';
import type { AccountMode } from './validation';

export function AccountPage({ mode }: { mode: AccountMode }) {
  const signup = mode === 'signup';
  const image = HERO.slides.find(({ image }) => image === (signup ? 'food' : 'coffee'))!;

  return (
    <PageShell>
      <div className="account-page" data-mode={mode}>
        <figure className="account-editorial">
          <ResponsivePicture
            name={image.image}
            widths={[480, 800, 1254]}
            sizes="(max-width: 720px) 100vw, (max-width: 1100px) 760px, 55vw"
            width={1254}
            height={1254}
            alt={image.alt}
            priority
          />
          <figcaption>
            <span className="experience-kicker">Lumi Lane · Coffee House &amp; Bar</span>
            <p>
              {signup ? (
                <>
                  There’s room
                  <br /> <em>at the table.</em>
                </>
              ) : (
                <>
                  A familiar
                  <br /> <em>little ritual.</em>
                </>
              )}
            </p>
          </figcaption>
        </figure>
        <div className="account-content">
          <div className="account-panel">
            <AccountForm mode={mode}>
              <header className="account-intro">
                <p className="experience-kicker">Lumi Lane account</p>
                <h1>
                  {signup ? (
                    <>
                      Sign <em>up.</em>
                    </>
                  ) : (
                    <>
                      Log <em>in.</em>
                    </>
                  )}
                </h1>
              </header>
            </AccountForm>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
