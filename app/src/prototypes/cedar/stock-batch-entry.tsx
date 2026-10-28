import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { Textarea } from 'baseui/textarea';
import { Glyph, STEP } from './glyphs';
import { ProductFace, familyMarkOf } from './product-face';
import ChipEntry, { OfferFavourites } from './chip-entry';
import type { ChipRegisters } from './chip-parse';
import { matches, termsOf, wordsOf } from './search';
import { EXTRACTION_COPY, PARSE_ACCEPT, isTextTable, useExtraction } from './parsing';
import { DoorGrid, ProposalRows, SourceButton, proposalNumber, readingSentence, readyProposals, useProposals } from './intake-road';
import { addition, announce, stockRevision } from './incoming';
import {
  recordStockBatch,
  setStockBatchFavorite,
  useStockBatchMemory,
  type StockBatchLine,
  type StockBatchSnapshot,
  type StockBatchSource,
} from './stock-batch-memory';
import { usePhone } from './shell/viewport';
import type { ParsedRow } from './runtime-client';
import type { Cast, Product } from '../../scenarios/data/cast';
import { posthog, isPostHogConfigured } from '../../posthog';

type SourceView = 'recent' | 'favorites' | 'manual' | 'capture';
type DraftLine = Omit<StockBatchLine, 'quantity'> & { quantity: string };
/* THE HELD SOURCE keeps its BYTES as well as its preview, because §196.5 sends the source to the
   runtime for extraction and a blob URL is not a source. Session-only, exactly as before: nothing
   here is written to storage (SRC-PRIV-01, «working albarán photo»). */
type SessionStockPhoto = { name: string; type: string; size: number; url: string; file: File };

const compactButton = { BaseButton: { style: { minHeight: '44px', minWidth: '44px' } } };
const dateLot = (date: string) => date.replace(/-/g, '');
const lineId = () => `stock-line-${crypto.randomUUID()}`;
/** A STABLE EMPTY. A fresh `[]` each render is a fresh identity, and the proposal store
 *  re-matches on identity — so the waiting card would re-match on every frame. */
const EMPTY_ROWS: ParsedRow[] = [];
const asDraft = (line: StockBatchLine): DraftLine => ({ ...line, id: lineId(), quantity: String(line.quantity) });
const numberOf = (value: string) => Number(value.trim().replace(',', '.'));
const validLine = (line: DraftLine) => { const value = numberOf(line.quantity); return Number.isFinite(value) && value >= 0.001 && value <= 999999.999 && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001; };
const bytes = (size: number) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

const candidatesFor = (products: Product[], said: string): Product[] => {
  const normalized = termsOf(said).join(' ');
  if (!normalized) return [];
  const exactCode = products.filter((product) => product.code && termsOf(product.code).join(' ') === normalized);
  if (exactCode.length) return exactCode;
  let shown = products;
  let matched = false;
  for (const word of said.trim().split(/\s+/).filter(Boolean)) {
    const terms = termsOf(word);
    if (!terms.length) continue;
    const next = shown.filter((product) => matches(terms, wordsOf([product.name, product.code])));
    if (next.length) { shown = next; matched = true; }
  }
  return matched ? shown : [];
};

const dayToISO = (day: string, year: number) => {
  const [date, month] = day.split('.').map(Number);
  if (!date || !month) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
};

export function seededStockBatches(cast: Cast, today: string): StockBatchSnapshot[] {
  const groups = new Map<string, typeof cast.batches>();
  cast.batches.forEach((batch) => groups.set(batch.day, [...(groups.get(batch.day) ?? []), batch]));
  const year = Number(today.slice(0, 4)) || new Date().getFullYear();
  return [...groups.entries()].sort(([left], [right]) => dayToISO(right, year).localeCompare(dayToISO(left, year))).map(([day, batches]) => ({
    id: `recorded:${cast.sector}:${day}`,
    sector: cast.sector,
    label: `Stock recorded ${day}`,
    recordedAt: `${dayToISO(day, year)}T06:00:00.000Z`,
    source: 'history' as const,
    lines: batches.flatMap((batch) => {
      const product = cast.products.find((item) => item.id === batch.product);
      return product ? [{
        id: `${batch.id}:${product.id}`,
        productId: product.id,
        quantity: batch.qty,
        unit: product.unit,
        productionDate: dayToISO(day, year),
        lotNumber: batch.id,
      }] : [];
    }),
  })).filter((batch) => batch.lines.length);
}

export function parseStockTable(text: string, products: Product[], today: string): { lines: DraftLine[]; unresolved: string[] } {
  const byCode = new Map(products.flatMap((product) => product.code ? [[product.code.toLocaleLowerCase(), product] as const] : []));
  const byName = new Map(products.map((product) => [product.name.toLocaleLowerCase(), product]));
  const lines: DraftLine[] = [];
  const unresolved: string[] = [];
  text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean).forEach((row, index) => {
    const cells = row.includes('\t') ? row.split('\t') : row.split(/\s*[,;]\s*/);
    const identity = String(cells[0] ?? '').trim();
    if (index === 0 && /^(product|producto|sku|code|c[oó]digo)$/i.test(identity)) return;
    const product = byCode.get(identity.toLocaleLowerCase()) ?? byName.get(identity.toLocaleLowerCase());
    const quantity = String(cells[1] ?? '').trim();
    if (!product || !Number.isFinite(numberOf(quantity)) || numberOf(quantity) <= 0) { unresolved.push(row); return; }
    const suppliedUnit = String(cells[2] ?? '').trim();
    if (suppliedUnit && suppliedUnit.toLocaleLowerCase() !== product.unit.toLocaleLowerCase()) { unresolved.push(row); return; }
    const maybeDate = String(cells[3] ?? '').trim();
    const maybeLot = String(cells[4] ?? '').trim();
    lines.push({
      id: lineId(), productId: product.id, quantity, unit: suppliedUnit || product.unit,
      productionDate: /^\d{4}-\d{2}-\d{2}$/.test(maybeDate) ? maybeDate : today,
      lotNumber: maybeLot || undefined,
    });
  });
  return { lines, unresolved };
}

function BatchSummary({ batch, products }: { batch: StockBatchSnapshot; products: Product[] }) {
  const [, theme] = useStyletron();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
    {batch.lines.slice(0, 5).map((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) return null;
      return <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
        <ProductFace of={{ ...product, sector: batch.sector }} size={40} muted />
        <span style={{ ...theme.typography.LabelSmall, minWidth: 0, overflowWrap: 'anywhere' }}>{product.name}</span>
        <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap' }}>{line.quantity.toLocaleString('es-ES')} {line.unit}</span>
      </div>;
    })}
    {batch.lines.length > 5 && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>+{batch.lines.length - 5} more products</span>}
  </div>;
}

function SourceCard({ batch, products, favorite, onFavorite, onUse }: {
  batch: StockBatchSnapshot; products: Product[]; favorite: boolean;
  onFavorite: () => void; onUse: () => void;
}) {
  const [, theme] = useStyletron();
  return <article data-testid="stock-batch-source-card" style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, padding: theme.sizing.scale500, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0, background: theme.colors.backgroundPrimary }}>
    <header style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelMedium, display: 'block', overflowWrap: 'anywhere' }}>{batch.label}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{batch.lines.length} products</span>
      </span>
      <Button kind={KIND.tertiary} shape={SHAPE.circle} size={SIZE.compact} aria-label={favorite ? 'Remove batch from favorites' : 'Add batch to favorites'} aria-pressed={favorite} data-testid="stock-batch-favorite" onClick={onFavorite} overrides={compactButton}>
        <span style={{ color: favorite ? theme.colors.negative : theme.colors.contentSecondary, display: 'inline-flex' }}><Glyph id="heart" size={STEP.small} /></span>
      </Button>
    </header>
    <BatchSummary batch={batch} products={products} />
    <Button size={SIZE.compact} data-testid="stock-batch-use" onClick={onUse} overrides={{ BaseButton: { style: { minHeight: '44px', alignSelf: 'flex-start' } } }}>Use this batch</Button>
  </article>;
}

function CaptureInput({ products, today, phone, onRead }: {
  products: Product[]; today: string; phone: boolean;
  onRead: (lines: DraftLine[], source: StockBatchSource, unresolved: string[], evidence?: string, photo?: File) => void;
}) {
  const [, theme] = useStyletron();
  const [text, setText] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const pasteRef = React.useRef<HTMLTextAreaElement>(null);
  const [over, setOver] = React.useState(false);
  /* ── WHICH READER READS IT (FEED-IA §196.5) ────────────────────────────────────────────────
     A source that already HAS rows — a TSV paste, a CSV, a text export — is read EXACTLY, here,
     by `parseStockTable`. An exact reading beats a probabilistic one every time, so it is never
     sent anywhere. A photo, a scan, a PDF or a spreadsheet's binary has no rows to read: those go
     to Parsewise through the runtime, and the review below states what came back. */
  const readFile = async (file: File, source: StockBatchSource) => {
    if (source === 'photo' || !isTextTable(file, file.name)) { onRead([], source === 'photo' ? 'photo' : 'file', [], file.name, file); return; }
    const parsed = parseStockTable(await file.text(), products, today);
    onRead(parsed.lines, source, parsed.unresolved, file.name);
  };
  return <section data-testid="stock-batch-capture" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
    {/* ── «READ A STOCK SHEET» (E200.08 · §196.5) ─────────────────────────────────────────
        The heading NAMES what is under it, and the three doors below are the albarán road's own
        grammar — one shape wherever a document enters the house. The whole seat still takes a
        drop, because a desk hand drags a file onto a page before it hunts for a button. */}
    <div
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); const file = event.dataTransfer.files[0]; if (file) void readFile(file, 'file'); }}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, padding: theme.sizing.scale600, border: `1px dashed ${over ? theme.colors.contentPrimary : theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, background: over ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary, minWidth: 0 }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
        <span style={theme.typography.LabelMedium}>Read a stock sheet</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>A photo, a PDF, a spreadsheet or a pasted table. You review every row before it changes stock.</span>
      </span>
      <DoorGrid testid="stock-batch-doors">
        <SourceButton icon="camera" testid="stock-take-photo" onClick={() => cameraRef.current?.click()}>Take photo</SourceButton>
        <SourceButton icon="file" testid="stock-batch-upload" onClick={() => fileRef.current?.click()}>Upload file</SourceButton>
        <SourceButton icon="note" testid="stock-batch-paste-door" onClick={() => pasteRef.current?.focus()}>Paste</SourceButton>
      </DoorGrid>
      <input ref={fileRef} hidden type="file" accept={PARSE_ACCEPT} data-testid="stock-batch-file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file, 'file'); event.currentTarget.value = ''; }} />
      <input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" data-testid="stock-batch-camera" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file, 'photo'); event.currentTarget.value = ''; }} />
    </div>
    <label style={theme.typography.LabelSmall}>Paste rows from Excel
      <Textarea inputRef={pasteRef} value={text} data-testid="stock-batch-paste" placeholder={'Code\tquantity\tunit\tproduction date\tlot number'} onChange={(event) => setText(event.currentTarget.value)} overrides={{ Input: { props: { 'data-testid': 'stock-batch-paste' }, style: { minHeight: '112px', fontFamily: theme.typography.ParagraphSmall.fontFamily, fontVariantNumeric: 'tabular-nums' } } }} />
    </label>
    <Button size={SIZE.compact} disabled={!text.trim()} onClick={() => { const parsed = parseStockTable(text, products, today); onRead(parsed.lines, 'paste', parsed.unresolved); }} overrides={{ BaseButton: { style: { minHeight: '44px', alignSelf: 'flex-start' } } }}>Review pasted rows</Button>
  </section>;
}

/* ── WHAT THE RUNTIME MADE OF THE HELD SOURCE (FEED-IA §196.5 · E193.05 · E200.08) ───────────
 * §191.2: «A photo with no extractor attached stays visibly pending and asks for rows; it never
 * becomes stock merely because it was attached.» There IS an extractor now, so the card states
 * what it did: reading, what it read, or the honest posture where the runtime is out of reach —
 * and the rows it read only reach the table through a press.
 *
 * ⚠ E200.08 · AND THE CARD CARRIES THE ROWS. It used to carry only a COUNT, computed off the rows
 * the house recognised — so a sheet of five products of which the book knows three said «Read by
 * Parsewise · 5 rows · 88%» over a button offering three, and the other two left without a word.
 * Two lines of somebody's stock count, gone silently, which is the exact failure §191.1 names.
 * The card now shows every row the paper gave, in the albarán road's own proposal grammar: the
 * two the house has never sold stand there saying so, with the work handed back.
 */
function StockReading({ photo, products, today, onRows }: {
  photo: SessionStockPhoto; products: Product[]; today: string; onRows: (lines: DraftLine[]) => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { extraction, retry } = useExtraction(photo.file, 'stock', photo.name + ':' + String(photo.size));
  const rows = extraction?.state === 'read' ? extraction.result.rows : EMPTY_ROWS;
  const [proposals, setQty] = useProposals(rows, products);
  const ready = readyProposals(proposals);
  if (!extraction) return null;
  const landed = (): DraftLine[] => ready.flatMap((item) => item.product ? [{
    id: lineId(), productId: item.product.id, quantity: item.qty,
    unit: (item.row.unit || '').trim() || item.product.unit,
    /* THE PAPER'S OWN DAY, WHERE THE PAPER STATED ONE. §PAR-02.1 declares `date` on the stock
       kind and the runtime reads it; a sheet counted on Friday and typed on Monday keeps Friday.
       Where the row printed no date the house's own today stands, exactly as the manual road and
       the pasted table already do — and the person sees and edits it in the review table either
       way, so nothing here is written behind their back. */
    productionDate: item.row.date && /^\d{4}-\d{2}-\d{2}$/.test(item.row.date) ? item.row.date : today,
    lotNumber: item.row.lot?.trim() || undefined,
  } as DraftLine] : []);
  /* ── A READ THAT LANDED NO ROW STILL HANDS THE WORK BACK (E195.20) ────────────────────────
   * §191.2: a photo «stays visibly pending and asks for rows». Three of the four postures said
   * what to do next; the fourth — a read that CAME BACK, off a source Parsewise found no table
   * in, or whose rows match nothing in this house's book — printed its evidence line and stopped,
   * leaving a person with a finished sentence and no way on. Measured against the deployed
   * runtime: a source with no table answers in about 41 seconds with `0 rows`, and that is a
   * terminal state like any other. So where nothing can be pressed, the card says the same
   * sentence the other postures say. */
  const handedBack = extraction.state !== 'reading' && !proposals.some((item) => item.product);
  return <span data-testid="stock-batch-reading" data-state={extraction.state} data-rows={String(ready.length)} data-read={String(proposals.length)} data-provider="parsewise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: theme.sizing.scale300, minWidth: 0, width: '100%' }}>
    <span data-testid="stock-batch-photo-reading-state" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: 520 }}>
      {readingSentence(extraction, EXTRACTION_COPY.stockFallback, handedBack)}
    </span>
    {proposals.length > 0 && <ProposalRows
      testid="stock-batch-proposed"
      proposals={proposals}
      onQty={setQty}
      phone={phone}
      /* SAY WHAT IT IS. The row is real goods somebody counted; the house has yet to sell it. */
      unmatched="New to the house · add it as a product first"
    />}
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
      {ready.length > 0 && <Button size={SIZE.compact} data-testid="stock-batch-reading-apply" onClick={() => onRows(landed())} overrides={compactButton}>
        {'Put ' + String(ready.length) + ' row' + (ready.length === 1 ? '' : 's') + ' in the table'}
      </Button>}
      {(extraction.state === 'unreachable' || extraction.state === 'unavailable') && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-batch-reading-retry" onClick={retry} overrides={compactButton}>{EXTRACTION_COPY.retry}</Button>}
    </span>
  </span>;
}


function PhotoSourceCard({ photo, phone, products, today, onRows, onReplace, onRemove }: {
  photo: SessionStockPhoto; phone: boolean; products: Product[]; today: string;
  onRows: (lines: DraftLine[]) => void; onReplace: (file: File) => void; onRemove: () => void;
}) {
  const [, theme] = useStyletron();
  const input = React.useRef<HTMLInputElement>(null);
  const picture = photo.type.startsWith('image/');
  /* THE SOURCE IS A HEADER; THE ROWS ARE THE WORK (better-layout · order by importance). The
     picture and the file's name identify what is being read, in one band across the top; the
     proposals the read gave take the card's whole width underneath, so a quantity seat on a phone
     has the row to itself rather than an 88 px thumbnail's leftovers. */
  return <section data-testid="stock-batch-photo-source" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, background: theme.colors.backgroundPrimary, minWidth: 0 }}>
    <span style={{ display: 'grid', gridTemplateColumns: phone ? '72px minmax(0, 1fr)' : '88px minmax(0, 1fr)', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
      {picture
        ? <img data-testid="stock-batch-photo-preview" src={photo.url} alt="Stock list selected for this review" style={{ display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary, outline: `1px solid ${theme.colors.borderOpaque}`, outlineOffset: '-1px' }} />
        : <span data-testid="stock-batch-photo-preview" style={{ display: 'grid', placeItems: 'center', width: '100%', aspectRatio: '1 / 1', borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary }}><Glyph id="file" size={STEP.medium} /></span>}
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelSmall, display: 'block', maxWidth: '100%', overflowWrap: 'anywhere' }}>{photo.name || 'Stock list photo'}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{bytes(photo.size)} · held only in this open review</span>
      </span>
    </span>
    <StockReading photo={photo} products={products} today={today} onRows={onRows} />
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
      <Button kind={KIND.secondary} size={SIZE.compact} data-testid="stock-batch-photo-replace" onClick={() => input.current?.click()} overrides={compactButton}>
        {phone ? 'Retake photo' : 'Replace photo'}
      </Button>
      <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-batch-photo-remove" onClick={onRemove} overrides={compactButton}>Remove</Button>
    </span>
    <input ref={input} hidden type="file" accept="image/*" capture={phone ? 'environment' : undefined} data-testid="stock-batch-photo-replacement-input" onChange={(event) => { const file = event.target.files?.[0]; if (file) onReplace(file); event.currentTarget.value = ''; }} />
  </section>;
}

function BatchTable({ lines, products, phone, today, onLines }: {
  lines: DraftLine[]; products: Product[]; phone: boolean; today: string; onLines: (lines: DraftLine[]) => void;
}) {
  const [, theme] = useStyletron();
  const [addId, setAddId] = React.useState<string>('');
  const desktopColumns = 'minmax(126px, 1.15fr) minmax(118px, .82fr) minmax(156px, .95fr) minmax(0, 1.55fr) 44px';
  const productOptions = products.map((product) => ({ id: product.id, label: `${product.name}${product.code ? ` · ${product.code}` : ''}` }));
  const update = (id: string, patch: Partial<DraftLine>) => onLines(lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  const reviewInputOverrides = {
    Root: { style: { minHeight: '44px', minWidth: 0, width: '100%', backgroundColor: theme.colors.backgroundPrimary, boxShadow: 'inset 0 0 0 1px ' + theme.colors.borderOpaque, borderRadius: theme.borders.radius200 } },
    Input: { style: { minHeight: '44px', minWidth: 0, fontVariantNumeric: 'tabular-nums' } },
  };
  const copy = async () => {
    const text = ['Code\tquantity\tunit\tproduction date\tlot number', ...lines.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      return [product?.code || product?.name || line.productId, line.quantity, line.unit, line.productionDate ?? '', line.lotNumber ?? ''].join('\t');
    })].join('\n');
    try { await navigator.clipboard?.writeText(text); } catch { /* Copy remains a convenience; the table stays intact. */ }
  };
  const acceptTablePaste = (event: React.ClipboardEvent) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\n') && !text.includes('\t')) return;
    const parsed = parseStockTable(text, products, today);
    if (!parsed.lines.length) return;
    event.preventDefault(); onLines(parsed.lines);
  };
  return <section data-testid="stock-batch-review" onPaste={acceptTablePaste} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
      <span style={{ ...theme.typography.LabelMedium, flex: 1 }}>{lines.length} product{lines.length === 1 ? '' : 's'}</span>
      <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-batch-copy" onClick={() => void copy()} overrides={compactButton}>Copy table</Button>
    </div>
    {!phone && lines.length > 0 && <div data-testid="stock-batch-grid-head" aria-hidden style={{ display: 'grid', gridTemplateColumns: desktopColumns, gap: theme.sizing.scale300, padding: `0 ${theme.sizing.scale300}` }}>
      {['Product', 'Quantity', 'Production date', 'Lot number', ''].map((label) => <span key={label} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{label}</span>)}
    </div>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
      {lines.map((line) => {
        const product = products.find((item) => item.id === line.productId);
        if (!product) return null;
        const productCell = (
          <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
            <ProductFace of={{ ...product }} size={44} />
            <span style={{ minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, display: 'block', overflowWrap: 'anywhere' }}>{product.name}</span>
              {product.code && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{product.code}</span>}
            </span>
          </span>
        );
        const quantityCell = (
          <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
            <Input value={line.quantity} aria-label={'Quantity for ' + product.name}
              error={!!line.quantity && !validLine(line)}
              onChange={(event) => update(line.id, { quantity: event.currentTarget.value })}
              overrides={{
                Root: reviewInputOverrides.Root,
                Input: { props: { inputMode: 'decimal', 'data-testid': 'stock-batch-quantity' }, style: { minHeight: '44px', minWidth: 0, width: '100%', boxSizing: 'border-box', paddingLeft: theme.sizing.scale200, paddingRight: theme.sizing.scale200, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } },
              }}
            />
            {!phone && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, textAlign: 'right', whiteSpace: 'nowrap' }}>{line.unit}</span>}
          </span>
        );
        const dateCell = (
          <Input type="date" value={line.productionDate ?? ''} aria-label={'Production date for ' + product.name}
            onChange={(event) => update(line.id, { productionDate: event.currentTarget.value })}
            overrides={{
              Root: reviewInputOverrides.Root,
              Input: { props: { 'data-testid': 'stock-batch-production-date' }, style: { minHeight: '44px', minWidth: 0, width: '100%', boxSizing: 'border-box', paddingLeft: theme.sizing.scale200, paddingRight: theme.sizing.scale200, fontVariantNumeric: 'tabular-nums' } },
            }}
          />
        );
        const lotRows = Math.max(1, Math.min(3, Math.ceil((line.lotNumber?.length ?? 0) / 24)));
        const lotCell = (
          <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
            <Textarea value={line.lotNumber ?? ''} aria-label={'Lot number for ' + product.name} placeholder="Optional" rows={lotRows}
              onChange={(event) => update(line.id, { lotNumber: event.currentTarget.value })}
              overrides={{
                Root: reviewInputOverrides.Root,
                Input: { props: { 'data-testid': 'stock-batch-lot-number' }, style: { minHeight: '44px', minWidth: 0, width: '100%', boxSizing: 'border-box', resize: 'none', overflowY: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontVariantNumeric: 'tabular-nums', lineHeight: '20px', paddingTop: theme.sizing.scale300, paddingBottom: theme.sizing.scale300 } },
              }}
            />
            <Button kind={KIND.tertiary} size={SIZE.mini}
              data-testid="stock-batch-use-date" aria-label={"Use today's date as lot number for " + product.name}
              onClick={() => update(line.id, { lotNumber: dateLot(today) })}
              overrides={{ BaseButton: { style: { minHeight: '44px', justifyContent: 'flex-start', paddingLeft: 0, paddingRight: 0 } } }}>
              Use today's date
            </Button>
          </span>
        );
        const removeCell = (
          <Button kind={KIND.tertiary} shape={SHAPE.circle} size={SIZE.compact}
            aria-label={'Remove ' + product.name}
            onClick={() => onLines(lines.filter((item) => item.id !== line.id))}
            overrides={compactButton}>
            <Glyph id="bin" size={STEP.small} />
          </Button>
        );
        return phone
          ? <article key={line.id} data-testid="stock-batch-line" style={{ border: '1px solid ' + theme.colors.borderOpaque, borderRadius: theme.borders.radius400, padding: theme.sizing.scale500, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: theme.sizing.scale400, minWidth: 0 }}>
              <span style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale300 }}>{productCell}{removeCell}</span>
              <label style={theme.typography.LabelXSmall}>Quantity{quantityCell}</label>
              <span style={{ ...theme.typography.LabelSmall, alignSelf: 'end', paddingBottom: theme.sizing.scale400 }}>{line.unit}</span>
              <label style={{ ...theme.typography.LabelXSmall, gridColumn: '1 / -1' }}>Production date{dateCell}</label>
              <label style={{ ...theme.typography.LabelXSmall, gridColumn: '1 / -1' }}>Lot number{lotCell}</label>
            </article>
          : <div key={line.id} data-testid="stock-batch-line" style={{ display: 'grid', gridTemplateColumns: desktopColumns, alignItems: 'start', gap: theme.sizing.scale300, padding: theme.sizing.scale300, borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary, minWidth: 0 }}>
              {productCell}{quantityCell}{dateCell}{lotCell}{removeCell}
            </div>
      })}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(240px, 1fr) auto', alignItems: 'end', gap: theme.sizing.scale300 }}>
      <label data-testid="stock-batch-add-product-field" style={theme.typography.LabelSmall}>Add product
        <Select options={productOptions} value={addId ? productOptions.filter((option) => option.id === addId) : []} placeholder="Find a product or code" onChange={({ value }) => setAddId(value[0] ? String(value[0].id) : '')} overrides={{ Root: { style: { minWidth: 0 } }, ControlContainer: { style: { minHeight: '44px' } } }} />
      </label>
      <Button kind={KIND.secondary} size={SIZE.compact} data-testid="stock-batch-add-product" disabled={!addId} onClick={() => { const product = products.find((item) => item.id === addId); if (!product) return; onLines([...lines, { id: lineId(), productId: product.id, quantity: '', unit: product.unit, productionDate: today }]); setAddId(''); }} overrides={compactButton}>Add</Button>
    </div>
  </section>;
}

export function StockBatchEntry({ cast, products, registers, today, phone, onSingleProduct, onNewProduct }: {
  cast: Cast; products: Product[]; registers: ChipRegisters; today: string; phone: boolean;
  onSingleProduct: (product: Product, mode: 'receive' | 'count') => void;
  onNewProduct: () => void;
}) {
  const [, theme] = useStyletron();
  const memory = useStockBatchMemory(cast.sector);
  const seeded = React.useMemo(() => seededStockBatches(cast, today), [cast, today]);
  const history = React.useMemo(() => [...memory.history, ...seeded.filter((item) => !memory.history.some((saved) => saved.id === item.id))], [memory.history, seeded]);
  const [view, setView] = React.useState<SourceView>('manual');
  const [at, setAt] = React.useState(0);
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [source, setSource] = React.useState<StockBatchSource>('manual');
  const [evidence, setEvidence] = React.useState('');
  const [unresolved, setUnresolved] = React.useState<string[]>([]);
  const [said, setSaid] = React.useState('');
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState('');
  const [photo, setPhoto] = React.useState<SessionStockPhoto | null>(null);
  const photoRef = React.useRef<SessionStockPhoto | null>(null);
  const revision = React.useRef('');
  const goods = React.useMemo(() => products.map((product) => ({ id: product.id, phrase: product.name, face: product.name, count: 0, of: products.length })), [products]);
  const candidates = candidatesFor(products, said);
  const chosen = candidates.length === 1 ? candidates[0] : null;
  const current = history[Math.min(at, Math.max(0, history.length - 1))];
  const favoriteIds = new Set(memory.favorites.map((item) => item.id));
  const clearPhoto = React.useCallback(() => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    photoRef.current = null;
    setPhoto(null);
  }, []);
  const holdPhoto = React.useCallback((file: File) => {
    const next = { name: file.name || 'Stock list photo', type: file.type || 'image/*', size: file.size, url: URL.createObjectURL(file), file };
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    photoRef.current = next;
    setPhoto(next);
  }, []);
  React.useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    photoRef.current = null;
  }, []);
  const useBatch = (batch: StockBatchSnapshot, as: StockBatchSource = batch.source) => {
    clearPhoto(); revision.current = stockRevision(cast.sector); setLines(batch.lines.map(asDraft)); setSource(as); setEvidence(batch.label); setUnresolved([]); setError(''); setSaved('');
  };
  const reviewCapture = (next: DraftLine[], nextSource: StockBatchSource, failed: string[], file?: string, nextPhoto?: File) => {
    if (nextPhoto) holdPhoto(nextPhoto); else clearPhoto();
    revision.current = stockRevision(cast.sector); setLines(next); setSource(nextSource); setEvidence(file ?? ''); setUnresolved(failed); setError(''); setSaved('');
  };
  const confirm = () => {
    if (!lines.length || lines.some((line) => !validLine(line))) return;
    if (stockRevision(cast.sector) !== revision.current) { setError('Stock changed while this list was open. Your rows are still here. Go back and reopen the list before saving.'); return; }
    const recordedAt = new Date(`${today}T06:00:00`).toISOString();
    const batchId = `stock-batch-${crypto.randomUUID()}`;
    const finalLines: StockBatchLine[] = lines.map((line) => ({ ...line, quantity: numberOf(line.quantity), lotNumber: line.lotNumber?.trim() || undefined }));
    try {
      announce(finalLines.map((line) => addition({
        sector: cast.sector, product: line.productId, qty: line.quantity, unit: line.unit,
        at: new Date(recordedAt), lot: line.lotNumber, lotId: line.lotNumber ? `${batchId}:${line.id}` : undefined,
        productionDate: line.productionDate,
      })));
    } catch {
      setError('Saving this stock change stalled. Every row is still here.');
      return;
    }
    if (isPostHogConfigured) {
      posthog.capture('stock_batch_confirmed', {
        source,
        line_count: finalLines.length,
      });
    }
    try {
      recordStockBatch({ id: batchId, sector: cast.sector, label: `${finalLines.length} products · ${new Date(recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, recordedAt, source, lines: finalLines });
      clearPhoto(); setSaved(`Stock received for ${finalLines.length} product${finalLines.length === 1 ? '' : 's'}.`); setLines([]); setUnresolved([]); setEvidence(''); setError('');
    } catch {
      // Physical stock has already been appended. Remove the retry door because repeating this
      // review would create a second receipt. Only the reusable Recent copy failed.
      clearPhoto(); setLines([]); setUnresolved([]); setEvidence(''); setError('');
      setSaved(`Stock received for ${finalLines.length} product${finalLines.length === 1 ? '' : 's'}. Adding this list to Recent stalled; the stock is already in, so leave it as it is.`);
    }
  };

  const toggleFavorite = (batch: StockBatchSnapshot, favorite: boolean) => {
    if (setStockBatchFavorite(cast.sector, batch, favorite)) {
      setSaved(favorite ? 'Saved to Favorites.' : 'Removed from Favorites.');
      return;
    }
    setSaved('Saving this favorite stalled. Browser storage is unavailable; keep this window open and try again.');
  };

  if (lines.length || evidence || unresolved.length || photo) return <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}><Button kind={KIND.tertiary} shape={SHAPE.circle} size={SIZE.compact} aria-label="Back to stock sources" onClick={() => { clearPhoto(); setLines([]); setEvidence(''); setUnresolved([]); setError(''); }} overrides={compactButton}><Glyph id="back" size={STEP.small} /></Button><span style={{ flex: 1, ...theme.typography.HeadingXSmall }}>Review stock</span></div>
    {photo ? <PhotoSourceCard photo={photo} phone={phone} products={products} today={today} onRows={(next) => { setLines(next); setUnresolved([]); }} onReplace={(file) => { holdPhoto(file); setEvidence(file.name); }} onRemove={() => { clearPhoto(); setEvidence(''); setSource('manual'); }} /> : evidence && <span data-testid="stock-batch-evidence" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{evidence}</span>}
    {unresolved.length > 0 && <div role="alert" data-testid="stock-batch-unresolved" style={{ padding: theme.sizing.scale500, border: `1px solid ${theme.colors.negative400}`, borderRadius: theme.borders.radius400 }}><span style={theme.typography.LabelSmall}>{unresolved.length} row{unresolved.length === 1 ? '' : 's'} need attention</span><p style={{ ...theme.typography.ParagraphXSmall, marginBottom: 0, overflowWrap: 'anywhere' }}>{unresolved.slice(0, 3).join(' · ')}</p><Button kind={KIND.tertiary} size={SIZE.mini} data-testid="stock-batch-skip-unresolved" onClick={() => setUnresolved([])}>Skip these rows</Button></div>}
    <BatchTable lines={lines} products={products} phone={phone} today={today} onLines={setLines} />
    {error && <span role="alert" data-testid="stock-batch-save-error" style={{ color: theme.colors.negative }}>{error}</span>}
    {/* ⚠ THE BAND REACHES THE BOTTOM OF THE SCROLLPORT (E200.08, found by LOOKING at 1600, measured
        at both widths). A sticky `bottom: 0` pins to the scroll container's CONTENT edge, and the
        workflow body carries 24 px of padding there (16 px on a phone, `workflow-dialog.tsx`). So
        the opaque band stopped 24 px short of the body's own edge and the review scrolled into the
        strip: the last proposal's second line — «New to the house · add it as a product first» —
        stood in the open UNDER Confirm stock, with the top of its quantity seat showing beside it,
        which reads as a rendering fault rather than as a floor. Padding cannot close it (sticky
        grows the box upward, away from the strip) and neither can a negative margin, both measured.
        A background-coloured shadow offset by that same 24 px does: it paints a copy of the band
        into the strip, the scroller clips it at its own edge, and NO geometry moves — every drive
        that measures Confirm stock keeps its numbers. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale300, flexWrap: 'wrap', position: 'sticky', bottom: 0, paddingTop: theme.sizing.scale400, background: theme.colors.backgroundPrimary, boxShadow: '0 ' + theme.sizing.scale800 + ' 0 0 ' + theme.colors.backgroundPrimary }}><Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => { clearPhoto(); setLines([]); setEvidence(''); setUnresolved([]); }} overrides={compactButton}>Cancel</Button><Button size={SIZE.compact} data-testid="stock-batch-confirm" disabled={!lines.length || lines.some((line) => !validLine(line)) || unresolved.length > 0} onClick={confirm} overrides={compactButton}>Confirm stock</Button></div>
  </div>;

  return <div data-testid="stock-batch-entry" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
    {saved && <div role="status" data-testid="stock-batch-save-status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300, padding: theme.sizing.scale400, borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary }}><span data-testid={saved.includes('Recent stalled') ? 'stock-batch-history-warning' : undefined} style={theme.typography.ParagraphSmall}>{saved}</span><Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => setSaved('')}>Dismiss</Button></div>}
    <nav aria-label="Choose a stock starting point" style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
      {([['recent', 'Recent'], ['favorites', 'Favorites'], ['manual', 'Add manually'], ['capture', 'Read a stock sheet']] as Array<[SourceView, string]>).map(([id, label]) => <Button key={id} kind={view === id ? KIND.primary : KIND.secondary} shape={SHAPE.pill} size={SIZE.compact} aria-pressed={view === id} data-testid={`stock-source-${id}`} onClick={() => setView(id)} overrides={compactButton}>{label}</Button>)}
    </nav>
    {view === 'recent' && (current ? <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Start from a previous list, then edit it.</span><span style={{ display: 'flex', gap: theme.sizing.scale200 }}><Button kind={KIND.tertiary} shape={SHAPE.circle} size={SIZE.compact} aria-label="Previous stock list" data-testid="stock-batch-previous" disabled={at <= 0} onClick={() => setAt((value) => Math.max(0, value - 1))} overrides={compactButton}><span aria-hidden style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Glyph id="caret" size={STEP.small} /></span></Button><Button kind={KIND.tertiary} shape={SHAPE.circle} size={SIZE.compact} aria-label="Next stock list" data-testid="stock-batch-next" disabled={at >= history.length - 1} onClick={() => setAt((value) => Math.min(history.length - 1, value + 1))} overrides={compactButton}><span aria-hidden style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Glyph id="caret" size={STEP.small} /></span></Button></span></div>
      <SourceCard batch={current} products={products} favorite={favoriteIds.has(current.id)} onFavorite={() => toggleFavorite(current, !favoriteIds.has(current.id))} onUse={() => useBatch(current, 'history')} />
    </div> : <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Stock lists show here.</p>)}
    {view === 'favorites' && (memory.favorites.length ? <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale400 }}>{memory.favorites.map((batch) => <SourceCard key={batch.id} batch={batch} products={products} favorite onFavorite={() => toggleFavorite(batch, false)} onUse={() => useBatch(batch, 'favorite')} />)}</div> : <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Favorite a recent list to keep it here.</p>)}
    {view === 'manual' && <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
      <OfferFavourites of={goods}>
        <ChipEntry registers={registers} family={familyMarkOf(cast.sector)} autoFocus initial={said} label="Product" placeholder="Find a product or code" data-testid="event-word" onChange={(read) => setSaid(read.said ?? '')} />
      </OfferFavourites>
      {chosen ? <section data-testid="stock-update-product" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}><ProductFace of={{ ...chosen, sector: cast.sector }} size={44} /><span><span style={{ ...theme.typography.LabelMedium, display: 'block' }}>{chosen.name}</span>{chosen.code && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{chosen.code}</span>}</span></span>
        <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          <Button size={SIZE.compact} data-testid="stock-batch-add-manual" onClick={() => { revision.current = stockRevision(cast.sector); setLines([{ id: lineId(), productId: chosen.id, quantity: '', unit: chosen.unit, productionDate: today }]); setSource('manual'); }} overrides={compactButton}>Add to stock list</Button>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-update-receive" onClick={() => onSingleProduct(chosen, 'receive')} overrides={compactButton}>Receive only this item</Button>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-update-count" onClick={() => onSingleProduct(chosen, 'count')} overrides={compactButton}>Count only this item</Button>
        </div>
      </section> : said.trim() && candidates.length > 1 ? <p role="status" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>More than one product matches. Add a word or use its code.</p> : said.trim() ? <section role="status" data-testid="stock-update-no-sku" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: theme.sizing.scale300 }}><p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>“{said.trim()}” is still unmatched.</p><Button kind={KIND.secondary} size={SIZE.compact} data-testid="stock-update-new-product" onClick={onNewProduct}>New product</Button></section> : null}
    </section>}
    {view === 'capture' && <CaptureInput products={products} today={today} phone={phone} onRead={reviewCapture} />}
  </div>;
}
