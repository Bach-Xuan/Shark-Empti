import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Profile', description: 'Account-scoped learning history and profile settings.' };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
