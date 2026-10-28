import { solesRate } from './currency';
/* THE INCOMING LEDGER — every arrival, in one trail. V2-STOCK.
 *
 * ═══ WHY A LEDGER AND NOT A STOCK FIELD (LOTS-EXPLAINED §4) ═══════════════════════════════════
 * «Inventory is an announcement of what's happening» — which is event sourcing, thirty years old
 * and boring on purpose: nothing edits the past, things only HAPPEN, and the figure on a product
 * card is arithmetic over everything that happened to it.
 *
 *   · a supplier albarán lands by email      → an arrival, +50 kg, with its file as evidence
 *   · a paper albarán photographed at the bay → the same arrival through a different door
 *   · «we just added»                         → an arrival typed by hand
 *   · «here's what we actually have»          → a STOCKTAKE, and the gap files itself as a VARIANCE
 *   · a par rule at 06:00                     → an announcement the machine made (rules.ts)
 *
 * So «paper trail vs working reality» is not two systems. It is ONE ledger where some events carry
 * a document and one of them carries a shrug — and the product card draws the two totals of that
 * one ledger side by side. What auditors refuse is a number that silently changed; documented
 * honesty beats silent perfection, and the law agrees.
 *
 * ═══ THE THREE RULES THIS FILE KEEPS ══════════════════════════════════════════════════════════
 *
 * 1 · THE TRAIL IS WHAT THE DOCUMENTS SAY. `trail` sums the arrivals that carry a FILE — an email
 *     with its albarán, a photograph of one at the bay, a hand entry with the picture attached.
 *     The hands and the rules move the WORKING REALITY and leave the trail exactly where it was,
 *     which is what makes the struck-through figure on the card mean something.
 *
 * 2 · THE MACHINE'S ROWS ARE DERIVED, NEVER STORED. A par rule's emissions are computed from the
 *     rule and the clock (rules.ts §1) and merged into the trail at read time, so a prototype shut
 *     on Tuesday and opened on Thursday has Wednesday's announcement in its ledger, and no two
 *     surfaces can disagree about what a rule emitted.
 *
 * 3 · A STOCKTAKE NEVER ERASES. Declaring «14 kg» against a ledger standing at 17 writes TWO rows:
 *     the count, which is what stands, and the variance — «−3 kg, cause unknown, declared by hand»
 *     — which depletes the open lotes oldest-first and stays on the record forever.
 *
 * NO PROVIDER, the same reasoning as rules.ts: `main.tsx` and `App.tsx` belong to V2-CORE, so a
 * surface that needed a provider mounted above it could not be written without editing them. One
 * module singleton, read through `useSyncExternalStore`.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import type { Cast, Product } from '../../scenarios/data/cast';
import { productOf, supplierOf } from '../../scenarios/data/cast';
import type { AppConfig } from './config';
import { clockAfter } from './day';
import { dayKey, emissions, instantOf, isLive, type Rule } from './rules';

/* ── THE EVENT ────────────────────────────────────────────────────────────────────────────── */

/** The six doors a movement comes through. Five are events; `rule` is derived from a rule. */
export type IncomingKind = 'email' | 'photo' | 'added' | 'counted' | 'variance' | 'rule' | 'allocated';

/* ── WHICH PAPER A MESSAGE CARRIED (FEED-IA §119.3) ───────────────────────────────────────────
 * «Why not one with a problem maybe or another with a credit note?» — Peter, on an inbox whose
 * every row was the same shape of albarán. A supplier's post is not one kind of document: it is
 * the delivery note, and it is the ABONO that follows when part of a landing is credited back.
 * The two are read differently and they say different things, so the ledger names which one a
 * message carried instead of leaving the surface to infer it from the absence of arrivals.
 * Absent, a row carries an albarán — every event written before this existed still does. */
export type PaperKind = 'albaran' | 'abono';

/** What a row does to the figure. `record` moves nothing — it is a row whose whole job is to say
 *  in words what another row did, which is precisely what a variance posting is. */
export type Effect = 'delta' | 'level' | 'record';

/** The document behind an arrival. `src` is a picture somebody took; `batch` names the landing
 *  whose supplier sheet the surface can draw at full size. Either way the chip opens the REAL
 *  thing rather than a picture of one. */
export type IncomingFile = {
  name: string;
  src?: string;
  /** Batch.id — the arrival this document evidences */
  batch?: string;
};

/** How much a variance took out of one lote. */
export type Depletion = { lot: string; qty: number };

export type IncomingEvent = {
  id: string;
  kind: IncomingKind;
  /** the catalogue this happened in */
  sector: SectorId;
  /** Product.id */
  product: string;
  at: Date;
  /** The day the goods were produced, when the receiver knows it. This is distinct from the
   *  immutable time the stock event entered the book. */
  productionDate?: string;
  effect: Effect;
  /** the number the row carries: a quantity, a level, or a gap */
  qty: number;
  /** it shares the number's line wherever it is drawn */
  unit: string;
  /** the lote it landed on */
  lot?: string;
  /** Stable lot identity; legacy seed rows use their original code as identity. */
  lotId?: string;
  /** Attribution changes affect lots only, never the physical balance. */
  allocations?: Array<{ lot: string; code: string; qty: number }>;
  allocationOrigin?: 'count' | 'review';
  file?: IncomingFile;
  /** Supplier.id, for an arrival that came from outside */
  supplier?: string;
  /** the subject line an email arrival carried */
  subject?: string;
  /** which paper the message carried (§119.3). Absent = an albarán. */
  paper?: PaperKind;
  /** what a credit note is worth, in the money the albarán was priced in. It rides the row
   *  because an abono's whole content is a quantity AND what it comes to. */
  credit?: number;
  /** Visibly marked scenario evidence; never a provider receipt or production stock event. */
  fixture?: boolean;
  /** «06:00» — the rule's own time, for an emission's attribution */
  ruleAt?: string;
  /** what a variance drew down, oldest lote first */
  depletions?: Depletion[];
  /** where the ledger stood before a stocktake, so the row can state the gap */
  from?: number;
  /** THE NUMBER IS ABOUT (§17.4 · §17.8). The house said «about 60 boxes», and that is a real
   *  claim, not a rounder one — so the claim travels with the figure instead of being flattened
   *  into a precision nobody offered. Everything downstream carries it (`fold`, `lotBook`) and
   *  every surface draws it as the tilde on the number's own line. */
  approx?: boolean;
};

/* ── THE SEEDED ARRIVALS ──────────────────────────────────────────────────────────────────────
 * Built from the cast and nothing else (law 10: no name is typed into a screen). Every landing in
 * `cast.batches` came through a door, and WHICH door is the config's business:
 *
 *   · the inbox connected → the supplier's albaranes arrive by email, and the last landing — the
 *     one the stall handed over at 05:30 with no code on it — was photographed at the bay.
 *   · the inbox off       → the goods still arrived and the paper still exists, so every one of
 *     them came in through the camera. Nothing disappears when a connection is missing.
 */

/** The last landing is the one that arrived without a code, which is the ordinary case
 *  LOTS-EXPLAINED §2 is written for: the law prefers an invented code to a missing one. */
const codeless = (cast: Cast, index: number): boolean => index === cast.batches.length - 1;

/* ── THE CREDIT NOTE, SEEDED (FEED-IA §119.3) ─────────────────────────────────────────────────
 * A supplier post is albaranes AND abonos, and an inbox that only ever holds one of them teaches
 * a person that the other is not read. So one landing is followed by the supplier's own credit
 * note for the part of it that was short.
 *
 * ⚠ THIS IS SEED MATERIAL AND IT SAYS SO. Every number in it comes off the cast — the supplier,
 * the goods, the lote, the day, and the price the crate was bought at — except the SHARE, which
 * is stated here as a constant because the cast holds no short-delivery fact to derive it from.
 * That is the same honesty every other line of this function keeps: the hours, the file names and
 * the subject lines are seeds too. When a house's real post is wired in, this goes.
 */
const CREDIT_SHARE = 0.05;
/** which landing the supplier credited — the SECOND, so the inbox's first row stays the plain
 *  albarán and the three kinds read as three different rows rather than as one repeated. */
const CREDITED = 1;

function creditNote(cast: Cast, now: Date): IncomingEvent | null {
  const batch = cast.batches[CREDITED];
  if (!batch) return null;
  const product = productOf(cast, batch.product);
  const qty = Math.round(batch.qty * CREDIT_SHARE);
  const day = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  return {
    id: `abono-${batch.id}`,
    kind: 'email',
    sector: cast.sector,
    fixture: true,
    product: batch.product,
    /* it lands AFTER the goods did, because a credit note answers a delivery */
    at: instantOf(day, clockAfter(cast.hour, 95)),
    /* IT MOVES NOTHING ON THE FLOOR. The goods that were credited never came in, so the stock
       figure already tells the truth — an abono is a fact about the paper and the money, and a
       row that moved the count a second time would take the shortfall off the shelf twice. */
    effect: 'record',
    qty,
    unit: product.unit,
    lot: batch.id,
    supplier: batch.supplier,
    subject: `Abono A-${batch.id.replace(/^L-/, '')}`,
    paper: 'abono',
    credit: Math.round(qty * batch.cost * 100) / 100,
    file: { name: `abono-A-${batch.id.replace(/^L-/, '')}.pdf`, batch: batch.id },
  } satisfies IncomingEvent;
}

export function seedArrivals(cast: Cast, config: AppConfig, now: Date): IncomingEvent[] {
  const feed = config.emailFeed.connected;
  return cast.batches.map((batch, i) => {
    const product = productOf(cast, batch.product);
    const byEmail = feed && !codeless(cast, i);
    /* the last landing came in yesterday, so the trail reads as a trail and not as a list */
    const day = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (codeless(cast, i) ? 1 : 0)));
    return {
      id: `arrival-${batch.id}`,
      kind: byEmail ? 'email' : 'photo',
      sector: cast.sector,
      fixture: true,
      product: batch.product,
      /* THE NIGHT'S LANDINGS, ON THE FLOOR BEFORE THE MORNING'S FIRST ANNOUNCEMENT. The hour a
         house keeps is the hour it opens on — the lonja at 05:00, the meat room at 08:00 — and a
         par rule offered that same hour is announcing where the day STARTS. So the goods have to
         be in before it speaks, or a rule saying «kept at 40» would be followed by 74 kg landing
         on top of it and the card would read 114 for reasons only the ledger could explain. */
      at: instantOf(day, clockAfter(cast.hour, -50 + i * 18)),
      effect: 'delta',
      qty: batch.qty,
      unit: product.unit,
      lot: codeless(cast, i) ? undefined : batch.id,
      supplier: batch.supplier,
      subject: `Delivery Note ${batch.id}`,
      file: {
        name: byEmail ? `albaran-${batch.id}.pdf` : `albaran-${batch.id}.jpg`,
        batch: batch.id,
      },
    } satisfies IncomingEvent;
  });
}

/** Everything the supplier's post carried — the albaranes, and the credit note that answered one
 *  of them (§119.3). The abono rides the same connection, so it comes with the feed and goes with
 *  it: a house whose inbox is off has the paper and none of the mail. */
export function seedPost(cast: Cast, config: AppConfig, now: Date): IncomingEvent[] {
  const arrivals = seedArrivals(cast, config, now);
  const abono = config.emailFeed.connected ? creditNote(cast, now) : null;
  return abono ? [...arrivals, abono] : arrivals;
}

/* ── THE MACHINE'S ROWS ───────────────────────────────────────────────────────────────────────
 * A par rule's announcements, as ledger rows. They are computed from the rule and the clock every
 * time they are read, which is rules.ts's own first law — so stopping a rule stops the future and
 * leaves every announcement it already made exactly where it is.
 */
export function emissionRows(cast: Cast, rules: Rule[], now: Date): IncomingEvent[] {
  return rules
    .filter((r) => r.sector === cast.sector)
    .flatMap((rule) =>
      emissions(rule, now).map<IncomingEvent>((e) => ({
        id: e.id,
        kind: 'rule',
        sector: rule.sector,
        product: e.product,
        at: e.at,
        effect: 'level',
        qty: e.level,
        unit: e.unit,
        ruleAt: e.replenishAt,
      })),
    );
}

/* ── THE LEDGER ───────────────────────────────────────────────────────────────────────────── */

const byTime = (a: IncomingEvent, b: IncomingEvent): number => a.at.getTime() - b.at.getTime();

/** Everything that happened, oldest first: what arrived, what a person declared, what the rules
 *  announced. ONE list, so the log and the card can never tell two different stories.
 *
 *  `codes` is laid over the arrivals rather than written into them, because the landing that came
 *  in without a code HAPPENED that way and the ledger does not edit its own past. The code is a
 *  later fact about an earlier event. */
export function buildLedger(a: {
  cast: Cast;
  config: AppConfig;
  declared: Declared;
  rules: Rule[];
  now: Date;
}): IncomingEvent[] {
  const coded = (e: IncomingEvent): IncomingEvent =>
    a.declared.codes[e.id] ? { ...e, lot: a.declared.codes[e.id] } : e;
  return [
    ...seedPost(a.cast, a.config, a.now).map(coded),
    ...emissionRows(a.cast, a.rules, a.now),
    ...a.declared.events.filter((e) => e.sector === a.cast.sector).map(coded),
  ].sort(byTime);
}

/** One product's rows, oldest first. */
export const rowsOf = (ledger: IncomingEvent[], product: string): IncomingEvent[] =>
  ledger.filter((e) => e.product === product);

export type Standing = {
  /** what the documents add up to */
  trail: number;
  /** what stands now, once the hands and the rules have spoken */
  standing: number;
  /** THE STANDING FIGURE IS ABOUT (§17.4). It is the fold's own arithmetic and not a flag anybody
   *  sets: a count somebody gave as «about 60» makes the level approximate, and everything added
   *  to it afterwards inherits that — you cannot add an exact 20 to an approximate 60 and get an
   *  exact 80. A later EXACT count clears it, because a count is a statement about the whole. */
  approx: boolean;
  /** a person or a rule is in front of the documents, so the trail is drawn struck through */
  overridden: boolean;
  /** the row that last moved the figure */
  last?: IncomingEvent;
  /** WHO IS SPEAKING FOR THE WORKING REALITY — the last hand or rule to say anything about the
   *  level. It is a different question from «what moved the figure last», because an albarán that
   *  lands after a stocktake moves the figure without being the one making the claim, and a row
   *  that said «Declared at 05:12» about an email arrival would be attributing a person's act to
   *  a document. */
  voice?: IncomingEvent;
};

/**
 * The two totals of one ledger.
 *
 * THE TRAIL SUMS THE ROWS THAT CARRY A DOCUMENT — an email with its albarán, a photograph of one,
 * a hand entry with the picture attached. THE STANDING FIGURE folds every row in time order: an
 * arrival adds, a stocktake and a rule emission SET, and a variance moves nothing because the
 * count it explains already did. That last one is the only subtle line in this file, so it is
 * stated here rather than left to be inferred: a variance is a row of words about a movement, not
 * a second movement.
 */
export function fold(rows: IncomingEvent[]): Standing {
  let trail = 0;
  let standing = 0;
  let approx = false;
  let last: IncomingEvent | undefined;
  let voice: IncomingEvent | undefined;
  for (const row of rows) {
    if (row.effect === 'delta') {
      standing += row.qty;
      /* AN APPROXIMATE PART MAKES AN APPROXIMATE WHOLE (§17.4). «About 60» plus 20 is about 80,
         and writing 80 there would be the app inventing a precision the house never claimed. */
      if (row.approx) approx = true;
      if (row.file) trail += row.qty;
      last = row;
    } else if (row.effect === 'level') {
      standing = row.qty;
      /* A LEVEL IS A STATEMENT ABOUT THE WHOLE, so it decides the whole: an exact count clears
         the doubt everything before it carried, and an approximate one replaces it. */
      approx = Boolean(row.approx);
      last = row;
    }
    if (row.kind === 'rule' || row.kind === 'added' || row.kind === 'counted') voice = row;
  }
  return { trail, standing, approx, overridden: standing !== trail, last, voice };
}

/** Evidence-only stock balance. A daily rule is a planning estimate, never a receipt/count.
 * Keep the same event authority; do not create a second writable stock ledger. */
export function recordedStock(rows: IncomingEvent[]): Standing {
  return fold(rows.filter((row) => row.kind !== 'rule'));
}

/* ── THE LOT BOOK (LOTS-EXPLAINED §3) ─────────────────────────────────────────────────────────
 * «Each lote is a little bank account of kilos that only goes down.» So a lote is what landed on
 * it, minus what has been drawn from it — and the recall drill reads down this list.
 */

export type Lot = {
  /** the code, synthesised where the supplier sent none */
  code: string;
  /** Batch.id where the landing is in the cast; the code otherwise */
  id: string;
  landed: number;
  drawn: number;
  /** Net attribution/reassignment; never labelled a receipt. */
  attributed: number;
  left: number;
  unit: string;
  /** the day it landed, as the trade writes it */
  day: string;
  supplier?: string;
  /** the arrival that created it */
  arrival?: IncomingEvent;
  /** the landing was declared as «about» (§17.4), so what is left in it is about too */
  approx?: boolean;
  /** WHOSE COUNT, AND WHEN (§17.9's provenance). Present where a HAND put this lote on the floor
   *  — an arrival typed at the bay rather than one a document brought in. A lote that came off an
   *  albarán is evidenced by the albarán, and its chip is already on the row. */
  declaredAt?: Date;
};

/** The lotes of one product, oldest first — which is the order they are drawn down in. */
export function lotBook(cast: Cast, product: Product, rows: IncomingEvent[]): Lot[] {
  const entries = new Map<string, { code: string; arrival: IncomingEvent; qty: number; attributed: number; approx: boolean }>();
  const drawn = new Map<string, number>();
  for (const row of rows) {
    if (row.effect === 'delta' && row.lot) {
      const id = row.lotId ?? row.lot;
      const prior = entries.get(id);
      entries.set(id, { code: row.lot, arrival: prior?.arrival ?? row, qty: (prior?.qty ?? 0) + row.qty, attributed: prior?.attributed ?? 0, approx: !!prior?.approx || !!row.approx });
    }
    for (const allocation of row.allocations ?? []) {
      const prior = entries.get(allocation.lot);
      entries.set(allocation.lot, { code: allocation.code, arrival: prior?.arrival ?? row, qty: prior?.qty ?? 0, attributed: (prior?.attributed ?? 0) + allocation.qty, approx: !!prior?.approx });
    }
    for (const deduction of row.depletions ?? []) drawn.set(deduction.lot, (drawn.get(deduction.lot) ?? 0) + deduction.qty);
  }
  return [...entries].map(([id, { code, arrival, qty, attributed, approx }]) => {
    const batch = cast.batches.find((batch) => batch.id === id);
    const took = drawn.get(id) ?? 0;
    const production = arrival.productionDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return {
      code, id, landed: qty, drawn: took, attributed: Math.round(attributed * 100) / 100,
      left: Math.round((qty + attributed - took) * 100) / 100,
      unit: product.unit,
      day: batch?.day ?? (production ? production[3] + '.' + production[2] : arrival.at.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }).replace('/', '.')),
      supplier: arrival.supplier ?? batch?.supplier, arrival, approx,
      declaredAt: arrival.kind === 'added' || arrival.kind === 'allocated' ? arrival.at : undefined,
    };
  });
}

/**
 * FIFO, and the correction stays the person's (LOTS-EXPLAINED §3).
 *
 * A shortfall comes off the oldest open lote first — or first-expiry-first, which for fresh food is
 * the same list. The proposal is Rocoto's act; correcting it belongs to whoever actually reached
 * into the other crate. What is left over when every lote is empty stays on the last one rather
 * than vanishing, because a gap that the books cannot place is still a gap that happened.
 */
export function plan(lots: Lot[], qty: number): Depletion[] {
  let left = Math.abs(qty);
  const out: Depletion[] = [];
  for (const lot of lots) {
    if (left <= 0) break;
    if (lot.left <= 0) continue;
    const take = Math.min(lot.left, left);
    out.push({ lot: lot.id, qty: Math.round(take * 100) / 100 });
    left = Math.round((left - take) * 100) / 100;
  }
  if (left > 0 && out.length) out[out.length - 1].qty = Math.round((out[out.length - 1].qty + left) * 100) / 100;
  else if (left > 0 && lots.length) out.push({ lot: lots[lots.length - 1].id, qty: left });
  return out;
}

/* ── WHOSE TRACEABILITY IS IT, THE LOTE'S OR THE GOODS'? (§18.3 · THE-CHECKPOINT-MAP 18.3) ────
 * «Same SKU, lots differing on arrival time · cost · supplier · QUALITY · MATURITY · TRACEABILITY
 * ATTRIBUTES.» The field sets are rich and per-family and they have always hung off the PRODUCT,
 * which is the band's one real model gap: two lotes of one merluza cannot differ on zona, arte or
 * categoría, and in the trade they routinely do — that is most of what a lote IS.
 *
 * THE RESOLUTION IS ONE READING, AND IT PREFERS THE LOTE. Where a landing carries its own value
 * for a field, that value is the truth about the goods in that crate; where it does not, the
 * product's standing value stands, which is what makes this additive rather than a migration.
 * Every surface that prints a trace field — the lot book's record, the supplier's sheet, the
 * albarán — reads THROUGH here, so a lote can never say one thing on paper and another on screen.
 *
 * `Batch.trace` is P0's field. It is read defensively for the same reason `codeOf` is in the
 * catalogue: the seam is written once, and the day the field lands on the type nothing else moves.
 */

/** One lote's own traceability, where it has any. */
export const traceOfBatch = (batch: unknown): Record<string, string> | undefined => {
  const held = (batch as { trace?: unknown } | null | undefined)?.trace;
  return held && typeof held === 'object' ? (held as Record<string, string>) : undefined;
};

/** WHAT THIS FIELD SAYS FOR THESE GOODS IN THIS CRATE. The lote's own answer where it has one,
 *  the product's where it does not. */
export function traceField(
  batch: unknown,
  product: Product,
  label: string,
): string | undefined {
  const own = traceOfBatch(batch)?.[label];
  return own !== undefined && own !== '' ? own : product.trace[label];
}

/** Does this lote hold a value of its own for this field? The lot book's record says so, because
 *  «this crate's zona, not the product's» is the fact the whole model gap was about. */
export const tracedOnLot = (batch: unknown, label: string): boolean => {
  const own = traceOfBatch(batch)?.[label];
  return own !== undefined && own !== '';
};

/* ── WHAT THE SUPPLIER'S MAIL SAID, READ (FEED-IA §101.1) ─────────────────────────────────────
 * «The whole analysis of the supplier emails to see which ones are right — all of that should
 * actually work.»
 *
 * THE MAIL SLICE OF THIS LEDGER IS ALREADY A LIST (inbox.tsx). What it was missing is the thing
 * the sentence above asks for: a READING of each message — which of them agree with what the house
 * already holds, and which of them say something the catalogue row does not. A mailbox tells you a
 * message arrived. This tells you whether it MATTERS.
 *
 * ═══ IT IS THE FLAGS' LANGUAGE, NOT A SCORE ═════════════════════════════════════════════════
 * Every finding is a sentence a person could say out loud, carrying the two values it is about:
 * «Rape · zona: Porcupine on the sheet, Gran Sol on your row». There is no field here that can
 * hold a percentage, for the same reason `knows.ts` has none — a bare confidence is the thing this
 * product replaces.
 *
 * ═══ WHAT IS COMPARED, AND WHAT IS NOT ══════════════════════════════════════════════════════
 * THE SHEET'S OWN FIELDS AGAINST THE CATALOGUE ROW'S. A landing carries its ground, its gear and
 * its boat (`Batch.trace`, §18.3), and the product row carries the house's standing answer for the
 * same labels. Where they differ, THE CRATE IS RIGHT — that is the resolution `traceField` already
 * keeps — so the finding is not an error report: it is the list of facts this message TAUGHT, and
 * a person reads it to know which mail to open.
 *
 * ⚠ ONLY THE LABELS THE SHEET ITSELF CARRIES ARE COMPARED. The product row also holds a `lote`,
 * and a landing's lote is the landing, not a disagreement with anything — walking the ROW's labels
 * instead of the SHEET's would have printed «lote: L-2217 on the sheet, L-2208 on your row» about
 * every crate this house has ever bought, which is a screen full of noise dressed as analysis.
 *
 * AND THE COST AGAINST THE LAST LANDING OF THE SAME GOODS. What a house wants off an albarán is
 * whether the price moved, and the only honest comparison the ledger holds is the previous crate
 * of that product. Where there is no previous crate there is no claim, and the reading is silent
 * rather than inventing a baseline — a gap ships as a gap (`insights.ts`'s own law).
 */

export type MailFindingKind =
  /** the sheet came with no lote code on it — the ordinary case LOTS-EXPLAINED §2 answers */
  | 'no-lot'
  /** the sheet says something about these goods that the catalogue row says differently */
  | 'differs'
  /** the cost moved against the last crate of the same goods */
  | 'cost';

/** One thing worth knowing about one message, in the words the surface prints. */
export type MailFinding = {
  kind: MailFindingKind;
  /** Product.id it is about */
  product: string;
  /** the field it is about, where it is about one — «zona», «buque» */
  label?: string;
  /** the whole sentence, ready to draw. It names the goods, the field and both values. */
  says: string;
};

export type MailReading = {
  /** WHICH PAPER THIS MESSAGE CARRIED (§119.3) — the kind decides what the reading can say. */
  paper: PaperKind;
  /** what a credit note credits, where the message is one: the goods, how much of them, and what
   *  it comes to. A message carrying an albarán has none. */
  credited?: { product: string; qty: number; unit: string; amount: number; lot?: string };
  /** how many arrivals the sheet was read into */
  arrivals: number;
  /** the lotes it put on the floor, in the order they landed */
  lotes: string[];
  /** what it says that the house did not already hold. Empty is the good answer, and it has its
   *  own words on the surface — «the sheet says what your rows say». */
  findings: MailFinding[];
  /** §63's method line: what was read, against what. It ships UNDER the findings. */
  method: string;
};

/** THE COST THE LAST CRATE OF THESE GOODS CAME IN AT — the only baseline the ledger holds. */
function priorCost(cast: Cast, batch: { id: string; product: string; day: string; cost: number }): number | null {
  const earlier = cast.batches
    .filter((b) => b.product === batch.product && b.id !== batch.id && b.day <= batch.day)
    .sort((a, b) => a.day.localeCompare(b.day));
  const last = earlier[earlier.length - 1];
  return last ? last.cost : null;
}

const money = (n: number, unit: string): string =>
  solesRate(n, unit);

/**
 * ONE MESSAGE, READ.
 *
 * It takes the ledger rows that message produced rather than the inbox's own object, so this file
 * stays where it is in the import graph: `inbox.tsx` reads `incoming.ts`, never the other way
 * round, and the reading a surface draws is folded by the organ that owns the ledger.
 */
export function readMail(cast: Cast, events: IncomingEvent[]): MailReading {
  /* ── A CREDIT NOTE IS READ AS A CREDIT NOTE (§119.3) ────────────────────────────────────────
     It carries no arrival, so the albarán reader would have had nothing to say about it and the
     surface would have fallen back on «filed with the papers» — which is what a message nobody
     read looks like. An abono's content IS its reading: which goods, how much of them, and what
     the supplier is putting back. */
  const abono = events.find((e) => e.paper === 'abono');
  if (abono) {
    const product = productOf(cast, abono.product);
    return {
      paper: 'abono',
      credited: {
        product: abono.product,
        qty: abono.qty,
        unit: abono.unit,
        amount: abono.credit ?? 0,
        lot: abono.lot,
      },
      arrivals: 0,
      lotes: abono.lot ? [abono.lot] : [],
      findings: [],
      method: `Read off the abono this message carried, against the ${product.name} it credits and the landing it came off.`,
    };
  }
  const arrivals = events.filter((e) => e.effect === 'delta');
  const findings: MailFinding[] = [];
  for (const arrival of arrivals) {
    const product = productOf(cast, arrival.product);
    if (!arrival.lot) {
      findings.push({
        kind: 'no-lot',
        product: arrival.product,
        says: `${product.name} · the sheet leaves the lote blank`,
      });
      continue;
    }
    const batch = cast.batches.find((b) => b.id === arrival.lot);
    if (!batch) continue;
    const sheet = traceOfBatch(batch) ?? {};
    for (const label of Object.keys(sheet)) {
      const said = sheet[label];
      const held = product.trace[label];
      if (!said || !held || said === held) continue;
      findings.push({
        kind: 'differs',
        product: arrival.product,
        label,
        says: `${product.name} · ${label}: ${said} on the sheet, ${held} on your row`,
      });
    }
    const before = priorCost(cast, batch);
    if (before !== null && before !== batch.cost) {
      findings.push({
        kind: 'cost',
        product: arrival.product,
        says: `${product.name} · ${money(batch.cost, product.unit)}, ${money(before, product.unit)} last landing`,
      });
    }
  }
  return {
    paper: 'albaran',
    arrivals: arrivals.length,
    lotes: arrivals.map((a) => a.lot).filter((l): l is string => Boolean(l)),
    findings,
    method: 'Read off the delivery note this message carried, against your catalogue row and the last landing of the same goods.',
  };
}

/* ── A SUPPLY PROBLEM, DERIVED (FEED-IA §101.2) ────────────────────────────────────────────────
 * «A supply-chain issue detected at runtime → tell the AFFECTED customers.»
 *
 * DETECTED means DERIVED, and this file already holds both halves of the subtraction: what the
 * ledger says is on the floor (`fold`), and — handed in by the caller — what the book has promised
 * of it. A morning count that comes in under the day's orders IS the supply problem, and nothing
 * has to be flagged, stored or announced for it to be true.
 *
 * WHY THE COMMITTED FIGURE ARRIVES AS AN ARGUMENT. It is folded out of the sale ledger, which this
 * file must not import: `incoming.ts` is read BY the surfaces that hold both ledgers, and reaching
 * the other way would tie the stock organ to the day. So the fold stays pure — hand it the two
 * numbers and it answers the same way every time.
 *
 * AND THE GAP INHERITS THE COUNT'S OWN STANDING (§17.4). A house that said «about 60» is short by
 * about something; the tilde travels, exactly as it does on the card.
 */

export type SupplyIssue = {
  /** Product.id */
  product: string;
  unit: string;
  /** what the ledger stands at */
  standing: number;
  /** what the orders on the book ask of it */
  committed: number;
  /** the amount the book is over the floor by — always above zero, or there is no issue */
  short: number;
  /** the floor is empty: this is «the product is gone», not «the lote is short» */
  gone: boolean;
  /** the standing figure is an about, so the gap is (§17.4) */
  approx: boolean;
  method: string;
};

/**
 * One product's issue, or nothing.
 *
 * ⚠ IT IS CLAIMED ONLY ABOUT A FLOOR SOMEBODY HAS SPOKEN FOR, and that guard is the whole
 * honesty of this fold. `fold` already answers the question — `voice` is «the last hand or rule to
 * say anything about the level» — and without it the subtraction is not a claim this app may make:
 * the arrivals say what the PAPERS brought in and nothing in this build takes goods off the floor
 * when they are sold, so «standing» against «committed» on an untouched product is one seed's
 * quantities subtracted from another seed's, forever. Run without the guard it reported the fish
 * house 1.567 kg short of rape on an ordinary morning and offered to tell 185 conversations. The
 * numbers were arithmetically correct and the claim was false, which is the exact shape of the
 * error `insights.ts`'s reconciliation law exists to forbid.
 *
 * SO A SUPPLY PROBLEM IS SOMETHING THAT HAPPENED — «detected at runtime» (§101.2), which is what
 * a count coming in under the book IS. Somebody counted, or a rule announced a level, and what
 * they said leaves the day short. Nobody has spoken, no issue: the app says nothing rather than
 * saying something it cannot stand behind.
 */
export function issueOf(a: {
  product: string;
  unit: string;
  rows: IncomingEvent[];
  committed: number;
}): SupplyIssue | null {
  const standing = fold(a.rows);
  if (!standing.voice) return null;
  const short = Math.round((a.committed - standing.standing) * 100) / 100;
  if (short <= 0) return null;
  return {
    product: a.product,
    unit: a.unit,
    standing: standing.standing,
    committed: a.committed,
    short,
    gone: standing.standing <= 0,
    approx: standing.approx,
    method: `What ${standing.voice.kind === 'rule' ? 'the rule announced' : 'the house counted'} for these goods, against every line on the book that has yet to leave the house.`,
  };
}

/** Every product the book is over the floor on, worst first — the order a person acts in. */
export function issuesOf(a: {
  cast: Cast;
  ledger: IncomingEvent[];
  /** Product.id → the amount the book has promised */
  committed: Map<string, number>;
}): SupplyIssue[] {
  const out: SupplyIssue[] = [];
  for (const [product, committed] of a.committed) {
    const row = a.cast.products.find((p) => p.id === product);
    if (!row) continue;
    const issue = issueOf({ product, unit: row.unit, rows: rowsOf(a.ledger, product), committed });
    if (issue) out.push(issue);
  }
  return out.sort((x, y) => y.short - x.short);
}

/* ── WHAT IS COMING (§17.7 · THE-CHECKPOINT-MAP 17.7) ──────────────────────────────────────────
 * «Expected inbound» is one of §17's distinctions, and the app already derives one: a par rule is
 * a standing promise that a level arrives at an hour, so tomorrow's announcement is knowable now.
 * It is DERIVED exactly as every other emission is (rules.ts's first law) — nothing is stored,
 * nothing is scheduled, and stopping the rule stops the row in the same breath.
 *
 * IT IS NOT STOCK. The row states what the ledger will say, at what hour, and it is drawn quiet
 * and above the floor's own figure so nobody reads it as goods they have.
 */

export type Expected = {
  /** Product.id */
  product: string;
  /** the level the rule will announce */
  level: number;
  unit: string;
  /** the day it lands, `YYYY-MM-DD` */
  day: string;
  at: Date;
  /** «05:00» — the rule's own hour */
  replenishAt: string;
};

/** The next announcement a live rule owes this product, or null where nothing is standing. */
export function expectedOf(rules: Rule[], product: string, now: Date): Expected | null {
  const rule = rules.find((r) => r.product === product && isLive(r, now));
  if (!rule) return null;
  const tomorrow = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (rule.until && rule.until < tomorrow) return null;
  return {
    product,
    level: rule.level,
    unit: rule.unit,
    day: tomorrow,
    at: instantOf(tomorrow, rule.replenishAt),
    replenishAt: rule.replenishAt,
  };
}

/* ── THE SYNTHESISED CODE (LOTS-EXPLAINED §2) ─────────────────────────────────────────────────
 * FEDEPESCA and ADEPESCA publish `L + iniciales + fecha`, and the sector's own guides teach it as
 * the answer to the 5:30 stall that hands over fish with no usable code. The initials come off the
 * supplier the cast holds and the date off the day it landed, so nothing here is invented — a
 * synthesised, documented, consistent code is what the trade does and what an inspector accepts.
 * Read that twice: the law prefers an invented code to a missing one.
 */
export function synthLot(cast: Cast, product: Product, at: Date): string {
  const batch = cast.batches.find((b) => b.product === product.id);
  const supplier = supplierOf(cast, batch ? batch.supplier : cast.suppliers[0].id);
  const initials = supplier.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const stamp = `${String(at.getDate()).padStart(2, '0')}${String(at.getMonth() + 1).padStart(2, '0')}`;
  return `L-${initials}${stamp}`;
}

/* ── THE ACTS ─────────────────────────────────────────────────────────────────────────────────
 * What the announcement moment writes. Both verbs take the ledger they are acting on, because a
 * stocktake is a statement ABOUT a figure and has to know what that figure was.
 */

const nextId = (): string => `stock-${crypto.randomUUID()}`;

/** «I'm telling you how much we just added» — an arrival, typed, with its lote and its picture. */
export function addition(a: {
  sector: SectorId;
  product: string;
  qty: number;
  unit: string;
  lot?: string;
  lotId?: string;
  file?: IncomingFile;
  at: Date;
  productionDate?: string;
  /** «we just added about 20» — the claim as it was made (§17.4) */
  approx?: boolean;
}): IncomingEvent {
  return {
    id: nextId(),
    kind: 'added',
    sector: a.sector,
    product: a.product,
    at: a.at,
    productionDate: /^\d{4}-\d{2}-\d{2}$/.test(a.productionDate ?? '') ? a.productionDate : undefined,
    effect: 'delta',
    qty: a.qty,
    unit: a.unit,
    lot: a.lot && a.lot.trim() ? a.lot.trim() : undefined,
    lotId: a.lotId,
    file: a.file,
    approx: a.approx || undefined,
  };
}

/** Append a reviewed change of lot attribution. Quantity is always zero because no goods arrived.
 * The before/after change is retained per stable lot ID; receipts/counts remain untouched. */
export function allocateLots(a: {
  sector: SectorId; product: string; unit: string; at: Date;
  origin: 'count' | 'review'; allocations: Array<{ lot: string; code: string; qty: number }>;
}): IncomingEvent[] {
  const allocations = a.allocations.filter((item) => Math.abs(item.qty) > 0.000001);
  if (!allocations.length) return [];
  return [{ id: nextId(), kind: 'allocated', sector: a.sector, product: a.product, at: new Date(a.at.getTime() + 2), effect: 'record', qty: 0, unit: a.unit, allocationOrigin: a.origin, allocations }];
}

/**
 * «I'm telling you how much we have now» — the stocktake, and the variance it files.
 *
 * TWO ROWS, ONE ACT. The count is what stands. The variance is the gap, named, with the lotes it
 * came off — and it exists because the override does not FIGHT the paper trail, it FILES ITSELF IN
 * the paper trail. Where the declaration matches the ledger there is no gap and no second row.
 */
export function stocktake(a: {
  sector: SectorId;
  product: string;
  level: number;
  unit: string;
  standing: number;
  lots: Lot[];
  /** Optional reviewed lot deductions. An empty list leaves the variance unassigned. */
  depletions?: Depletion[];
  at: Date;
  /** «we have about 60 boxes» — the count as it was given (§17.4) */
  approx?: boolean;
}): IncomingEvent[] {
  const delta = Math.round((a.level - a.standing) * 100) / 100;
  const count: IncomingEvent = {
    id: nextId(),
    kind: 'counted',
    sector: a.sector,
    product: a.product,
    at: a.at,
    effect: 'level',
    qty: a.level,
    unit: a.unit,
    from: a.standing,
    approx: a.approx || undefined,
  };
  if (delta === 0) return [count];
  return [
    count,
    {
      id: nextId(),
      kind: 'variance',
      sector: a.sector,
      product: a.product,
      /* one millisecond later, so the trail's order is the order the two rows were written in */
      at: new Date(a.at.getTime() + 1),
      effect: 'record',
      qty: delta,
      unit: a.unit,
      from: a.standing,
      /* A GAP MEASURED AGAINST AN ABOUT IS ITSELF AN ABOUT. The variance is the arithmetic of the
         count, so it inherits the count's own standing rather than claiming a sharper one. */
      approx: a.approx || undefined,
      depletions: delta < 0 ? (a.depletions ?? plan(a.lots, delta)) : undefined,
    },
  ];
}

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────────
 * What a person has declared, in one place, so the card and the log read one history. It is a
 * store rather than a context for the reason day.ts gives: an area package lands files, it does
 * not wrap the app. The sector switch is a different house, so its declarations are its own.
 */

export type Declared = {
  sector: SectorId;
  events: IncomingEvent[];
  /** the codes given to landings that arrived without one, by the event they belong to */
  codes: Record<string, string>;
};

const PRISTINE: Partial<Record<SectorId, Declared>> = {};

const pristine = (sector: SectorId): Declared => {
  const held = PRISTINE[sector];
  if (held) return held;
  let made: Declared = { sector, events: [], codes: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(`rocoto-stock-declared-v1:${sector}`) || 'null');
    if (raw?.sector === sector && Array.isArray(raw.events)) made = { sector, codes: raw.codes ?? {}, events: raw.events.filter((e: IncomingEvent) => e.sector === sector).map((e: IncomingEvent) => ({ ...e, at: new Date(e.at) })).filter((e: IncomingEvent) => Number.isFinite(e.at.getTime())) };
  } catch { /* An unreadable browser record cannot invent stock. */ }
  PRISTINE[sector] = made;
  return made;
};

let DECLARED: Declared = pristine('fish');
const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const snapshot = (): Declared => DECLARED;

const publish = (next: Declared): void => {
  localStorage.setItem(`rocoto-stock-declared-v1:${next.sector}`, JSON.stringify(next));
  PRISTINE[next.sector] = next;
  DECLARED = next;
  for (const fn of listeners) fn();
};

/** Revision token for a local editor. Production replaces this with the stream revision. */
export function stockRevision(sector: SectorId): string {
  return localStorage.getItem(`rocoto-stock-declared-v1:${sector}`) ?? '';
}

if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (!event.key?.startsWith('rocoto-stock-declared-v1:')) return;
  const sector = event.key.slice('rocoto-stock-declared-v1:'.length) as SectorId;
  delete PRISTINE[sector];
  const next = pristine(sector);
  if (DECLARED.sector === sector) DECLARED = next;
  for (const listener of listeners) listener();
});

/** Append. The ledger only grows: there is no verb here that edits a quantity or removes a row,
 *  and that absence is the whole doctrine of the file. */
export function announce(events: IncomingEvent[]): void {
  if (!events.length) return;
  const sector = events[0].sector;
  if (events.some((event) => event.sector !== sector)) throw new Error('A stock change stays inside one catalogue.');
  const held = sector === DECLARED.sector ? DECLARED : pristine(sector);
  const ids = new Set(held.events.map((event) => event.id));
  const additions = events.filter((event) => !ids.has(event.id));
  if (additions.length) publish({ ...held, events: [...held.events, ...additions] });
}

/** Give a landing that arrived without one a code — the trade's own published convention, in a
 *  tap (LOTS-EXPLAINED §2). It is a later fact ABOUT an arrival, so it is kept beside the ledger
 *  and laid over it at read time; the arrival itself still says it came in without a code. */
export function codeIt(eventId: string, code: string): void {
  publish({ ...DECLARED, codes: { ...DECLARED.codes, [eventId]: code } });
}

/** What this house has declared. */
export function useDeclared(sector: SectorId): Declared {
  const state = React.useSyncExternalStore(subscribe, snapshot);
  React.useEffect(() => {
    if (DECLARED.sector !== sector) publish(pristine(sector));
  }, [sector]);
  return state.sector === sector ? state : pristine(sector);
}
