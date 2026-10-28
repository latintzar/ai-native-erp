/* THE ALBARÁN'S SOURCE — capture, extraction, and the mark on the paper (FEED-IA §191.1 · §196.5)
 *
 * §191.1 gave this surface ONE capture grammar: the source arrives the way the device allows, it
 * becomes a contained evidence card in the same task, and «a capture is not an OCR result».
 * §196.5 (E193.05) finishes the sentence Peter left open — «for the parsing and qr shit… maybe
 * use parsewise so its solid cos like im not sure that for the tabular data if claude ocr will be
 * best» — by sending the source to a document engine through the kit runtime, and by making the
 * packing mark READABLE here as well as printable there.
 *
 * The order of the four things on this surface is the order of the work:
 *   the doors  → the source card → what was read off it → the lines it proposes.
 * Every one of them is honest about itself. A runtime that is not there says «Runtime · not
 * reachable» and the source stays on screen with the manual road open beside it; a row that
 * matches nothing the house sells stays a proposal and is never written.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Glyph, STEP, hasGlyph, type GlyphId } from './glyphs';
import {
  albaranIntakeSource,
  albaranIntakeSourceDetails,
  removeAlbaranIntake,
  retainAlbaranIntake,
  useAlbaranIntake,
  type AlbaranIntakeKind,
} from './albaran-intake-memory';
import { EXTRACTION_COPY, PARSE_ACCEPT, isExtractable, useExtraction } from './parsing';
import { ProposalRows, SourceButton, proposalNumber, readingSentence, readyProposals, useProposals } from './intake-road';
import { matchedRead, usePaperRead } from './paper-read';
import { PaperReadBack } from './paper-read-back';
import { QrScanner, QR_COPY } from './qr-read';
import { packingLocatorToken, packingOutputs, resolvePackingLocator, type PackingRun } from './packing-output';
import { addLine, buildSales, canPrepare, dayLabelFromId, newSaleId, salesOfDay, sheetSalesOf, type Sale } from './sale';
import { nowOf, useDay } from './day';
import { useConfig } from './config';
import { usePhone } from './shell/viewport';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { capabilityAvailable } from './release-profile';
import { priceOf } from '../../scenarios/canonical/resolution';
import type { ParsedRow } from './runtime-client';
import type { SectorId } from '../../scenarios/meta';

/** THE READER'S OWN MARK. A QR is a grid of modules, and the register has no member for it — so
 *  this READS one where the vocabulary grows one, and stands on the camera until then. The want is
 *  reported rather than smuggled in: `scan` belongs in `glyphs.tsx` (§30), and two doors on one row
 *  wearing the same mark is the collision §54.4 names. */
const SCAN_MARK: GlyphId = hasGlyph('scan') ? ('scan' as GlyphId) : 'camera';

const SOURCE_COPY: Record<AlbaranIntakeKind, string> = {
  photo: 'Photo',
  file: 'File',
  paste: 'Pasted order',
};

function usePreview(sourceRef: string | undefined): string | undefined {
  const [url, setUrl] = React.useState<string>();
  React.useEffect(() => {
    const source = albaranIntakeSource(sourceRef);
    if (!source || !source.type.startsWith('image/')) {
      setUrl(undefined);
      return () => {};
    }
    const next = URL.createObjectURL(source);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [sourceRef]);
  return url;
}

/** THE HOUSE'S OWN BOOK, where this surface can reach it. `sale.ts` folds the document out of the
 *  cast and the day's events, so the source card can find the draft it is attached to and write
 *  lines onto it with the SAME act the hand uses — no second road into the ledger (§41.4). */
function useHouse(sale: string | null | undefined): { cast: ReturnType<typeof useConfig>['derived']['cast']; now: string; document?: Sale; runs: PackingRun[] } {
  const { derived } = useConfig();
  const cast = derived.cast;
  const edits = useDay(cast.sector);
  const sales = React.useMemo(() => buildSales(cast, edits, { includeArchived: true }), [cast, edits]);
  /* ── WHICH SETS A LOCATOR MAY NAME (THE-QR-SPEC QR-06) ──────────────────────────────────────
   * A packing mark folds the run it was printed over, so resolving one means asking «which set of
   * this house's documents folds to that?». The sets a house actually prints are the day's SHEET
   * sales — `sheetSalesOf`, the same filter the river's own packing shortcut takes its scope from
   * — and, where that filter takes nothing out, the day itself. Both are offered, deduped, so a
   * mark off either paper resolves and a mark off neither is honestly unknown. */
  const runs = React.useMemo(() => {
    const live = sales.filter((row) => !row.archived);
    const days = [...new Set(live.map((row) => row.day))];
    const seen = new Set<string>();
    const out: PackingRun[] = [];
    days.forEach((day) => {
      const rows = salesOfDay(live, day);
      /* The three sets a packing press can walk: the day's own paper set (`sheetSalesOf`, the
         river's scope), the print view's own walk (prepare-or-sent), and the whole day. Whichever
         one the paper in the hand was printed over, it is one of these — and a mark off none of
         them is honestly unknown rather than forced onto the nearest. */
      [sheetSalesOf(rows), rows.filter((row) => canPrepare(row) || row.state === 'sent'), rows]
        .forEach((set) => {
          if (!set.length) return;
          const key = day + '|' + set.map((row) => row.id).sort().join(',');
          if (seen.has(key)) return;
          seen.add(key);
          out.push({ day, sales: set });
        });
    });
    return out;
  }, [sales]);
  return { cast, now: nowOf(cast), document: sale ? sales.find((row) => row.id === sale) : undefined, runs };
}

/* ── WHAT THE PAPER PROPOSED, BEFORE ANYBODY AGREED TO IT (§191.1) ───────────────────────────
 * A read gives rows. A row is a PROPOSAL: the goods the paper named, matched against the house's
 * own catalogue, with the quantity in a seat a hand can correct before anything is written. A row
 * that matches nothing the house sells says so and stays out of the count — the albarán may only
 * carry things the house sells, and inventing an SKU to make a number land is the exact failure
 * §191.7 named («neither synthetic codes nor invented category relations fill the gap»).
 *
 * E200.08 · THE ROW GRAMMAR ITSELF NOW LIVES IN `intake-road.tsx`, because §196.5 named three
 * kinds of document and the supplier list and the stock sheet propose their rows the same way
 * this one does. What stays here is what only an albarán knows: the price list its lines take
 * their rate from, and the ledger event that writes them. */
function ProposedLines({
  document_,
  cast,
  now,
  rows,
  onApplied,
}: {
  document_: Sale;
  cast: ReturnType<typeof useConfig>['derived']['cast'];
  now: string;
  rows: ParsedRow[];
  onApplied: (count: number) => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { pricing } = useWorkspaceCapabilities();
  const pricingAvailable = capabilityAvailable('pricing') && pricing;
  const [proposals, setQty] = useProposals(rows, cast.products);
  const ready = readyProposals(proposals);

  /* ONE ACT, AND IT IS THE SAME ACT THE HAND MAKES. `addLine` is the composer's own event; the
     price is the house's price list, exactly as the manual road takes it, so a paper can state a
     figure without rewriting what the house sells at (§191.4). The stated figure stays visible
     beside the row as evidence, and §192.2's type-in-place editor owns it from there. */
  const put = () => {
    let written = 0;
    ready.forEach((item) => {
      if (!item.product) return;
      const unit = (item.row.unit || '').trim() || item.product.unit;
      const rate = pricingAvailable ? priceOf(cast, item.product) : 0;
      addLine(document_, now, item.product, proposalNumber(item.qty), unit, rate);
      written += 1;
    });
    onApplied(written);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <ProposalRows
        testid="albaran-intake-proposed"
        proposals={proposals}
        onQty={setQty}
        phone={phone}
        /* SAY WHAT IT IS, NOT WHAT IT LACKS. «Not in the catalogue» spends the sentence on the
           miss; «New to the house» states the fact and hands the work back. */
        unmatched="New to the house · write this line yourself"
      />
      <Button
        kind={KIND.primary}
        size={SIZE.compact}
        data-testid="albaran-intake-apply"
        disabled={ready.length === 0}
        onClick={put}
        overrides={{ BaseButton: { style: { minHeight: '44px', alignSelf: 'flex-start' } } }}
      >
        {'Put ' + String(ready.length) + ' line' + (ready.length === 1 ? '' : 's') + ' on the delivery note'}
      </Button>
    </div>
  );
}

/** WHAT THE RUNTIME MADE OF THE SOURCE — one seat, four postures, one honest sentence each.
 *
 * ═══ AND THE FIRST QUESTION IS «IS THIS OUR OWN PAPER?» (E196 · the read contract) ══════════
 * A photograph arriving here is one of two things, and they take different roads:
 *
 *   OUR PACKING LIST, marked up in the bay → the runtime holds the layout it was printed from, so
 *     every box on it is read against a known millimetre and the answer is a READ-BACK REVIEW:
 *     the final weights, beside the ink they were written in, ready to land on their own lines.
 *   SOMEBODY ELSE'S DOCUMENT — a customer's order, a supplier's note → nobody recorded its
 *     geometry, so it goes to Parsewise exactly as it always has (§196.5).
 *
 * The paper question is asked FIRST and the extraction waits on its answer, so one photograph is
 * never charged to two providers. The seat says «Reading…» throughout, because from the person's
 * side there is one wait and one document, whichever road it turns out to be on.
 */
function ExtractionState({ scope, sale, sourceRef, mime }: { scope: string; sale: string; sourceRef: string; mime: string }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { cast, now, document: document_ } = useHouse(sale);
  const source = albaranIntakeSource(sourceRef);
  const details = albaranIntakeSourceDetails(sourceRef);
  const name = (details as { label?: string } | undefined)?.label ?? '';
  const extractable = source ? isExtractable(source, name) : /^(image\/|application\/pdf)/.test(mime);
  /* Only a PHOTOGRAPH can be a photograph of our paper. A PDF, a spreadsheet or a pasted table
     never was, so those never ask the question and go straight to the extractor. */
  const photo = source && source.type.startsWith('image/') ? source : undefined;
  const { read } = usePaperRead(photo, sourceRef);
  const ours = matchedRead(read);
  const decided = !photo || (read !== undefined && read.state !== 'reading');
  const { extraction, retry } = useExtraction(extractable && decided && !ours ? source : undefined, 'albaran', sourceRef);
  const [put, setPut] = React.useState(0);
  React.useEffect(() => setPut(0), [scope, sale, sourceRef]);
  /* THE READ-BACK IS THE ANSWER, AND IT REPLACES THE PROPOSAL. One document, one review. */
  if (ours) {
    return (
      <PaperReadBack scope={scope} source={photo} sourceKey={sourceRef} phone={phone} />
    );
  }
  /* ⚠ ONLY A PENDING PAPER QUESTION DRAWS THE WAITING SEAT. A pasted table has no extraction and
     never had one — it is read exactly, here — so it must keep drawing NOTHING, exactly as before.
     A seat that said «Reading the document…» forever over a text paste would be the software
     narrating a wait that is not happening. */
  if (!extraction && photo && !decided) {
    /* The paper question is still out. The seat keeps its shape and its one honest word, so the
       wait reads as ONE wait rather than as an empty box that fills later. */
    return (
      <div data-testid="albaran-intake-extraction" data-state="reading" data-provider="parsewise"
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
        <span data-testid="albaran-intake-evidence" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {EXTRACTION_COPY.reading}
        </span>
      </div>
    );
  }
  if (!extraction) return null;
  const state = extraction.state;
  return (
    <div data-testid="albaran-intake-extraction" data-state={state} data-provider="parsewise"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <span data-testid="albaran-intake-evidence" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0, overflowWrap: 'anywhere' }}>
          {/* E195.20 · a read that came back with no line to press is a terminal state too, so it
              hands the work back in the same sentence the other postures use — and it is the SAME
              FUNCTION the two new intake doors use (E200.08's `readingSentence`), so one sentence
              exists per posture across all three surfaces rather than three copies of a ladder. */}
          {readingSentence(extraction, EXTRACTION_COPY.fallback,
            state !== 'reading' && !(state === 'read' && extraction.result.rows.length > 0))}
        </span>
        {(state === 'unreachable' || state === 'unavailable') && (
          <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="albaran-intake-retry" onClick={retry}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
            {EXTRACTION_COPY.retry}
          </Button>
        )}
      </span>
      {state === 'read' && document_ && put === 0 && extraction.result.rows.length > 0 && (
        <ProposedLines document_={document_} cast={cast} now={now} rows={extraction.result.rows} onApplied={setPut} />
      )}
      {put > 0 && (
        <span role="status" data-testid="albaran-intake-applied" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {String(put) + ' line' + (put === 1 ? '' : 's') + ' on the delivery note. Every value is yours to correct on the line.'}
        </span>
      )}
    </div>
  );
}

export function AlbaranIntakeSourceCard({
  scope,
  sale,
  removable = true,
  inset = false,
}: {
  scope: string;
  sale: string;
  removable?: boolean;
  inset?: boolean;
}) {
  const [, theme] = useStyletron();
  const source = useAlbaranIntake(scope, sale);
  const preview = usePreview(source?.sourceRef);
  const details = albaranIntakeSourceDetails(source?.sourceRef);
  const [removeError, setRemoveError] = React.useState('');
  React.useEffect(() => setRemoveError(''), [scope, sale, source?.sourceRef]);
  if (!source) return null;
  return (
    <section
      data-testid="albaran-intake-source"
      data-source-kind={source.kind}
      style={{
        display: 'grid',
        gridTemplateColumns: preview ? '72px minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: theme.sizing.scale400,
        border: '1px solid ' + theme.colors.borderOpaque,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
        margin: inset ? theme.sizing.scale400 : 0,
      }}
    >
      {preview && <img src={preview} alt="" style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: theme.borders.radius200 }} />}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelSmall }}>{SOURCE_COPY[source.kind]}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {details ? 'Ready to compare with the order lines' : 'Select the source again to reopen it'}
        </span>
      </span>
      {removable && (
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          aria-label="Remove source"
          data-testid="albaran-intake-remove"
          onClick={() => {
            if (removeAlbaranIntake(scope, sale)) setRemoveError('');
            else setRemoveError('Removing the source stalled. Try again.');
          }}
        >
          Remove
        </Button>
      )}
      {/* THE READING STANDS UNDER THE SOURCE IT CAME OFF (§196.5). One card: the paper, what was
          read, and the lines it proposes — so nobody has to hold two things in their head. */}
      {details && (
        <span style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <ExtractionState scope={scope} sale={sale} sourceRef={source.sourceRef} mime={source.mime} />
        </span>
      )}
      {removeError && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative, gridColumn: '1 / -1' }}>{removeError}</span>}
    </section>
  );
}

/* ── THE PACKING MARK, READ BACK (§196.5 · §191.1) ───────────────────────────────────────────
 * The bay's paper carries a locator. Scanning it here says WHICH packing run the paper in the
 * hand is, and whether the run has moved since it was printed — which is the whole reason the
 * mark exists. The camera, the bundle's decoder and the typed code all arrive at the same place;
 * `qr-read.tsx` owns the ladder between them. */
function ScannedLocator({ locator, runs, sector, onClear }: { locator: string; runs: PackingRun[]; sector: SectorId; onClear: () => void }) {
  const [, theme] = useStyletron();
  const printed = React.useSyncExternalStore(packingOutputs.subscribe, packingOutputs.getSnapshot, packingOutputs.getSnapshot);
  const reading = resolvePackingLocator(locator, runs, printed, sector);
  return (
    <section data-testid="albaran-intake-locator" data-known={reading ? 'yes' : 'no'} data-current={reading?.current ? 'yes' : 'no'}
      style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, padding: theme.sizing.scale400, border: '1px solid ' + theme.colors.borderOpaque, borderRadius: theme.borders.radius300, minWidth: 0 }}>
      <Glyph id="packing" size={STEP.small} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>
          {reading ? 'Packing list · ' + dayLabelFromId(reading.day) + ' · ' + String(reading.sales.length) + ' order' + (reading.sales.length === 1 ? '' : 's') : QR_COPY.unknown}
        </span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
          {reading
            ? (reading.current ? 'This paper matches the run.' : 'The run moved after this paper was printed. Check it against the lines.')
            : packingLocatorToken(locator)}
        </span>
      </span>
      <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="albaran-intake-locator-clear" onClick={onClear}
        overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Clear</Button>
    </section>
  );
}

export function AlbaranIntakePicker({
  scope,
  sale,
  ensureSale,
  phone,
}: {
  scope: string;
  sale: string | null | undefined;
  ensureSale: (reservedId: string) => string;
  phone: boolean;
}) {
  const [, theme] = useStyletron();
  const camera = React.useRef<HTMLInputElement | null>(null);
  const upload = React.useRef<HTMLInputElement | null>(null);
  const [pasting, setPasting] = React.useState(false);
  const [pasted, setPasted] = React.useState('');
  const [error, setError] = React.useState('');
  const [scanning, setScanning] = React.useState(false);
  const [locator, setLocator] = React.useState('');
  /* Attaching a source can be the act that creates the draft. The parent receives that draft
     through the event ledger, so its `sale` prop follows on the next fold; keep the minted id
     locally for that short handover so the source appears under the same press that attached it. */
  const [attachedSale, setAttachedSale] = React.useState<string | null>(sale ?? null);
  React.useEffect(() => {
    if (sale) setAttachedSale(sale);
  }, [sale]);
  const effectiveSale = sale || attachedSale;
  const source = useAlbaranIntake(scope, effectiveSale);
  const { runs } = useHouse(effectiveSale);

  const attach = (kind: AlbaranIntakeKind, blob: Blob, label?: string) => {
    const reservedId = sale || newSaleId();
    /* The source metadata commits before an unborn draft is appended. Rejected bytes or storage
       failure therefore create no document; a birth exception rolls the prepared source back. */
    const result = retainAlbaranIntake(scope, reservedId, kind, blob, label);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    try {
      const id = sale || ensureSale(reservedId);
      if (id !== reservedId) {
        removeAlbaranIntake(scope, reservedId);
        setError('Attaching the source to the new delivery note stalled. Try again.');
        return;
      }
      setAttachedSale(id);
      setError('');
      setPasting(false);
      setPasted('');
    } catch {
      removeAlbaranIntake(scope, reservedId);
      setError('Creating the delivery note stalled. Select or paste the source again and try again.');
    }
  };

  return (
    <div data-testid="albaran-intake-picker" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        data-testid="albaran-intake-camera-input"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) attach('photo', file, 'Order photo');
        }}
      />
      <input
        ref={upload}
        type="file"
        accept={PARSE_ACCEPT}
        data-testid="albaran-intake-file-input"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) attach('file', file, file.name);
        }}
      />
      {!source && (
        <div style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(112px, 1fr))', gap: theme.sizing.scale300 }}>
          <SourceButton icon="camera" testid="albaran-intake-take-photo" onClick={() => camera.current?.click()}>Take photo</SourceButton>
          <SourceButton icon="file" testid="albaran-intake-upload" onClick={() => upload.current?.click()}>Upload file</SourceButton>
          <SourceButton icon="note" testid="albaran-intake-paste" onClick={() => setPasting(true)}>Paste</SourceButton>
          {/* THE FOURTH DOOR IS THE MARK (§196.5). A packing sheet already carries the code that
              says which document it is, so reading it is a way of ARRIVING at the work. */}
          <SourceButton icon={SCAN_MARK} testid="albaran-intake-scan" onClick={() => setScanning(true)}>Scan code</SourceButton>
        </div>
      )}
      {scanning && !locator && (
        <QrScanner
          testid="albaran-intake-scanner"
          onRead={(read) => { setLocator(read); setScanning(false); }}
          onClose={() => setScanning(false)}
        />
      )}
      {locator && <ScannedLocator locator={locator} runs={runs} sector={scope as SectorId} onClear={() => setLocator('')} />}
      {pasting && !source && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          <textarea
            autoFocus
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder="Paste the handwritten note or table"
            aria-label="Paste the order"
            data-testid="albaran-intake-paste-field"
            style={{
              minHeight: 112,
              resize: 'vertical',
              padding: theme.sizing.scale400,
              border: '1px solid ' + theme.colors.borderOpaque,
              borderRadius: theme.borders.radius300,
              background: theme.colors.backgroundPrimary,
              color: theme.colors.contentPrimary,
              font: 'inherit',
              outline: 'none',
            }}
          />
          <span style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale300 }}>
            <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => { setPasting(false); setPasted(''); }}>Cancel</Button>
            <Button
              kind={KIND.primary}
              size={SIZE.mini}
              disabled={!pasted.trim()}
              data-testid="albaran-intake-use-paste"
              onClick={() => attach('paste', new Blob([pasted], { type: 'text/plain' }), 'Pasted order')}
            >
              Use text
            </Button>
          </span>
        </div>
      )}
      {effectiveSale && source && <AlbaranIntakeSourceCard scope={scope} sale={effectiveSale} />}
      {error && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{error}</span>}
    </div>
  );
}
