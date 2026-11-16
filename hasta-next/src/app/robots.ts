import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/hasta/site';

const robots = (): MetadataRoute.Robots => ({
  rules: { userAgent: '*', allow: '/' },
  sitemap: `${SITE_URL}/sitemap.xml`,
  host: SITE_URL,
});

export default robots;
