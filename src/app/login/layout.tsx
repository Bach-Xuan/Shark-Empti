import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Sign in', description: 'Sign in to access your personal learning records.' };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
