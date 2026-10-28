/* THE FILE A DOWNLOAD ACTUALLY WRITES, AND THE NUMBERS THAT DESCRIBE IT.
 *
 * «It's not calculating the right download size» and «the numbers dont add up. make sure its
 * actually calculating everything» (Peter, 2026-09-10). Both came from the same hole: the download
 * act built a CSV inside a React component, saved it through a helper that returned nothing, and
 * reported back a count of orders. Nobody could state the file's size because nobody held the
 * file — and a screen that says «Downloaded 5 orders» has described the button rather than the
 * artifact.
 *
 * So one function makes the whole artifact, once, and hands back everything a surface needs to
 * describe it BEFORE the press as well as after: the name, the columns, the text, the exact bytes,
 * and the deliveries, lines, quantities and money the rows carry. The screen, the notice, the
 * activity record and the file on disk are then four readings of one object.
 *
 * ═══ WHY THE BYTES ARE COUNTED HERE ═════════════════════════════════════════════════════════
 * Excel on a Spanish desktop reads a UTF-8 CSV as Latin-1 unless the payload opens with a
 * byte-order mark, so the saved payload is `﻿` + the text (`export-files.ts:saveCsv`, the
 * one place this app writes a file). The BOM is three bytes and every accented customer name is
 * two, so characters are not bytes and a size counted off `text.length` is wrong on every real
 * house. `TextEncoder` counts the payload the browser will hand to the disk; the browser then
 * cross-checks it against `Blob.size` when it saves.
 *
 * ═══ WHY THE MONEY IS CONVERTED PER DELIVERY ════════════════════════════════════════════════
 * Synthetic commerce is stored in canonical PEN and presented in the country's own currency. If
 * the file converted each line and the screen converted the sum, the column and the total would
 * disagree by a cent on a Spanish batch — which is the very complaint. So the conversion happens
 * ONCE PER DELIVERY, the file writes that number, and the batch total is the sum of exactly those
 * numbers. `totalAsCanonical` carries the same amount back in PEN so the app's single money
 * formatter (`soles`) prints it unchanged, and no second formatter exists.
 */
import { canonicalSyntheticAmount, countryCurrency, syntheticAmountForCountry, type WorkspaceCurrency } from './currency';
import { workspaceCapabilitiesNow, type WorkspaceCountry } from './workspace-capabilities';

/** What this module needs off a sale. `Sale` satisfies it structurally, so the file and the app
 *  read one record while the arithmetic stays testable without the whole commerce model. */
export type MeasuredLine = { given: number; unit: string; price: number; product: { name: string } };
export type MeasuredSale = { id: string; number?: string; customer: { name: string }; lines: MeasuredLine[] };

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** A plain number for a spreadsheet: a dot decimal, never a locale comma, because a comma is this
 *  file's own separator (`export-files.ts` keeps the same rule). */
const num = (value: number, dp = 2): string => (Number.isFinite(value) ? value.toFixed(dp) : '');

/** RFC 4180: a quote, a comma, a semicolon or a newline inside a value is wrapped and doubled. */
const cell = (value: string): string => (/[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** What one delivery is worth, in canonical PEN, from its own lines. This is the same arithmetic
 *  `figureOf` performs in `sale.ts` — given × price, rounded once at the document. */
export const deliveryFigureOf = (sale: MeasuredSale): number =>
  round2(sale.lines.reduce((sum, line) => sum + line.given * line.price, 0));

/** The same figure in the country's presentation currency — one conversion, at the document. */
export const deliveryTotalOf = (sale: MeasuredSale, country: WorkspaceCountry): number =>
  syntheticAmountForCountry(deliveryFigureOf(sale), country);

export type BatchQuantity = { unit: string; quantity: number };

export type BatchMeasures = {
  /** one per sale, which is one row in the file */
  deliveries: number;
  lines: number;
  /** goods summed per unit, in the unit each line was given in */
  quantities: BatchQuantity[];
  /** money in the country's presentation currency: the sum of the per-delivery totals */
  total: number;
  /** that same amount in canonical PEN, so `soles()` prints it back unchanged */
  totalAsCanonical: number;
  currency: WorkspaceCurrency;
};

export function batchMeasuresOf(sales: readonly MeasuredSale[], country: WorkspaceCountry): BatchMeasures {
  const quantities = new Map<string, number>();
  let lines = 0;
  let total = 0;
  for (const sale of sales) {
    lines += sale.lines.length;
    total += deliveryTotalOf(sale, country);
    for (const line of sale.lines) {
      quantities.set(line.unit, round2((quantities.get(line.unit) ?? 0) + line.given));
    }
  }
  const rounded = round2(total);
  return {
    deliveries: sales.length,
    lines,
    quantities: [...quantities.entries()]
      .map(([unit, quantity]) => ({ unit, quantity }))
      .sort((a, b) => b.quantity - a.quantity),
    total: rounded,
    totalAsCanonical: canonicalSyntheticAmount(rounded, country),
    currency: countryCurrency(country),
  };
}

/* ── THE COLUMNS ─────────────────────────────────────────────────────────────────────────── */

/** THE ROW'S OWN IDENTITY AND THE ROW'S OWN MONEY ARE NOT OPTIONS. A file of deliveries whose
 *  rows cannot be told apart — two bars of the same name, one customer twice in a batch — is a
 *  list rather than a record, and a file whose rows carry no amount cannot be added up against the
 *  screen that offered it. So the delivery number opens every file and, where the house prices its
 *  papers, the delivery's total closes it. The template owns everything between them. */
export const FILE_IDENTITY_COLUMN = 'Delivery';
export const FILE_TOTAL_COLUMN = 'Order total';
export const FILE_BODY_COLUMNS = ['Customer', 'Product', 'Quantity', 'Unit price'] as const;

/** The fields the column builder offers. Money appears where the house prices its papers. */
export const availableFileColumns = (priced: boolean): string[] =>
  priced ? [...FILE_BODY_COLUMNS] : FILE_BODY_COLUMNS.filter((column) => column !== 'Unit price');

export const fileColumnsOf = (wanted: readonly string[], priced: boolean): string[] => {
  const offered = availableFileColumns(priced);
  const body = wanted.filter((column) => offered.includes(column));
  const chosen = body.length ? body : offered.filter((column) => column !== 'Unit price');
  return [FILE_IDENTITY_COLUMN, ...chosen, ...(priced ? [FILE_TOTAL_COLUMN] : [])];
};

const columnValue = (column: string, sale: MeasuredSale, country: WorkspaceCountry): string => {
  switch (column) {
    case FILE_IDENTITY_COLUMN: return sale.number ?? sale.id;
    case 'Customer': return sale.customer.name;
    case 'Product': return sale.lines.map((line) => line.product.name).join(' · ');
    case 'Quantity': return sale.lines.map((line) => `${line.given} ${line.unit}`).join(' · ');
    case 'Unit price': return sale.lines.map((line) => num(syntheticAmountForCountry(line.price, country))).join(' · ');
    case FILE_TOTAL_COLUMN: return num(deliveryTotalOf(sale, country));
    default: return '';
  }
};

/** THE FILE'S OWN NAME: the template's stem and the day, so two downloads in one folder are two
 *  files a person tells apart without opening either. */
export const fileStemOf = (stem: string | undefined, fallback: string): string =>
  (stem || fallback || 'orders').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'orders';

export type ConfiguredFileTemplate = {
  id: string;
  name: string;
  fileName?: string;
  columns?: readonly string[];
  columnLabels?: Record<string, string>;
};

export type GeneratedFile = {
  fileName: string;
  format: 'CSV';
  /** the fields the file writes, in the file's own order */
  columns: string[];
  /** what the head row actually says — the template's own labels over those fields. The screen
   *  that offers the file prints THIS, so the description and the artifact are one object. */
  head: string[];
  /** the rows, CRLF-terminated, as `saveCsv` receives them */
  text: string;
  /** what actually reaches the disk — the byte-order mark and the text */
  payload: string;
  /** the exact UTF-8 length of that payload */
  bytes: number;
  measures: BatchMeasures;
  saleIds: string[];
};

/** The byte-order mark `saveCsv` writes ahead of every CSV. Stated once, read by both. */
export const CSV_BOM = '﻿';

const encoder = new TextEncoder();

export function configuredFileOf(input: {
  template: ConfiguredFileTemplate;
  sales: readonly MeasuredSale[];
  priced: boolean;
  day: string;
  country?: WorkspaceCountry;
}): GeneratedFile {
  const country = input.country ?? workspaceCapabilitiesNow().country;
  const columns = fileColumnsOf(input.template.columns ?? [], input.priced);
  const labels = input.template.columnLabels ?? {};
  const head = columns.map((column) => labels[column] || column);
  const text = [head, ...input.sales.map((sale) => columns.map((column) => columnValue(column, sale, country)))]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
  const payload = `${CSV_BOM}${text}`;
  return {
    fileName: `${fileStemOf(input.template.fileName, input.template.name)}-${input.day}.csv`,
    format: 'CSV',
    columns,
    head,
    text,
    payload,
    bytes: encoder.encode(payload).length,
    measures: batchMeasuresOf(input.sales, country),
    saleIds: input.sales.map((sale) => sale.id),
  };
}
