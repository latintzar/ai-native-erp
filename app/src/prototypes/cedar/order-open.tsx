/* ONE ORDER, OPEN — the A-group's whole moment, composed once and housed twice.
 *
 * ═══ WHY IT IS ONE FILE ════════════════════════════════════════════════════════════════════
 * Today opens an order in a card over the spine; Orders opens the same order in the second column
 * of its working surface. If those were two compositions the gate would drift — one of them would
 * grow a second confirm control, or lose the resolution, or start asking the question the other
 * one already settled. So the composition is here and the two areas differ only in the housing
 * they put it in. This is the same discipline `canonical/order-surface` keeps for the fourteen
 * scenario cards, one level up.
 *
 * ═══ WHAT IT ASSEMBLES, AND WHAT IT ADDS ═══════════════════════════════════════════════════
 * `canonical/order-surface` draws the order and owns the hold. `canonical/resolution` draws the
 * line opened in place, the candidates ranked by what this customer took before, and the writes.
 * `canonical/change-notice` draws the blast radius. NOTHING here re-draws any of them: this file
 * decides which props they take for the app's own day, and that is all a puzzle piece may do.
 *
 * ═══ THE GATE IS REAL ══════════════════════════════════════════════════════════════════════
 * The hold is Base's own button filled by the hand, and it is CLOSED while a line is still waiting
 * on an answer — a line the software could not place cannot be committed by holding a button
 * harder. Answer the line and the gate opens under the same finger. That is the app's smallest
 * demonstration of the whole thesis: the journey to a correct albarán is gated on the things that
 * make it correct.
 *
 * ═══ THE NOTICE REPLACES THE ORDER, RATHER THAN STACKING ON IT ═════════════════════════════
 * A changed order carries a door to `U11`. It opens IN PLACE — the card's content swaps and a
 * «Back to the order» control returns — because Today already houses this composition inside an
 * Overlay Card, and a layer over a layer is two focus traps arguing about the keyboard.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import OrderSurface, { HoldToConfirm, OrderState } from '../../scenarios/canonical/order-surface';
import ChangeNotice, { type NoticeRow, type Outcome } from '../../scenarios/canonical/change-notice';
import {
  Resolution,
  Candidates,
  AlwaysTail,
  rank,
  sortsOf,
  sortText,
  withSort,
  withUnplacedLine,
  type Candidate,
  type Sort,
  type Write,
} from '../../scenarios/canonical/resolution';
import { batchOf, familyOf, productOf, type Cast, type OrderLine } from '../../scenarios/data/cast';
import Name from '../../scenarios/shell/Name';
import { heldReason, setDay, withId, type DayEdits, type DayOrder } from './day';
import type { Derived } from './config';
import { FromYourSetup } from './anchors';

export type OpenOrderProps = {
  cast: Cast;
  day: DayOrder;
  edits: DayEdits;
  derived: Derived;
  /** the order is standing in the day's sheet already, so a change reaches further */
  recorded: boolean;
  /** what the housing does once the gate has been held through */
  onConfirmed?: () => void;
};

export default function OpenOrder({ cast, day, edits, derived, recorded, onConfirmed }: OpenOrderProps) {
  const [, theme] = useStyletron();
  const [notice, setNotice] = React.useState(false);
  const [openLine, setOpenLine] = React.useState<string | null>(day.unresolved ?? null);

  /* a different order in the same housing is a different decision */
  React.useEffect(() => { setNotice(false); setOpenLine(day.unresolved ?? null); }, [day.id, day.unresolved]);

  const confirmed = edits.confirmed.includes(day.id);
  const answer = edits.answered[day.id];
  const always = edits.always.includes(day.id);
  const held = heldReason(day, derived);

  /* ── THE WAITING LINE ─────────────────────────────────────────────────────────────────────
   * The line the software could not place, and the candidates for it: the same product at every
   * sort this account's catalogue holds, ranked by what THIS customer has taken before. One axis
   * in fish, three in fruit, one control either way. */
  const waiting: OrderLine | undefined = day.unresolved
    ? day.order.lines.find((l) => l.id === day.unresolved)
    : undefined;
  const waitingProduct = waiting ? productOf(cast, waiting.product) : undefined;

  const ranked = React.useMemo(
    () => (waitingProduct ? rank(sortsOf(cast, waitingProduct), (s) => s.id, day.customer.id) : []),
    [cast, waitingProduct, day.customer.id],
  );

  /* `U01`: two to four candidates, ordered by what this customer has chosen before. The ranking
     is over every sort the catalogue holds; the cut is at four, because a press-one-of-these
     control that offers nine is a list, and a list is a different screen. */
  const candidates: Candidate[] = React.useMemo(
    () =>
      waitingProduct
        ? ranked.slice(0, 4).map(({ item, history }) => ({ id: item.id, label: sortText(waitingProduct, item), history }))
        : [],
    [ranked, waitingProduct],
  );

  const chosenSort: Sort | null = answer ? ranked.find((r) => r.item.id === answer)?.item ?? null : null;
  const chosenLabel = answer ? candidates.find((c) => c.id === answer)?.label : undefined;

  /* THE ORDER RE-FORMS AROUND THE ANSWER, in the canonical's own markup. Before the answer the
     waiting line's second row is empty, because the sort is what was left unsaid; after it, the
     row fills — and nothing was drawn specially for either state. */
  const shown = waitingProduct
    ? chosenSort
      ? withSort(cast, waitingProduct.id, chosenSort)
      : withUnplacedLine(cast, waitingProduct.id)
    : cast;

  const lot = waiting?.lot ? batchOf(cast, waiting.lot) : undefined;
  const family = waitingProduct ? familyOf(cast, waitingProduct) : undefined;

  const writes: Write[] | undefined = React.useMemo(() => {
    if (!chosenSort || !waitingProduct) return undefined;
    const rows: Write[] = [
      { object: 'This line', text: chosenLabel, ref: 'orders' },
      {
        object: `${day.customer.name}’s record`,
        text: `${chosenLabel}, whenever they say ${waitingProduct.name} plainly`,
        ref: 'customers',
      },
    ];
    /* C-18 · THE THIRD WRITE. In a fisheries family the gear and the production method ARE the
       traceability fact, so the answer that settles the line settles the lote in the same press. */
    if (family?.traceability === 'lot+fisheries' && lot) {
      rows.push({
        object: `Lote ${lot.id}`,
        text: chosenSort.facts.map((f) => `${f.label} ${f.value}`).join(' · '),
        ref: 'goods',
      });
    }
    return rows;
  }, [chosenSort, chosenLabel, waitingProduct, family, lot, day.customer.name]);

  /* ── THE CHANGE, AND WHAT IT REACHES ──────────────────────────────────────────────────────
   * `U11`'s body is a function of how far the order has travelled, so the rows are computed from
   * where this order actually stands: an order still on the desk reaches its own lines and stops
   * there; one already on today's sheet reaches the sheet and the file as well. */
  const change = day.changed;
  const outcome = edits.notice[day.id] ?? 'leave';

  const rows: NoticeRow[] = React.useMemo(() => {
    if (!change) return [];
    const raised = productOf(cast, change.raised.product);
    const out: NoticeRow[] = [
      {
        id: 'lines',
        what: <>The order’s lines</>,
        ref: 'orders',
        when: `recorded ${day.at}`,
        figure: { value: change.raised.qty + change.more, was: change.raised.qty, unit: change.raised.unit },
        state: 'reopens',
        consequence: <>The line for <Name of={raised} /> is drawn again at the new quantity.</>,
      },
    ];
    if (change.raised.lot) {
      out.push({
        id: 'lot',
        what: <>Reserved on {change.raised.lot}</>,
        ref: 'goods',
        state: 'reopens',
        consequence: 'The reservation is drawn again at the new quantity.',
      });
    }
    if (recorded) {
      out.push(
        {
          id: 'sheet',
          what: <>The picking sheet</>,
          ref: 'dispatch',
          when: `cut ${change.at}`,
          state: 'reopens',
          consequence: 'The sheet is cut again for this round.',
        },
        {
          id: 'file',
          what: <>Today’s file</>,
          ref: 'today',
          state: 'reopens',
          consequence: `The line reaches ${derived.erp.label} with the next file.`,
        },
      );
    }
    return out;
  }, [change, cast, recorded, day.at, derived.erp.label]);

  const reopens = rows.filter((r) => r.state === 'reopens').length;

  const outcomes: Outcome[] = React.useMemo(() => {
    if (!change) return [];
    const raised = productOf(cast, change.raised.product);
    const dropped = productOf(cast, change.dropped.product);
    return [
      {
        id: 'apply',
        label: 'Apply to the lines',
        detail: (
          <>
            The order carries {change.raised.qty + change.more} {change.raised.unit} of{' '}
            <Name of={raised} />, and <Name of={dropped} /> comes off it.
          </>
        ),
      },
      ...(reopens > 0
        ? [{
            id: 'reopen',
            label: 'Reopen what it reaches',
            detail: `The ${reopens} ${reopens === 1 ? 'record' : 'records'} marked Reopens come back for a second pass; the rest stand.`,
          }]
        : []),
    ];
  }, [change, cast, reopens]);

  /* ── THE NOTICE, IN PLACE OF THE ORDER ────────────────────────────────────────────────────── */
  if (notice && change) {
    const raised = productOf(cast, change.raised.product);
    const dropped = productOf(cast, change.dropped.product);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div>
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setNotice(false)} data-testid="notice-back">
            Back to the order
          </Button>
        </div>
        <ChangeNotice
          what={
            <>
              <Name of={day.customer} /> raised <Name of={raised} /> to {change.raised.qty + change.more}{' '}
              {change.raised.unit} and took <Name of={dropped} /> off the order
            </>
          }
          anchor={day.order.deliveryDay}
          when={`recorded ${day.at}, changed ${change.at}`}
          rows={rows}
          empty={
            <>
              The change lands on the order’s lines and stops there — the sheet, the delivery note and the
              file are all still ahead of it.
            </>
          }
          outcomes={outcomes}
          outcome={outcome}
          onOutcome={(id) => setDay((prev) => ({ notice: { ...prev.notice, [day.id]: id } }))}
        />
      </div>
    );
  }

  /* ── THE ORDER ────────────────────────────────────────────────────────────────────────────── */
  return (
    <OrderSurface
      cast={shown}
      order={day.order}
      state={
        <OrderState>
          {confirmed ? 'Confirmed' : day.arriving && !edits.surfaced.includes(day.id) ? 'Arriving' : 'Waiting on you'}
        </OrderState>
      }
      reason={
        held && !confirmed ? (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <span>{held.text}.</span>
            {held.kind === 'threshold' && <FromYourSetup q="gate" />}
          </span>
        ) : undefined
      }
      aside={
        change ? (
          <div
            data-testid="change-aside"
            style={{
              display: 'flex',
              gap: theme.sizing.scale500,
              alignItems: 'center',
              flexWrap: 'wrap',
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius300,
              padding: theme.sizing.scale500,
            }}
          >
            <span style={{ ...theme.typography.ParagraphSmall, flex: 1, minWidth: 0 }}>
              They changed this order at {change.at}, after it was recorded.
            </span>
            <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => setNotice(true)} data-testid="open-notice">
              See what it affects
            </Button>
          </div>
        ) : undefined
      }
      openLine={openLine ?? undefined}
      onLineClick={(line) => setOpenLine((prev) => (prev === line.id ? null : line.id))}
      renderOpenLine={(line) => {
        /* THE WAITING LINE opens as a resolution; every other line opens as what the albarán will
           carry for it. Both are the canonical's own slot — one line, opened in place. */
        if (waiting && line.id === waiting.id && waitingProduct) {
          return (
            <Resolution
              ask={
                <>
                  Which entry <strong>{day.customer.name}</strong> meant by {waitingProduct.name}.
                </>
              }
              writes={writes}
              tail={
                answer ? (
                  <AlwaysTail
                    scope={<Name of={day.customer} />}
                    always={always}
                    onAlways={() => setDay((prev) => ({ always: withId(prev.always, day.id) }))}
                  />
                ) : undefined
              }
            >
              <Candidates
                candidates={candidates}
                chosen={answer ?? null}
                onChoose={(id) => setDay((prev) => ({ answered: { ...prev.answered, [day.id]: id } }))}
                overflowAt={4}
                ariaLabel="the catalogue entries this line could be"
              />
            </Resolution>
          );
        }
        return <LineFacts cast={cast} line={line} />;
      }}
      primary={
        confirmed ? undefined : (
          <HoldToConfirm
            disabled={!!waiting && !answer}
            onConfirm={() => {
              setDay((prev) => ({
                confirmed: withId(prev.confirmed, day.id),
                surfaced: withId(prev.surfaced, day.id),
              }));
              onConfirmed?.();
            }}
          >
            Hold to confirm
          </HoldToConfirm>
        )
      }
      exits={
        confirmed ? (
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            It is on today’s file, under {day.order.deliveryDay}, and its lines are on the picking sheet.
          </p>
        ) : waiting && !answer ? (
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            The gate opens once the waiting line has its answer.
          </p>
        ) : undefined
      }
    />
  );
}

/* ── A LINE, OPENED ───────────────────────────────────────────────────────────────────────────
 * What the albarán will carry for this line: the lote it draws on and the family's own field set,
 * read from the cast. It is the same data the release screen prints, shown at the moment a person
 * is deciding — and it is a READING, so it holds no control of its own.
 */
function LineFacts({ cast, line }: { cast: Cast; line: OrderLine }) {
  const [, theme] = useStyletron();
  const product = productOf(cast, line.product);
  const family = familyOf(cast, product);
  const facts = family.recordFields.map((label) => ({
    label,
    value: label === 'lote' ? line.lot ?? product.trace.lote ?? '' : product.trace[label] ?? '',
  })).filter((f) => f.value);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
        padding: theme.sizing.scale500,
        marginTop: theme.sizing.scale400,
        background: theme.colors.backgroundPrimary,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        What the delivery note carries for this line
      </span>
      {facts.length > 0 ? (
        <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          {facts.map((f) => (
            <Tag key={f.label} closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
              {f.label} {f.value}
            </Tag>
          ))}
        </div>
      ) : (
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          This family sells on the product name alone, so the line carries the name and the price.
        </span>
      )}
    </div>
  );
}
