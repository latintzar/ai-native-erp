#!/usr/bin/env python3
"""Reconcile E181 into canonical owners, preserving stable production tasks and status."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
def edit(path,pairs):
 p=R/path;s=p.read_text()
 for a,b in pairs:
  if a in s:s=s.replace(a,b)
  elif b not in s:raise ValueError(path+': '+a[:80])
 p.write_text(s)
def append(path,heading,body):
 p=R/path;s=p.read_text()
 if heading not in s:p.write_text(s.rstrip()+'\n\n'+heading+'\n\n'+body.strip()+'\n')
privacy='Raw inbound email bodies and incoming file bytes are transient only in Rocoto. Original custody stays with the provider/user. Rocoto persists authorized source references, minimal reviewed business facts and actor/parser lineage; it cannot reconstruct a missing original from a summary. THE-SOURCE-PRIVACY-SPEC governs fetch, cache, logging, model input, deletion and legacy cleanup.'
edit('notes/THE-ARCHITECTURE.md',[
 ('membership and retained sources','membership and source references'),('attachment<br/>immutable source','attachment<br/>external source reference'),
 ('Original source material is immutable within its retention policy: imported row/bytes, source\nname/code, email message and attachment, conversation wording, parser output, actor, and time are\npreserved separately from normalized current fields.',privacy+' Selected literal SKU names/codes/units and order phrases are business facts, not an email archive.'),
 ('streams and retained sources.','streams and retained business facts; raw source replay additionally requires renewed provider access.'),
 ('subordinate retained\nsources','subordinate external\nsources'),
 ('**Upload** retains a file, validates it, parses it into reviewable source rows, and reports what\n  was or was not adopted.','**Upload** reads a file transiently and presents extracted business rows for review. Accepted facts/mapping reports persist; incoming file bytes do not. An original requires authorized external access or re-selection.')])
append('notes/THE-ARCHITECTURE.md','## ARC-10 · Units, discussion and source custody','''The exact SKU owns selling/stock/price unit policy, literal labels, reviewed aliases and package equivalences. The platform supplies vocabulary, never a guessed pack weight. Standard dimensional conversions differ from SKU package contents; nominal contents differ from a measured delivery weight. [THE-UNITS-SPEC.md](THE-UNITS-SPEC.md) governs products, receipts, lot splits, albaranes, quotes and ERP mapping.

Internal comments are line-linked team discussion in a right-side panel. Customer line notes are explicitly authored/approved document content attached beneath the product. Neither changes catalogue identity. A manually saved customer note cites its authored business event; promoting a comment requires a separate action. Recurrence can remain an option forever.

[THE-SOURCE-PRIVACY-SPEC.md](THE-SOURCE-PRIVACY-SPEC.md) supersedes older requirements to retain raw incoming emails/files in Rocoto. The comments panel supersedes the always-visible Team note explanation box. These decisions do not remove audit, provider security review, issued business snapshots, generated outputs or approved illustration storage. Existing production tasks stay open until runtime evidence proves them.''')
edit('notes/THE-OBJECT-MAP.md',[
 ('A source is evidence. Its original bytes/text and metadata are retained separately from parsed,\n   normalized, or corrected facts.','A source is evidence. External providers/users keep incoming originals; Rocoto retains authorized references and minimal derived business facts separately from normalized fields. Raw email/file content is transient only (THE-SOURCE-PRIVACY-SPEC).'),
 ('Retained source artifact','External source reference'),('tenant source ID and immutable object reference','tenant source ID and provider/user reference'),('retained, parsed, quarantined, expired/redacted under policy','referenced, transiently fetched, parsed, blocked, unavailable/revoked under policy')])
edit('notes/THE-CATALOGUE-CONTRACT-SPEC.md',[
 ('Unknown import columns and original source bytes are retained.','Reviewed source business columns and row order may persist under the minimization policy. Original file bytes stay with the provider/user; THE-SOURCE-PRIVACY-SPEC governs transient parsing and re-selection.'),
 ('product/family-specific equivalence where declared,','exact-SKU equivalence where reviewed,'),
 ('Import retention and parse results are separate events.','Source-reference registration and transient parse results are separate events.'),('`catalogue.import.retained`','`catalogue.import.source_registered`')])
edit('notes/THE-SYSTEM-SPEC.md',[
 ('`source.retained`','`source.registered`'),('1. retain source artifact and validate format/security;','1. register the external source reference, validate format/security and read content transiently;'),
 ('scoped manual capture. They record connection/source identity, received time, content hash, raw\nobject pointer, declared media type/size, malware scan state, parser state/version, and retention\nclass.','scoped manual capture. They record connection/source identity, received time, permitted metadata/checksum, external reference, declared media type/size, scan outcome, parser version and retention class. '+privacy),
 ('| Retaining | durable upload session, checksum, resumable progress, cancellation; no parse success claim |','| Reading | bounded transient read, checksum, progress and cancellation; durable jobs hold references/metadata only; no parse success claim |'),
 ('original source remains intact','original stays with its provider/user; no durable Rocoto raw copy'),
 ('preserve file/session/drafts where safe','preserve reviewed facts/mapping and references; reselect or refetch raw input'),
 ('link retained artifact, import report','link authorized external original, import report'),
 ('Imported source rows remain exportable/auditable under tenant retention policy.','Reviewed extracted business rows remain exportable/auditable under the minimization policy. Arbitrary unknown columns require review before persistence. Original download requires actual external/session availability and checksum verification.'),
 ('A `UnitDefinition` has unit ID/label, dimension, precision, base unit, scope, effective period,\nand revision. `UnitEquivalence` has source SKU/family/global scope, factors, precision, source,\nreviewer, and revision. A broader relation can suggest a conversion only when its declared scope\napplies; an unknown equivalence remains unknown.','A `UnitDefinition` has ID/literal labels, dimension, precision, scope, effective period and revision. [THE-UNITS-SPEC.md](THE-UNITS-SPEC.md) defines stock/selling/order/price roles, exact-SKU package equivalences, reviewed aliases and AI proposals. Only standard physical same-dimension conversions can be global. Package contents are reviewed exact-SKU facts, never inherited family truth; nominal/catch-weight does not authorize exact conversion. Unknown equivalence remains unknown.'),
 ('Migration retains original source artifacts, mapping decisions, original external identifiers, row','Migration retains external source references, reviewed business facts, mapping decisions, original external identifiers, row'),
 ('verified provider webhook or authorized poll → retained source artifact','verified provider webhook or authorized poll → source reference + transient access'),
 ('source retained and parser/review progress','source registered and transient parser/review progress'),
 ('**Supplier source inbox** — retained source list','**Supplier source inbox** — authorized provider source list'),
 ('| Import retained, awaiting review | original file/row identity and parse status | source retained, mapping/review path, retryable parse failures |','| Import awaiting review | source reference/row identity and parse status | original availability, mapping/review path, retryable parse failures |')])
append('notes/THE-SYSTEM-SPEC.md','### ALB-01.4 · Comments and customer line notes','''A line has separate audiences. **Add note**/**Edit note** edits customer delivery-note wording; **Comments** opens internal discussion. The panel is 400 px wide on desktop and full width on phone, with product/document identity, **Comments** and **Delivery note** tabs and **Close**. It scrolls internally. Back/Escape closes the top layer and Forward restores its exact line/tab. Session drafts survive closing; failure preserves text without claiming saved.

Internal comments are append-only and line-scoped, with actor/time/text. They never enter customer confirmation, customer paper or ERP description. Customer text is limited to 500 characters and saved through an authorized command with audience, actor/time, source/review evidence and document revision. Directly authored text cites its own business event; it needs no fabricated email or intermediate comment. Clearing removes the current outward snapshot; issued/sent snapshots stay immutable.

Customer text renders once beneath the product with a 2 px neutral left rule and preserved newlines. Internal discussion has only a compact comment door on the row. **Use this comment…** contains secondary **Review wording**, **Keep as comment**, **Use on delivery note**, **Remove from delivery note**, and separately **Create a separate product**. Opening/repetition never creates SKU/price/stock/artwork/ERP state. Production comments require stable IDs, edits as revisions, permission, resolution/reopen, mentions/notifications under explicit send policy and audit; the kit's local compatibility prep-note events do not prove these services.''')
append('notes/THE-INTERACTION-SPEC.md','## INTX-10 · Line discussion and compact output panel','''| Control | Surface, copy, geometry and state |
|---|---|
| **ALB-X01** | Product-title row: **Add note**/**Edit note** opens **Line note** on **Delivery note**. Save/Remove note explicitly changes outward draft wording; failure retains draft. |
| **ALB-X02** | Product-title row: **Comments** icon with accessible product name and populated label/count. Opens exact-line author/time thread; no auto-promotion. Touch/keyboard have the same door. |
| **ALB-X03** | Right-side 400 px panel (phone full width), viewport scroll, subject header and **Close**. **Comments**/**Delivery note** tabs; Escape/Back closes only this layer, Forward restores subject/tab; focus returns to trigger. |
| **ALB-X04** | Internal textarea **Write a comment…**, helper **Only your team can see comments.**, action **Comment**, disabled blank. Customer textarea **Write an instruction for this delivery note…**, helper **Shown on this delivery note and in customer confirmations.**, **Save note**/**Remove note**. Both 500 characters, multiline, Ctrl/Cmd+Enter saves. |
| **ALB-X05** | Header: minimum 40 × 40 px **Previous delivery note**/**Next delivery note** targets and current position. **Actions** names the former ellipsis menu. Shortcuts and filtered-list scope remain unchanged. |
| **EXP-X01** | Navbar summary opens below trigger, aligned right: 840 px normal /1160 px expanded, desktop edge 24 px/top 64 px; phone edge 12 px/top 56 px. Height bounded to viewport; panel scroll. Trigger exposes expanded state and panel ID. |
| **EXP-X02** | **Print** has albarán and packing cards side by side desktop, stacked phone. Real scoped paper previews use 174 px desktop/154 px phone frames and actual aspect ratio; labels/actions stay above. No repeated dummy paper. |
| **EXP-X03** | Print/Files, day/all-day scope, A4/A5, profiles, queue, counters and email/ERP semantics remain unchanged by layout. Smaller previews cannot change records/jobs or imply provider completion. |

Albarán arithmetic occupies at most 420 px on desktop: quantity/unit, rate and total in readable aligned groups. Phone uses available width and preserves separate quantity/unit targets and validation. Customer note is attached below product; internal discussion/review machinery consumes no row space until opened.''')
edit('notes/THE-INTERACTION-SPEC.md',[
 ('A successful upload says what was retained/parsed;','A successful read says which business rows were parsed and which reviewed facts persisted;'),('opens retained native source','opens authorized native source'),('returns authorized retained conversations','returns authorized provider conversations'),
 ('It distinguishes retained source, unavailable source and system summary.','It distinguishes transient original content, unavailable source and system summary; raw email/file contents are not durably cached by Rocoto.')])
p=R/'notes/THE-JOURNEYS-SPEC.md';s=p.read_text();rows={
'JNY-O01':'Albarán line → **Comments** | comment-open opens a line-scoped author/time thread and internal composer. No Team note explanation box. | Comments/recurrence remain internal evidence, never customer/catalogue authority.',
'JNY-O02':'Comments → **Use this comment…** | **Keep as comment**/**Review wording** are secondary actions in a closed disclosure. | Review/keep affects only scoped review state.',
'JNY-O03':'Review → fields | **Customer note** and separately **Product name** keep outward wording and SKU candidate distinct. | Typing alone changes no customer copy, variation or ERP fact.',
'JNY-O04':'Customer text approval | **Use on delivery note**/**Remove from delivery note** approve/remove outward snapshot. Direct **Add note** → **Save note** is independently authored/approved. | Requires actor/time/source/review; no fabricated incoming message or historical rewrite.',
'JNY-O05':'Review → **Create a separate product** | Secondary disclosure contains **Product name**/**Create separate product**; **Cancel review** has no consequence. | Explicit creation opens independent SKU pricing; this order remains unchanged.'}
s='\n'.join(next((f'| **{k}** | {v} |' for k,v in rows.items() if line.startswith('| **'+k+'**')),line) for line in s.splitlines())+'\n'
s=s.replace('The source is retained in the tenant\'s source envelope','The external source reference and minimal extracted business facts are retained in the tenant\'s source envelope').replace('A photo is retained as an untrusted attachment','A photo is read transiently as an untrusted attachment').replace('Preserve attachment and source coordinates','Preserve reference/coordinates and require external retrieval or re-selection')
p.write_text(s)
edit('notes/INDEX.md',[('| 3 | [THE-INTELLIGENCE-SPEC.md]','| 3 | [THE-UNITS-SPEC.md](THE-UNITS-SPEC.md) | literal units, dimensions, SKU package equivalences and reviewed AI proposals |\n| 3 | [THE-SOURCE-PRIVACY-SPEC.md](THE-SOURCE-PRIVACY-SPEC.md) | external custody, transient mail/file handling, native mailbox doors and legacy cleanup |\n| 3 | [THE-INTELLIGENCE-SPEC.md]')])
p=R/'specs/taskgraph/v1/graph.json';g=json.loads(p.read_text())
for path,title in [('notes/THE-UNITS-SPEC.md','Units and equivalences'),('notes/THE-SOURCE-PRIVACY-SPEC.md','Source privacy and provider custody')]:
 if not any(d['path']==path for d in g['coreDocuments']):g['coreDocuments'].append({'path':path,'title':title})
if not any(x.startswith('Raw inbound') for x in g['policies']):g['policies'].append(privacy)
p.write_text(json.dumps(g,ensure_ascii=False,indent=2)+'\n')
p=R/'specs/taskgraph/v1/ui-controls.json';g=json.loads(p.read_text())
if not any(x['id']=='E181-CONTEXT' for x in g['anatomySources']):
 g['anatomySources'].append({'id':'E181-CONTEXT','document':'notes/THE-INTERACTION-SPEC.md','requiredIds':['ALB-X01','ALB-X02','ALB-X03','ALB-X04','ALB-X05','EXP-X01','EXP-X02','EXP-X03'],'minimumControlCount':8,'coverage':'canonicalAnatomy','title':'Line discussion, navigation and compact output panel'})
 g['mappings'].extend([{'pattern':'^ALB-X','taskId':'ALB-01.03','relatedTaskIds':['OBJ-01.02','QLT-02.01'],'anatomyPath':'Albarán > line discussion and header navigation','reason':'Separate audience, evidence, draft, scope and layer navigation.'},{'pattern':'^EXP-X','taskId':'UTL-04.01','relatedTaskIds':['DOC-01.03','QLT-02.01'],'anatomyPath':'Shell > output panel > print geometry','reason':'Compact viewport-safe layout preserves output semantics.'}])
for m in g['mappings']:
 for k in ['anatomyPath','reason']:
  if k in m:m[k]=m[k].replace('Team note','Comments').replace('team note','comment')
p.write_text(json.dumps(g,ensure_ascii=False,indent=2)+'\n')
p=R/'specs/taskgraph/v1/tasks/catalogue-source-inventory.json';tasks=json.loads(p.read_text())
for t in tasks:
 if t['id']=='CAT-01.01':
  t['title']='Catalogue import references and reviewed source-row identity';t['summary']='Read incoming files transiently; retain external references and reviewed business rows, mapping, literal SKU identity and partial-failure state. Never archive raw input in Rocoto.'
  t['steps'][0]='Read bounded raw input transiently; persist source reference, safe filename/type/size/checksum, actor, reviewed business columns, mapping version and row order. Refetch/reselect for original access.'
  t['assertions']['positive'][0]='An original download requires active-session or authorized external availability and checksum verification; derived exports retain reviewed business columns and row identity.'
  msg='Reload, retry, logs, traces, queues, browser caches and IndexedDB cannot retain raw inbound bytes; derived rows cannot impersonate an original.'
  if msg not in t['assertions']['negative']:t['assertions']['negative'].append(msg)
 if t['id']=='SRC-01.01':
  t['summary']='Register an authorized external source envelope and transient fetch/scan/parse lifecycle; persist safe references/metadata and minimal derived business facts, never raw emails or incoming file bytes.'
  t['steps'][0]='Assign source/tenant/connection identity, allowed metadata/checksum, provider/user reference and access state; no Rocoto raw-object store.'
  step='Prove no-store cache policy, redacted logs/traces/model telemetry/queues, per-fetch authorization and memory expiry. Offer explicit legacy raw-byte removal without silent deletion.'
  if step not in t['steps']:t['steps'].append(step)
  t['assertions']['positive'][0]='An accepted source has an external reference, processing lineage and current access state, including reselect/reconnect recovery.'
  ev='Durable-store/cache/log audit proving no raw incoming content; provider retention review, legacy cleanup and revocation tests.'
  if ev not in t['requiredEvidence']:t['requiredEvidence'].append(ev)
 if t['id']=='UTL-03.01':
  t['steps']=[x.replace('checksum/retention status','checksum/external-custody status').replace('Preserve ordered source cells and unknown columns through review and partial failure.','Preserve reviewed business cells/mapping through partial failure; raw file is transient and arbitrary columns need review before persistence.').replace('corresponding persisted fact exists','corresponding external/session source is available') for x in t['steps']]
p.write_text(json.dumps(tasks,ensure_ascii=False,indent=2)+'\n')
p=R/'specs/taskgraph/v1/obligations.json';g=json.loads(p.read_text());by={t['id']:t for t in tasks}
for o in g['obligations']:
 if len(o['taskIds'])==1 and o['taskIds'][0] in ['CAT-01.01','SRC-01.01']:o['scope']=by[o['taskIds'][0]]['summary']
p.write_text(json.dumps(g,ensure_ascii=False,indent=2)+'\n')
