/** Inventory the locked npm tree and retain installed package licence/notice texts. */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(readFileSync(resolve(root,'app/package-lock.json'),'utf8'));
const packages=[];const notices=[];
for(const [path,entry]of Object.entries(lock.packages)){
  if(!path)continue;
  const packageRoot=resolve(root,'app',path);
  const name=path.slice(path.lastIndexOf('node_modules/')+'node_modules/'.length);
  const metadata={name,version:entry.version,license:entry.license??'See package notices',dev:!!entry.dev,optional:!!entry.optional};
  packages.push(metadata);
  if(!existsSync(packageRoot))continue;
  for(const file of readdirSync(packageRoot).sort()){
    if(!/^(?:licen[cs]e|copying|notice)(?:[.-]|$)/i.test(file))continue;
    const target=resolve(packageRoot,file);
    if(!statSync(target).isFile())continue;
    notices.push(`${name}@${entry.version} — ${file}\n${'='.repeat(72)}\n${readFileSync(target,'utf8')}\n`);
  }
}
packages.sort((a,b)=>a.name.localeCompare(b.name)||String(a.version).localeCompare(String(b.version)));
writeFileSync(resolve(root,'docs/release/npm-dependencies.json'),JSON.stringify({lockfileVersion:lock.lockfileVersion,packages},null,2)+'\n');
writeFileSync(resolve(root,'THIRD-PARTY-NOTICES.txt'),'Installed npm dependency notices. Source packages retain their own terms.\n\n'+notices.join('\n'));
console.log(JSON.stringify({lockedPackages:packages.length,noticeFiles:notices.length}));
