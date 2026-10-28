import { soles } from '../currency';
/** Export centre. Configured copies are local kit objects; provider delivery and receipt events remain explicit wiring seams.
 * Latest workflow authority: THE-EXPORT-CANON §18 (2026-08-31). */
import { Disclosure } from '../disclosure';
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Select, SIZE as SELECT_SIZE } from 'baseui/select';
import { Download, GripVertical, X } from 'lucide-react';
import { PaperMiniature, type PaperKind } from '../printthumbnail';
import SaleDetail, { PrintFlush } from '../detail';
import PinMap, { type MapInset } from '../pin-map';
import type { SectorId } from '../../../scenarios/meta';
import type { Cast } from '../../../scenarios/data/cast';
import { packingOutputs, remainingPackingSales, unqueuedPackingSales } from '../packing-output';
import { StatefulMenu } from 'baseui/menu';
import { StatefulPopover, PLACEMENT as POPOVER_PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { StatefulTooltip, PLACEMENT as TOOLTIP_PLACEMENT } from 'baseui/tooltip';
import { mergeOverrides } from 'baseui/helpers/overrides';
import { OverlayCard, SCRIM } from '../../../rocoto/overlay-card';
import { ConnectAct } from '../connect';
import { Glyph, STEP, type GlyphId } from '../glyphs';
import { useConfig, type Derived } from '../config';
import { clockAfter, nowOf, plural, useDay } from '../day';
import { useGrants, type Grants } from '../grants';
import PrintView, { PACKING_MARK, packingWords } from '../print-view';
import { newPrintAttemptKey, openCapturedPrintCopy, printSourceRun, retrySourcePrint } from '../browser-print';
import { withLifetimeValues } from '../print-layout';
import {
  CATEGORY_NOTES, CATEGORY_PLURALS, KIND_OF_CATEGORY, PAPER_CATEGORIES, PAPER_KIND_OF, TEMPLATE_CATEGORIES,
  archivedTemplate, duplicateTemplate, layoutWords, liveTemplates, newTemplate, printProfileOf, readTemplates,
  restoredTemplate, savedTemplate, subscribeTemplates, templateById, templateForPaper, templateSeats,
  usedTemplate, withSeat, withoutSeat, writeTemplates,
  type OutputCategory, type OutputKind, type OutputScope, type Template, type TemplateLayout, type TemplateSeat,
} from '../output-templates';
import {
  buildSales, canPrepare, dayLabelFromId, exportState, isStanding, newPaperOf, qtyWords, railWorld,
  reasonLabelOf, roundOf, sendAllToErp, sheetSalesOf, slotOf, todayId,
  type ExportState, type RailWorld, type Sale,
} from '../sale';
import { minutesUntilSlot, prepClockOf, workspaceClock, type PrepClock } from '../scenario-clock';
import { PickList, type PickGroup } from './search-modal';
import { openSale } from './embeds';
import {
  COPY_STEPS, PAPER_SIZES, albaranRun, daySheetOrder, confirmPrintAttempt, jobWords, packingRun, pagesWaiting,
  railWords, setPrintSetup, setupWords, useQueue, usePrintSetup,
  type PaperSize, type PrintJob, type PrintOrder, type PrintSetup, type PrintSubject,
} from '../print-queue';
import { saveCsv } from '../export-files';
import { availableFileColumns, configuredFileOf, fileColumnsOf } from '../output-files';
import { byteWords, mapCoverageOf } from '../print-measures';
import type { WorkspaceCountry } from '../workspace-capabilities';
import { fileDownloadHistory, recordFileDownload, saleRevisionMapOf, saleRevisionOf, type FileDownloadRecord } from '../export-model';
import { usePhone } from './viewport';
import { categoryOptions } from '../product-ontology';
import { useHistoryLayer, useRouteTransition } from '../anchors';
import { WorkflowContent, WorkflowDialog, workflowCardOverrides, useWorkflowPlacement, useWorkflowViewport } from '../workflow-dialog';
import { useWorkspaceCapabilities } from '../workspace-capabilities';
import { PrintScreenCard, type PrintScreenRequest } from '../print-screen';
import { CONNECTIONS_EMAIL_HASH, emailCardWords, emailStatusWord, useEmailCapability } from '../email-provider';
import { EmailSetupState } from '../email-setup-state';

/** The header names its destinations. A bare icon plus a number made the status unreadable. */

/** How many rows a preview lists before it says how many more there are. A preview proves the
 *  shape of a thing; a person who wants all three hundred opens the day. */
const PREVIEW_ROWS = 8;

/* ── THE DESTINATIONS, NAMED, WITH THEIR MARKS (THE-EXPORT-CANON §15.3) ───────────────────────
 * «Name the destinations. Icons/visual should make it super clear and thought through.» And the
 * challenge that came with it: «anything that's a system like "the round" — what the fuck does it
 * mean and is it thought through?» — Peter, FEED-IA §67.3.
 *
 * Five things leave this surface, and each of them is a PLACE rather than a verb:
 *
 *   PAPER            the albarán, going out with the goods                    `print`
 *   THE HOUSE'S SYSTEM   the real name, always — «Sage 50», «Holded», «A3»    `erp`
 *   THE CUSTOMERS    «Email albarán to customers» — the act, at each          `email`
 *                    customer's own hour (§111.5, Peter's own line)
 *   THE BAY          the picking paper that stays in the building             `packing`
 *   EL REPARTO       the run itself, named by its van where one is known      `van`
 *
 * FOUR RULES MAKE IT «THOUGHT THROUGH» RATHER THAN FIVE LABELS:
 *   1 · NEVER A CATEGORY WHERE A NAME EXISTS. «Your ERP» is the label of a house that has none;
 *       the moment it is connected the rail wears «Sage 50» on every surface.
 *   2 · ONE MARK PER DESTINATION, EVERYWHERE — the rail identity, the control, the queue's row.
 *   3 · THE MARK IS THE DESTINATION, NEVER THE ACT. Three papers wore one printer mark and that
 *       was the whole of §54.4; here the printer stands on PAPER alone.
 *   4 · AT 390 A CONTROL DROPS TO ITS MARK PLUS ITS DESTINATION, never to a bare verb.
 */

/** THE BAY'S OWN MARK lives beside the paper it marks — `print-view.tsx`, which this file already
 *  depends on (see its note). One mark, one home, imported here rather than restated. */

/** WHAT A ROW IS ABOUT: the mark, the name, and where it goes. The sub is drawn only where the
 *  name alone is a category — a real system name says its own destination. */
type Destination = { mark: GlyphId; name: string; to?: string };

/** «Truck 2», falling back to «The delivery run» (§15.3). A day the whole house runs on one van is
 *  named by that van; a day with several is named by the run itself, which is the trade's own word
 *  and already lives in their Operaciones. «The round» is retired. */
export function roundNameOf(sales: Sale[]): string {
  const trucks = new Set<number>();
  for (const s of sales) {
    const r = roundOf(s);
    if (r) trucks.add(r.truck);
  }
  const only = [...trucks];
  return only.length === 1 ? `Truck ${only[0]}` : 'The delivery run';
}

/* ── WHEN EACH RAIL GOES (THE-EXPORT-CANON §16.6, §16.7) ──────────────────────────────────────
 * «THE SYSTEM LEADS ATTENTION. THE HOUSE LEADS APPETITE.» Three rails, three timings, said once:
 * the house presses paper, the system flows at the house's own appetite, and the customer's copy
 * waits for its hour. Stated as three values under one label, so the three answers stand in a
 * column and the capability table reads without a word of explanation.
 *
 * PRINTING IS ALWAYS MANUAL, AT EVERY APPETITE (§68.3). Paper never auto-fires: there is no notch,
 * no setting and no future feature in which the printer starts by itself, because paper comes out
 * where a person is standing or it comes out into an empty bay. So the paper rail's answer is a
 * constant, and the appetite governs the system rail alone — which is also why the setting is
 * named for that rail and could never quietly claim the printer.
 */

/** «As they come» · «At 07:41» · «With today's file» · «When you press» — the house's appetite,
 *  read off the policy and said as a value rather than as a sentence. A margin is stated as an
 *  HOUR and never as a countdown (§16.3 clause 2, which survived §68): a ticking clock on three
 *  hundred rows is stress, and it makes the surface the thing they watch. */
export function appetiteWords(grants: Grants, world: RailWorld, owed: number, now: string): string {
  /* «On your press», never «When you press» (C22): this is the VALUE of a `They go` cell, and the
     other four answers here are prepositional facts. One grammar down the column. */
  if (grants.dispatch === 'on-a-press') return 'On your press';
  if (world.erp.cadence === 'file') return 'With today’s file';
  if (grants.dispatch === 'at-once') return 'As they come';
  return owed > 0 ? `At ${clockAfter(now, grants.dispatchWait)}` : `After ${grants.dispatchWait} min`;
}

/* ── EVERY OUTPUT IS A TEMPLATE (THE-OUTPUTS-SPEC OUT-01 · FEED-IA §202.5) ───────────────────
 * This file used to open with «A template is a starting point. A saved copy is the configured copy
 * people actually run.» That sentence is what E200 removes: a template IS the thing people run,
 * the thing they edit, and the thing that ships. The object, its store, its migration and its acts
 * live in `output-templates.ts`.
 *
 * `SavedOutput` and the seed gallery it was picked from are GONE (E200.02): the library, the editor
 * and the sending plans all read `Template` itself, so there is one object on this surface and no
 * vocabulary standing between it and the store.
 *
 * ── READING ONE ARM OF A TEMPLATE'S LAYOUT ───────────────────────────────────────────────────
 * The `file` and `email` arms of `TemplateLayout` hold what the retired saved copy held on its own
 * body. These two readers are the only place a surface reaches into an arm, so a template asked
 * for an arm it does not carry answers `null` and its caller states the category's own fact. */
const emailArm = (template: Template) => template.layout.kind === 'email' ? template.layout : null;
const fileArm = (template: Template) => template.layout.kind === 'file' ? template.layout : null;

/* ── THE PICKER'S OWN GRAMMAR FOR A PRODUCT CHIP (FEED-IA §200.1) ─────────────────────────────
 * «PV-1001 · Merluza» — the code, then the name, which is what «Specific products» offers and what
 * a saved copy stores. One seat, so the chip a copy is READ back against is the same string the
 * picker WRITES. */
const productChip = (product: { code?: string; id: string; name: string }): string =>
  `${product.code ?? product.id} · ${product.name}`;

/* ── WHAT A LEGACY CHIP LOOKS LIKE, AND WHAT IT DOES NOT ──────────────────────────────────────
 * Before E197.1 the picker offered «SKU PV-1001 · Merluza», so a copy saved then holds a chip
 * nobody offers today and nobody can un-pick. Reading the three letters away fixes that copy — and
 * an unbounded read would eat a legitimate chip whose text simply begins with them, which is the
 * same defect pointed the other way. So the prefix comes off on TWO tests and no fewer: the chip
 * the picker offers today is never touched at all, and what is left after the prefix has to be the
 * picker's grammar — a code (no spaces: `PV-1001`, `CEG`), then « · », then a name.
 */
const LEGACY_CHIP_PREFIX = 'SKU ';
const PRODUCT_CHIP = /^[A-Za-z0-9][A-Za-z0-9._/-]* · .+$/;
const migrateChip = (chip: string, offered: ReadonlySet<string>): string => {
  if (offered.has(chip)) return chip;
  if (!chip.startsWith(LEGACY_CHIP_PREFIX)) return chip;
  const rest = chip.slice(LEGACY_CHIP_PREFIX.length);
  return offered.has(rest) || PRODUCT_CHIP.test(rest) ? rest : chip;
};

/** WHAT A PREPARED SCHEDULE REMEMBERS OF THE TEMPLATE IT CAME FROM. A schedule is a frozen plan,
 *  so it keeps its own copy of the fields it was prepared with and survives an edit to the
 *  template. These are the fields the stored schedules already hold; naming them as their own type
 *  is what lets the saved copy go (OUT-01.8). */
type ScheduledCopy = {
  id: string;
  title: string;
  recipients?: string;
  timing?: string;
  timezone?: string;
  attachments?: string;
  reviewRule?: string;
  revision?: number;
};

/** A stored snapshot read back. Two fields carry the plan's identity and the rest are read where
 *  they stand, so a schedule written before E200 opens with everything it was prepared with. */
function isScheduledCopy(value: unknown): value is ScheduledCopy {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ScheduledCopy>;
  return typeof item.id === 'string' && typeof item.title === 'string';
}

/** THE TEMPLATE, AS A SCHEDULE FREEZES IT. */
const scheduledCopyOf = (template: Template): ScheduledCopy => {
  const mail = emailArm(template);
  return {
    id: template.id, title: template.name, revision: template.revision,
    recipients: mail?.recipients, timing: mail?.timing, timezone: mail?.timezone,
    attachments: mail?.attachments, reviewRule: mail?.reviewRule,
  };
};


/* ── THE EXPORT CENTRE'S DOOR, OPENABLE FROM OUTSIDE IT (OUT-03.2 · OUT-03.5) ─────────────────
 * The centre owns its own `open`, and it always has: it IS the door in the day bar. A day whose
 * two seats stand empty has to offer the place where they are chosen, and a seat holding a `file`
 * or an `email` template has to open the screen where that template's own act stands — both of
 * them from the river, which mounts no part of this file.
 *
 * One event, so the centre keeps owning its state and the river keeps knowing nothing about it.
 * The template a caller names is handed over in a module cell rather than in the event, because
 * the library MOUNTS with the panel: it reads the cell on its first render, which is the same
 * frame the centre opens in, and clears it so a later opening lands on the library itself.
 */
export const OPEN_EXPORT_EVENT = 'rocoto:export-open';
let pendingTemplateId: string | null = null;

/** Open the export centre. With a template id it lands on that template's own screen. */
export const openExportCentre = (templateId?: string) => {
  if (typeof window === 'undefined') return;
  pendingTemplateId = templateId ?? null;
  window.dispatchEvent(new CustomEvent(OPEN_EXPORT_EVENT));
};

const takePendingTemplate = (): string | null => {
  const id = pendingTemplateId;
  pendingTemplateId = null;
  return id;
};

/** THE STORE, THROUGH THE ONE SEAM (THE-OUTPUTS-SPEC OUT-01.8). `readTemplates` and
 *  `writeTemplates` are the only two functions that touch it, so the day the runtime answers
 *  `GET /api/outputs/templates` and `PUT /api/outputs/templates/<id>`, one file changes. A write
 *  that stalls returns `false` and the surface says so in its own words, which is the contract the
 *  saved copies already had. Exported because E200.02's library, E200.03's print screen and the
 *  day's two seats all read the same list. */
export function useTemplates(sector: string): [Template[], (next: Template[]) => boolean] {
  const [templates, setTemplates] = React.useState<Template[]>(() => readTemplates(sector));
  React.useEffect(() => { setTemplates(readTemplates(sector)); }, [sector]);
  /* AND EVERY READER HEARS EVERY WRITE (OUT-03.2). The library writes a day seat inside the export
     centre's modal and the river's day head is a different tree: without this the seat was real in
     the store and stale on the day until a reload. `subscribeTemplates` is the store's own
     publication, so both trees redraw off ONE list. */
  React.useEffect(() => subscribeTemplates(() => setTemplates(readTemplates(sector))), [sector]);
  const save = React.useCallback((next: Template[]) => {
    if (!writeTemplates(sector, next)) return false;
    setTemplates(next);
    return true;
  }, [sector]);
  return [templates, save];
}
const PRINTABLE_PAPERS = PAPER_SIZES.filter((paper): paper is 'A4' | 'A5' => paper !== 'Ticket');
const OUTPUT_SCHEDULES_KEY = 'rocoto:export:output-schedules';
const OUTPUT_SCHEDULES_VERSION = 1;
type OutputScheduleStatus = 'prepared' | 'paused' | 'cancelled';
type OutputSchedule = {
  scheduleId: string;
  outputId: string;
  outputRevision: string;
  outputSnapshot: ScheduledCopy;
  nextAt?: string;
  timezone: string;
  timing: string;
  recipients: string;
  attachment: string;
  reviewState: 'required' | 'cleared';
  status: OutputScheduleStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

/** THE STAMP A STALE SCHEDULE IS TOLD BY. Every field a prepared plan was built from, in one
 *  string: where it differs from the schedule's own, the template moved on and the row says so. */
function templateStampOf(copy: ScheduledCopy) {
  return JSON.stringify({
    title: copy.title, recipients: copy.recipients, timing: copy.timing, timezone: copy.timezone,
    attachments: copy.attachments, reviewRule: copy.reviewRule, revision: copy.revision,
  });
}

function scheduledNextAt(timing: string | undefined) {
  const match = timing?.match(/^(?:Daily at|At) (\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const next = new Date();
  next.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function nextRunWords(schedule: OutputSchedule) {
  if (!schedule.nextAt) return 'Timing still to choose';
  return `After activation · ${new Date(schedule.nextAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

function normaliseOutputSchedule(value: unknown): OutputSchedule | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const item = value as Partial<OutputSchedule>;
  const storedStatus = raw.status;
  const valid = typeof item.scheduleId === 'string' && typeof item.outputId === 'string'
    && typeof item.outputRevision === 'string' && isScheduledCopy(item.outputSnapshot)
    && typeof item.timezone === 'string' && typeof item.timing === 'string'
    && typeof item.recipients === 'string' && typeof item.attachment === 'string'
    && (item.reviewState === 'required' || item.reviewState === 'cleared')
    && (storedStatus === 'prepared' || storedStatus === 'scheduled' || storedStatus === 'paused' || storedStatus === 'cancelled')
    && typeof item.createdAt === 'string' && typeof item.createdBy === 'string'
    && typeof item.updatedAt === 'string' && typeof item.updatedBy === 'string';
  if (!valid) return null;
  /* `scheduled` was the old browser-only label. Reload cannot upgrade local intent into a
     provider-backed schedule, so migrate it down to the truthful prepared state. */
  return { ...(item as OutputSchedule), status: storedStatus === 'scheduled' ? 'prepared' : storedStatus as OutputScheduleStatus };
}

function readOutputSchedules(sector: string): OutputSchedule[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`${OUTPUT_SCHEDULES_KEY}:${sector}`) ?? 'null');
    const schedules = raw && typeof raw === 'object' && Array.isArray((raw as { schedules?: unknown }).schedules)
      ? (raw as { schedules: unknown[] }).schedules : Array.isArray(raw) ? raw : [];
    return schedules.map(normaliseOutputSchedule).filter((schedule): schedule is OutputSchedule => schedule !== null);
  } catch { return []; }
}

function useOutputSchedules(sector: string): [OutputSchedule[], (next: OutputSchedule[]) => boolean] {
  const [schedules, setSchedules] = React.useState<OutputSchedule[]>(() => readOutputSchedules(sector));
  React.useEffect(() => { setSchedules(readOutputSchedules(sector)); }, [sector]);
  const save = React.useCallback((next: OutputSchedule[]) => {
    try {
      localStorage.setItem(`${OUTPUT_SCHEDULES_KEY}:${sector}`, JSON.stringify({ version: OUTPUT_SCHEDULES_VERSION, schedules: next }));
    } catch {
      return false;
    }
    setSchedules(next);
    return true;
  }, [sector]);
  return [schedules, save];
}

function scheduleFor(template: Template, actor: string, existing?: OutputSchedule): OutputSchedule {
  const at = new Date().toISOString();
  const copy = scheduledCopyOf(template);
  const reviewRequired = Boolean(copy.reviewRule) && copy.reviewRule !== 'Send directly';
  return {
    scheduleId: existing?.scheduleId ?? `schedule-${template.id}-${Date.now()}`,
    outputId: template.id,
    outputRevision: templateStampOf(copy),
    outputSnapshot: copy,
    nextAt: scheduledNextAt(copy.timing),
    timezone: copy.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
    timing: copy.timing ?? 'Time to choose',
    recipients: copy.recipients ?? 'Recipients to choose',
    attachment: copy.attachments ?? 'Attachment to choose',
    reviewState: reviewRequired ? 'required' : 'cleared',
    status: 'prepared',
    createdAt: existing?.createdAt ?? at,
    createdBy: existing?.createdBy ?? actor,
    updatedAt: at,
    updatedBy: actor,
  };
}

type EmailProviderReceipt = {
  receiptId: string;
  outputId: string;
  status: 'delivered' | 'failed';
  at: string;
  recipient: string;
  provider: string;
  detail?: string;
  fixture?: boolean;
};
const EMAIL_PROVIDER_RECEIPTS_KEY = 'rocoto:export:email-provider-receipts';
function readEmailProviderReceipts(sector: string): EmailProviderReceipt[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`${EMAIL_PROVIDER_RECEIPTS_KEY}:${sector}`) ?? 'null');
    const rows = raw && typeof raw === 'object' && Array.isArray((raw as { receipts?: unknown }).receipts)
      ? (raw as { receipts: unknown[] }).receipts : [];
    return rows.filter((value): value is EmailProviderReceipt => {
      if (!value || typeof value !== 'object') return false;
      const receipt = value as Partial<EmailProviderReceipt>;
      return typeof receipt.receiptId === 'string' && typeof receipt.outputId === 'string'
        && (receipt.status === 'delivered' || receipt.status === 'failed')
        && typeof receipt.at === 'string' && typeof receipt.recipient === 'string'
        && typeof receipt.provider === 'string'
        /* Until a server-owned receipt adapter exists, local rows are accepted only as visibly
           marked design fixtures. Browser state can never manufacture an unmarked Delivered. */
        && receipt.fixture === true;
    }).sort((a, b) => b.at.localeCompare(a.at));
  } catch { return []; }
}

export function PrintSetupCard({ onDone, embedded = false }: { onDone: () => void; embedded?: boolean }) {
  const [, theme] = useStyletron();
  const setup = usePrintSetup();
  const [paper, setPaper] = React.useState<PaperSize>(setup.paper);
  const [copies, setCopies] = React.useState(setup.copies);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPaper(setup.paper);
    setCopies(setup.copies);
    setSaveError(null);
  }, [setup]);

  const save = () => {
    if (paper === 'Ticket') {
      setSaveError('Choose A4 or A5 before printing.');
      return;
    }
    if (!setPrintSetup({ paper, copies, set: true })) {
      setSaveError('Saving paper and copies stalled.');
      return;
    }
    onDone();
  };

  const pill = (on: boolean, label: string, testid: string, onClick: () => void) => (
    <span key={label} data-selected={on ? 'yes' : 'no'}>
      <Button kind={on ? KIND.primary : KIND.secondary} shape={SHAPE.pill} size={SIZE.compact} onClick={onClick} data-testid={testid}>{label}</Button>
    </span>
  );
  const actions = <><Button kind={KIND.secondary} size={SIZE.compact} onClick={onDone} data-testid="print-setup-cancel">Cancel</Button><Button kind={KIND.primary} size={SIZE.compact} onClick={save} data-testid="print-setup-save">Save</Button></>;
  const body = <div data-testid="print-setup-card" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
    {/* OUT-01.3 · paper and copies belong to the TEMPLATE now. This card keeps its place as the
        house's default for a NEW template, and it says so, so a person knows what it governs. */}
    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>The paper a new template starts from. Choose a printer in the print dialog.</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelSmall }}>Paper</span>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        {PRINTABLE_PAPERS.map((value) => pill(value === paper, value, `paper-${value}`, () => { setPaper(value); setSaveError(null); }))}
      </div>
      {paper === 'Ticket' && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>This document takes A4 or A5. Choose one.</span>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelSmall }}>Copies</span>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        {COPY_STEPS.map((count) => pill(count === copies, count === 1 ? '1 copy' : `${count} copies`, `copies-${count}`, () => { setCopies(count); setSaveError(null); }))}
      </div>
    </div>
    {saveError && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{saveError}</span>}
  </div>;

  return embedded
    ? <WorkflowContent title="Paper & copies" onClose={onDone} onBack={onDone} actions={actions} testId="print-setup-workflow">{body}</WorkflowContent>
    : <WorkflowDialog title="Paper & copies" ariaLabel="Paper & copies" onClose={onDone} actions={actions}>{body}</WorkflowDialog>;
}

/* ── THE TEMPLATE'S OWN LAYOUT (THE-OUTPUTS-SPEC OUT-01.3 · OUT-04.2) ─────────────────────────
 * These controls were `PrintLayoutEditor`, DEFINED AND NEVER RENDERED: the export centre's view
 * union held no `layout` member and `savePrintLayout` was imported and called nowhere, so every
 * house printed the shipped values forever. They write to ONE template's own layout now, and they
 * stand inside the configuration form until E200.03 gives them the print screen's Edit mode.
 *
 * The controls, their labels and their testids ship as they were. Two things change: `By truck` was
 * a pill with an empty handler, so it becomes the stated FACT it always was; and the price sentence
 * says what IS rather than what is unavailable.
 *
 * E200.03 · EXPORTED, because the print screen's Edit mode is the other surface that draws them
 * (THE-OUTPUTS-SPEC OUT-04.2: «The albarán and packing groups are `PrintLayoutEditor`'s own
 * controls, which stop being unreachable and become this screen's Edit mode»). One definition,
 * two mounts, so the configuration form and the print screen can never offer different settings
 * for the same template.
 */
export function TemplateLayoutFields({ layout, valued, touch = false, onChange }: {
  layout: TemplateLayout;
  valued: boolean;
  /** a hand on glass — the print screen's Edit sheet takes the 44px floor (E200.03) */
  touch?: boolean;
  onChange: (next: TemplateLayout) => void;
}) {
  const [, theme] = useStyletron();
  const choice = (selected: boolean, label: string, testid: string, onClick: () => void, disabled = false, title?: string) =>
    <Button kind={selected ? KIND.primary : KIND.secondary} size={touch ? SIZE.compact : SIZE.mini} shape={SHAPE.pill} data-testid={testid} aria-pressed={selected} disabled={disabled} title={title} onClick={onClick} overrides={touch ? { BaseButton: { style: { minHeight: '44px' } } } : undefined}>{label}</Button>;
  const copy = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary };
  const priceWords = 'Prices arrive with the pricing workspace.';
  if (layout.kind === 'albaran') {
    const fields = layout.fields;
    const patch = (next: Partial<typeof fields>) => onChange({ kind: 'albaran', fields: { ...fields, ...next } });
    return <section data-testid="export-layout-editor" aria-label="Paper layout" style={{ display: 'grid', gap: theme.sizing.scale200 }}>
      <span style={{ ...theme.typography.LabelSmall }}>Fields</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
        {choice(fields.finalWeight, 'Final weight', 'layout-albaran-final-weight', () => patch({ finalWeight: !fields.finalWeight }))}
        {choice(fields.unitPrice, 'Unit price', 'layout-albaran-unit-price', () => patch({ unitPrice: !fields.unitPrice }), !valued, valued ? undefined : priceWords)}
        {choice(fields.lineTotal, 'Line total', 'layout-albaran-line-total', () => patch({ lineTotal: !fields.lineTotal }), !valued, valued ? undefined : priceWords)}
      </div>
      <span style={copy}>{valued ? 'Final weight stays blank until the scale gives a final reading.' : priceWords}</span>
    </section>;
  }
  if (layout.kind === 'packing') {
    return <section data-testid="export-layout-editor" aria-label="Paper layout" style={{ display: 'grid', gap: theme.sizing.scale200 }}>
      <span style={{ ...theme.typography.LabelSmall }}>Columns</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
        {choice(layout.columns === 1, '1 column', 'layout-packing-columns-1', () => onChange({ ...layout, columns: 1 }))}
        {choice(layout.columns === 2, '2 columns', 'layout-packing-columns-2', () => onChange({ ...layout, columns: 2 }))}
      </div>
      <span style={{ ...theme.typography.LabelSmall }}>Order within each truck</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
        {(['route', 'customer', 'order-value', 'lifetime-value'] as const).map((sort) => choice(layout.sort === sort, ({ route: 'Route order', customer: 'Customer A–Z', 'order-value': 'Order value', 'lifetime-value': 'Lifetime value' } as const)[sort], `layout-packing-sort-${sort}`, () => onChange({ ...layout, sort })))}
      </div>
      {/* A control that cannot move is a stated fact, never a pill offering a choice (OUT-01.3). */}
      <span data-testid="layout-packing-grouping" style={copy}>Grouped by truck. Carries the capture mark.</span>
      <span style={copy}>Truck dividers are included. Lifetime value is captured with this print request.</span>
    </section>;
  }
  if (layout.kind === 'day-sheet') {
    return <section data-testid="export-layout-editor" aria-label="Paper layout" style={{ display: 'grid', gap: theme.sizing.scale200 }}>
      <span style={{ ...theme.typography.LabelSmall }}>Stops</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
        {choice(layout.stops === 'route', 'Route order', 'layout-sheet-stops-route', () => onChange({ kind: 'day-sheet', stops: 'route' }))}
        {choice(layout.stops === 'customer', 'Customer A–Z', 'layout-sheet-stops-customer', () => onChange({ kind: 'day-sheet', stops: 'customer' }))}
      </div>
    </section>;
  }
  return null;
}

/* ── THE FACT ─────────────────────────────────────────────────────────────────────────────────
 * THE ATOM OF THIS SURFACE (§51.24: «THE NUMBERS AS FACTS (not sentences)»). A label over a
 * figure, and the label comes FIRST because a number a reader has to guess the subject of is a
 * number they read twice.
 *
 * A ZERO STILL DRAWS. Every other surface in this app drops a line whose number is nothing —
 * «0 of today are in Sage 50» is prose spent on an absence. A FACT is a different object: it lives
 * in a fixed cell of a grid three rails share, and a cell that comes and goes moves the two beside
 * it, which is exactly the «across the entire thing you don't even have the same thing» he named.
 * So the cell holds its place and a nothing is drawn quiet, which is a stable grid AND an honest
 * reading — the eye skips it without the column ever shifting.
 */

/** THE LABEL BOX IS TWO LINES TALL WHERE TWO LINES CAN HAPPEN. «New since 09:15» fits one line in
 *  a 640px modal and takes two at 390 — and a label that grows pushes its own figure down while the
 *  figure beside it stays put, which is a grid that comes apart at the width most people read on.
 *  So the phone gets a stated height and the desk, where every label is one line, gets none: a
 *  reserved second line on a surface that never uses it is 15px of nothing under every heading. */
const LABEL_LINES = 2;

export function Fact({
  label,
  value,
  testid,
  quiet = false,
  done = false,
}: {
  label: string;
  value: number | string;
  testid?: string;
  /** the header's own facts, and the stream's — they scope or record rather than carry work */
  quiet?: boolean;
  /** THE RECORD STEPS BACK (§6.1). Owed versus done is INK WEIGHT and never colour: work stands
   *  in primary ink, what already happened recedes to tertiary. Same grammar the river uses for
   *  whole rows, applied inside one cell. */
  done?: boolean;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const nothing = value === 0 || value === '0';
  const step = quiet ? theme.typography.LabelMedium : theme.typography.HeadingXSmall;
  return (
    <span
      data-fact={testid ?? label}
      data-label={label}
      data-value={String(value)}
      data-zero={nothing ? 'yes' : 'no'}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
    >
      {/* THE LABEL SITS ON THE FLOOR OF ITS BOX. A two-line box with the words at the top leaves a
          blank line between a label and the number it names, which reads as two facts; parked at
          the bottom, a one-line label and a two-line label both end exactly above their own
          figure, and the figures across the grid still share one baseline. */}
      <span
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          minWidth: 0,
          ...(quiet || !phone ? {} : { minHeight: `calc(${LABEL_LINES} * 1.25em)` }),
        }}
      >
        <span
          style={{
            ...theme.typography.LabelXSmall,
            color: theme.colors.contentTertiary,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: LABEL_LINES,
            overflow: 'hidden',
          }}
        >
          {label}
        </span>
      </span>
      <span
        style={{
          ...step,
          color: nothing || done ? theme.colors.contentTertiary : theme.colors.contentPrimary,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </span>
  );
}

/** THE FACT STRIP — the grid the three rails share, so column 1 of every rail starts at one x.
 *  Three seats, because three is the most any rail carries; a rail with two leaves the third
 *  empty rather than spreading into it (§51.11: alignment on one grid). */
export function Facts({ children, testid, fold = false }: { children: React.ReactNode; testid: string;
  /** THE STRIP FOLDS WHERE ITS CELLS HOLD FIELDS RATHER THAN FIGURES. Three fixed tracks are right
   *  for the rails, whose cells are short numbers; a cell holding a live field is 100px wide at
   *  390 and its invitation («Choose a van», «Choose a zone») is cut to «Choo». A folding strip
   *  keeps one x on a desk — 9rem × 3 + two gaps fits every posture above the handset — and gives
   *  a phone whole rows instead. Opt-in, so the three rails are untouched. */
  fold?: boolean }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-facts={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: fold ? 'repeat(auto-fit, minmax(9rem, 1fr))' : 'repeat(3, minmax(0, 1fr))',
        gap: theme.sizing.scale400,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ── THE ACTS STREAM (THE-EXPORT-CANON §15.1) ─────────────────────────────────────────────────
 * «NOTHING CLOSES, basically — get it? I just don't want them to have to make closed to quickly
 * print everything once they trust us, then print again as new shit comes in.» — Peter, §67.4.
 *
 * So the record axis is not a binary and `closed` is not a value anywhere on this surface. What
 * replaces it is two things: the STREAM of acts that happened, in hours, and the LIVE READING of
 * what is owed right now — recomputed on every event, and free to go BACKWARDS, which is the whole
 * point. Goods move after the paper came out, and the document is owed again.
 *
 * AT DAY SCALE THE STREAM IS FACTS, NOT SENTENCES (§6.2: «the export centre — the same facts as
 * labelled cells»). The sober full sentences live on the document's own export block; here the
 * day's history is a quiet strip of label-over-figure cells under the rail's owed numbers, in the
 * SAME atom, at the record's own ink weight. `Changed since` is the load-bearing cell — §15.1
 * promotes overlay B from a modifier to the axis's main event, so a count that goes UP after an
 * edit is the axis working rather than a counter misbehaving.
 */

export function Stream({
  testid,
  cells,
}: {
  testid: string;
  /** label · value pairs; a null seat is a fact this rail does not have today */
  cells: Array<{ label: string; value: number | string; owed?: boolean } | null>;
}) {
  const [, theme] = useStyletron();
  const live = cells.filter((c): c is { label: string; value: number | string; owed?: boolean } => c !== null);
  if (live.length === 0) return null;
  return (
    <div
      data-stream={testid}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: theme.sizing.scale700,
        flexWrap: 'wrap',
        paddingTop: theme.sizing.scale400,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      {live.map((c) => (
        <Fact key={c.label} label={c.label} value={c.value} testid={`${testid}-${c.label}`} quiet done={!c.owed} />
      ))}
    </div>
  );
}

/* ── ONE ROW OF THE PRINTER'S OWN QUEUE ───────────────────────────────────────────────────────
 * The same three columns every row of this modal keeps: WHAT the paper is · the STATE it is in ·
 * how many pages. `jobWords` was already a state phrase rather than a sentence — «In the queue ·
 * 3 pages», «Printing page 2 of 5» — so it takes the state column as it stands.
 */

const shortAttemptTime = (value: string | undefined): string => {
  if (!value) return 'time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function QueueRow({ job, setup, onConfirm, onOpenCopy, onRetry }: { job: PrintJob; setup: PrintSetup; onConfirm: (job: PrintJob) => void; onOpenCopy: (job: PrintJob) => void; onRetry: (job: PrintJob) => void }) {
  const [, theme] = useStyletron();
  const rails = job.state === 'printed' ? job.rails : [];
  const copies = job.copies === 1 ? '1 copy' : `${job.copies} copies`;
  const confirmation = job.state === 'printed'
    ? <>Confirmed by {job.confirmedBy ?? 'operator'} · <time dateTime={job.done} title={job.done}>{shortAttemptTime(job.done)}</time></>
    : job.failure ? 'Awaiting confirmation · needs attention' : job.state === 'printing' ? 'Dialog requested · awaiting confirmation' : 'Awaiting dialog';

  return (
    <div
      data-testid={`queue-row-${job.id}`}
      data-state={job.state}
      data-paper={job.paper}
      data-pages={job.pages}
      data-print-kind={job.subject.kind}
      data-sale={job.subject.kind === 'albaran' ? job.subject.sale : undefined}
      data-sales={job.subject.kind === 'albaran' ? undefined : job.subject.salesIds?.join('|')}
      data-truck={job.subject.kind === 'albaran' ? undefined : job.subject.truck ?? 'assign'}
      data-divider={job.subject.kind === 'day' ? job.subject.divider : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale200,
        padding: `${theme.sizing.scale300} 0`,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
        <span
          style={{
            ...theme.typography.LabelSmall,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {job.what}
        </span>
        <span
          data-words={job.id}
          style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, flex: '0 0 auto' }}
        >
          {jobWords(job, setup)}
        </span>
        {job.state === 'printed' && (
          <span
            data-pages={job.id}
            style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}
          >
            {job.pages === 1 ? '1 page' : `${job.pages} pages`}
          </span>
        )}
      </span>
      <details data-testid={`queue-attempt-${job.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
        <summary data-testid={`print-activity-${job.id}`} style={{ cursor: 'pointer' }}>
          {job.reprintOf ? 'Requested again by' : 'Requested by'} {job.requestedBy} · <time dateTime={job.requestedAt} title={job.requestedAt}>{shortAttemptTime(job.requestedAt)}</time> · {copies} · {confirmation}
        </summary>
        <div style={{ paddingTop: theme.sizing.scale200 }}>
          Version {job.revision} · {job.paper} · Browser print dialog
          {job.reprintOf && <div style={{ paddingTop: theme.sizing.scale200 }}><Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => {
            const previous = document.querySelector('[data-testid="queue-row-' + CSS.escape(job.reprintOf!) + '"]');
            previous?.scrollIntoView({ block: 'center' });
            const detail = previous?.querySelector('details');
            if (detail) detail.open = true;
          }}>Previous request</Button></div>}
        </div>
      </details>

      <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} onClick={() => onOpenCopy(job)} data-testid={`open-print-copy-${job.id}`}>
          Open copy
        </Button>
        {job.state === 'waiting' && job.runKey && (
          <Button kind={KIND.secondary} size={SIZE.mini} shape={SHAPE.pill} onClick={() => onRetry(job)} data-testid={`retry-print-${job.id}`}>
            Try again
          </Button>
        )}
        {job.state === 'printing' && (
          <Button kind={KIND.secondary} size={SIZE.mini} shape={SHAPE.pill} onClick={() => onConfirm(job)} data-testid={`confirm-printed-${job.id}`}>
            Confirm paper came out
          </Button>
        )}
      </span>

      {/* THE SEND RAILS RIDE THE PAPER (§20, §35.4). They state themselves once the sheet exists:
          the customer's copy goes at the hour they asked for, and a customer with their own system
          gets it there too. Both are facts now — §35.4 turned the mail from an offer into a
          schedule, so there is nothing here to press. */}
      {rails.map((rail) => (
        <span
          key={rail.kind}
          data-rail={rail.kind}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.sizing.scale200,
            ...theme.typography.LabelXSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          <Glyph id="clock" size={13} /> {railWords(rail)}
        </span>
      ))}
    </div>
  );
}

/* ── THE RAIL ROW — THE ONE SECTION GRAMMAR (§51.24) ──────────────────────────────────────────
 * mark · name · WHERE IT GOES · THE FACTS · one act · the stream · the eye. Three columns on a
 * desk and two on a phone, and in both the EYE IS THE LAST CELL — same x on every row,
 * top-aligned, so a person who wants to look at what leaves finds it without reading anything.
 *
 * The identity column is a stated width rather than intrinsic, because a column that sizes itself
 * to «Sage 50» on one row and «Packing lists» on the next is three grids pretending to be one.
 *
 * THE DESTINATION RIDES THE IDENTITY, UNDER THE NAME (CANON §15.3). It is the thing that makes an
 * act unambiguous, so it is the LAST thing to go at 390: the phone drops the facts grid to a
 * narrower measure and the words to their shortest, and the mark plus the destination survive.
 */

const IDENTITY = 168;
const EYE = 40;

export function RailRow({
  mark,
  name,
  to,
  testid,
  connected,
  facts,
  act,
  eye,
  phone,
  children,
}: {
  mark: GlyphId;
  name: string;
  /** WHERE IT GOES — drawn under the name, and never a category where a name exists (§15.3) */
  to?: string;
  testid: string;
  connected: boolean;
  /** the numbers this rail holds, in their own grid. Absent where a rail has no numbers yet. */
  facts?: React.ReactNode;
  act?: React.ReactNode;
  eye?: { label: string; onOpen: () => void };
  phone: boolean;
  children?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <section
      data-testid={testid}
      data-connected={connected ? 'yes' : 'no'}
      data-to={to}
      style={{
        display: 'grid',
        gridTemplateColumns: phone ? `minmax(0, 1fr) ${EYE}px` : `${IDENTITY}px minmax(0, 1fr) ${EYE}px`,
        gridTemplateAreas: phone
          ? '"id eye" "facts eye" "act act" "more more"'
          : '"id facts eye" "id act eye" "id more eye"',
        columnGap: theme.sizing.scale500,
        rowGap: theme.sizing.scale400,
        alignItems: 'start',
        padding: `${theme.sizing.scale600} 0`,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <span
        style={{
          gridArea: 'id',
          display: 'flex',
          alignItems: 'flex-start',
          gap: theme.sizing.scale300,
          minWidth: 0,
        }}
      >
        {/* THE MARK SITS ON THE NAME'S OWN LINE. A destination line under the name makes the
            identity two storeys tall, and a mark centred on a two-line block floats between them;
            parked at the top it stands beside the word it marks, on every row alike. */}
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, flex: '0 0 auto' }}>
          <Glyph id={mark} size={STEP.small} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
          {/* THE NAME WRAPS TO TWO LINES AND STOPS (§111.5 rule 3 · the overflow register §8). A
              rail named by the ACT it performs — «Email albarán to customers» — cannot make 140px
              on one line at any step a person would call type, and a nowrap identity would cut the
              half of the name that says who it reaches. Two lines is what the destination sub
              already made this column able to hold; three would push the row past the facts grid
              beside it. */}
          <span
            data-rail-name={name}
            style={{
              ...theme.typography.LabelMedium,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {name}
          </span>
          {to && (
            <span
              style={{
                ...theme.typography.LabelXSmall,
                color: theme.colors.contentTertiary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {to}
            </span>
          )}
        </span>
      </span>

      <div style={{ gridArea: 'facts', minWidth: 0 }}>{facts}</div>

      <div
        style={{
          gridArea: 'act',
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale300,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {act}
      </div>

      {/* THE EYE'S OWN CELL. It is drawn even where a rail has nothing to preview, so the column
          exists on every row and the three that do have one line up. */}
      <div style={{ gridArea: 'eye', display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
        {eye && (
          <StatefulTooltip content={eye.label} placement={TOOLTIP_PLACEMENT.top} showArrow>
            <Button
              kind={KIND.tertiary}
              size={SIZE.compact}
              shape={SHAPE.circle}
              data-testid={`${testid}-eye`}
              aria-label={eye.label}
              onClick={eye.onOpen}
            >
              <Glyph id="eye" size={STEP.small} />
            </Button>
          </StatefulTooltip>
        )}
      </div>

      {children && <div style={{ gridArea: 'more', minWidth: 0 }}>{children}</div>}
    </section>
  );
}

/* ── THE PRESS, AND ITS SCOPE ─────────────────────────────────────────────────────────────────
 * The act cell of a paper rail: the button that prints, with the scope menu attached where a
 * caller hands it one (§28, §31.4). The eye that used to be the third column of this lockup is
 * the ROW's eye now — see the header's note on the dual flush.
 *
 * ITS MARK IS THE DESTINATION IT PRINTS FOR (CANON §15.3 rule 3). The printer mark stands on the
 * ALBARANES and on nothing else on this surface: the bay's paper wears the bay's mark and the
 * round's manifest wears the van. «It is still absolutely unclear what is about packing and what
 * is not» (§54.4) was three identical ⎙ in a column, told apart only by the words beside them.
 */

function Press({
  label,
  testid,
  mark = 'print',
  disabled,
  menu,
  onPrint,
}: {
  label: string;
  testid: string;
  /** the destination this paper is for — the printer only where the paper IS the albarán */
  mark?: GlyphId;
  disabled?: boolean;
  menu?: { ariaLabel: string; items: Array<{ label: string; onSelect: () => void }> };
  onPrint: () => void;
}) {
  const square = { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
  return (
    <span data-testid={testid} style={{ display: 'inline-flex', alignItems: 'stretch', minWidth: 0, maxWidth: '100%' }}>
      <Button
        kind={KIND.primary}
        size={SIZE.compact}
        disabled={disabled}
        data-testid={`${testid}-print`}
        startEnhancer={<Glyph id={mark} size={STEP.small} />}
        onClick={onPrint}
        overrides={menu ? { BaseButton: { style: square } } : undefined}
      >
        {label}
      </Button>
      {menu && (
        <StatefulPopover
          placement={POPOVER_PLACEMENT.bottomLeft}
          triggerType={TRIGGER_TYPE.click}
          overrides={{ Body: { style: { zIndex: 12 } } }}
          content={({ close }) => (
            <div data-testid={`${testid}-menu`}>
              <StatefulMenu
                overrides={{ List: { style: { minWidth: '200px' } } }}
                items={menu.items.map((i) => ({ label: i.label }))}
                onItemSelect={({ item }) => {
                  menu.items.find((i) => i.label === item.label)?.onSelect();
                  close();
                }}
              />
            </div>
          )}
        >
          <Button
            kind={KIND.primary}
            size={SIZE.compact}
            data-testid={`${testid}-scope`}
            aria-label={menu.ariaLabel}
            overrides={{ BaseButton: { style: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } } }}
          >
            <Glyph id="caret" size={STEP.small} />
          </Button>
        </StatefulPopover>
      )}
    </span>
  );
}

/* ── THE SYNC, AND WHAT IT BECOMES (§59.1, CANON §4.3, FEED-IA §111.5) ────────────────────────
 * «An act TRANSFORMS ITS OWN CONTROL, in place… acting NEVER stacks new rows, buttons, or
 * sentences under the thing.» — Peter, §59.1.
 *
 *   at rest   `[⇄ Sync 4 now]`      · or `[⇄ All synced]`, quiet, where the system holds it all
 *   pressed   `[⇄ Syncing]`         — Base's own rule: the progressive verb for a step happening
 *                                     now, in the SAME box, at the same height
 *   settled   back to `[⇄ All synced]`, and the rail's stream states «Last sync 07:41»
 *
 * The going state holds for a beat because the send really does take one — a control that flicked
 * from press to gone would be the surface claiming an instant the wire never has. Nothing stacks,
 * and the row's height is identical on both sides of the press.
 *
 * IT DOES NOT NAME SAGE 50, AND THAT IS V22 (§111.5 rule 2). The rail's identity says the system's
 * real name one column to the left, so the act says the act.
 */

const GOING = 900;

/** THE SEAT IS HELD BY THE SURFACE, NOT BY THE BUTTON. The fold clears the owed count the instant
 *  the send is appended, so a control that owned its own «going» flag would unmount before it drew
 *  it — the press would read as the button vanishing, which is the jaggedy sin from the other
 *  direction. The Centre keeps the seat for the beat and this draws whichever state it is in. */
function SyncPress({
  label,
  going,
  live,
  rested,
  testid,
  onSend,
}: {
  label: string;
  /** what the control says while it is happening — «Syncing» */
  going: string;
  live: boolean;
  /** the system holds everything this day has, so the control states that and waits (CANON §2.5:
   *  the same shape the paper rail's «All printed» keeps) */
  rested: boolean;
  testid: string;
  onSend: () => void;
}) {
  return (
    <Button
      kind={KIND.secondary}
      size={SIZE.compact}
      disabled={live || rested}
      data-testid={testid}
      data-going={live ? 'yes' : 'no'}
      data-rested={rested ? 'yes' : 'no'}
      startEnhancer={<Glyph id="erp" size={STEP.small} />}
      onClick={onSend}
    >
      {live ? going : label}
    </Button>
  );
}

/* ── A REGION HEAD ────────────────────────────────────────────────────────────────────────────
 * A NOUN that names what is under it, and never a remark about it (§51's heading law). One is
 * used, once: the machine's own region, which holds the other paper it prints and what is on it
 * right now. The rails need none — the modal's own title is theirs.
 */

function RegionHead({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <h3
      data-region-head={typeof children === 'string' ? children : undefined}
      style={{
        margin: 0,
        paddingTop: theme.sizing.scale700,
        ...theme.typography.LabelSmall,
        color: theme.colors.contentTertiary,
      }}
    >
      {children}
    </h3>
  );
}

/* ── THE PREVIEWS ─────────────────────────────────────────────────────────────────────────────
 * «Preview available from within» (§35.3). Each rail shows what LEAVES on it: the paper as paper,
 * the file as the ERP receives it, the mail as the customer opens it. They replace the rails
 * inside the same card and carry one way back, so the centre is one place and never a stack.
 */

function PreviewHead({ title, onBack }: { title: string; onBack: () => void }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
      <StatefulTooltip content="Back" placement={TOOLTIP_PLACEMENT.top} showArrow>
        <span>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-back" aria-label="Back to Export Centre" onClick={onBack}
            overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px', paddingLeft: 0, paddingRight: 0 } } }}>
            <Glyph id="back" size={STEP.small} />
          </Button>
        </span>
      </StatefulTooltip>
      <h3 style={{ margin: 0, flex: 1, minWidth: 0, ...theme.typography.LabelMedium }}>{title}</h3>
    </div>
  );
}

/** WHAT THE HOUSE'S OWN SYSTEM RECEIVES. Every albarán of the day, its customer, what it carries
 *  and what it comes to — the file, shown as the file. */
function ErpFile({ sales, world, day }: { sales: Sale[]; world: RailWorld; day: string }) {
  const [, theme] = useStyletron();
  const rows = sales.slice(0, PREVIEW_ROWS);
  return (
    <div data-testid="export-erp-file" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      {/* THE SCOPE, AND THE LIST SAYS THE REST (§111.5's tone hunt · THE-CONTENT-CANON §3). «Each
          carries its number, the customer, the lines and the total» narrated the four columns
          standing directly under it — the helper repeating what the surface shows. */}
      {/* A HOUSE THAT CARRIES ITS OWN FILE HAS A SPREADSHEET, NOT A SYSTEM. «Today's file» is the
          honest label of the ERP ROW in Settings, and on this screen it read as the name of a
          product this house uses — so the sentence names what the person actually opens. */}
      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '54ch' }}>
        {dayLabelFromId(day)} · {sales.length} {plural(sales.length, 'delivery note', 'delivery notes')} for{' '}
        {world.erp.configured ? world.erp.name : 'your spreadsheet'}.
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {rows.map((s) => (
          <span
            key={s.id}
            data-erp-row={s.id}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: theme.sizing.scale400,
              padding: `${theme.sizing.scale200} 0`,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              ...theme.typography.LabelXSmall,
              minWidth: 0,
            }}
          >
            <span style={{ color: theme.colors.contentTertiary, flex: '0 0 auto' }}>{s.number}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.customer.name}
            </span>
            <span style={{ color: theme.colors.contentSecondary, flex: '0 0 auto' }}>
              {s.lines.length} {plural(s.lines.length, 'line')}
            </span>
            <span style={{ flex: '0 0 auto' }}>{soles(s.figure)}</span>
          </span>
        ))}
      </div>
      {sales.length > rows.length && (
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
          and {sales.length - rows.length} more on the same file.
        </span>
      )}
    </div>
  );
}

/** The scheduled customer-email preview shows only the facts the sender can verify here. */
function EmailPreview({ sale }: { sale: Sale }) {
  const [, theme] = useStyletron();
  const line = (label: string, value: React.ReactNode) => (
    <span style={{ display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: theme.sizing.scale300, ...theme.typography.LabelXSmall, minWidth: 0 }}>
      <span style={{ color: theme.colors.contentTertiary }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </span>
  );
  return (
    <div
      data-testid="export-email-preview"
      data-sale={sale.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
        padding: theme.sizing.scale500,
        borderRadius: theme.borders.radius300,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {line('Recipient', sale.customer.name)}
      {line('Subject', `Delivery Note ${sale.number} · ${sale.deliveryDay}`)}
      {line('Attachment', <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200 }}><Glyph id="doc" size={13} /> Delivery Note {sale.number}.pdf</span>)}
      {line('Send', sale.emailScheduled?.sent ?? sale.emailScheduled?.sendAt ?? slotOf(sale))}
    </div>
  );
}


function OutputChips({ chips }: { chips: string[] }) {
  const [, theme] = useStyletron();
  return <span style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale100 }}>{chips.map((chip) => <span key={chip} style={{ padding: `2px ${theme.sizing.scale200}`, borderRadius: theme.borders.radius200, backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.contentSecondary, ...theme.typography.LabelXSmall }}>{chip}</span>)}</span>;
}

function FileColumnBuilder({ available, selected, labels, onChange }: {
  available: string[];
  selected: string[];
  labels: Record<string, string>;
  onChange: (columns: string[], labels: Record<string, string>) => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const [pickerFor, setPickerFor] = React.useState<number | null>(null);
  const [adding, setAdding] = React.useState(false);
  const mutate = (columns: string[], nextLabels = labels) => onChange(columns, nextLabels);
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    mutate(next);
  };
  const replace = (index: number, field: string) => {
    const previous = selected[index];
    if (previous === field || selected.includes(field)) { setPickerFor(null); return; }
    const next = [...selected];
    next[index] = field;
    const nextLabels = { ...labels, [field]: labels[previous] === previous || !labels[previous] ? field : labels[previous] };
    delete nextLabels[previous];
    mutate(next, nextLabels);
    setPickerFor(null);
  };
  const remove = (field: string) => mutate(selected.filter((value) => value !== field));
  const add = (field: string) => { if (!selected.includes(field)) mutate([...selected, field], { ...labels, [field]: labels[field] ?? field }); setAdding(false); };
  return <section data-testid="export-file-column-builder" style={{ display: 'grid', gap: theme.sizing.scale300 }}>
    <div style={{ display: 'grid', gap: theme.sizing.scale100 }}><span style={{ ...theme.typography.LabelSmall }}>Columns</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Arrange the fields in the exported file.</span><span data-testid="export-file-fixed-columns" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Every file opens with Delivery and closes with Order total where prices are on.</span></div>
    <div style={{ display: 'grid', gap: theme.sizing.scale200 }}>{selected.map((field, index) => <article key={field} data-testid={`export-file-column-${field.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} style={{ display: 'grid', gridTemplateColumns: phone ? '28px minmax(0, 1fr)' : '28px minmax(0, 1fr) auto', alignItems: 'start', gap: theme.sizing.scale200, padding: theme.sizing.scale200, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, backgroundColor: theme.colors.backgroundPrimary }}>
      <span aria-label="Drag column" title="Drag to reorder" style={{ display: 'inline-flex', alignSelf: 'center', color: theme.colors.contentSecondary, cursor: 'grab' }}><GripVertical size={18} strokeWidth={1.8} /></span>
      <span style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0 }}><Input value={labels[field] ?? field} onChange={(event) => mutate(selected, { ...labels, [field]: event.currentTarget.value })} aria-label={`Column label for ${field}`} /><span style={{ position: 'relative', display: 'inline-flex', justifyContent: 'flex-start' }}><Button kind={KIND.tertiary} size={SIZE.mini} aria-label={`Choose source field for ${field}`} onClick={() => setPickerFor(pickerFor === index ? null : index)} endEnhancer={<Glyph id="caret" size={STEP.small} />} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{field}</Button>{pickerFor === index && <span role="menu" style={{ position: 'absolute', zIndex: 2, top: '100%', left: 0, display: 'grid', minWidth: '180px', padding: theme.sizing.scale100, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, backgroundColor: theme.colors.backgroundPrimary, boxShadow: theme.lighting.shadow600 }}>{available.map((candidate) => <Button key={candidate} kind={KIND.tertiary} size={SIZE.mini} disabled={candidate !== field && selected.includes(candidate)} onClick={() => replace(index, candidate)}>{candidate}</Button>)}</span>}</span></span>
      <span style={{ display: 'flex', gridColumn: phone ? '2 / -1' : undefined, justifyContent: phone ? 'flex-end' : undefined, alignItems: 'center', gap: theme.sizing.scale100 }}><Button kind={KIND.tertiary} size={SIZE.mini} aria-label={`Move ${field} up`} disabled={index === 0} onClick={() => move(index, -1)} overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px', paddingLeft: 0, paddingRight: 0 } } }}><span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Glyph id="caret" size={STEP.small} /></span></Button><Button kind={KIND.tertiary} size={SIZE.mini} aria-label={`Move ${field} down`} disabled={index === selected.length - 1} onClick={() => move(index, 1)} overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="caret" size={STEP.small} /></Button><Button kind={KIND.tertiary} size={SIZE.mini} aria-label={`Remove ${field}`} onClick={() => remove(field)} overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="bin" size={STEP.small} /></Button></span>
    </article>)}</div>
    <span style={{ position: 'relative', justifySelf: 'flex-start' }}><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-add-file-column" startEnhancer={<Glyph id="plus" size={STEP.small} />} onClick={() => setAdding(!adding)} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Add column</Button>{adding && <span role="menu" style={{ position: 'absolute', zIndex: 2, top: '100%', left: 0, display: 'grid', minWidth: '180px', padding: theme.sizing.scale100, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, backgroundColor: theme.colors.backgroundPrimary, boxShadow: theme.lighting.shadow600 }}>{available.filter((field) => !selected.includes(field)).map((field) => <Button key={field} kind={KIND.tertiary} size={SIZE.mini} onClick={() => add(field)}>{field}</Button>) || <span style={{ padding: theme.sizing.scale200, ...theme.typography.ParagraphXSmall }}>All available fields are included.</span>}</span>}</span>
  </section>;
}

/** WHAT THE FILE WILL BE, BEFORE A FINGER TOUCHES IT (OUT-03.3 · FEED-IA §246). The artifact is
 *  built by one pure function so a screen can describe it — name, format, exact bytes, deliveries,
 *  lines and money — and then hand the very same text to the disk. The description and the file are
 *  one object rather than two guesses about each other. */
export function configuredFilePlan(template: Template, sales: Sale[], day: string, priced: boolean, country?: WorkspaceCountry) {
  const arm = fileArm(template);
  return configuredFileOf({
    template: { id: template.id, name: template.name, fileName: arm?.fileName, columns: arm?.columns, columnLabels: arm?.columnLabels },
    sales,
    priced,
    day,
    country,
  });
}

/** THE FILE A TEMPLATE WRITES, AND THE ONE FUNCTION THAT WRITES IT (OUT-03.3). Exported because a
 *  `file` template may stand on the DAY now: its tile saves the same file the library's own act
 *  saves, from the same record, so the two doors can never write two different files.
 *
 *  IT REPORTS WHAT IT WROTE, IN BYTES. «It's not calculating the right download size» (Peter,
 *  2026-09-10): the act used to hand back a count of orders, which describes the button rather than
 *  the artifact. `saveCsv` returns what the browser actually put on the disk, and the plan's own
 *  UTF-8 count stands beside it — two readings of one payload, and the disk's own wins. */
export function downloadConfiguredFile(sector: string, template: Template, sales: Sale[], day: string, priced: boolean, requestedBy: string) {
  const plan = configuredFilePlan(template, sales, day, priced);
  const written = saveCsv(plan.fileName, plan.text);
  const bytes = written || plan.bytes;
  const activitySaved = recordFileDownload(sector, { day, revision: saleRevisionOf(sales), saleRevisions: saleRevisionMapOf(sales), at: new Date().toISOString(), rows: sales.length, orderCount: sales.length, bytes, scope: template.selection.scope === 'All salespeople' ? 'all' : 'since-download', outputId: template.id, fileName: plan.fileName, format: 'CSV', requestedBy });
  return { rows: sales.length, bytes, fileName: plan.fileName, measures: plan.measures, activitySaved };
}

/** The one sentence a download says back: the file, then what it weighs. */
export const downloadWords = (fileName: string, bytes: number): string => `${fileName} · ${byteWords(bytes)}`;

type OutputPreviewTileProps = {
  icon: GlyphId;
  provider: string;
  accent?: boolean;
  kind?: OutputKind;
  title?: string;
  recipient?: string;
  attachment?: string;
  columns?: string[];
  /** which of the three papers this print output produces (§175 · E193.20) */
  paper?: PaperKind;
  /** the TEMPLATE's own sheet (OUT-01.3); the house default answers where no template stands */
  paperSize?: 'A4' | 'A5';
};

/* THE DAY THE PICTURES COME FROM (§175 · E193.20). A print thumbnail is the real paper, and a
 * real paper needs the real morning. `Centre` already folds the day once; handing it down here
 * costs one context instead of a prop on five components, and a tile that finds no day still
 * draws its paper — blank, at the right proportion, which is what an empty run prints. */
const PaperDay = React.createContext<{ day: string; sales: Sale[] }>({ day: '', sales: [] });

/** A template thumbnail shows the structure the configured copy will produce. It never invents
 * output data: names, recipient, attachment and columns come from the template or saved copy;
 * the remaining marks are deliberately non-semantic layout strokes.
 *
 * PRINT IS THE EXCEPTION, AND IT IS THE REASON THIS COMMENT SURVIVES (§175). Peter: «the print
 * previews aren't correct, they're all the same right now». Strokes can say «a file» or «an
 * email» because those are file-shaped and email-shaped and the tile carries their real columns
 * and recipient beside them. They cannot say «an albarán» as against «a packing list», because
 * the two are told apart by exactly the thing a stroke throws away. So the print tile draws the
 * document itself, through `PaperMiniature`. */
function OutputPreviewTile({ icon, provider, accent = false, kind: kindOverride, title = 'Output', recipient, attachment, columns = [], paper, paperSize }: OutputPreviewTileProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { day: paperDay, sales: paperSales } = React.useContext(PaperDay);
  const kind: OutputKind = kindOverride ?? (icon === 'email' || icon === 'ask' ? 'email' : icon === 'file' ? 'file' : 'print');
  const fileColumns = (columns.length ? columns : ['Customer', 'Product', 'Quantity']).slice(0, 4);
  const stroke = (width: string) => <span style={{ display: 'block', width, height: '3px', borderRadius: theme.borders.radius400, backgroundColor: theme.colors.borderOpaque }} />;
  const providerMark = <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale100, minWidth: 0, height: '24px', padding: `0 ${theme.sizing.scale200}`, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary, boxShadow: theme.lighting.shadow400 }}><Glyph id={icon} size={14} /><span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{provider}</span></span>;
  const printPreview = <span data-preview-kind="print" style={{ alignSelf: 'center', display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: '5px', width: '70%', minWidth: '112px', maxWidth: '176px', height: '82px', padding: '9px 11px', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius100, backgroundColor: theme.colors.backgroundPrimary, boxShadow: theme.lighting.shadow400, overflow: 'hidden' }}>
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>{stroke('46%')}{stroke('16px')}</span>
    <span style={{ display: 'grid', alignContent: 'start', gap: '5px', paddingTop: '4px', borderTop: `1px solid ${theme.colors.borderOpaque}` }}>{[82, 66, 74].map((width, index) => <span key={width} style={{ display: 'grid', gridTemplateColumns: '1fr 22px', alignItems: 'center', gap: '8px' }}>{stroke(`${width}%`)}{stroke(index === 1 ? '14px' : '18px')}</span>)}</span>
    <span style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: `1px solid ${theme.colors.borderOpaque}` }}>{stroke('32%')}{stroke('22px')}</span>
  </span>;
  const emailPreview = <span data-preview-kind="email" style={{ alignSelf: 'center', display: 'grid', gridTemplateRows: 'auto auto 1fr auto', gap: '5px', width: '88%', maxWidth: '232px', height: '82px', padding: '9px 11px', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, backgroundColor: theme.colors.backgroundPrimary, boxShadow: theme.lighting.shadow400, overflow: 'hidden' }}>
    <span style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: '6px', ...theme.typography.ParagraphXSmall, fontSize: '8px', lineHeight: '10px', color: theme.colors.contentSecondary }}><span>To</span><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipient?.trim() || 'Recipient to choose'}</span></span>
    <span style={{ display: 'flex', alignItems: 'center' }}>{stroke('58%')}</span>
    <span style={{ display: 'grid', alignContent: 'start', gap: '5px', paddingTop: '3px', borderTop: `1px solid ${theme.colors.borderOpaque}` }}>{stroke('92%')}{stroke('68%')}</span>
    <span style={{ display: 'inline-flex', justifySelf: 'start', alignItems: 'center', gap: '4px', maxWidth: '100%', height: '17px', padding: '0 6px', borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundSecondary, ...theme.typography.LabelXSmall, fontSize: '7px', lineHeight: '9px', color: theme.colors.contentSecondary }}><Glyph id="doc" size={10} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attachment || 'Attachment to choose'}</span></span>
  </span>;
  const filePreview = <span data-preview-kind="file" style={{ alignSelf: 'center', display: 'grid', gridTemplateRows: 'auto 1fr', width: '90%', maxWidth: '250px', height: '82px', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius100, backgroundColor: theme.colors.backgroundPrimary, boxShadow: theme.lighting.shadow400, overflow: 'hidden' }}>
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0, padding: '6px 8px', borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>{stroke('46%')}<span style={{ ...theme.typography.LabelXSmall, fontSize: '7px', lineHeight: '9px', color: theme.colors.contentSecondary }}>CSV</span></span>
    <span style={{ display: 'grid', gridTemplateColumns: `repeat(${fileColumns.length}, minmax(0, 1fr))`, minHeight: 0 }}>{fileColumns.map((column) => <span key={column} style={{ display: 'grid', gridTemplateRows: '18px repeat(2, 1fr)', minWidth: 0, borderRight: `1px solid ${theme.colors.borderOpaque}` }}><span data-output-column style={{ padding: '4px 5px', backgroundColor: theme.colors.backgroundSecondary, ...theme.typography.LabelXSmall, fontSize: '7px', lineHeight: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{column}</span><span style={{ borderTop: `1px solid ${theme.colors.borderOpaque}` }} /><span style={{ borderTop: `1px solid ${theme.colors.borderOpaque}` }} /></span>)}</span>
  </span>;
  /* THE PAPER GETS THE ROOM A PAPER NEEDS. A4 is 1.41 times as tall as it is wide, so a document
     inside a 76px band is a smudge; the print tile stands at the height that makes a masthead, a
     column set and a foot legible at arm's length, and the other two kinds keep the band they
     were designed in. */
  const paperHeight = phone ? 148 : 184;
  const realPaper = paper ? <PaperMiniature kind={paper} day={paperDay} sales={paperSales} height={paperHeight} paper={paperSize} /> : printPreview;
  /* The strokes are decoration and stay out of the accessibility tree; a real paper is a picture
     of a real document, so its own `role="img"` and label are what a reader should meet. */
  return <div aria-hidden={paper ? undefined : true} data-output-preview={kind} data-provider={provider} data-output-title={title} data-accent={accent ? 'true' : 'false'} style={{ height: kind === 'print' && paper ? `${paperHeight + 56}px` : '132px', display: 'grid', gridTemplateRows: '24px minmax(0, 1fr)', gap: theme.sizing.scale200, padding: theme.sizing.scale300, borderRadius: theme.borders.radius200, border: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundSecondary, boxShadow: accent ? `inset 0 0 0 1px ${theme.colors.backgroundPrimary}` : undefined, overflow: 'hidden' }}>
    <span aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>{providerMark}</span>
    {kind === 'email' ? emailPreview : kind === 'file' ? filePreview : realPaper}
  </div>;
}


/* ── WHAT A LIBRARY ROW SAYS ABOUT ITS TEMPLATE (OUT-02.3) ────────────────────────────────────
 * Three lines of fact, each read off the record the printer itself acts on, so a line on a row and
 * a line on the paper can never disagree. */

/** «A4 · 1 copy · Line total» — the sheet, the run, and what the layout puts on it. */
const settingsWords = (template: Template): string[] => [
  ...(template.paper ? [template.paper] : []),
  ...(template.copies ? [template.copies === 1 ? '1 copy' : `${template.copies} copies`] : []),
  ...layoutWords(template.layout),
].filter(Boolean);

/** «On the day · seat 1», and the packing category's own stated fact (OUT-01.5). */
const seatWords = (template: Template): string[] => [
  template.dayButton === undefined ? '' : `On the day · seat ${template.dayButton + 1}`,
  template.category === 'packing' ? 'Carries the capture mark' : '',
].filter(Boolean);

/** THE VERB EACH CATEGORY IS USED BY. One word per category, and it is the same word on the row
 *  that has run and on the row that is ready to. */
const USED_VERB: Record<OutputCategory, string> = {
  albaran: 'Printed', packing: 'Printed', 'day-sheet': 'Printed', file: 'Downloaded', email: 'Prepared',
};
const READY_WORDS: Record<OutputCategory, string> = {
  albaran: 'Ready to print', packing: 'Ready to print', 'day-sheet': 'Ready to print',
  file: 'Ready to download', email: 'Ready to prepare',
};

/** «09:12 today» on the morning it ran, «3 Sep» after that — ON THE HOUSE'S CLOCK (FEED-IA §247.8).
 *
 *  The recorded instant stays the instant it was recorded at; the zone it is READ in is
 *  `workspaceClock()`, the market's own zone — Lima in Peru, Madrid in Spain — the same reading
 *  the batch card two doors away states its hour in. This row took the hour
 *  AND the word «today» from the browser's zone, which is the batch card's own defect one size
 *  down: a press at 09:12 in Madrid reports «Printed 09:12 today» on the library view while the
 *  Prep view of the same modal reads «02:12 now». Measured at 00:30 in Madrid on main's build, a
 *  press an hour and eighteen minutes old was filed as «Printed 13 Sept» — a past day — under a
 *  card naming the 13th (`drives/drive-cedar-prep-clock.py`, block `stamp`). */
const usedWhen = (iso: string): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'earlier';
  const zone = workspaceClock().timeZone;
  const stamp = prepClockOf(at, zone);
  return stamp.dayId === prepClockOf(new Date(), zone).dayId
    ? `${stamp.hhmm} today`
    : at.toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: zone });
};
const usedWords = (template: Template): string =>
  template.lastUsedAt ? `${USED_VERB[template.category]} ${usedWhen(template.lastUsedAt)}` : READY_WORDS[template.category];

/* ── THE PAPER'S OWN OUTLINE (`better-ui` · IMAGE OUTLINES) ───────────────────────────────────
 * A picture of a document needs a 1px hairline at low opacity so it reads as an image and not as a
 * hole in the row. It is a NEUTRAL alpha and never a tinted grey: a tinted outline picks up the
 * surface under it and reads as dirt on the paper's edge. The kit ships one light theme, so this
 * is the light value; a dark theme takes the white alpha at the same opacity. */
const PAPER_OUTLINE = 'rgba(0, 0, 0, 0.1)';

/* ── THE LIBRARY'S ROW (THE-OUTPUTS-SPEC OUT-02.3 · FEED-IA §202.5) ───────────────────────────
 * «shpuld be obvious where to tap to edit the ones they have saved to their library.»
 *
 * A ROW, NOT A POSTER. What stood here was a card carrying a 184 px picture of the paper and SIX
 * controls in two rows, all but one tertiary — so nothing led, and a house with nine templates read
 * its library by scrolling past nine posters. The row states the template in three lines of fact
 * and LEADS WITH THE ACT (`better-layout` · ORDER BY IMPORTANCE); the three acts that are not the
 * act of the day file behind one `⋯` (`better-layout` · HINT AT HIDDEN CONTENT), which carries an
 * `aria-label` naming its own template.
 *
 * THE MEASURED LADDER (`better-layout` · GROUP WITH SPACE, NOT LINES). 8 px between the lines
 * inside one row, 16 px between rows, 32 px between sections — the 2× rule at every level, and each
 * step is a real token: `scale300` 8 · `scale600` 16 · `scale900` 32.
 *
 * CONCENTRIC RADIUS (`better-ui`). The row takes `radius400` (12) and pads `scale300` (8), so the
 * thumbnail inside it takes `radius200` (4): 4 + 8 = 12.
 *
 * THE THUMBNAIL IS THE REAL PAPER, drawn by `PaperMiniature` at 72 on the desk and 56 on the phone
 * — 51 × 72 and 40 × 56, because A4's own 210:297 decides the width once the height is chosen. A
 * `file` or `email` template produces no paper, so its seat holds the category's mark in the same
 * box and the grid keeps one shape.
 *
 * CONTROLS STAY DISTINCT FROM CONTENT (`better-layout`): the act is `KIND.primary`, Preview and
 * Edit are `KIND.secondary` and carry a border, and the fact lines stay plain text. Every act
 * clears 44 × 44, and the ROW ITSELF IS NOT A TARGET, so the three acts stay unambiguous.
 */
function TemplateRow({ template, primary, onPreview, onEdit, onDuplicate, onSeat, onUnseat, onArchive }: {
  template: Template;
  /** The act this category is for, and the label it wears when the day holds nothing to act on. */
  primary: { label: string; mark: GlyphId; onAct?: () => void };
  /** ONLY WHERE IT MEANS SOMETHING OF ITS OWN. A paper template's «Preview» opens the sheet beside
   *  its settings; a `file` or `email` template's preview IS its act — the file it writes, the plan
   *  that sends it — so the row carries the act alone rather than two doors onto one surface
   *  (`better-layout` · KEEP CONTROLS DISTINCT · `better-writing` · CONSISTENT FLOW VOCABULARY). */
  onPreview?: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onSeat: () => void;
  onUnseat: () => void;
  onArchive: () => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { day: paperDay, sales: paperSales } = React.useContext(PaperDay);
  const paperKind = PAPER_KIND_OF[template.category];
  const height = phone ? 56 : 72;
  /* A4 is 210 : 297, so the width follows the chosen height and the two postures stay one shape. */
  const width = Math.round(height * 210 / 297);
  const facts = settingsWords(template);
  const seat = seatWords(template);
  const smallTarget = { BaseButton: { style: { minHeight: '44px' } } };
  const thumb = paperKind
    ? <PaperMiniature kind={paperKind} day={paperDay} sales={paperSales} height={height} paper={template.paper} />
    : <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: `${width}px`, height: `${height}px`, color: theme.colors.contentSecondary, backgroundColor: theme.colors.backgroundSecondary }}>
        <Glyph id={template.category === 'file' ? 'file' : 'email'} size={STEP.medium} />
      </span>;
  const acts = <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
    <Button kind={KIND.primary} size={SIZE.compact} disabled={!primary.onAct} data-testid={`export-run-${template.id}`} startEnhancer={<Glyph id={primary.mark} size={STEP.small} />} onClick={primary.onAct} overrides={smallTarget}>{primary.label}</Button>
    {onPreview && <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`export-preview-${template.id}`} onClick={onPreview} overrides={smallTarget}>Preview</Button>}
    <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`export-edit-${template.id}`} onClick={onEdit} overrides={smallTarget}>Edit</Button>
  </span>;
  const menuItems = [
    { label: 'Duplicate', onSelect: onDuplicate },
    template.dayButton === undefined
      ? { label: 'Set as day button', onSelect: onSeat }
      : { label: 'Take off the day', onSelect: onUnseat },
    { label: 'Archive', onSelect: onArchive },
  ];
  const more = <StatefulPopover
    placement={POPOVER_PLACEMENT.bottomRight}
    triggerType={TRIGGER_TYPE.click}
    overrides={{ Body: { style: { zIndex: 12 } } }}
    content={({ close }) => (
      <div data-testid={`export-row-menu-${template.id}`}>
        <StatefulMenu
          overrides={{ List: { style: { minWidth: '220px' } } }}
          items={menuItems.map((item) => ({ label: item.label }))}
          onItemSelect={({ item }) => { menuItems.find((entry) => entry.label === item.label)?.onSelect(); close(); }}
        />
      </div>
    )}
  >
    <Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`export-row-more-${template.id}`} aria-label={`More for ${template.name}`} overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="more" size={STEP.small} /></Button>
  </StatefulPopover>;
  /* PLAN FOR GROWTH AND CLIPPING (`better-layout`). The name has no fixed width and the fact lines
     wrap rather than truncate; the row carries `min-height` and never `height`, so a translated
     label grows the row instead of being cut by it. */
  const words = <span style={{ display: 'grid', gap: theme.sizing.scale300, minWidth: 0, alignContent: 'center' }}>
    {/* THE NAME IS THE ROW'S LABEL, NOT A HEADING (`better-typography` · HEADING SIZES DESCEND).
        The only headings in the library are the category sections, so the outline runs h2 → h3 and
        the name sits under its own section at 18/500 against the heading's 20/700. It TRUNCATES
        WITHOUT LOSING CONTENT: one line, ellipsised, with the full value on the row's `title`. */}
    <span title={template.name} style={{ ...theme.typography.LabelLarge, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{template.name}</span>
    <span data-testid={`export-settings-${template.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{[...facts, ...(phone ? [usedWords(template)] : [])].join(' · ')}</span>
    {seat.length > 0 && <span data-testid={`export-seat-line-${template.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{seat.join(' · ')}</span>}
  </span>;
  return <article
    aria-label={template.name}
    data-testid={`export-output-${template.id}`}
    data-template-category={template.category}
    data-day-seat={template.dayButton === undefined ? 'none' : String(template.dayButton)}
    style={{
      display: 'grid',
      /* THE PHONE FOLDS THE ROW ONTO TWO LINES (OUT-02.4). The overflow rides line ONE, at the
         trailing edge beside the row's identity, so line two holds the three acts whole: at 360 the
         acts measure 284 px against a 312 px line, and a `⋯` appended to them wrapped onto a third
         line of its own with 44 px of dead air above it. Read on the phone, that was a control
         orphaned from the row it belongs to (`better-layout` · ORDER BY IMPORTANCE). */
      gridTemplateColumns: phone ? `${width}px minmax(0, 1fr) 44px` : `${width}px minmax(0, 1fr) auto auto 44px`,
      alignItems: 'center',
      columnGap: theme.sizing.scale600,
      rowGap: theme.sizing.scale300,
      minWidth: 0,
      minHeight: phone ? '104px' : '88px',
      padding: theme.sizing.scale300,
      border: `1px solid ${theme.colors.borderOpaque}`,
      borderRadius: theme.borders.radius400,
      backgroundColor: theme.colors.backgroundPrimary,
    }}
  >
    <span style={{ display: 'inline-flex', overflow: 'hidden', borderRadius: theme.borders.radius200, outline: `1px solid ${PAPER_OUTLINE}`, outlineOffset: '-1px' }}>{thumb}</span>
    {words}
    {/* TABULAR NUMBERS ON A CHANGING VALUE (`better-typography`): the hour a template last ran
        keeps its box as the morning moves. */}
    {!phone && <span data-testid={`export-used-${template.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{usedWords(template)}</span>}
    {phone
      ? <>{more}<span style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>{acts}</span></>
      : <>{acts}{more}</>}
  </article>;
}

/* ── THE TWO SEATS, CHOSEN (OUT-03.2) ─────────────────────────────────────────────────────────
 * «Set as day button» takes the first free seat. Where both are held, THE PERSON SEES WHAT THEY
 * ARE REPLACING BEFORE THEY REPLACE IT: two rows naming who stands in each seat, and a label that
 * repeats the consequence — «Put Kitchen sheets in seat 1» (`better-writing` · A CONFIRMATION
 * BUTTON REPEATS THE CONSEQUENCE). One act, one outcome; the previous holder returns to the
 * library with its seat cleared. */
function SeatChooser({ template, seats, onChoose, onCancel }: {
  template: Template;
  seats: [Template | undefined, Template | undefined];
  onChoose: (seat: TemplateSeat) => void;
  onCancel: () => void;
}) {
  const [, theme] = useStyletron();
  /* CONTROLS STAY DISTINCT FROM CONTENT (`better-layout`). The panel stands on the surface's own
     ground so the two secondary choices carry a fill the eye can tell from the sentence above them;
     on `backgroundSecondary` a secondary button IS the panel and the rows read as prose.
     AND THE CHOOSER ANSWERS A PRESS MADE INSIDE A MENU, which returns focus to the `⋯` it came
     from — so a person on a keyboard or a screen reader would be told nothing. Focus moves to the
     panel as it opens, which is both the announcement and the keyboard path
     (`better-accessibility` · EVERY POINTER INTERACTION NEEDS A KEYBOARD PATH). */
  const panel = React.useRef<HTMLElement>(null);
  React.useEffect(() => { panel.current?.focus(); }, [template.id]);
  return <section ref={panel} tabIndex={-1} data-testid="export-seat-chooser" role="group" aria-label={`Choose a day seat for ${template.name}`} style={{ display: 'grid', gap: theme.sizing.scale300, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary }}>
    <span style={{ ...theme.typography.LabelMedium }}>The day holds two buttons. Choose the one {template.name} takes.</span>
    {([0, 1] as TemplateSeat[]).map((seat) => <Button
      key={seat}
      kind={KIND.secondary}
      size={SIZE.compact}
      data-testid={`export-seat-choice-${seat}`}
      onClick={() => onChoose(seat)}
      overrides={{ BaseButton: { style: { justifyContent: 'flex-start', minHeight: '44px', textAlign: 'left' } } }}
    >{`Put ${template.name} in seat ${seat + 1} · ${seats[seat]?.name ?? 'Empty'}`}</Button>)}
    <span><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-seat-cancel" onClick={onCancel} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Keep the day as it is</Button></span>
  </section>;
}

/* ── WHAT THE HOUSE HAS PUT AWAY (OUT-02.3's foot) ────────────────────────────────────────────
 * One row for the whole library rather than one per destination: an archived template is archived,
 * and which category it came from is what the row itself says when it is opened. It stands away
 * until the house archives its first template. */
function ArchivedTemplates({ templates, onRestore }: { templates: Template[]; onRestore: (template: Template) => void }) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  if (!templates.length) return null;
  return <section data-testid="export-archived-templates" style={{ display: 'grid', gap: theme.sizing.scale300, paddingTop: theme.sizing.scale300, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
    <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-archived-toggle" aria-expanded={open} onClick={() => setOpen(!open)} overrides={{ BaseButton: { style: { justifyContent: 'flex-start', minHeight: '44px' } } }}>Archived · {templates.length}</Button>
    {open && <div style={{ display: 'grid', gap: theme.sizing.scale300 }}>{templates.map((template) => <div key={template.id} data-archived-template={template.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale500, padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary }}><span style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0 }}><span style={{ ...theme.typography.LabelSmall, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{CATEGORY_PLURALS[template.category]} · {template.archivedAt ? usedWhen(template.archivedAt) : 'Archived'}</span></span><Button kind={KIND.tertiary} size={SIZE.compact} data-testid={`export-restore-${template.id}`} aria-label={`Restore ${template.name}`} onClick={() => onRestore(template)} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Restore</Button></div>)}</div>}
  </section>;
}

function ScheduleEditor({ template, schedule, actor, onSave, onBack }: {
  template: Template;
  schedule: OutputSchedule;
  actor: string;
  onSave: (schedule: OutputSchedule) => boolean;
  onBack: () => void;
}) {
  const [, theme] = useStyletron();
  const initialTime = schedule.timing.match(/(?:Daily at|At) (\d{2}:\d{2})/)?.[1] ?? '09:00';
  const [recipients, setRecipients] = React.useState(schedule.recipients);
  const [cadence, setCadence] = React.useState<'daily' | 'delivery'>(schedule.timing === 'At delivery time' ? 'delivery' : 'daily');
  const [time, setTime] = React.useState(initialTime);
  const [attachment, setAttachment] = React.useState(schedule.attachment);
  const [saveError, setSaveError] = React.useState('');
  const timing = cadence === 'daily' ? `Daily at ${time}` : 'At delivery time';
  const option = (selected: boolean, label: string, onClick: () => void) => <Button kind={selected ? KIND.primary : KIND.secondary} shape={SHAPE.pill} size={SIZE.mini} onClick={onClick} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{label}</Button>;
  const save = () => {
    const at = new Date().toISOString();
    const rule = emailArm(template)?.reviewRule;
    const snapshot: ScheduledCopy = { ...scheduledCopyOf(template), recipients: recipients.trim(), timing, timezone: schedule.timezone, attachments: attachment };
    const saved = onSave({ ...schedule, outputRevision: templateStampOf(snapshot), outputSnapshot: snapshot, recipients: recipients.trim(), timing, attachment, nextAt: scheduledNextAt(timing), reviewState: rule && rule !== 'Send directly' ? 'required' : 'cleared', status: 'prepared', updatedAt: at, updatedBy: actor });
    if (!saved) setSaveError('Saving this schedule stalled. Your changes are still here.');
  };
  return <section data-testid="export-schedule-editor" style={{ display: 'grid', gap: theme.sizing.scale400, width: '100%', maxWidth: '680px', margin: '0 auto', padding: theme.sizing.scale400, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary }}>
    <div style={{ display: 'grid', gap: theme.sizing.scale100 }}><span style={{ ...theme.typography.LabelMedium }}>Edit schedule</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{template.name}</span></div>
    <label style={{ display: 'grid', gap: theme.sizing.scale200 }}><span style={{ ...theme.typography.LabelSmall }}>Recipient address</span><Input value={recipients} onChange={(event) => setRecipients(event.currentTarget.value)} aria-label="Scheduled recipient address" /></label>
    <section style={{ display: 'grid', gap: theme.sizing.scale200 }}><span style={{ ...theme.typography.LabelSmall }}>Cadence</span><span style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>{option(cadence === 'daily', 'Daily', () => setCadence('daily'))}{option(cadence === 'delivery', 'With delivery', () => setCadence('delivery'))}</span></section>
    {cadence === 'daily' && <label style={{ display: 'grid', gap: theme.sizing.scale200 }}><span style={{ ...theme.typography.LabelSmall }}>Send time</span><Input type="time" value={time} onChange={(event) => setTime(event.currentTarget.value)} aria-label="Scheduled send time" /></label>}
    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Timezone · {schedule.timezone}</span>
    <section style={{ display: 'grid', gap: theme.sizing.scale200 }}><span style={{ ...theme.typography.LabelSmall }}>Attachment</span><span style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>{['Delivery notes', 'Packing sheets', 'Both'].map((value) => option(attachment === value, value, () => setAttachment(value)))}</span></section>
    {saveError && <span role="alert" data-testid="export-schedule-save-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{saveError}</span>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale200 }}><Button kind={KIND.tertiary} size={SIZE.compact} onClick={onBack}>Cancel</Button><Button kind={KIND.primary} size={SIZE.compact} aria-label="Save schedule" onClick={save}>Save schedule</Button></div>
  </section>;
}

/* ── THE SENDING PLAN A TEMPLATE CARRIES (OUT-02.2) ───────────────────────────────────────────
 * The Email TAB is gone: sending is what an `email` template does, so a person reaches this from
 * the library row that owns it, and what stands here is that one template's plan — its schedule,
 * its pre-send review and its send history. `better-writing` · CONSISTENT FLOW VOCABULARY: the row
 * says «Schedule», this surface is headed «Schedule», and the act inside it is the one the plan
 * still needs. */
function EmailPlan({ sector, template, schedules, actor, onConnect, onEdit, onBack, onSchedules, onRemoveSchedule }: {
  sector: string;
  template: Template;
  schedules: OutputSchedule[];
  actor: string;
  onConnect: () => void;
  onEdit: () => void;
  onBack: () => void;
  onSchedules: (next: OutputSchedule[]) => boolean;
  onRemoveSchedule: (id: string) => boolean;
}) {
  const [, theme] = useStyletron();
  /* ── THE DESTINATION READS THE LIVE MAILBOX (FEED-IA §247.2) ──────────────────────────────
     «always we havbe to be super consistent and not fget people igo confusing menus when they
      shouldnt see them» — Peter, 11 Sept 2026.
     This row used to decide from `railWorld`'s `config.mailbox` draft, so a workspace holding a
     live authorized mailbox read «Sending email is ready to connect» here while Connections, the
     connected inbox, the customer sheet and the composer all read Connected. It reads the one
     capability every other email entrance reads, and where a mailbox is still to come it shows
     that same one picture and that same one act. */
  const mailbox = useEmailCapability();
  /* Prep is an overlay, so the act closes it first and then opens the walk every other entrance
     opens — the canonical email door rather than the Administration index. */
  const openEmailSetup = () => { onConnect(); window.location.hash = CONNECTIONS_EMAIL_HASH; };
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [persistenceError, setPersistenceError] = React.useState('');
  const copy = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary };
  const mail = emailArm(template);
  const schedule = schedules.find((entry) => entry.outputId === template.id && entry.status !== 'cancelled');
  const scheduleActivity = schedules.filter((entry) => entry.outputId === template.id);
  const scheduleFailure = (message: string) => { setNotice(''); setPersistenceError(message); return false; };
  const persistSchedule = () => {
    if (!mail?.recipients.trim()) { setPersistenceError(''); setNotice('Add a recipient address before scheduling.'); return false; }
    const next = scheduleFor(template, actor, schedule);
    if (!onSchedules([...schedules.filter((entry) => entry.outputId !== template.id || entry.status === 'cancelled'), next])) {
      return scheduleFailure('Saving this schedule stalled. The reviewed draft is still here.');
    }
    setPersistenceError('');
    setNotice(`${template.name} is prepared. It runs once email delivery is activated.`);
    return true;
  };
  const changeStatus = (status: 'prepared' | 'paused') => {
    if (!schedule) return false;
    if (!onSchedules(schedules.map((entry) => entry.scheduleId === schedule.scheduleId ? { ...entry, status, updatedAt: new Date().toISOString(), updatedBy: actor } : entry))) {
      return scheduleFailure(`${status === 'paused' ? 'Pausing' : 'Resuming'} this schedule stalled. It stands as it was.`);
    }
    setPersistenceError('');
    return true;
  };
  const saveSchedule = (next: OutputSchedule) => {
    if (!onSchedules(schedules.map((entry) => entry.scheduleId === next.scheduleId ? next : entry))) {
      return scheduleFailure('Saving this schedule stalled. Your changes are still here.');
    }
    setPersistenceError('');
    setEditingSchedule(false);
    setNotice(`${next.outputSnapshot.title} schedule plan updated.`);
    return true;
  };
  const removeSchedule = () => onRemoveSchedule(template.id) ? (setPersistenceError(''), true) : scheduleFailure('Removing this schedule stalled. The prepared plan is still here.');
  const needsReview = Boolean(mail?.reviewRule) && mail?.reviewRule !== 'Send directly';
  const stale = schedule && schedule.outputRevision !== templateStampOf(scheduledCopyOf(template));
  /* ── WHEN A PREPARED PLAN RUNS, ON THE MAILBOX THIS WORKSPACE HOLDS (FEED-IA §247.2) ───────
     ⚠ 14 September 2026 · this line read `railWorld`'s `email` rail — `connected` and `configured`,
     both of them the constant `false` since `config.mailbox` was retired — so a workspace holding a
     live authorized mailbox read «Prepared · Connect email to activate» directly under the panel
     above, which named that mailbox and said «Connected». It reads `mailbox.posture` now, the same
     answer the panel states. The middle branch went with the rail: «Provider activation required»
     described the retired Settings draft and no posture can reach it.
     `nextRunWords` keeps its own hedge — the mailbox is connected and the SENDER is the runtime's,
     so a prepared plan states the hour it is due after activation rather than promising a send. */
  const activation = schedule ? mailbox.posture === 'ready' ? nextRunWords(schedule) : 'Connect email to activate' : '';
  const state = schedule
    ? `${schedule.status === 'paused' ? 'Prepared · paused' : stale ? 'Prepared with earlier template settings' : 'Prepared'} · ${schedule.status === 'paused' ? 'Plan paused' : activation}`
    : needsReview ? `Pre-send review · ${mail?.reviewRule}` : 'Ready to prepare';
  // There is no invented success row: only provider receipts (or explicitly marked proof fixtures)
  // written against this template appear here.
  const history = historyOpen ? readEmailProviderReceipts(sector).filter((receipt) => receipt.outputId === template.id) : [];
  return <section data-testid="export-email-destination" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, width: '100%', maxWidth: '960px', margin: '0 auto', minWidth: 0 }}>
    <PreviewHead title={template.name} onBack={onBack} />
    <div data-testid="export-email-connection" data-email-posture={mailbox.posture} style={{ display: mailbox.posture === 'ready' ? 'flex' : 'grid', justifyContent: mailbox.posture === 'ready' ? 'space-between' : undefined, justifyItems: mailbox.posture === 'ready' ? undefined : 'center', alignItems: 'center', gap: theme.sizing.scale500, flexWrap: 'wrap', padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundSecondary }}>
      <span style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0, textAlign: mailbox.posture === 'ready' ? undefined : 'center' }}><span style={{ ...theme.typography.LabelMedium }}>Scheduled email</span>{mailbox.posture === 'ready' && <span style={copy}>{`${emailCardWords(mailbox)} · ${emailStatusWord(mailbox.posture)}`}</span>}</span>
      {mailbox.posture !== 'ready' && <EmailSetupState onOpenSetup={openEmailSetup} size={144} />}
    </div>
    <section data-testid="export-email-objects" style={{ display: 'grid', gap: theme.sizing.scale500, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400 }}>
      <div style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0 }}><span style={{ ...theme.typography.LabelLarge }}>{template.name}</span><span data-testid="export-email-state" style={copy}>{state}</span></div>
      <OutputChips chips={[template.selection.scope, ...template.selection.chips, ...(mail ? [mail.recipients, mail.timing, mail.attachments].filter(Boolean) : [])]} />
      <div style={{ display: 'flex', gap: theme.sizing.scale500, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button kind={KIND.primary} size={SIZE.compact} data-testid={`export-run-${template.id}`} startEnhancer={<Glyph id="clock" size={STEP.small} />} onClick={() => { if (schedule) setEditingSchedule(true); else if (needsReview) setReviewOpen(true); else persistSchedule(); }} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{schedule ? 'Edit schedule' : needsReview ? 'Review & prepare' : 'Prepare schedule'}</Button>
        <Button kind={KIND.secondary} size={SIZE.compact} data-testid="export-email-history" aria-label={`Send history for ${template.name}`} onClick={() => setHistoryOpen(true)} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Send history</Button>
        <Button kind={KIND.secondary} size={SIZE.compact} data-testid={`export-edit-${template.id}`} onClick={onEdit} startEnhancer={<Glyph id="edit" size={STEP.small} />} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Edit</Button>
        {schedule?.status === 'paused' ? <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Resume" onClick={() => changeStatus('prepared')} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Resume</Button> : schedule ? <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Pause" onClick={() => changeStatus('paused')} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Pause</Button> : null}
        {schedule && <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Remove schedule" onClick={removeSchedule} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Remove schedule</Button>}
      </div>
    </section>
    {editingSchedule && schedule && <ScheduleEditor template={template} schedule={schedule} actor={actor} onSave={saveSchedule} onBack={() => setEditingSchedule(false)} />}
    {scheduleActivity.length > 0 && <section data-testid="export-schedule" aria-label="Email schedule plans" style={{ display: 'grid', gap: theme.sizing.scale300, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400 }}><span style={{ ...theme.typography.LabelMedium }}>Schedule activity</span>{scheduleActivity.map((entry) => <div key={entry.scheduleId} data-schedule-row={entry.scheduleId} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale500, flexWrap: 'wrap', paddingTop: theme.sizing.scale300, borderTop: `1px solid ${theme.colors.borderOpaque}`, ...theme.typography.ParagraphXSmall }}><span>{entry.outputSnapshot.title} · {entry.recipients}</span><span style={{ color: theme.colors.contentSecondary }}>{entry.status === 'cancelled' ? 'Cancelled' : entry.status === 'paused' ? 'Prepared · paused' : mailbox.posture === 'ready' ? `Prepared · ${nextRunWords(entry)}` : 'Prepared · connect email to activate'}</span></div>)}</section>}
    {reviewOpen && <section data-testid="export-email-review" style={{ display: 'grid', gap: theme.sizing.scale500, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.warning}`, borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundSecondary }}><div style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelMedium }}>Pre-send review</span><div data-testid="export-email-final-draft" style={{ display: 'grid', gap: theme.sizing.scale100, padding: theme.sizing.scale500, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundPrimary, ...theme.typography.ParagraphXSmall }}><span style={{ ...theme.typography.LabelSmall }}>Final draft</span><span>To · {mail?.recipients || 'Recipient to choose'}</span><span>Subject · {template.name}</span><span>Attachment · {mail?.attachments || 'Attachment to choose'}</span><span>Send · {mail?.timing || 'Time to choose'} · {mail?.timezone || 'Timezone to choose'}</span></div><span data-testid="export-email-review-note" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Review note · New or unusual items are held here for confirmation before scheduling.</span></div><span style={{ display: 'flex', gap: theme.sizing.scale500, justifyContent: 'flex-end' }}><Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setReviewOpen(false)} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Back</Button><Button kind={KIND.primary} size={SIZE.compact} onClick={() => { if (persistSchedule()) setReviewOpen(false); }} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Save schedule</Button></span></section>}
    {historyOpen && <section data-testid="export-send-history" style={{ display: 'grid', gap: theme.sizing.scale500, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500 }}><Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Back to the schedule" onClick={() => setHistoryOpen(false)} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="back" size={STEP.small} /></Button><span style={{ ...theme.typography.LabelMedium, flex: 1 }}>Send history</span></div>{history.length ? <div style={{ display: 'grid', gap: theme.sizing.scale100 }}>{history.map((receipt) => <article key={receipt.receiptId} data-provider-receipt={receipt.receiptId} data-status={receipt.status} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: theme.sizing.scale500, padding: theme.sizing.scale500, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary }}><span style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0 }}><span style={{ ...theme.typography.LabelSmall }}>{receipt.recipient}</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{new Date(receipt.at).toLocaleString()} · {receipt.provider}{receipt.detail ? ` · ${receipt.detail}` : ''}</span></span><span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale100, ...theme.typography.LabelXSmall, color: receipt.status === 'failed' ? theme.colors.negative : theme.colors.positive }}>{/* THE MARK THIS ROW IS ACCEPTED UNDER (restored 2026-09-11). `readEmailProviderReceipts` takes a
                local row ONLY when it says `fixture: true`, on the stated grounds that browser state may never
                manufacture an unmarked «Delivered» — and the word that carried that promise on screen was lost in
                55f553d2, so a design fixture has been reading as a provider receipt ever since. `drive-189` asserts
                it and could not see it: the walk stopped at the library door before reaching this row. */}
              {receipt.fixture && <span>Demo</span>}{receipt.status === 'failed' ? 'Failed' : 'Delivered'}</span></article>)}</div> : <span style={copy}>Sends show here.</span>}</section>}
    {persistenceError && <span role="alert" data-testid="export-email-persistence-error" style={{ ...copy, color: theme.colors.negative }}>{persistenceError}</span>}
    {notice && <span role="status" style={copy}>{notice}</span>}
  </section>;
}

/** ONE MARK PER CATEGORY, everywhere the category appears — the library row's paperless seat, the
 *  editor's preview tile and the «New template» rows all read this one table (§30's rule). */
const CATEGORY_MARK: Record<OutputCategory, GlyphId> = {
  albaran: 'doc', packing: PACKING_MARK, 'day-sheet': 'van', file: 'file', email: 'email',
};

/* ── «NEW TEMPLATE» · THE FIRST ROAD IN (OUT-01.6) ────────────────────────────────────────────
 * Five rows, each naming what that category prints, with the real paper drawn beside it. Choosing
 * one creates a template pre-filled with that category's shipped defaults and lands on the editor
 * with the name field focused.
 *
 * This replaces the seed gallery and its FOUR «Use template» doors. `better-writing` · CONSISTENT
 * FLOW VOCABULARY: one destination reached by one word, and the word names what the press makes.
 */
function CategoryPicker({ onBack, onCreate }: { onBack: () => void; onCreate: (category: OutputCategory) => void }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { day: paperDay, sales: paperSales } = React.useContext(PaperDay);
  const copy = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary };
  const height = phone ? 56 : 72;
  const width = Math.round(height * 210 / 297);
  return <section data-testid="export-category-picker" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, width: '100%', maxWidth: '760px', margin: '0 auto', minWidth: 0 }}>
    <PreviewHead title="New template" onBack={onBack} />
    <span style={copy}>Start from the kind of document this template prints. Everything on it is yours to edit.</span>
    <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
      {TEMPLATE_CATEGORIES.map((category) => {
        const paperKind = PAPER_KIND_OF[category];
        return <button
          key={category}
          type="button"
          data-testid={`export-category-${category}`}
          onClick={() => onCreate(category)}
          style={{
            display: 'grid', gridTemplateColumns: `${width}px minmax(0, 1fr)`, alignItems: 'center',
            columnGap: theme.sizing.scale600, textAlign: 'left', minHeight: '88px', width: '100%',
            padding: theme.sizing.scale300, border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary,
            color: theme.colors.contentPrimary, cursor: 'pointer',
          }}
        >
          <span style={{ display: 'inline-flex', overflow: 'hidden', borderRadius: theme.borders.radius200, outline: `1px solid ${PAPER_OUTLINE}`, outlineOffset: '-1px' }}>
            {paperKind
              ? <PaperMiniature kind={paperKind} day={paperDay} sales={paperSales} height={height} />
              : <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: `${width}px`, height: `${height}px`, color: theme.colors.contentSecondary, backgroundColor: theme.colors.backgroundSecondary }}><Glyph id={CATEGORY_MARK[category]} size={STEP.medium} /></span>}
          </span>
          <span style={{ display: 'grid', gap: theme.sizing.scale300, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelLarge }}>{CATEGORY_PLURALS[category]}</span>
            <span style={{ ...copy, ...theme.typography.ParagraphXSmall, overflowWrap: 'anywhere' }}>{CATEGORY_NOTES[category]}</span>
          </span>
        </button>;
      })}
    </div>
  </section>;
}

/* ── THE TEMPLATE'S EDIT POSTURE (OUT-04.2, standing in until E200.03's print screen) ─────────
 * Every control writes to a draft of the TEMPLATE and «Save template» writes it, raising the
 * revision (OUT-01.7). This is the configuration form the export centre already had, with its one
 * remaining lie removed: it edited a COPY of a fixed seed, and it edits the template itself now.
 *
 * THE SEAM E200.03 REPLACES is `onOpenPrintScreen` at every door that reaches here — the library
 * row's «Edit» and «Preview», and the day tile's paper seat. When the print screen lands, those
 * doors are unchanged and this form becomes its Edit mode.
 */
function TemplateEditor({ template, onBack, onSave, onRemove }: {
  template: Template;
  onBack: () => void;
  onSave: (next: Template) => boolean;
  onRemove?: () => boolean;
}) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  /* THE SCHEDULE'S OWN CONDITION, READ LIVE (FEED-IA §247.2). The note under «Pre-send review»
     used to read `railWorld`'s retired `email` rail, so it stood on every workspace — including
     one whose mailbox this form's own Schedule screen was calling Connected. */
  const mailbox = useEmailCapability();
  const cast = derived.cast;
  const workspaceCapabilities = useWorkspaceCapabilities();
  const priced = workspaceCapabilities.pricing && derived.albaran.valued;
  const paperCategory = PAPER_CATEGORIES.includes(template.category);
  const mail = emailArm(template);
  const file = fileArm(template);
  const categories = categoryOptions(cast.sector, cast.products);
  const categoryChips = categories.map((category) => `Category · ${category.name}`);
  const skuChips = cast.products.map(productChip);
  const fileColumnChoices = availableFileColumns(priced);
  const initialTiming = mail?.timing ?? 'Daily at 09:00';
  const initialTime = initialTiming.match(/(?:Daily at|At) (\d{2}:\d{2})/)?.[1] ?? '09:00';
  const nameField = React.useRef<HTMLInputElement>(null);
  const [title, setTitle] = React.useState(template.name);
  const [scope, setScope] = React.useState<OutputScope>(template.selection.scope);
  const [chips, setChips] = React.useState<string[]>(template.selection.chips.length ? template.selection.chips : ['All products']);
  const [paper, setPaper] = React.useState<'A4' | 'A5'>(template.paper ?? 'A4');
  const [copies, setCopies] = React.useState<1 | 2 | 3>(template.copies ?? 1);
  /* THE LAYOUT IS THE TEMPLATE'S OWN RECORD, never a word chosen from three. What stands here is
     what `printProfileOf` hands the renderer, so the row's line and the paper agree. */
  const [layout, setLayout] = React.useState<TemplateLayout>(template.layout);
  const [recipients, setRecipients] = React.useState(mail?.recipients ?? '');
  const [cadence, setCadence] = React.useState<'daily' | 'delivery'>(initialTiming === 'At delivery time' ? 'delivery' : 'daily');
  const [scheduleTime, setScheduleTime] = React.useState(initialTime);
  const [timezone] = React.useState(mail?.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
  const [attachments, setAttachments] = React.useState(mail?.attachments || 'Delivery notes');
  const [reviewRule, setReviewRule] = React.useState(mail?.reviewRule || (template.seed === 'copilot-email' ? 'Review every send' : 'Send directly'));
  const [fileName, setFileName] = React.useState(file?.fileName ?? 'orders');
  const [fileColumns, setFileColumns] = React.useState<string[]>((file?.columns ?? ['Customer', 'Product', 'Quantity']).filter((column) => fileColumnChoices.includes(column)));
  const [fileColumnLabels, setFileColumnLabels] = React.useState<Record<string, string>>(file?.columnLabels ?? Object.fromEntries((file?.columns ?? ['Customer', 'Product', 'Quantity']).map((column) => [column, column])));
  const [saveError, setSaveError] = React.useState('');
  /* A TEMPLATE THAT HAS JUST BEEN MADE OPENS ON ITS NAME (OUT-01.6): a person naming the thing
     they asked for is the first act, and the field they need is the one that takes focus. */
  React.useEffect(() => { if (template.revision === 1 && !template.lastUsedAt) nameField.current?.focus(); }, [template.id, template.revision, template.lastUsedAt]);
  const option = (selected: boolean, label: string, onClick: () => void) => <Button kind={selected ? KIND.primary : KIND.secondary} shape={SHAPE.pill} size={SIZE.mini} onClick={onClick} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{label}</Button>;
  const flipChip = (chip: string) => setChips((current) => {
    if (chip === 'All products') return current.includes(chip) ? [] : ['All products'];
    const withoutAll = current.filter((value) => value !== 'All products');
    return withoutAll.includes(chip) ? withoutAll.filter((value) => value !== chip) : [...withoutAll, chip];
  });
  const timing = cadence === 'daily' ? `Daily at ${scheduleTime}` : 'At delivery time';
  const selectedFileColumns = fileColumns.length ? fileColumns : fileColumnChoices.filter((column) => column !== 'Unit price');
  const nextLayout = (): TemplateLayout => template.category === 'file'
    ? { kind: 'file', format: 'CSV', columns: selectedFileColumns, columnLabels: fileColumnLabels, fileName: fileName.trim() || 'orders' }
    : template.category === 'email'
      ? { kind: 'email', recipients: recipients.trim(), timing, timezone, attachments, reviewRule }
      : layout;
  return <section data-testid="export-output-configuration" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, width: '100%', maxWidth: '680px', margin: '0 auto', minWidth: 0 }}>
    <PreviewHead title={`Edit ${template.name}`} onBack={onBack} />
    <OutputPreviewTile icon={CATEGORY_MARK[template.category]} provider={template.provider ?? 'Rocoto'} kind={KIND_OF_CATEGORY[template.category]} title={title} recipient={recipients} attachment={attachments} columns={template.category === 'file' ? fileColumnsOf(selectedFileColumns, priced).map((column) => fileColumnLabels[column] || column) : undefined} paper={PAPER_KIND_OF[template.category]} paperSize={paper} accent />
    <label style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Name</span><Input inputRef={nameField} value={title} onChange={(event) => setTitle(event.currentTarget.value)} aria-label="Template name" /></label>
    <section style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Scope</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>{option(scope === 'Current selection', 'Current selection', () => setScope('Current selection'))}{option(scope === 'All salespeople', 'All salespeople', () => setScope('All salespeople'))}</span></section>
    <section data-testid="export-product-scope" style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>{template.category === 'email' ? 'Include' : 'Products'}</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>{option(chips.includes('All products'), 'All products', () => flipChip('All products'))}{categoryChips.map((chip) => option(chips.includes(chip), chip, () => flipChip(chip)))}</span></section>
    <section data-testid="export-sku-selector" style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Specific products</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>{skuChips.map((chip) => option(chips.includes(chip), chip, () => flipChip(chip)))}</span></section>
    {paperCategory && <><section style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Paper &amp; copies</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>{option(paper === 'A4', 'A4', () => setPaper('A4'))}{option(paper === 'A5', 'A5', () => setPaper('A5'))}{([1, 2, 3] as const).map((value) => option(copies === value, value === 1 ? '1 copy' : `${value} copies`, () => setCopies(value)))}</span></section><TemplateLayoutFields layout={layout} valued={priced} onChange={setLayout} />{template.category === 'packing' && <span data-testid="export-packing-mark-fact" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Carries the capture mark, so a photograph of this sheet reads back to the day it printed.</span>}</>}
    {template.category === 'file' && <><section style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>File format</span><span data-testid="export-file-format-csv" style={{ ...theme.typography.LabelSmall }}>CSV</span></section><label style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>File name</span><Input value={fileName} onChange={(event) => setFileName(event.currentTarget.value)} aria-label="File name" /></label><FileColumnBuilder available={fileColumnChoices} selected={fileColumns} labels={fileColumnLabels} onChange={(columns, labels) => { setFileColumns(columns); setFileColumnLabels(labels); }} /></>}
    {template.category === 'email' && <><label style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Recipient address</span><Input value={recipients} onChange={(event) => setRecipients(event.currentTarget.value)} aria-label="Recipient address" placeholder="recipient@example.com" /></label><section style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Cadence</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>{option(cadence === 'daily', 'Daily', () => setCadence('daily'))}{option(cadence === 'delivery', 'With delivery', () => setCadence('delivery'))}</span></section>{cadence === 'daily' && <label style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Send time</span><Input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.currentTarget.value)} aria-label="Send time" /></label>}<span data-testid="export-schedule-timezone" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Timezone · {timezone}</span><section style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Attachment</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>{['Delivery notes', 'Packing sheets', 'Both'].map((value) => option(attachments === value, value, () => setAttachments(value)))}</span></section><section style={{ display: 'grid', gap: theme.sizing.scale300 }}><span style={{ ...theme.typography.LabelSmall }}>Pre-send review</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>{['Send directly', 'Review new products', 'Review before first send', 'Review every send'].map((value) => option(reviewRule === value, value, () => setReviewRule(value)))}</span>{template.seed === 'copilot-email' && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Keep this template your own. Review its draft before each schedule.</span>}{mailbox.posture !== 'ready' && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Connect email to let this schedule run.</span>}</section></>}
    {saveError && <span role="alert" data-testid="export-output-save-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{saveError}</span>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale500, flexWrap: 'wrap', paddingTop: theme.sizing.scale500, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
      <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onBack} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Cancel</Button>
      {onRemove && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-remove-template" aria-label={`Remove ${template.name}`} onClick={() => { if (!onRemove()) setSaveError('Removing this template stalled. It is still here.'); }} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Remove template</Button>}
      <Button kind={KIND.primary} size={SIZE.compact} data-testid="export-save-output" onClick={() => {
        const at = new Date().toISOString();
        const next = savedTemplate(template, {
          name: title.trim().slice(0, 48) || template.name,
          paper: paperCategory ? paper : undefined,
          copies: paperCategory ? copies : undefined,
          layout: nextLayout(),
          selection: { scope, chips: chips.length ? chips : ['All products'] },
        }, at, 'Current user');
        if (!onSave(next)) setSaveError('Saving this template stalled. Your changes are here.');
      }} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Save template</Button>
    </div>
  </section>;
}

/* ── THE EXPORT CENTRE IS THE LIBRARY (THE-OUTPUTS-SPEC OUT-02 · FEED-IA §202.5) ──────────────
 *
 * «currently thr place where the templates button is weird and the feel of the whole export thing
 *  can be improved. shpuld be obvious where to tap to edit the ones they have saved to their
 *  library.»
 *
 * WHAT WENT, AND WHY EACH ONE WENT.
 *
 *   · THE THREE DESTINATION TABS — Print · Email · Files. Their job was to sort outputs by where
 *     they go, and a CATEGORY already says that, on the row itself. What replaces them is one
 *     scrolling column of category sections, which is also what lets a house with nine templates
 *     read its library in one glance.
 *   · THE HEAD'S «Templates» DOOR, which sat in the chrome beside Close — a library's own door
 *     filed with «leave» rather than with «this is what you own» (`better-layout` · ORDER BY
 *     IMPORTANCE), and a navigation control sharing one 6 px gap with a dismissal control
 *     (`better-accessibility` · BREATHING ROOM BETWEEN TARGETS).
 *   · THE FOUR «Use template» DOORS. One destination wore two vocabularies, and the verb-first
 *     label promised a document where the action was «open the library» (`better-writing` ·
 *     CONSISTENT FLOW VOCABULARY, VERB-FIRST BUTTONS). One control replaces all four, at the top
 *     of the library, and it is called «New template» because that is what it makes.
 *
 * A SECTION PER CATEGORY, in the order OUT-02.3 states, each keeping its heading when it holds
 * nothing so a person meets the category before they own one (`better-writing` · EMPTY STATES
 * POINT FORWARD). A ROW PER TEMPLATE. And a foot that holds what the library owns but is not a
 * template: what was archived, the default a NEW template starts from, and the two activities.
 */
function TemplateLibrary({ sales, fileSales, templates, sector, day, state, setup, now, jobs, cast, derived, emailFeed, onSetup, actor, schedules, onSchedules, onRemoveSchedule, onConfigureEmail, onNewTemplate, onNewInCategory, onOpenPrintScreen, onWriteTemplates }: {
  sector: SectorId; sales: Sale[]; fileSales: Sale[]; templates: Template[]; day: string; state: ExportState; setup: PrintSetup; now: string; jobs: PrintJob[];
  cast: Cast; derived: Derived; emailFeed: { connected: boolean; address: string }; actor: string;
  onSetup: () => void;
  onConfigureEmail: () => void;
  schedules: OutputSchedule[];
  onSchedules: (next: OutputSchedule[]) => boolean;
  onRemoveSchedule: (id: string) => boolean;
  /** «New template» · the category picker (OUT-01.6). */
  onNewTemplate: () => void;
  /** The door INSIDE a category makes one OF that category, so a person who has already chosen by
   *  standing in the section is never asked to choose again (`better-writing` · EMPTY STATES POINT
   *  FORWARD — one clear next action, and it lands where they are). */
  onNewInCategory: (category: OutputCategory) => void;
  /** THE ONE SEAM E200.03 REPLACES (OUT-04): «Preview» and «Edit» are two modes of one screen, and
   *  every door in this library already calls the one function. */
  onOpenPrintScreen: (template: Template, mode: 'preview' | 'edit') => void;
  /** The store, through `writeTemplates`. `false` says it stalled and the surface says so. */
  onWriteTemplates: (next: Template[]) => boolean;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const workspaceCapabilities = useWorkspaceCapabilities();
  /* A DAY TILE THAT HOLDS A FILE OR AN EMAIL TEMPLATE OPENS THIS LIBRARY ON THAT TEMPLATE'S OWN
     SCREEN (OUT-03.3). The cell is read once, on the render the panel mounts in, so a person who
     pressed «Order file» on the day lands on the file rather than on a list to find it in. */
  const [asked] = React.useState<string | null>(() => takePendingTemplate());
  const [activeFileTemplate, setActiveFileTemplate] = React.useState<Template | null>(
    () => (asked ? templates.find((template) => template.id === asked && template.category === 'file') ?? null : null));
  const [activeEmailTemplate, setActiveEmailTemplate] = React.useState<Template | null>(
    () => (asked ? templates.find((template) => template.id === asked && template.category === 'email') ?? null : null));
  const [seatFor, setSeatFor] = React.useState<Template | null>(null);
  const [query, setQuery] = React.useState('');
  const [fileNotice, setFileNotice] = React.useState('');
  const [fileNoticeError, setFileNoticeError] = React.useState(false);
  const [recentFiles, setRecentFiles] = React.useState<FileDownloadRecord[]>(() => fileDownloadHistory(sector));
  const [fileSearch, setFileSearch] = React.useState('');
  const [fileDate, setFileDate] = React.useState<'all' | 'today' | 'week'>('all');
  const [fileType, setFileType] = React.useState<'all' | 'CSV'>('all');
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [recentOpen, setRecentOpen] = React.useState(false);
  const [printNotice, setPrintNotice] = React.useState('');
  const [objectError, setObjectError] = React.useState('');
  /* WHAT THE PRINTER SEES IS THE TEMPLATE'S OWN RECORD (OUT-01.3). Until E200 every print read one
     house-wide profile no shipped screen could change; now each run freezes the layout of the
     template it came from, with this day's lifetime values folded in where the sort asks for them. */
  const capturedProfileOf = React.useCallback((template: Template) => withLifetimeValues(printProfileOf(template), fileSales), [fileSales]);
  const held = new Set(state.review.map((sale) => sale.id));
  const all = sheetSalesOf(sales).filter((sale) => !held.has(sale.id));
  const packingHistory = React.useSyncExternalStore(packingOutputs.subscribe, packingOutputs.getSnapshot, packingOutputs.getSnapshot);
  const pending = jobs.filter((job) => job.state !== 'printed').flatMap((job) => job.packingOutput ?? []);
  const packing = unqueuedPackingSales(remainingPackingSales(all, sector, packingHistory), sector, pending);
  const selectedIds = new Set(sales.filter((sale) => !sale.archived).map((sale) => sale.id));
  const dayJobs = jobs.filter((job) => job.subject.kind === 'albaran' ? selectedIds.has(job.subject.sale) : job.subject.day === day && (job.subject.salesIds ?? []).every((id) => selectedIds.has(id)));
  const sourceAvailable = (job: PrintJob) => job.subject.kind === 'albaran' ? selectedIds.has(job.subject.sale) : (job.subject.salesIds ?? []).every((id) => selectedIds.has(id));
  const requestPrint = async (scope: Sale[], makeOrders: (source: Sale[]) => PrintOrder[], repeat: boolean, template: Template) => {
    if (!scope.length || scope.some((sale) => sale.archived)) { setPrintNotice('Choose something to print.'); return; }
    /* THE TEMPLATE'S PAPER PRINTS, AND THE HOUSE DEFAULT STANDS WHERE IT WAS. Running a saved copy
       used to call `setPrintSetup` here, which rewrote `PrintSetup` for every other print in the
       house — OUT-01.1's third defect. The paper reaches the sheet by being handed to the run's own
       order builder instead. */
    const paper = template.paper ?? 'A4';
    const copies = template.copies ?? 1;
    const profile = capturedProfileOf(template);
    const layoutKey = `${profile.albaran.finalWeight}:${profile.albaran.unitPrice}:${profile.albaran.lineTotal}:${profile.packing.columns}:${profile.packing.sort}`;
    const key = `${sector}:${day}:${template.id}:r${template.revision}:${scope.map((sale) => sale.id).join('|')}:${saleRevisionOf(scope)}:${paper}:${copies}:${layoutKey}`;
    setPrintNotice('Preparing print…');
    const result = await printSourceRun({
      idempotencyKey: repeat ? newPrintAttemptKey(key) : key, title: template.name, cast, derived, sales: scope,
      makeOrders, copies, layoutProfile: profile, template: { id: template.id, revision: template.revision },
    });
    setPrintNotice(result.status === 'dialog-requested' ? 'Print dialog requested · paper awaiting confirmation.' : result.message);
    if (result.status === 'dialog-requested') markUsed(template);
  };
  const confirmAttempt = (job: PrintJob) => {
    if (!sourceAvailable(job)) { setPrintNotice('The source has changed. This request remains in Activity.'); return false; }
    const confirmed = confirmPrintAttempt(job.id, new Date().toISOString(), actor);
    setPrintNotice(confirmed ? 'Print confirmed.' : 'Confirming the print stalled. It stays in Activity.');
    return confirmed;
  };
  const retryAttempt = (job: PrintJob) => {
    if (!job.runKey || job.state !== 'waiting' || !sourceAvailable(job)) return;
    setPrintNotice('Preparing print…');
    void retrySourcePrint(job.runKey, sector).then((result) => setPrintNotice(result.status === 'dialog-requested' ? 'Print dialog requested · paper awaiting confirmation.' : result.message));
  };
  const copy = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary };

  /* ── THE ACTS A ROW ANSWERS TO ────────────────────────────────────────────────────────────
     Every one of them is `writeTemplates` and nothing else: the act is pure, the store is written
     once, and a write that stalls leaves the row standing on the values it holds. */
  const write = (next: Template[], stalled: string) => {
    const saved = onWriteTemplates(next);
    setObjectError(saved ? '' : stalled);
    return saved;
  };
  const stamp = () => new Date().toISOString();
  const markUsed = (template: Template) => onWriteTemplates(templates.map((current) => current.id === template.id ? usedTemplate(current, stamp()) : current));
  const archive = (template: Template) => {
    /* Archiving a template that holds a seat clears the seat in the same write, so the day never
       points at a template the library has put away (OUT-03.2). And a schedule prepared from it is
       cancelled in the same act, so nothing stands ready to send from an archived template. */
    const nextSchedules = schedules.map((entry) => entry.outputId === template.id && entry.status !== 'cancelled' ? { ...entry, status: 'cancelled' as const, nextAt: undefined, updatedAt: stamp(), updatedBy: actor } : entry);
    const changed = nextSchedules.some((entry, index) => entry !== schedules[index]);
    if (changed && !onSchedules(nextSchedules)) { setObjectError('Archiving this template stalled on its schedule. Both stand as they were.'); return false; }
    const saved = write(templates.map((current) => current.id === template.id ? archivedTemplate(current, stamp(), actor) : current), 'Archiving this template stalled. It stands as it was.');
    if (!saved && changed) onSchedules(schedules);
    return saved;
  };
  const restore = (template: Template) => write(templates.map((current) => current.id === template.id ? restoredTemplate(current, stamp(), actor) : current), 'Restoring this template stalled. It stands as it was.');
  const duplicate = (template: Template) => write([...templates, duplicateTemplate(template, stamp(), actor)], 'Duplicating this template stalled. It stands as it was.');
  /* THE TWO-SLOT RULE (OUT-03.2). «Set as day button» takes the first FREE seat; where both are
     held the chooser opens, so a person sees what they are replacing before they replace it. */
  const seats = templateSeats(templates);
  const takeSeat = (template: Template) => {
    const free: TemplateSeat | undefined = seats[0] === undefined ? 0 : seats[1] === undefined ? 1 : undefined;
    if (free === undefined) { setSeatFor(template); return; }
    write(withSeat(templates, template.id, free), 'Putting this template on the day stalled. The day stands as it was.');
  };
  const chooseSeat = (template: Template, seat: TemplateSeat) => {
    if (write(withSeat(templates, template.id, seat), 'Putting this template on the day stalled. The day stands as it was.')) setSeatFor(null);
  };
  const clearSeat = (template: Template) => write(withoutSeat(templates, template.id), 'Taking this template off the day stalled. The day stands as it was.');

  const searchedFiles = recentFiles.filter((record) => {
    const words = `${record.fileName ?? ''} ${record.day} ${record.requestedBy ?? ''}`.toLowerCase();
    const term = fileSearch.trim().toLowerCase();
    const age = Date.now() - new Date(record.at).getTime();
    const dateMatches = fileDate === 'all' || (fileDate === 'today' ? record.day === day : age >= 0 && age <= 7 * 24 * 60 * 60 * 1000);
    const typeMatches = fileType === 'all' || record.format === fileType;
    return (!term || words.includes(term)) && dateMatches && typeMatches;
  });
  React.useEffect(() => { setRecentFiles(fileDownloadHistory(sector)); }, [sector]);
  const clearFileNotice = () => { setFileNotice(''); setFileNoticeError(false); };

  /* ── WHAT A ROW'S PRIMARY ACT IS, PER CATEGORY ────────────────────────────────────────────
     One act each, named by what it does. A paper template prints where it stands; a file template
     opens the file it writes; an email template opens the plan that sends it. A day with nothing
     to act on states that forward — «Ready when orders arrive» (OUT-02.5). */
  const primaryFor = (template: Template) => {
    if (template.category === 'file') return { label: 'Open file', mark: 'file' as GlyphId, onAct: () => { setActiveFileTemplate(template); clearFileNotice(); } };
    if (template.category === 'email') return { label: 'Schedule', mark: 'clock' as GlyphId, onAct: () => setActiveEmailTemplate(template) };
    const isPacking = template.category === 'packing';
    const isDay = template.category === 'day-sheet';
    const scope = isPacking ? packing : isDay ? all : state.toPrint;
    const paper = template.paper ?? 'A4';
    const build = isPacking
      ? (source: Sale[]) => packingRun(day, source, now, paper, sector, capturedProfileOf(template))
      : isDay ? (source: Sale[]) => [daySheetOrder(day, source, now, paper)]
        : (source: Sale[]) => albaranRun(source, now, emailFeed, paper);
    return {
      label: scope.length ? `Print ${scope.length}` : 'Ready when orders arrive',
      mark: 'print' as GlyphId,
      onAct: scope.length ? () => { void requestPrint(scope, build, isDay, template); } : undefined,
    };
  };

  const live = liveTemplates(templates);
  const archived = templates.filter((template) => Boolean(template.archivedAt));
  const term = query.trim().toLowerCase();
  const matches = (template: Template) => !term || `${template.name} ${CATEGORY_PLURALS[template.category]} ${settingsWords(template).join(' ')}`.toLowerCase().includes(term);
  const found = live.filter(matches);
  /* THE SEARCH EARNS ITS SEAT AT SEVEN (OUT-02.3's growth rule). A house on the templates that ship
     reads its whole library in one glance and a field above it would be noise; past six rows the
     glance stops working, so the field appears and the sections stay legible. */
  const searchable = live.length > 6;

  if (activeEmailTemplate) {
    const held = templateById(templates, activeEmailTemplate.id) ?? activeEmailTemplate;
    return <div data-testid="export-day-destinations" style={{ width: '100%', minWidth: 0, maxWidth: '960px', margin: '0 auto' }}>
      <EmailPlan sector={sector} template={held} schedules={schedules} actor={actor} onConnect={onConfigureEmail} onEdit={() => onOpenPrintScreen(held, 'edit')} onBack={() => setActiveEmailTemplate(null)} onSchedules={onSchedules} onRemoveSchedule={onRemoveSchedule} />
    </div>;
  }
  if (activeFileTemplate) {
    const held = templateById(templates, activeFileTemplate.id) ?? activeFileTemplate;
    const arm = fileArm(held);
    /* THE SCREEN DESCRIBES THE FILE THE PRESS SAVES (FEED-IA §246). It read the template's four
       chosen fields while the download wrote six — the delivery number opens every file and the
       delivery total closes it — so the flow offered one artifact and the disk got another. Both
       read `configuredFilePlan` now, which is the same object `downloadConfiguredFile` hands to
       the disk: one head row, stated once. */
    const filePlan = configuredFilePlan(held, fileSales, day, workspaceCapabilities.pricing && derived.albaran.valued);
    return <div data-testid="export-day-destinations" style={{ width: '100%', minWidth: 0, maxWidth: '960px', margin: '0 auto' }}>
      <section data-testid="export-configured-file-flow" style={{ display: 'grid', gap: theme.sizing.scale500 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500 }}><Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Back to the library" onClick={() => { setActiveFileTemplate(null); clearFileNotice(); }} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="back" size={STEP.small} /></Button><Button kind={KIND.secondary} size={SIZE.compact} data-testid={`export-edit-${held.id}`} onClick={() => onOpenPrintScreen(held, 'edit')} startEnhancer={<Glyph id="edit" size={STEP.small} />} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Edit</Button></div>
        <OutputPreviewTile icon="file" provider={held.provider ?? 'CSV'} kind="file" title={held.name} columns={filePlan.head} accent />
        <div style={{ display: 'grid', gap: theme.sizing.scale100 }}><h3 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{held.name}</h3><span data-testid="export-file-columns" style={copy}>{filePlan.format} · {filePlan.head.join(', ')}</span><span data-testid="export-file-measures" style={copy}>{filePlan.fileName} · {byteWords(filePlan.bytes)} · {filePlan.measures.deliveries} {plural(filePlan.measures.deliveries, 'delivery', 'deliveries')}</span></div>
        <OutputChips chips={[held.selection.scope, ...held.selection.chips, filePlan.fileName]} />
        <span><Button kind={KIND.primary} size={SIZE.compact} data-testid="export-download-configured-file" onClick={() => { const result = downloadConfiguredFile(sector, held, fileSales, day, workspaceCapabilities.pricing && derived.albaran.valued, actor); setRecentFiles(fileDownloadHistory(sector)); markUsed(held); setFileNoticeError(!result.activitySaved); setFileNotice(`Saved ${downloadWords(result.fileName, result.bytes)} · ${result.measures.deliveries} ${plural(result.measures.deliveries, 'delivery', 'deliveries')}.${result.activitySaved ? '' : ' Saving the activity stalled.'}`); }} startEnhancer={<Glyph id="file" size={STEP.small} />} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Download file</Button></span>
        {fileNotice && <span role={fileNoticeError ? 'alert' : 'status'} data-testid={fileNoticeError ? 'export-file-history-save-error' : 'export-file-download-status'} style={{ ...copy, color: fileNoticeError ? theme.colors.negative : copy.color }}>{fileNotice}</span>}
      </section>
    </div>;
  }

  const newTemplateAct = (testid: string, kind: typeof KIND.primary | typeof KIND.secondary | typeof KIND.tertiary, category?: OutputCategory) => <Button kind={kind} size={SIZE.compact} data-testid={testid} onClick={() => category ? onNewInCategory(category) : onNewTemplate()} startEnhancer={<Glyph id="plus" size={STEP.small} />} overrides={{ BaseButton: { style: { minHeight: '44px', ...(phone && !category ? { width: '100%', justifyContent: 'center' } : {}) } } }}>New template</Button>;

  return <div data-testid="export-day-destinations" style={{ width: '100%', minWidth: 0, maxWidth: '960px', margin: '0 auto' }}>
    {/* THE LADDER'S TOP STEP (THE-OUTPUTS-SPEC OUT-02 · 8 / 16 / 32). A category section is a
        section, so the air between two of them is the section step — with the row step inside one
        of them at 16 and the lines inside a row at 8, which is what makes the three levels read as
        three rather than as one list of everything. */}
    <section data-testid="export-library" style={{ display: 'grid', gap: theme.sizing.scale900, minWidth: 0 }}>
      {objectError && <span role="alert" data-testid="export-object-persistence-error" style={{ ...copy, color: theme.colors.negative }}>{objectError}</span>}
      {/* THE LIBRARY'S OWN HEAD. «New template» leads it, inset from both edges on the phone
          (`better-layout` · INSET BUTTONS FROM THE EDGES), which the card's own padding gives it. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Your templates</h3>
        {!phone && newTemplateAct('export-new-template', KIND.tertiary)}
      </div>
      {searchable && <Input aria-label="Search your templates" placeholder="Search templates" value={query} onChange={(event) => setQuery(event.currentTarget.value)} clearable overrides={{ Input: { props: { 'data-testid': 'export-library-search' } } }} />}
      {phone && newTemplateAct('export-new-template', KIND.tertiary)}
      {/* A SEARCH THAT LANDS NOTHING POINTS FORWARD AND OFFERS THE WAY BACK (`better-writing` ·
          EMPTY STATES POINT FORWARD). The field above still holds the words that were typed, so the
          line states the next act and the control beside it says what pressing it gives back. */}
      {term && found.length === 0 && <div data-testid="export-library-empty" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
        <span style={copy}>Try another search.</span>
        <Button kind={KIND.secondary} size={SIZE.compact} data-testid="export-library-clear-search" onClick={() => setQuery('')} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{`Show all ${live.length} templates`}</Button>
      </div>}
      {TEMPLATE_CATEGORIES.map((category) => {
        const rows = found.filter((template) => template.category === category);
        if (term && rows.length === 0) return null;
        return <section key={category} data-testid={`export-library-section-${category}`} data-count={rows.length} style={{ display: 'grid', gap: theme.sizing.scale600, minWidth: 0 }}>
          <Disclosure forceOpen={Boolean(term)} title={<span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, flex: 1 }}>
            <Glyph id={CATEGORY_MARK[category]} size={28} />
            <span style={{ ...theme.typography.LabelLarge, flex: 1 }}>{CATEGORY_PLURALS[category]}</span>
            <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>{rows.length}</span>
          </span>}>
          {rows.length
            ? rows.map((template) => <React.Fragment key={template.id}>
              <TemplateRow
                template={template}
                primary={primaryFor(template)}
                /* «PREVIEW» AND «EDIT» ARE TWO MODES OF ONE SCREEN (OUT-04.2), so a paper template
                   hands both doors to `onOpenPrintScreen`. */
                onPreview={PAPER_CATEGORIES.includes(template.category) ? () => onOpenPrintScreen(template, 'preview') : undefined}
                onEdit={() => onOpenPrintScreen(template, 'edit')}
                onDuplicate={() => duplicate(template)}
                onSeat={() => takeSeat(template)}
                onUnseat={() => clearSeat(template)}
                onArchive={() => archive(template)}
              />
              {/* THE CHOOSER STANDS UNDER THE ROW IT IS ABOUT. At the top of a scrolling library it
                  would be an answer to a question asked somewhere off screen. */}
              {seatFor?.id === template.id && <SeatChooser template={template} seats={seats} onChoose={(seat) => chooseSeat(template, seat)} onCancel={() => setSeatFor(null)} />}
            </React.Fragment>)
            : <div data-testid={`export-section-empty-${category}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
                <span style={{ ...copy, maxWidth: '52ch' }}>{CATEGORY_NOTES[category]}</span>
                {newTemplateAct(`export-new-${category}`, KIND.secondary, category)}
              </div>}
          </Disclosure>
        </section>;
      })}
      {/* ── THE FOOT: WHAT THE LIBRARY OWNS THAT IS NOT A TEMPLATE ─────────────────────────── */}
      <section style={{ display: 'grid', gap: theme.sizing.scale600, minWidth: 0 }}>
        <ArchivedTemplates templates={archived} onRestore={restore} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500, flexWrap: 'wrap', paddingTop: theme.sizing.scale300, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
          {/* `PrintSetup`'s meaning, said honestly: it is the paper a NEW template starts from and
              no longer anything a run may rewrite (OUT-01.8). */}
          <span style={copy}>Default for a new template · {setupWords(setup)}</span>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-change-paper" onClick={onSetup} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Change</Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
          <span style={copy}>Print activity · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dayJobs.length}</span></span>
          <StatefulTooltip content={`Activity · ${dayJobs.length}`} placement={TOOLTIP_PLACEMENT.top} showArrow><span><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-print-queue" aria-label={`Print activity · ${dayJobs.length}`} aria-expanded={queueOpen} onClick={() => setQueueOpen((open) => !open)} overrides={{ BaseButton: { style: { minWidth: '44px', minHeight: '44px', paddingLeft: 0, paddingRight: 0 } } }}><Glyph id="clock" size={STEP.small} /></Button></span></StatefulTooltip>
        </div>
        {printNotice && <span role="status" data-testid="export-print-attempt-status" style={copy}>{printNotice}</span>}
        {queueOpen && <div data-testid="print-queue-panel" style={{ maxHeight: '26vh', overflowY: 'auto' }}>{dayJobs.length ? [...dayJobs].reverse().map((job) => <QueueRow key={job.id} job={job} setup={setup} onOpenCopy={(attempt) => { void openCapturedPrintCopy(attempt.id, sector).then((result) => { if (!result.ok) setPrintNotice(result.message); }); }} onConfirm={confirmAttempt} onRetry={retryAttempt} />) : <span style={copy}>Print activity shows here.</span>}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
          <span style={copy}>Recent files · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{recentFiles.length}</span></span>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-recent-files-toggle" aria-expanded={recentOpen} onClick={() => setRecentOpen((open) => !open)} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{recentOpen ? 'Hide' : 'Show'}</Button>
        </div>
        {recentOpen && <section data-testid="export-recent-files" style={{ display: 'grid', gap: theme.sizing.scale500 }}>
          <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(220px, 1fr) 170px 150px', gap: theme.sizing.scale300, alignItems: 'center', minWidth: 0 }}>
            <div style={{ gridColumn: phone ? '1 / -1' : undefined, minWidth: 0 }}><Input data-testid="export-recent-search" aria-label="Search recent files" placeholder="Search files" value={fileSearch} onChange={(event) => setFileSearch(event.currentTarget.value)} /></div>
            <Select data-testid="export-recent-date" aria-label="Filter recent files by date" clearable={false} searchable={false} size={SELECT_SIZE.compact} overrides={{ ControlContainer: { style: { minHeight: '44px' } } }} options={[{ id: 'all', label: 'All dates' }, { id: 'today', label: 'Today' }, { id: 'week', label: 'Last 7 days' }]} value={[{ id: fileDate, label: fileDate === 'all' ? 'All dates' : fileDate === 'today' ? 'Today' : 'Last 7 days' }]} onChange={({ value }) => { if (value[0]) setFileDate(String(value[0].id) as typeof fileDate); }} />
            <Select data-testid="export-recent-type" aria-label="Filter recent files by type" clearable={false} searchable={false} size={SELECT_SIZE.compact} overrides={{ ControlContainer: { style: { minHeight: '44px' } } }} options={[{ id: 'all', label: 'All types' }, { id: 'CSV', label: 'CSV' }]} value={[{ id: fileType, label: fileType === 'all' ? 'All types' : 'CSV' }]} onChange={({ value }) => { if (value[0]) setFileType(String(value[0].id) as typeof fileType); }} />
          </div>
          {searchedFiles.length ? <div data-testid="export-recent-file-list" style={{ display: 'grid', gap: theme.sizing.scale100 }}>{searchedFiles.map((record, index) => <article key={`${record.at}-${record.outputId ?? index}`} data-recent-file={record.fileName ?? record.day} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale500, padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary, minWidth: 0 }}><span style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0 }}><span style={{ ...theme.typography.LabelSmall, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.fileName ?? `orders-${record.day}.csv`}</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>{new Date(record.at).toLocaleString()} · {record.rows} {plural(record.rows, 'delivery', 'deliveries')}{typeof record.bytes === 'number' ? ` · ${byteWords(record.bytes)}` : ''}{record.requestedBy ? ` · ${record.requestedBy}` : ''}</span></span><span data-recent-file-bytes={record.bytes ?? ''} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{record.format ?? 'CSV'} · Requested</span></article>)}</div> : <span style={copy}>Try another search.</span>}
        </section>}
      </section>
    </section>
  </div>;
}

/* ── THE CENTRE ───────────────────────────────────────────────────────────────────────────────
 * The three rails, in the order §35.3 names them: print first because paper is the trade, then the
 * house's own system, then the customer's copy.
 */

type View = 'days' | 'rails' | 'templates' | 'paper' | 'packing' | 'sheet' | 'file' | 'mail' | 'new-template' | 'template-edit';

/* ── THE THREE PAPERS, AS A CHOICE (FEED-IA §129.2) ───────────────────────────────────────────
 * «You select the TYPE of print then the thing on the list.» So the question the centre opens with
 * has two halves and they are asked in his order: WHICH PAPER first, WHICH DAY second. The type is
 * a fixed register of three — the same three the printer's own region below draws — and every one
 * of them keeps the mark that says where its paper goes (§54.4), because HERE the destinations
 * really are three different places and the mark is what tells them apart.
 */
/* ONE VOCABULARY OF PAPERS. `PaperKind` is `printthumbnail.tsx`'s, because the thing that DRAWS
   the three papers is the thing that should say how many there are; this list names them. */
const PAPERS: Array<{ id: PaperKind; word: string; mark: GlyphId; to: string }> = [
  { id: 'albaranes', word: 'Delivery Notes', mark: 'print' as GlyphId, to: 'With the goods' },
  { id: 'packing', word: 'Packing lists', mark: PACKING_MARK, to: 'For the bay' },
  { id: 'sheet', word: 'The day’s sheet', mark: 'van' as GlyphId, to: 'With the van' },
];
type PreviewView = Exclude<View, 'days' | 'rails'>;
type ReaderOrigin = 'days' | 'rails';

type ExportScopeFilterProps = {
  people: Array<{ id: string; name: string }>;
  value: string;
  onApply: (person: string) => void;
};

/** A long people list gets its own screen. The draft only reaches Prep when Apply is pressed. */
function ExportScopeFilters({ people, value, onApply }: ExportScopeFilterProps) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const placement = useWorkflowPlacement();
  const visualHeight = useWorkflowViewport(open);
  const person = people.find(candidate => candidate.id === value);
  const activeCount = value === 'all' ? 0 : 1;
  const choice = (selected: boolean) => ({
    width: '100%', minHeight: '44px', justifyContent: 'flex-start', textAlign: 'left' as const,
    paddingLeft: theme.sizing.scale300, paddingRight: theme.sizing.scale300, cursor: 'default',
    borderRadius: theme.borders.radius200,
    backgroundColor: selected ? theme.colors.backgroundSecondary : 'transparent',
    ':hover': { backgroundColor: theme.colors.backgroundSecondary },
    ':focus-visible': { outline: `2px solid ${theme.colors.accent}`, outlineOffset: '2px' },
  });
  return <>
    <Button kind={activeCount ? KIND.secondary : KIND.tertiary} size={SIZE.compact} data-testid="export-filters" aria-label={activeCount ? `Salespeople · ${person?.name}` : 'Salespeople'} startEnhancer={<Glyph id="team" size={STEP.small} />} endEnhancer={activeCount ? <span data-testid="export-filter-count" aria-label={`${activeCount} active filter`} style={{ minWidth: '18px', height: '18px', display: 'inline-grid', placeItems: 'center', borderRadius: '50%', backgroundColor: theme.colors.contentPrimary, color: theme.colors.backgroundPrimary, ...theme.typography.LabelXSmall }}>{activeCount}</span> : undefined} onClick={() => { setDraft(value); setOpen(true); }}>{activeCount ? person?.name : 'Salespeople'}</Button>
    <OverlayCard isOpen={open} onClose={() => setOpen(false)} size={800} placement={placement} ariaLabel="Choose salespeople" overrides={workflowCardOverrides({ expanded: true, visualHeight })}>
      <WorkflowContent title="Salespeople" onClose={() => setOpen(false)} onBack={() => setOpen(false)} showClose={false} testId="export-filters-sheet" actions={<Button kind={KIND.primary} size={SIZE.compact} data-testid="export-filter-apply" onClick={() => { onApply(draft); setOpen(false); }}>Apply</Button>}>
        <div data-testid="export-filter-salespeople" role="radiogroup" aria-label="Salesperson" style={{ display: 'grid', gap: theme.sizing.scale200 }}>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft === 'all'} data-list-card="inset" data-testid="export-salesperson-all" onClick={() => setDraft('all')} startEnhancer={<Glyph id="team" size={STEP.medium} />} overrides={{ BaseButton: { style: choice(draft === 'all') } }}>All salespeople</Button>
          {people.map(candidate => <Button key={candidate.id} kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft === candidate.id} data-list-card="inset" data-testid={`export-salesperson-${candidate.id}`} onClick={() => setDraft(candidate.id)} startEnhancer={<Glyph id="who" size={STEP.medium} />} overrides={{ BaseButton: { style: choice(draft === candidate.id) } }}>{candidate.name}</Button>)}
        </div>
      </WorkflowContent>
    </OverlayCard>
  </>;
}

function readerViewOf(value: unknown): PreviewView | null {
  switch (value) {
    case 'paper': case 'packing': case 'sheet': case 'file': case 'mail': return value;
    default: return null;
  }
}

/* THE MINUTES TO A SLOT ARE `scenario-clock.ts`'s ARITHMETIC NOW (FEED-IA §247.8). The function
   that stood here took the seeded day and a wall clock read in the BROWSER's zone, which is two
   clocks wearing one signature; it lives beside the day it counts from, as `minutesUntilSlot`,
   where `app/tools/test-prep-clock.mjs` can hold it to the hours that straddle midnight. */

function countdownWords(minutes: number): string {
  /* IT IS READ INSIDE A SENTENCE — «Next batch in 6 min», «Next batch ready now» — so it starts
     the way the middle of a sentence starts. */
  if (minutes <= 0) return 'ready now';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `in ${hours}h${rest ? ` ${rest}m` : ''}`;
}

/** ONE SCROLL SURFACE, AND THIS IS HOW THE CARD KNOWS IT MOVED (FEED-IA §246).
 *
 * «for the whole prep screen, I can scroll within the card. It slides out from the bottom, but I
 * shouldn't be able to scroll within it. That should be hard-coded within the card» (Peter,
 * 2026-09-10). The card had `overflowY: auto`, a max-height and a transform of its own, so Prep
 * had two scroll ranges stacked on one another: the sheet's and the list's. The sheet already owns
 * a scrollport — the task frame's Card — so the card's own range is gone and the card is exactly
 * as tall as what is in it.
 *
 * The raised look still has to answer the movement, so the card reads the surface it now lives on:
 * the closest scrolling ancestor, whichever frame Prep is mounted in. Position, not a transform. */
function useOuterScrolled(anchor: React.RefObject<HTMLElement | null>, past = 24): boolean {
  const [moved, setMoved] = React.useState(false);
  React.useEffect(() => {
    const start = anchor.current;
    if (!start || typeof window === 'undefined') return undefined;
    let host: HTMLElement | null = start.parentElement;
    while (host) {
      const flow = window.getComputedStyle(host).overflowY;
      if (flow === 'auto' || flow === 'scroll') break;
      host = host.parentElement;
    }
    const read = () => setMoved((host ? host.scrollTop : window.scrollY) > past);
    read();
    const target: HTMLElement | Window = host ?? window;
    target.addEventListener('scroll', read, { passive: true });
    return () => target.removeEventListener('scroll', read);
  }, [anchor, past]);
  return moved;
}

/** THE CARD OVER THE PICTURE, MEASURED (FEED-IA §246). Prep draws the clock over the top-left of
 *  its map, and the fit measured the whole box — so most of the marks were painted underneath an
 *  opaque card and could be seen by nobody (142 of 142 at 320, measured). The card states its own
 *  rectangle and the fit keeps every mark out of it. */
function useCardInset(node: React.RefObject<HTMLElement | null>): MapInset | undefined {
  const [inset, setInset] = React.useState<MapInset | undefined>(undefined);
  React.useEffect(() => {
    const card = node.current;
    if (!card || typeof ResizeObserver === 'undefined') return undefined;
    const read = () => {
      const right = card.offsetLeft + card.offsetWidth;
      const bottom = card.offsetTop + card.offsetHeight;
      setInset((held) => (held && held.right === right && held.bottom === bottom ? held : { right, bottom }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(card);
    return () => observer.disconnect();
  }, [node]);
  return inset;
}

/** THE NEAR-TERM WINDOW (FEED-IA §246). Prep lists and maps the next batch's day and the two
 *  delivery days after it. The whole remaining book on one picture is a smear a person reads
 *  nothing off, and on one list it is a scroll with no end; three days is what a house prepares
 *  against. The book beyond it is stated as a number rather than dropped. */
const UPCOMING_DAYS = 3;

function DeliveryBatchHub({ sales, templates, sector, today, prepClock, cast, derived, onDownload, onSchedules, onPrint }: {
  sales: Sale[];
  templates: Template[];
  sector: SectorId;
  today: string;
  /** THE WORKSPACE'S OWN INSTANT, AS A PAIR (FEED-IA §247.8): the day it falls on and the hour it
   *  shows, both read in `workspaceClock()`. The countdown measures from `prepClock.dayId`, so
   *  the day the card names and the minutes the heading counts are two halves of one reading.
   *  (`clock` in this component is already the clock CARD's own ref, which the map fit avoids.) */
  prepClock: PrepClock;
  cast: Cast;
  derived: Derived;
  onDownload: (day: string, ids: string[]) => void;
  onSchedules: () => void;
  onPrint: (request: PrintScreenRequest) => void;
}) {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const [mapSale, setMapSale] = React.useState<Sale | null>(null);
  const [detailSale, setDetailSale] = React.useState<Sale | null>(null);
  const card = React.useRef<HTMLElement>(null);
  const clock = React.useRef<HTMLDivElement>(null);
  const clockInset = useCardInset(clock);
  const sheetExpanded = useOuterScrolled(card);
  /* THE MAP LAYER RESTORES OUT OF THE WINDOW IT WAS OPENED FROM (FEED-IA §246). It read the whole
     book, so a Back into a delivery that had since left the window — or one whose address is text
     and has no point to draw — reopened a picture of every other delivery under that customer's
     name. A restored id the window no longer holds closes the layer instead. */
  useHistoryLayer({ id: 'export:prep-map', active: mapSale !== null, snapshot: { sale: mapSale?.id ?? null }, onRestore: (snapshot) => setMapSale(snapshot && typeof snapshot.sale === 'string' ? ready.find((sale) => sale.id === snapshot.sale && sale.customer.at) ?? null : null) });
  useHistoryLayer({ id: 'export:prep-detail', active: detailSale !== null, snapshot: { sale: detailSale?.id ?? null }, onRestore: (snapshot) => setDetailSale(snapshot && typeof snapshot.sale === 'string' ? sales.find((sale) => sale.id === snapshot.sale) ?? null : null) });
  const history = React.useSyncExternalStore(packingOutputs.subscribe, packingOutputs.getSnapshot, packingOutputs.getSnapshot);
  const jobs = useQueue(sector);
  const pending = React.useMemo(() => jobs.filter((job) => job.state !== 'printed').flatMap((job) => job.packingOutput ?? []), [jobs]);
  /* ONE DERIVED SET (FEED-IA §246 acceptance 1). `sheetSalesOf` is the filter every output already
     applies on its way to paper or to a file, so Prep applies it FIRST: the rows, the pins, the
     batch, the download and the print run are then the same sale ids counted once, rather than
     five readings that disagree by whatever each one filters out on its own. */
  const queue = React.useMemo(() => sheetSalesOf(sales)
    .filter((sale) => canPrepare(sale) && !isStanding(sale, today)
      && sale.day >= today && minutesUntilSlot(sale.day, slotOf(sale), prepClock) >= 0)
    .sort((a, b) => `${a.day} ${slotOf(a)} ${a.customer.name}`.localeCompare(`${b.day} ${slotOf(b)} ${b.customer.name}`)), [sales, today, prepClock]);
  /* THE WINDOW IS THE LIST AND THE WINDOW IS THE MAP. One set, named once, read by the rows, the
     pins and the count above them, so the picture answers the question the list asks. */
  const windowDays = React.useMemo(() => [...new Set(queue.map((sale) => sale.day))].slice(0, UPCOMING_DAYS), [queue]);
  const ready = React.useMemo(() => queue.filter((sale) => windowDays.includes(sale.day)), [queue, windowDays]);
  const lastWindowDay = windowDays[windowDays.length - 1];
  const later = queue.length - ready.length;
  const first = ready[0];
  const batchDay = first?.day ?? today;
  const batchSlot = first ? slotOf(first) : '';
  const batch = ready.filter((sale) => sale.day === batchDay && slotOf(sale) === batchSlot);
  const notes = newPaperOf(batch, today);
  const remainingPacking = remainingPackingSales(batch, sector, history);
  const packing = unqueuedPackingSales(remainingPacking, sector, pending);
  const printedNotes = Math.max(0, batch.length - notes.length);
  const printedPacking = Math.max(0, batch.length - remainingPacking.length);
  const nextIn = first ? countdownWords(minutesUntilSlot(first.day, slotOf(first), prepClock)) : 'Ready when orders arrive';
  const noteTemplate = templateForPaper(templates, 'albaranes');
  const packingTemplate = templateForPaper(templates, 'packing');
  /* EVERY LISTED DELIVERY IS A PIN (FEED-IA §246). «Make sure that for all the addresses you
     actually come up with, they all show up on the map.» The rows list `ready` — every current or
     future eligible delivery — and the markers were built from `batch`, the next slot alone, so
     the picture answered a different question from the list under it. They read one set now, at
     each customer's own stored coordinates, and the batch keeps its own ring. */
  const batchIds = React.useMemo(() => new Set(batch.map((sale) => sale.id)), [batch]);
  const mapMarkers = React.useMemo(() => ready.flatMap((sale) => (sale.customer.at
    ? [{ id: sale.id, at: sale.customer.at, label: `Delivery Note ${sale.number} · ${sale.customer.name}`, batch: batchIds.has(sale.id) }]
    : [])), [ready, batchIds]);
  /* AND WHERE THE LIST AND THE PICTURE CANNOT AGREE, THE SCREEN SAYS SO (FEED-IA §246). A customer
     whose address was typed rather than picked has a door and no coordinate — «Freeform addresses
     are saved as text» — so the heading counts a delivery the map has no mark for. The count stays
     the deliveries, because that is the work; the line under the picture states how many of them
     the picture holds and how many stand on a typed address, and it is drawn only where the two
     numbers differ. The first delivery WITH a point is what the picture opens on, and a row with no
     point carries an address mark rather than a door into a map that cannot show it. */
  const coverage = mapCoverageOf(ready.length, mapMarkers.length);
  const firstOnMap = ready.find((sale) => sale.customer.at);
  const openDetail = (id: string) => {
    const sale = ready.find((candidate) => candidate.id === id);
    if (sale) setDetailSale(sale);
  };
  const open = (kind: 'albaranes' | 'packing', selected: Sale[] = batch) => {
    const source = kind === 'packing'
      ? unqueuedPackingSales(remainingPackingSales(selected, sector, history), sector, pending)
      : newPaperOf(selected, today);
    onPrint({
      subject: kind === 'packing'
        ? { kind: 'packing', day: batchDay, salesIds: source.map((sale) => sale.id) }
        : { kind: 'day', day: batchDay, run: 'albaranes', salesIds: source.map((sale) => sale.id) },
      templateId: kind === 'packing' ? packingTemplate.id : noteTemplate.id,
      scope: { coverage: 'remaining', period: 'selected', day: batchDay, selectedIds: selected.map((sale) => sale.id) },
    });
  };
  return <div data-testid="export-batch-hub" data-batch={batch.length} data-upcoming={ready.length} data-pins={mapMarkers.length} data-window-days={windowDays.length} data-later={later} data-packing={packing.length} data-notes={notes.length} style={{ display: 'block', minWidth: 0 }}>
    {/* THE MAP STAYS WHERE IT IS AND THE CARD TRAVELS OVER IT. Sticky rather than transformed: the
        surface scrolls once, the picture holds the top of it, and the card rides up the way a
        sheet over a map is expected to. `display: block` above is what gives this element a
        containing block taller than itself — a sticky child of a grid sticks inside its own
        one-row area, which is no travel at all. */}
    {/* ONE HEIGHT, BECAUSE THE CLOCK STANDS ON THE PICTURE (FEED-IA §246). A 210px phone map under
        a card of its own left 22px of free room, which is less than the widest checked-in ground
        needs — so the marks had nowhere to go but under the card. The picture is the desk's own
        260 at every width, which is what buys the room the fit spends keeping every mark
        visible. */}
    <section data-testid="prep-status" style={{ position: 'sticky', top: 0, zIndex: 0, minHeight: '260px', overflow: 'hidden', borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundSecondary }}>
      {/* THE DOOR STANDS WHERE THE PICTURE STANDS (FEED-IA §246). This was gated on `first` — a
          batch exists — while the picture inside it is gated on `firstOnMap`, a delivery with a
          coordinate. A house whose whole week was typed therefore drew a bare 260px rectangle
          wearing a focusable «Open delivery map» whose click and Enter both did nothing. It is the
          same defect the row closed, on the larger of the two doors, so it takes the same answer:
          the door opens a picture, so it renders with the picture. */}
      {firstOnMap && <div role="button" tabIndex={0} aria-label="Open delivery map" data-testid="prep-map-background" onClick={() => setMapSale(firstOnMap)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setMapSale(firstOnMap); } }} /* THE PICTURE KEEPS ITS OWN STACK. Four hundred marks each carry a z-index so the soonest is
                 on top; without a stacking context of its own the highest of them would paint over the
                 clock card that stands in front of the map. `zIndex: 0` on a positioned element is what
                 contains them. */
              style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate', width: '100%', height: '100%', background: theme.colors.backgroundSecondary, cursor: 'pointer' }}><PinMap at={firstOnMap?.customer.at} height={260} caption={false} pin={22} markers={mapMarkers} avoid={clockInset} describedBy="prep-delivery-list" onMarkerClick={openDetail} /></div>}
      {/* AND WHERE THERE IS NO PICTURE, THE AREA SAYS WHAT IT HOLDS (FEED-IA §246). Every account a
          house typed rather than picked keeps a printable door and no coordinate, so a week of them
          leaves the map with every delivery to draw and no point to draw it at. One line states
          that, in the same words the coverage line under the list uses, and it carries no press —
          the work is in the rows below, where every one of them stands. */}
      {ready.length > 0 && mapMarkers.length === 0 && <p data-testid="prep-map-empty" style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'grid', alignContent: 'center', justifyItems: 'start', margin: 0, padding: theme.sizing.scale700, pointerEvents: 'none', ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Every upcoming delivery is at a typed address.</p>}
      {/* THE CLOCK, AND WHAT IT COSTS THE PICTURE (FEED-IA §246). It carries the hour and the
          countdown — what is true NOW — and nothing else: the batch's day, slot and count stand
          under «Next delivery batch» on the card below, where the heading names them, and the
          same sentence printed twice 40px apart was «a bunch of extra info». Two lines rather than
          three, and 60% of the width on a phone, is also what leaves the map room to hold the
          marks clear of this card — `useCardInset` hands the fit this rectangle. */}
      <div ref={clock} style={{ position: 'relative', zIndex: 1, display: 'grid', gap: theme.sizing.scale200, width: 'fit-content', maxWidth: phone ? '60%' : '72%', margin: theme.sizing.scale500, padding: theme.sizing.scale400, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundPrimary, boxShadow: theme.lighting.shadow500, pointerEvents: 'none' }}>
        <span data-testid="prep-live-clock" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>{prepClock.hhmm} now</span>
        <h3 data-testid="export-first-delivery" style={{ ...theme.typography.HeadingXSmall, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{first ? `Next batch ${nextIn}` : 'Preparation is clear'}</h3>
      </div>
    </section>

    <section ref={card} data-testid="prep-active-card" data-expanded={sheetExpanded ? 'true' : 'false'} aria-label="Next delivery batch" className={css({ position: 'relative', zIndex: 1, display: 'grid', gap: theme.sizing.scale500, marginTop: `-${theme.sizing.scale700}`, padding: phone ? theme.sizing.scale500 : theme.sizing.scale700, border: `1px solid ${theme.colors.borderOpaque}`, borderTopLeftRadius: theme.borders.radius400, borderTopRightRadius: theme.borders.radius400, borderBottomLeftRadius: theme.borders.radius400, borderBottomRightRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary, boxShadow: sheetExpanded ? theme.lighting.shadow700 : theme.lighting.shadow600, transitionProperty: 'box-shadow, border-color', transitionDuration: theme.animation.timing400, transitionTimingFunction: theme.animation.easeOutCurve, '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' } })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300 }}>
        <span style={{ display: 'grid', gap: theme.sizing.scale100, minWidth: 0 }}><h3 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>Next delivery batch</h3><span data-testid="prep-batch-scope" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{first ? `${dayLabelFromId(batchDay)} · ${batchSlot} · ${batch.length} ${plural(batch.length, 'delivery', 'deliveries')}` : 'The next confirmed batch will appear here.'}</span><span data-testid="prep-printed-progress" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{printedPacking} of {batch.length} packing lists printed · {printedNotes} of {batch.length} delivery notes printed</span></span>
        <Button kind={KIND.tertiary} size={SIZE.compact} shape={SHAPE.square} data-testid="prep-email-schedules" aria-label="Email schedules" onClick={onSchedules} overrides={{ BaseButton: { style: { position: 'relative', minWidth: '44px', minHeight: '44px' } } }}><Glyph id="email" size={STEP.small} /><span aria-hidden style={{ position: 'absolute', right: '5px', bottom: '4px' }}><Glyph id="clock" size={12} /></span></Button>
      </div>
      <div data-testid="prep-main-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale300 }}>
        <Button kind={KIND.primary} size={SIZE.compact} data-testid="export-prepare-packing" disabled={batch.length === 0} onClick={() => open('packing')} startEnhancer={<Glyph id={PACKING_MARK} size={STEP.small} />} overrides={{ BaseButton: { style: { width: '100%', minHeight: '48px' } } }}>Print</Button>
        <Button kind={KIND.secondary} size={SIZE.compact} data-testid="prep-download" disabled={batch.length === 0} onClick={() => onDownload(batchDay, batch.map((sale) => sale.id))} startEnhancer={<Download size={STEP.small} aria-hidden />} overrides={{ BaseButton: { style: { width: '100%', minHeight: '48px' } } }}>Download</Button>
      </div>

      <section aria-label="Upcoming deliveries" style={{ display: 'grid', gap: theme.sizing.scale200 }}>
        {/* TWO SCOPES, BOTH NAMED, EACH ONCE (FEED-IA §246). The batch above is what leaves next;
            this is the window — the batch's day and the two delivery days after it — and the
            heading carries its count, because a heading that names the thing is the line a person
            reads. The list and the map hold exactly this set. */}
        <h3 data-testid="prep-upcoming-heading" style={{ ...theme.typography.LabelLarge, margin: 0 }}>Upcoming deliveries · {ready.length}</h3>
        {/* WHAT THE PICTURE ABOVE HOLDS, WHERE IT HOLDS LESS THAN THE LIST (FEED-IA §246). It
            stands under the map and over the rows, with the heading whose count it qualifies, and
            it renders only where the two numbers differ — a line that said «142 on the map · 0 at
            typed addresses» on every other day would be a sentence about nothing. THE SINGULAR
            CARRIES ITS ARTICLE: `plural` drops the «es» and supplies no «a», so one address read
            «1 at typed address» — and the row's own mark, two lines below, said «… · a typed
            address» in its aria. The screen a person reads and the words a screen reader says are
            one sentence now. */}
        {coverage.typed > 0 && <span data-testid="prep-map-coverage" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{coverage.onMap} on the map · {coverage.typed} at {coverage.typed === 1 ? 'a typed address' : 'typed addresses'}</span>}
        {later > 0 && <span data-testid="prep-upcoming-more" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{later} more after {dayLabelFromId(lastWindowDay)}</span>}
        <div id="prep-delivery-list" data-testid="export-delivery-timeline" style={{ display: 'grid', borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
          {ready.map((sale) => <div key={sale.id} role="button" tabIndex={0} data-testid={`prep-delivery-${sale.id}`} data-prep-day={sale.day} data-prep-time={slotOf(sale)} onClick={() => openDetail(sale.id)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openDetail(sale.id); } }} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 64px', gap: theme.sizing.scale300, alignItems: 'center', minHeight: '72px', borderBottom: `1px solid ${theme.colors.borderOpaque}`, cursor: 'pointer' }}>
            <span style={{ ...theme.typography.LabelSmall, fontVariantNumeric: 'tabular-nums' }}>{slotOf(sale)}</span>
            <span style={{ minWidth: 0 }}><span style={{ ...theme.typography.LabelSmall, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sale.customer.name}</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{sale.day === today ? 'Today' : dayLabelFromId(sale.day)} · {sale.lines.length} {plural(sale.lines.length, 'line')}</span></span>
            {/* A DOOR ONLY WHERE THERE IS A PICTURE BEHIND IT (FEED-IA §246). A delivery whose
                address is text has no coordinate, so the square drew an empty bordered box inside a
                control labelled «Open map for …» that opened a map of everybody else under this
                customer's name. It carries the address mark instead — a static glyph, the run it
                stands on in its own aria, and no press — and the row still opens the Delivery Note,
                exactly as `areas/customers.tsx` guards its own 72px square. */}
            {sale.customer.at
              ? <button type="button" data-testid={`prep-map-${sale.id}`} aria-label={`Open map for ${sale.customer.name}`} onClick={(event) => { event.stopPropagation(); setMapSale(sale); }} style={{ width: '56px', height: '56px', padding: 0, overflow: 'hidden', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, background: theme.colors.backgroundSecondary, cursor: 'pointer' }}><PinMap at={sale.customer.at} height={56} caption={false} pin={16} /></button>
              : <span data-testid={`prep-address-${sale.id}`} role="img" aria-label={`${sale.customer.address ?? sale.customer.name} · a typed address`} style={{ display: 'grid', placeItems: 'center', width: '56px', height: '56px', color: theme.colors.contentTertiary }}><Glyph id="map" size={STEP.small} /></span>}
          </div>)}
          {ready.length === 0 && <span data-testid="prep-empty" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, padding: `${theme.sizing.scale600} 0` }}>The next confirmed batch will appear here.</span>}
        </div>
      </section>
    </section>

    <WorkflowDialog isOpen={mapSale !== null} title={mapSale ? mapSale.customer.name : 'Delivery map'} ariaLabel="Delivery map" onClose={() => setMapSale(null)} onBack={() => setMapSale(null)} showClose={false} testId="prep-map-screen">
      {/* THE TITLE AND THE PICTURE ANSWER THE SAME QUESTION (FEED-IA §246). This screen is titled
          after one customer, so that customer wears the drop and stands on top of the window it is
          opened inside — a map of 142 identical marks with the named customer unmarked answered a
          different question from its own heading. */}
      {mapSale && <PinMap at={mapSale.customer.at} zone={mapSale.customer.zone} truck={mapSale.customer.truck} note={`${dayLabelFromId(mapSale.day)} · ${slotOf(mapSale)}`} height={phone ? 360 : 480} markers={mapMarkers} drop={mapSale.id} describedBy="prep-delivery-list" onMarkerClick={openDetail} />}
    </WorkflowDialog>
    <WorkflowDialog isOpen={detailSale !== null} title={detailSale ? `Delivery Note ${detailSale.number}` : 'Delivery Note'} ariaLabel="Delivery Note" onClose={() => setDetailSale(null)} onBack={() => setDetailSale(null)} showClose={false} flush testId="prep-delivery-detail" actions={detailSale && !phone ? <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="prep-go-sales" onClick={() => { openSale(detailSale); setDetailSale(null); }}>Go to sales</Button> : undefined}>
      {/* THE SHEET OWNS A SCROLLPORT (FEED-IA §254 · Peter: «not working. not scrollable»). This
          dialog is `flush`, so its body holds its height and hands the scrolling to what it
          contains; `SaleDetail` scrolls itself only on a phone, where it is the screen. Inside a
          dialog on a desk there is no pane under it, so a long albarán ran past the card's own
          edge with nothing to move it. One scrollport here, and the document scrolls under the
          dialog's own head. */}
      {detailSale && <div style={{ height: '100%', minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}><><SaleDetail cast={cast} derived={derived} sale={detailSale} sales={sales} list={ready} onPick={(id) => { const next = ready.find((sale) => sale.id === id); if (next) setDetailSale(next); }} onClose={() => setDetailSale(null)} onPrint={() => open('albaranes', [detailSale])} />{phone && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="prep-go-sales" onClick={() => { openSale(detailSale); setDetailSale(null); }} overrides={{ BaseButton: { style: { position: 'fixed', zIndex: 12, top: 'max(12px, env(safe-area-inset-top))', right: theme.sizing.scale500, minHeight: '44px' } } }}>Go to sales</Button>}</></div>}
    </WorkflowDialog>
  </div>;
}

function paperOf(value: unknown): PaperKind | null {
  return value === 'albaranes' || value === 'packing' || value === 'sheet' ? value : null;
}

function originOf(value: unknown): ReaderOrigin {
  return value === 'days' ? 'days' : 'rails';
}

function previewIdsOf(value: unknown): string[] | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch {
    return null;
  }
}

function Centre({ onSetup, onClose, onExpandedChange, onPrintScreen }: { onSetup: () => void; onClose: () => void; onExpandedChange: (expanded: boolean) => void; onPrintScreen: (request: PrintScreenRequest) => void }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const workspaceCapabilities = useWorkspaceCapabilities();
  const { config, derived } = useConfig();
  const cast = derived.cast;
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const jobs = useQueue(cast.sector);
  const setup = usePrintSetup();
  const packingHistory = React.useSyncExternalStore(packingOutputs.subscribe, packingOutputs.getSnapshot, packingOutputs.getSnapshot);
  const now = nowOf(cast);
  const today = todayId(cast);
  /* ONE CLOCK ON PREP (FEED-IA §247.8, «one Prep clock in the workspace's timezone»).
   *
   * This read was `new Date().toLocaleTimeString(…)` — the BROWSER's wall clock — while the day
   * beside it was `todayId(cast)`, the workspace's own Peru day. For the hours where the two zones
   * stand on different dates the card named one day and the countdown counted from another: at
   * half past midnight in Madrid, «Sunday 13.09 · 07:00 · 4 deliveries» over «Next batch in 6h
   * 30m», measured on main's build — when Lima's 13.09 07:00 had gone ten and a half hours earlier
   * and the batch that was actually next stood on Monday 14.09 at 07:30. `prepClockOf` reads ONE
   * instant in ONE zone and hands back the pair the surface needs, so the label and the countdown
   * are the same reading.
   *
   * The held pair is returned unchanged when the minute has yet to turn: the string this replaced
   * bailed out of its own setState on an equal value, and an object would re-render Prep every
   * thirty seconds instead. */
  const [prepClock, setPrepClock] = React.useState<PrepClock>(() => prepClockOf(new Date(), workspaceClock().timeZone));
  React.useEffect(() => {
    const read = () => setPrepClock((held) => {
      const fresh = prepClockOf(new Date(), workspaceClock().timeZone);
      return fresh.dayId === held.dayId && fresh.hhmm === held.hhmm ? held : fresh;
    });
    const timer = window.setInterval(read, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  /* THE FOLD IS THE SAME FOLD THE RIVER READS. It is memoised on the ledger, the grants and the
     config because those are its three inputs — the config joined them when the rails did (§35.3:
     a send may only be stamped onto a rail the house has actually opened). */
  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants, config]);
  const [salesperson, setSalesperson] = React.useState('all');
  /* The chips «Specific products» offers this house today — the set a stored selection is read back
     against, so a legitimate one is never migrated away (§200.1). */
  const offeredChips = React.useMemo(() => new Set(cast.products.map(productChip)), [cast.products]);
  /* ONE STORE, ONE LIST, ONE OBJECT (OUT-01.8). The library, the editor and the day's seats all
     read `Template` itself; the saved copy and its adapter are gone.
     §200.1 rides on the read: a selection stored while the picker offered «SKU PV-1001 · Merluza»
     opens on the chip the picker offers today, and a chip that merely starts with those three
     letters keeps every character it was saved with. */
  const [stored, setTemplates] = useTemplates(cast.sector);
  const templates = React.useMemo(
    () => stored.map((template) => ({ ...template, selection: { ...template.selection, chips: template.selection.chips.map((chip) => migrateChip(chip, offeredChips)) } })),
    [stored, offeredChips],
  );
  const [outputSchedules, setOutputSchedules] = useOutputSchedules(cast.sector);
  /* WHICH TEMPLATE THE EDITOR AND THE PREVIEW STAND ON. An id rather than a copy, so a write that
     lands while one of them is open is read back on the next render. */
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (salesperson !== 'all' && !cast.comerciales.some((person) => person.id === salesperson)) setSalesperson('all');
  }, [cast.comerciales, salesperson]);
  const scopedSales = React.useMemo(() => salesperson === 'all'
    ? sales
    : sales.filter((sale) => sale.customer.comercial === salesperson), [sales, salesperson]);
  /* WHICH TEMPLATE A PAPER PREVIEW DRAWS (OUT-01.3 · OUT-03.5). A preview is opened by PAPER, so it
     reads the template standing on the day for that paper — the same record its Print act freezes,
     so what a person previews and what leaves the printer are one thing. E200.03's print screen
     opens ON a template and takes this function's place at the doors it replaces. */
  const profileForPaper = React.useCallback((kind: 'albaranes' | 'packing' | 'sheet') => {
    /* A PREVIEW OPENED FROM A ROW DRAWS THAT ROW'S TEMPLATE, which is the whole of «if they hit
       preview that takes them literally to the same place where they can edit the template»: a
       house holding three albarán templates would otherwise preview the seated one from all three.
       A preview opened by PAPER — the date list's eye, the rails' own doors — keeps reading the
       template standing on the day. */
    const previewing = previewingId ? templateById(templates, previewingId) : undefined;
    const template = previewing && PAPER_KIND_OF[previewing.category] === kind ? previewing : templateForPaper(templates, kind);
    return withLifetimeValues(printProfileOf(template), scopedSales);
  }, [templates, scopedSales, previewingId]);
  const scopePerson = cast.comerciales.find((person) => person.id === salesperson);
  const scopeLabel = scopePerson ? scopePerson.name : 'All salespeople';
  const world = React.useMemo(() => railWorld(cast), [cast, grants, config]);
  const state = React.useMemo(() => exportState(scopedSales, today, world), [scopedSales, today, world]);

  /* ── THE CENTRE OPENS ON ITS RAILS ─────────────────────────────────────────────────────────
     The centre itself is one place, so opening it earns exactly its parent layer and Back closes it.
     Choosing the date list or a preview is an explicit child reading: a date-picker child returns to
     the rails, while a preview returns to the place it came from. Their snapshots carry only the
     day, paper and origin that make Forward intelligible; work and search text remain local. */
  const [view, setView] = React.useState<View>('rails');
  React.useEffect(() => { onExpandedChange(view !== 'days'); }, [view, onExpandedChange]);
  const [paper, setPaper] = React.useState<PaperKind>('albaranes');
  const [look, setLook] = React.useState<string>(today);
  const [from, setFrom] = React.useState<ReaderOrigin>('rails');
  const [previewIds, setPreviewIds] = React.useState<string[] | null>(null);
  const [prepDownloadIds, setPrepDownloadIds] = React.useState<string[] | null>(null);
  const [prepDownloadNotice, setPrepDownloadNotice] = React.useState('');
  const [word, setWord] = React.useState('');
  /* A direct preview can ask for the picker. It first steps back out of that preview, then the
     preview restore opens the picker as a new child; otherwise the two history effects race. */
  const [pickerAfterPreview, setPickerAfterPreview] = React.useState(false);
  const reader = readerViewOf(view);
  const pickerContext = view === 'days' || (reader !== null && from === 'days');

  useHistoryLayer({
    id: 'export:day',
    active: pickerContext,
    snapshot: { day: look, paper },
    onRestore: (snapshot) => {
      setPickerAfterPreview(false);
      if (!snapshot) { setFrom('rails'); setView('rails'); return; }
      if (typeof snapshot.day === 'string') setLook(snapshot.day);
      const savedPaper = paperOf(snapshot.paper);
      if (savedPaper) setPaper(savedPaper);
      setFrom('days');
      setView('days');
    },
  });
  useHistoryLayer({
    id: 'export:preview',
    active: reader !== null,
    snapshot: {
      day: look,
      paper,
      view,
      origin: from,
      ids: previewIds ? JSON.stringify(previewIds) : null,
    },
    onRestore: (snapshot) => {
      if (!snapshot) {
        const returnToPicker = pickerAfterPreview || from === 'days';
        setPickerAfterPreview(false);
        setView(returnToPicker ? 'days' : 'rails');
        return;
      }
      if (typeof snapshot.day === 'string') setLook(snapshot.day);
      const savedPaper = paperOf(snapshot.paper);
      if (savedPaper) setPaper(savedPaper);
      setPreviewIds(previewIdsOf(snapshot.ids));
      const origin = originOf(snapshot.origin);
      setFrom(origin);
      setPickerAfterPreview(false);
      setView(readerViewOf(snapshot.view) ?? origin);
    },
  });
  /* WHERE A PREVIEW GOES BACK TO. A preview is opened from two places now — the date list and the
     rails — and its saved origin is what makes Browser Back and the on-screen Back agree. */

  const left = pagesWaiting(jobs);
  const todaySheet = sheetSalesOf(scopedSales.filter((s) => s.day === today));
  /* ONE SELECTED SET, IN ONE ORDER. The ids arrive from Prep in the order Prep listed them, and
     reading them back through a filter re-sorted the file into the fold's order — so Download and
     Print named the same deliveries in two different sequences. The ids lead. */
  const prepDownloadSales = prepDownloadIds
    ? prepDownloadIds.flatMap((id) => sheetSalesOf(scopedSales.filter((sale) => sale.id === id)))
    : todaySheet;
  const prepDownloadTemplate = liveTemplates(templates).find((template) => template.category === 'file');
  /* THE ARTIFACT, BUILT ONCE. The screen describes this object and the press saves this object, so
     the size on the screen is the size on the disk. */
  /* ONE ANSWER TO «DOES THIS HOUSE PRICE ITS PAPERS», the one the library's own download already
     asks: the workspace capability AND the albarán's own setting. */
  const prepPriced = workspaceCapabilities.pricing && derived.albaran.valued;
  const prepDownloadPlan = React.useMemo(() => (prepDownloadTemplate
    ? configuredFilePlan(prepDownloadTemplate, prepDownloadSales, look, prepPriced, workspaceCapabilities.country)
    : null), [prepDownloadTemplate, prepDownloadSales, look, prepPriced, workspaceCapabilities.country]);
  const selectedSales = React.useMemo(() => scopedSales.filter((s) => s.day === look), [scopedSales, look]);
  const selectedState = React.useMemo(() => exportState(scopedSales, look, world, today), [scopedSales, look, world, today]);
  const fresh = state.newSincePrint;
  /* §138.9 / §142: preview the full truck-split run, with exactly the IDs this press prints. */
  const looked = React.useMemo(() => newPaperOf(scopedSales.filter((s) => s.day === look), today), [scopedSales, look, today]);
  const paperSubject: PrintSubject = { kind: 'day', day: look, run: 'albaranes', salesIds: from === 'rails' && previewIds ? previewIds : looked.map((sale) => sale.id) };
  const packingScope = remainingPackingSales(sheetSalesOf(scopedSales.filter((sale) => sale.day === look)), cast.sector, packingHistory);
  const nextMail = state.scheduled[0] ?? state.emailed[0];

  /* ── THE STREAM'S OWN NUMBERS (CANON §15.1) ───────────────────────────────────────────────
     What HAPPENED, and what has been owed again since it happened. `changedSince` on each rail is
     the load-bearing one: with nothing closing, a document that moves after its paper came out
     STANDS AGAIN, and a count that only ever fell would be a count that lies (§8.3 rule 3). */
  const day = React.useMemo(() => scopedSales.filter((s) => s.day === today), [scopedSales, today]);
  /* AN OWED ANSWER IS OUTSIDE EVERY COUNT (§8.3 rule 1). A document whose crate is undetermined is
     not owed paper and not owed the system — counting it would make the number un-finishable, and
     it would put «Changed since 1» on a row whose owed cell reads 0. It rides the review ticker in
     the foot instead, which is the one place it belongs. */
  const held = React.useMemo(() => new Set(state.review.map((s) => s.id)), [state.review]);
  const mine = day.filter((s) => !held.has(s.id));
  const changedSincePaper = mine.filter((s) => s.printed?.stale).length;
  const changedSinceSystem = mine.filter((s) => s.sentToErp?.stale).length;
  const lastErpAt = day.reduce<string | undefined>(
    (top, s) => (s.sentToErp && (!top || s.sentToErp.at > top) ? s.sentToErp.at : top), undefined);
  const nextMailAt = [...state.scheduled]
    .map((s) => s.emailScheduled?.sendAt ?? '')
    .filter(Boolean)
    .sort()[0];

  /* THE HOUSE'S APPETITE, READ (CANON §16.7). The value is the house's — this surface never asks
     the question, it renders the answer. */
  const appetite = appetiteWords(grants, world, state.toErp.length, now);
  /* WHEN THE SYSTEM LAST TOOK SOMETHING, ON THE HOUSE'S OWN CLOCK (§111.5). `lastErpAt` is folded
     off the day's own `erp-send` hours, so it is the ledger's time and never the browser's — a
     `new Date()` here would be the one fact on this surface that came from outside the house. */
  const lastSync = lastErpAt ?? 'Waiting on the first';

  /* THE SEAT IS HELD THROUGH THE PRESS (§59.1). See `SyncPress`. */
  const [going, setGoing] = React.useState(false);
  React.useEffect(() => {
    if (!going) return undefined;
    const t = window.setTimeout(() => setGoing(false), GOING);
    return () => window.clearTimeout(t);
  }, [going]);

  /* ── THE FACTS EVERY RAIL HOLDS (§51.24) ──────────────────────────────────────────────────
     Three sentences became three labelled cells on one shared grid. The label is what the number
     IS; the number is the number. What was «3 came in or were confirmed since the last paper at
     06:40» is now `New since 06:40 / 3`, which is the same fact in a quarter of the width and in a
     place the eye can return to. */
  const printFacts = (
    <Facts testid="print">
      <Fact label="To print" value={state.toPrint.length} testid="print-owed" />
      {/* ONE WORD, ONE SET (§51.24 · §58.4, AUDIT-2 C22). This cell read «New since 09:15 · 6»
          forty pixels above a press reading «Print 126 new» — the same adjective over two sets, so
          the number a person is about to send to the printer and the number under the word they
          read it by disagreed by 120 documents. The press keeps «new», which is §29.1's own word
          for what it acts on; the cell says «owed», which is what it has always counted: arrived
          since the last paper, or owed again because the crate moved (§8.3 rule 3). */}
      <Fact
        label={state.lastPrintAt ? `Owed since ${state.lastPrintAt}` : 'Waiting on the first press'}
        value={fresh.length}
        testid="print-fresh"
      />
      <Fact label="Coming out" value={left} testid="print-pages" />
    </Facts>
  );

  const erpFacts = world.erp.connected ? (
    <Facts testid="erp">
      <Fact
        label={world.erp.cadence === 'stream' ? 'To send' : `With the ${world.erp.fileAt} file`}
        value={state.toErp.length}
        testid="erp-owed"
      />
      <Fact label={`In ${world.erp.name}`} value={state.sentErp.length} testid="erp-sent" done />
      <Fact label="Changed since" value={changedSinceSystem} testid="erp-changed" />
    </Facts>
  ) : undefined;

  /* ⚠ 14 September 2026 · THE MAIL FACTS CELL WENT WITH THE RAIL. `emailFacts` was built here and
     rendered nowhere — `print-owed`, `erp-owed` and `email-scheduled` are all absent from main's
     own bundle — so its `world.email.connected` read was the rail's last consumer in this
     component and folding it onto the live capability would have bought a subscription for a
     value nothing draws. The mail count a person actually sees is `data-email` on the Prep door
     below, which reads the capability. `printFacts` and `erpFacts` above are unrendered for the
     same reason and are one retirement of their own. */

  const toSettings = () => {
    onClose();
    window.location.hash = '#/settings';
  };

  /* ── THE DAYS THIS HOUSE HAS PAPER FOR, AND WHAT EACH ONE STILL OWES (§129.2) ───────────────
     THE ROW IS THE DAY AND ITS OWN ARITHMETIC. What a person choosing a date needs to know is how
     much of it is left, so the trailing cell is the remaining count for the paper they picked —
     the SAME two readings the river's shortcuts press (`newPaperOf` for the crates, the bench's
     tick for the bay), so the two doors can never disagree about one morning.

     THE DAY'S SHEET HAS NO REMAINDER: it is one paper for the whole round, so its row states the
     size of the round instead. A count of «0 of 1» about a manifest would be arithmetic invented
     to fill a column. */
  const dayRows = React.useMemo<PickGroup[]>(() => {
    const byDay = new Map<string, Sale[]>();
    for (const s of scopedSales) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
    const terms = word.trim().toLowerCase();
    const rows = [...byDay.keys()].sort().reverse().map((id) => {
      const own = byDay.get(id) as Sale[];
      const round = sheetSalesOf(own);
      const owed =
        paper === 'albaranes' ? newPaperOf(own, today).length
          : paper === 'packing' ? remainingPackingSales(round, cast.sector, packingHistory).length
            : 0;
      const label = id === today ? `Today · ${dayLabelFromId(id)}` : dayLabelFromId(id);
      return {
        key: id,
        kind: 'day',
        mark: <Glyph id="days" size={STEP.medium} />,
        word: label,
        /* THE TRAILING CELL IS SHORT ENOUGH THAT THE DATE SURVIVES IT (§77.2's slot rule, measured
           at 390). «126 of 283 remaining» took 45% of a phone row and «Monday 25.08» — the answer
           the person came for — ellipsised to «Monday 25…». The word is what the column already
           means, so it goes and the date stands whole. */
        context:
          paper === 'sheet'
            ? `${round.length} ${plural(round.length, 'delivery note', 'delivery notes')}`
            : phone ? `${owed} of ${round.length}` : `${owed} of ${round.length} remaining`,
        words: [label.toLowerCase(), id],
        open: () => {
          setLook(id);
          setFrom('rails');
          setPreviewIds(null);
          setView('rails');
        },
        /* THE EYE ON EVERY ROW (§129.2, his own words). It looks at the paper this day would print
           of the type that is picked — the row's act, seen first, which is the dual flush's exact
           relationship one level out. */
        peek: {
          label: `Look at ${dayLabelFromId(id)}`,
          onPeek: () => {
            setLook(id);
            setPreviewIds(null);
            setFrom('days');
            setView(paper === 'albaranes' ? 'paper' : paper === 'packing' ? 'packing' : 'sheet');
          },
        },
      };
    });
    const kept = terms ? rows.filter((r) => r.words.some((w) => w.includes(terms))) : rows;
    /* THREE SECTIONS, IN THE ORDER A MORNING IS LIVED: what is on now, what is coming, what is
       behind. The heading names what is under it and the rows say the rest. */
    const groups: PickGroup[] = [
      { title: 'Today', rows: kept.filter((r) => r.key === today) },
      { title: 'Coming up', rows: kept.filter((r) => r.key > today) },
      { title: 'Behind you', rows: kept.filter((r) => r.key < today) },
    ];
    return groups.filter((g) => g.rows.length > 0);
  }, [scopedSales, paper, today, word, now, config.emailFeed, phone, cast.sector, packingHistory]);

  const changeDay = () => {
    if (view === 'days') {
      setPickerAfterPreview(false);
      setFrom('rails');
      setView('rails');
      return;
    }
    if (reader && from === 'rails') {
      setPickerAfterPreview(true);
      setView('rails');
      return;
    }
    if (!reader) {
      setFrom('rails');
      setPreviewIds(null);
    }
    setPickerAfterPreview(false);
    setView('days');
  };

  /* ── THE ONE DOOR ONTO A TEMPLATE (OUT-04, and the seam E200.03 replaces) ─────────────────
     «if they hit preview that takes them literally to the same place where they can edit the
     template.» Under E200.03 both modes are ONE screen; until it lands, `preview` opens the paper
     this template draws and `edit` opens its settings — and every caller already asks for a MODE,
     so the print screen replaces this function and nothing else. */
  const openPrintScreen = React.useCallback((template: Template, mode: 'preview' | 'edit') => {
    const kind = PAPER_KIND_OF[template.category];
    if (!kind) { setEditingId(template.id); setView('template-edit'); return; }
    const own = sheetSalesOf(selectedSales);
    const remaining = kind === 'albaranes' ? newPaperOf(own, today)
      : kind === 'packing' ? remainingPackingSales(own, cast.sector, packingHistory)
        : own;
    onPrintScreen({
      subject: kind === 'packing'
        ? { kind: 'packing', day: look, salesIds: remaining.map((sale) => sale.id) }
        : { kind: 'day', day: look, ...(kind === 'albaranes' ? { run: 'albaranes' as const } : {}), salesIds: remaining.map((sale) => sale.id) },
      templateId: template.id,
      mode,
      scope: kind === 'sheet' ? undefined : { coverage: 'remaining', period: 'day', day: look, selectedIds: own.map((sale) => sale.id) },
    });
  }, [selectedSales, today, cast.sector, packingHistory, onPrintScreen, look]);

  /* ── «NEW TEMPLATE», FROM A CATEGORY (OUT-01.6) ───────────────────────────────────────────
     Pre-filled with that category's shipped defaults, named «<Category name> 2» where a template
     of that name already stands, and landing on the editor with the name field focused. */
  const createTemplate = (category: OutputCategory) => {
    const at = new Date().toISOString();
    const taken = new Set(templates.map((template) => template.name));
    const base = CATEGORY_PLURALS[category];
    let name = base;
    for (let n = 2; taken.has(name); n += 1) name = `${base} ${n}`;
    const made = newTemplate(category, name, at, config.owner.name || 'Current user');
    if (!setTemplates([...templates, made])) return;
    setEditingId(made.id);
    setView('template-edit');
  };

  const saveTemplate = (next: Template) => {
    /* THE EDIT WRITES THE TEMPLATE, layout included, and the revision rise travels with it
       (OUT-01.7): the next sheet this template prints is registered against the values a person
       just saved rather than against the ones it held. A prepared schedule follows its template's
       new settings in the same write, so the plan and the template can never disagree. */
    const hasSchedules = outputSchedules.some((schedule) => schedule.outputId === next.id);
    const nextSchedules = hasSchedules
      ? outputSchedules.map((schedule) => schedule.outputId === next.id ? { ...scheduleFor(next, config.owner.name, schedule), status: schedule.status } : schedule)
      : outputSchedules;
    if (hasSchedules && !setOutputSchedules(nextSchedules)) return false;
    if (!setTemplates(templates.map((current) => current.id === next.id ? next : current))) {
      if (hasSchedules) setOutputSchedules(outputSchedules);
      return false;
    }
    setEditingId(null);
    setView('rails');
    return true;
  };

  const removeTemplate = () => {
    const template = editingId ? templateById(templates, editingId) : undefined;
    if (!template) return false;
    const hadSchedules = outputSchedules.some((schedule) => schedule.outputId === template.id);
    const nextSchedules = outputSchedules.filter((schedule) => schedule.outputId !== template.id);
    if (hadSchedules && !setOutputSchedules(nextSchedules)) return false;
    if (!setTemplates(templates.filter((current) => current.id !== template.id))) {
      if (hadSchedules) setOutputSchedules(outputSchedules);
      return false;
    }
    setEditingId(null);
    setView('rails');
    return true;
  };

  /* §175 · E193.20 · the morning the print pictures are drawn from: the selected day's own
     orders, already scoped by the salesperson filter, exactly as the library prints them. */
  const paperDay = React.useMemo(() => ({ day: look, sales: selectedSales }), [look, selectedSales]);
  const editing = editingId ? templateById(templates, editingId) : undefined;
  /* A PREVIEW OPENED FROM A ROW WEARS THAT TEMPLATE'S NAME, so «Preview» and «Edit» are visibly one
     screen on one object (OUT-04.2). A preview opened by paper keeps the paper's own title. */
  const previewedName = previewingId ? templateById(templates, previewingId)?.name : undefined;
  const body =
    view === 'new-template' ? (
      <CategoryPicker onBack={() => setView('rails')} onCreate={createTemplate} />
    ) : view === 'template-edit' && editing ? (
      <TemplateEditor
        template={editing}
        /* A SHIPPED TEMPLATE STAYS IN THE LIBRARY. «Remove» is offered on the ones a house made
           itself; the two that ship are archived rather than removed, so a house can always get
           its albarán back (OUT-01.4). */
        onRemove={editing.id === 'albaran-default' || editing.id === 'packing-default' || editing.id === 'order-file' ? undefined : removeTemplate}
        onBack={() => { setEditingId(null); setView('rails'); }}
        onSave={saveTemplate}
      />
    ) : view === 'days' ? (
      /* ── THE QUESTION, IN THE ONE SEARCH BOX'S GRAMMAR (§129.2) ────────────────────────────
          Field on top, sectioned rows under it, ↑↓ to walk, ↵ to take, an eye on every row. Not a
          line of this anatomy is drawn here: `PickList` IS the search modal's own list, lifted so
          two questions can wear one shape (§91.2 — «all search should be like this in fact»). */
      <div data-testid="export-days" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <PickList
          testid="export-days"
          intent={paper}
          groups={dayRows}
          query={word}
          onQuery={setWord}
          label="Which day"
          onTake={(row) => row.open()}

        />
      </div>
    ) : view === 'paper' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <PreviewHead title={previewedName ?? 'Delivery Notes'} onBack={() => setView(from)} />
        {/* THE TITLE IS SAID ONCE (§37.7's chrome rule). This preview already has a head and a way
            back above it, so the sheet drops its own — what it keeps is the sentence about the
            document and the press at the foot of it. */}
        <PrintView
          cast={cast}
          derived={derived}
          subject={paperSubject}
          sales={scopedSales}
          layoutProfile={profileForPaper('albaranes')}
          chrome="framed"
          onClose={() => setView(from)}
        />
      </div>
    ) : view === 'packing' ? (
      /* THE BAY'S OWN PAPER (FEED-IA §37.7). It is the third thing this morning prints, so it gets
         the same door the other two get: its own preview, reached from its own control. */
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <PreviewHead title={previewedName ?? 'The packing lists'} onBack={() => setView(from)} />
        <PrintView
          cast={cast}
          derived={derived}
          subject={{ kind: 'packing', day: look, salesIds: from === 'rails' && previewIds ? previewIds : packingScope.map((sale) => sale.id) }}
          sales={scopedSales}
          layoutProfile={profileForPaper('packing')}
          chrome="framed"
          onClose={() => setView(from)}
        />
      </div>
    ) : view === 'sheet' ? (
      /* THE ROUND'S OWN MANIFEST (§7.1). It rides with the van and it carries no prices — a
         different paper from both the albarán and the bay's list, so it gets its own door. */
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <PreviewHead title={previewedName ?? 'The day’s sheet'} onBack={() => setView(from)} />
        <PrintView
          cast={cast}
          derived={derived}
          subject={{ kind: 'day', day: look }}
          sales={scopedSales}
          layoutProfile={profileForPaper('sheet')}
          chrome="framed"
          onClose={() => setView(from)}
        />
      </div>
    ) : view === 'file' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <PreviewHead title="Download" onBack={() => setView('rails')} />
        <div data-testid="prep-download-screen" data-sales={prepDownloadSales.map((sale) => sale.id).join(',')} data-bytes={prepDownloadPlan?.bytes ?? 0} data-deliveries={prepDownloadPlan?.measures.deliveries ?? 0} data-lines={prepDownloadPlan?.measures.lines ?? 0} data-total={prepDownloadPlan?.measures.total ?? 0} style={{ display: 'grid', gap: theme.sizing.scale500 }}>
          {/* WHAT THE FILE IS, BEFORE THE PRESS (FEED-IA §246). Name, format and exact size, then
              the deliveries, lines, goods and money the rows carry — every one of them read off
              the artifact this button is about to save rather than off the button. */}
          {prepDownloadPlan && <section data-testid="prep-download-facts" style={{ display: 'grid', gap: theme.sizing.scale200, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary, minWidth: 0 }}>
            <span data-testid="prep-download-file-name" style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{prepDownloadPlan.fileName}</span>
            <span data-testid="prep-download-size" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>{prepDownloadPlan.format} · {byteWords(prepDownloadPlan.bytes)}</span>
            <span data-testid="prep-download-measures" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>{[
              `${prepDownloadPlan.measures.deliveries} ${plural(prepDownloadPlan.measures.deliveries, 'delivery', 'deliveries')}`,
              `${prepDownloadPlan.measures.lines} ${plural(prepDownloadPlan.measures.lines, 'line')}`,
              ...prepDownloadPlan.measures.quantities.map((amount) => qtyWords(amount.quantity, amount.unit)),
              ...(prepPriced ? [soles(prepDownloadPlan.measures.totalAsCanonical)] : []),
            ].join(' · ')}</span>
          </section>}
          <ErpFile sales={prepDownloadSales} world={world} day={prepDownloadIds ? look : today} />
          {prepDownloadTemplate && <Button kind={KIND.primary} size={SIZE.compact} data-testid="prep-download-file" disabled={prepDownloadSales.length === 0} onClick={() => { const result = downloadConfiguredFile(cast.sector, prepDownloadTemplate, prepDownloadSales, look, prepPriced, config.owner.name); setPrepDownloadNotice(`Saved ${downloadWords(result.fileName, result.bytes)}`); }}>Download {prepDownloadSales.length} {plural(prepDownloadSales.length, 'delivery', 'deliveries')}</Button>}
          {prepDownloadNotice && <span role="status" data-testid="prep-download-notice" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{prepDownloadNotice}</span>}
        </div>
      </div>
    ) : view === 'mail' && nextMail ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <PreviewHead title="The email" onBack={() => setView('rails')} />
        <EmailPreview sale={nextMail} />
      </div>
    ) : view === 'templates' ? (
      <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      <div><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-templates-back" onClick={() => setView('rails')} startEnhancer={<Glyph id="back" size={STEP.small} />}>Delivery batches</Button></div>
      <TemplateLibrary
        sales={selectedSales}
        fileSales={scopedSales}
        templates={templates}
        sector={cast.sector}
        day={look}
        state={selectedState}
        setup={setup}
        now={now}
        jobs={jobs}
        cast={cast}
        derived={derived}
        emailFeed={config.emailFeed}
        actor={config.owner.name}
        onSetup={onSetup}
        onConfigureEmail={() => { onClose(); window.location.hash = CONNECTIONS_EMAIL_HASH; }}
        schedules={outputSchedules}
        onSchedules={setOutputSchedules}
        onRemoveSchedule={(id) => setOutputSchedules(outputSchedules.map((schedule) => schedule.outputId === id && schedule.status !== 'cancelled' ? { ...schedule, status: 'cancelled', nextAt: undefined, updatedAt: new Date().toISOString(), updatedBy: config.owner.name } : schedule))}
        onNewTemplate={() => setView('new-template')}
        onNewInCategory={createTemplate}
        onOpenPrintScreen={openPrintScreen}
        onWriteTemplates={setTemplates}
      />
      </div>
    ) : (
      <DeliveryBatchHub
        sales={scopedSales}
        templates={templates}
        sector={cast.sector}
        today={today}
        prepClock={prepClock}
        cast={cast}
        derived={derived}
        onDownload={(batchDay, ids) => { setLook(batchDay); setPrepDownloadIds(ids); setView('file'); }}
        onSchedules={() => setView('templates')}
        onPrint={onPrintScreen}
      />
    );
  return (
    <div
      data-testid="export-modal"
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || reader === null) return;
        event.preventDefault();
        event.stopPropagation();
        setView(from);
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      {<div data-testid="export-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale400 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
          <div data-testid="export-salesperson-scope" aria-label="Export filters" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
            <ExportScopeFilters
              people={cast.owner.admin ? cast.comerciales : []}
              value={salesperson}
              onApply={(person) => { setSalesperson(person); setPreviewIds(null); }}
            />
            <span data-testid="export-salesperson-summary" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{scopeLabel}</span>
          </div>
        </div>
        {/* THE HEAD HOLDS ONE CONTROL, AND IT IS THE WAY OUT (OUT-02.2). «Templates» stood here,
            in the chrome, six pixels from Close — a library's own door filed with «leave» rather
            than with «this is what you own», and two controls of opposite meaning sharing one gap.
            The library is the first view now, so the door has nothing left to open. */}
        <span style={{ display: 'flex', justifyContent: 'flex-end' }}><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="export-close" aria-label="Close Prep" onClick={onClose} overrides={{ BaseButton: { style: { minWidth: '48px', minHeight: '48px', paddingLeft: 0, paddingRight: 0 } } }}><X size={20} aria-hidden /></Button></span>
      </div>}

      <PaperDay.Provider value={paperDay}>{body}</PaperDay.Provider>
    </div>
  );
}

/* ── THE HEADER CONTROL ───────────────────────────────────────────────────────────────────────
 * ONE MARK, ONE NUMBER (FEED-IA §37.2): «The export centre gets ONE main icon with its count;
 * everything else lives inside.»
 *
 * It used to wear three counts and a review ticker on the header bar — the print count, the ERP
 * count, the mail count, and «· 4 for review» standing beside them. Four numbers on a door is a
 * dashboard, and a person reading a dashboard is doing arithmetic instead of work. So the door
 * carries the STRONGEST number and only that: WHAT TODAY STILL OWES PAPER. It is the number the
 * day's own press button carries (§29.1), the number that falls as the morning is worked down, and
 * the one thing on this control a person acts on.
 *
 * THE OTHER THREE DID NOT DIE; THEY MOVED INSIDE, where each of them has room to be a sentence
 * rather than a digit — the ERP and mail rails state their own counts on their own rows, and the
 * review ticker stands under them, outside every count, exactly as §35.3 asks.
 *
 * AND THE SUMMARY IS ON THE HOVER. Base's own tooltip carries the words a mark leaves out (§30),
 * so the whole sentence — every rail's count, what is new since the last paper, what is still
 * coming out of the printer, what stands for review — is one hover away and is the control's aria.
 *
 * ⚠ ON A PHONE THERE IS NO HOVER, SO THERE IS NO TOOLTIP. A finger has nowhere to rest, so Base
 * opened the label on the press itself and painted a full-width black bar straight across the row
 * under the day — which on an administration seat is the «‹ Administration» back door, covered by
 * the label of the control the person just pressed. A hover label on a surface without a hover is
 * a slot with no job, and the canon's remedy for that is the slot, not shorter words: the sentence
 * is already the control's `aria-label`, where a phone's own reader takes it, and the counts it
 * lists are what the card behind the press opens on. Desk keeps the hover.
 */

export default function ExportCentre() {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { config, derived } = useConfig();
  const cast = derived.cast;
  const jobs = useQueue(cast.sector);
  const setup = usePrintSetup();
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const today = todayId(cast);

  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants, config]);
  const world = React.useMemo(() => railWorld(cast), [cast, grants, config]);
  const state = React.useMemo(() => exportState(sales, today, world), [sales, today, world]);
  /* THE DOOR'S MAIL COUNT IS THE LIVE MAILBOX'S (FEED-IA §247.2). `data-email` below read
     `railWorld`'s retired rail, so it stayed blank on a workspace whose Connections card, inbox,
     composer and scheduled-email destination all said Connected. */
  const mailbox = useEmailCapability();

  const [open, setOpen] = React.useState(false);
  const [card, setCard] = React.useState(false);
  const [printRequest, setPrintRequest] = React.useState<PrintScreenRequest | null>(null);
  const workflowHeight = useWorkflowViewport(open);
  const workflowPlacement = useWorkflowPlacement();
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('rocoto:export-visibility', { detail: { open } }));
    return () => { window.dispatchEvent(new CustomEvent('rocoto:export-visibility', { detail: { open: false } })); };
  }, [open]);
  /* ── AND THE FOLD SAYS THERE IS MORE UNDER IT (`better-layout` · HINT AT HIDDEN CONTENT) ────
     The library is 1232 px of content in a 600 px frame on a laptop, the platform scrollbar takes
     0 px, and the next section's heading lands 2 px below the edge — so a fresh house met two of
     the five categories and none of the foot with nothing on the screen saying so. The frame wears
     a scroll shadow: the two `local` layers are the card's own ground and scroll away with the
     content, the two `scroll` layers stay put, so a shadow stands at whichever edge has content
     behind it and nothing is drawn at the ends. DOM-neutral — no node, no testid, no geometry. */
  const exportFrame = React.useMemo(() => mergeOverrides(
    workflowCardOverrides({ padded: !card, visualHeight: workflowHeight }),
    { Card: {
      props: { id: 'export-center-panel', 'data-scroll-cue': card ? 'off' : 'on' },
      style: ({ $theme }: { $theme: import('baseui').Theme }) => (card ? {} : {
        padding: 'clamp(20px, 4vw, 40px)',
        backgroundColor: $theme.colors.backgroundPrimary,
        backgroundImage: [
          `linear-gradient(${$theme.colors.backgroundPrimary}, ${$theme.colors.backgroundPrimary})`,
          'linear-gradient(rgba(0,0,0,0.14), rgba(0,0,0,0))',
          `linear-gradient(${$theme.colors.backgroundPrimary}, ${$theme.colors.backgroundPrimary})`,
          'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.14))',
        ].join(', '),
        backgroundPosition: 'top, top, bottom, bottom',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 24px, 100% 12px, 100% 24px, 100% 12px',
        backgroundAttachment: 'local, scroll, local, scroll',
      }),
    } },
  ), [card, workflowHeight]);
  /* THE DAY'S OWN DOOR INTO HERE (OUT-03.2 · OUT-03.5). A day with no seats offers the place they
     are chosen; a seat holding a file or an email template opens that template's screen. Both
     press a control on the river, which mounts none of this — so they say it in one event. */
  React.useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener(OPEN_EXPORT_EVENT, openIt);
    return () => { window.removeEventListener(OPEN_EXPORT_EVENT, openIt); };
  }, []);
  useHistoryLayer({ id: 'export:center', active: open, onRestore: (snapshot) => setOpen(snapshot !== null) });
  useHistoryLayer({ id: 'export:print-setup', active: card, onRestore: (snapshot) => setCard(snapshot !== null) });
  useHistoryLayer({
    id: 'export:print-screen',
    active: printRequest !== null,
    snapshot: { request: printRequest ? JSON.stringify(printRequest) : null },
    onRestore: (snapshot) => {
      if (typeof snapshot?.request !== 'string') { setPrintRequest(null); return; }
      try { setPrintRequest(JSON.parse(snapshot.request) as PrintScreenRequest); }
      catch { setPrintRequest(null); }
    },
  });
  useRouteTransition(() => { setOpen(false); setCard(false); setPrintRequest(null); });
  const left = pagesWaiting(jobs);

  /* ── THE DOOR COUNTS WHAT A HAND MUST DO (CANON §5.3, §16.7) ─────────────────────────────
     «The export centre gets ONE main icon with its count» (§37.2), and the number is the LEAD
     rail's own — because a rail that acts on its own never puts a number on a door:

       paper house           today's albaranes owed paper; quiet at «All printed»
       system-first house    what the system is owed — normally 0 on a stream, the day's file
                             before its hour, and everything owed where the house presses
       both                  the paper, because that is the one a hand works down

     REVIEW IS NEVER IN THE BADGE and never hidden — it rides its own ticker inside (§35.3). And
     unread is never in it either: attention is not owed work (§66.1). */
  const systemFirst = false;
  const owed = systemFirst ? state.toErp.length : state.toPrint.length;
  /* ONE SENTENCE FOR THE WHOLE DOOR, on the hover label and on the aria (§30: Base's own hover
     labels carry the words a mark leaves out). Every count the face no longer draws is in it. */
  const says = [
    `${state.toPrint.length} to print`,
    state.newSincePrint.length > 0 ? `${state.newSincePrint.length} new since the last print` : null,
    left > 0 ? `${left} ${plural(left, 'page')} awaiting confirmation` : null,
    state.review.length > 0 ? `${state.review.length} for review` : null,
  ].filter(Boolean).join(' · ');

  const door = (
    <Button
      kind={KIND.tertiary}
      size={SIZE.compact}
      data-testid="export-centre"
      data-pages={left}
      data-print={state.toPrint.length}
      data-owed={owed}
      data-new={state.newSincePrint.length}
      data-erp={world.erp.connected ? state.toErp.length : ''}
      data-email={mailbox.posture === 'ready' ? state.scheduled.length : ''}
      data-review={state.review.length}
      aria-label={`Prep · ${says}`}
      aria-expanded={open} aria-controls="export-center-panel"
      onClick={() => setOpen(true)}
      style={{ minWidth: 0, paddingLeft: theme.sizing.scale300, paddingRight: theme.sizing.scale300 }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200, minWidth: 0 }}>
        <Glyph id={PACKING_MARK} size={18} />
        <span style={{ ...theme.typography.LabelXSmall, whiteSpace: 'nowrap' }}>Prep</span>
        <span data-testid="export-header-print" data-count={state.toPrint.length} hidden />
      </span>
    </Button>
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300, flex: '0 0 auto' }}>
      {/* The control itself is the glanceable status: paper, files, customer email and ERP all
          have a stable named seat. The modal gives each its detail and actions. */}
      {phone ? door : (
        <StatefulTooltip content={says} placement={TOOLTIP_PLACEMENT.bottom} showArrow>
          {door}
        </StatefulTooltip>
      )}

      <OverlayCard
        isOpen={open}
        onClose={() => { if (card) setCard(false); else setOpen(false); }}
        scrim={SCRIM.dim}
        size={800}
        /* E193.21 · the task frame's one placement law: docked on a phone, centred on a desk. */
        placement={workflowPlacement}
        ariaLabel={card ? 'Paper & copies' : 'Prep'}
        overrides={exportFrame}
      >
        <div style={{ display: card ? 'none' : 'contents' }}><Centre onSetup={() => setCard(true)} onClose={() => setOpen(false)} onExpandedChange={() => undefined} onPrintScreen={setPrintRequest} /></div>
        {card && <PrintSetupCard embedded onDone={() => setCard(false)} />}
      </OverlayCard>
      <PrintScreenCard request={printRequest} cast={cast} derived={derived} sales={sales} onClose={() => setPrintRequest(null)} />
    </span>
  );
}
