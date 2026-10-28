/*
 * A photographed outgoing albarán is source evidence, not an OCR result.
 *
 * The image is held only in this browser session. The durable review record keeps the working-paper
 * baseline, an opaque source association and the acknowledgement that gates the next print; it
 * never keeps image bytes. After reload an operator must select the photo again to begin or
 * replace a source review; a matching accepted review remains attributable.
 * Older IndexedDB bytes are deliberately left untouched and inaccessible until an explicit privacy
 * cleanup action is wired; this module never reads or writes them.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import type { Sale } from './sale';
/* E196 · where the runtime holds this sheet's own layout, the photograph is READ and the review
   below the card is what a person works in. The card then says that, instead of saying the
   opposite. Without a runtime nothing changes here at all. */
import { matchedRead, usePaperRead } from './paper-read';
import {
  createOpaqueSourceRef,
  discardSessionSource,
  isOpaqueSourceRef,
  keepSessionSource,
  legacyOpaqueSourceRef,
  sessionSource,
  sessionSourceDetails,
} from './source-retention';

type PrintBaseline = { count: number; at: string };
type PaperPhoto = {
  /** Opaque durable association. It contains no filename or byte location. */
  sourceRef: string;
  type: string;
  size: number;
  capturedAt: string;
};
type ReviewCompletion = {
  at: string;
  /** The print revision visible when the operator completed the review. A final copy must be later. */
  printedCount: number;
  documentFingerprint: string;
  /** A replacement source invalidates acknowledgement; expiry of viewed bytes does not erase accepted review. */
  sourceRef?: string;
};

export type AlbaranPaperReview = {
  version: 1;
  scope: string;
  sale: string;
  baseline: PrintBaseline;
  startedAt: string;
  photo?: PaperPhoto;
  reviewed?: ReviewCompletion;
};

type ReviewBook = Record<string, AlbaranPaperReview>;
type SaveResult = { ok: true } | { ok: false; message: string };

const STORAGE_KEY = 'rocoto-albaran-paper-review-v1';
/** Only used by the explicit legacy-cleanup export; no reader or writer opens this database. */
const LEGACY_DB_NAME = 'rocoto-albaran-paper-review-v1';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const canUseStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const recordKey = (scope: string, sale: string): string => `${scope}:${sale}`;

/**
 * Read old filename/blob/session-key metadata only long enough to make an opaque in-memory alias.
 * This does not write, reopen, or display the legacy source. A later explicit user action can
 * replace the record; legacy raw bytes remain untouched until an authorized cleanup.
 */
function normalizedPhoto(value: unknown): PaperPhoto | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.type !== 'string' || !Number.isFinite(row.size) || typeof row.capturedAt !== 'string') return undefined;
  const legacyKey = typeof row.sessionKey === 'string' ? row.sessionKey
    : typeof row.blobKey === 'string' ? row.blobKey : undefined;
  const sourceRef = isOpaqueSourceRef(row.sourceRef) ? row.sourceRef
    : legacyKey ? legacyOpaqueSourceRef(legacyKey)
      : legacyOpaqueSourceRef(`${row.capturedAt}:${row.type}:${String(row.size)}`);
  return { sourceRef, type: row.type, size: Number(row.size), capturedAt: row.capturedAt };
}

function normalizedCompletion(value: unknown): ReviewCompletion | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== 'string' || !Number.isSafeInteger(row.printedCount)
    || Number(row.printedCount) < 0 || typeof row.documentFingerprint !== 'string') return undefined;
  const legacyKey = typeof row.sourceSessionKey === 'string' ? row.sourceSessionKey
    : typeof row.sourceBlobKey === 'string' ? row.sourceBlobKey : undefined;
  const sourceRef = isOpaqueSourceRef(row.sourceRef) ? row.sourceRef
    : legacyKey ? legacyOpaqueSourceRef(legacyKey) : undefined;
  return {
    at: row.at,
    printedCount: Number(row.printedCount),
    documentFingerprint: row.documentFingerprint,
    ...(sourceRef ? { sourceRef } : {}),
  };
}

function readBook(): ReviewBook {
  if (!canUseStorage()) return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).flatMap(([key, row]) => {
        if (!row || typeof row !== 'object') return [];
        const item = row as Record<string, unknown>;
        const baseline = item.baseline as Partial<PrintBaseline> | undefined;
        const photo = normalizedPhoto(item.photo);
        const reviewed = normalizedCompletion(item.reviewed);
        if (item.version !== 1 || typeof item.scope !== 'string' || typeof item.sale !== 'string'
          || !baseline || !Number.isFinite(baseline.count) || typeof baseline.at !== 'string'
          || (item.photo !== undefined && !photo) || (item.reviewed !== undefined && !reviewed)) return [];
        return [[key, {
          version: 1,
          scope: item.scope,
          sale: item.sale,
          baseline: { count: Number(baseline.count), at: baseline.at },
          startedAt: typeof item.startedAt === 'string' ? item.startedAt : baseline.at,
          ...(photo ? { photo } : {}),
          ...(reviewed ? { reviewed } : {}),
        } as AlbaranPaperReview]];
      }),
    );
  } catch {
    return {};
  }
}

let book = readBook();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function publish(next: ReviewBook): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    book = next;
    listeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    book = readBook();
    listeners.forEach((listener) => listener());
  });
}

/**
 * Privacy migration helper. This deliberately has no automatic caller: deleting old local source
 * bytes is a user-authorized act. A settings/privacy surface may call it after describing the
 * consequence. It never reports success unless IndexedDB confirms deletion.
 */
export async function clearLegacyAlbaranPaperPhotoBytes(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(LEGACY_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Rocoto tabs before clearing old photo bytes.'));
    });
    return true;
  } catch {
    return false;
  }
}

const baselineOf = (sale: Sale): PrintBaseline | null => sale.printed
  ? { count: sale.printed.count, at: sale.printed.at }
  : null;

/** A manual quantity, weight, unit or price correction records which paper it is correcting.
 * It changes no sale fact itself; the canonical line event remains the sole source of the edit. */
export function beginAlbaranCorrection(scope: string, sale: Sale): void {
  const baseline = baselineOf(sale);
  if (!baseline) return;
  const key = recordKey(scope, sale.id);
  const current = book[key];
  if (current) {
    if (current.reviewed) publish({ ...book, [key]: { ...current, reviewed: undefined } });
    return;
  }
  publish({
    ...book,
    [key]: { version: 1, scope, sale: sale.id, baseline, startedAt: new Date().toISOString() },
  });
}

/**
 * Keeps a chosen paper photo only in memory for this browser session. It deliberately has no
 * IndexedDB/localStorage byte fallback; a reload must ask the operator to choose the source again.
 */
export async function retainAlbaranPaperPhoto(scope: string, sale: Sale, file: File): Promise<SaveResult> {
  const baseline = baselineOf(sale);
  if (!baseline) return { ok: false, message: 'Print a working paper first, then add its photo.' };
  if (!file.type.startsWith('image/') || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: 'Choose an image up to 10 MB.' };
  }
  const key = recordKey(scope, sale.id);
  const previous = book[key];
  const capturedAt = new Date().toISOString();
  const sourceRef = createOpaqueSourceRef();
  /* The file name is display-only session data. It never crosses into the durable review record. */
  keepSessionSource(sourceRef, file, { label: file.name });
  const next: AlbaranPaperReview = {
    version: 1,
    scope,
    sale: sale.id,
    baseline: previous?.baseline ?? baseline,
    startedAt: previous?.startedAt ?? capturedAt,
    photo: { sourceRef, type: file.type, size: file.size, capturedAt },
    reviewed: undefined,
  };
  if (!publish({ ...book, [key]: next })) {
    discardSessionSource(sourceRef);
    return { ok: false, message: 'Saving this paper review stalled. The photo is still waiting to apply; try again.' };
  }
  if (previous?.photo?.sourceRef && previous.photo.sourceRef !== sourceRef) discardSessionSource(previous.photo.sourceRef);
  return { ok: true };
}

export function useAlbaranPaperReview(scope: string, sale: Sale): AlbaranPaperReview | undefined {
  const state = React.useSyncExternalStore(subscribe, () => book, () => book);
  return state[recordKey(scope, sale.id)];
}

export type PaperStage = 'current' | 'working' | 'stale' | 'final';

/** A local review fingerprint is only a projection guard. Production persists an authoritative
 * revision/event chain; the client uses it so a new line edit or a replacement photo cannot turn
 * an earlier acknowledgement into a false final-paper label. */
function reviewFingerprint(sale: Sale): string {
  return JSON.stringify({
    sale: sale.id,
    customer: sale.customer.id,
    deliveryDay: sale.deliveryDay,
    tier: sale.tier,
    lines: sale.lines.map((line) => ({
      id: line.id, product: line.product.id, ordered: line.ordered, given: line.given,
      /* ⚠ `klass` LEFT THIS FINGERPRINT (FEED-IA §197.2): nothing on the paper states a class. */
      unit: line.unit, unitFactor: line.unitFactor ?? null, price: line.price,
      dimensions: Object.entries(line.dimensions ?? {}).sort(([a], [b]) => a.localeCompare(b)),
      lot: line.lot ?? null, allocations: line.allocations ?? [], amendment: line.amendment ?? null,
      prepNote: line.prepNote ?? null, finalWeight: line.finalWeight ?? null,
      customerOption: line.customerOption ?? null,
    })),
  });
}

export function reviewIsCurrent(sale: Sale, review?: AlbaranPaperReview, sourceReady = true): boolean {
  if (!review?.reviewed) return false;
  void sourceReady; // Availability gates Finish review; accepted reviewed facts survive transient source expiry.
  if (review.photo && review.reviewed.sourceRef !== review.photo.sourceRef) return false;
  return review.reviewed.documentFingerprint === reviewFingerprint(sale);
}

/** A later print is final only after an explicit, still-current review acknowledgement.
 * `reviewComplete` defaults to false so a caller cannot turn an unacknowledged paper into Final. */
export function paperStageOf(sale: Sale, review?: AlbaranPaperReview, reviewComplete = false): PaperStage | null {
  if (!sale.printed) return null;
  if (sale.printed.stale) return 'stale';
  if (review?.reviewed && sale.printed.count > review.reviewed.printedCount && reviewComplete) return 'final';
  return review ? 'working' : 'current';
}

export function finishAlbaranPaperReview(scope: string, sale: Sale, sourceReady: boolean): SaveResult {
  const key = recordKey(scope, sale.id);
  const current = book[key];
  if (!current) return { ok: false, message: 'Start a paper check before finishing it.' };
  if (!sale.printed) return { ok: false, message: 'Print a working paper before finishing this review.' };
  if (current.photo && !sourceReady) return { ok: false, message: 'Select the paper photo again before finishing this review.' };
  const reviewed: ReviewCompletion = {
    at: new Date().toISOString(),
    printedCount: sale.printed.count,
    documentFingerprint: reviewFingerprint(sale),
    ...(current.photo?.sourceRef ? { sourceRef: current.photo.sourceRef } : {}),
  };
  if (!publish({ ...book, [key]: { ...current, reviewed } })) {
    return { ok: false, message: 'Saving this review stalled. Final printing waits for it; try again.' };
  }
  return { ok: true };
}

function bytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AlbaranPaperReviewCard({
  scope,
  sale,
  editable,
  phone,
}: {
  scope: string;
  sale: Sale;
  editable: boolean;
  phone: boolean;
}) {
  const [, theme] = useStyletron();
  const review = useAlbaranPaperReview(scope, sale);
  const field = React.useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = React.useState<{ state: 'idle' | 'ready' | 'missing'; url?: string }>({ state: 'idle' });
  const [pending, setPending] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  /* ── ONE BUTTON UNTIL THERE IS A PAPER CHECK (FEED-IA §254) ──────────────────────────────────
     Peter, 14 September: «the paper shit should be just a button lol». It was a band of four
     sentences standing across the document before anyone had touched a paper — an instruction
     sheet where an act belongs. So a document with nothing checked yet carries ONE act, and the
     moment a check exists — a photo, a reading, a finished review — the seat opens and states it,
     because then it is a fact about this document rather than an offer. A person can open it
     themselves from the same act. */
  const [asked, setAsked] = React.useState(false);

  React.useEffect(() => {
    let url: string | undefined;
    const photo = review?.photo;
    if (!photo) {
      setPreview({ state: 'idle' });
      return () => {};
    }
    const source = sessionSource(photo.sourceRef);
    if (!source) {
      setPreview({ state: 'missing' });
      return () => {};
    }
    url = URL.createObjectURL(source);
    setPreview({ state: 'ready', url });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [review?.photo?.sourceRef]);

  /* THE SAME PHOTOGRAPH, ASKED ABOUT ONCE. `usePaperRead` keys on the source ref, so this seat and
     the read-back dock above it share ONE read and one charge. */
  const photoRef = review?.photo?.sourceRef;
  const held = photoRef ? sessionSource(photoRef) : undefined;
  const { read } = usePaperRead(held, photoRef ?? '');
  const readBack = Boolean(matchedRead(read));
  const sourceReadyForReview = !review?.photo || preview.state === 'ready';
  const reviewComplete = reviewIsCurrent(sale, review, sourceReadyForReview);
  const stage = paperStageOf(sale, review, reviewComplete);
  const sessionPhoto = sessionSourceDetails(review?.photo?.sourceRef);
  const sourceBlocksFinal = Boolean(!reviewComplete && review?.photo && preview.state === 'missing');

  if (!sale.printed || !stage) return null;

  const save = async (file: File) => {
    setSaving(true);
    setError('');
    const result = await retainAlbaranPaperPhoto(scope, sale, file);
    setSaving(false);
    if (result.ok) {
      setPending(null);
      return;
    }
    setPending(file);
    setError(result.message);
  };

  const finish = () => {
    const result = finishAlbaranPaperReview(scope, sale, sourceReadyForReview);
    if (result.ok) setError('');
    else setError(result.message);
  };

  const stageCopy: Record<PaperStage, string> = {
    current: 'Current paper · add a photo or enter the actual figures if this was a working copy.',
    working: sourceBlocksFinal
      ? 'Working paper · the photo is unavailable after this browser session. Add it again and compare the figures before you finish this review.'
      : reviewComplete
        ? 'Working paper · review finished. Print the final copy when you are ready.'
        : 'Working paper · compare the actual figures, then finish the review before you print a final copy.',
    stale: 'Working paper changed · finish checking it again before you print a final copy.',
    final: 'Final paper · printed after the finished correction review.',
  };

  const opened = asked || Boolean(review);

  if (!opened) return (
    <section
      data-testid="albaran-paper-review"
      data-stage={stage}
      data-open="no"
      style={{
        display: 'flex', alignItems: 'center', gap: theme.sizing.scale400,
        padding: theme.sizing.scale500,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundSecondary,
        minWidth: 0,
      }}
    >
      {/* the picker stays mounted in both postures, so a person — and a proof — reaches the
          photograph in one act from either */}
      <input
        ref={field}
        data-testid="albaran-paper-photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) { setAsked(true); void save(file); }
        }}
      />
      <Button kind={KIND.secondary} size={SIZE.compact} data-testid="albaran-paper-open"
        disabled={!editable} onClick={() => setAsked(true)}
        overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Check the paper</Button>
      <span data-testid="albaran-paper-stage" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
        {stage === 'final' ? 'Final paper · printed after the finished correction review.' : 'Compare your paper with this document.'}
      </span>
    </section>
  );

  return (
    <section
      data-testid="albaran-paper-review"
      data-stage={stage}
      data-open="yes"
      style={{
        display: 'grid',
        gridTemplateColumns: review?.photo && preview.state === 'ready' && !phone ? 'minmax(180px, 240px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale500,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundSecondary,
        minWidth: 0,
      }}
    >
      {review?.photo && preview.state === 'ready' && preview.url && (
        <img
          data-testid="albaran-paper-photo"
          src={preview.url}
          alt={`Working paper photograph: ${sessionPhoto?.label ?? 'selected photo'}`}
          style={{ width: '100%', maxHeight: phone ? 320 : 240, objectFit: 'contain', objectPosition: 'left top', borderRadius: theme.borders.radius200, background: theme.colors.backgroundPrimary }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Paper check</span>
        <span data-testid="albaran-paper-stage" style={{ ...theme.typography.LabelSmall }}>{stageCopy[stage]}</span>
        {review?.photo && preview.state === 'ready' && (
          <span data-testid="albaran-paper-source" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            Photo held for this browser session · {sessionPhoto?.label ?? 'Selected photo'} · {bytes(review.photo.size)}. Select it again after a reload.
          </span>
        )}
        {preview.state === 'missing' && <span role="alert" data-testid="albaran-paper-missing" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {reviewComplete ? 'The photo is gone from this session. Your completed review is saved.' : 'The photo is gone from this session. Add it again to finish the review.'}
        </span>}
        <span data-testid="albaran-paper-reading" data-read-back={readBack ? 'yes' : 'no'}
          style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {/* ⚠ SAY WHAT IS. «Photo reading unavailable.» stood here and it spent the reader's
              attention on a thing that is not happening — the copy law's own example of a fact
              that exists only as a denial. What IS, in both postures, is where the work is: on
              the paper in the person's hand, or in the readings above. Cutting the denial loses
              nothing, because the sentence that follows it already said the whole truth. */}
          {readBack
            ? 'Your paper is read above. Check each reading, then accept the ones you want.'
            : 'Enter the changes from your paper, then finish the review.'}
        </span>
        {review && stage !== 'final' && <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          <span data-testid="albaran-paper-review-state" data-review-finished={reviewComplete ? 'yes' : 'no'} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            {reviewComplete ? 'Review finished · ready to print the final copy.' : sourceBlocksFinal ? 'Review in progress · add the photo again before relying on it.' : 'Review in progress · finish it after you compare the figures.'}
          </span>
          {editable && <Button kind={KIND.primary} size={SIZE.mini} data-testid="albaran-paper-review-finish" disabled={!sourceReadyForReview || saving} onClick={finish}>
            Finish review
          </Button>}
        </div>}
        {editable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <input
              ref={field}
              data-testid="albaran-paper-photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void save(file);
              }}
            />
            <Button kind={KIND.secondary} size={SIZE.mini} data-testid="albaran-paper-photo-add" disabled={saving} onClick={() => field.current?.click()}>
              {saving ? 'Adding photo…' : phone ? (review?.photo ? 'Retake photo' : 'Take photo') : (review?.photo ? 'Replace photo' : 'Upload photo')}
            </Button>
            {pending && <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="albaran-paper-photo-retry" disabled={saving} onClick={() => void save(pending)}>Try again</Button>}
          </div>
        )}
        {error && <span role="alert" data-testid="albaran-paper-photo-error" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{error}</span>}
      </div>
    </section>
  );
}
