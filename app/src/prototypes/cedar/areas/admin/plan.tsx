/* PLAN — what the house pays Rocoto, and what it gets for it.
 *
 * The seat every admin canon has and §53 left for the deliberation (THE-ADMIN-CANON §2, verdict
 * ESSENTIAL): the plan they are on, what this month has used against the bundle they prepaid, the
 * card that pays, and the invoices Rocoto sends — which need the CIF that lives on the company
 * card, so the two seats are wired.
 *
 * ═══ ONE PLAN IS SHOWN (FEED-IA §104) ═══════════════════════════════════════════════════════
 * Peter, 2026-08-29: «Remember we only have one. Seat-based and order-based — but not with
 * "medium" or whatever. It's one that THEY SEE. I internally have them; maybe I show them in
 * email. But in pricing we only show the one they're on. And we show an order counter.»
 *
 * THE DISPLAY LAW, MADE MECHANICAL HERE:
 *   · `bandOf(company)` still decides the FIGURES — the monthly rate, the seats, the per-order
 *     rate. It is the internal band and it stays internal: `band.label` is read by nothing on
 *     this file's rendered surface, and the three-band comparison region is gone. A house sees
 *     ITS rate and ITS order rate, never a tier it is not on and never a tier's name;
 *   · THE ORDER COUNTER is the seat's second region — orders used this month against the BUNDLE
 *     the house prepaid, drawn as Base's own `ProgressBar` (§ never redraw, lift the real thing);
 *   · THE BUNDLE is prepaid at the MONTH'S START at 10% under the per-order rate, and orders
 *     above it run at the per-order rate and are settled by the card AT MONTH'S END. Both are
 *     said once, plainly, as facts about THIS house's price — never as an offer;
 *   · THE TRIAL MONTH's own facts stand only while the pilot runs — `useStage(cast) === 'bounded'`
 *     is the ledger's own word for it (THE-JOURNEY-CANON §1.1: a named cohort is live, and the
 *     status leaves by `expand` «after the month»). Nothing about the trial renders outside it.
 *
 * ═══ WHAT THE BUNDLE IS DERIVED FROM, AND WHAT IS HONESTLY MISSING ══════════════════════════
 * A prepaid bundle is a NUMBER THE HOUSE BOUGHT, and this build has no field to hold it —
 * `company.ts` carries the band and no bundle. So the bundle here is folded from the house's own
 * book: the orders the ledger holds for this month, rounded UP to the next hundred, which is what
 * «expected volume, rounded up» means when the expectation is their own river. The day
 * `company.bundle` exists, `bundleOf` below reads it instead and nothing else on the seat moves.
 *
 * ═══ THE LAW THIS SEAT EXISTS UNDER — A PRICE'S UNIT SHARES THE NUMBER'S LINE ═══════════════
 * Peter, 2026-08-17: «in pricing, never put the "per month" to be in a separate line. It should
 * always be in the same line as the number. That's like a fucking global rule. Otherwise, we really
 * mislead people.»
 *
 * WHY IT IS A MIS-SALE AND NOT A TASTE. Nobody reads a price; they SCAN it. A big «499 €» with «al
 * mes» dropped to a small line underneath is read as «499 €» and nothing else — so the page has
 * quoted a one-off for something that recurs. The reader is not careless; the typography told them
 * the number was finished.
 *
 * SO, MECHANICALLY, ON THIS SEAT:
 *   · the unit is an inline `<em>` INSIDE the figure element, smaller and dimmer, never a sibling
 *     block — `Rate` below is the only way a price is drawn here;
 *   · `white-space: nowrap` on the whole figure, because a unit that shares the line at 1440 and
 *     wraps at 360 is the same mis-sale on the device most people read on. Checked at 320px;
 *   · what MAY go on a second line is everything that is not the unit — «without IVA», «with 5.000
 *     orders», «three months up front». Those QUALIFY the figure; the unit DENOMINATES it;
 *   · the RATE leads and the term total follows underneath. A per-term total as the headline is the
 *     same failure by another route.
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ PLAN · one column, scrolling (§87) ─────────────────────────────────────────────────────┐
 *   │ PLAN     the ONE plan you are on — its RATE and its per-order rate, units on the numbers  │
 *   │ TRIAL    while the pilot month runs, and only then: cargo delivered · paid · when it ends │
 *   │ MONTH    the ORDER COUNTER — used against the bundle, the bar, and the month-end top-up   │
 *   │ PAYING   the card that pays · made out to (a DOOR to the CIF) · the billing address       │
 *   │          (editable in place) · Manage subscription → the portal, wearing the OUTWARD mark │
 *   │ INVOICES what Rocoto has billed, most recent first — every row a DOOR onto the invoice    │
 *   │          itself, and a download that puts a real file on the disk and says that it did    │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingMedium (the rate — the one big number on the seat) · HeadingXSmall (a
 *                section, a fact's figure) · LabelMedium (a row) · LabelXSmall (a fact's label).
 *   STATES       IN THE PILOT — the trial region stands; out of it, the seat has four regions.
 *                AT OR OVER THE BUNDLE — the counter's «Beyond the bundle» carries the count and
 *                the month-end settlement is the same sentence either way.
 *
 * ═══ THE ORDER: WHAT IS RUNNING OUTRANKS WHAT IS OFFERED (§98.3 · the acceptance walk) ══════
 * «The most important first.» Read the seat top to bottom: the plan you are on and what it costs,
 * the trial month if one is running, the month's own counter, then paying — card, made out to,
 * address, portal — and the invoices immediately under the portal row, which is what the
 * checkpoint's «INVOICE HISTORY DIRECTLY BELOW» is asking for. The walk's clause-3 finding was
 * that this seat opened on a rank of bands a house could buy; the bands are gone and the counter
 * took their place, so nothing on the seat now sells above what is running.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { ProgressBar } from 'baseui/progress-bar';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import PrintSheet, { SheetFoot, SheetMasthead } from '../../../../scenarios/canonical/print-sheet';
import type { PaperColumn, PaperRow } from '../../../../rocoto/paper';
import { useConfig } from '../../config';
import { Fact, Facts, List, Row, Section } from '../../rows';
import { buildSales, dayFromId, todayId } from '../../sale';
import { useDay } from '../../day';
import { useGrants } from '../../grants';
import { useStage } from '../../activation';
import { count } from '../../knows';
import { openCompany } from '../../anchors';
import { usePhone } from '../../shell/viewport';
import {
  bandOf, cents, euros, setCompany, useCompany, type Band, type Company,
} from '../../company';
/* THE EDITABLE VALUE, LIFTED FROM THE SEAT THAT SETTLED IT (§51.14 · the liftout law). The billing
   address belongs to the company card and is CHANGED here too, because here is where a person is
   thinking about the invoice — one field, one store, one editor. */
import { Value } from './business';
import type { AreaMeta } from '../../shell/area';

export const meta: AreaMeta = {
  id: 'plan',
  title: 'Plan',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

/**
 * A RATE, DRAWN THE ONE LEGAL WAY.
 *
 * The number and its unit are ONE line box. The unit is an inline `<em>` inside the figure, at the
 * step below and the ink below, and `nowrap` holds them together at every width. Nothing on this
 * seat draws a price any other way, which is what makes the law enforceable rather than remembered.
 */
function Rate({
  amount,
  unit = '/mo',
  big = false,
  /* ── HOW THE NUMBER IS SPELLED, SO CENTS CAN COME THROUGH THE SAME DOOR ────────────────────
     `euros` rounds to whole euros, which is right for 499 and wrong for 0,09 and for 56,70. The
     per-order rate and the bundle's own price are held in CENTS and spelled by `cents`, and they
     are rates like any other — so they come through this component rather than around it, which
     is the only thing that keeps «the unit shares the number's line» enforceable. */
  money = euros,
  testid,
}: {
  amount: number;
  unit?: string;
  big?: boolean;
  money?: (n: number) => string;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <span
      data-testid={testid}
      data-rate={amount}
      data-unit={unit}
      style={{
        ...(big ? theme.typography.HeadingMedium : theme.typography.HeadingXSmall),
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: theme.sizing.scale100,
        /* THE UNIT MAY NEVER LEAVE THE NUMBER'S LINE — at 1440, at 390, at 320 */
        whiteSpace: 'nowrap',
        flexWrap: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 0,
      }}
    >
      {money(amount)}
      <em
        style={{
          ...theme.typography.LabelSmall,
          color: theme.colors.contentTertiary,
          fontStyle: 'normal',
          whiteSpace: 'nowrap',
        }}
      >
        {unit}
      </em>
    </span>
  );
}

/** A PRICE, WITH THE LABEL THAT NAMES IT. `Fact` takes a string and a rate is not one — its unit
 *  has to stay inside the number's own line box — so a money figure is drawn here instead, at the
 *  same two steps a `Fact` uses, and every price on this seat is still a `Rate`. */
function Figure({
  label,
  children,
  testid,
}: {
  label: string;
  children: React.ReactNode;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <span
      data-figure={testid ?? label}
      data-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{label}</span>
      {children}
    </span>
  );
}

/** ── THE ORDER COUNTER'S BAR (FEED-IA §104 · «we show an order counter») ─────────────────────
 *  Base's own `ProgressBar`, the one `knows-web` already reads its albaranes on — margins taken
 *  off so it sits flush under the facts it belongs to, and nothing else changed. A bar drawn by
 *  hand here would be a second progress bar in one app. `successValue` is the bundle, so the fill
 *  is literally «what you have used of what you bought», and a month that runs past its bundle
 *  simply stands full while the count beside it keeps rising. */
function Counter({ used, bundle }: { used: number; bundle: number }) {
  const flush = { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 };
  return (
    <ProgressBar
      value={Math.min(used, bundle)}
      successValue={Math.max(bundle, 1)}
      showLabel={false}
      ariaLabel={`${used} of ${bundle} orders used this month`}
      overrides={{
        Root: {
          props: {
            'data-testid': 'usage-counter',
            'data-used': String(used),
            'data-bundle': String(bundle),
          },
          style: flush,
        },
        BarContainer: { style: flush },
        /* ── THE METER IS INK, NEVER THE ACCENT (§51: «the accent is Rocoto's own acts ONLY») ──
         * Base fills a progress bar with the theme's accent, which in this app is the one colour
         * that means «Rocoto did this». Orders counted against a bundle the house prepaid are the
         * HOUSE's own arithmetic, so the meter is drawn in ink over the paper's own grey — the same
         * two steps every hairline meter on «Your data» stands in. */
        Bar: {
          props: { 'data-testid': 'usage-counter-bar' },
          style: ({ $theme }) => ({ ...flush, backgroundColor: $theme.colors.mono300 }),
        },
        BarProgress: {
          style: ({ $theme }) => ({ backgroundColor: $theme.colors.contentPrimary }),
        },
      }}
    />
  );
}

/** A ROW OF FIGURES THAT WRAPS, WHERE `Facts` WOULD CLIP.
 *
 *  `Facts` is a fixed three-column grid and a `Rate` is a nowrap line box by law. At 390 a third
 *  of the seat is narrower than «56,70 € for the month», so a rate parked in a grid cell runs out
 *  of it sideways — the §77.2 failure, on a bill. Figures carrying a rate stand in a row that
 *  WRAPS instead: three across at 1600, stacked at 320, and never a character outside its box. */
function Strip({ children, testid }: { children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: theme.sizing.scale800,
        rowGap: theme.sizing.scale500,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ── THE MONTH THE SEAT IS STANDING IN, OFF THE APP'S OWN CLOCK ──────────────────────────────
 * Never `new Date()`. The walk caught a card stamping the reader's real clock inside a house whose
 * day is 22.08, and a bill is the last surface that may carry a date belonging to nobody in the
 * world the app is showing. Every date and every day count below comes off `todayId(cast)`.
 */

/** «31 Aug» — the last day of the month the app is standing in, in the same short month the
 *  invoice terms are said in, because a figure cell is narrow and this file already has one way
 *  of spelling a month. */
function monthEnd(today: string): string {
  const d = dayFromId(today);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getDate()} ${MONTHS[last.getMonth()]}`;
}

/** THE BUNDLE — what the house prepaid this month, in orders.
 *
 *  A bundle is bought in a round lot, so the expected volume rounds UP to the next hundred: a
 *  house whose month is running at 619 orders bought 700. `expected` is the ledger's own month —
 *  the days it holds, including the ones still ahead — because that is the house's own book and
 *  the only expectation this build has. When a `company.bundle` field exists this function reads
 *  it and every figure below is unchanged. */
const bundleOf = (expected: number): number => Math.max(100, Math.ceil(expected / 100) * 100);

/** WHAT THE BUNDLE COST, IN CENTS. The per-order rate, less a tenth, over the whole lot. It is
 *  said as a fact about THIS house's price and never as an offer. */
const bundleCentsOf = (bundle: number, perOrder: number): number =>
  Math.round(bundle * perOrder * 0.9);

/* ══ THE INVOICES ROCOTO HAS SENT (THE CHECKPOINT §4 · MAP 4.6, 4.7) ═══════════════════════════
 *
 * «Invoice history directly below; invoices accessible / downloadable.» The seat listed three
 * quarters and nothing opened, and the one button under them — `download-invoices` — carried no
 * `onClick` at all. So: every row is a DOOR, the door opens the invoice ON THE APP'S OWN PAPER,
 * and the act at the foot of it puts a real file on the person's disk.
 *
 * ═══ NO INVENTED INVOICE FIELDS (the map's own «deliberately NOT») ═══════════════════════════
 * Everything on the sheet is a fact this app already holds: the band and its rate, the three
 * months the term is, the house's razón social, its CIF, and the address it is billed at. There is
 * no serial the backend has not minted, no IVA line this build has no authority to compute, no due
 * date and no payment reference. The head of this seat already says «Without IVA», and a sheet that
 * suddenly produced a tax figure would be contradicting the surface it opened from.
 *
 * ═══ WHAT IS HONESTLY MISSING, RECORDED RATHER THAN FAKED ════════════════════════════════════
 * A FISCAL PDF IS MINTED BY A BACKEND. This build has no backend and no PDF writer, so «Download
 * it» writes the document as a plain text file carrying exactly the facts the paper shows — a real
 * file, really saved, really readable — and never claims to be the fiscal original. The day Stripe
 * is wired, the row's act becomes that invoice's hosted URL and this function goes.
 */

/** how a quarter is said. Month names are said in the app's own English, and the year rides the
 *  end because a term that crosses one is the ordinary case at the end of December. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Invoice = {
  /** how far back it is, in quarters — 0 is the term now running */
  back: number;
  /** «Jul – Sep 2026» */
  period: string;
  /** what the three months came to, in euros */
  total: number;
};

/** THE TERMS THIS HOUSE HAS PAID, off the app's own clock. The term is the quarter containing the
 *  day the app is standing on, because the band is billed three months up front (memory:
 *  rocoto-pedidos-pricing) — so the record and the term are the same shape, which is what makes
 *  «the quarter you are in» a true sentence rather than a caption. */
function invoicesOf(today: string, band: Band, how = 3): Invoice[] {
  const d = dayFromId(today);
  const openMonth = Math.floor(d.getMonth() / 3) * 3;
  return Array.from({ length: how }, (_, back) => {
    const start = new Date(d.getFullYear(), openMonth - back * 3, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 2, 1);
    return {
      back,
      period: `${MONTHS[start.getMonth()]} – ${MONTHS[end.getMonth()]} ${end.getFullYear()}`,
      total: band.rate * 3,
    };
  });
}

/** THE INVOICE AS A FILE, in the words the paper prints. It is written from the SAME `Invoice` and
 *  the SAME company the sheet renders, so what is saved and what was looked at cannot differ. */
function invoiceText(inv: Invoice, band: Band, company: Company): string {
  return [
    'ROCOTO · FACTURA',
    '',
    `Made out to   ${company.legalName}`,
    `CIF           ${company.taxId}`,
    `Billed at     ${company.billingAddress}`,
    '',
    `Term          ${inv.period}`,
    /* ONE PLAN, AND ITS TWO RATES (§104). The internal band's NAME appears on nothing a house
       reads — a saved file is something a house reads, so the «Band» line that stood here is
       gone and what it was standing in front of, the two rates, is what the line says now. */
    `Rate          ${euros(band.rate)} /mo · ${cents(band.perOrder)} an order`,
    `People        ${company.members.length} on the account`,
    `Three months  ${euros(inv.total)}, up front. Plus IVA.`,
    '',
  ].join('\n');
}

/** PUT A FILE ON THEIR DISK. One helper, so the row's act and the «all of them» act below cannot
 *  produce two different documents from one set of facts. */
function save(name: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* the object URL is a live handle on a blob; the browser has read it by the next frame */
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** the file's own name — the house and the term, so three of them in a downloads folder are three
 *  different files a person can tell apart */
const invoiceFile = (inv: Invoice, company: Company): string =>
  `rocoto-${company.legalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${inv.period.replace(/\s+/g, '')}.txt`;

/* ── THE INVOICE, ON THE APP'S OWN PAPER ─────────────────────────────────────────────────────
 * It is `PrintSheet` — the canonical surface the albarán, the day's sheet and the packing list all
 * come off — handed a masthead, a column set and rows, and changed in no other way. That is the
 * whole test of whether that component is a sheet or an albarán: a document from a DIFFERENT
 * COMPANY to this house renders on it with data alone.
 */
function InvoicePaper({
  invoice,
  band,
  company,
  onClose,
}: {
  invoice: Invoice;
  band: Band;
  company: Company;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  /* ── THE WHOLE SHEET, WITHOUT A SCROLL (§76: «one clear task at a time») ────────────────────
     `PaperStage` scales an A4 to the width it is given and scrolls what does not fit. At the
     stage's default the foot — the line that says what the three months came to — sat below the
     fold, so an invoice opened on its own total. The stage is sized to the PAGE instead: 470px of
     A4 is 597px tall, and the ground is given the room for it plus its own head. On a phone the
     card is clamped to the viewport, so the sheet is clamped with it — a page that overflowed its
     own card sideways would be the §77.2 failure on the one surface that is literally paper. */
  const phone = usePhone();
  const stageWidth = phone ? 288 : 470;
  /* the page's own scaled height plus the ground's head — measured, so no slack under the sheet */
  const stageHeight = phone ? 400 : 645;
  /* ── A SAVE THAT SAYS IT SAVED (the walk's P2-11, on the sheet's own act) ───────────────────
     A download is the one act a web page performs OUTSIDE its own window: the file lands in a
     folder the person is not looking at, so from the screen's side a working button and a dead
     one are the same picture — which is exactly how the seat's «Download them» read as inert.
     The name of the file that was written is the evidence, and it stands on the surface. */
  const [saved, setSaved] = React.useState<string | null>(null);

  const columns: PaperColumn[] = [
    { key: 'what', label: 'What', width: '1fr' },
    { key: 'term', label: 'Term', width: '110px' },
    { key: 'rate', label: 'Rate', width: '110px', align: 'end' },
    { key: 'total', label: 'Total', width: '110px', align: 'end' },
  ];

  const rows: PaperRow[] = [{
    id: 'plan',
    cells: {
      what: 'Rocoto',
      term: '3 months',
      /* THE PRICE-UNIT LAW HOLDS ON PAPER TOO. The unit rides the number inside one line box. */
      rate: <Rate amount={band.rate} testid="paper-rate" />,
      total: euros(invoice.total),
    },
    sub: [
      { label: 'People', value: `${company.members.length} on the account` },
      { label: 'Per order', value: `${cents(band.perOrder)} beyond the bundle` },
    ],
  }];

  return (
    <div data-testid="invoice-paper" data-period={invoice.period}>
      <PrintSheet
        heading={`Factura · ${invoice.period}`}
        standfirst={`${company.legalName} · ${company.taxId}`}
        columns={columns}
        rows={rows}
        stageWidth={stageWidth}
        height={stageHeight}
        masthead={(
          <SheetMasthead
            issuer="Rocoto"
            document="Factura"
            recipient={<>{company.legalName} · {company.taxId}<br />{company.billingAddress}</>}
            day={invoice.period}
          />
        )}
        foot={<SheetFoot totals={`${euros(invoice.total)} for the three months, up front. Plus IVA.`} />}
        action={(
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                data-testid="invoice-download"
                onClick={() => {
                  const name = invoiceFile(invoice, company);
                  save(name, invoiceText(invoice, band, company));
                  setSaved(name);
                }}
              >
                Download it
              </Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose} data-testid="invoice-close">
                Close
              </Button>
            </div>
            {saved && (
              <span
                data-testid="invoice-paper-saved"
                data-file={saved}
                style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}
              >
                Saved as {saved}
              </span>
            )}
          </div>
        )}
      />
    </div>
  );
}

export default function Plan() {
  const [, theme] = useStyletron();
  const company = useCompany();
  const { derived } = useConfig();
  const cast = derived.cast;
  const ledger = useDay(cast.sector);
  const grants = useGrants();
  const band = bandOf(company);
  /* ── IS THE PILOT MONTH RUNNING (§104 · THE-JOURNEY-CANON §1.1) ─────────────────────────────
     The ledger already answers this and nothing new stores it: `bounded` IS «a named cohort of
     real customers is live», and the status leaves it by `expand`, «after the month». So the
     trial's facts stand exactly while the trial does, and a house that has not gone live or has
     opened its whole book never sees a word about a trial. */
  const pilot = useStage(cast) === 'bounded';

  /* WHAT THIS MONTH HAS USED, COUNTED off the same river Sales draws. A usage figure a person
     cannot check against their own work is a number they have to trust; this one is the orders
     themselves. The month is the day's own month, so it moves with the app's clock. */
  const sales = React.useMemo(() => buildSales(cast, ledger), [cast, ledger, grants]);
  /* ── THE MONTH KEY, CORRECTED (the C2 defect, again — AUDIT-2's own evidence) ───────────────
     This read `todayId(cast).split('.')[1]`, and a day id is `2026-08-29`: there is no dot in it,
     so the key was `undefined ?? ''` on BOTH sides of the comparison and every sale in the river
     matched. «Orders this month» was counting orders in every month the river holds — a wrong
     number on the surface that decides a bill, which is the one place a wrong number is not a
     rounding error. The key is the id's own year-month, which is what the id already is. */
  const today = todayId(cast);
  const month = today.slice(0, 7);
  const inMonth = React.useMemo(
    () => sales.filter((s) => s.day.slice(0, 7) === month),
    [sales, month],
  );
  /* ── «USED» IS WHAT HAS HAPPENED, NOT WHAT IS SCHEDULED ────────────────────────────────────
     The river carries the days ahead as well as the days behind, and a counter that spent
     tomorrow's albaranes against this month's bundle would bill a house for orders that have not
     been placed — the same class of wrong number as the C2 month key above, which is the one
     place a wrong number is not a rounding error. Day ids sort, so the bound is a comparison. */
  const used = inMonth.filter((s) => s.day <= today).length;
  /* what has actually gone out under it — the trade's own reading of a delivered day */
  const delivered = inMonth.filter(
    (s) => s.day <= today && (s.state === 'delivered' || s.state === 'settled'),
  ).length;
  /* THE BUNDLE, AND WHAT IS RUNNING PAST IT. The whole month's expected volume rounds up to the
     lot they bought; anything above it is what the card settles at month's end. */
  const bundle = bundleOf(inMonth.length);
  const beyond = Math.max(0, used - bundle);
  const bundleCents = bundleCentsOf(bundle, band.perOrder);
  const ends = monthEnd(today);
  const invoices = React.useMemo(() => invoicesOf(todayId(cast), band), [cast, band]);
  /** which invoice is open on the paper, by how far back it is */
  const [openInvoice, setOpenInvoice] = React.useState<number | null>(null);
  const invoice = invoices.find((i) => i.back === openInvoice) ?? null;
  /* ── THE PORTAL IS A BACKEND FACT (MAP 4.5) ────────────────────────────────────────────────
     A Stripe customer-portal URL is minted per customer by a server this build does not have. So
     the door is real and what it opens is the app saying so, in one sentence, on its own card —
     which is the honest shape for a control whose far side is not built yet. */
  const [portal, setPortal] = React.useState(false);
  /** the file the «Download them» act last wrote — the evidence that it wrote one (P2-11) */
  const [savedInvoices, setSavedInvoices] = React.useState<string | null>(null);

  return (
    <div
      data-testid="seat-plan"
      /* THE MONTH THE USAGE FIGURE IS COUNTING, STATED. It is the fact the C2 defect above hid:
         a key that came out empty counted every month at once and nothing on the surface said so.
         An attribute a drive can read is what turns «the number is right» from a claim into a
         check (the gates-fail-closed law: an assertion nobody can make red is not an assertion). */
      data-month={month}
      /* WHETHER THE TRIAL REGION MAY STAND, ON THE SEAT ITSELF. The region's presence is a
         CONDITION, and a condition nobody can read is a condition nobody can make red: with this,
         a drive holds «the trial's facts stand exactly when the pilot runs» from both sides. */
      data-pilot={pilot ? 'yes' : 'no'}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale900, minWidth: 0 }}
    >
      {/* ── THE ONE PLAN THEY ARE ON (§104) ────────────────────────────────────────────────
          THE RATE LEADS, and the per-order rate stands beside it at the step below, because the
          plan is seat-based AND order-based and a house that only sees one of the two numbers
          cannot read its own bill. Both are `Rate`, so both carry their unit inside their own line
          box at every width. The term total is underneath, in the small print where a total
          belongs — leading with «1.497 € the quarter» is the same mis-sale as putting «/mo» on its
          own line. NOTHING HERE NAMES A TIER: `band.label` is read by no surface in this file. */}
      <section
        data-testid="plan-head"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale300,
          padding: theme.sizing.scale700,
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius400,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
          Your plan
        </span>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            columnGap: theme.sizing.scale700,
            rowGap: theme.sizing.scale200,
            minWidth: 0,
          }}
        >
          <Rate amount={band.rate} big testid="plan-rate" />
          <Rate amount={band.perOrder} unit="an order" money={cents} testid="plan-order-rate" />
        </div>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
          Without IVA. {euros(band.rate * 3)} for the three months, up front.
        </span>
      </section>

      {/* ── THE TRIAL MONTH, WHILE IT RUNS (§104) ──────────────────────────────────────────
          Three facts and no prose. The heading says which month this is; the facts say what has
          gone out under it, what was paid for it, and the day it ends. A sentence under them would
          restate the facts beside it, which is the slot the content canon deletes rather than
          rewrites. It stands only in the pilot — see `pilot` above. */}
      {pilot && (
        <Section title="Your trial month" testid="trial">
          <Strip testid="trial-facts">
            <Fact label="Cargo delivered" value={`${count(delivered)} orders`} testid="trial-delivered" />
            <Figure label="Paid" testid="trial-paid">
              <Rate amount={bundleCents} unit="for the month" money={cents} testid="trial-paid-rate" />
            </Figure>
            <Fact label="Ends" value={ends} testid="trial-ends" />
          </Strip>
        </Section>
      )}

      {/* ── THE ORDER COUNTER (§104 · «and we show an order counter») ───────────────────────
          What the month has used, against the bundle they prepaid, with the bar under it so the
          three figures read as one state rather than three numbers. Then the mechanic, said once:
          the bundle is prepaid at the month's start under the per-order rate, and everything above
          it is settled by the card at month's end. */}
      <Section title="This month" testid="usage">
        {/* ── THE THREE COUNTED NUMBERS, ON ONE GRID ─────────────────────────────────────────
            Their LABELS carry the noun, so the figures stay bare digits: a fixed third of the seat
            is narrow at 320px, and `Fact` stamps its own `data-value` off the same value — a
            grouped string would make the one machine-readable attribute on a billing figure
            unparseable. Raw numbers are what this seat's facts have always been passed. */}
        <Facts testid="usage-facts">
          <Fact label="Orders used" value={used} testid="usage-orders" />
          <Fact label="Your bundle" value={bundle} testid="usage-bundle" />
          <Fact label="Beyond the bundle" value={beyond} testid="usage-beyond" />
        </Facts>
        <Counter used={used} bundle={bundle} />
        <Strip testid="usage-money">
          {/* ONE STRING, ONE HOME. While the trial runs, «Paid» above is this same figure, and a
              price printed twice in one column is the wallpaper the content canon names. */}
          {!pilot && (
            <Figure label="Prepaid this month" testid="usage-prepaid">
              <Rate amount={bundleCents} unit="for the month" money={cents} testid="usage-prepaid-rate" />
            </Figure>
          )}
          <Fact label="People on the account" value={company.members.length} testid="usage-people" />
        </Strip>
        <p
          data-testid="usage-method"
          style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, maxWidth: '58ch' }}
        >
          You prepay the bundle at the month&rsquo;s start, at 10% under the per-order rate.
          {' '}Orders above the bundle run at the per-order rate.
          {' '}Your card settles them at month&rsquo;s end.
        </p>
      </Section>

      {/* ── WHO PAYS, AND WHO THE INVOICE IS MADE OUT TO ───────────────────────────────────
          The CIF row is a DOOR back to the company card (§43 both ways): Rocoto's own invoices need
          it, so the seat that needs it names it and the seat that owns it holds it. */}
      <Section title="Paying for it" testid="paying">
        <List testid="paying-rows">
          <Row
            testid="card"
            mark="plan"
            label="The card that pays"
            sub="What the three months come off, up front."
            /* THE ROW DECLARES THE VALUE UNCUTTABLE (§77.2 · C21). A card number clipped to
               «•••• 424» is not a card number, it is a rumour — the same failure the CIF row
               records. `token` stops the column shrinking under the label. */
            token
            /* AND THE CARD IS WRITTEN HERE (§122). It sat between a door and an editor as the one
               inert row in the section — «•••• 4242» that answered nothing — so a house whose card
               expired had to go and find a portal. It takes the company card's own editor, the same
               one the billing address two rows down already uses: one grammar for both. */
            value={
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
                {/* THE MASK IS NOT PART OF THE NUMBER. «••••» is what the app knows it must not
                    show; the four digits are what the house wrote — so the dots stand outside the
                    field and only the writable half is writable. */}
                <span aria-hidden="true">••••</span>
                <Value
                  token
                  value={company.card}
                  label="The last four digits of the card that pays"
                  placeholder="Add a card"
                  testid="card-value"
                  onSave={(card) => setCompany({ card })}
                />
              </span>
            }
          />
          {/* ── AND NEITHER DOES THIS ONE, FOR THE SAME REASON (§77.2, found in the 390 sweep) ──
              «Rocoto's own invoices carry your razón social and your CIF» sat under a row whose
              label says «Made out to» and whose value IS a razón social and a CIF. At 390 the
              label column is `flex: 1` against a value taking 58%, so the restatement clamped to
              «Rocoto's own…» — a sentence cut mid-word to explain something the two facts beside
              it already said. Cutting it gives the label its line back and takes nothing away. */}
          <Row
            testid="billed-to"
            mark="brand"
            label="Made out to"
            value={`${company.legalName} · ${company.taxId}`}
            wrapValue
            onOpen={() => openCompany()}
          />
          {/* ── AND WHERE THEY GO (THE CHECKPOINT §2 · §4 · MAP 2.4) ────────────────────────
              «Billing details; BILLING ADDRESS.» The field lives on the company card with the
              other two addresses, and it is CHANGED here as well as there, through the company
              card's own editor — the §51.14 grammar, imported rather than drawn again. A person
              thinking about an invoice is standing on this seat, and sending them to another one
              to type a street is the trip §53's card style exists to delete. */}
          <Row
            testid="billing-address"
            mark="sign"
            label="Billing address"
            /* NO SUB (THE-CONTENT-CANON §4 · AUDIT-2 C19/C20). «Where the invoice is made out
               to» is «Billing address» said again, and at 390 it cost the row real width: the
               label column is `flex: 1` and a wrapping value takes 58%, so a restated sentence
               clamped to «Where the invoice is…» while starving the label into two lines. The
               section is «Paying for it» — every row under it is about Rocoto's own invoice, so
               the label is the whole fact. (The company card's copy of this row DOES carry one,
               because there the sentence says something its two address siblings cannot: that
               this is ROCOTO's invoice and not the house's own.) */
            wrapValue
            value={(
              <Value
                value={company.billingAddress}
                label="Billing address"
                placeholder="Add the address"
                testid="plan-billing-address"
                multiline
                onSave={(billingAddress) => setCompany({ billingAddress })}
              />
            )}
          />
          {/* ── THE PORTAL (THE CHECKPOINT §4 · MAP 4.5) ────────────────────────────────────
              «Manage subscription → Stripe customer portal.» It is the one row in this app that
              hands the reader to another company's screen, so it is the one row wearing the
              OUTWARD mark instead of the chevron (§85's «external-link marks… where true», and
              the chevron law from the other side: a press that leaves has not drilled in). */}
          <Row
            testid="manage-subscription"
            mark="plan"
            label="Manage subscription"
            sub="Your card, your invoices and the term, on Stripe."
            outward
            onOpen={() => setPortal(true)}
          />
        </List>
      </Section>

      {/* ── WHAT ROCOTO HAS BILLED ─────────────────────────────────────────────────────────
          Three months, because a quarter is what is paid up front — so the record and the term are
          the same shape. Every row carries its RATE with the unit on the number. */}
      <Section title="Your invoices" testid="invoices">
        <List testid="invoice-rows">
          {invoices.map((inv) => (
            <Row
              key={inv.back}
              testid={`invoice-${inv.back}`}
              mark="doc"
              /* ── THE TERM LEADS, BECAUSE THE TERM IS WHAT DIFFERS (the reference bar) ──────
                 Three rows carrying one identical string with the fact underneath it are the
                 wallpaper the content canon names, and the opposite of what every invoice history
                 a person has ever read does. Stripe's and ChatGPT's both lead with the PERIOD,
                 because that is what somebody matches against a bank statement. So the label is
                 the term, and the rate stands beside it. The nearest one keeps its nearness word,
                 the way every other day in this app does (§18), and the others carry no sub at
                 all — a tier's name was what used to fill that slot (§104), and a string repeated
                 down a list to fill a slot is the same wallpaper by another route. */
              label={inv.period}
              sub={inv.back === 0 ? 'The quarter you are in.' : undefined}
              value={<Rate amount={band.rate} testid={`invoice-${inv.back}-rate`} />}
              /* EVERY ROW IS A DOOR (§43, and MAP 4.7). It opens the invoice itself, on the same
                 paper every other document in this app is looked at on. */
              onOpen={() => setOpenInvoice(inv.back)}
            />
          ))}
        </List>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, alignItems: 'flex-start', minWidth: 0 }}>
          {/* ── THE BUTTON THAT DID NOTHING NOW DOES THE THING IT SAYS, AND SAYS THAT IT DID ──
              MAP 4.7 found it with no `onClick` at all; the walk's P2-11 then found it STILL
              reading as inert with one, and both readings were fair. A download is the one act a
              page performs outside its own window — the file lands in a folder the person is not
              looking at, so from the screen's side a working control and a dead one paint the
              same picture. The file's own name, on the surface, is the evidence that separates
              them, and it is what a drive holds too. All three terms, as one file, in the words
              the paper prints. */}
          <Button
            kind={KIND.tertiary}
            size={SIZE.compact}
            data-testid="download-invoices"
            onClick={() => {
              const name = `rocoto-invoices-${company.legalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.txt`;
              save(name, invoices.map((inv) => invoiceText(inv, band, company)).join('\n────────────────────\n\n'));
              setSavedInvoices(name);
            }}
          >
            Download them
          </Button>
          {savedInvoices && (
            <span
              data-testid="invoices-saved"
              data-file={savedInvoices}
              style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}
            >
              Saved as {savedInvoices} · {invoices.length} terms
            </span>
          )}
        </div>
      </Section>

      {/* ── ONE INVOICE, ON PAPER ─────────────────────────────────────────────────────────── */}
      <OverlayCard
        isOpen={invoice !== null}
        onClose={() => setOpenInvoice(null)}
        scrim={SCRIM.dim}
        size={560}
        ariaLabel="Invoice"
      >
        {invoice ? (
          <InvoicePaper invoice={invoice} band={band} company={company} onClose={() => setOpenInvoice(null)} />
        ) : (
          <span />
        )}
      </OverlayCard>

      {/* ── THE PORTAL'S FAR SIDE, STATED (MAP 4.5) ───────────────────────────────────────────
          The door is real and this is what is behind it today. A design build that drew a Stripe
          screen of its own would be showing a person a product Rocoto does not own; a row that
          simply did nothing would be the inert button this package came here to end. So the card
          says the one true sentence and offers the way back. */}
      <OverlayCard
        isOpen={portal}
        onClose={() => setPortal(false)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Manage subscription"
      >
        <div
          data-testid="portal-card"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
        >
          <div>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Manage subscription</h2>
            <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
              This opens your account on Stripe, where the card, the term and the receipts live.
              Rocoto mints that link for {company.legalName} when the account is live.
            </p>
          </div>
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setPortal(false)} data-testid="portal-done">
              Back to the plan
            </Button>
          </div>
        </div>
      </OverlayCard>
    </div>
  );
}
