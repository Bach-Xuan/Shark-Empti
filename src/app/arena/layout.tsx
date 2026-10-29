import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Arena', description: 'Public learning challenges with server-scored attempts. User content is not intended for indexing.' };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
