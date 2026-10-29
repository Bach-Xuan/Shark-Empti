import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Forum', description: 'Public peer-learning discussion. User content is not intended for indexing.' };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
