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
 const response=await fetch(origin+'/api/arena/smoke/submit',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 if(response.status!==401)throw new Error('Unauthenticated API expected 401, got '+response.status);
 fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/production-smoke.json',JSON.stringify({measuredAt:new Date().toISOString(),node:process.version,routes,unauthenticatedApi:401},null,2));
 if(fs.existsSync('config/bundle-budgets.json')) {
 const budgets=JSON.parse(fs.readFileSync('config/bundle-budgets.json','utf8'));
 for(const route of routes) if(route.initialScriptGzip > budgets.routes[route.route]) throw new Error('Bundle budget exceeded: '+route.route);
 }
 console.log('Production HTTP smoke passed: '+routes.length+' routes, static chunks, no remote fonts, API authentication.');
} finally { server.kill(); }
