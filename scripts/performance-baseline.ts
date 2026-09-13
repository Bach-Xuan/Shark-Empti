import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { calculateDashboardStats } from '../src/lib/stats-utils';
import { translations } from '../src/lib/translations';
import { history } from '../tests/fixtures/quiz';
const rows = [];
for (const size of [100, 1000, 10000]) {
 const dataset = Array.from({length:size}, (_,i) => ({...history,id:String(i)}));
 const loaded = dataset.slice(0,50);
 const measures=[];
 for(let i=0;i<10;i++){const started=performance.now();calculateDashboardStats(dataset,translations.en,'en');measures.push(performance.now()-started);}
 measures.sort((a,b)=>a-b);
 rows.push({records:size, allHistoryProcessingMs:{p50:measures[5],p90:measures[9]}, baselineInitialDocuments:size, pagedInitialDocuments:loaded.length, baselineJsonBytes:Buffer.byteLength(JSON.stringify(dataset)), pagedJsonBytes:Buffer.byteLength(JSON.stringify(loaded))});
}
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/performance.json',JSON.stringify({measuredAt:new Date().toISOString(),node:process.version,platform:process.platform,scope:'synthetic local CPU/JSON/read-cardinality model; not measured Firestore billing, network bytes, heap or browser rendering',rows},null,2));
console.log(rows);
