/* ── THE OUTPUT TEMPLATE (THE-OUTPUTS-SPEC OUT-01 · FEED-IA §202.5) ───────────────────────────
 *
 * «The albarán and the packing sheet are CATEGORIES of templates. Every template is editable, the
 * two that ship (an albarán, a packing sheet) included; a house can add custom ones.»
 *
 * ONE OBJECT. Until E200 the kit held two: a TEMPLATE, which was a fixed seed a person copied
 * from, and a SAVED COPY, which was the configured thing they ran. A template IS the thing people
 * run, the thing they edit, and the thing that ships. Three defects came with the old pair, and
 * this file closes all three:
 *
 *   1. The renderer obeyed a house-wide layout profile no shipped screen could change
 *      (`rocoto-print-layout-v1:<sector>`). The layout is the TEMPLATE's own now, and
 *      `printProfileOf` is what the renderer receives.
 *   2. The layout a saved copy stored never reached the paper — it was a chip and nothing else.
 *      `layoutWords` reads the SAME record the printer reads, so the chip states what prints.
 *   3. Running a saved copy rewrote the house default paper for every other print in the house.
 *      Paper and copies are the template's; `PrintSetup` narrows to the default a NEW template
 *      starts from.
 *
 * This module is PURE — no React, no JSX — so `tools/test-output-templates.mjs` can transpile it
 * in memory and hold the model to its rules without a build.
 */
import {
  PRINT_LAYOUT_DEFAULTS, clearLegacyPrintLayout, readLegacyPrintLayout,
  type AlbaranFields, type PackingColumns, type PackingSort, type PrintLayoutProfile,
} from './print-layout';

/* ── THE CATEGORIES ───────────────────────────────────────────────────────────────────────────
 * A category says what KIND of document this is: which renderer draws it and which settings it
 * offers. It is fixed at creation and a template never changes category. */
export const TEMPLATE_CATEGORIES = ['albaran', 'packing', 'day-sheet', 'file', 'email'] as const;
export type OutputCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** The paper categories: the three the browser renderer draws a sheet for. */
export const PAPER_CATEGORIES: readonly OutputCategory[] = ['albaran', 'packing', 'day-sheet'];

/** Which paper `PaperMiniature` draws for a category. `file` and `email` produce none. */
export const PAPER_KIND_OF: Partial<Record<OutputCategory, 'albaranes' | 'packing' | 'sheet'>> = {
  albaran: 'albaranes',
  packing: 'packing',
  'day-sheet': 'sheet',
};

/** The library's own headings, one per category, in the order OUT-02.3 states. */
export const CATEGORY_PLURALS: Record<OutputCategory, string> = {
  albaran: 'Delivery notes',
  packing: 'Packing lists',
  'day-sheet': 'Day sheets',
  file: 'Files',
  email: 'Email',
};

/** What a category prints, said forward, for a section a house has yet to fill. */
export const CATEGORY_NOTES: Record<OutputCategory, string> = {
  albaran: 'A delivery note template prints one note for each delivery.',
  packing: 'A packing list template prints the bay’s run sheet, grouped by truck.',
  'day-sheet': 'A day sheet template prints the driver’s round, one page per van.',
  file: 'A file template writes the day as a structured file.',
  email: 'An email template sends the day’s paper to an address you choose.',
};

export type TemplatePaper = 'A4' | 'A5';
export type TemplateCopies = 1 | 2 | 3;
/** Seat 0 is the leading button on the day, seat 1 the trailing one (OUT-03.2). */
export type TemplateSeat = 0 | 1;
export type TemplateLanguage = 'en' | 'es';
export type DaySheetStops = 'route' | 'customer';

/* ── THE LAYOUT (OUT-01.3) ────────────────────────────────────────────────────────────────────
 * The albarán and packing arms are `print-layout.ts`'s two paper members verbatim. The move is a
 * MOVE, not an invention: the same union, read from the template instead of from a sector key. */
export type TemplateLayout =
  | { kind: 'albaran'; fields: AlbaranFields }
  | { kind: 'packing'; columns: PackingColumns; groupByTruck: true; sort: PackingSort }
  | { kind: 'day-sheet'; stops: DaySheetStops }
  | { kind: 'file'; format: 'CSV'; columns: string[]; columnLabels: Record<string, string>; fileName: string }
  | { kind: 'email'; recipients: string; timing: string; timezone: string; attachments: string; reviewRule: string };

/** The shipped seed a template started from. The library's mark and the configuration form's own
 *  opening values read it; the CATEGORY is what decides the renderer and the settings. */
export type TemplateSeed =
  | 'delivery-notes' | 'packing-sheets' | 'day-sheet'
  | 'subcontractor-pack' | 'daily-accounting' | 'copilot-email' | 'csv-file';

/** Which shelf of the export centre a category answers to, in today's words. */
export type OutputKind = 'print' | 'email' | 'file';

export type OutputScope = 'Current selection' | 'All salespeople';

export type Template = {
  id: string;
  category: OutputCategory;
  seed: TemplateSeed;
  /** 1–48 characters. Shown in the library, on the day's button, and as the print job's title. */
  name: string;
  /** This template's own sheet, on the three paper categories. */
  paper?: TemplatePaper;
  copies?: TemplateCopies;
  layout: TemplateLayout;
  head: { house: boolean; logo: boolean; note: string };
  foot: { note: string; pageNumbers: boolean };
  /** Held true and read-only in the `packing` category (OUT-01.5). */
  marks: { qr: boolean; corners: boolean };
  language: TemplateLanguage;
  dayButton?: TemplateSeat;
  /** Which orders this template runs over. Carried from the saved copy the template replaces. */
  selection: { scope: OutputScope; chips: string[] };
  /** Rises by one on every saved edit (OUT-01.7). */
  revision: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  lastUsedAt?: string;
  archivedAt?: string;
  archivedBy?: string;
  paused?: boolean;
  /** Which provider delivers it. `Rocoto` for paper, `Email` and `CSV` for the other two. */
  provider?: string;
};

export const HEAD_DEFAULT = { house: true, logo: true, note: '' };
export const FOOT_DEFAULT = { note: '', pageNumbers: true };

/** The release these two shipped in. A shipped template has the app as its author, so its stamp is
 *  a constant rather than the hour a browser first opened — which is also what makes the migration
 *  idempotent: running it twice over one legacy store lands the same bytes. */
const SHIPPED_AT = '2026-09-05T00:00:00.000Z';
const SHIPPED_BY = 'Rocoto';

export const CATEGORY_OF_SEED: Record<TemplateSeed, OutputCategory> = {
  'delivery-notes': 'albaran',
  'packing-sheets': 'packing',
  'day-sheet': 'day-sheet',
  'csv-file': 'file',
  'subcontractor-pack': 'email',
  'daily-accounting': 'email',
  'copilot-email': 'email',
};

export const SEED_OF_CATEGORY: Record<OutputCategory, TemplateSeed> = {
  albaran: 'delivery-notes',
  packing: 'packing-sheets',
  'day-sheet': 'day-sheet',
  file: 'csv-file',
  email: 'subcontractor-pack',
};

export const KIND_OF_CATEGORY: Record<OutputCategory, OutputKind> = {
  albaran: 'print',
  packing: 'print',
  'day-sheet': 'print',
  file: 'file',
  email: 'email',
};

export const PROVIDER_OF_CATEGORY: Record<OutputCategory, string> = {
  albaran: 'Rocoto',
  packing: 'Rocoto',
  'day-sheet': 'Rocoto',
  file: 'CSV',
  email: 'Email',
};

/* ── THE SHIPPED LAYOUTS ──────────────────────────────────────────────────────────────────────
 * Each one is the value today's renderer already draws, quoted from the record it came from, so a
 * fresh house prints exactly the paper it printed before E200. */
export const shippedLayoutOf = (category: OutputCategory): TemplateLayout => {
  switch (category) {
    /* PRINT_LAYOUT_DEFAULTS.albaran — `print-layout.ts` */
    case 'albaran': return { kind: 'albaran', fields: { ...PRINT_LAYOUT_DEFAULTS.albaran } };
    /* PRINT_LAYOUT_DEFAULTS.packing — same record */
    case 'packing': return { kind: 'packing', columns: PRINT_LAYOUT_DEFAULTS.packing.columns, groupByTruck: true, sort: PRINT_LAYOUT_DEFAULTS.packing.sort };
    case 'day-sheet': return { kind: 'day-sheet', stops: 'route' };
    case 'file': return { kind: 'file', format: 'CSV', columns: ['Customer', 'Product', 'Quantity'], columnLabels: { Customer: 'Customer', Product: 'Product', Quantity: 'Quantity' }, fileName: 'orders' };
    default: return { kind: 'email', recipients: '', timing: 'Daily at 09:00', timezone: 'UTC', attachments: 'Delivery notes', reviewRule: 'Send directly' };
  }
};

/** Every packing template carries the capture mark, so a packing sheet can never leave the house
 *  as paper its own reader is unable to resolve (OUT-01.5 · THE-QR-SPEC). */
export const marksOf = (category: OutputCategory, chosen?: { qr: boolean; corners: boolean }): { qr: boolean; corners: boolean } =>
  category === 'packing' ? { qr: true, corners: true } : { qr: chosen?.qr === true, corners: chosen?.corners === true };

/* ── THE TWO THAT SHIP, AND THE FILE THE HOUSE ALREADY HAD ────────────────────────────────────
 * OUT-01.4 tabulates the two paper templates and every value they carry. The third row is the
 * order file `DEFAULT_SAVED_OUTPUTS` already shipped (`shell/printing.tsx`) — E200 keeps it as an
 * ordinary `file` template, because retiring a working output was never part of the ask, and it
 * keeps the id `order-file` it has always had so a house's own doors stay where they were. */
export const shippedTemplates = (): Template[] => [
  {
    id: 'albaran-default', category: 'albaran', seed: 'delivery-notes', name: 'Delivery notes',
    paper: 'A4', copies: 1, layout: shippedLayoutOf('albaran'),
    head: { ...HEAD_DEFAULT }, foot: { ...FOOT_DEFAULT }, marks: marksOf('albaran'), language: 'en',
    dayButton: 0, selection: { scope: 'Current selection', chips: ['All products'] },
    revision: 1, createdAt: SHIPPED_AT, createdBy: SHIPPED_BY, updatedAt: SHIPPED_AT, updatedBy: SHIPPED_BY,
    provider: PROVIDER_OF_CATEGORY.albaran,
  },
  {
    id: 'packing-default', category: 'packing', seed: 'packing-sheets', name: 'Packing list',
    paper: 'A4', copies: 1, layout: shippedLayoutOf('packing'),
    head: { ...HEAD_DEFAULT }, foot: { ...FOOT_DEFAULT }, marks: marksOf('packing'), language: 'en',
    dayButton: 1, selection: { scope: 'Current selection', chips: ['All products'] },
    revision: 1, createdAt: SHIPPED_AT, createdBy: SHIPPED_BY, updatedAt: SHIPPED_AT, updatedBy: SHIPPED_BY,
    provider: PROVIDER_OF_CATEGORY.packing,
  },
  {
    id: 'order-file', category: 'file', seed: 'csv-file', name: 'Order file',
    layout: shippedLayoutOf('file'),
    head: { ...HEAD_DEFAULT }, foot: { ...FOOT_DEFAULT }, marks: marksOf('file'), language: 'en',
    selection: { scope: 'Current selection', chips: ['All products'] },
    revision: 1, createdAt: SHIPPED_AT, createdBy: SHIPPED_BY, updatedAt: SHIPPED_AT, updatedBy: SHIPPED_BY,
    provider: PROVIDER_OF_CATEGORY.file,
  },
];

/* ── WHAT THE RENDERER RECEIVES ───────────────────────────────────────────────────────────────
 * `printSourceRun` freezes one `PrintLayoutProfile` into an attempt. This is where a template
 * becomes that profile: its own arm, and `PRINT_LAYOUT_DEFAULTS` for the arm it has no opinion
 * about — an albarán template says nothing about packing columns, and a packing template says
 * nothing about the albarán's fields.
 */
export const printProfileOf = (template: Pick<Template, 'layout'>): PrintLayoutProfile => ({
  version: 1,
  albaran: template.layout.kind === 'albaran' ? { ...template.layout.fields } : { ...PRINT_LAYOUT_DEFAULTS.albaran },
  packing: template.layout.kind === 'packing'
    ? { columns: template.layout.columns, groupByTruck: true, sort: template.layout.sort }
    : { ...PRINT_LAYOUT_DEFAULTS.packing },
});

const SORT_WORDS: Record<PackingSort, string> = {
  route: 'Route order',
  customer: 'Customer A–Z',
  'order-value': 'Order value',
  'lifetime-value': 'Lifetime value',
};

/** THE CHIP STATES WHAT THE PRINTER SEES. These words are read off the same record `printProfileOf`
 *  hands the renderer, so a line on a card and a line on the paper can never disagree. */
export const layoutWords = (layout: TemplateLayout): string[] => {
  switch (layout.kind) {
    case 'albaran': {
      const on = [
        layout.fields.finalWeight ? 'Final weight' : '',
        layout.fields.unitPrice ? 'Unit price' : '',
        layout.fields.lineTotal ? 'Line total' : '',
      ].filter(Boolean);
      return on.length ? on : ['Quantities'];
    }
    case 'packing':
      return [layout.columns === 2 ? '2 columns' : '1 column', 'By truck', SORT_WORDS[layout.sort]];
    case 'day-sheet':
      return [layout.stops === 'customer' ? 'Customer A–Z' : 'Route order'];
    case 'file':
      return [layout.format, `${layout.columns.length} columns`, layout.fileName].filter(Boolean);
    default:
      return [layout.recipients, layout.timing, layout.attachments, layout.reviewRule === 'Send directly' ? '' : layout.reviewRule].filter(Boolean);
  }
};

/* ── THE STORE (OUT-01.8) ─────────────────────────────────────────────────────────────────────
 * One key, one house, versioned, with the fail-soft reader the saved outputs already used. The
 * runtime takes this seam later: `readTemplates` and `writeTemplates` are the only two functions
 * any surface calls, so the day `GET /api/outputs/templates` answers, one file changes.
 */
export const TEMPLATES_KEY = 'rocoto:outputs:templates';
export const TEMPLATES_VERSION = 1;
/** The two keys that retire into the one above. Their data migrates on first read. */
export const LEGACY_SAVED_OUTPUTS_KEY = 'rocoto:export:saved-outputs';

const templatesKeyFor = (sector: string) => `${TEMPLATES_KEY}:${sector}`;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';
const isCategory = (value: unknown): value is OutputCategory => TEMPLATE_CATEGORIES.some((known) => known === value);
const isSort = (value: unknown): value is PackingSort => value === 'route' || value === 'customer' || value === 'order-value' || value === 'lifetime-value';
const words = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const flag = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const stringList = (value: unknown, fallback: string[]): string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value as string[] : fallback;
const labelMap = (value: unknown, columns: string[]): Record<string, string> => {
  if (!isRecord(value)) return Object.fromEntries(columns.map((column) => [column, column]));
  const pairs = Object.entries(value).filter(([, label]) => typeof label === 'string') as Array<[string, string]>;
  return Object.fromEntries(pairs);
};

/** A layout read back into the shape THIS build knows, one member at a time, the way
 *  `parsePrintLayout` reads a stored profile. A member this build has no renderer for is refused
 *  in favour of the category's shipped value. */
export const parseLayout = (raw: unknown, category: OutputCategory): TemplateLayout => {
  const shipped = shippedLayoutOf(category);
  if (!isRecord(raw) || raw.kind !== shipped.kind) return shipped;
  switch (shipped.kind) {
    case 'albaran': {
      const fields = isRecord(raw.fields) ? raw.fields : {};
      return { kind: 'albaran', fields: {
        finalWeight: fields.finalWeight === true,
        unitPrice: fields.unitPrice === true,
        /* Older stores predate the toggle and printed the total; the reader keeps that. */
        lineTotal: fields.lineTotal !== false,
      } };
    }
    case 'packing':
      return { kind: 'packing', columns: raw.columns === 2 ? 2 : 1, groupByTruck: true, sort: isSort(raw.sort) ? raw.sort : 'route' };
    case 'day-sheet':
      return { kind: 'day-sheet', stops: raw.stops === 'customer' ? 'customer' : 'route' };
    case 'file': {
      const columns = stringList(raw.columns, shipped.columns);
      return { kind: 'file', format: 'CSV', columns, columnLabels: labelMap(raw.columnLabels, columns), fileName: words(raw.fileName, shipped.fileName) };
    }
    default:
      return { kind: 'email',
        recipients: words(raw.recipients, shipped.recipients),
        timing: words(raw.timing, shipped.timing),
        timezone: words(raw.timezone, shipped.timezone),
        attachments: words(raw.attachments, shipped.attachments),
        reviewRule: words(raw.reviewRule, shipped.reviewRule) };
  }
};

/** One stored row read back into a template. Every field is read on its own, so a store written by
 *  an older build opens with its templates intact rather than being thrown away whole. */
export const parseTemplate = (raw: unknown): Template | null => {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id || !isCategory(raw.category)) return null;
  const category = raw.category;
  const seed = typeof raw.seed === 'string' && raw.seed in CATEGORY_OF_SEED ? raw.seed as TemplateSeed : SEED_OF_CATEGORY[category];
  const paper = raw.paper === 'A5' ? 'A5' : raw.paper === 'A4' ? 'A4' : undefined;
  const copies = raw.copies === 2 ? 2 : raw.copies === 3 ? 3 : raw.copies === 1 ? 1 : undefined;
  const head = isRecord(raw.head) ? raw.head : {};
  const foot = isRecord(raw.foot) ? raw.foot : {};
  const marks = isRecord(raw.marks) ? raw.marks : {};
  const selection = isRecord(raw.selection) ? raw.selection : {};
  const seat = raw.dayButton === 0 || raw.dayButton === 1 ? raw.dayButton : undefined;
  const stamped = words(raw.createdAt, SHIPPED_AT);
  return {
    id: raw.id,
    category,
    seed,
    name: words(raw.name, CATEGORY_PLURALS[category]).slice(0, 48) || CATEGORY_PLURALS[category],
    paper: PAPER_CATEGORIES.includes(category) ? paper ?? 'A4' : undefined,
    copies: PAPER_CATEGORIES.includes(category) ? copies ?? 1 : undefined,
    layout: parseLayout(raw.layout, category),
    head: { house: flag(head.house, true), logo: flag(head.logo, true), note: words(head.note).slice(0, 80) },
    foot: { note: words(foot.note).slice(0, 120), pageNumbers: flag(foot.pageNumbers, true) },
    marks: marksOf(category, { qr: marks.qr === true, corners: marks.corners === true }),
    language: raw.language === 'es' ? 'es' : 'en',
    dayButton: seat,
    selection: {
      scope: selection.scope === 'All salespeople' ? 'All salespeople' : 'Current selection',
      chips: stringList(selection.chips, ['All products']),
    },
    revision: typeof raw.revision === 'number' && raw.revision >= 1 ? Math.floor(raw.revision) : 1,
    createdAt: stamped,
    createdBy: words(raw.createdBy, SHIPPED_BY),
    updatedAt: words(raw.updatedAt, stamped),
    updatedBy: words(raw.updatedBy, words(raw.createdBy, SHIPPED_BY)),
    lastUsedAt: typeof raw.lastUsedAt === 'string' ? raw.lastUsedAt : undefined,
    archivedAt: typeof raw.archivedAt === 'string' ? raw.archivedAt : undefined,
    archivedBy: typeof raw.archivedBy === 'string' ? raw.archivedBy : undefined,
    paused: raw.paused === true ? true : undefined,
    provider: words(raw.provider, PROVIDER_OF_CATEGORY[category]),
  };
};

/** ONE SEAT PER TEMPLATE, TWO SEATS PER HOUSE. A store that somehow carries two templates in one
 *  seat keeps the first and returns the other to the library, so the day can never draw two
 *  buttons that claim the same place. */
export const withOneTemplatePerSeat = (templates: Template[]): Template[] => {
  const taken = new Set<TemplateSeat>();
  return templates.map((template) => {
    if (template.dayButton === undefined) return template;
    if (template.archivedAt || taken.has(template.dayButton)) return { ...template, dayButton: undefined };
    taken.add(template.dayButton);
    return template;
  });
};

export const parseTemplates = (raw: unknown): Template[] | null => {
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.templates) ? raw.templates : null;
  if (!list) return null;
  /* A row this build cannot read is dropped rather than taking the store down with it: a house
     keeps every template that still parses. A store where nothing parses migrates instead. */
  const parsed = list.map(parseTemplate).filter((template): template is Template => template !== null);
  return withOneTemplatePerSeat(parsed);
};

/* ── THE LEGACY SAVED COPY, READ ONCE (OUT-01.8) ──────────────────────────────────────────────
 * `SavedOutput` was the export centre's own object, and until E200.02 the surface still spoke it
 * through a two-way adapter. THE LIBRARY DRAWS ITS ROWS FROM `Template` DIRECTLY, so the adapter is
 * gone and what survives is a ONE-WAY READ: the shape a house's retired store holds, and the
 * function that folds one of its rows into a template. Both are private to this file — the
 * migration is their only caller, and no surface speaks this vocabulary any more. */
type LegacyCopy = {
  id: string;
  templateId: TemplateSeed;
  kind: OutputKind;
  title: string;
  scope: OutputScope;
  chips: string[];
  paper?: TemplatePaper;
  copies?: number;
  layout?: string;
  recipients?: string;
  timing?: string;
  attachments?: string;
  reviewRule?: string;
  paused?: boolean;
  sourceTemplateVersion?: number;
  revision?: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  providerProfile?: string;
  timezone?: string;
  fileFormat?: string;
  fileColumns?: string[];
  fileColumnLabels?: Record<string, string>;
  fileName?: string;
  archivedAt?: string;
  archivedBy?: string;
};

const copiesOf = (value: number | undefined): TemplateCopies | undefined =>
  value === 2 ? 2 : value === 3 ? 3 : value === 1 ? 1 : undefined;

/** A stored saved copy becomes a template of the category its `templateId` maps to. Where the
 *  house had set the layout profile, that profile becomes the layout of every migrated template of
 *  the matching category, so a house that had configured its paper keeps its paper exactly.
 *
 *  THE ORDER THE LAYOUT IS RESOLVED IN, and each rung earns its place:
 *    1. `profile` — the migration hands the retiring house-wide record in.
 *    2. the category's shipped layout — a copy stored before the house ever set a profile.
 *  The file and email arms carry no rung: those fields ARE the stored copy's own values. */
const templateOfLegacyCopy = (output: LegacyCopy, profile?: PrintLayoutProfile | null): Template => {
  const category = CATEGORY_OF_SEED[output.templateId] ?? 'albaran';
  const paperCategory = PAPER_CATEGORIES.includes(category);
  const columns = output.fileColumns ?? ['Customer', 'Product', 'Quantity'];
  const paperLayout = (): TemplateLayout => {
    if (profile) {
      const folded = layoutFromProfile(category, profile);
      if (folded) return folded;
    }
    return shippedLayoutOf(category);
  };
  const layout: TemplateLayout = paperCategory
    ? paperLayout()
    : category === 'file'
      ? { kind: 'file', format: 'CSV', columns, columnLabels: output.fileColumnLabels ?? Object.fromEntries(columns.map((column) => [column, column])), fileName: output.fileName ?? 'orders' }
      : { kind: 'email', recipients: output.recipients ?? '', timing: output.timing ?? 'Daily at 09:00', timezone: output.timezone ?? 'UTC', attachments: output.attachments ?? 'Delivery notes', reviewRule: output.reviewRule ?? 'Send directly' };
  const created = output.createdAt ?? SHIPPED_AT;
  return {
    id: output.id,
    category,
    seed: output.templateId,
    name: output.title.slice(0, 48) || CATEGORY_PLURALS[category],
    paper: paperCategory ? output.paper ?? 'A4' : undefined,
    copies: paperCategory ? copiesOf(output.copies) ?? 1 : undefined,
    layout,
    head: { ...HEAD_DEFAULT },
    foot: { ...FOOT_DEFAULT },
    marks: marksOf(category),
    language: 'en',
    /* A copy the house had archived arrives archived, and an archived template holds no seat
       (OUT-03.2), so `dayButtonsFor` seats the live ones and this row stays in the library. */
    dayButton: undefined,
    selection: { scope: output.scope, chips: output.chips },
    revision: output.revision ?? 1,
    createdAt: created,
    createdBy: output.createdBy ?? SHIPPED_BY,
    updatedAt: output.updatedAt ?? created,
    updatedBy: output.updatedBy ?? output.createdBy ?? SHIPPED_BY,
    /* A COPY HAS NEVER RUN AS A TEMPLATE, and the key is written rather than left off: a migration
       that lands the same BYTES twice has to land the same OBJECT twice, and a read back through
       `parseTemplate` states this field. */
    lastUsedAt: undefined,
    archivedAt: output.archivedAt,
    archivedBy: output.archivedBy,
    paused: output.paused,
    provider: output.providerProfile ?? PROVIDER_OF_CATEGORY[category],
  };
};

const isLegacyCopy = (value: unknown): value is LegacyCopy => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.templateId === 'string' && value.templateId in CATEGORY_OF_SEED
    && typeof value.title === 'string'
    && (value.kind === 'print' || value.kind === 'email' || value.kind === 'file')
    && (value.scope === 'Current selection' || value.scope === 'All salespeople') && Array.isArray(value.chips);
};

const readLegacyCopies = (sector: string): LegacyCopy[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(`${LEGACY_SAVED_OUTPUTS_KEY}:${sector}`) ?? 'null');
    const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.outputs) ? raw.outputs : null;
    if (!list) return null;
    return list.every(isLegacyCopy) ? list as LegacyCopy[] : null;
  } catch { return null; }
};

/* ── THE MIGRATION (OUT-01.8) ─────────────────────────────────────────────────────────────────
 * IDEMPOTENT. The one key is read first, so a store already migrated is simply opened. Where it is
 * absent, the two retiring keys are folded into templates and put away in the same pass; a write
 * that stalls leaves both keys where they are, so the next read migrates the same legacy state
 * into the same bytes.
 */
export const migrateTemplates = (sector: string): Template[] => {
  /* IDEMPOTENT AT ITS OWN DOOR. A store already migrated is opened, never rebuilt — so calling this
     twice, or calling it beside `readTemplates`, lands the same bytes both times. */
  const already = storedTemplates(sector);
  if (already) return already;
  const legacy = readLegacyCopies(sector);
  const profile = readLegacyPrintLayout(sector);
  /* A house with a stored profile and no saved copies still keeps its paper: the profile lands on
     the shipped templates of the matching categories. */
  const base = legacy
    ? legacy.map((output) => templateOfLegacyCopy(output, profile))
    : shippedTemplates().map((template) => profile ? { ...template, layout: layoutFromProfile(template.category, profile) ?? template.layout } : template);
  const seated = withOneTemplatePerSeat(dayButtonsFor(base));
  if (writeTemplates(sector, seated)) {
    clearLegacySavedOutputs(sector);
    clearLegacyPrintLayout(sector);
  }
  return seated;
};

const layoutFromProfile = (category: OutputCategory, profile: PrintLayoutProfile): TemplateLayout | null =>
  category === 'albaran' ? { kind: 'albaran', fields: { ...profile.albaran } }
    : category === 'packing' ? { kind: 'packing', columns: profile.packing.columns, groupByTruck: true, sort: profile.packing.sort }
      : null;

/** A migrated house gets the day's two seats it already had: the albarán first, the packing sheet
 *  second, which is the pair `DayPaper` hard-codes today. A house whose store already names its
 *  seats keeps them. */
const dayButtonsFor = (templates: Template[]): Template[] => {
  if (templates.some((template) => template.dayButton !== undefined)) return templates;
  const seatFor = (template: Template): TemplateSeat | undefined =>
    template.archivedAt ? undefined : template.category === 'albaran' ? 0 : template.category === 'packing' ? 1 : undefined;
  const taken = new Set<TemplateSeat>();
  return templates.map((template) => {
    const seat = seatFor(template);
    if (seat === undefined || taken.has(seat)) return template;
    taken.add(seat);
    return { ...template, dayButton: seat };
  });
};

const clearLegacySavedOutputs = (sector: string): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(`${LEGACY_SAVED_OUTPUTS_KEY}:${sector}`); } catch { /* the key stays; the read above is fail-soft */ }
};

/** What the one key holds, or `null` where it holds nothing this build can read. */
const storedTemplates = (sector: string): Template[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(templatesKeyFor(sector)) ?? 'null');
    const parsed = parseTemplates(raw);
    return parsed && parsed.length ? parsed : null;
  } catch { return null; }
};

/** THE READ. A store that parses returns its list; anything else migrates, and a house that has
 *  nothing to migrate opens on the templates that ship. */
export const readTemplates = (sector: string): Template[] => {
  if (typeof window === 'undefined') return shippedTemplates();
  return storedTemplates(sector) ?? migrateTemplates(sector);
};

/* ── ONE LIST, AND EVERY SURFACE READING IT HEARS THE WRITE (OUT-01.8 · OUT-03.2) ─────────────
 * The library and the day's head stand in two different trees — the export centre's modal and the
 * river — so a `useState` per reader made the store a snapshot each of them took once. Giving a
 * template a day seat wrote localStorage, redrew the library, and left the day head naming the
 * template it had read at mount: the seat was real and invisible until the app was reloaded.
 *
 * So the write PUBLISHES. Every reader subscribes and re-reads from the one key, which is the same
 * shape `packing-output.ts` already uses for the print history — and the `storage` event carries a
 * write made in another tab, because a house with the export centre open on a second screen is a
 * house whose day head is out of date for exactly as long as nobody says so. */
const templateListeners = new Set<() => void>();

/** Subscribe to the template list. Returns the unsubscribe, so a React effect can return it. */
export const subscribeTemplates = (listener: () => void): (() => void) => {
  templateListeners.add(listener);
  return () => { templateListeners.delete(listener); };
};

const publishTemplates = () => { templateListeners.forEach((listener) => listener()); };

/* ⚠ A `window` IS NOT ALWAYS A BROWSER. `tools/test-output-templates.mjs` transpiles this module
   in memory and hands it a window that is a localStorage and nothing else — which is the whole
   point of a PURE module: it can be held to its rules without a build. So the road that needs a
   real event target asks for the method rather than for the global. */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key.startsWith(TEMPLATES_KEY)) publishTemplates();
  });
}

/** THE WRITE. `false` says the store stalled, and the surface says so in its own words; the caller
 *  keeps the values it holds. A write that lands is published, so the library, the print screen and
 *  the day's two seats read the same list on the next frame. */
export const writeTemplates = (sector: string, next: Template[]): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(templatesKeyFor(sector), JSON.stringify({ version: TEMPLATES_VERSION, templates: next }));
    publishTemplates();
    return true;
  } catch { return false; }
};

/* ── THE ACTS A TEMPLATE ANSWERS TO ───────────────────────────────────────────────────────────
 * Every one of these is pure: it takes a template and returns the next one. The store is written
 * by `writeTemplates` and by nothing else. */

/** A SAVED EDIT RAISES THE REVISION (OUT-01.7), so a photograph of a sheet read back weeks later
 *  is registered against the geometry that was on the paper rather than against today's. */
export const savedTemplate = (template: Template, patch: Partial<Template>, at: string, by: string): Template => ({
  ...template, ...patch,
  id: template.id, category: template.category,
  marks: marksOf(template.category, patch.marks ?? template.marks),
  revision: template.revision + 1,
  updatedAt: at, updatedBy: by,
});

/** The template printed or sent. The library row reads this. */
export const usedTemplate = (template: Template, at: string): Template => ({ ...template, lastUsedAt: at });

export const duplicateTemplate = (template: Template, at: string, by: string): Template => ({
  ...template,
  id: `${template.category}-${Date.parse(at) || 0}`,
  name: `${template.name} copy`.slice(0, 48),
  revision: 1,
  dayButton: undefined,
  lastUsedAt: undefined,
  archivedAt: undefined,
  archivedBy: undefined,
  createdAt: at, createdBy: by, updatedAt: at, updatedBy: by,
});

export const newTemplate = (category: OutputCategory, name: string, at: string, by: string): Template => ({
  id: `${category}-${Date.parse(at) || 0}`,
  category,
  seed: SEED_OF_CATEGORY[category],
  name: name.slice(0, 48) || CATEGORY_PLURALS[category],
  paper: PAPER_CATEGORIES.includes(category) ? 'A4' : undefined,
  copies: PAPER_CATEGORIES.includes(category) ? 1 : undefined,
  layout: shippedLayoutOf(category),
  head: { ...HEAD_DEFAULT },
  foot: { ...FOOT_DEFAULT },
  marks: marksOf(category),
  language: 'en',
  selection: { scope: 'Current selection', chips: ['All products'] },
  revision: 1,
  createdAt: at, createdBy: by, updatedAt: at, updatedBy: by,
});

/** ARCHIVING CLEARS THE SEAT IN THE SAME WRITE, so the day never points at a template the library
 *  has put away (OUT-03.2). */
export const archivedTemplate = (template: Template, at: string, by: string): Template =>
  ({ ...template, archivedAt: at, archivedBy: by, dayButton: undefined, updatedAt: at, updatedBy: by });

export const restoredTemplate = (template: Template, at: string, by: string): Template =>
  ({ ...template, archivedAt: undefined, archivedBy: undefined, updatedAt: at, updatedBy: by });

/** «Set as day button» takes the seat and returns whoever held it to the library. */
export const withSeat = (templates: Template[], id: string, seat: TemplateSeat): Template[] =>
  templates.map((template) => template.id === id
    ? { ...template, dayButton: seat }
    : template.dayButton === seat ? { ...template, dayButton: undefined } : template);

/** «Take off the day». A day may run with one button or with none. */
export const withoutSeat = (templates: Template[], id: string): Template[] =>
  templates.map((template) => template.id === id ? { ...template, dayButton: undefined } : template);

/** The day's two buttons, in seat order. `undefined` where a seat stands empty. */
export const templateSeats = (templates: Template[]): [Template | undefined, Template | undefined] => {
  const live = templates.filter((template) => !template.archivedAt);
  return [live.find((template) => template.dayButton === 0), live.find((template) => template.dayButton === 1)];
};

export const liveTemplates = (templates: Template[]): Template[] => templates.filter((template) => !template.archivedAt);

export const templatesOfCategory = (templates: Template[], category: OutputCategory): Template[] =>
  liveTemplates(templates).filter((template) => template.category === category);

/** WHICH TEMPLATE A PAPER PREVIEW DRAWS. A preview is opened by PAPER, and a house may hold several
 *  templates in one category, so the one it draws is the one standing on the day — then the first
 *  the house owns, then the shipped one. W2b's print screen opens ON a template and takes this
 *  function's place at the doors it replaces. */
export const templateForPaper = (templates: Template[], kind: 'albaranes' | 'packing' | 'sheet'): Template => {
  const category: OutputCategory = kind === 'albaranes' ? 'albaran' : kind === 'packing' ? 'packing' : 'day-sheet';
  const owned = templatesOfCategory(templates, category);
  const seated = owned.find((template) => template.dayButton !== undefined);
  return seated ?? owned[0] ?? shippedTemplates().find((template) => template.category === category)
    ?? newTemplate(category, CATEGORY_PLURALS[category], SHIPPED_AT, SHIPPED_BY);
};

export const templateById = (templates: Template[], id: string): Template | undefined =>
  templates.find((template) => template.id === id);
