/** Public SDK bootstrap is read-only; all application data stays on the
 * configured demo ports. No production Auth/Firestore/AI endpoint is allowed. */
export function allowedVerificationRequest(address: string, method: string, resourceType: string) {
  let url: URL;
  try { url = new URL(address); } catch { return false; }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && ['9002', '8080', '9099'].includes(url.port) && url.protocol === 'http:';
  const publicBootstrap = url.protocol === 'https:' && url.hostname === 'apis.google.com'
    && (url.pathname === '/js/api.js' || url.pathname.startsWith('/_/scs/apps-static/_/js/') || url.pathname.startsWith('/_/scs/abc-static/_/js/'))
    && method === 'GET' && resourceType === 'script';
  return local || publicBootstrap;
}
