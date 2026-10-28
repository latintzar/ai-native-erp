import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript } from './ts-module.mjs';
const require = createRequire(import.meta.url);
const salePath = compileTypeScript('src/prototypes/cedar/sale.ts', 'probe-dossier-sale');
const castPath = compileTypeScript('src/prototypes/cedar/cedar-cast.ts', 'probe-dossier-cast');
const { buildSales } = require(salePath);
const { cedarCast } = require(castPath);
const { dayForSector } = require(join(dirname(salePath), 'day.js'));
const { CASTS } = require(join(dirname(salePath), '../../scenarios/data/cast.js'));
for (const scope of ['fish','meat','fruit']) {
  const cast = cedarCast(CASTS[scope]);
  const sales = buildSales(cast, dayForSector(scope));
  const prod = {};
  for (const s of sales) for (const l of s.lines) { const k=l.product.name; (prod[k] ||= {n:0,v:0,prices:new Set()}); prod[k].n++; prod[k].v += l.given*l.price; prod[k].prices.add(l.price); }
  const varied = Object.entries(prod).filter(([,v])=>v.prices.size>1);
  console.log(scope, 'sales', sales.length, 'products', Object.keys(prod).length, 'with price variation', varied.length);
  console.log('  ', varied.slice(0,5).map(([k,v])=>`${k}: ${[...v.prices].sort((a,b)=>a-b).join('/')}`).join(' | '));
  const top3 = Object.entries(prod).sort((a,b)=>b[1].v-a[1].v).slice(0,3);
  console.log('  top3', top3.map(([k,v])=>`${k} v=${Math.round(v.v)} prices=${[...v.prices].length}`).join(' | '));
  console.log('  disputed', sales.filter(s=>s.state==='disputed').length, 'request', sales.filter(s=>s.state==='request').length, 'days', [...new Set(sales.map(s=>s.day))].sort().join(','));
  const fig = sales[0]; const sum = fig.lines.reduce((a,l)=>a+l.given*l.price,0);
  console.log('  figure check', fig.figure, 'vs lines', Math.round(sum*100)/100);
}
