import { privateMetadata } from '@/lib/site-metadata';
export const metadata = { ...privateMetadata, title: 'Moderation', description: 'Authorized community moderation console.' };
export default function ModerationLayout({ children }: { children: React.ReactNode }) { return children; }
