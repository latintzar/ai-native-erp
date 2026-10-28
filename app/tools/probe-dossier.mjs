import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileTypeScript, loadTypeScript } from './ts-module.mjs';
const require = createRequire(import.meta.url);
const salePath = compileTypeScript('src/prototypes/cedar/sale.ts', 'probe-dossier-sale');
const castPath = compileTypeScript('src/prototypes/cedar/cedar-cast.ts', 'probe-dossier-cast');
const { buildSales } = require(salePath);
const { cedarCast } = require(castPath);
const { dayForSector } = require(join(dirname(salePath), 'day.js'));
const { CASTS } = require(join(dirname(salePath), '../../scenarios/data/cast.js'));
const seed = loadTypeScript('src/prototypes/cedar/money-seed.ts', 'probe-dossier-seed');
const model = loadTypeScript('src/prototypes/cedar/money-model.ts', 'probe-dossier-model');
const proj = loadTypeScript('src/prototypes/cedar/money-projections.ts', 'probe-dossier-proj');

const scope = 'fish';
const cast = cedarCast(CASTS[scope]);
const sales = buildSales(cast, dayForSector(scope));
console.log('sales', sales.length);
const days = [...new Set(sales.map(s => s.day))].sort();
console.log('day range', days[0], '→', days[days.length-1], 'distinct days', days.length);
console.log('states', JSON.stringify(sales.reduce((a,s)=>{a[s.state]=(a[s.state]||0)+1;return a;},{})));
console.log('messageOnly', sales.filter(s=>s.messageOnly).length, 'archived', sales.filter(s=>s.archived).length);
console.log('customers', new Set(sales.map(s=>s.customer.id)).size);
console.log('owner', cast.owner.name, '| house', JSON.stringify({name: cast.house.name, legalName: cast.house.legalName, taxId: cast.house.taxId, fiscalAddress: cast.house.fiscalAddress, iban: cast.house.iban}));
console.log('sample sale', JSON.stringify({id:sales[0].id, day:sales[0].day, figure:sales[0].figure, state:sales[0].state, lines:sales[0].lines.slice(0,2).map(l=>({n:l.product.name,g:l.given,u:l.unit,p:l.price}))}));
const st = seed.seedMoney(model.emptyMoney(scope), sales, 'https://x.invalid').state;
console.log('invoices', st.invoices.length, 'receipts', st.receipts.length, 'requests', st.requests.length);
const ws = seed.moneyWorkspace(scope);
console.log('referenceAt', ws.referenceAt, 'opening', ws.openingBalanceMinor, 'houseName', ws.houseName);
const now = seed.moneyNow(st);
console.log('moneyNow', now, 'peruDate', model.peruDate(now));
console.log('invoice days', [...new Set(st.invoices.map(i=>i.issuedAt.slice(0,10)))].sort());
console.log('receipt days', [...new Set(st.receipts.map(r=>r.at.slice(0,10)))].sort());
console.log('due days', [...new Set(st.invoices.map(i=>i.dueAt))].sort());
const p = proj.projectMoney(st, sales);
console.log('bankBalanceMinor', p.bankBalanceMinor, 'dailyHistory', JSON.stringify(p.dailyHistory));
const overdue = st.invoices.filter(i=>model.invoiceOverdueDays(st,i.id,now)>0);
console.log('overdue', overdue.length, 'amount', overdue.reduce((s,i)=>s+model.invoiceBalance(st,i.id),0));
console.log('paid', st.invoices.filter(i=>model.invoiceBalance(st,i.id)===0).length);
console.log('requests sent', st.requests.filter(r=>r.sentAt).length);
// weekly sales distribution
const weeks = {};
for (const s of sales) { const d=new Date(s.day+'T12:00:00Z'); const t=new Date(d); t.setUTCDate(t.getUTCDate()+4-(t.getUTCDay()||7)); const y=new Date(Date.UTC(t.getUTCFullYear(),0,1)); const w=Math.ceil(((t-y)/86400000+1)/7); const k=`${t.getUTCFullYear()}-W${String(w).padStart(2,'0')}`; weeks[k]=(weeks[k]||0)+1; }
console.log('weeks', JSON.stringify(weeks));
const wd = {};
for (const s of sales) { wd[new Date(s.day+'T12:00:00Z').getUTCDay()] = (wd[new Date(s.day+'T12:00:00Z').getUTCDay()]||0)+1; }
console.log('weekday counts', JSON.stringify(wd));
const prod = {};
for (const s of sales) for (const l of s.lines) { const k=l.product.name; (prod[k] ||= {n:0,v:0,prices:[]}); prod[k].n++; prod[k].v += l.given*l.price; prod[k].prices.push(l.price); }
const top = Object.entries(prod).sort((a,b)=>b[1].v-a[1].v).slice(0,5);
console.log('top products', JSON.stringify(top.map(([k,v])=>({k, lines:v.n, value:Math.round(v.v), min:Math.min(...v.prices), max:Math.max(...v.prices)}))));
