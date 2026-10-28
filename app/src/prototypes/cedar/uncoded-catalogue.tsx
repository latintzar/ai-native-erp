/**
 * The uncoded half of the tenant catalogue.
 *
 * It is deliberately derived from accepted Albarán lines.  A word merely typed into
 * an order is not a catalogue item, and accepting it does not turn it into a SKU.
 * The item id is deterministic from the tenant's literal wording and sold-by unit,
 * so later accepted occurrences join the same tenant item without changing either
 * source line's identity.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { buildSales, type Sale } from './sale';
import { useDay } from './day';
import type { Cast } from '../../scenarios/data/cast';
import { openOrder, openProduct } from './anchors';
import { linkProducts, relatedProductIds, unlinkProducts, useProductRelations } from './product-relations';
import { codeText } from './product-code';
import { ChevronLeft } from 'lucide-react';

export type UncodedOccurrence = {
  saleId: string;
  saleNumber: string;
  lineId: string;
  date: string;
  customer: string;
  quantity: number;
  unit: string;
};

export type UncodedCatalogueItem = {
  /** Tenant-scoped stable catalogue-item identity, never an SKU or ERP code. */
  id: string;
  name: string;
  unit: string;
  firstSeen: string;
  lastSeen: string;
  acceptedCount: number;
  occurrences: UncodedOccurrence[];
};

const literalOf = (line: Sale['lines'][number]): string => (line.asked || line.product.name).trim();
const stableId = (sector: string, literal: string, unit: string): string => {
  let hash = 2166136261;
  for (const char of `${sector}\u0000${literal}\u0000${unit}`.toLocaleLowerCase()) {
    hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619);
  }
  return `uncoded-${(hash >>> 0).toString(36)}`;
};

/** Only a literal off-SKU line that a person accepted as a one-off is evidence. */
export function uncodedItemsOf(cast: Cast, sales: Sale[]): UncodedCatalogueItem[] {
  const items = new Map<string, UncodedCatalogueItem>();
  for (const sale of sales) for (const line of sale.lines) {
    if (!line.nonSku || line.adopted !== 'one-off') continue;
    const name = literalOf(line); if (!name) continue;
    const unit = line.unit.trim() || 'unit';
    const id = stableId(cast.sector, name, unit);
    const occurrence: UncodedOccurrence = { saleId: sale.id, saleNumber: sale.number, lineId: line.id, date: sale.day, customer: sale.customer.name, quantity: line.given, unit };
    const held = items.get(id);
    if (held) {
      held.occurrences.push(occurrence); held.acceptedCount += 1;
      if (occurrence.date < held.firstSeen) held.firstSeen = occurrence.date;
      if (occurrence.date > held.lastSeen) held.lastSeen = occurrence.date;
    } else items.set(id, { id, name, unit, firstSeen: occurrence.date, lastSeen: occurrence.date, acceptedCount: 1, occurrences: [occurrence] });
  }
  return [...items.values()].map(item => ({ ...item, occurrences: item.occurrences.sort((a, b) => b.date.localeCompare(a.date) || b.saleId.localeCompare(a.saleId)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id));
}

export function useUncodedCatalogueItems(cast: Cast): UncodedCatalogueItem[] {
  const edits = useDay(cast.sector);
  return React.useMemo(() => uncodedItemsOf(cast, buildSales(cast, edits, { includeArchived: true })), [cast, edits]);
}

type Note = { text: string; by: string; at: string };
type NoteBook = Record<string, Note[]>;
const NOTE_KEY = 'rocoto-uncoded-catalogue-notes-v1';
const notesFor = (sector: string, id: string): Note[] => {
  try { const book = JSON.parse(localStorage.getItem(NOTE_KEY) || '{}') as NoteBook; return Array.isArray(book[`${sector}:${id}`]) ? book[`${sector}:${id}`] : []; } catch { return []; }
};
const writeNote = (sector: string, id: string, text: string): { ok: boolean; notes: Note[] } => {
  const key = `${sector}:${id}`; let book: NoteBook = {};
  try { book = JSON.parse(localStorage.getItem(NOTE_KEY) || '{}') as NoteBook; } catch { /* start a fresh contextual note book */ }
  const next = [...(Array.isArray(book[key]) ? book[key] : []), { text, by: 'You', at: new Date().toISOString() }];
  try {
    localStorage.setItem(NOTE_KEY, JSON.stringify({ ...book, [key]: next }));
    return { ok: true, notes: next };
  } catch {
    return { ok: false, notes: Array.isArray(book[key]) ? book[key] : [] };
  }
};

export function UncodedItemSheet({ cast, item, candidates, onBack, onOpenItem }: { cast: Cast; item: UncodedCatalogueItem; candidates: Array<{ id: string; name: string; code?: string; unit?: string; kind?: 'sku' | 'uncoded' }>; onBack?: () => void; onOpenItem?: (id: string) => void }) {
  const [, theme] = useStyletron(); const relations = useProductRelations();
  const [notes, setNotes] = React.useState(() => notesFor(cast.sector, item.id));
  const [note, setNote] = React.useState(''); const [editingRelations, setEditingRelations] = React.useState(false);
  const [candidate, setCandidate] = React.useState<string | null>(null);
  const [relationError, setRelationError] = React.useState('');
  const [noteError, setNoteError] = React.useState('');
  React.useEffect(() => { setNotes(notesFor(cast.sector, item.id)); setNote(''); setCandidate(null); setRelationError(''); setNoteError(''); }, [cast.sector, item.id]);
  const linkedIds = relatedProductIds(cast.sector, item.id);
  const linked = candidates.filter(row => linkedIds.includes(row.id));
  const available = candidates.filter(row => row.id !== item.id && !linkedIds.includes(row.id)).map(row => ({ id: row.id, label: `${row.name} · ${row.kind === 'uncoded' ? 'Uncoded item' : codeText(row.code)} · ${row.unit || 'Unit needs review'}` }));
  const saveNote = () => {
    const text = note.trim(); if (!text) return;
    const written = writeNote(cast.sector, item.id, text);
    if (!written.ok) {
      setNoteError('Saving this note stalled. Your text is still here; try again.');
      return;
    }
    setNotes(written.notes); setNote(''); setNoteError('');
  };
  const block: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, padding: theme.sizing.scale500, borderTop: `1px solid ${theme.colors.borderOpaque}`, minWidth: 0 };
  const row = (label: string, value: React.ReactNode) => <div style={{ display: 'grid', gridTemplateColumns: 'minmax(104px, .42fr) minmax(0, 1fr)', gap: theme.sizing.scale300, alignItems: 'start' }}><span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>{label}</span><span style={{ ...theme.typography.ParagraphSmall, overflowWrap: 'anywhere' }}>{value}</span></div>;
  return <section data-testid="uncoded-item-sheet" data-item={item.id} style={{ minWidth: 0, overflowY: 'auto', height: '100%', background: theme.colors.backgroundPrimary }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, padding: theme.sizing.scale600, minWidth: 0 }}>
      {onBack && <Button kind={KIND.tertiary} size={SIZE.compact} shape={SHAPE.circle} aria-label="Back to Products" title="Back to Products" onClick={onBack} overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}><ChevronLeft size={24} aria-hidden="true" /></Button>}
      <div style={{ minWidth: 0, flex: 1 }}><h2 style={{ margin: 0, ...theme.typography.HeadingMedium, overflowWrap: 'anywhere' }}>{item.name}</h2><span data-testid="uncoded-no-sku" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>Uncoded item</span></div>
    </header>
    <div style={block}>{row('Unit', item.unit)}{row('Internal category', 'Needs review')}</div>
    <div style={block} data-testid="uncoded-related-items">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale300 }}>
        <span style={theme.typography.LabelSmall}>Related products</span>
        <Button kind={KIND.tertiary} size={SIZE.compact} aria-expanded={editingRelations} onClick={() => { setEditingRelations(value => !value); setCandidate(null); }}>{editingRelations ? 'Done' : linked.length ? 'Edit' : 'Add'}</Button>
      </div>
      {linked.length ? linked.map(link => <div key={link.id} data-testid={`uncoded-related-item-${link.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale200, minWidth: 0 }}>
        <Button kind={KIND.tertiary} size={SIZE.compact} data-list-card="inset" onClick={() => onOpenItem ? onOpenItem(link.id) : openProduct(link.id)} overrides={{ BaseButton: { style: { justifyContent: 'flex-start', minHeight: '48px', textAlign: 'left', borderRadius: theme.borders.radius300, backgroundColor: 'transparent', ':hover': { backgroundColor: theme.colors.backgroundSecondary } } } }}>{link.name} · {link.kind === 'uncoded' ? 'Uncoded item' : codeText(link.code)}</Button>
        {editingRelations && <Button kind={KIND.tertiary} size={SIZE.compact} aria-label={`Remove ${link.name} from related products`} onClick={() => { if (!unlinkProducts(cast.sector, item.id, link.id)) setRelationError('Saving this change stalled. Keep this section open and try again.'); else setRelationError(''); }}>Remove</Button>}
      </div>) : !editingRelations ? <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Related products show here.</span> : null}
      {editingRelations && <div data-testid="uncoded-related-items-editor" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', alignItems: 'end', gap: theme.sizing.scale300, paddingTop: theme.sizing.scale300, borderTop: `1px solid ${theme.colors.borderOpaque}`, minWidth: 0 }}>
        <label style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}><span style={theme.typography.LabelSmall}>Add existing product</span><Select aria-label="Add a related product" clearable searchable placeholder="Search existing products" options={available} value={available.filter(option => option.id === candidate)} onChange={({ value }) => setCandidate(value[0] ? String(value[0].id) : null)} overrides={{ Root: { style: { minWidth: 0 } }, ValueContainer: { style: { minHeight: '48px' } }, DropdownOption: { style: { minHeight: '48px' } } }} /></label>
        {relationError && <span role="alert" style={{ color: theme.colors.negative }}>{relationError}</span>}
        <Button kind={KIND.secondary} size={SIZE.compact} disabled={!candidate} onClick={() => { if (!candidate) return; if (linkProducts(cast.sector, item.id, candidate)) { setCandidate(null); setRelationError(''); } else setRelationError('Saving this related product stalled. Keep this selection and try again.'); }}>Add</Button>
      </div>}
    </div>
    <div style={block} data-testid="uncoded-notes"><span style={theme.typography.LabelSmall}>Notes & changes</span>{notes.map((entry, index) => <div key={`${entry.at}:${index}`}><span style={theme.typography.ParagraphSmall}>{entry.text}</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block' }}>{entry.by} · {new Date(entry.at).toLocaleString()}</span></div>)}<label style={{ display: 'grid', gap: theme.sizing.scale200 }}><span style={theme.typography.LabelSmall}>Add a note</span><Input value={note} onChange={event => { setNote(event.currentTarget.value); if (noteError) setNoteError(''); }} aria-label="Add a note" /></label>{noteError && <span role="alert" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{noteError}</span>}<Button kind={KIND.secondary} size={SIZE.compact} onClick={saveNote} disabled={!note.trim()}>Add note</Button></div>
    <div style={block} data-testid="uncoded-request-history"><span style={theme.typography.LabelSmall}>Request history</span><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Accepted on {item.acceptedCount} {item.acceptedCount === 1 ? 'Delivery Note' : 'Delivery Notes'} · first seen {item.firstSeen} · last seen {item.lastSeen}</span>{item.occurrences.map(occurrence => <Button key={`${occurrence.saleId}:${occurrence.lineId}`} kind={KIND.tertiary} size={SIZE.compact} data-testid={`uncoded-request-${occurrence.saleId}-${occurrence.lineId}`} onClick={() => openOrder(occurrence.saleId)} style={{ justifyContent: 'flex-start', minHeight: 44 }}>{occurrence.date} · {occurrence.customer} · {occurrence.quantity} {occurrence.unit} · Delivery Note {occurrence.saleNumber}</Button>)}</div>
      </section>;
}
