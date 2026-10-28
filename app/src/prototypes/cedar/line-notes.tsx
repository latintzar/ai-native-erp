/*
 * Line notes are document content. A repeated request can be useful evidence for a later catalogue
 * review, but it never converts itself into a SKU, variation, price or artwork request. The only
 * path that makes a product option is the named, operator-led review below.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { X } from 'lucide-react';
import { Input } from 'baseui/input';
import { Textarea } from 'baseui/textarea';
import type { Cast } from '../../scenarios/data/cast';
import { approveCustomerOption, clearCustomerOption, customerOptionText, noteLine, saveCustomerLineNote, type Sale, type SaleLine, type SaleEvent } from './sale';
import { useDay } from './day';
import { useConfig } from './config';
import { foldWord } from './catalogue';
import { openProduct, useHistoryLayer } from './anchors';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import { usePhone } from './shell/viewport';
import { CreateSKU } from './product-creation';

type NoteEvent = Extract<SaleEvent, { kind: 'prep-note' }>;
type NoteHistory = NoteEvent & { source: string };

type Review = {
  id: string;
  scope: string;
  customer: string;
  product: string;
  sale: string;
  line: string;
  note: string;
  sources: string[];
  /** `accepted` is an explicit operator creation, never a repeated-note automation. */
  decision: 'accepted' | 'dismissed' | 'customer_option';
  variation?: string;
  customerOption?: string;
  by: string;
  at: string;
  origin: 'operator-review';
  reviewVersion: 'note-option-review-v1';
};

const KEY = 'rocoto-app-note-reviews-v2';
const readReviews = (): Review[] => {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(rows) ? rows.filter((row): row is Review => Boolean(row && typeof row === 'object')) : [];
  } catch {
    return [];
  }
};
let reviews = readReviews();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function remember(review: Review): boolean {
  const prior = reviews.filter((row) => row.id !== review.id);
  try {
    const next = [...prior, review];
    localStorage.setItem(KEY, JSON.stringify(next));
    reviews = next;
    listeners.forEach((fn) => fn());
    return true;
  } catch {
    return false;
  }
}

function historyOf(events: SaleEvent[], sales: Sale[], sale: Sale, line: SaleLine): NoteHistory[] {
  return events.flatMap((event, index) => {
    if (event.kind !== 'prep-note') return [];
    const document = sales.find((candidate) => candidate.id === event.sale);
    const product = event.product ?? document?.lines.find((candidate) => candidate.id === event.line)?.product.id;
    const customer = event.customer ?? document?.customer.id;
    const sameLine = event.sale === sale.id && event.line === line.id;
    return sameLine || (product === line.product.id && customer === sale.customer.id)
      ? [{ ...event, source: `${event.sale}:${event.line}:${index}` }]
      : [];
  }).reverse();
}

const drafts = new Map<string, string>();
export function LineNoteEditor({ sale, line, now, onDone, audience = 'internal' }: {
  sale: Sale; line: SaleLine; now: string; onDone: () => void; audience?: 'internal' | 'customer';
}) {
  const [, theme] = useStyletron();
  const { config } = useConfig();
  const key = `${sale.id}:${line.id}:${audience}`;
  const [text, setText] = React.useState(() => drafts.get(key) ?? (audience === 'customer' ? customerOptionText(line) ?? '' : ''));
  const [saveError, setSaveError] = React.useState('');
  const save = () => {
    const saved = audience === 'customer'
      ? saveCustomerLineNote(sale, now, line.id, text, config.owner.name)
      : !!text.trim() && noteLine(sale, now, line.id, text, config.owner.name);
    if (!saved) { setSaveError('Saving stalled. Your draft is still here. Try again.'); return; }
    drafts.delete(key); setText(''); setSaveError(''); onDone();
  };
  return <div data-testid={`prep-field-${line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
    <Textarea value={text} autoFocus rows={3} placeholder={audience === 'customer' ? 'Write an instruction for this delivery note…' : 'Write a comment…'}
      aria-label={audience === 'customer' ? 'Delivery note text' : 'Internal comment'}
      onChange={(e) => { setText(e.currentTarget.value); drafts.set(key, e.currentTarget.value); }}
      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); } }}
      overrides={{ Input: { props: { maxLength: 500, 'data-testid': `prep-input-${line.id}` } } }} />
    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
      {audience === 'customer' ? 'Shown on this delivery note.' : 'Only your team can see comments.'}
    </span>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale300 }}>
      <Button kind={KIND.primary} size={SIZE.compact} disabled={audience === 'internal' && !text.trim()} data-testid={`prep-save-${line.id}`} onClick={save}>
        {audience === 'customer' ? text.trim() ? 'Save note' : 'Remove note' : 'Comment'}
      </Button>
    </div>
    {saveError && <span role="alert" data-testid={`prep-save-error-${line.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{saveError}</span>}
  </div>;
}

/** The same note can remain on every future albarán. This panel exposes a review route without
 * pretending that recurrence, a customer request, or an automated proposal is consent to create a
 * catalogue item. */
export function LineNoteContext({ cast, sales, sale, line, now, editable, isOpen, mode, onClose, onModeChange }: {
  cast: Cast; sales: Sale[]; sale: Sale; line: SaleLine; now: string; editable: boolean; isOpen: boolean; mode: 'comment' | 'note'; onClose: () => void; onModeChange: (mode: 'comment' | 'note') => void;
}) {
  const [, theme] = useStyletron();
  const { config } = useConfig();
  const day = useDay(cast.sector);
  const savedReviews = React.useSyncExternalStore(subscribe, () => reviews, () => reviews);
  const phone = usePhone();
  useHistoryLayer({ id: `line-discussion:${sale.id}:${line.id}`, active: isOpen, snapshot: { mode }, onRestore: snapshot => snapshot ? onModeChange(snapshot.mode === 'note' ? 'note' : 'comment') : onClose() });
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [optionName, setOptionName] = React.useState('');
  const [customerOptionDraft, setCustomerOptionDraft] = React.useState('');
  const [error, setError] = React.useState('');
  const [creationOpen, setCreationOpen] = React.useState(false);
  const history = historyOf(day.events, sales, sale, line);
  const note = line.prepNote ?? '';
  const matching = note ? history.filter((row) => foldWord(row.note) === foldWord(note)) : [];
  const scope = `${cast.sector}:${cast.house.name}`;
  const id = `note-option-review-v1:${scope}:${sale.customer.id}:${line.product.id}:${foldWord(note)}`;
  const reviewed = [...savedReviews].reverse().find((row) => row.id === id);
  const approvedCustomerOption = customerOptionText(line);
  const recurringPrompt = Boolean(note && matching.length > 1 && config.productRequests.suggestNewSkus && !reviewed && !reviewOpen);

  React.useEffect(() => {
    setReviewOpen(false);
    setOptionName(note);
    setCustomerOptionDraft(approvedCustomerOption ?? note);
    setError('');
  }, [sale.id, line.id, note, approvedCustomerOption]);

  const record = (decision: Review['decision'], variation?: string, customerOption?: string): boolean => {
    const saved = remember({
      id,
      scope,
      customer: sale.customer.id,
      product: line.product.id,
      sale: sale.id,
      line: line.id,
      note,
      sources: matching.map((row) => row.source),
      decision,
      variation,
      customerOption,
      by: config.owner.name,
      at: new Date().toISOString(),
      origin: 'operator-review',
      reviewVersion: 'note-option-review-v1',
    });
    if (!saved) setError('Your note stands as it was; saving the review record in this browser stalled. Keep this sheet open and try again.');
    return saved;
  };

  const createOption = () => {
    if (!optionName.trim()) {
      setError('Write the variation description before continuing.');
      return;
    }
    /* This only hands the retained note to the shared SKU review. It writes no catalogue row,
       price, artwork request or document change until that form confirms an exact SKU. */
    setError('');
    setCreationOpen(true);
  };

  const approveForCustomer = () => {
    const text = customerOptionDraft.trim();
    const sourceEventIds = matching.map((row) => row.source).filter(Boolean);
    if (!text) {
      setError('Write the customer-visible line option before approving it.');
      return;
    }
    if (sourceEventIds.length === 0) {
      setError('Save the source note first. A customer option needs its source record.');
      return;
    }
    const approved = approveCustomerOption(sale, now, line.id, {
      text,
      audience: 'customer',
      status: 'approved',
      reviewId: id,
      sourceEventIds,
      approvedBy: config.owner.name,
      approvedAt: new Date().toISOString(),
    });
    if (!approved) {
      setError('Approving this customer line option stalled. Check the wording and try again.');
      return;
    }
    const saved = record('customer_option', undefined, text);
    if (!saved) {
      setError('This customer line option is approved on the delivery note; saving the local review record in this browser stalled. Keep this sheet open and retry the review record.');
      return;
    }
    setError('');
    setReviewOpen(false);
  };

  const removeCustomerOption = () => {
    if (!clearCustomerOption(sale, now, line.id, config.owner.name)) {
      setError('Removing this customer line option stalled. Try again.');
      return;
    }
    if (!record('dismissed')) {
      setError('The customer line option is removed; saving the local review record in this browser stalled. Keep this sheet open and retry the review record.');
      return;
    }
    setError('');
    setReviewOpen(false);
  };

  const ownComments = history.filter(row => row.sale === sale.id && row.line === line.id).reverse();
  if (creationOpen) return <CreateSKU
    cast={cast}
    family={line.product}
    initialVariationDescription={optionName}
    onClose={() => setCreationOpen(false)}
    onCreated={(product) => {
      setCreationOpen(false);
      if (!record('accepted', product.id)) {
        setError('The separate product is saved; saving the review record in this browser stalled. This delivery note still keeps its original note.');
        return;
      }
      setError('');
      onClose();
      openProduct(product.id);
    }}
  />;
  return <OverlayCard isOpen={isOpen} onClose={onClose} size={phone ? '100%' : 400} scrim={SCRIM.clear} ariaLabel={`${mode === 'comment' ? 'Comments' : 'Line note'} · ${line.product.name}`}
    overrides={{ Scrim: { style: { justifyContent: 'flex-end', alignItems: 'stretch' } }, Card: { style: {
      marginTop: '0', marginRight: '0', marginBottom: '0', marginLeft: '0', height: '100dvh', maxHeight: '100dvh', overflowY: 'auto',
      borderTopLeftRadius: phone ? '0' : theme.borders.radius300, borderBottomLeftRadius: phone ? '0' : theme.borders.radius300,
      borderTopRightRadius: '0', borderBottomRightRadius: '0', boxShadow: theme.lighting.shadow600,
      padding: theme.sizing.scale600, transformOrigin: 'right center',
    } } }}>
    <aside data-testid={`note-context-${line.id}`} data-mode={mode} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minHeight: '100%', minWidth: 0 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, alignItems: 'flex-start' }}>
        <div><h2 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>{mode === 'comment' ? 'Comments' : 'Line note'}</h2>
          <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, marginBottom: 0 }}>{line.product.name} · {sale.number}</p></div>
        <Button kind={KIND.tertiary} size={SIZE.compact} shape={SHAPE.circle} aria-label="Close line panel" onClick={onClose} overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', padding: 0 } } }}><X size={22} aria-hidden /></Button>
      </header>
      <div role="tablist" aria-label="Line discussion" style={{ display: 'flex', gap: theme.sizing.scale200, borderBottom: `1px solid ${theme.colors.borderOpaque}`, paddingBottom: theme.sizing.scale300 }}>
        <Button role="tab" aria-selected={mode === 'comment'} kind={mode === 'comment' ? KIND.secondary : KIND.tertiary} size={SIZE.compact} onClick={() => onModeChange('comment')}>Comments{ownComments.length ? ` · ${ownComments.length}` : ''}</Button>
        <Button role="tab" aria-selected={mode === 'note'} kind={mode === 'note' ? KIND.secondary : KIND.tertiary} size={SIZE.compact} onClick={() => onModeChange('note')}>Delivery note</Button>
      </div>
      {mode === 'note' ? <>
        {editable ? <LineNoteEditor key={`customer:${sale.id}:${line.id}`} sale={sale} line={line} now={now} audience="customer" onDone={onClose} />
          : <p style={{ ...theme.typography.ParagraphSmall, whiteSpace: 'pre-wrap' }}>{approvedCustomerOption || 'Line notes show here.'}</p>}
      </> : <>
        <div data-testid={`note-history-${line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600 }}>
          {ownComments.length ? ownComments.map(row => <article key={row.source} data-note-source={row.source} style={{ display: 'flex', gap: theme.sizing.scale400 }}>
            <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flex: '0 0 28px', height: 28, borderRadius: '50%', background: theme.colors.backgroundSecondary, ...theme.typography.LabelXSmall }}>{(row.by || 'Team').slice(0,1)}</span>
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
              <span style={theme.typography.LabelSmall}>{row.by || 'Team'}</span><time style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>{row.recordedAt ? new Date(row.recordedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : row.at}</time>
            </div><p style={{ ...theme.typography.ParagraphSmall, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: `${theme.sizing.scale200} 0 0` }}>{row.note || 'Comment cleared'}</p></div>
          </article>) : <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Comments show here.</p>}
        </div>
        {editable && <div style={{ paddingTop: theme.sizing.scale500, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
          <LineNoteEditor key={`internal:${sale.id}:${line.id}`} sale={sale} line={line} now={now} onDone={() => setError('')} />
        </div>}
        {note && editable && <details data-testid={`note-option-boundary-${line.id}`}>
          <summary style={{ ...theme.typography.LabelSmall, cursor: 'pointer', color: theme.colors.contentSecondary }}>Use this comment</summary>
          <div style={{ paddingTop: theme.sizing.scale500, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
            <p style={{ ...theme.typography.ParagraphSmall, margin: 0, color: theme.colors.contentSecondary }}>“{note}”</p>
            {recurringPrompt && <span data-testid={`note-recurring-fact-${line.id}`} style={theme.typography.ParagraphXSmall}>Requested {matching.length} times by {sale.customer.name}.</span>}
            {reviewed?.decision === 'dismissed' && <span data-testid={`note-kept-${line.id}`} style={theme.typography.ParagraphXSmall}>Kept as a comment.</span>}
            {reviewed?.decision === 'accepted' && <span data-testid={`note-option-created-${line.id}`} style={theme.typography.ParagraphXSmall}>Separate product created. This line is unchanged.</span>}
            {!reviewOpen ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
              <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`note-review-option-${line.id}`} onClick={() => { setReviewOpen(true); setOptionName(note); setError(''); }}>Review note</Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`note-keep-${line.id}`} onClick={() => { if (record('dismissed')) setError(''); }}>Keep as comment</Button>
            </div> : <section data-testid={`note-option-review-${line.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
              <label style={theme.typography.LabelSmall}>Customer note
                <Input value={customerOptionDraft} aria-label="Customer note" onChange={event => setCustomerOptionDraft(event.currentTarget.value)} overrides={{ Input: { props: { 'data-testid': `customer-option-input-${line.id}` } } }} />
              </label>
              <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`customer-option-approve-${line.id}`} onClick={approveForCustomer}>Use on delivery note</Button>
              {approvedCustomerOption && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`customer-option-remove-${line.id}`} onClick={removeCustomerOption}>Remove from delivery note</Button>}
              <details><summary style={{ ...theme.typography.LabelSmall, cursor: 'pointer' }}>Create a separate product</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, paddingTop: theme.sizing.scale400 }}>
                  <label style={theme.typography.LabelSmall}>Variation description<Input value={optionName} aria-label="Variation description" onChange={event => setOptionName(event.currentTarget.value)} overrides={{ Input: { props: { 'data-testid': `note-option-name-${line.id}` } } }} /></label>
                  <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, margin: 0 }}>Continue to enter its code and unit. This delivery note stays unchanged.</p>
                  <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`note-option-create-${line.id}`} onClick={createOption}>Continue to product review</Button>
                </div>
              </details>
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`note-option-cancel-${line.id}`} onClick={() => setReviewOpen(false)}>Cancel review</Button>
            </section>}
          </div>
        </details>}
      </>}
      {error && <span role="alert" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{error}</span>}
    </aside>
  </OverlayCard>;
}
