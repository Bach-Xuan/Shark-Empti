import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

function contentSecurityPolicy(nonce: string) {
  const development = process.env.NODE_ENV === 'development';
  const demo = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith('demo-');
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  // Accept a hostname only. Configuration must never add another CSP source.
  const authFrame = authDomain && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(authDomain)
    ? 'https://' + authDomain : '';
  const connections = demo
    ? 'http://127.0.0.1:9099 http://127.0.0.1:8080'
    : 'https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://apis.google.com/js/api.js https://apis.google.com/_/scs/${development ? " 'unsafe-eval'" : ''}`,
    `connect-src 'self' ${connections}${development ? ' ws://localhost:9002 ws://127.0.0.1:9002' : ''}`,
    `frame-src 'self' ${demo ? 'http://127.0.0.1:9099' : authFrame}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64');
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  headers.set('x-nonce', nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    '/((?!api/|_next/|fonts/|models/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|llms\\.txt$|opengraph-image$).*)',
    // Direct navigation to a missing resource can render the interactive 404.
    { source: '/:directory(api|fonts|models)/:path*', has: [{ type: 'header', key: 'accept', value: '.*text/html.*' }] },
  ],
};
