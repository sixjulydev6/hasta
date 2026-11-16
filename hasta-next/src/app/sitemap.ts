import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/hasta/site';

const sitemap = (): MetadataRoute.Sitemap => [
  { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
];

export default sitemap;
