import { HeroSection } from '@/features/home/HeroSection';
import { HomeEditorial } from '@/features/home/HomeEditorial';
import { LegacyHashRedirect } from '@/features/home/LegacyHashRedirect';

export default function HomePage() {
  return (
    <main id="main">
      <LegacyHashRedirect />
      <HeroSection />
      <HomeEditorial />
    </main>
  );
}
