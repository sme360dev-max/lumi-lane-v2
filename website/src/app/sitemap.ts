import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/data/business';

export const dynamic = 'force-static';

const ROUTES = ['/', '/menu/', '/about/', '/visit/', '/book/'];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.8,
  }));
}
