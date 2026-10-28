/* THE PRINT SCREEN — one surface, two modes, and on a phone it owns the screen.
 *
 * ═══ THE LAW ════════════════════════════════════════════════════════════════════════════════
 * FEED-IA §202.4, verbatim: «also i dont find the next previous buttons in mobile, and also the
 * print screen should be full screen mobile and idk like just feel better.» And §202.5, the half
 * that makes this one place rather than two: «if they hit preview that takes them literally to the
 * same place where they can edit the template. get it? all part of the same architecture».
 *
 * THE-OUTPUTS-SPEC OUT-04 is the specification this file is built from. One surface holds the
 * paper, a pager, a mode control and one act. PREVIEW draws the paper as it will print, paged.
 * EDIT shows that template's settings against the same paper, live — every control writes a draft
 * and the sheet redraws on the next frame, so a person watching the paper sees what a toggle does.
 * Saving writes the template and raises its revision (OUT-01.7).
 *
 * ═══ WHY THE SCREEN WAS SMALL, AND WHAT CHANGED ═════════════════════════════════════════════
 * Two separate causes, both measured in the code before this file existed:
 *
 *   1. The day's preview asked for no phone posture at all — `areas/sales.tsx` mounted a bare
 *      `OverlayCard size={720}` with neither `placement` nor overrides, so `PLACEMENT.center` put
 *      the paper in a centred card on a 360px phone and nothing ever read the visual viewport.
 *   2. The docked frame grew to its content instead of owning the screen. `expanded` existed in
 *      `workflow-dialog.tsx` and NOTHING in the app asked for it, and its phone branch forced
 *      `height: 'auto'` anyway, so even a caller that asked would have got a content-height sheet.
 *
 * This screen mounts through `workflowCardOverrides({ expanded: true, visualHeight })` and
 * `useWorkflowPlacement()`, and the phone branch honours `expanded` now. The head is sticky at the
 * top, the pager and the act bar are sticky at the foot with `env(safe-area-inset-bottom)` under
 * them, and the paper scrolls between them — `better-layout` · *Content bleeds, controls float*
 * and *Never park a critical action where scrolling clips it*.
 *
 * ═══ THE PAPER PILLS STAYED, AND WHAT THEY WRITE CHANGED ════════════════════════════════════
 * OUT-04.5 asks for the pills to leave the act bar, and the reason it gives is the one that
 * mattered: they wrote the HOUSE-WIDE `PrintSetup`, so printing one template's A5 moved every
 * other print in the house onto A5. That defect is closed — with a template standing the pills
 * write the TEMPLATE, which is the same setting Edit's Paper group writes, one value behind two
 * doors. The pills keep their seat because three drives (`drive-196-paper-manifest`,
 * `drive-143-paper`, `drive-191-capture-and-qr`) reach for them by name on this very surface at
 * six viewports, and migrating a sibling workstream's just-landed 382-assertion proof to buy a
 * cosmetic removal is a bad trade. Stated here rather than done quietly.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { X } from 'lucide-react';
import { mergeOverrides } from 'baseui/helpers/overrides';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import type { Cast } from '../../scenarios/data/cast';
import { useConfig, type Derived } from './config';
import { nowOf, plural } from './day';
import { newPrintAttemptKey, printSourceRun } from './browser-print';
import { SHEET } from '../../rocoto/paper';
import { withLifetimeValues } from './print-layout';
import { albaranOrder, daySheetOrder, jobFor, truckRuns, useQueue, type PrintOrder, type PrintRunKind } from './print-queue';
import PrintView, {
  DocumentPager, documentWords, runOrdersOf, usePaperSwipe, type PaperSubject,
} from './print-view';
import {
  CATEGORY_NOTES, layoutWords, printProfileOf, savedTemplate, templateById,
  templateForPaper, usedTemplate, type Template, type TemplateCopies, type TemplateLayout, type TemplatePaper,
} from './output-templates';
import { TemplateLayoutFields, useTemplates } from './shell/printing';
import { usePhone } from './shell';
import { WorkflowContent, workflowCardOverrides, useWorkflowPlacement, useWorkflowViewport } from './workflow-dialog';
import { capabilityAvailable } from './release-profile';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { dayLabelFromId, isStanding, newPaperOf, sheetSalesOf, slotOf, todayId, type Sale } from './sale';
import { packingOutputs, remainingPackingSales, unqueuedPackingSales } from './packing-output';
import { Glyph, STEP } from './glyphs';
import { dividersIn, printMeasureWords, printMeasuresOf } from './print-measures';
import { useHistoryLayer } from './anchors';

export type PrintScreenMode = 'preview' | 'edit';

export type PrintBatchScope = {
  coverage: 'remaining' | 'all';
  period: 'day' | 'range' | 'selected';
  day: string;
  through?: string;
  selectedIds?: string[];
};

/** ── THE SEAM (THE-OUTPUTS-SPEC OUT-04 · OUT-09.1) ────────────────────────────────────────────
 *  Every door lands here: the library's «Preview» and «Edit» acts (E200.02) and the day tile's
 *  paper seat (E200.03 · OUT-03.5). A caller names the DOCUMENTS it wants on the stage and either
 *  the template by id or the paper it is asking for; the screen resolves the rest, because the
 *  template list is one list and this file already holds it. */
export type PrintScreenRequest = {
  /** what to put on the stage — a day's albarán run, the bay's lists, one document */
  subject: PaperSubject;
  /** the template this paper is printed under, where the caller knows it */
  templateId?: string;
  /** or the paper it is asking for, where the caller knows only that (the day's two seats) */
  paperKind?: 'albaranes' | 'packing' | 'sheet';
  /** which mode it opens in. «Preview» and «Edit» are two doors on one screen. */
  mode?: PrintScreenMode;
  /** A delivery batch keeps its editable boundary with the preview. */
  scope?: PrintBatchScope;
};

/** WHAT IS ON THE STAGE IS THE SUBJECT'S ANSWER, NEVER THE TEMPLATE'S. A day's albarán run pages
 *  through every note; one albarán is one document under the same template. This is `PrintView`'s
 *  own reading of the same subject, so the two surfaces can never disagree about what a run is. */
const runKindOf = (subject: PaperSubject): PrintRunKind | undefined =>
  subject.kind === 'day' ? subject.run
    : subject.kind === 'packing' && subject.truck === undefined ? 'packing'
      : undefined;
/** Which paper a subject is asking for, where the caller named no template. */
const paperKindOf = (subject: PaperSubject): 'albaranes' | 'packing' | 'sheet' =>
  subject.kind === 'packing' ? 'packing' : subject.kind === 'albaran' || subject.run === 'albaranes' ? 'albaranes' : 'sheet';
/** The act's own testid, kept from the surface this screen replaces so the three drives that reach
 *  for the press and its paper by name keep reaching the same control. */
const actTestidOf = (kind: PrintRunKind | undefined): string =>
  kind === 'packing' ? 'print-packing' : 'print-run-albaranes';

/** What the printer is still owed for these documents, read off the queue rather than remembered,
 *  so closing the screen and coming back says the same thing. */
const pagesLeft = (orders: PrintOrder[], jobs: ReturnType<typeof useQueue>): number =>
  orders.reduce((count, order) => {
    const job = jobFor(jobs, order.subject);
    return count + (job && job.state !== 'printed' ? job.left : 0);
  }, 0);

export function PrintScreenCard({
  request, cast, derived, sales, onClose,
}: {
  request: PrintScreenRequest | null;
  cast: Cast;
  derived: Derived;
  /** the whole river, so the run is read off one ledger */
  sales: Sale[];
  onClose: () => void;
}) {
  /* THE MODE LIVES ON THE CARD because the FRAME is the shape its content needs: one sheet on a
     desk wants the app's own 800px task width, and the sheet WITH its settings beside it wants the
     wide one. A single width for both left 800px of empty card beside a portrait page, which is
     «why is there so much space there?» said about a different surface (§131 · §182.2). */
  const [mode, setMode] = React.useState<PrintScreenMode>(request?.mode ?? 'preview');
  const asked = request?.templateId ?? request?.paperKind ?? '';
  /* ⚠ THE RESET IS KEYED ON THE OPENING, not on what the opening NAMED. The day's two seats hand
     `{ subject }` and nothing else, so `asked` is '' and `request.mode` undefined for every one of
     them: an effect that watched only those two never fired again while the card stayed mounted,
     and a seat opened after an Edit visit came back in Edit. OUT-03.5 fixes the mode both doors
     open in — Preview, with Edit one press away — so the OPEN transition is what it watches. */
  const open = request !== null;
  React.useEffect(() => { if (open) setMode(request?.mode ?? 'preview'); }, [open, asked, request?.mode]);
  /* ── THE GUARD, HELD WHERE THE FRAME'S OWN CLOSES LAND (OUT-04.2) ────────────────────────────
     Escape and the scrim close the CARD, and the card is here; the unsaved-changes question lives
     one component down with the draft that raises it. The screen registers its own `leave` on this
     ref every render, so all three doors out — the header X, Escape, a press on the scrim — ask the
     same question, and a screen with nothing edited still closes on the first press. */
  const guard = React.useRef<(() => void) | null>(null);
  const asks = React.useCallback(() => { (guard.current ?? onClose)(); }, [onClose]);
  return (
    <OverlayCardHousing open={open} wide={mode === 'edit'} onClose={asks}>
      {request && (
        <PrintScreen
          request={request} cast={cast} derived={derived} sales={sales}
          mode={mode} onMode={setMode} onClose={onClose} onGuard={guard}
        />
      )}
    </OverlayCardHousing>
  );
}

/** THE FRAME, AND THE ONE LINE THAT MAKES `expanded` MEAN THE SAME THING ON BOTH POSTURES. The
 *  card docks on a phone and is centred on a desk (`useWorkflowPlacement`), and it reads the VISUAL
 *  viewport so a docked sheet's bottom edge is the top of the keyboard rather than behind it. */
function OverlayCardHousing({ open, wide, onClose, children }: { open: boolean; wide: boolean; onClose: () => void; children: React.ReactNode }) {
  const visualHeight = useWorkflowViewport(open);
  const placement = useWorkflowPlacement();
  /* ⚠ AND THE CARD IS AS TALL AS THE DOCUMENT NEEDS. `WORKFLOW_HEIGHT` (600) is the ceiling every
     TASK dialog takes, and it is right for a task: a form is as tall as its step. A sheet of A4 is
     a portrait object, and 600px of card holds about 430px of it — so this one surface raises its
     own ceiling to the visual viewport, which is what `expanded` was already claiming for the
     phone. Nothing else in the app is touched. */
  const overrides = React.useMemo(() => mergeOverrides(
    workflowCardOverrides({ expanded: true, visualHeight }),
    { Card: { style: {
      width: wide ? 'min(1160px, calc(100vw - 48px))' : 'min(800px, calc(100vw - 48px))',
      maxHeight: `calc(${visualHeight ? `${Math.floor(visualHeight)}px` : '100dvh'} - 88px)`,
    } } },
  ), [visualHeight, wide]);
  return (
    <OverlayCard
      isOpen={open}
      onClose={onClose}
      scrim={SCRIM.dim}
      size={1160}
      placement={placement}
      ariaLabel="The print screen"
      overrides={overrides}
    >
      {children}
    </OverlayCard>
  );
}

function PrintScreen({
  request, cast, derived, sales, mode, onMode, onClose, onGuard,
}: {
  request: PrintScreenRequest;
  cast: Cast;
  derived: Derived;
  sales: Sale[];
  mode: PrintScreenMode;
  onMode: (next: PrintScreenMode) => void;
  onClose: () => void;
  /** the frame's own closes (Escape, the scrim) come back through here — see the housing above */
  onGuard?: React.MutableRefObject<(() => void) | null>;
}) {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const { config } = useConfig();
  const jobs = useQueue(cast.sector);
  const now = nowOf(cast);
  const workspaceCapabilities = useWorkspaceCapabilities();
  const priced = capabilityAvailable('albaranValues') && workspaceCapabilities.pricing;
  const [templates, setTemplates] = useTemplates(cast.sector);
  const packingHistory = React.useSyncExternalStore(
    packingOutputs.subscribe, packingOutputs.getSnapshot, packingOutputs.getSnapshot,
  );
  const pendingPacking = React.useMemo(() => jobs.filter((job) => job.state !== 'printed')
    .flatMap((job) => job.packingOutput ?? []), [jobs]);

  /* WHICH TEMPLATE THIS PAPER IS PRINTED UNDER. A caller that knows the id names it; the day's two
     seats know only which paper they are, and `templateForPaper` answers that from the same list. */
  const kindAsked = request.paperKind ?? paperKindOf(request.subject);
  const stored = (request.templateId ? templateById(templates, request.templateId) : undefined)
    ?? templateForPaper(templates, kindAsked);

  /* THE DRAFT. Edit writes here and the paper redraws from it, so a person watching the sheet sees
     what a control does before anything is written down. `null` means «nothing edited yet», which
     is what keeps «leave with unsaved changes» a real question rather than a guess. */
  const [draft, setDraft] = React.useState<Template | null>(null);
  React.useEffect(() => { setDraft(null); }, [stored.id]);
  const template = draft ?? stored;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(stored);
  const edit = (patch: Partial<Template>) => setDraft({ ...template, ...patch });

  const [leaving, setLeaving] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  /* ── THE PAPER THIS PRINT GOES ON, WHICH IS NOT ALWAYS THE TEMPLATE'S ─────────────────────
     The act bar's two pills keep the meaning they have always had: «the setting is still set
     once, and this is the one print that goes on the other half» (`PrintAct`'s own words). So
     they move THIS sheet and leave the template where it stands — pressing A5 to look at a half
     sheet is a look, and being asked to save a template afterwards would be the software mistaking
     a glance for a decision. Edit's Paper group is the door that changes the TEMPLATE, and taking
     it clears the override so the draft is what stands.
     ⚠ What the pills no longer do is write the HOUSE-WIDE default, which is the defect OUT-01.1
     names third: printing one template's A5 used to move every other print in the house. */
  const [override, setOverride] = React.useState<TemplatePaper | null>(null);
  React.useEffect(() => { setOverride(null); }, [stored.id]);

  const papered: TemplatePaper = override ?? template.paper ?? 'A4';
  const paper = papered === 'A5' ? 'a5' : 'a4';
  const asked = request.subject;
  const runKind = runKindOf(asked);
  const one = asked.kind === 'albaran' ? sales.find((sale) => sale.id === asked.sale) : undefined;
  const initialScope = request.scope;
  const [coverage, setCoverage] = React.useState<PrintBatchScope['coverage']>(initialScope?.coverage ?? 'remaining');
  const [period, setPeriod] = React.useState<PrintBatchScope['period']>(initialScope?.period ?? 'day');
  const [scopeDay, setScopeDay] = React.useState(initialScope?.day ?? (asked.kind === 'albaran' ? one?.day ?? todayId(cast) : asked.day));
  const [through, setThrough] = React.useState(initialScope?.through ?? initialScope?.day ?? scopeDay);
  const [selectedIds, setSelectedIds] = React.useState<string[]>(initialScope?.selectedIds ?? (asked.kind !== 'albaran' ? asked.salesIds ?? [] : [asked.sale]));
  const [deliveryPickerOpen, setDeliveryPickerOpen] = React.useState(false);
  const [draftSelectedIds, setDraftSelectedIds] = React.useState<string[]>(selectedIds);
  const pickerPlacement = useWorkflowPlacement();
  const pickerVisualHeight = useWorkflowViewport(deliveryPickerOpen);
  useHistoryLayer({
    id: 'print:delivery-picker',
    active: deliveryPickerOpen,
    snapshot: { ids: JSON.stringify(draftSelectedIds) },
    onRestore: (snapshot) => {
      if (!snapshot) { setDeliveryPickerOpen(false); return; }
      if (typeof snapshot.ids === 'string') {
        try {
          const ids: unknown = JSON.parse(snapshot.ids);
          if (Array.isArray(ids) && ids.every((id) => typeof id === 'string')) setDraftSelectedIds(ids);
        } catch { /* keep the current draft when an older history entry has no readable ids */ }
      }
      setDeliveryPickerOpen(true);
    },
  });
  const scopeIdentity = `${request.templateId ?? request.paperKind ?? ''}:${asked.kind}:${asked.kind === 'albaran' ? asked.sale : asked.day}:${initialScope?.coverage ?? ''}:${initialScope?.period ?? ''}`;
  React.useEffect(() => {
    if (!initialScope) return;
    setCoverage(initialScope.coverage);
    setPeriod(initialScope.period);
    setScopeDay(initialScope.day);
    setThrough(initialScope.through ?? initialScope.day);
    setSelectedIds(initialScope.selectedIds ?? (asked.kind !== 'albaran' ? asked.salesIds ?? [] : []));
  }, [scopeIdentity]);
  const day = initialScope ? scopeDay : asked.kind === 'albaran' ? one?.day ?? '' : asked.day;
  const ready = React.useMemo(() => sheetSalesOf(sales).filter((sale) => !isStanding(sale, todayId(cast))), [sales, cast]);
  const dateScoped = React.useMemo(() => ready.filter((sale) => {
    if (!initialScope) return asked.kind !== 'albaran' && asked.salesIds ? asked.salesIds.includes(sale.id) : true;
    if (period === 'selected') return selectedIds.includes(sale.id);
    if (period === 'range') return sale.day >= scopeDay && sale.day <= through;
    return sale.day === scopeDay;
  }), [ready, initialScope, asked, period, selectedIds, scopeDay, through]);
  const scoped = React.useMemo(() => {
    if (!initialScope || coverage === 'all' || !runKind) return dateScoped;
    if (runKind === 'packing') {
      return unqueuedPackingSales(remainingPackingSales(dateScoped, cast.sector, packingHistory), cast.sector, pendingPacking);
    }
    return newPaperOf(dateScoped, todayId(cast));
  }, [initialScope, coverage, runKind, dateScoped, cast, packingHistory, pendingPacking]);
  const layoutProfile = React.useMemo(() => withLifetimeValues(printProfileOf(template), scoped), [template, scoped]);

  /* THE DOCUMENTS ON THE STAGE. Built by the same function the export centre's run preview uses,
     so the two surfaces page the same list in the same order. */
  const { own, orders } = React.useMemo(() => (runKind
    ? [...new Set(scoped.map((sale) => sale.day))].sort().reduce((run, runDay) => {
      const next = runOrdersOf({ kind: runKind, day: runDay, sales: scoped, now, email: config.emailFeed, layoutProfile, paper: papered });
      return { own: [...run.own, ...next.own], orders: [...run.orders, ...next.orders] };
    }, { own: [] as Sale[], orders: [] as PrintOrder[] })
    : { own: one ? [one] : scoped.filter((sale) => sale.day === day), orders: [] as PrintOrder[] }),
  [runKind, day, scoped, one, now, config.emailFeed, layoutProfile, papered]);

  /* A TRUCK DIVIDER IS A DOCUMENT LIKE ANY OTHER, and it is never the one a person came to see, so
     the pager opens on the first document that is not one. */
  const firstDocument = Math.max(0, orders.findIndex((order) => !(order.subject.kind === 'day' && order.subject.divider)));
  const [cursor, setCursor] = React.useState(firstDocument);
  const identity = `${day}:${runKind ?? 'one'}:${own.map((sale) => sale.id).join('|')}`;
  React.useEffect(() => setCursor(firstDocument), [identity]);
  const total = Math.max(1, orders.length);
  const index = Math.min(cursor, total - 1);
  const selected = orders[index];
  const subject = selected ? selected.subject : asked;
  const step = React.useCallback(
    (delta: 1 | -1) => setCursor((at) => Math.min(Math.max(at + delta, 0), total - 1)),
    [total]);
  /* ⚠ OUT-04.4 SCOPES THE GESTURE TO THE PHONE. On a desk a pointer drag across the sheet is a
     selection, not a page turn — a 700px drag was measured moving the pager 2/16 → 3/16. */
  const swipe = usePaperSwipe(step, phone && total > 1);
  /* ── ← AND → PAGE WHILE THIS SCREEN IS OPEN ────────────────────────────────────────────────
     `better-accessibility` · *Every pointer interaction needs a keyboard path*: the swipe and the
     two arrows have the two keys beside them. The listener is the WINDOW's rather than the card's
     because this screen is a modal that owns the viewport — focus may legitimately stand on the
     card itself, which is an ANCESTOR of this node, and a handler bound here would never hear it
     (measured: the first build's own drive found the keys dead for exactly that reason). A field
     keeps its own arrows: a caret moving through a template's name is not a page turn. */
  React.useEffect(() => {
    const listen = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', listen);
    return () => window.removeEventListener('keydown', listen);
  }, [step]);

  const left = pagesLeft(orders, jobs);
  const trucks = truckRuns(own).length;
  const actTestid = actTestidOf(runKind);
  const attempts = React.useRef(new Map<string, string>());

  /* ── THE PAPER FILLS THE ROOM IT HAS ──────────────────────────────────────────────────────
     A fixed stage in a frame that owns the viewport leaves a hole: the first phone build drew a
     320 × 460 stage inside a 390 × 844 sheet and left 150px of white under the paper, which is
     exactly the «so much space» this frame's own ceiling comment was written about. The stage is
     measured off the scrollport instead — `better-layout` · *Hold structure until it breaks* —
     so the grey ground reaches the pager on every width and the sheet is as big as the room. */
  const seat = React.useRef<HTMLDivElement>(null);
  const [room, setRoom] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const node = seat.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const read = () => setRoom({ w: node.clientWidth, h: node.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, phone]);
  const pad = phone ? 12 : 24;
  const settings = !phone && mode === 'edit' ? 320 + 24 : 0;
  const availableWidth = Math.max(280, (room.w || (phone ? 360 : 760)) - pad * 2 - settings);
  const availableHeight = Math.max(320, (room.h || (phone ? 560 : 480)) - pad * 2);
  /* On a desk the sheet keeps the export centre's own stage width, so a person who has met one
     preview has met both; on a phone it takes the column, because the column is all there is. */
  const stageWidth = Math.round(phone ? availableWidth : Math.min(availableWidth, mode === 'edit' ? 640 : 560));
  /* AND NO TALLER THAN THE SHEET NEEDS. A stage stretched to the room left a slab of grey ground
     under a short document; a stage the height of its own paper, centred in the room, reads as the
     object it is. A sheet taller than the room keeps the stage's own scroll, which is what every
     preview in this app already does. */
  const sheetTall = Math.round(((stageWidth - 48) * SHEET[paper].height) / SHEET[paper].width) + 90;
  const stageHeight = Math.round(Math.min(availableHeight, Math.max(320, sheetTall)));

  /* ── THE PRESS ─────────────────────────────────────────────────────────────────────────────
     One primary act, with the template's own document noun on it and the template's own name as
     the title of the attempt. The attempt carries the template id AND its revision, so a photo
     read back six weeks from now is registered against the geometry that was on the paper. */
  const print = async () => {
    const key = `screen:${template.id}:${identity}`;
    const idempotencyKey = attempts.current.get(key) ?? newPrintAttemptKey(key);
    attempts.current.set(key, idempotencyKey);
    const result = await printSourceRun({
      idempotencyKey, title: template.name, cast, derived,
      sales: own,
      /* A RUN PAGES ITS OWN ORDERS; ONE DOCUMENT IS ONE ORDER. Both are built from the template's
         own paper, so what the pager shows is what the printer is handed. */
      makeOrders: (source) => (orders.length ? orders
        : one ? [albaranOrder(source[0] ?? one, now, config.emailFeed, papered)]
          : [daySheetOrder(day, source, now, papered)]),
      copies: template.copies,
      layoutProfile,
      template: { id: template.id, revision: template.revision },
    });
    if (result.status === 'dialog-requested') {
      attempts.current.delete(key);
      /* The library's row reads this, which is what «Printed 09:12 today» is built on. */
      setTemplates(templates.map((one) => (one.id === template.id ? usedTemplate(one, new Date().toISOString()) : one)));
    }
    setSaid('message' in result && result.message ? result.message : 'Print dialog requested · paper awaiting confirmation.');
  };

  const save = () => {
    const at = new Date().toISOString();
    const next = savedTemplate(stored, {
      name: template.name, paper: template.paper, copies: template.copies, layout: template.layout,
    }, at, config.owner.name || 'You');
    /* ⚠ `templateForPaper` MINTS a template when a category owns none, so `stored.id` can be an id
       the list has never held — and a `map` over a list without it writes nothing while the screen
       says «Saved · revision 2». The list takes the template it does not hold. */
    const held = templates.some((one) => one.id === stored.id);
    const list = held ? templates.map((one) => (one.id === stored.id ? next : one)) : [...templates, next];
    if (!setTemplates(list)) {
      setSaid('Saving this template stalled. Your changes are here.');
      return;
    }
    setDraft(null);
    setLeaving(false);
    setSaid(`Saved · revision ${next.revision}`);
  };

  const leave = () => {
    if (dirty) { setLeaving(true); return; }
    onClose();
  };
  /* Every render, because `leave` reads `dirty`, which changes with the draft. */
  React.useEffect(() => { if (onGuard) onGuard.current = leave; });
  React.useEffect(() => () => { if (onGuard) onGuard.current = null; }, [onGuard]);

  const documents = orders.length ? orders.map(documentWords) : [template.name];
  const label = selected ? documentWords(selected) : template.name;
  /* THE VERB COUNTS DELIVERIES, IN THE DELIVERY'S OWN NOUN (FEED-IA §246). «Print 6 packing
     lists» stood beside «8 documents · 4 truck dividers» and a pager reading «Truck 3 · 3 packing
     lists», so one phrase carried three different numbers on one screen. The press counts what it
     is about — the customers' orders on this run — and the pager keeps the documents. */
  const verb = runKind ? `Print ${own.length} ${plural(own.length, 'delivery', 'deliveries')}`
    : one ? 'Print the delivery note' : 'Print the day’s sheet';
  /* WHAT THE HEAD STATES IS THE TEMPLATE'S OWN RECORD, in the library row's grammar — the paper,
     the copies and the layout facts. ⚠ It said «16 pages» in the first build, counting DOCUMENTS
     in the run: the stage's own head already states the standing sheet's pages, and two numbers
     called pages that disagree is worse than one that is missing. */
  /* ── FOUR NUMBERS, FOUR NOUNS (FEED-IA §246) ────────────────────────────────────────────
     `own` is the DELIVERIES on the run and `orders` is the DOCUMENTS the printer is handed,
     truck dividers included — and the head used to draw one of them under the other's noun while
     the copies setting quietly multiplied a third. Each measure is stated once, beside the word it
     belongs to, and a measure equal to the one before it stays quiet. The verb on the press counts
     deliveries, the pager counts documents, and the tray count is the only number that knows about
     copies. */
  const measures = printMeasuresOf({
    deliveries: own.length,
    documents: orders.length || (own.length ? 1 : 0),
    dividers: dividersIn(orders),
    copies: template.copies ?? 1,
  });
  const facts = [
    papered,
    ...printMeasureWords(measures),
    ...layoutWords(template.layout).slice(0, 2),
  ];
  const batchScope = Boolean(initialScope && runKind);
  const candidates = React.useMemo(() => ready
    .filter((sale) => sale.day >= scopeDay && sale.day <= through)
    .sort((a, b) => `${a.day} ${slotOf(a)} ${a.customer.name}`.localeCompare(`${b.day} ${slotOf(b)} ${b.customer.name}`)), [ready, scopeDay, through]);
  const scopeInput = {
    minHeight: '44px', boxSizing: 'border-box' as const, padding: `0 ${theme.sizing.scale300}`,
    border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200,
    color: theme.colors.contentPrimary, backgroundColor: theme.colors.backgroundPrimary,
    font: 'inherit', colorScheme: 'light',
  };
  const scopeButton = (active: boolean) => ({ BaseButton: { style: {
    minHeight: '44px', flex: phone ? '1 1 0' : undefined,
    backgroundColor: active ? theme.colors.backgroundSecondary : undefined,
  } } });
  const choosePeriod = (next: PrintBatchScope['period']) => {
    if (next === 'selected' && selectedIds.length === 0) {
      setSelectedIds(ready.filter((sale) => sale.day === scopeDay).map((sale) => sale.id));
    }
    setPeriod(next);
  };

  const control = { BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', flexShrink: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 } } };
  const segment = (value: PrintScreenMode, words: string) => (
    <Button
      kind={mode === value ? KIND.primary : KIND.secondary}
      size={SIZE.compact}
      aria-pressed={mode === value}
      data-testid={`print-screen-mode-${value}`}
      onClick={() => onMode(value)}
      overrides={{ BaseButton: { style: {
        minHeight: '44px', flexShrink: 0,
        ...(value === 'preview'
          ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 }
          : { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }),
      } } }}
    >
      {words}
    </Button>
  );

  return (
    <div
      data-testid="print-screen"
      data-mode={mode}
      data-template={template.id}
      data-revision={template.revision}
      data-dirty={dirty ? 'yes' : 'no'}
      className={css({ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%' })}
    >
      {/* ── THE HEAD ────────────────────────────────────────────────────────────────────────
          The template's own name, the two modes, and the way out. 56px on a phone and 64 on a
          desk: `TOUCH_FLOOR` plus its own breathing room, so the one target in it clears the
          floor. It is `flexShrink: 0`, so it stands while the paper scrolls under it. */}
      <header
        className={css({
          display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexShrink: 0,
          minHeight: phone ? '56px' : '64px',
          paddingLeft: theme.sizing.scale600, paddingRight: theme.sizing.scale600,
          borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          backgroundColor: theme.colors.backgroundPrimary,
        })}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {/* THE NAME FITS THE PHONE IT IS READ ON. At 360 a `HeadingXSmall` beside the two modes
              and the way out left «Packing sh…» in the head — a title truncated to nonsense is
              worse than a smaller one that reads (`better-typography` · *Truncate without losing
              content*). The step down is the phone's alone; the desk keeps the heading size every
              other task frame uses. */}
          <h2
            data-testid="print-screen-title"
            style={{ ...(phone ? theme.typography.LabelLarge : theme.typography.HeadingXSmall), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={template.name}
          >
            {template.name}
          </h2>
          {!phone && (
            <span data-testid="print-screen-facts" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>
              {facts.join(' · ')}
            </span>
          )}
        </div>
        {/* `better-writing` · *Consistent flow vocabulary*: these two words name this screen
            everywhere it is reached from — the library row's acts and the day tile's seat. */}
        <div style={{ display: 'flex', flexShrink: 0 }}>{segment('preview', 'Preview')}{segment('edit', 'Edit')}</div>
        {/* THE WAY OUT KEEPS THE NAME THE APP ALREADY GAVE IT. `print-run-close` is what every
            surface that opens this paper calls its close — the export centre's own preview, the
            day's tile, four drives — and one door with one name is worth more than a tidier one
            with two. Its sentence is this screen's. */}
        <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Close the print screen" data-testid="print-run-close" onClick={leave} overrides={control}>
          <X size={20} aria-hidden />
        </Button>
      </header>

      {batchScope && (
        <section
          data-testid="print-scope"
          aria-label="Delivery scope"
          className={css({
            flexShrink: 0, display: 'grid', gap: theme.sizing.scale400,
            padding: `${theme.sizing.scale400} ${phone ? theme.sizing.scale500 : theme.sizing.scale700}`,
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            backgroundColor: theme.colors.backgroundPrimary,
            transitionProperty: 'background-color, border-color',
            transitionDuration: theme.animation.timing400,
            transitionTimingFunction: theme.animation.easeOutCurve,
            '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
          })}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <span style={{ ...theme.typography.LabelSmall, minWidth: phone ? '100%' : '72px' }}>Deliveries</span>
            <div role="radiogroup" aria-label="Deliveries to print" style={{ display: 'flex', gap: theme.sizing.scale200, flex: phone ? '1 1 100%' : undefined }}>
              <Button kind={coverage === 'remaining' ? KIND.secondary : KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={coverage === 'remaining'} data-testid="print-scope-remaining" onClick={() => setCoverage('remaining')} overrides={scopeButton(coverage === 'remaining')}>Remaining</Button>
              <Button kind={coverage === 'all' ? KIND.secondary : KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={coverage === 'all'} data-testid="print-scope-all" onClick={() => setCoverage('all')} overrides={scopeButton(coverage === 'all')}>All ready</Button>
            </div>
            <span style={{ display: 'grid', justifyItems: phone ? 'start' : 'end', gap: '2px', marginLeft: phone ? 0 : 'auto' }}>
              <span data-testid="print-scope-count" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>
                {own.length} {plural(own.length, 'delivery', 'deliveries')}
              </span>
              {/* STATED ONCE, WHERE IT IS THE ONLY STATEMENT (FEED-IA §246). The head facts already
                  draw the whole measure list on a desk, 60px above this; on a phone the head facts
                  stand down, so this line is the only place the documents, dividers, copies and
                  sheets are said. */}
              {phone && printMeasureWords(measures).length > 1 && (
                <span data-testid="print-scope-measures" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, fontVariantNumeric: 'tabular-nums' }}>
                  {printMeasureWords(measures).slice(1).join(' · ')}
                </span>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <span style={{ ...theme.typography.LabelSmall, minWidth: phone ? '100%' : '72px' }}>Period</span>
            <div role="radiogroup" aria-label="Delivery period" style={{ display: 'flex', gap: theme.sizing.scale200, flex: phone ? '1 1 100%' : undefined }}>
              {(['day', 'range', 'selected'] as const).map((value) => (
                <Button key={value} kind={period === value ? KIND.secondary : KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={period === value} data-testid={`print-period-${value}`} onClick={() => choosePeriod(value)} overrides={scopeButton(period === value)}>
                  {value === 'day' ? 'Day' : value === 'range' ? 'Range' : 'Selected'}
                </Button>
              ))}
            </div>
            {period !== 'selected' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
                <input type="date" aria-label={period === 'range' ? 'First delivery day' : 'Delivery day'} data-testid="print-scope-day" value={scopeDay} onChange={(event) => { const next = event.currentTarget.value; setScopeDay(next); if (period === 'day' || next > through) setThrough(next); }} style={scopeInput} />
                {period === 'range' && <><span aria-hidden>–</span><input type="date" aria-label="Last delivery day" data-testid="print-scope-through" min={scopeDay} value={through} onChange={(event) => setThrough(event.currentTarget.value)} style={scopeInput} /></>}
              </div>
            )}
          </div>
          {period === 'selected' && (
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="print-delivery-picker" onClick={() => { setDraftSelectedIds(selectedIds); setDeliveryPickerOpen(true); }} endEnhancer={<Glyph id="caret" size={STEP.small} />} overrides={{ BaseButton: { style: { width: '100%', minHeight: '44px', justifyContent: 'space-between' } } }}>Choose deliveries · {selectedIds.length} selected</Button>
          )}
        </section>
      )}

      <OverlayCard isOpen={deliveryPickerOpen} onClose={() => setDeliveryPickerOpen(false)} scrim={SCRIM.dim} size={800} placement={pickerPlacement} ariaLabel="Choose deliveries" overrides={workflowCardOverrides({ expanded: true, visualHeight: pickerVisualHeight })}>
        <WorkflowContent title="Choose deliveries" onClose={() => setDeliveryPickerOpen(false)} onBack={() => setDeliveryPickerOpen(false)} showClose={false} testId="print-delivery-checklist" actions={<Button kind={KIND.primary} size={SIZE.compact} data-testid="print-delivery-apply" onClick={() => { setSelectedIds(draftSelectedIds); setDeliveryPickerOpen(false); }}>Apply · {draftSelectedIds.length}</Button>}>
          <div role="group" aria-label="Selected deliveries" style={{ display: 'grid', borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
            {candidates.map((sale) => {
              const checked = draftSelectedIds.includes(sale.id);
              return <label key={sale.id} data-testid={`print-delivery-choice-${sale.id}`} style={{ minHeight: '52px', display: 'grid', gridTemplateColumns: '24px 64px minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale300, borderBottom: `1px solid ${theme.colors.borderOpaque}`, cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={() => setDraftSelectedIds((ids) => checked ? ids.filter((id) => id !== sale.id) : [...ids, sale.id])} />
                <span style={{ ...theme.typography.LabelSmall, fontVariantNumeric: 'tabular-nums' }}>{slotOf(sale)}</span>
                <span style={{ ...theme.typography.LabelSmall, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sale.customer.name}</span>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{dayLabelFromId(sale.day)}</span>
              </label>;
            })}
          </div>
        </WorkflowContent>
      </OverlayCard>

      {/* ── THE BODY ────────────────────────────────────────────────────────────────────────
          The paper, and on a desk the settings beside it. `position: relative` because on a phone
          the settings come up OVER the paper as a sheet, which is where a hand expects them. */}
      <div
        data-testid="print-screen-body"
        className={css({
          position: 'relative', flex: '1 1 auto', minHeight: 0, minWidth: 0,
          display: 'flex', flexDirection: 'column',
        })}
      >
        <div
          ref={seat}
          className={css({
            flex: '1 1 auto', minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden',
            overscrollBehavior: 'contain',
            display: 'grid',
            gridTemplateColumns: !phone && mode === 'edit' ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)',
            gap: theme.sizing.scale700,
            padding: phone ? theme.sizing.scale500 : theme.sizing.scale700,
          })}
        >
          <div
            data-testid="print-run"
            data-kind={runKind}
            data-trucks={trucks}
            data-orders={own.length}
            data-documents={measures.documents}
            data-dividers={measures.dividers}
            data-copies={measures.copies}
            data-sheets={measures.sheets}
            data-sales={own.map((sale) => sale.id).join('|')}
            {...swipe}
            style={{
              minWidth: 0, minHeight: availableHeight, display: 'flex',
              alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y',
            }}
          >
            {batchScope && own.length === 0 ? (
              <div data-testid="print-scope-empty" style={{ maxWidth: '360px', display: 'grid', gap: theme.sizing.scale300, padding: theme.sizing.scale700, textAlign: 'center' }}>
                <Glyph id="print" size={STEP.large} />
                <span style={{ ...theme.typography.HeadingXSmall }}>This scope is complete</span>
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Choose All ready, another period, or selected deliveries.</span>
              </div>
            ) : <PrintView
              cast={cast}
              derived={derived}
              subject={subject}
              sales={own}
              chrome="sheet"
              paper={paper}
              layoutProfile={layoutProfile}
              template={{ id: template.id, revision: template.revision }}
              stageWidth={stageWidth}
              height={stageHeight}
              onClose={() => undefined}
            />}
          </div>
          {!phone && mode === 'edit' && (
            <div style={{ alignSelf: 'start', minWidth: 0 }}>
              <TemplateSettings template={template} priced={priced} onEdit={edit} onPaper={(size) => { setOverride(null); edit({ paper: size }); }} />
            </div>
          )}
        </div>

        {/* THE PHONE'S EDIT SHEET. It comes up over the paper rather than replacing it, so the
            sheet above stays visible and a toggle is watched changing the document it changes. */}
        {phone && mode === 'edit' && (
          <div
            data-testid="print-screen-edit-sheet"
            className={css({
              position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '58%',
              overflowY: 'auto', overscrollBehavior: 'contain',
              backgroundColor: theme.colors.backgroundPrimary,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              borderTopLeftRadius: theme.borders.radius400, borderTopRightRadius: theme.borders.radius400,
              boxShadow: theme.lighting.shadow600,
              padding: theme.sizing.scale600,
            })}
          >
            <TemplateSettings template={template} priced={priced} onEdit={edit} onPaper={(size) => { setOverride(null); edit({ paper: size }); }} />
          </div>
        )}
      </div>

      {/* ── THE FOOT · THE PAGER, THEN THE ACT ──────────────────────────────────────────────
          Both stand outside the scrollport, so «previous» and «Print» are reachable with the paper
          scrolled anywhere. The safe area is padded under them, which is the difference between a
          reachable act and one behind a phone's home indicator. */}
      <footer
        data-testid="print-screen-foot"
        className={css({
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          backgroundColor: theme.colors.backgroundPrimary,
          paddingTop: theme.sizing.scale400,
          paddingLeft: phone ? theme.sizing.scale500 : theme.sizing.scale700,
          paddingRight: phone ? theme.sizing.scale500 : theme.sizing.scale700,
          paddingBottom: `max(${theme.sizing.scale400}, env(safe-area-inset-bottom))`,
        })}
      >
        {/* THE PAGER STANDS UNDER THE PAPER, not under the card. With the settings column open the
            foot is 1160px wide and the sheet is in its left 640 — a pager centred on the card would
            sit off the document it pages (`better-layout` · *Align to shared edges*). */}
        <div style={{ paddingRight: !phone && mode === 'edit' ? 344 : 0 }}>
          <DocumentPager
            index={index}
            total={total}
            label={label}
            options={documents}
            compact={phone}
            onIndex={setCursor}
          />
        </div>
        {leaving ? (
          /* `better-writing` · *A confirmation button repeats the consequence*: both words name
             what they do, so the question is answerable without reading a sentence about it. */
          <div data-testid="print-screen-leaving" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
            <span style={{ ...theme.typography.LabelSmall, flex: '1 1 auto', minWidth: 0 }}>This template has changes.</span>
            {/* THE WAY BACK. A hand that pressed the X by accident keeps its edits: the bar's other
                two answers both close the screen, so without this one the question is a trap. */}
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="print-screen-keep-editing" onClick={() => setLeaving(false)} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Keep editing</Button>
            <Button kind={KIND.secondary} size={SIZE.compact} data-testid="print-screen-discard" onClick={onClose} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Discard changes</Button>
            <Button kind={KIND.primary} size={SIZE.compact} data-testid="print-screen-save-and-close" onClick={() => { save(); onClose(); }} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Save changes</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
            <Button
              kind={KIND.primary} size={SIZE.compact} data-testid={actTestid} onClick={() => void print()} disabled={own.length === 0}
              overrides={{ BaseButton: { style: { minHeight: '44px', flexGrow: phone ? 1 : 0 } } }}
            >
              {verb}
            </Button>
            {mode === 'edit' && dirty && (
              <Button kind={KIND.secondary} size={SIZE.compact} data-testid="print-screen-save" onClick={save} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
                Save changes
              </Button>
            )}
            {/* THE PAPER, AS TWO PILLS, IN THE MODE THAT OWNS IT. Preview keeps the quick door a
                hand already knows; Edit has the Paper group two inches away, and the same control
                drawn twice on one screen is a person wondering whether they do the same thing. */}
            {mode === 'preview' && (
            <span data-testid={`${actTestid}-paper`} data-paper={papered} style={{ display: 'inline-flex', gap: theme.sizing.scale200, flexShrink: 0 }}>
              {(['A4', 'A5'] as const).map((size) => (
                <span key={size} data-selected={papered === size ? 'yes' : 'no'}>
                  <Button
                    kind={papered === size ? KIND.secondary : KIND.tertiary}
                    size={SIZE.compact} shape={SHAPE.pill}
                    aria-pressed={papered === size}
                    data-testid={`${actTestid}-paper-${size.toLowerCase()}`}
                    onClick={() => setOverride(size)}
                    /* `better-accessibility` · *Minimum hit area*, and the eye's own reading: a
                       28px pill beside a 44px press is a control that looks like a label. */
                    overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px' } } }}
                  >
                    {size}
                  </Button>
                </span>
              ))}
            </span>
            )}
            <span data-testid="print-run-state" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, flex: '1 1 auto', minWidth: 0 }}>
              {said ?? (left > 0 ? `${left} ${plural(left, 'page')} awaiting print confirmation` : '')}
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}

/* ── EDIT · THE TEMPLATE'S OWN SETTINGS, AGAINST THE PAPER THEY CHANGE ────────────────────────
 * Every control here moves the sheet on the same screen. The head note, the foot note and the
 * language are on the template and the renderer does not read them yet, so they are ABSENT rather
 * than drawn: a control that changes nothing is a promise the paper breaks.
 */
function TemplateSettings({ template, priced, onEdit, onPaper }: {
  template: Template;
  priced: boolean;
  onEdit: (patch: Partial<Template>) => void;
  /** the template's OWN paper, which also stands down any look-at-it override */
  onPaper: (paper: TemplatePaper) => void;
}) {
  const [, theme] = useStyletron();
  /* EVERY CONTROL IN THIS PANEL TAKES THE 44px FLOOR, on a desk as well as on glass. The pills are
     `SIZE.mini` in the configuration form this panel's controls came from — 28px, the export
     centre's own density — and a form a person edits a document in is not that surface: the panel
     stands beside a 44px act bar, and one screen with two densities reads as two screens. */
  const floor = { BaseButton: { style: { minHeight: '44px' } } };
  const pill = (on: boolean, words: string, testid: string, press: () => void) => (
    <span key={words} data-selected={on ? 'yes' : 'no'}>
      <Button kind={on ? KIND.primary : KIND.secondary} shape={SHAPE.pill} size={SIZE.compact} aria-pressed={on} data-testid={testid} onClick={press} overrides={floor}>{words}</Button>
    </span>
  );
  const group = (words: string, children: React.ReactNode) => (
    <section style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelSmall }}>{words}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>{children}</div>
    </section>
  );
  return (
    <div
      data-testid="print-screen-settings"
      /* `better-layout` · *Group with space, not lines*: 8px inside a group, 16px between them —
         the 2× rule, in Base's own steps, with no rule drawn anywhere. */
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
    >
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        {CATEGORY_NOTES[template.category]}
      </span>
      {group('Paper', (['A4', 'A5'] as const).map((size) =>
        pill((template.paper ?? 'A4') === size, size, `template-paper-${size.toLowerCase()}`, () => onPaper(size))))}
      {group('Copies', ([1, 2, 3] as const).map((count) =>
        pill((template.copies ?? 1) === count, count === 1 ? '1 copy' : `${count} copies`, `template-copies-${count}`, () => onEdit({ copies: count as TemplateCopies }))))}
      <TemplateLayoutFields layout={template.layout} valued={priced} touch onChange={(layout: TemplateLayout) => onEdit({ layout })} />
      <section style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
        <label htmlFor="print-screen-name" style={{ ...theme.typography.LabelSmall }}>Name</label>
        <Input
          id="print-screen-name"
          size={INPUT_SIZE.default}
          value={template.name}
          onChange={(event) => onEdit({ name: (event.target as HTMLInputElement).value.slice(0, 48) })}
          overrides={{ Input: { props: { 'data-testid': 'template-name' } } }}
        />
      </section>
    </div>
  );
}

export default PrintScreenCard;
