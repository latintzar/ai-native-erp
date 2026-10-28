/* AJUSTES — the app's own knobs, and nothing about the business.
 *
 * «App settings» (FEED-IA §53). THE BOUNDARY, resolved in THE-ADMIN-CANON §2: Administration holds
 * what is set RARELY and governs behaviour, and within that, THIS seat holds what is about the
 * SOFTWARE rather than about the house — the printer, what the house is told about, the language
 * the interface speaks, and the register of rules a person left running on products.
 *
 * The Linear lesson, applied: workflow configuration belongs in settings; the issues themselves
 * stay out. Tarifas, catálogo and clientes are daily work and live on the desk.
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ AJUSTES · one column, scrolling (§87) ──────────────────────────────────────────────────┐
 *   │ PRINTING       printer · A4/A5/Ticket · copies · valued/unvalued — one block, one home     │
 *   │ NOTIFICATIONS  event → channel. Every invisible thing the app does surfaces somewhere      │
 *   │ BRIEFINGS      §23's team briefing: what · at what hour · to whom, over the real sheet      │
 *   │ LANGUAGE       the interface's own language                                                │
 *   │ RULES          the register of what a person set on a product and left running             │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingXSmall (a section) · LabelMedium (a row) · ParagraphXSmall (its line).
 *   STATES       a rule's row carries its own removal, at the quietest weight the kit has; an empty
 *                register says where rules are MADE rather than that there are none.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { useConfig, type AlbaranShape, type AlbaranValues } from '../../config';
import { List, Row, Section } from '../../rows';
import { PrintSetupCard } from '../../shell/printing';
import { resetPrinting, setupWords, usePrintSetup } from '../../print-queue';
import PrintView from '../../print-view';
import { nearestTime, ruleSentence, seedRules, useRules, useRuleSaveError } from '../../rules';
import { buildSales, todayId, type Sale } from '../../sale';
import { resetDay, useDay } from '../../day';
import { useGrants, resetGrants } from '../../grants';
import { openProduct, useSetupTail } from '../../anchors';
import { PersonChip } from './team';
import {
  BRIEFING_BODIES, briefingHours, briefingWords, resetBriefing, seedBriefing, setBriefing,
  toggleBriefingTo, useBriefing, useBriefingSaveError,
} from '../../briefings';
import { usePhone } from '../../shell/viewport';
import {
  NOTIFY_CHANNELS, NOTIFY_EVENTS, memberOf, resetCompany, setCompany, useCompany,
  type Language, type NotifyChannel, type NotifyEvent,
} from '../../company';
import {
  DISPLAY_LANGUAGES, availableLanguages, companyLanguageOf, currentDisplayLanguage,
  displayLanguageStore, languageChoice, offeredSpanishEntry, writeDisplayLanguage,
  writeSpanishEntry, entryPath, type DisplayLanguage,
} from '../../display-language';
import type { AreaMeta } from '../../shell/area';
import { Roadmap } from '../../roadmap';
import { capabilityAvailable, PLANNED_CAPABILITY_HELP } from '../../release-profile';
import { resetTiers } from '../../tiers';
import { resetPhoneConnectionConfig } from '../../phone-connection-config';
import {
  resetWorkspaceCapabilities,
  setWorkspaceCapability,
  setWorkspaceCountry,
  useWorkspaceCapabilities,
  useWorkspaceCapabilityError,
} from '../../workspace-capabilities';
import { hasChannelWorkspace } from '../../cedar-channel-api';
import { phoneApi } from '../../phone-runtime';
import { disconnectEmail, readEmailStatus } from '../../email-api';
import { disconnectWhatsApp, proofApi } from '../../connections/api';
import type { ProofState } from '../../connections/types';
import { clearMadeCustomers } from '../../customers-made';
import { clearAccountEdits } from '../../customer-edits';
import { resetPartners } from '../../suppliers';
import { resetCollectionWorkspace } from '../../money-api';
import {
  disconnectProviders, providerWord, releaseProviderStores, releasedProviders,
  resetWorkspaceAndProviders, resetWorkspaceStores,
  type ProviderDisconnect, type ProviderId, type ProviderResult, type StoreReset,
} from '../../workspace-reset';

export const meta: AreaMeta = {
  id: 'app-settings',
  title: 'App settings',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

type Card = 'printing' | 'albaran-values' | 'albaran-shape' | 'language' | 'briefings' | 'reset-data' | 'reset-all' | NotifyEvent | null;

/* ── RESET CEDAR (FEED-IA §247.6) ─────────────────────────────────────────────────────────────
 * «give me a "reset cedar state" which lets all the data reset to default and removes all
 *  connections of whatsapp, phone and email. but genuinely removes them.»
 *
 * Two acts, one question each. `workspace-reset.ts` holds the inventory of every browser store
 * Cedar writes and the two operations; this seat wires the real stores' own reset functions and
 * the real providers' own disconnect calls into them, and states what each provider answered. */
const RESET_PROVIDERS: ReadonlyArray<{ provider: ProviderId; name: string }> = Object.freeze([
  { provider: 'whatsapp', name: 'WhatsApp' },
  { provider: 'phone', name: 'Phone' },
  { provider: 'email', name: 'Email' },
]);

/** WHAT THE HELD CARD IS DOING RIGHT NOW, named account by account. A spinner says that
 *  something is happening; this says what, so a wait that reaches a provider timeout is legible
 *  while it lasts and «Stop» is a decision a person can actually make. */
const askingWord = (provider: ProviderId): string => {
  if (provider === 'whatsapp') return 'Asking WhatsApp…';
  if (provider === 'phone') return 'Asking the phone service…';
  return 'Asking the mailbox provider…';
};

/** What one provider result says it released, in that provider's own unit. */
const releasedWord = (result: ProviderResult): string => {
  if (result.calls < 1) return '';
  if (result.provider === 'phone') return result.calls === 1 ? 'One line' : `${result.calls} lines`;
  if (result.provider === 'email') return result.calls === 1 ? 'One mailbox' : `${result.calls} mailboxes`;
  return 'One account';
};

const VALUE_PILLS: Array<{ value: AlbaranValues; label: string }> = [
  { value: 'valued', label: 'With prices' },
  { value: 'unvalued', label: 'Goods only' },
];

const SHAPE_PILLS: Array<{ value: AlbaranShape; label: string }> = [
  { value: 'full', label: 'A4, the full sheet' },
  { value: 'compact', label: 'A5, the compact half' },
];

export default function AppSettings() {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const { config, derived, set, reset } = useConfig();
  const company = useCompany();
  const cast = derived.cast;
  const printing = usePrintSetup();
  const rules = useRules();
  const ruleError = useRuleSaveError();
  const grants = useGrants();
  const ledger = useDay(cast.sector);
  const [card, setCard] = React.useState<Card>(null);
  const [resetError, setResetError] = React.useState('');
  const [resetBusy, setResetBusy] = React.useState(false);
  const [resetResults, setResetResults] = React.useState<ProviderResult[]>([]);
  /* THE WALK'S OWN STATE: which account is being asked, whether it was stopped, and the one
     controller «Stop» and the route both reach for. */
  const [resetAsking, setResetAsking] = React.useState<ProviderId | null>(null);
  const [resetStopped, setResetStopped] = React.useState(false);
  const [resetStopping, setResetStopping] = React.useState(false);
  const resetWalk = React.useRef<AbortController | null>(null);
  const albaranValuesAvailable = capabilityAvailable('albaranValues');
  const inventoryAvailable = capabilityAvailable('inventory');
  const workspaceCapabilities = useWorkspaceCapabilities();
  const capabilityError = useWorkspaceCapabilityError();

  const sales = React.useMemo(() => buildSales(cast, ledger), [cast, ledger, grants]);

  /* THE SHEET THE PAPER CARDS SHOW (FEED-IA §37.7). A REAL albarán off today's river, with enough
     lines on it to judge a layout by — a one-line document would answer neither question, and a
     drawing of an albarán is a picture that can quietly stop being true. */
  const paperSale = React.useMemo(() => {
    const today = todayId(cast);
    const enough = (s: Sale) => s.lines.length >= 3;
    return sales.find((s) => s.day === today && enough(s)) ?? sales.find(enough) ?? sales[0];
  }, [sales, cast]);

  /* THE REGISTER PLANTS ITS OWN FIRST ROW. One par rule on the house's first product at the hour
     that house keeps, once per catalogue — a register with nothing in it teaches nothing, and a
     demonstration that grows back after you delete it teaches the wrong thing. */
  React.useEffect(() => {
    if (!inventoryAvailable || !workspaceCapabilities.inventory) return;
    const first = cast.products[0];
    if (!first) return;
    seedRules({ sector: cast.sector, product: first.id, level: 40, unit: first.unit, replenishAt: nearestTime(cast.hour) });
  }, [cast, inventoryAvailable, workspaceCapabilities.inventory]);

  const live = rules.live.filter((r) => r.sector === cast.sector);
  const nameOf = (id: string) => cast.products.find((p) => p.id === id)?.name ?? id;
  /* ── THE LANGUAGE A PERSON IS READING, READ OFF THE DOCUMENT ITSELF ───────────────────────
   * Spanish is a generated build, not a runtime locale (`../../../../Spanish-snapshot.md`), so the
   * entry this page was served from IS the answer. Reading the saved field instead is what made
   * this row an inactive promise: it said Castellano while the screen stayed English. */
  const displayLanguage = currentDisplayLanguage();
  const language = DISPLAY_LANGUAGES.find((l) => l.value === displayLanguage) ?? DISPLAY_LANGUAGES[0];
  /* A LANGUAGE WITH NO BUILD IS NOT AN OPTION. The Spanish entry is a second built document, and
     only `tools/build-english-app.mjs` publishes one — so the running document's own marker says
     which languages this origin can actually hand somebody. Under `make dev` that is English. */
  const languages = availableLanguages(offeredSpanishEntry(typeof document === 'undefined' ? null : document));

  /* Choosing a language stores the preference, keeps the company record carrying the same answer,
     and goes to that language's entry with the surface a person is standing on still in the hash. */
  const chooseLanguage = (value: DisplayLanguage) => {
    const choice = languageChoice(value, window.location.pathname, window.location.hash);
    const store = displayLanguageStore();
    writeDisplayLanguage(store, choice.language);
    if (choice.language === 'es') writeSpanishEntry(store, choice.entry);
    setCompany({ language: companyLanguageOf(choice.language) as Language });
    if (choice.language === displayLanguage) { setCard(null); return; }
    window.location.assign(choice.to);
  };

  /* ── THE SCHEDULED BRIEFING (THE-CHECKPOINT §23) ──────────────────────────────────────────
   * «Send scheduled briefings to selected team members.» It plants the house's own hour and the
   * person who runs the house, once, so the row is a live fact rather than an empty form — and an
   * emptied roster then stays emptied, because that is a real answer. */
  const briefing = useBriefing();
  const briefingSaveError = useBriefingSaveError();
  const hours = React.useMemo(() => briefingHours(cast.hour), [cast.hour]);
  React.useEffect(() => {
    seedBriefing({ at: hours[1], to: [company.members[0].id] });
  }, [hours, company.members]);
  const goesTo = briefing.to
    .map((id) => memberOf(company, id)?.name)
    .filter((n): n is string => Boolean(n));

  /* ── A DOOR FROM AN OPERATIONAL SURFACE (§23: «relevant surfaces can deep-link») ───────────
   * `#/admin/app-settings/briefings` opens the briefing's own card on arrival, so the partner
   * forwarding rail — the other scheduled output — can send somebody straight to it rather than
   * dropping them on this seat to find it. Same tail scheme every «from your setup» door uses. */
  const tail = useSetupTail('app-settings');
  React.useEffect(() => {
    if (tail === 'briefings') setCard('briefings');
    if (tail === 'roadmap') window.requestAnimationFrame(() => document.getElementById('roadmap')?.scrollIntoView({ block: 'start' }));
  }, [tail]);

  /* THE DAY THE BRIEFING CARRIES — today's own round, so the paper in the card is the paper that
     would go out. Both bodies are read off one fold, the way every other surface in this app is. */
  const briefingDay = React.useMemo(() => todayId(cast), [cast]);

  /* ── THE TWO RESET ACTS, WIRED ─────────────────────────────────────────────────────────────
   * The sweep reaches every key the inventory names; the store resets below run after it, so a
   * store that writes its defaults back ends holding its seed. Then the event, then the reload
   * into the prepared workspace — `#/` is the entrance that seeds Sales (`App.tsx`), and the
   * English entry is where a default display language stands. */
  /* EVERY RESET FUNCTION THE INVENTORY NAMES IS CALLED HERE, and `test-workspace-reset.mjs` holds
     the two lists to each other. Four of them used to be declared and never run — and each does
     more than delete a key: `resetCollectionWorkspace` aborts the in-flight collection controllers
     and fires `rocoto:money-workspace-reset`, which is what `money-store.ts` and `money-overview`
     listen for, so a swept key with a live token still in module memory left the money surfaces
     behind the scrim talking to a workspace that had gone. */
  const storeResets = (): StoreReset[] => [
    { name: 'resetBriefing', run: () => resetBriefing(cast.sector) },
    { name: 'resetTiers', run: () => resetTiers(cast.sector) },
    { name: 'resetWorkspaceCapabilities', run: () => resetWorkspaceCapabilities(cast.sector) },
    { name: 'resetPhoneConnectionConfig', run: () => resetPhoneConnectionConfig(cast.sector) },
    { name: 'resetGrants', run: () => resetGrants() },
    { name: 'resetCompany', run: () => resetCompany() },
    { name: 'clearMadeCustomers', run: () => clearMadeCustomers() },
    { name: 'clearAccountEdits', run: () => clearAccountEdits() },
    { name: 'resetPartners', run: () => { resetPartners(); return true; } },
    { name: 'resetCollectionWorkspace', run: () => { resetCollectionWorkspace(cast.sector); return true; } },
    { name: 'resetDay', run: () => { resetDay(cast.sector); return true; } },
    { name: 'resetPrinting', run: () => { resetPrinting(); return true; } },
    { name: 'useConfig().reset', run: () => reset(cast.sector) },
  ];
  const browserStores = () => ({
    local: window.localStorage,
    session: window.sessionStorage,
    databases: window.indexedDB ?? null,
    announce: (event: string, detail: { scope: string; disconnect: boolean }) =>
      window.dispatchEvent(new CustomEvent(event, { detail })),
  });
  const resetInput = (disconnect: boolean) => ({
    scope: cast.sector,
    disconnect,
    ...browserStores(),
    stores: storeResets(),
  });
  /* GENUINE MEANS THE PROVIDER'S OWN OPERATION. Meta's session route, `phoneApi.disconnectLine`
     for every line the evidence carries, and the mailbox disconnect email setup already calls.
     Phone and email travel over the workspace's channel access; while that is pending they say so
     and the local reset still runs. */
  const providerWalk = (): ProviderDisconnect[] => {
    const channel = hasChannelWorkspace();
    return [
      { provider: 'whatsapp', run: async () => {
        const state = await proofApi<ProofState>('/state');
        if (!state.connection) return { calls: 0, outcome: 'absent' as const };
        await disconnectWhatsApp();
        window.dispatchEvent(new CustomEvent('cedar-whatsapp-refresh', { detail: { renew: true, disconnected: true } }));
        return { calls: 1, outcome: 'disconnected' as const };
      } },
      /* THE EVIDENCE READ COMES FIRST, AND THE RELEASES AFTER IT, so a walk stopped while the
         evidence is on its way releases nothing at all: `calls` counts what actually went. */
      { provider: 'phone', run: async (signal) => {
        if (!channel) return { calls: 0, outcome: 'held' as const };
        const lines = (await phoneApi.setup()).lines;
        if (!lines.length) return { calls: 0, outcome: 'absent' as const };
        let released = 0;
        for (const line of lines) {
          if (signal?.aborted) break;
          await phoneApi.disconnectLine(line.line_id);
          released += 1;
        }
        return { calls: released, outcome: 'disconnected' as const };
      } },
      { provider: 'email', run: async (signal) => {
        if (!channel) return { calls: 0, outcome: 'held' as const };
        const accounts = (await readEmailStatus()).accounts.filter((row) => row.mode === 'connected');
        if (!accounts.length) return { calls: 0, outcome: 'absent' as const };
        let released = 0;
        for (const account of accounts) {
          if (signal?.aborted) break;
          await disconnectEmail(account.account_ref);
          released += 1;
        }
        return { calls: released, outcome: 'disconnected' as const };
      } },
    ];
  };
  const stalledWord = 'This workspace cleared. Allow browser storage to write its defaults, then reset again.';
  const openPreparedWorkspace = () => {
    const entry = entryPath('en', window.location.pathname);
    if (entry === window.location.pathname) { window.location.hash = '#/'; window.location.reload(); return; }
    window.location.assign(`${entry}#/`);
  };
  const resetData = () => {
    const report = resetWorkspaceStores(resetInput(false));
    if (report.stalled.length) { setResetError(stalledWord); return; }
    setResetError('');
    openPreparedWorkspace();
  };
  /* A STOPPED WALK STATES EVERY ACCOUNT. The ones that answered for themselves carry their own
     word; the ones the walk never released are standing exactly as they were, so they read «Still
     connected» and carry the same «Try again» a refusal does. */
  const stoppedResults = (answered: ProviderResult[]): ProviderResult[] =>
    RESET_PROVIDERS.map(({ provider }) => answered.find((row) => row.provider === provider)
      ?? { provider, outcome: 'connected' as const, calls: 0, error: '' });
  const resetEverything = () => {
    if (resetBusy) return;
    const walk = new AbortController();
    resetWalk.current = walk;
    setResetBusy(true); setResetError(''); setResetStopped(false); setResetStopping(false); setResetAsking(null);
    void resetWorkspaceAndProviders({
      ...resetInput(true),
      providers: providerWalk(),
      signal: walk.signal,
      onAsking: (provider) => setResetAsking(provider),
    })
      .then(({ providers, report, stopped }) => {
        setResetStopped(stopped);
        setResetResults(stopped ? stoppedResults(providers) : providers);
        setResetError(report && report.stalled.length ? stalledWord : '');
      })
      .finally(() => { setResetBusy(false); setResetAsking(null); });
  };
  /* ── THE TWO WINDOWS, AND THE ROUTE THAT REACHED PAST BOTH ─────────────────────────────────
   * Escape and the scrim were held and browser Back was the door left open: Cedar is a hash
   * router, so a route change unmounts this seat and the card with it while the act carries on as
   * a detached promise. Each window answers it in the only honest way.
   *   in flight   stop the walk. It asks no further account and never reaches the sweep, so the
   *               workspace is exactly as it was and nothing wants a reload.
   *   swept       perform the reload. «Open the workspace» is that road taken deliberately, and
   *               this cleanup is the same road taken by anyone who leaves by the route — so a
   *               person who presses Back lands on a freshly loaded Cedar rather than on a live
   *               app whose stores went out from under it and whose modules, still holding their
   *               pre-reset book in memory (`dismissals.ts` BOOK, BORN, STOPPED), write it back. */
  const stopReset = () => { setResetStopping(true); resetWalk.current?.abort(); };
  React.useEffect(() => {
    if (!resetBusy) return undefined;
    const walk = resetWalk.current;
    const stop = () => walk?.abort();
    window.addEventListener('hashchange', stop);
    window.addEventListener('popstate', stop);
    return () => {
      window.removeEventListener('hashchange', stop);
      window.removeEventListener('popstate', stop);
      walk?.abort();
    };
  }, [resetBusy]);
  const resetSwept = card === 'reset-all' && resetResults.length > 0 && !resetStopped;
  React.useEffect(() => {
    if (!resetSwept) return undefined;
    return () => { openPreparedWorkspace(); };
  }, [resetSwept]);
  /* A RETRY THAT SUCCEEDS RELEASES THAT PROVIDER'S OWN MIRRORS, and nothing else moves — the
     workspace rows went with the first act. Until it succeeds those mirrors stand, so a mailbox
     that refused its DELETE keeps the cursor its intake reads the history from. */
  const retryProvider = (provider: ProviderId) => {
    if (resetBusy) return;
    const entry = providerWalk().find((row) => row.provider === provider);
    if (!entry) return;
    setResetBusy(true);
    void disconnectProviders([entry])
      .then(([result]) => {
        setResetResults((current) => current.map((row) => row.provider === provider ? result : row));
        if (releasedProviders([result]).length) {
          releaseProviderStores({ scope: cast.sector, provider, ...browserStores() });
        }
      })
      .finally(() => setResetBusy(false));
  };
  const openReset = (kind: 'reset-data' | 'reset-all') => {
    setResetResults([]); setResetError(''); setResetStopped(false); setResetStopping(false); setResetAsking(null);
    setCard(kind);
  };

  const pill = (on: boolean, label: string, testid: string, onClick: () => void) => (
    <span key={label} data-selected={on ? 'yes' : 'no'}>
      <Button kind={on ? KIND.primary : KIND.secondary} shape={SHAPE.pill} size={SIZE.compact} onClick={onClick} data-testid={testid}>
        {label}
      </Button>
    </span>
  );

  return (
    <div
      data-testid="seat-app-settings"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale900, minWidth: 0 }}
    >
      <Section title="Workspace features" testid="workspace-features">
        <List testid="workspace-feature-rows">
          <Row
            testid="workspace-pricing"
            mark="price"
            label="Pricing"
            sub="Tariffs, customer discounts and prices on working delivery notes."
            value={workspaceCapabilities.pricing ? 'On' : 'Off'}
            control={
              <Checkbox
                checked={workspaceCapabilities.pricing}
                onChange={(event) => setWorkspaceCapability('pricing', event.currentTarget.checked)}
                overrides={{ Input: { props: { 'data-testid': 'workspace-pricing-toggle', 'aria-label': 'Use pricing in this workspace' } } }}
              />
            }
          />
          <Row
            testid="workspace-money"
            mark="price"
            label="Money"
            sub="Invoices, payments and financial overview."
            value={workspaceCapabilities.money ? 'On' : 'Off'}
            control={<Checkbox checked={workspaceCapabilities.money}
              onChange={(event) => setWorkspaceCapability('money', event.currentTarget.checked)}
              overrides={{ Input: { props: { 'data-testid': 'workspace-money-toggle', 'aria-label': 'Use Money in this workspace' } } }} />}
          />
          <Row
            testid="workspace-inventory"
            mark="catalogue"
            label="Stock & lots"
            sub="Stock entries, available lots and allocation on delivery notes."
            value={workspaceCapabilities.inventory ? 'On' : 'Off'}
            control={
              <Checkbox
                checked={workspaceCapabilities.inventory}
                onChange={(event) => setWorkspaceCapability('inventory', event.currentTarget.checked)}
                overrides={{ Input: { props: { 'data-testid': 'workspace-inventory-toggle', 'aria-label': 'Use stock and lots in this workspace' } } }}
              />
            }
          />
        </List>
        {capabilityError && <p data-testid="workspace-capability-error" role="alert" style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{capabilityError}</p>}
      </Section>

      {/* ── PRINTING (FEED-IA §20, §37.7) ──────────────────────────────────────────────────
          «Print settings are set ONCE and customisable — a settings row, never a dialog per print.»
          Three rows about one sheet: the machine it comes out of, whether the money is on it, and
          the paper it prints on. */}
      <Section title="Printing" testid="printing">
        <List testid="print-rows">
          <Row
            testid="printer"
            mark="print"
            label="Paper & copies"
            sub="Choose the page size and default number of copies."
            value={setupWords(printing)}
            wrapValue
            onOpen={() => setCard('printing')}
          />
          <Row
            testid="albaran-values"
            mark="price"
            label="Prices on the delivery note"
            sub={albaranValuesAvailable ? 'Choose what appears on every delivery note.' : PLANNED_CAPABILITY_HELP}
            value={albaranValuesAvailable ? derived.albaran.valuesShort : 'Goods only'}
            wrapValue
            onOpen={albaranValuesAvailable ? () => setCard('albaran-values') : undefined}
          />
          <Row
            testid="albaran-shape"
            mark="doc"
            label="The delivery note’s structure"
            sub="A full A4 sheet, or the compact A5 half."
            value={derived.albaran.shapeShort}
            wrapValue
            onOpen={() => setCard('albaran-shape')}
          />
        </List>
      </Section>

      {/* ── NOTIFICATIONS ──────────────────────────────────────────────────────────────────
          Every invisible thing the app does has to be able to surface somewhere, and on this trade
          the channel is mostly WhatsApp itself — the same rail the customers are on. One row per
          event, one channel each. */}
      <Section title="What reaches you" testid="notifications">
        <List testid="notify-rows">
          {NOTIFY_EVENTS.map((e) => (
            <Row
              key={e.value}
              testid={`notify-${e.value}`}
              mark="send"
              label={e.label}
              sub={e.sub}
              value={NOTIFY_CHANNELS.find((c) => c.value === company.notify[e.value])?.label ?? ''}
              onOpen={() => setCard(e.value)}
            />
          ))}
        </List>
      </Section>

      {/* ── SCHEDULED BRIEFINGS (THE-CHECKPOINT §23) ───────────────────────────────────────
          «Send scheduled briefings to selected team members.» ONE ROW, and its value is the whole
          setting: what goes, at what hour, and to whom. It stands beside «What reaches you»
          because both answer the same question about the house — the one above is what reaches
          YOU when something happens, this is what reaches your PEOPLE on the clock.

          THE OTHER SCHEDULED OUTPUT IS NOT MOVED HERE. §23's first example — the sub-supplier
          send — is built as a partner's own daily list on Connections, and whether the two should
          be consolidated into one area is a seat decision recorded for Peter (§23.1). Until he
          rules, each stays where the work is. */}
      <Section title="Prepared briefings" testid="briefings">
        <List testid="briefing-rows">
          <Row
            testid="briefing"
            mark="clock"
            /* ── TWO WORDS, BECAUSE THE VALUE IS A CLAUSE (§77.2, read off the 390 shot) ───────
               A wrapping value takes 58% of the row and the label lives on what is left, so «The
               day's briefing» broke into three lines — «The / day's / briefing» — beside a value
               that says which day's paper it is anyway. The section names the kind; the row names
               the thing; the value carries the three facts.

               NO SUB, for the same shot's other half (§51.7 · AUDIT-2 C19): «It goes on its own,
               at the hour you set» said what the value already says — the hour IS the value's
               second fact — and at 390 it clamped mid-sentence. */
            label="The briefing"
            sub="Provider activation required."
            value={briefingWords(briefing, goesTo)}
            wrapValue
            onOpen={() => setCard('briefings')}
          />
        </List>
      </Section>

      {/* ── LANGUAGE ───────────────────────────────────────────────────────────────────────
          The INTERFACE's language, which is a different fact from the languages the AGENT holds a
          conversation in — those live on the agent's seat, where its voice does. */}
      <Section title="Language" lead="The words the app uses." testid="language">
        <List testid="language-rows">
          <Row
            testid="ui-language"
            mark="catalogue"
            label="App language"
            /* THE SUB NAMES WHAT THIS BUILD OFFERS, AND NOTHING ELSE (§246 review · the copy law).
               It used to add «Your country setting stays as it is.» — a reassurance that plants the
               doubt it answers. The two section leads say what each control is for; the row says
               which words are on the menu, which is a different fact in a build with one. */
            sub={languages.map((l) => l.label).join(' · ')}
            value={language.label}
            onOpen={() => setCard('language')}
          />
        </List>
      </Section>

      {/* ── RULES YOU SET ──────────────────────────────────────────────────────────────────
          THE REGISTER, and it is the second door onto rules a person set on a PRODUCT — one store,
          two surfaces (§43's «relationships surface both ways»). The rule still renders on its own
          product card in Stock; this is the list of every one of them. */}
      {inventoryAvailable && <Section
        title="Rules you left running"
        lead="Each rule announces its level daily, into the product’s ledger."
        testid="rules"
      >
        {ruleError && <p role="alert">{ruleError}</p>}
        {live.length > 0 ? (
          <List testid="rule-rows">
            {live.map((r) => (
              <Row
                key={r.id}
                testid={`rule-${r.id}`}
                mark="clock"
                /* A RULE IS ABOUT A PRODUCT, AND A PRODUCT IS AN OBJECT (§122 · §43). The row
                   named the goods and did nothing, on a register whose own comment says it is
                   «the second door onto rules a person set on a PRODUCT — one store, two
                   surfaces». The rule is MADE on the product's card, so that is where the name
                   goes: the second surface hands you back to the first. */
                label={nameOf(r.product)}
                sub={ruleSentence(r)}
                onOpen={() => openProduct(r.product)}
                control={
                  <span style={{ paddingRight: theme.sizing.scale500, flex: '0 0 auto' }}>
                    <Button
                      kind={KIND.tertiary}
                      size={SIZE.mini}
                      shape={SHAPE.pill}
                      onClick={() => rules.remove(r.id)}
                      data-testid={`delete-rule-${r.id}`}
                    >
                      Delete
                    </Button>
                  </span>
                }
              />
            ))}
          </List>
        ) : (
          <p
            data-testid="rules-empty"
            style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '60ch' }}
          >
            Rules are written in Stock, on the product card.
          </p>
        )}
      </Section>}


      <Section title="Country" lead="The market this workspace presents." testid="workspace-country">
        <List testid="workspace-country-rows">
          <Row testid="workspace-country-choice" mark="map" label="Workspace country"
            /* THE SUB IS TWO SHORT SENTENCES BECAUSE THE ROW IS SHARED WITH TWO PILLS. The longer
               wording clipped mid-word at 1600 behind «España · Perú»; the fact that survives is
               what each country actually reads. The lead above carries the rest. */
            sub="Peru reads soles. Spain reads euros."
            /* ON A PHONE THE PILLS SAY THE COUNTRY, SO THE VALUE STANDS DOWN (§246 review at
               320). «País del espacio de trabajo» plus «España · EUR» plus two pills is three
               columns on a 288px row; the label painted under the value. The value is the desk's. */
            {...(phone ? {} : { value: workspaceCapabilities.country === 'spain' ? 'Spain · EUR' : 'Peru · PEN' })}
            control={<div style={{ display: 'flex', gap: theme.sizing.scale200, flexShrink: 0 }}>
              {pill(workspaceCapabilities.country === 'spain', 'Spain', 'workspace-country-spain', () => { if (setWorkspaceCountry('spain')) window.location.reload(); })}
              {pill(workspaceCapabilities.country === 'peru', 'Peru', 'workspace-country-peru', () => { if (setWorkspaceCountry('peru')) window.location.reload(); })}
            </div>}
          />
        </List>
      </Section>

      {/* ── RESET CEDAR (FEED-IA §247.6) ───────────────────────────────────────────────────
          THE ROW THAT STOOD HERE REACHED SEVEN STORES. «Reset app setup» cleared the briefing,
          the tarifas, the capabilities, the phone draft, the grants, the company card and the
          config, and left the day ledger, Money, the onboarding progress, the drafts, the print
          journal, the dismissals, the activation ledger and every provider connection exactly
          where they were — so «this will let me then go through the connection flows again» was
          the one thing it could never do. Two acts now, one question each, and the inventory of
          what a Cedar world is made of lives in `workspace-reset.ts`. */}
      <Section title="Reset workspace" lead="This workspace, and the accounts it is connected to." testid="reset-cedar">
        <List testid="reset-cedar-rows">
          <Row
            testid="reset-workspace-data"
            mark="data"
            label="Reset workspace data"
            /* THE SUB CLAMPS AT TWO LINES (`rows.tsx` SUB) AND THE ROW CARRIES NO VALUE. A reset
               holds nothing to report, so «Seeded defaults» in the trailing column was a word
               about the act rather than a state — and it took the width the two facts a person
               decides on need: what goes back to default, and that the accounts stand. The full
               list is on the card behind the question. */
            sub="Orders, Money, setup, language and country reset. Connections stay."
            onOpen={() => openReset('reset-data')}
          />
          <Row
            testid="reset-and-disconnect"
            mark="connect"
            connect
            label="Reset and disconnect everything"
            sub={hasChannelWorkspace()
              ? 'The same reset, and your providers disconnect WhatsApp, phone and email.'
              : 'The same reset, and Meta disconnects WhatsApp. Phone and email stay.'}
            onOpen={() => openReset('reset-all')}
          />
        </List>
      </Section>

      {/* ── THE ROADMAP SITS BELOW THE MARKET CONTROL (§246 review) ────────────────────────────
          It used to stand between Language and Country, so the walk from «Idioma de la aplicación»
          to «País» — the two controls the Spain demo turns on — crossed nineteen English strings.
          Language and Country are neighbours, Reset Cedar stands under the two settings it
          returns to default (§247.6), and the roadmap closes the page. */}
      <Roadmap />

      {/* ── ONCE THE DISCONNECTING ACT HAS RUN, THE CARD HAS ONE EXIT ────────────────────────
          «Open the workspace» is the reload, and the reload is what makes the swept app match the
          swept stores. While the card was dismissable, Escape or a scrim click returned a person
          to a live Settings page whose stores had gone out from under it — and the modules still
          holding their pre-reset book in memory wrote it straight back on the next publish
          (`dismissals.ts` BOOK, BORN, STOPPED, and every swept store whose reset function runs at
          import). The walk itself is held the same way, so a dismissal mid-flight cannot hide a
          sweep that is still landing. The question before it stays dismissable: backing out of a
          question a person has yet to answer changes nothing — and so does a STOPPED card, which
          carries «Close», because a stopped walk swept nothing. Escape and the scrim are only two
          of the doors: `resetSwept` above closes the route as well, by performing the reload from
          the card's own unmount. */}
      <OverlayCard
        isOpen={card !== null}
        dismissable={!(card === 'reset-all' && (resetBusy || resetSwept))}
        onClose={() => setCard(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Setting"
      >
        {card === 'printing' ? (
          /* the identical component the first print of the house's life opens */
          <PrintSetupCard onDone={() => setCard(null)} />
        ) : (card === 'albaran-values' && albaranValuesAvailable) || card === 'albaran-shape' ? (
          <div data-testid="albaran-paper-card" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
            <div>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
                {card === 'albaran-values' ? 'Prices on the delivery note' : 'The delivery note’s structure'}
              </h2>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
                {card === 'albaran-values'
                  ? 'Customer delivery notes follow this choice. Hiding prices also hides them in chat confirmations. Internal prices and ERP data stay available.'
                  : 'Choose full A4 or compact A5. Both include traceability.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              {card === 'albaran-values'
                ? VALUE_PILLS.map((p) => pill(config.albaran.values === p.value, p.label, `albaran-values-${p.value}`, () => set({ albaran: { ...config.albaran, values: p.value } })))
                : SHAPE_PILLS.map((p) => pill(config.albaran.shape === p.value, p.label, `albaran-shape-${p.value}`, () => set({ albaran: { ...config.albaran, shape: p.value } })))}
            </div>
            <span
              data-testid={card === 'albaran-values' ? 'albaran-values-says' : 'albaran-shape-says'}
              style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, maxWidth: '58ch' }}
            >
              {card === 'albaran-values' ? derived.albaran.valuesLabel : derived.albaran.shapeLabel}
            </span>
            {/* THE CONSEQUENCE, IMMEDIATELY (§37.7). The REAL `PrintView` on a real sale, mounted
                as a sheet — press a pill and the paper under it redraws in the same breath. */}
            {paperSale && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                  What comes out of the printer
                </span>
                <div data-testid="albaran-paper-preview" style={{ minWidth: 0 }}>
                  <PrintView
                    cast={cast}
                    derived={derived}
                    subject={{ kind: 'albaran', sale: paperSale.id }}
                    sales={[paperSale]}
                    onClose={() => setCard(null)}
                    chrome="sheet"
                    stageWidth={phone ? 292 : 424}
                    height={phone ? 300 : 380}
                  />
                </div>
              </div>
            )}
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setCard(null)} data-testid="albaran-paper-done">
                Done
              </Button>
            </div>
          </div>
        ) : card === 'briefings' ? (
          /* ── THE BRIEFING'S OWN CARD ────────────────────────────────────────────────────
              THREE FACTS AND THE PAPER ITSELF. What · at what hour · to whom, and under them the
              REAL sheet on today's real round — the same `PrintView` the paper cards above mount,
              on the same day the river draws. A briefing whose body was a drawing would be a
              scheduled email nobody could check before it started going out every morning.

              AND IT IS NOT A BUILDER (§23.5). There is no trigger, no condition and no action
              list: the three rows below are the whole vocabulary, and every value in them comes
              off something the house already has. */
          <div data-question="briefings" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
            <div>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Prepare briefing</h2>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '54ch' }}>
                {briefingWords(briefing, goesTo)}. This plan will not send until a provider is activated.
              </p>
            </div>

            {briefingSaveError && (
              <div role="alert" data-testid="briefing-save-error" style={{ border: `1px solid ${theme.colors.negative}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, color: theme.colors.negative }}>
                {briefingSaveError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>What goes</span>
              <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
                {BRIEFING_BODIES.map((b) => pill(
                  briefing.body === b.value,
                  b.label,
                  `briefing-body-${b.value}`,
                  () => setBriefing({ body: b.value }),
                ))}
              </div>
              <span data-testid="briefing-body-says" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '58ch' }}>
                {BRIEFING_BODIES.find((b) => b.value === briefing.body)?.sub}
              </span>
            </div>

            {/* THE PAPER ITSELF, DIRECTLY UNDER THE CHOICE THAT CHANGES IT (§37.7, read off the
                shot). It stood at the FOOT of the card, under fourteen checkbox rows, so the one
                thing that answers «what actually goes out» was the last thing a person reached.
                The albarán's own paper card settles this: pills, then the sheet they redraw. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                What lands with them
              </span>
              <div data-testid="briefing-paper" data-body={briefing.body} style={{ minWidth: 0 }}>
                <PrintView
                  cast={cast}
                  derived={derived}
                  subject={briefing.body === 'packing'
                    ? { kind: 'packing', day: briefingDay }
                    : { kind: 'day', day: briefingDay }}
                  sales={sales}
                  onClose={() => setCard(null)}
                  chrome="sheet"
                  stageWidth={phone ? 292 : 424}
                  height={phone ? 300 : 380}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>At what hour</span>
              <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
                {hours.map((h) => pill(briefing.at === h, h, `briefing-hour-${h.replace(':', '')}`, () => setBriefing({ at: h })))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>To whom</span>
              <div
                data-testid="briefing-people"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: `1px solid ${theme.colors.borderOpaque}`,
                  borderRadius: theme.borders.radius200,
                  overflow: 'hidden',
                  minWidth: 0,
                }}
              >
                {company.members.map((m, i) => (
                  <div
                    key={m.id}
                    data-briefing-to={m.id}
                    data-on={briefing.to.includes(m.id) ? 'yes' : 'no'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.sizing.scale500,
                      padding: theme.sizing.scale500,
                      borderTop: i === 0 ? undefined : `1px solid ${theme.colors.borderOpaque}`,
                      minWidth: 0,
                    }}
                  >
                    {/* THE PERSON WHOLE (§43 · the PersonChip law): their name is a door into their
                        card, and the reach beside it answers «and how does it get to them».

                        THE TICK IS THE ROW'S OWN CONTROL AND THE ROW IS NOT A SECOND ONE. The name
                        is already a button; a row that was also a button would put one control
                        inside another, and a person aiming at the name would be toggling a
                        subscription. One target each, which is the chevron law read sideways. */}
                    <span style={{ display: 'flex', flex: 1, minWidth: 0 }}>
                      <PersonChip member={m} testid={`briefing-person-${m.id}`} />
                    </span>
                    <span style={{ flex: '0 0 auto' }}>
                      <Checkbox
                        checked={briefing.to.includes(m.id)}
                        onChange={() => toggleBriefingTo(m.id)}
                        overrides={{
                          Input: {
                            props: {
                              'data-testid': `briefing-to-${m.id}`,
                              'aria-label': `${m.name} gets the briefing`,
                            },
                          },
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Button kind={KIND.primary} size={SIZE.compact} disabled={Boolean(briefingSaveError)} onClick={() => { if (!briefingSaveError) setCard(null); }} data-testid="briefing-done">
                Save plan
              </Button>
            </div>
          </div>
        ) : card === 'language' ? (
          <div data-testid="language-card" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>App language</h2>
            {/* TWO PILLS AND THE SECTION LEAD SAY THE WHOLE THING (§246 review). The paragraph that
                stood here explained where the app reopens and what comes with you — sluff over a
                two-option picker, and its second sentence was a reassurance shaped as a denial. */}
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
              {languages.map((l) => pill(displayLanguage === l.value, l.label, `ui-language-${l.value}`, () => chooseLanguage(l.value)))}
            </div>
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setCard(null)} data-testid="language-done">
                Done
              </Button>
            </div>
          </div>
        ) : card === 'reset-data' || card === 'reset-all' ? (
          /* ── ONE QUESTION, ONE PRIMARY ACTION (the phone setup's own shape) ─────────────────
              The question is the heading at full weight; one paragraph says exactly what the act
              reaches; one button does it. After the disconnecting act, each provider states its
              own result and carries its own retry, so one refusal leaves the other two standing
              and the local reset it already applied stands with them. */
          <div
            data-testid="reset-card"
            data-reset-kind={card === 'reset-data' ? 'data' : 'all'}
            style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
          >
            <h2 data-testid="reset-question" style={{ margin: 0, ...theme.typography.HeadingSmall, overflowWrap: 'anywhere' }}>
              {card === 'reset-data' ? 'Reset this workspace’s data?' : 'Reset this workspace and disconnect every account?'}
            </h2>
            <p style={{ margin: 0, ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
              {card === 'reset-data'
                ? 'Orders, Money, setup progress, drafts, print history and every other record this workspace holds return to their seeded defaults. The app language returns to English and the country returns to Peru. WhatsApp, phone and email keep their connections, so the same accounts are standing when Rocoto reopens.'
                /* THE HOUSE READS THE NAMES IT CHOSE (THE-SOURCE-PRIVACY-SPEC SRC-PRIV-06). Meta is
                   the account a person connected themselves; the line and the mailbox are reached
                   through transports the house never picked, so Cedar speaks for those itself. */
                : 'The workspace returns to its seeded defaults. Rocoto then asks Meta to disconnect WhatsApp and releases every phone line and every mailbox, so each setup flow starts at its first screen again. The messages those providers already hold stay with them.'}
            </p>
            {resetResults.length > 0 && (
              <div
                data-testid="reset-results"
                className={css({
                  display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0,
                  opacity: 1,
                  transitionProperty: 'opacity',
                  transitionDuration: '400ms',
                  transitionTimingFunction: theme.animation.easeOutCurve,
                  '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
                })}
              >
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                  What each provider answered
                </span>
                {RESET_PROVIDERS.map(({ provider, name }) => {
                  const result = resetResults.find((row) => row.provider === provider);
                  if (!result) return null;
                  const released = releasedWord(result);
                  return (
                    <div
                      key={provider}
                      data-testid={`reset-result-${provider}`}
                      data-outcome={result.outcome}
                      style={{
                        display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0,
                        padding: theme.sizing.scale500,
                        border: `1px solid ${theme.colors.borderOpaque}`,
                        borderRadius: theme.borders.radius300,
                      }}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
                        <strong style={theme.typography.LabelMedium}>{name}</strong>
                        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
                          {providerWord(result.outcome)}{released ? ` · ${released}` : ''}{result.error ? ` · ${result.error}` : ''}
                        </span>
                      </span>
                      {/* THE ONE ACTION ON THIS CARD A HAND REACHES FOR ON A HANDSET, so it keeps
                          the 44 px target the rest of the app holds — it sits in a row that wraps
                          at 390, beside a reason two lines deep. */}
                      {result.outcome === 'connected' && (
                        <Button
                          kind={KIND.secondary}
                          size={SIZE.compact}
                          disabled={resetBusy}
                          onClick={() => retryProvider(provider)}
                          overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
                          data-testid={`reset-retry-${provider}`}
                        >
                          Try again
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {resetError && (
              <p role="alert" data-testid="reset-error" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.negative, maxWidth: '52ch' }}>
                {resetError}
              </p>
            )}
            {resetStopped && (
              <p data-testid="reset-stopped" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
                Stopped. Your data stays as it is.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
                {resetResults.length > 0 ? (
                  /* NOTHING WAS SWEPT, SO A STOPPED CARD CLOSES. Once the sweep has landed the
                     only exit is the reload, and the card's own unmount performs it. */
                  resetStopped ? (
                    <Button kind={KIND.primary} onClick={() => setCard(null)} data-testid="reset-close">
                      Close
                    </Button>
                  ) : (
                    <Button kind={KIND.primary} onClick={openPreparedWorkspace} data-testid="reset-open-workspace">
                      Open the workspace
                    </Button>
                  )
                ) : (
                  <Button
                    kind={KIND.primary}
                    isLoading={resetBusy}
                    onClick={card === 'reset-data' ? resetData : resetEverything}
                    data-testid="reset-confirm"
                  >
                    {card === 'reset-data' ? 'Reset workspace data' : 'Reset and disconnect everything'}
                  </Button>
                )}
                {/* THE WAIT IS AS LONG AS THE PROVIDERS TAKE — three channel calls, each with its
                    own timeout — so the hold carries its own way out, at the 44 px target the rest
                    of the app holds. Stopping is safe: the walk stands the sweep down. */}
                {resetBusy && resetResults.length === 0 && (
                  <Button
                    kind={KIND.tertiary}
                    size={SIZE.compact}
                    disabled={resetStopping}
                    onClick={stopReset}
                    overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
                    data-testid="reset-stop"
                  >
                    Stop
                  </Button>
                )}
              </div>
              {resetBusy && resetResults.length === 0 && resetAsking && (
                <p data-testid="reset-asking" data-stopping={resetStopping ? 'yes' : 'no'} style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                  {/* ONCE STOP IS PRESSED THE LINE NAMES THE STOP, because the last read can take
                      up to its own timeout to settle and the person has already stopped asking. */}
                  {resetStopping ? 'Stopping. Finishing the last check.' : askingWord(resetAsking)}
                </p>
              )}
            </div>
          </div>
        ) : card ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
              {NOTIFY_EVENTS.find((e) => e.value === card)?.label}
            </h2>
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
              {NOTIFY_CHANNELS.map((c) => pill(
                company.notify[card as NotifyEvent] === c.value,
                c.label,
                `notify-${card}-${c.value}`,
                () => setCompany({ notify: { ...company.notify, [card as NotifyEvent]: c.value as NotifyChannel } }),
              ))}
            </div>
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setCard(null)} data-testid="notify-done">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>
    </div>
  );
}
