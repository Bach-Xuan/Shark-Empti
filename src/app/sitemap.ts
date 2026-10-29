import type { MetadataRoute } from 'next';
import { siteOrigin, indexPublicPages } from '@/lib/site-metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  return indexPublicPages() ? ['/', '/about'].map(route => ({ url: new URL(route, siteOrigin()).href })) : [];
}
