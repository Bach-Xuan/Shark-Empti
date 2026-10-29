import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Join', description: 'Create a learning account with Google sign-in.' };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
