import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
const port = 9102;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','-p',String(port),'-H','127.0.0.1'], { stdio: ['ignore','pipe','pipe'], windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED:'1' } });
let exited = false; server.once('exit', () => { exited = true; });
server.stdout.resume(); server.stderr.resume();
const origin = 'http://127.0.0.1:' + port;
try {
 let ready = false;
 for (let i=0;i<60;i++) { if(exited) throw new Error('Production server exited before readiness'); try { if((await fetch(origin+'/login')).ok) { ready = true; break; } } catch {} await new Promise(r=>setTimeout(r,500)); }
 if(!ready) throw new Error('Production readiness timeout');
 const routes=[];
 for(const route of ['/','/login','/register','/forum','/arena','/profile']) {
  const samples=[];let html='';
  for(let i=0;i<3;i++){const started=performance.now();const response=await fetch(origin+route);html=await response.text();if(!response.ok)throw new Error(route+' HTTP '+response.status);samples.push(performance.now()-started);}
  if(!html.includes('Shark Empti') && !html.includes('SHARK EMPTI'))throw new Error('Missing shell on '+route);
  if(/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html))throw new Error('Remote font request');
  const scripts=[...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match=>match[1]))];
  const chunks=[];
  for(const url of scripts){const response=await fetch(origin+url);if(!response.ok)throw new Error('Missing chunk');const bytes=Buffer.from(await response.arrayBuffer());chunks.push({url,decoded:bytes.length,gzip:gzipSync(bytes).length});}
  routes.push({route, serverResponseMs:samples, scope:'server HTML and script fetch only; no hydration or browser timing', initialScriptDecoded:chunks.reduce((n,c)=>n+c.decoded,0), initialScriptGzip:chunks.reduce((n,c)=>n+c.gzip,0),chunks});
 }
 const metadataEvidence = {};
 const meta = (html, name) => html.match(new RegExp('<meta[^>]*(?:name|property)="'+name+'"[^>]*content="([^"]*)"'))?.[1] ?? '';
 for (const route of ['/', '/about']) {
  const html = await (await fetch(origin + route)).text();
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  if (!canonical || new URL(canonical).pathname !== route || meta(html, 'description').length < 40 || !html.includes('<main')) throw new Error('Public HTML/metadata contract failed: '+route);
  const image = meta(html, 'og:image');
  if (!image) throw new Error('Missing social image: '+route);
  const imagePath = new URL(image).pathname;
  const response = await fetch(origin + imagePath);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || !response.headers.get('content-type')?.includes('image/png') || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Social PNG response failed.');
  if (route === '/about') {
   const source = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
   if (!source || JSON.parse(source)['@type'] !== 'SoftwareApplication') throw new Error('Missing truthful application JSON-LD.');
  }
  metadataEvidence[route] = { meaningfulMain: true, description: true, canonicalPath: route, socialPng: true, structuredData: route === '/about' };
 }
 for (const route of ['/login','/register','/forum','/arena','/profile','/moderation','/privacy','/terms','/community','/account/data']) {
  const html = await (await fetch(origin + route)).text();
  if (!/\bnoindex\b/.test(meta(html, 'robots'))) throw new Error('Private/UGC noindex missing: '+route);
 }
 for (const route of ['/__missing-audit-page','/forum/unknown/extra','/.env','/src/app/page.tsx','/.next/server/app/page.js']) {
  const response = await fetch(origin + route); const html = await response.text();
  if (response.status !== 404 || !/\bnoindex\b/.test(meta(html, 'robots')) || !html.includes('href="/"')) throw new Error('Safe 404/source boundary failed: '+route);
 }
 const robots = await (await fetch(origin+'/robots.txt')).text();
 if (!/User-agent:\s*\*/i.test(robots) || !/Disallow:\s*\/api\//i.test(robots) || /^Disallow:\s*\/\s*$/mi.test(robots)) throw new Error('Crawler policy failed.');
 const sitemap = await (await fetch(origin+'/sitemap.xml')).text();
 if (!sitemap.includes('<urlset') || [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].some(match => !['/','/about'].includes(new URL(match[1]).pathname))) throw new Error('Sitemap exposes an unsupported route.');
 const llms = await fetch(origin+'/llms.txt');
 if (!llms.ok || !llms.headers.get('content-type')?.includes('text/plain')) throw new Error('Optional llms guidance is not exposed as text.');
 const maps = fs.readdirSync('.next/static', { recursive: true }).filter(file => file.endsWith('.map'));
 if (maps.length) throw new Error('Unexpected public production source map artifacts.');
 const unauthenticatedApis={};
 for(const api of ['/api/arena/smoke/submit','/api/ai/generations','/api/forum','/api/account/export','/api/account/requests','/api/account/consent','/api/account/jobs','/api/community/reports','/api/community/moderation']) {
  const response=await fetch(origin+api,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  if(response.status!==401)throw new Error('Unauthenticated API expected 401 for '+api+', got '+response.status);
  unauthenticatedApis[api]=response.status;
 }
 const consentStatus = await fetch(origin + '/api/account/consent');
 if (consentStatus.status !== 401) throw new Error('Unauthenticated consent status expected 401.');
 unauthenticatedApis['GET /api/account/consent'] = consentStatus.status;
 for (const api of ['/api/account/jobs', '/api/account/jobs/00000000-0000-4000-8000-000000000001', '/api/community/moderation']) {
  const response = await fetch(origin + api);
  if (response.status !== 401) throw new Error('Unauthenticated GET expected 401: ' + api);
  unauthenticatedApis['GET ' + api] = response.status;
 }
 const malformedReceipt = await fetch(origin + '/api/account/jobs/00000000-0000-4000-8000-000000000001', { headers: { 'X-Deletion-Receipt': 'invalid' } });
 if (malformedReceipt.status !== 404) throw new Error('Malformed receipt must fail before server data access.');
 unauthenticatedApis['GET malformed receipt'] = malformedReceipt.status;
 for (const method of ['PUT', 'PATCH']) {
  const path = '/api/learning/history/00000000-0000-4000-8000-000000000001';
  const response = await fetch(origin + path, { method, headers: { 'content-type': 'application/json' }, body: '{}' });
  if (response.status !== 401) throw new Error('Unauthenticated learning write expected 401: ' + method);
  unauthenticatedApis[method + ' ' + path] = response.status;
 }
 fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/production-smoke.json',JSON.stringify({measuredAt:new Date().toISOString(),node:process.version,routes,metadataEvidence,publicSourceMaps:maps.length,crawlerPolicy:true,safe404:true,unauthenticatedApis},null,2));
 if(fs.existsSync('config/bundle-budgets.json')) {
 const budgets=JSON.parse(fs.readFileSync('config/bundle-budgets.json','utf8'));
 for(const route of routes) if(route.initialScriptGzip > budgets.routes[route.route]) throw new Error('Bundle budget exceeded: '+route.route);
 }
 console.log('Production HTTP smoke passed: '+routes.length+' route budgets, public metadata/PNG/JSON-LD, crawler/noindex policy, safe 404/source boundaries, no public source maps and API authentication.');
} finally { server.kill(); }
