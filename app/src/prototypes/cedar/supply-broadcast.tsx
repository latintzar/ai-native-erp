/* THE SUPPLY-ISSUE BROADCAST — one shortage, the people it lands on, and one message (§101.2).
 *
 * «A supply-chain issue detected at runtime → tell the AFFECTED customers: find who is affected,
 * templates, a quick update asking about alternatives — delivered later, a substitute, or not at
 * all. A flow with its own surfaces.» (FEED-IA §101.2)
 *
 * ═══ NOTHING HERE IS A NEW FACT ═════════════════════════════════════════════════════════════
 * The issue is `incoming.ts`'s subtraction — what the ledger stands at against what the book has
 * promised. WHO IS AFFECTED is the sale ledger's own fold, narrowed to the orders that have yet to
 * leave the house. WHAT THEY ARE OWED is FIFO, oldest request first, which is the same doctrine
 * `plan()` uses to draw a lote down. So a person can check every number on this screen against a
 * surface they already trust, and no store was added to hold any of it.
 *
 * ═══ THE MESSAGE IS COMPOSED, NEVER TYPED (§83.2 · the seeding law) ═════════════════════════
 * «We make AI available, we never impose it.» Rocoto writes the update out of facts — the goods,
 * the day, what they asked for, what the floor can do — and OFFERS three alternatives beside it:
 * it lands later · something else instead · it goes on the next order. Each one is a control the
 * person keeps or drops, and the review shows the exact words each conversation will get before
 * anything moves. A free-text box would have needed a token language and would have let a screen
 * invent a sentence; this way every word on the wire is derived from something true.
 *
 * ═══ AND THE USEFUL-PERSON REFLEX IS OFFERED, NEVER SENT (§101.3 · §83.2) ═══════════════════
 * «When someone reports an issue with a product, Rocoto asks the useful next question — "so when
 * will it be available?" — follow-through as behaviour.» A message that says the merluza is short
 * and stops there leaves the reader holding the obvious question. So the reply grammar carries the
 * ANSWER to it as a fourth offer, unfilled: press it and the line joins that conversation's own
 * message. It is off on every row until somebody presses it, which is the whole of «never
 * auto-sent» — and the rows where the customer has ALREADY asked about these goods lead the list
 * and say so, because that is where the question is standing right now.
 *
 * ═══ ONE BROADCAST REACHES EXACTLY THE AFFECTED CONVERSATIONS ═══════════════════════════════
 * The send walks the affected rows and writes through `sendToThread` — the chat store's own
 * shipped writer, read-only from here — so a broadcast lands as an ordinary turn in each of those
 * conversations and in none of the others. That isolation is the assertion the drive holds this
 * surface to, and it is structural: there is no path in this file that reaches a thread that is
 * not on the list the person just reviewed.
 *
 * ═══ WHERE IT IS ENTERED ════════════════════════════════════════════════════════════════════
 * From the incoming mail (`inbox.tsx` mounts `SupplyDoor` on the message whose goods are short) —
 * the door is on the sheet that told you — and from the Stock area's own supply seat, where
 * `stock-tiers.tsx` mounts the same door on the product's shortage reading. ONE mount, two seats.
 *
 * AND FROM THE FILM (FEED-IA §132.7). A shortage does not only arrive as a count coming in under
 * the book: usually the supplier PHONES. `supply-film.tsx` is that entry — the person says what
 * they were told, answers one question, sees the customer it lands on and sends them one message —
 * and its landing hands the REST of the affected conversations to this broadcast with the one it
 * already told named, so nobody hears the same shortage twice.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Modal, ROLE, SIZE as MODAL_SIZE } from 'baseui/modal';
import Name from '../../scenarios/shell/Name';
import type { Cast, Customer, Product } from '../../scenarios/data/cast';
import { productOf } from '../../scenarios/data/cast';
import { useConfig } from './config';
import { nowOf, useDay } from './day';
import { Glyph, STEP } from './glyphs';
import {
  buildLedger, expectedOf, fold, issuesOf, rowsOf,
  useDeclared, type IncomingEvent, type SupplyIssue,
} from './incoming';
import { useRules, type Rule } from './rules';
import { buildSales, dayFromId, dayLabelFromId, isStanding, RANK, todayId, type Sale } from './sale';
import { replyHour, sendToThread, useThreads } from './shell/threads';
import { usePhone } from './shell/viewport';
/* THE FIGURE'S OWN FORMATTING LAW, AND THE FILM, BOTH FROM ONE PLACE. The import runs one way —
   this file reads the film, the film never reads this one — so the two cannot form a cycle, and
   `units` has one implementation rather than one per surface. */
import { SupplyFilm, units } from './supply-film';
import { posthog, isPostHogConfigured } from '../../posthog';

/** WHERE THIS FLOW STANDS IN THE STACK. Above `detail.tsx`'s sheet (12) and the surfaces' own
 *  sticky chrome, below the search palette (16), which outranks everything by design. */
const BROADCAST_LAYER = 14;

/** THE HOUSE'S OWN MOMENT — its day at the hour its morning stands in, the same derivation Stock
 *  reads its ledger against, so the two surfaces cannot disagree about what has landed. */
function houseNow(cast: Cast): Date {
  const at = dayFromId(todayId(cast));
  const [h, m] = nowOf(cast).split(':').map(Number);
  at.setHours(h || 0, m || 0, 0, 0);
  return at;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** The day after a day, as the river's own key. */
function nextDayId(day: string): string {
  const at = dayFromId(day);
  at.setDate(at.getDate() + 1);
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
}

/* ── WHAT THE BOOK HAS PROMISED, AND OF WHICH DAY ─────────────────────────────────────────────
 * «Today's + standing orders» (§101.2) — and the word «today's» is doing real work there.
 *
 * THE FLOOR SERVES ONE DAY. What landed this morning goes out on today's van; tomorrow's orders
 * are served by tomorrow's landing. So a fold that counted the WHOLE forward book against ONE
 * morning's floor reported a house of three hundred accounts as 2.724 kg short of rape on a day it
 * had enough — five days of demand subtracted from one day of supply — and offered to tell 274
 * conversations about it. That is not a stricter reading, it is a WRONG one, and it is written
 * down because the arithmetic looked reasonable right up until the count came back.
 *
 * SO THE CUT IS: the day the house is serving, PLUS anything still standing from before it — an
 * order owed from yesterday is owed off this morning's floor, which is exactly why the standing
 * ones belong in the same subtraction and nothing older does.
 *
 * From SENT onwards the document is the customer's and the goods are gone, which is the identical
 * cut `threads.ts` makes for the orders a conversation is «carrying».
 */
const onTheBook = (sale: Sale, today: string): boolean =>
  RANK[sale.state] < RANK.sent && (sale.day === today || isStanding(sale, today));

export function committedOf(sales: Sale[], today: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const sale of sales) {
    if (!onTheBook(sale, today)) continue;
    for (const line of sale.lines) {
      if (line.off) continue;
      const qty = line.given || line.ordered;
      out.set(line.product.id, Math.round(((out.get(line.product.id) ?? 0) + qty) * 100) / 100);
    }
  }
  return out;
}

export type SupplyState = {
  issues: SupplyIssue[];
  sales: Sale[];
  ledger: IncomingEvent[];
  rules: Rule[];
  today: string;
  now: Date;
};

/**
 * EVERY SHORTAGE THE HOUSE IS STANDING IN, worst first.
 *
 * It folds both ledgers — what landed, and what was sold — because a supply problem is the
 * relationship between them and neither one alone can state it. A house whose floor covers its
 * book has no issues and this returns an empty list, which is what makes the door in `inbox.tsx`
 * disappear on a good morning rather than drawing a control that has nothing to open.
 */
export function useSupplyIssues(cast: Cast): SupplyState {
  const { config } = useConfig();
  const declared = useDeclared(cast.sector);
  const rules = useRules();
  const edits = useDay(cast.sector);
  const [now] = React.useState(() => houseNow(cast));
  return React.useMemo(() => {
    const ledger = buildLedger({ cast, config, declared, rules: rules.rules, now });
    const sales = buildSales(cast, edits);
    const today = todayId(cast);
    return {
      ledger,
      sales,
      rules: rules.rules,
      today,
      now,
      issues: issuesOf({ cast, ledger, committed: committedOf(sales, today) }),
    };
  }, [cast, config, declared, rules.rules, edits, now]);
}

/* ── WHO IS AFFECTED, AND WHAT EACH OF THEM CAN HAVE ──────────────────────────────────────────
 * FIRST ASKED, FIRST SERVED. The floor is drawn down in the order the requests reached the desk,
 * which is the same rule the lotes are drawn down by — and it is the only allocation this app can
 * make without inventing a policy nobody set. A house that would rather protect its biggest
 * account can say so on the review, one row at a time, because every row states its own two
 * numbers and the message follows them.
 */

export type Affected = {
  sale: Sale;
  customer: Customer;
  /** what they asked of the short goods */
  asked: number;
  /** what the floor can do for them, first asked first served */
  served: number;
  /** the rest */
  owed: number;
  unit: string;
  /** the day their order is for */
  day: string;
  /** they have already said something about these goods — §101.3's own trigger, and the reason
   *  their row leads the list */
  reported?: string;
};

export function affectedOf(a: {
  cast: Cast;
  sales: Sale[];
  today: string;
  issue: SupplyIssue;
}): Affected[] {
  const goods = productOf(a.cast, a.issue.product);
  /* ⚠ «THEY ALREADY ASKED» MUST BE ABOUT THESE GOODS (§101.3). The first build put the line on
     any conversation carrying an open question, and the shot came back with «They already asked:
     They ask the Pulpo price» on a row about RAPE — the surface claiming a person had asked about
     something they had said nothing about, on the one row the design puts first. A standing
     question is a fact about the conversation; a question ABOUT THIS PRODUCT is the fact §101.3
     is written for, and only the second one may say so. */
  const aboutGoods = (said: string | undefined): string | undefined =>
    said && said.toLowerCase().includes(goods.name.toLowerCase()) ? said : undefined;

  const rows: Affected[] = [];
  for (const sale of a.sales) {
    if (!onTheBook(sale, a.today)) continue;
    const line = sale.lines.find((l) => l.product.id === a.issue.product && !l.off);
    if (!line) continue;
    rows.push({
      sale,
      customer: sale.customer,
      asked: line.given || line.ordered,
      served: 0,
      owed: line.given || line.ordered,
      unit: line.unit,
      day: sale.day,
      reported: aboutGoods(sale.dispute?.because) ?? aboutGoods(sale.needsReply?.about),
    });
  }
  /* the order the requests reached the desk: the day first, then the hour on it */
  rows.sort((x, y) => (x.day === y.day ? x.sale.at.localeCompare(y.sale.at) : x.day.localeCompare(y.day)));
  let left = Math.max(0, a.issue.standing);
  for (const row of rows) {
    const take = Math.min(left, row.asked);
    row.served = Math.round(take * 100) / 100;
    row.owed = Math.round((row.asked - take) * 100) / 100;
    left = Math.round((left - take) * 100) / 100;
  }
  /* THE ONES WHO ALREADY ASKED LEAD (§101.3). A person owed an answer about these goods is the
     person this message is most about, and a list that buried them under the routine rows would
     make the useful offer the hardest one to find. */
  return [...rows].sort((x, y) => Number(Boolean(y.reported)) - Number(Boolean(x.reported)));
}

/* ── SOMETHING ELSE INSTEAD ───────────────────────────────────────────────────────────────────
 * The swap has to be REAL or it may not be offered: same family, standing on the floor, and the
 * most of it there is. Where the house has nothing that fits, the alternative is absent and the
 * message offers two — a gap ships as a gap rather than as an invented suggestion.
 */
export function swapFor(cast: Cast, ledger: IncomingEvent[], issue: SupplyIssue): Product | null {
  const short = productOf(cast, issue.product);
  const fits = cast.products
    .filter((p) => p.id !== short.id && p.family === short.family)
    .map((p) => ({ p, standing: fold(rowsOf(ledger, p.id)).standing }))
    .filter((row) => row.standing > 0)
    .sort((x, y) => y.standing - x.standing);
  return fits[0]?.p ?? null;
}

/* ── THE TEMPLATE (§101.2) ────────────────────────────────────────────────────────────────────
 * The canon register: short sentences, TÚ, what IS. The update states the goods, the day and the
 * two figures; the ask names the alternatives the person kept. Nothing here says what a house
 * lacks — «we have 7 kg for you» is the same fact as «we are 5 kg short» with the reader's
 * attention pointed at the part they can act on.
 */

export type Alternative = 'later' | 'swap' | 'next';

export const ALTERNATIVES: Alternative[] = ['later', 'swap', 'next'];

/** THE WORD EACH OFFER SAYS ON ITS OWN CONTROL — the same words it says in the message, so a
 *  person pressing one knows exactly what it will put on the wire. */
export const ALTERNATIVE_WORD: Record<Alternative, string> = {
  later: 'Check a later delivery',
  swap: 'Something else instead',
  next: 'It goes on the next order',
};

export type Template = {
  /** the alternatives the person is keeping */
  keep: Alternative[];
  /** the goods offered in place of the short ones, where the house has any */
  swap: Product | null;
};

/** A daily planning rule is not supplier evidence. Never promise a delivery from it. */
export function usefulNext(a: {
  cast: Cast;
  rules: Rule[];
  issue: SupplyIssue;
  now: Date;
}): string {
  const product = productOf(a.cast, a.issue.product);
  const expected = expectedOf(a.rules, a.issue.product, a.now);
  if (expected) {
    return `We normally review ${product.name} stock at ${expected.replenishAt}. The next delivery is still to confirm.`;
  }
  return `The next delivery is still to confirm. We’ll update you when availability is checked.`;
}

/** ONE CONVERSATION'S OWN MESSAGE, whole — the words that go on the wire. */
export function messageFor(a: {
  cast: Cast;
  issue: SupplyIssue;
  row: Affected;
  template: Template;
  /** §101.3's line, where this row has taken the offer */
  useful?: string;
}): string {
  const product = productOf(a.cast, a.issue.product);
  const day = dayLabelFromId(a.row.day);
  const asked = units(a.row.asked, a.row.unit);
  const update = a.row.served > 0
    ? `${product.name} lands short for ${day}. You asked for ${asked} and we have ${units(a.row.served, a.row.unit)} for you.`
    : `${product.name} lands short for ${day}. You asked for ${asked}.`;
  const parts: string[] = [];
  for (const alt of a.template.keep) {
    if (alt === 'later') parts.push(`check delivery availability for ${dayLabelFromId(nextDayId(a.row.day))}`);
    if (alt === 'swap' && a.template.swap) parts.push(`${a.template.swap.name} instead`);
    if (alt === 'next') parts.push('it goes on your next order');
  }
  const ask = parts.length > 0 ? ` Tell us which suits you: ${parts.join(' · ')}.` : '';
  const useful = a.useful ? ` ${a.useful}` : '';
  return `${update}${ask}${useful}`;
}

/* ═══ THE SURFACES ═══════════════════════════════════════════════════════════════════════════ */

/**
 * THE DOOR (§43: every named thing is a door).
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  Merluza · 38 kg short against the book                          │  the reading
 * │  What the ledger stands at … against every line on the book …    │  its method
 * │  [ Report a supply issue ]      [ Tell who's affected ]          │  the two acts
 * └──────────────────────────────────────────────────────────────────┘
 *
 * It draws NOTHING where the goods it is asked about are covered, which is why it can be mounted
 * on a surface that knows nothing about shortages: a mail that landed a crate the book is not
 * over says nothing, and the row it sits in is unchanged.
 *
 * TWO ACTS, BECAUSE A SHORTAGE ARRIVES TWO WAYS. The count came in under the book — that is the
 * reading above them. What nobody has said yet is WHEN the goods land, and the person who knows is
 * the one the supplier just phoned: «Report a supply issue» opens §132.7's FILM, which asks them
 * that one question and walks it to the customer it lands on. «Tell who's affected» is the direct
 * door to §101.2's broadcast, for the mornings where the whole book has to hear it at once.
 *
 * AND THE FILM MORPHS IN PLACE (§132.7). It replaces the reading inside this same card rather than
 * opening a surface over it: one box, one thing happening in it, no modal stack.
 */
export function SupplyDoor({
  cast,
  products,
  testid = 'supply-door',
}: {
  cast: Cast;
  /** Product.id — the goods this surface is about */
  products: string[];
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const supply = useSupplyIssues(cast);
  const [open, setOpen] = React.useState<string | null>(null);
  /** the goods the film is running on, and — once it has sent — the conversations it already told,
   *  which the broadcast it hands to must leave alone */
  const [filming, setFilming] = React.useState<string | null>(null);
  const [told, setTold] = React.useState<string[]>([]);
  const mine = supply.issues.filter((i) => products.includes(i.product));
  if (mine.length === 0) return null;
  const standing = open ? mine.find((i) => i.product === open) ?? null : null;

  return (
    <div
      data-testid={testid}
      data-supply-issues={mine.length}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      {mine.map((issue) => {
        const product = productOf(cast, issue.product);
        if (filming === issue.product) {
          return (
            <SupplyFilm
              key={issue.product}
              cast={cast}
              issue={issue}
              rows={affectedOf({ cast, sales: supply.sales, today: supply.today, issue })}
              onTellTheRest={(already) => {
                setTold(already);
                setFilming(null);
                setOpen(issue.product);
              }}
              onClose={() => setFilming(null)}
            />
          );
        }
        return (
          <div
            key={issue.product}
            data-testid="supply-reading"
            data-supply-product={issue.product}
            data-supply-short={issue.short}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale200,
              padding: theme.sizing.scale500,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius300,
              /* IT PAINTS ITS OWN GROUND, like every other card in the app. An opened mail row is
                 grey, and a bordered box with no fill on grey read as loose text with a hairline
                 round it rather than as a thing standing on the row. */
              background: theme.colors.backgroundPrimary,
              minWidth: 0,
            }}
          >
            {/* THE ACCENT IS ROCOTO'S OWN ACT and nothing else on the card wears it: the house
                did not flag this, the fold found it. */}
            <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>
              <span style={{ color: theme.colors.accent, whiteSpace: 'nowrap' }}>
                {issue.gone ? 'Floor is empty' : `${issue.approx ? '~' : ''}${units(issue.short, issue.unit)} short`}
              </span>
              {' · '}
              <Name of={product} />
              {' · '}
              {units(issue.standing, issue.unit)} standing against {units(issue.committed, issue.unit)} on the book
            </span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
              {issue.method}
            </span>
            <span
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: theme.sizing.scale300,
                paddingTop: theme.sizing.scale200,
              }}
            >
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                shape={SHAPE.pill}
                overrides={{ BaseButton: { props: { 'data-testid': 'supply-film-open' } } }}
                onClick={() => setFilming(issue.product)}
              >
                Report a supply issue
              </Button>
              <Button
                kind={KIND.secondary}
                size={SIZE.compact}
                shape={SHAPE.pill}
                overrides={{ BaseButton: { props: { 'data-testid': 'supply-open' } } }}
                onClick={() => setOpen(issue.product)}
              >
                Tell who&rsquo;s affected
              </Button>
            </span>
          </div>
        );
      })}
      {standing && (
        <SupplyBroadcast
          cast={cast}
          issue={standing}
          except={told}
          onClose={() => {
            setOpen(null);
            setTold([]);
          }}
        />
      )}
    </div>
  );
}

/**
 * THE BROADCAST (§101.2), reviewed the way §76 reviews a thing that matters.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Merluza · 38 kg short                       the reading, and its method │
 * │                                                                          │
 * │  WHAT GOES OUT                                                           │
 * │  [It lands later] [Rape instead] [It goes on the next order]   offers ─┐ │
 * │  [When it's back]                                              §101.3 ─┘ │
 * │                                                                          │
 * │  SIX CONVERSATIONS                                                       │
 * │  ┌──────────────────────────────────────────────────────────────────┐   │
 * │  │ Can Solé · asked 12 kg · 7 kg for them        [+ When it's back] │   │
 * │  │ «Merluza lands short for Friday 22.08. You asked for 12 kg …»    │   │
 * │  └──────────────────────────────────────────────────────────────────┘   │
 * │                                                                          │
 * │  [ Send to 6 conversations ]                       the one act, low      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The message leads, because the message is what this is (§98.3). The offers sit under it as
 * controls a person keeps or drops. The rows show the EXACT words each conversation will get —
 * §76's «strong review state» is not a confirmation dialog, it is being able to read what is about
 * to happen — and the one act sits low and large, which is where the thumb is.
 */
export function SupplyBroadcast({
  cast,
  issue,
  except,
  onClose,
}: {
  cast: Cast;
  issue: SupplyIssue;
  /** THE CONVERSATIONS ALREADY TOLD — Customer.id, handed over by §132.7's film when it sends one
   *  person their own message and then opens this for the rest. A broadcast that re-told them
   *  would put the same shortage in the same thread twice, five seconds apart, which is the one
   *  thing a person cannot undo. Absent everywhere else, which is why the count on the act is
   *  unchanged on every other entry. */
  except?: string[];
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const supply = useSupplyIssues(cast);
  const threads = useThreads(cast);
  const product = productOf(cast, issue.product);

  const swap = React.useMemo(() => swapFor(cast, supply.ledger, issue), [cast, supply.ledger, issue]);
  const rows = React.useMemo(
    () => affectedOf({ cast, sales: supply.sales, today: supply.today, issue })
      .filter((r) => !(except ?? []).includes(r.customer.id)),
    [cast, supply.sales, supply.today, issue, except],
  );
  const useful = React.useMemo(
    () => usefulNext({ cast, rules: supply.rules, issue, now: supply.now }),
    [cast, supply.rules, issue, supply.now],
  );

  /* THE OFFERS START WHERE ROCOTO WOULD PUT THEM and the person moves them from there — offered,
     never imposed. A swap the house cannot make is absent rather than dropped, so the control set
     says what is really available. */
  const [keep, setKeep] = React.useState<Alternative[]>(() =>
    ALTERNATIVES.filter((a) => a !== 'swap' || Boolean(swap)));
  /* §101.3 IS OFF UNTIL SOMEBODY PRESSES IT, on every row. This set is the whole of «never
     auto-sent»: it starts empty and only a press puts a customer's id in it. */
  const [reflex, setReflex] = React.useState<string[]>([]);
  const [sent, setSent] = React.useState<{ at: string; count: number } | null>(null);

  const template: Template = { keep: keep.filter((a) => a !== 'swap' || Boolean(swap)), swap };
  const textFor = (row: Affected): string =>
    messageFor({ cast, issue, row, template, useful: reflex.includes(row.customer.id) ? useful : undefined });

  const toggleKeep = (alt: Alternative): void =>
    setKeep((held) => (held.includes(alt) ? held.filter((a) => a !== alt) : [...held, alt]));

  const toggleReflex = (id: string): void =>
    setReflex((held) => (held.includes(id) ? held.filter((h) => h !== id) : [...held, id]));

  /* ── THE SEND ─────────────────────────────────────────────────────────────────────────────
     It walks the rows a person just read and writes each one's own message into that customer's
     conversation, at an hour that makes it the newest thing anybody has said (`replyHour`'s clock
     rule). There is no other write in this file, so «exactly the affected threads» is a property
     of the code rather than of a filter somebody has to maintain. */
  const send = (): void => {
    const at = replyHour(threads, nowOf(cast));
    for (const row of rows) sendToThread(cast.sector, row.customer.id, textFor(row), at);
    if (isPostHogConfigured) {
      posthog.capture('supply_broadcast_sent', {
        recipient_count: rows.length,
        alternatives_offered: keep.length,
        follow_up_offered: reflex.length > 0,
      });
    }
    setSent({ at, count: rows.length });
  };

  const head = phone ? theme.typography.HeadingXSmall : theme.typography.HeadingSmall;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size={MODAL_SIZE.auto}
      role={ROLE.dialog}
      overrides={{
        /* ── IT STANDS IN FRONT OF THE SURFACE (the same scar `search-modal.tsx` carries) ──────
           Base's own modal layer sits under this app's chrome, so the first shot came back with
           the inbox's sticky heading and the albarán log's rule PAINTED ACROSS the dialog — the
           reading's method line invisible behind a bar belonging to the screen underneath. One
           number, above the sheet's own layer and below the search palette. */
        Root: { props: { 'data-testid': 'supply-broadcast-root' }, style: { zIndex: BROADCAST_LAYER } },
        Dialog: {
          props: { 'data-testid': 'supply-broadcast', 'data-affected': rows.length, 'data-sent': sent ? 'yes' : 'no' },
          style: {
            width: phone ? 'calc(100vw - 24px)' : 'min(720px, calc(100vw - 96px))',
            maxHeight: 'calc(100vh - 96px)',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          },
        },
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale700,
          padding: phone ? theme.sizing.scale600 : theme.sizing.scale800,
          overflowY: 'auto',
          minWidth: 0,
        }}
      >
        {/* THE READING LEADS (§98.3). What is short, by how much, and how that was worked out. */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...head, minWidth: 0 }}>
            <Name of={product} /> is short for the book
          </h2>
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
            {units(issue.standing, issue.unit)} standing · {units(issue.committed, issue.unit)} on the book ·{' '}
            {/* THE GAP AND ITS WORD STAY ON ONE LINE. At 390 «2287 kg short» broke after the
                unit and left «short» alone under the figure — the unit keeps the number's line,
                and so does the word that says what the number IS. */}
            <span style={{ color: theme.colors.accent, whiteSpace: 'nowrap' }}>
              {issue.approx ? '~' : ''}{units(issue.short, issue.unit)} short
            </span>
          </span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
            {issue.method}
          </span>
        </header>

        {/* WHAT GOES OUT — the offers, as controls. Each one says the words it will put on the
            wire, so keeping one is reading it rather than trusting a label. */}
        <section
          data-testid="supply-offers"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
        >
          <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>What the message offers</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300, minWidth: 0 }}>
            {ALTERNATIVES.filter((a) => a !== 'swap' || Boolean(swap)).map((alt) => (
              <Button
                key={alt}
                kind={keep.includes(alt) ? KIND.primary : KIND.secondary}
                size={SIZE.mini}
                shape={SHAPE.pill}
                disabled={Boolean(sent)}
                overrides={{
                  BaseButton: {
                    props: {
                      'data-testid': `supply-alt-${alt}`,
                      'data-kept': keep.includes(alt) ? 'yes' : 'no',
                    },
                  },
                }}
                onClick={() => toggleKeep(alt)}
              >
                {alt === 'swap' && swap ? `${swap.name} instead` : ALTERNATIVE_WORD[alt]}
              </Button>
            ))}
          </div>
          {/* §101.3, said once at the top so a person knows what the row control does. It is a
              FACT about the offer, not a second control: the taking happens on the row. */}
          <span
            data-testid="supply-useful"
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
          >
            Rocoto can answer the next question on any row: &laquo;{useful}&raquo;
          </span>
        </section>

        {/* WHO IT GOES TO, WITH THE WORDS EACH ONE GETS. */}
        <section
          data-testid="supply-affected"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
        >
          <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>
            {rows.length} {rows.length === 1 ? 'conversation' : 'conversations'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {rows.map((row) => (
              <div
                key={row.customer.id}
                data-testid="supply-row"
                data-customer={row.customer.id}
                /* THE DAY THIS ROW IS FOR. The floor serves ONE day, so the fold's whole honesty
                   is in which days reach this list (§101.2's `onTheBook` cut) — and a number a
                   drive can read is a claim a drive can hold us to. */
                data-day={row.day}
                data-asked={row.asked}
                data-served={row.served}
                data-reported={row.reported ? 'yes' : 'no'}
                data-reflex={reflex.includes(row.customer.id) ? 'taken' : 'offered'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.sizing.scale200,
                  padding: `${theme.sizing.scale500} 0`,
                  borderTop: `1px solid ${theme.colors.borderOpaque}`,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: theme.sizing.scale400,
                    flexWrap: 'wrap',
                    minWidth: 0,
                  }}
                >
                  <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>
                    <Name of={row.customer} />
                  </span>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                    {dayLabelFromId(row.day)} · asked {units(row.asked, row.unit)}
                    {row.served > 0 ? ` · ${units(row.served, row.unit)} for them` : ''}
                  </span>
                  <span style={{ flex: 1 }} />
                  {/* THE OFFER, ON THE ROW IT IS ABOUT (§83.2 · §101.3). Unfilled until pressed. */}
                  <Button
                    kind={reflex.includes(row.customer.id) ? KIND.primary : KIND.tertiary}
                    size={SIZE.mini}
                    shape={SHAPE.pill}
                    disabled={Boolean(sent)}
                    overrides={{ BaseButton: { props: { 'data-testid': 'supply-reflex' } } }}
                    onClick={() => toggleReflex(row.customer.id)}
                  >
                    When it&rsquo;s back
                  </Button>
                </div>
                {row.reported && (
                  <span
                    data-testid="supply-asked-already"
                    style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.accent, minWidth: 0 }}
                  >
                    They already asked: {row.reported}
                  </span>
                )}
                <span
                  data-testid="supply-message"
                  style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
                >
                  {textFor(row)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* THE ONE ACT, LOW AND LARGE (§76's thumb rule) — and the feedback lands in its place, so
          what a person looks at after pressing is where they pressed. */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale500,
          padding: phone ? theme.sizing.scale600 : `${theme.sizing.scale600} ${theme.sizing.scale800}`,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        {sent ? (
          <span
            data-testid="supply-sent"
            data-count={sent.count}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale300,
              ...theme.typography.LabelSmall,
              color: theme.colors.accent,
              minWidth: 0,
            }}
          >
            <Glyph id="check" size={STEP.small} />
            Sent to {sent.count} {sent.count === 1 ? 'conversation' : 'conversations'} at {sent.at}
          </span>
        ) : (
          <Button
            kind={KIND.primary}
            size={SIZE.large}
            disabled={rows.length === 0}
            startEnhancer={<Glyph id="send" size={STEP.small} />}
            overrides={{ BaseButton: { props: { 'data-testid': 'supply-send' }, style: { width: '100%' } } }}
            onClick={send}
          >
            Send to {rows.length} {rows.length === 1 ? 'conversation' : 'conversations'}
          </Button>
        )}
        {sent && <span style={{ flex: 1 }} />}
        {sent && (
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            overrides={{ BaseButton: { props: { 'data-testid': 'supply-done' } } }}
            onClick={onClose}
          >
            Continue
          </Button>
        )}
      </footer>
    </Modal>
  );
}
