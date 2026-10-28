/* PARKED (THE-APP-V2 §1): Goods is Stock's subject now — product cards carry on-hand, the par rule and the lot book. Out of the area glob; the file stays readable and still typechecks. */
/* GOODS — B/D/E composed, and the heaviest surface in the app on purpose. APP-B.
 *
 * ═══ WHY THIS SCREEN CARRIES THE WEIGHT (LOT-LAW §"What this means" §1) ══════════════════════
 * Goods-in is the only moment the supplier's albarán is physically in hand, and one capture there
 * serves every downstream line for that batch. So la captura and the doc-check are the most
 * invested screens in the product, and picking and dispatch become pure lookup because of what
 * happens here. Deferring any of it to invoicing is the trap §7 names: thirty days of missing
 * lotes for trucks that left three weeks ago.
 *
 * WHAT STANDS ON THIS ONE SURFACE, and what the answers do to it:
 *   · LA CAPTURA — three doors, one uploader. `goodsIn.door` decides which is FRONT; the other two
 *     stay one tap away, on every account.
 *   · THE DOC-CHECK — the arrival's moment. The sheet and the reading stand beside each other, the
 *     two checks a supplier's albarán actually has are computed at the foot, and the lotes this
 *     arrival creates are settled here — including the one the supplier gave no code for, which is
 *     synthesised in one tap on the sector's own published convention (§9).
 *   · STOCK — the Stock Announcement as the declaration instrument, and StockLevel rows showing the
 *     PAPER TRAIL against the WORKING REALITY. `stock.mode` decides which of the three leads; stock
 *     is quiet where they track none, and present on every account.
 *   · THE BATCH BOOK — the lotes, editable in the grid, one record open beside it, and the line
 *     that points at TWO batches. A 40 kg line served from two lotes is ordinary and never splits
 *     the commercial line (§2).
 *
 * THE PUZZLE ASSEMBLES EXISTING PIECES: `captura`, `doc-check`, `stock-announcement`, `grid`,
 * `batch-record` and `batch-line` are all as the catalogue built them.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { AspectRatioBox, AspectRatioBoxBody } from 'baseui/aspect-ratio-box';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Captura, DOOR, type Door, type FileRow } from '../../../../rocoto/captura';
import { Paper } from '../../../../rocoto/paper';
import { Figure } from '../../figure';
import {
  StockAnnouncement,
  StockLevel,
  EVIDENCE,
  FEED,
  MODE,
  SOURCE,
  type Mode,
  type Source,
} from '../../../../rocoto/stock-announcement';
import DocCheck, { type DocCheckRow } from '../../../../scenarios/canonical/doc-check';
import Grid, { type GridRow } from '../../../../scenarios/canonical/grid';
import BatchRecord from '../../../../scenarios/canonical/batch-record';
import BatchLine, { type Allocation } from '../../../../scenarios/canonical/batch-line';
import { AGES } from '../../../../scenarios/canonical/margin-desk';
import Name from '../../../../scenarios/shell/Name';
import {
  batchOf,
  familyOf,
  productOf,
  supplierOf,
  type Batch,
  type Cast,
} from '../../../../scenarios/data/cast';
import { useConfig } from '../../config';
import { Derivation } from '../../anchors';
import Page from '../../shell/page';
import type { AreaMeta } from '../../shell/area';

export const meta: AreaMeta = {
  id: 'goods',
  title: 'Goods',
  owner: 'APP-B',
};

const GOODS_IN = 'goods-in';

/* ── THE SECTION ─────────────────────────────────────────────────────────────────────────────
 * Same anatomy as Prices: a heading that names the thing, a line that says what it is for, and the
 * derivation that shaped it riding the block it shaped. `lit` is how a pointer elsewhere on the
 * surface says «the thing you asked for is HERE» when it lands.
 */
function Block({
  id,
  title,
  lead,
  derivation,
  actions,
  lit,
  children,
}: {
  id: string;
  title: string;
  lead?: React.ReactNode;
  derivation?: React.ReactNode;
  actions?: React.ReactNode;
  lit?: boolean;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <section
      id={id}
      data-block={id}
      data-lit={lit ? 'yes' : 'no'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale600,
        minWidth: 0,
        borderRadius: theme.borders.radius300,
        outline: lit ? `2px solid ${theme.colors.contentPrimary}` : '2px solid transparent',
        outlineOffset: theme.sizing.scale400,
        transition: `outline-color ${theme.animation.timing300} ${theme.animation.easeOutCurve}`,
      }}
    >
      <header style={{ display: 'flex', gap: theme.sizing.scale600, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h2>
          {lead && (
            <p style={{ margin: `${theme.sizing.scale200} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '72ch' }}>
              {lead}
            </p>
          )}
        </div>
        {actions}
      </header>
      {derivation}
      {children}
    </section>
  );
}

/* ── THE ARRIVAL, BUILT FROM THE CAST ────────────────────────────────────────────────────────
 * The sheet a supplier sent this morning: one row per lote that landed, the family's own field set
 * under each name, and the packages the count check reads. One row's cost disagrees with the
 * reading, because the check exists for the morning one does.
 */

/** How far the sheet stands from the reading, on the one row that disagrees. */
const DISAGREEMENT = 0.42;

/** The lote code the supplier's sheet carried, or nothing where the sheet carried none. The LAST
 *  line is the one that arrived without a code, which is the ordinary case §9 is written for. */
const suppliedLot = (batches: Batch[], index: number): string | undefined =>
  index === batches.length - 1 ? undefined : batches[index].id;

/** THE SECTOR'S OWN CONVENTION, as one tap (LOT-LAW §9). FEDEPESCA and ADEPESCA publish
 *  `L + iniciales + fecha`; the initials come off the supplier the cast holds and the date off the
 *  day it landed, so nothing here is invented — a synthesised, documented, consistent code is what
 *  the trade does and what an inspector accepts. */
export function synthesiseLot(cast: Cast, batch: Batch): string {
  const supplier = supplierOf(cast, batch.supplier);
  const initials = supplier.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return `L-${initials}${batch.day.replace('.', '')}`;
}

function buildSheet(cast: Cast, lots: Record<string, string | undefined>): DocCheckRow[] {
  return cast.batches.map((b, i) => {
    const product = productOf(cast, b.product);
    const family = familyOf(cast, product);
    const lot = lots[b.id];
    const fields = family.lineFields.includes('lote') ? family.lineFields : ['lote', ...family.lineFields];
    return {
      id: b.id,
      name: <Name of={product} />,
      sub: fields.map((label) => ({
        label,
        value: label === 'lote' ? lot ?? 'awaiting a code' : product.trace[label] ?? '',
      })),
      qty: b.qty,
      unit: product.unit,
      packs: product.pack
        ? { count: Math.max(1, Math.round(b.qty / product.pack.factor)), unit: product.pack.unit }
        : undefined,
      cost: b.cost,
      per: `S/ per ${product.unit}`,
      docCost: i === cast.batches.length - 1 ? Math.round((b.cost + DISAGREEMENT) * 100) / 100 : undefined,
    };
  });
}

/** A photograph of a sheet IS a sheet, so the viewfinder draws the real thing at a thumbnail's
 *  scale through el papel rather than standing in a picture of one. */
function MiniSheet({ masthead, rows }: { masthead: React.ReactNode; rows: DocCheckRow[] }) {
  return (
    <Paper
      format="a4"
      scale={0.3}
      masthead={masthead}
      columns={[
        { key: 'product', label: 'Producto', width: 'minmax(0, 1.6fr)' },
        { key: 'qty', label: 'Cantidad', width: '90px', align: 'end' },
        { key: 'cost', label: 'Precio', width: '96px', align: 'end' },
      ]}
      rows={rows.map((r) => ({
        id: r.id,
        cells: {
          product: r.name,
          qty: `${r.qty} ${r.unit}`,
          cost: `${r.cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${r.per}`,
        },
        sub: r.sub,
      }))}
    />
  );
}

/* ── GOODS IN ─────────────────────────────────────────────────────────────────────────────── */

const FRONT_DOOR: Record<string, Door> = {
  paper: DOOR.camera,
  email: DOOR.arrived,
  both: DOOR.camera,
};

function GoodsIn({
  cast,
  lots,
  onSynthesise,
  lotsMode,
}: {
  cast: Cast;
  lots: Record<string, string | undefined>;
  onSynthesise: (batchId: string) => void;
  lotsMode: 'print' | 'reference' | 'none';
}) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const front = FRONT_DOOR[derived.goods.frontDoor] ?? DOOR.camera;

  const [door, setDoor] = React.useState<Door>(front);
  const [shot, setShot] = React.useState(false);
  const [fileRows, setFileRows] = React.useState<FileRow[]>([]);

  const supplier = supplierOf(cast, cast.batches[0].supplier);
  const sheet = React.useMemo(() => buildSheet(cast, lots), [cast, lots]);

  /* WHAT THE PERSON SETTLED, HELD AS ITS OWN FACT rather than as an edited copy of the sheet.
     The sheet is rebuilt whenever a lote is attached — the new code has to reach the row's own
     field set — and a rebuilt copy would quietly undo a resolution somebody had already given.
     So the rows are the sheet WITH the decisions laid over it, and neither can lose the other. */
  const [settled, setSettled] = React.useState<Record<string, 'sheet' | 'reading'>>({});

  /* the sector switch hands this surface a different account, whose supplier sent a different
     sheet — so the lorry has not been photographed yet either */
  React.useEffect(() => {
    setDoor(front);
    setShot(false);
    setFileRows([]);
    setSettled({});
  }, [cast, front]);

  const rows = React.useMemo(
    () =>
      sheet.map((r) => {
        const take = settled[r.id];
        if (!take || r.docCost === undefined) return r;
        return { ...r, cost: take === 'sheet' ? r.docCost : r.cost, docCost: undefined };
      }),
    [sheet, settled],
  );

  const statedTotal = React.useMemo(
    () => Math.round(sheet.reduce((s, r) => s + r.qty * (r.docCost ?? r.cost), 0) * 100) / 100,
    [sheet],
  );

  /* A DOCUMENT EXISTS once the shutter has been pressed, once a file has been dropped, or the
     moment the arrived door is open — because on that door nobody chose the file: it was already
     here, and the first act available is reading it. */
  const hasDocument = (door === DOOR.camera && shot) || door === DOOR.arrived || fileRows.length > 0;

  const capture = () => {
    if (shot) return;
    setShot(true);
    const file = new File([new Blob()], `albaran-${cast.batches[0].id}.jpg`, { type: 'image/jpeg' });
    setFileRows([
      { errorMessage: null, file, id: cast.batches[0].id, progressAmount: 100, status: 'processed' },
    ]);
  };

  const settle = (id: string, take: 'sheet' | 'reading') =>
    setSettled((prev) => ({ ...prev, [id]: take }));

  const masthead = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <strong>
        <Name of={supplier} />
      </strong>
      <span>
        Delivery Note {cast.batches[0].id} · {cast.batches[0].day}
      </span>
    </div>
  );

  const missing = cast.batches.filter((b) => !lots[b.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)',
          gap: theme.sizing.scale700,
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <Captura
          door={door}
          doors={[DOOR.camera, DOOR.drop, DOOR.arrived]}
          onDoorChange={setDoor}
          onCapture={capture}
          framed={shot}
          label="The supplier’s document"
          viewfinder={
            shot ? (
              <AspectRatioBox aspectRatio={210 / 297} width="100%">
                <AspectRatioBoxBody
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  overflow="hidden"
                  backgroundColor={theme.colors.backgroundSecondary}
                >
                  <MiniSheet masthead={masthead} rows={sheet} />
                </AspectRatioBoxBody>
              </AspectRatioBox>
            ) : undefined
          }
          labels={{ shutter: 'Take the photo', framed: 'Keep it' }}
          arrived={{
            from: <Name of={supplier} />,
            subject: `Delivery Note ${cast.batches[0].id}`,
            at: `landed ${cast.batches[0].day} · it was already here`,
          }}
          fileRows={fileRows}
          setFileRows={setFileRows}
          hint="The document stays with the batch it created."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          {hasDocument ? (
            <DocCheck
              rows={rows}
              layout="stacked"
              showDocument={false}
              masthead={masthead}
              statedTotal={statedTotal}
              found={rows.length}
              listed={sheet.length}
              readingTitle="What Rocoto read"
              photographed={
                <>
                  This is the arrival&rsquo;s moment: one capture here serves every line that draws on
                  these lotes for the rest of the week.
                </>
              }
              renderResolve={(r) =>
                r.docCost !== undefined ? (
                  <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, flex: 1, minWidth: '18ch' }}>
                      The sheet prints {r.docCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} {r.per}.
                    </span>
                    <Button
                      kind={KIND.primary}
                      size={SIZE.mini}
                      data-testid="take-sheet"
                      onClick={() => settle(r.id, 'sheet')}
                    >
                      Take the sheet’s
                    </Button>
                    <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => settle(r.id, 'reading')}>
                      Keep ours
                    </Button>
                  </div>
                ) : null
              }
            />
          ) : (
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '56ch' }}>
              Take the photo, drop the file, or open the document that arrived — the check stands
              here the moment a sheet exists.
            </p>
          )}
        </div>
      </div>

      {/* ── THE LOTES THIS ARRIVAL CREATES ─────────────────────────────────────────────────────
          The lote attaches to the BATCH, once, here — and the one the supplier sent no code for is
          given one on the trade's own published convention, in a tap. */}
      <div
        data-testid="lot-strip"
        style={{
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          background: theme.colors.backgroundPrimary,
          padding: theme.sizing.scale600,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale500,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>The lotes this arrival creates</h3>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            {cast.batches.length - missing.length} of {cast.batches.length} carry a code
          </span>
        </div>

        {cast.batches.map((b) => {
          const product = productOf(cast, b.product);
          const code = lots[b.id];
          return (
            <div
              key={b.id}
              data-lot-row={b.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                gap: theme.sizing.scale500,
                alignItems: 'center',
              }}
            >
              <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>
                <Name of={product} />
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                  {' · '}
                  {b.qty} {product.unit} · landed {b.day}
                </span>
              </span>
              {code ? (
                <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                  {code}
                </Tag>
              ) : (
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  The sheet carried the goods and left the code to us
                </span>
              )}
              {code ? (
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                  on every delivery note that draws on it
                </span>
              ) : (
                <Button
                  kind={KIND.secondary}
                  size={SIZE.mini}
                  shape={SHAPE.pill}
                  data-testid={`synthesise-${b.id}`}
                  onClick={() => onSynthesise(b.id)}
                >
                  Give it {synthesiseLot(cast, b)}
                </Button>
              )}
            </div>
          );
        })}

        <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, maxWidth: '80ch' }}>
          The code follows the trade&rsquo;s own published convention — the supplier&rsquo;s initials and
          the day it landed — so it reads the same way to an inspector as to the person who wrote it.
          {lotsMode === 'reference'
            ? ' The delivery note points at this document, and the pointer opens it.'
            : lotsMode === 'print'
              ? ' The delivery note prints it on every line it fills.'
              : ' The delivery note carries origen and categoría, and the code rides along with them.'}
        </p>
      </div>
    </div>
  );
}

/* ── STOCK ────────────────────────────────────────────────────────────────────────────────────
 * «Telling customers "let me check if we actually have some" and it puts that order for review
 * because it knows it's out of stock» (THE-ALBARAN-THESIS §5). Inventory's job is to gate the sale
 * and route what cannot be served — the albarán itself needs none of it.
 *
 * TWO THINGS, VISIBLY DIFFERENT. The PAPER TRAIL is the documented stock, evidenced by the
 * albaranes that arrived. The WORKING REALITY is what the person says is there right now, and it
 * is an OVERRIDE: it wins, deliberately and visibly, and the trail survives underneath it with its
 * document still one press away.
 */

type Declaration = { amount: number; at: Date };

function Stock({
  cast,
  voice,
  onOpenEvidence,
}: {
  cast: Cast;
  voice: 'declared' | 'connected' | 'quiet';
  onOpenEvidence: () => void;
}) {
  const [, theme] = useStyletron();

  const [productId, setProductId] = React.useState(cast.batches[0].product);
  const [mode, setMode] = React.useState<Mode>(MODE.now);
  const [value, setValue] = React.useState('');
  const [source, setSource] = React.useState<Source>(SOURCE.hand);
  const [declared, setDeclared] = React.useState<Record<string, Declaration>>({});

  React.useEffect(() => {
    setProductId(cast.batches[0].product);
    setValue('');
    setMode(MODE.now);
    setSource(SOURCE.hand);
    setDeclared({});
  }, [cast]);

  const product = productOf(cast, productId);
  const trail = cast.batches.find((b) => b.product === productId)?.qty ?? 0;
  const standing = declared[productId]?.amount ?? trail;
  const connected = voice === 'connected';

  const announcement = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        {cast.batches.map((b) => {
          const p = productOf(cast, b.product);
          return (
            <span key={b.id} data-stock-product={b.product} data-selected={b.product === productId ? 'yes' : 'no'}>
              <Button
                kind={b.product === productId ? KIND.primary : KIND.secondary}
                size={SIZE.mini}
                shape={SHAPE.pill}
                onClick={() => setProductId(b.product)}
              >
                <Name of={p} />
              </Button>
            </span>
          );
        })}
      </div>

      <StockAnnouncement
        onHand={standing}
        onHandNote={
          declared[productId]
            ? 'What somebody said is on the floor'
            : connected
              ? 'What the incoming delivery notes add up to'
              : 'What the documents add up to'
        }
        unit={product.unit}
        decimals={0}
        locale="es-ES"
        aria-label={`Announce stock for ${product.name}`}
        mode={mode}
        onModeChange={({ mode: next }) => setMode(next)}
        value={value}
        source={source}
        onChange={({ value: next, source: nextSource }) => {
          setValue(next);
          setSource(nextSource);
        }}
        onSubmit={({ result, at }) => {
          setDeclared((prev) => ({ ...prev, [productId]: { amount: result, at } }));
          setValue('');
        }}
      />
    </div>
  );

  const rows = (
    <div
      data-testid="stock-rows"
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {cast.batches.map((b) => {
        const p = productOf(cast, b.product);
        const said = declared[b.product];
        return (
          <div key={b.id} data-stock-row={b.product} data-overridden={said ? 'yes' : 'no'}>
            <StockLevel
              name={p.name}
              trail={b.qty}
              declared={said?.amount}
              declaredAt={said?.at}
              evidence={{
                kind: connected ? EVIDENCE.feed : EVIDENCE.document,
                label: connected
                  ? `Delivery Note ${b.id}, in by email`
                  : `Delivery Note ${b.id}, photographed at the bay`,
              }}
              feed={connected ? FEED.connected : FEED.off}
              unit={p.unit}
              decimals={0}
              locale="es-ES"
              onOpenEvidence={onOpenEvidence}
              evidenceLabel={`Open the document behind ${p.name}`}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
      {/* THE ORDER IS THE EMPHASIS. A house that declares leads with the instrument that declares;
          a house on the email feed leads with the rows the feed moves, and the instrument that
          overrides them stands right under. Both are on the surface on every account. */}
      {voice === 'connected' ? (
        <>
          {rows}
          {announcement}
        </>
      ) : (
        <>
          {announcement}
          {rows}
        </>
      )}
    </div>
  );
}

/* ── THE BATCH BOOK ───────────────────────────────────────────────────────────────────────────
 * The lotes, the record one of them carries, and the line that points at two of them. `line →
 * allocations (batch, qty) → batch record` is LOT-LAW §2 drawn: one price, one line total, lotes as
 * sub-rows. A one-lote-per-line schema passes every form validation and fails the recall test.
 */

const round1 = (n: number, step: number) => Math.round(n / step) * step;

function BatchBook({ cast, lots }: { cast: Cast; lots: Record<string, string | undefined> }) {
  const [, theme] = useStyletron();

  const [costs, setCosts] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(cast.batches.map((b) => [b.id, b.cost])),
  );
  const [openId, setOpenId] = React.useState(cast.batches[0].id);
  const [openAllocation, setOpenAllocation] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCosts(Object.fromEntries(cast.batches.map((b) => [b.id, b.cost])));
    setOpenId(cast.batches[0].id);
    setOpenAllocation(null);
  }, [cast]);

  const rows: GridRow[] = cast.batches.map((b, i) => {
    const product = productOf(cast, b.product);
    return {
      id: b.id,
      name: (
        <button
          type="button"
          data-batch={b.id}
          onClick={() => setOpenId(b.id)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
            ...theme.typography.LabelSmall,
            color: theme.colors.contentPrimary,
            fontFamily: 'inherit',
            textDecoration: openId === b.id ? 'underline' : 'none',
          }}
        >
          {lots[b.id] ?? b.id} · <Name of={product} />
        </button>
      ),
      unit: `S/ per ${product.unit}`,
      values: { cost: costs[b.id] ?? b.cost },
      daysSinceTouched: AGES[i % AGES.length],
      group: product.family,
    };
  });

  const families = cast.families
    .map((f) => ({
      id: f.id,
      title: f.name,
      count: cast.batches.filter((b) => productOf(cast, b.product).family === f.id).length,
    }))
    .filter((f) => f.count > 0);

  const open = batchOf(cast, openId) ?? cast.batches[0];
  const openProduct = productOf(cast, open.product);
  const openFamily = familyOf(cast, openProduct);

  /* ── THE LINE THAT POINTS AT TWO LOTES ──────────────────────────────────────────────────────
     E2'S OWN RULE, taken as it stands rather than invented again: a landing qualifies for a line
     when it is priced in that line's unit AND it cost less than the line sells for, cheapest
     first, with the line's own lote leading. That second clause is what keeps the blend honest —
     drop it and a line is shown filled from a landing that costs four times what it sells for.
     The line the customer ordered stays ONE line however the parts are cut (LOT-LAW §2). */
  const division = React.useMemo(() => {
    for (const candidate of cast.order.lines) {
      const qualifying = cast.batches
        .filter((b) => productOf(cast, b.product).unit === candidate.unit && b.cost < candidate.price)
        .slice()
        .sort((a, b) => a.cost - b.cost)
        .map((b) => b.id);
      if (qualifying.length < 2) continue;
      const pair = qualifying.slice(0, 2);
      const lots =
        candidate.lot && pair.includes(candidate.lot)
          ? [candidate.lot, ...pair.filter((id) => id !== candidate.lot)]
          : pair;
      return { line: candidate, lots };
    }
    const fallback = cast.order.lines[0];
    return { line: fallback, lots: [fallback.lot ?? cast.batches[0].id] };
  }, [cast]);

  const line = division.line;
  const step = line.unit === 'kg' ? 0.5 : 1;
  const first = round1(line.qty * 0.6, step);
  const allocations: Allocation[] =
    division.lots.length > 1
      ? [
          { batch: division.lots[0], qty: first },
          { batch: division.lots[1], qty: Math.round((line.qty - first) * 100) / 100 },
        ]
      : [{ batch: division.lots[0], qty: line.qty }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
      <Grid
        columns={[{ id: 'cost', title: 'Cost', note: 'what this house paid' }]}
        rows={rows}
        groups={families}
        group={families.length > 1 ? families[0].id : undefined}
        caption="The lotes on the floor"
        minWidth={520}
        onEdit={(rowId, _columnId, next) => setCosts((prev) => ({ ...prev, [rowId]: next }))}
        onBulk={(ids, percent) =>
          setCosts((prev) => {
            const next = { ...prev };
            for (const id of ids) next[id] = Math.round(next[id] * (1 + percent / 100) * 100) / 100;
            return next;
          })
        }
      />

      <BatchRecord
        cast={cast}
        batch={open}
        provenance={
          <>
            {openFamily.recordFields.length} facts arrived with the goods and were captured once, at
            the bay. Rocoto reads a lote; the goods carry it.
          </>
        }
        consumers={
          <>
            <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
              {lots[open.id] ?? open.id}
            </Tag>
            <a
              href="#/dispatch"
              data-testid="to-albaran"
              style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}
            >
              the delivery notes it prints on
            </a>
          </>
        }
      />

      <BatchLine
        cast={cast}
        line={line}
        allocations={allocations}
        showCost
        openBatch={openAllocation}
        onOpenBatch={setOpenAllocation}
        note={
          <>
            <Name of={productOf(cast, line.product)} /> came off {allocations.length} of this
            morning&rsquo;s landings. One price, one line total, and the lotes underneath — the line
            the customer ordered stays one line.
          </>
        }
        renderBatchLink={(batchId) => (
          <Button
            kind={KIND.secondary}
            size={SIZE.mini}
            shape={SHAPE.pill}
            data-open-record={batchId}
            onClick={() => setOpenId(batchId)}
          >
            Open its record
          </Button>
        )}
      />
    </div>
  );
}

/* ── THE PAGE ─────────────────────────────────────────────────────────────────────────────── */

export default function Goods() {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;

  /* THE LOTES, held here because the arrival creates them and the batch book reads them: one
     state, so a code synthesised at goods-in is the code the record and the line carry. */
  const [lots, setLots] = React.useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(cast.batches.map((b, i) => [b.id, suppliedLot(cast.batches, i)])),
  );
  const [lit, setLit] = React.useState(false);

  React.useEffect(() => {
    setLots(Object.fromEntries(cast.batches.map((b, i) => [b.id, suppliedLot(cast.batches, i)])));
    setLit(false);
  }, [cast]);

  /* A REFERENCE THAT RESOLVES (LOT-LAW §5). The row's way to its evidence lands on the block that
     holds the document, and says so by lighting it — the endemic failure being a free-text number
     that resolves to nothing. */
  const openEvidence = React.useCallback(() => {
    setLit(true);
    document.getElementById(GOODS_IN)?.scrollIntoView({ block: 'start', behavior: 'auto' });
    window.setTimeout(() => setLit(false), 2400);
  }, []);

  const goodsIn = (
    <Block
      id={GOODS_IN}
      lit={lit}
      title="What arrived, and the document it came with"
      lead="The one moment the supplier’s sheet is in your hands. Capture it here and every line that draws on these lotes for the rest of the week is a lookup."
      derivation={
        <Derivation q="goodsIn" align="stack">
          {derived.goods.frontDoorLabel}; the other doors stay one tap away.
        </Derivation>
      }
      actions={
        <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
          {cast.batches.length} lines
        </Tag>
      }
    >
      <GoodsIn
        cast={cast}
        lots={lots}
        lotsMode={derived.lots.mode}
        onSynthesise={(batchId) =>
          setLots((prev) => {
            const batch = batchOf(cast, batchId);
            return batch ? { ...prev, [batchId]: synthesiseLot(cast, batch) } : prev;
          })
        }
      />
    </Block>
  );

  const stock = (
    <Block
      id="stock"
      title="What the papers say, and what is actually there"
      lead="One typed number, two claims: how much we have now, or how much we just added. The number survives the flip and only the meaning of submit changes."
      derivation={
        <Derivation q="stock" align="stack">
          {derived.goods.leadLabel}. A declaration stands in front of the documents, and the
          documents stay legible underneath it.
        </Derivation>
      }
    >
      <Stock cast={cast} voice={derived.goods.stockVoice} onOpenEvidence={openEvidence} />
    </Block>
  );

  const batches = (
    <Block
      id="batches"
      title="The batch book"
      lead="Every lote on the floor, the record one of them carries, and the line drawing on two of them at once."
      derivation={
        <Derivation q="lots" align="stack">
          {derived.lots.label}.
        </Derivation>
      }
    >
      <BatchBook cast={cast} lots={lots} />
    </Block>
  );

  /* THE LEAD IS THE EMPHASIS AND NOTHING ELSE. Three orders of the same three blocks: goods-in
     leads where stock is tracked by eye, the declaration leads where stock is declared, and the
     feed's rows lead where it is connected. Every block is on every account. */
  const order =
    derived.goods.lead === 'goods-in'
      ? [goodsIn, stock, batches]
      : [stock, goodsIn, batches];

  return (
    <Page title="Goods">
      <div
        data-lead={derived.goods.lead}
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale1000, minWidth: 0 }}
      >
        {order.map((block, i) => (
          <React.Fragment key={i}>{block}</React.Fragment>
        ))}
      </div>
    </Page>
  );
}
