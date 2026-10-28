#!/usr/bin/env python3
"""Record scoped E181 kit proof only after every named candidate drive passes."""
import json,re,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];checks=Path(sys.argv[1]);spec=R/'specs/taskgraph/v1/evidence.json'
suites={
 '181-workspace':['OBJ-01.01','CAT-01.03','SRC-01.02','UTL-04.01'],
 '148-customer':['CUS-01.01','CUS-01.02'],
 '176-edges':['PRD-01.01','PRD-01.07','CAT-01.01'],
 '176-sheet':['PRD-01.01','PRD-01.02','PRD-01.04'],
 '178-catalogue':['CAT-01.03','SRC-01.02'],
 '178-connected':['OBJ-01.01','CUS-01.01'],
 '180-phone-stock':['UTL-01.01','PRD-01.04'],
 '180-price-journey':['COM-01.01','ADM-01.01'],
 '158-notes':['ALB-01.03','CAT-01.02'],
 '163-catalogue-export':['CAT-01.01'],
 '180-paper-review':['ALB-01.03','DOC-01.03'],
 '181-email-privacy':['SRC-01.01','SRC-01.02','CAT-01.01'],
}
rows=[]
for suite,ids in suites.items():
 text=(checks/suite/'drive.log').read_text()
 total=re.findall(r'TOTAL (\d+) (?:GREEN|PASS)',text)
 if not total or re.search(r'^(RED |Traceback)',text,re.M):raise SystemExit('Unaccepted drive: '+suite)
 rows.append((suite,int(total[-1]),ids))
book=json.loads(spec.read_text());book['kitEvidence']=[x for x in book['kitEvidence'] if x.get('release')!='E181']
for suite,count,ids in rows:
 for task in ids:
  book['kitEvidence'].append({'taskId':task,'source':'drives/drive-'+suite+'.py','release':'E181','scope':'Isolated synthetic English-kit browser journey at desktop/phone sizes; no production authorization, provider send, ERP, durable server command or physical-print acceptance. See RELEASE-181 for the exact tested surfaces and remaining boundaries.','result':f'{count} passing checks on the combined E181 candidate; no failed checks or uncaught errors in this drive.'})
book['kitEvidence'].append({'taskId':'COM-01.01','source':'drives/drive-181-units-domain.cjs','release':'E181','scope':'In-memory unit store only: exact/inverse/chained factors, nominal/catch-weight null factors, exact SKU isolation, custom kind reload, revision conflict and failed local persistence. Not server-side unit/stock/price acceptance.','result':'35 passing domain checks.'})
spec.write_text(json.dumps(book,indent=2)+'\n')
report=R/'notes/RELEASE-181.md';s=report.read_text();heading='## Final candidate verification';s=s.split('\n'+heading)[0]
s+='\n'+heading+'\n\n| Journey | Passing checks |\n|---|---:|\n'+'\n'.join(f'| `{suite}` | {count} |' for suite,count,_ in rows)+'\n\n'+f'Total: **{sum(count for _,count,_ in rows)} browser checks**, plus **35 unit-domain checks**. These are synthetic kit checks, not production completion.\n'
report.write_text(s)
print(json.dumps({'suites':len(rows),'checks':sum(count for _,count,_ in rows),'domain':35}))
