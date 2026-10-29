import { siteOrigin } from '@/lib/site-metadata';

export function GET() {
  const origin = siteOrigin().origin;
  return new Response(`# Shark Empti\n\nAI-assisted learning support. Public overview: ${origin}/about\n\nOnly stable public information is listed here. Account data, learning records, Forum posts and Arena content are not intended for indexing or model ingestion. Respect robots directives and page-level noindex. AI feedback and camera estimates are not independently validated educational or attention assessments.\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
