import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-metadata';

export default function robots(): MetadataRoute.Robots {
  // Allow crawlers to see noindex on account/UGC pages; do not mistake robots
  // exclusion for an access-control or reliable de-indexing mechanism.
  return { rules: { userAgent: '*', allow: '/', disallow: '/api/' }, sitemap: new URL('/sitemap.xml', siteOrigin()).href };
}
