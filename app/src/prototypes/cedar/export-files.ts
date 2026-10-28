/* THE ROUND TRIP OUT, ACTUALLY MADE (FEED-IA §122 · §24.2).
 *
 * «Take it all with you» carried six rows, each with an Export button, and NOT ONE OF THEM HAD AN
 * `onClick`. Six controls that named a file and produced nothing — the sharpest form of §122's
 * third disease, because a dead VALUE only fails to answer while a dead BUTTON makes a promise and
 * breaks it. And it broke the region's own reason for existing: «gave → learned → shows → take
 * back is ONE loop, and the last leg is what makes the first honest.»
 *
 * ═══ WHY A FILE AND NOT A DOOR ══════════════════════════════════════════════════════════════
 * §122 says a dead control «either edits in place or opens its one obvious surface». The obvious
 * surface for a button that says EXPORT is the FILE — there is no screen it could open that would
 * be a better answer than the thing on their disk. The export CENTRE is a different object: it is
 * «Today's albaranes, out of the house» (`shell/printing.tsx`), the day's paper and its
 * destinations, and sending «Your customers · every account, with what each takes and when» there
 * would be a door onto a surface that does not do that job — which is a worse failure than the
 * dead button, because it wastes a press AND teaches the wrong map of the app.
 *
 * ═══ CSV, AND WHY ═══════════════════════════════════════════════════════════════════════════
 * A house takes its book to its gestoría, its ERP or a spreadsheet. All three read CSV and none of
 * them reads ours. `﻿` leads the file because Excel in Spain opens UTF-8 as Latin-1 without
 * it and turns «Peix Vilalta» into «Peix Vilalta» on the customer's own screen; `\r\n` ends the
 * lines for the same reader.
 *
 * ═══ NOTHING IS INVENTED ════════════════════════════════════════════════════════════════════
 * Every column below is read off a fold this app already draws on a screen — `buildSales`, the
 * cast, the tarifa log, the threads, the lot book. A takeout that carried a figure no surface
 * shows would be a second arithmetic, which is the one thing §0 forbids.
 */
import type { Cast, Product } from '../../scenarios/data/cast';
import type { Sale } from './sale';
import type { Thread } from './shell/threads';
import { countryCurrency, syntheticAmountForCountry } from './currency';
import { CSV_BOM } from './output-files';
import { workspaceCapabilitiesNow, type WorkspaceCountry } from './workspace-capabilities';

/** THE SIX SOURCES §24.2 NAMES. The id is the row's id on the seat, so the button and the file
 *  cannot drift apart. */
export type ExportId =
  | 'customers' | 'orders' | 'transcripts' | 'catalogue' | 'prices' | 'incoming';

/** WHAT THE SEAT HANDS IN. The file builds nothing of its own: every fold is already folded once
 *  on the surface that draws it, and a takeout that re-folded would be the second arithmetic. */
export type ExportBundle = {
  cast: Cast;
  sales: Sale[];
  threads: Thread[];
  /** the tarifa bands, so a price row can say which band it is a price ON */
  tiers: Array<{ id: string; name: string }>;
  /** what a product costs on a band today — the app's own reader, handed in rather than imported,
   *  so this module never becomes a second pricing opinion */
  priceOn: (product: Product, tier: string) => number;
  tierNameOf: (id: string) => string;
  today: string;
};

export type Sheet = { name: string; head: string[]; rows: Array<Array<string | number>> };

/** A downloaded file is deliberately a smaller promise than an integration. */
export type OrderFileProfile = {
  id: 'rocoto-csv';
  name: 'Rocoto CSV';
  description: 'One row per order line. For a spreadsheet or a mapped importer.';
  acceptedBy?: never;
};

export const ORDER_FILE_PROFILES: readonly OrderFileProfile[] = [{
  id: 'rocoto-csv',
  name: 'Rocoto CSV',
  description: 'One row per order line. For a spreadsheet or a mapped importer.',
}];

/* ── ONE CELL ─────────────────────────────────────────────────────────────────────────────────
 * A quote, a comma, a semicolon or a newline inside a value is what turns a takeout into a file
 * whose columns have silently shifted by one — the failure nobody notices until an invoice is
 * wrong. RFC 4180's own answer: wrap and double the quotes.
 */
const cell = (v: string | number | undefined | null): string => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const csvOf = (sheet: Sheet): string =>
  [sheet.head, ...sheet.rows].map((r) => r.map(cell).join(',')).join('\r\n');

/** A NUMBER THE TRADE WRITES. `es-ES` uses a comma for the decimal, and a comma is this file's own
 *  separator — so figures are written PLAIN, with a dot, which is what every spreadsheet and every
 *  ERP importer reads back as a number rather than as text. */
const num = (n: number, dp = 2): string => (Number.isFinite(n) ? n.toFixed(dp) : '');

/* ── THE SIX SHEETS ───────────────────────────────────────────────────────────────────────────
 * Each one is the object as the app holds it, one row per thing, with the columns a person would
 * open the file to read. Where a fact is ABSENT the cell is empty rather than a dash: a dash is a
 * word, and a word in a number column is what breaks an import.
 */
export function sheetOf(id: ExportId, b: ExportBundle): Sheet {
  const country = workspaceCapabilitiesNow(b.cast.sector).country;
  const currency = countryCurrency(country);
  switch (id) {
    case 'customers':
      return {
        name: 'customers',
        head: ['id', 'name', 'channel', 'tarifa', 'comercial', 'zone', 'truck', 'asked for', 'settles', 'their system'],
        rows: b.cast.customers.map((c) => [
          c.id, c.name, c.channel, b.tierNameOf(c.tier),
          c.comercial ? (b.cast.comerciales.find((m) => m.id === c.comercial)?.name ?? c.comercial) : '',
          c.zone ?? '', c.truck ?? '', c.slot ?? '', c.settles, c.erp?.name ?? '',
        ]),
      };

    case 'orders':
      /* ONE ROW PER LINE, not per document. A house reconciling with its gestoría is adding up
         LINES, and a file of documents with «5 lines» in a cell is a file they would have to open
         the app to use. The document's own facts repeat down its lines, which is what every ERP
         export in this trade already looks like. */
      return {
        name: 'orders-and-albaranes',
        /* ⚠ NO `class` COLUMN (FEED-IA §197.2 «Remove class everywhere», §193.4). The product
           column carries what the market sells by; `lote` carries when the goods came in. */
        head: ['albarán', 'day', 'hour', 'customer', 'state', 'product', 'lote', 'ordered', 'given', 'unit', 'price', 'line total', 'currency'],
        rows: b.sales.flatMap((s) => s.lines.map((l) => [
          s.number, s.deliveryDay, s.at, s.customer.name, s.state,
          l.product.name, l.lot ?? '',
          num(l.ordered, 3), num(l.given, 3), l.unit, num(syntheticAmountForCountry(l.price, country)), num(syntheticAmountForCountry(l.given * l.price, country)), currency,
        ])),
      };

    case 'transcripts':
      /* WHAT WAS SAID, IN ORDER, WITH WHO SAID IT. A voice note's words are the ones the surface
         already shows — the transcript IS the message on this app (§46.2) — so nothing here is a
         second reading of a recording. */
      return {
        name: 'conversations',
        head: ['customer', 'channel', 'hour', 'who', 'said'],
        rows: b.threads.flatMap((t) => t.rows.map((r) => [
          t.customer.name, t.customer.channel, r.time ?? '',
          r.author === 'received' ? t.customer.name : r.author === 'ai' ? 'Rocoto' : 'You',
          r.text,
        ])),
      };

    case 'catalogue':
      return {
        name: 'catalogue',
        head: ['id', 'code', 'name', 'family', 'unit', 'pack', 'units per pack', 'variable weight'],
        rows: b.cast.products.map((p) => [
          p.id, p.code ?? '', p.name,
          b.cast.families.find((f) => f.id === p.family)?.name ?? p.family,
          p.unit, p.pack?.unit ?? '', p.pack ? num(p.pack.factor, 3) : '',
          p.variableWeight ? 'yes' : 'no',
        ]),
      };

    case 'prices':
      /* TODAY'S SHEET, WHOLE — every product on every band, which is the thing a house actually
         hands somebody. The DAY is a column rather than a filename, so two takeouts a week apart
         concatenate into the series §24.2 asks for. */
      return {
        name: 'prices',
        head: ['day', 'product', 'tarifa', 'price', 'unit', 'currency'],
        rows: b.cast.products.flatMap((p) =>
          b.tiers.map((t) => [b.today, p.name, t.name, num(syntheticAmountForCountry(b.priceOn(p, t.id), country)), p.unit, currency])),
      };

    case 'incoming':
      /* THE LANDINGS, OFF THE CAST'S OWN BATCH RECORD — «every lote that landed, with its cost
         and day», which is exactly what a `Batch` is. The LIVE floor level is a different object
         (`incoming.ts`'s fold, built on Stock with the house's declared counts and standing
         rules), and reaching for it here would put a second copy of that arithmetic on a seat
         that does not draw it. What landed is a fact; what is left is a reading. */
      return {
        name: 'goods-in',
        head: ['lote', 'day', 'product', 'supplier', 'landed', 'unit', 'cost', 'cost unit', 'currency'],
        rows: b.cast.batches.map((t) => {
          const p = b.cast.products.find((x) => x.id === t.product);
          return [
            t.id, t.day, p?.name ?? t.product,
            b.cast.suppliers.find((x) => x.id === t.supplier)?.name ?? t.supplier,
            num(t.qty, 3), p?.unit ?? '', num(syntheticAmountForCountry(t.cost, country)), p?.unit ?? '', currency,
          ];
        }),
      };
  }
}

/** Generic CSV only. It must not claim that a named ERP imported it. */
export function orderFileOf(sales: Sale[], country: WorkspaceCountry = workspaceCapabilitiesNow().country): Sheet {
  return {
    name: 'orders-and-albaranes',
    /* ⚠ NO `class` COLUMN (FEED-IA §197.2). Same head as the export centre's own — one file. */
    head: ['albarán', 'day', 'hour', 'customer', 'state', 'product', 'lote', 'ordered', 'given', 'unit', 'price', 'line total'],
    rows: sales.flatMap((s) => s.lines.map((l) => [
      s.number, s.deliveryDay, s.at, s.customer.name, s.state,
      l.product.name, l.lot ?? '',
      num(l.ordered, 3), num(l.given, 3), l.unit, num(syntheticAmountForCountry(l.price, country)), num(syntheticAmountForCountry(l.given * l.price, country)),
    ])),
  };
}

export function downloadOrderFile(sales: Sale[], house: string, day: string): number {
  const sheet = orderFileOf(sales);
  saveCsv(fileNameOf(sheet, house, day), csvOf(sheet));
  return sheet.rows.length;
}

/** THE FILE'S OWN NAME — the house and the day, so two takeouts in a downloads folder are two
 *  files a person can tell apart without opening either. */
export const fileNameOf = (sheet: Sheet, house: string, day: string): string =>
  `rocoto-${house.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${sheet.name}-${day}.csv`;

/** PUT IT ON THEIR DISK, AND SAY WHAT WENT ON IT. The same helper `activation-web.tsx` uses for
 *  its year sheet — one way of saving a file in this app, not two.
 *
 *  IT RETURNS THE BYTES. «It's not calculating the right download size» (Peter, 2026-09-10): this
 *  function held the only object that knows the answer — the `Blob` — and threw it away, so every
 *  caller above it could report a row count and nothing else. `Blob.size` is the exact UTF-8
 *  length of the payload the browser writes, mark included, which is the number a person can check
 *  against their own downloads folder. */
export function saveCsv(name: string, text: string): number {
  /* THE BYTE-ORDER MARK IS NOT DECORATION. Excel on a Spanish desktop opens a UTF-8 CSV as
     Latin-1 without it, and «Peix Vilalta» reaches the customer as «Peix Vilalta» — the app
     handing back a corrupted copy of their own book. `output-files.ts` counts the same payload
     ahead of the press, so a screen can state the size before a finger touches the control. */
  const blob = new Blob([`${CSV_BOM}${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return blob.size;
}

/** THE WHOLE ACT, IN ONE CALL — so the seat's button is one line and the six rows cannot each
 *  grow their own opinion about what an export is. Returns the row count, which is what the
 *  surface says back (§76: immediate feedback after an act that leaves no visible trace). */
export function takeAway(id: ExportId, b: ExportBundle, house: string): number {
  const sheet = sheetOf(id, b);
  saveCsv(fileNameOf(sheet, house, b.today), csvOf(sheet));
  return sheet.rows.length;
}
