/* PARKED (FEED-IA §0.1, Peter 2026-08-23: «The horizontal Today's albaranes strip: out.
 * I don't like that at all.») The day headers in the feed carry the aggregate now (§1), and
 * Prepare is the day's working surface. Kept compiling so the fold-the-ledger recipe stays.
 */
/* THE ALBARÁN STRIP — the through-line, drawn.
 *
 * "What we help with is making the albarán. That's the big document of truth."
 * (THE-ALBARAN-THESIS §0.) So the product should visibly BE that: a persistent strip of today's
 * albaranes moving forming → released → delivered, above the feed, so the day reads as a set of
 * documents becoming correct rather than as a list of tasks.
 *
 * ═══ A CHIP ROW, NOT A BOARD (THE-APP-V2 §1.4) ═════════════════════════════════════════════
 * It used to be three labelled columns of 172px tiles — a board, which on a 390px phone is two
 * thirds of the first screen spent on a glance. Now every document is ONE compact chip carrying
 * its own state word, and the chips run in a single row that scrolls sideways. The state stays
 * legible because each chip says it; the counts stay legible because the header says them; and
 * the feed starts where the feed should start. Nothing here is a colour with a meaning.
 *
 * EVERY VALUE COMES FROM THE CAST, and every stage from the SALE it is. `useStripDocuments` folds
 * the same ledger the feed folds, so the band and the row six inches below it can never disagree.
 */
import * as React from 'react';
import { useDay } from '../../day';
import { buildSales, stageAt, stageOf } from '../../sale';
import { useStyletron } from 'baseui';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../figure';
import { buildAlbaran, todaysAlbaranes, type DayDocument } from '../../../../scenarios/canonical/release';
import Name from '../../../../scenarios/shell/Name';
import { useConfig } from '../../config';
import { HOME } from '../area';
import { useOpenItems } from '../open-items';

/** Where a document has got to. Three states, in the order the day walks them. */
export type StripState = 'forming' | 'released' | 'delivered';

export const STRIP_STATES: StripState[] = ['forming', 'released', 'delivered'];

const STATE_LABEL: Record<StripState, string> = {
  forming: 'Forming',
  released: 'Released',
  delivered: 'Delivered',
};

/** The day's shape at this hour, stated once and deterministically, so a screenshot of the strip
 *  is the same screenshot every time: the early rounds are in, the middle ones are out, and the
 *  last document is still taking lines. */
const WALK: StripState[] = ['delivered', 'delivered', 'released', 'released', 'forming'];

export type StripDocument = DayDocument & {
  state: StripState;
  total?: number;
  /** the Sale this document is, where the ledger has one — the chip opens it in full */
  saleId?: string;
};

/** The day's documents, TOLD BY THE SALES THEY ARE. Since the sale became the app's one object, a
 *  document's stage, line count and money are facts of that object — so this hook folds the same
 *  ledger the feed folds instead of walking a fixture of its own. A document the day carries
 *  without a sale behind it keeps the walk's own stage. */
export function useStripDocuments(cast: Parameters<typeof todaysAlbaranes>[0]): StripDocument[] {
  const edits = useDay(cast.sector);
  return React.useMemo(() => {
    const sales = buildSales(cast, edits);
    return stripDocuments(cast).map((d) => {
      const sale = sales.find((s) => s.number === d.number);
      if (!sale) {
        return edits.released.includes(d.number) && d.state === 'forming'
          ? { ...d, state: 'released' as const }
          : d;
      }
      return {
        ...d,
        state: stageOf(sale.state),
        lines: sale.lines.length,
        at: stageAt(sale) ?? d.at,
        total: sale.figure,
        saleId: sale.id,
      };
    });
  }, [cast, edits]);
}

export function stripDocuments(cast: Parameters<typeof todaysAlbaranes>[0]): StripDocument[] {
  const built = buildAlbaran(cast);
  return todaysAlbaranes(cast).map((d, i) => ({
    ...d,
    state: WALK[i % WALK.length],
    /* the one document the prototype composes in full is the one whose money is known */
    total: d.customer.id === built.customer.id ? built.total : undefined,
  }));
}

/* ── ONE CHIP ─────────────────────────────────────────────────────────────────────────────── */

function Chip({ doc }: { doc: StripDocument }) {
  const [, theme] = useStyletron();
  const { open } = useOpenItems();

  /* THE BAND IS A DOOR. Pressing a document here opens it in full and it joins the open-items
     strip, which is the founder's «flipping between albaranes they opened» from the other end:
     the glance and the work are the same set of documents. */
  const enter = () => {
    if (doc.saleId) open({ id: doc.saleId, customer: doc.customer.name, figure: doc.total, number: doc.number });
    if (window.location.hash !== `#/${HOME}`) window.location.hash = `#/${HOME}`;
  };

  return (
    <a
      href={`#/${HOME}`}
      onClick={(e) => { e.preventDefault(); enter(); }}
      data-albaran={doc.number}
      data-state={doc.state}
      data-testid={`albaran-chip-${doc.number}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: theme.sizing.scale300,
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
        padding: `${theme.sizing.scale200} ${theme.sizing.scale400}`,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius200,
        background: theme.colors.backgroundPrimary,
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{doc.number}</span>
      <span style={{ ...theme.typography.LabelSmall }}>
        <Name of={doc.customer} />
      </span>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        {STATE_LABEL[doc.state]} · {doc.at}
      </span>
      {doc.total !== undefined && <Figure value={doc.total} unit="S/" size="compact" />}
    </a>
  );
}

/* ── THE STRIP ────────────────────────────────────────────────────────────────────────────── */

export default function AlbaranStrip({ phone = false }: { phone?: boolean }) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const docs = useStripDocuments(derived.cast);

  /* the walk reads left to right, whatever order the day handed them over in */
  const ordered = STRIP_STATES.flatMap((s) => docs.filter((d) => d.state === s));

  return (
    <section
      data-testid="albaran-strip"
      aria-label="Today’s delivery notes"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
        padding: phone
          ? `${theme.sizing.scale400} ${theme.sizing.scale500}`
          : `${theme.sizing.scale500} ${theme.sizing.scale800}`,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundSecondary,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <h2 style={{ margin: 0, ...theme.typography.LabelSmall, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
          Today’s delivery notes
        </h2>
        <span
          style={{
            ...theme.typography.ParagraphXSmall,
            color: theme.colors.contentSecondary,
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          {STRIP_STATES.map((s) => `${docs.filter((d) => d.state === s).length} ${STATE_LABEL[s].toLowerCase()}`).join(' · ')}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.sizing.scale200,
            flex: '0 0 auto',
            marginLeft: phone ? 0 : 'auto',
          }}
        >
          <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
            {derived.lots.short}
          </Tag>
        </span>
      </div>

      <div
        data-testid="albaran-chips"
        style={{
          display: 'flex',
          gap: theme.sizing.scale300,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: theme.sizing.scale100,
        }}
      >
        {ordered.map((d) => <Chip key={d.number} doc={d} />)}
      </div>
    </section>
  );
}
