/* RESET CEDAR — THE INVENTORY OF EVERY BROWSER STORE CEDAR WRITES, AND THE TWO ACTS.
 *
 * «give me a "reset cedar state" which lets all the data reset to default and removes all
 *  connections of whatsapp, phone and email. but genuinely removes them. this will let me then go
 *  through the connection flows again if i want to etc. or maybe give na option to reset and reset
 *  AND remove connections too»                                     — Peter, FEED-IA §247.6
 *
 * ═══ WHY THIS FILE EXISTS ══════════════════════════════════════════════════════════════════════
 * Settings already had a reset, and it reached seven stores: the briefing, the tarifas, the
 * workspace capabilities, the phone draft, the grants, the company card and the app config. The
 * day ledger, Money, onboarding progress, reply drafts, the print journal, the dismissals, the
 * activation ledger, the Meta preview draft, the advance plan and every provider connection stood
 * exactly as they were — so a person who pressed it could never walk a connection flow again.
 *
 * A reset is only total when it reaches EVERY key, so the list of what a Cedar world is made of
 * lives here, once, as data. `app/tools/test-workspace-reset.mjs` derives the same list by
 * reading every storage call in `app/src` and fails when a key lands that this inventory never
 * names, so the next store registers by adding its row rather than by being remembered.
 *
 * ═══ THE THREE FATES ═══════════════════════════════════════════════════════════════════════════
 *   workspace   synthetic data seeded from a cast. Both acts return it to its seed.
 *   connection  a local flag, cursor or device registration that MIRRORS a provider account, and
 *               each row NAMES the account it mirrors. «Reset workspace data» keeps these, so the
 *               connections stand exactly as they are and the intake keeps its place in the
 *               history it already read. «Reset and disconnect everything» clears a row only when
 *               that provider's own call answered — `disconnected` or `absent`. A mailbox that
 *               refused its DELETE keeps its cursor, so its intake keeps its place too, and a
 *               retry that succeeds releases that provider's mirrors then.
 *   kept        the person's own browser preference, the development runtime pin, and the opaque
 *               channel workspace the phone and email disconnects travel through. Dropping that
 *               access record would hand a person a fresh empty workspace while their real account
 *               stayed connected at the provider — which is the very thing §247.6 calls out.
 *
 * ═══ WHAT IS PURE HERE, AND WHAT IS WIRED OUTSIDE ══════════════════════════════════════════════
 * This module imports nothing. It holds the inventory, the plan a scope produces from it, the
 * sweep, the provider walk and the word each provider result is stated in. The Settings screen
 * supplies the real stores' own reset functions and the real providers' own disconnect calls, and
 * `resetWorkspaceStores` runs the sweep FIRST and those reset functions AFTER, so a store that
 * writes its defaults back (the app config, the company card) ends the act holding its seed.
 *
 * ═══ THE SHARED CONTRACT ═══════════════════════════════════════════════════════════════════════
 * `WORKSPACE_RESET_EVENT` carries `{scope, disconnect}` and fires AFTER the keys are cleared and,
 * for the disconnecting act, AFTER every provider call has returned. A store that holds a
 * connection flag or a provider snapshot in module memory listens for it and returns to its
 * initial posture — `money-store.ts`, `money-bank-api.ts`, `money-overview.tsx`, `money-credit.tsx`,
 * `whatsapp-connection.tsx` and `email-provider.ts` own those listeners, and the tool test holds
 * the three provider stores to them. `phone-runtime.ts` and `cedar-channel-api.ts` already return
 * on `rocoto:channel-workspace-reset` and on a `storage` event with a null key.
 *
 * ⚠ AN UNSCOPED KEY HOLDS THE STANDING HOUSE. Half these stores keep one house at a time
 * (`rocoto-app-day` keeps its sectors inside one value), so a sweep of an unscoped key returns
 * every house's copy to its seed. Cedar stands in one house, and each of those stores re-seeds
 * itself from its cast on the next read, so the act is still «this workspace returns to default».
 * The scoped rows below are the ones that genuinely belong to one scope, and they are removed for
 * that scope alone.
 */

/** The event every store that holds connection state or a provider snapshot listens for. */
export const WORKSPACE_RESET_EVENT = 'rocoto:cedar-workspace-reset';

/** How a row's `key` becomes the key a browser actually holds. */
export type CedarStoreShape =
  /** the whole key, written out */
  | 'exact'
  /** `key` + the workspace scope, and that scope alone */
  | 'scoped'
  /** every stored key that starts with `key` */
  | 'prefix';

export type CedarStoreMedium = 'local' | 'session' | 'indexed';

/** What each act does with the row. */
export type CedarStoreFate = 'workspace' | 'connection' | 'kept';

/** The three accounts a Cedar workspace connects to. Each one answers for itself. */
export type ProviderId = 'whatsapp' | 'phone' | 'email';

export type CedarStore = {
  /** the exact key, or the start every key in this family shares */
  key: string;
  shape: CedarStoreShape;
  medium: CedarStoreMedium;
  /** the module that writes it */
  owner: string;
  fate: CedarStoreFate;
  /** the account this row mirrors — every `connection` row names one */
  provider?: ProviderId;
  /** the store's own reset function, where it has one */
  reset?: string;
  /** RETIRED: nothing in the tree writes this key any more, and the note names the change that
   *  retired its writer. The row stays so Reset Cedar keeps its promise to a browser that wrote
   *  the key under an earlier build; the tool test holds the inverse — a retired key that the tree
   *  still writes is a row lying about its retirement. */
  retired?: string;
};

const store = (
  key: string,
  shape: CedarStoreShape,
  owner: string,
  fate: CedarStoreFate,
  reset?: string,
  medium: CedarStoreMedium = 'local',
): CedarStore => ({ key, shape, medium, owner, fate, ...(reset ? { reset } : {}) });

/** A KEY A RETIRED WRITER LEFT BEHIND. Swept as workspace data; written by nothing in the tree. */
const retired = (
  key: string,
  shape: CedarStoreShape,
  owner: string,
  note: string,
  medium: CedarStoreMedium = 'local',
): CedarStore => ({ key, shape, medium, owner, fate: 'workspace', retired: note });

/** A LOCAL MIRROR OF ONE PROVIDER ACCOUNT. It goes when that provider's own call says it has. */
const mirror = (
  key: string,
  shape: CedarStoreShape,
  owner: string,
  provider: ProviderId,
  medium: CedarStoreMedium = 'local',
): CedarStore => ({ key, shape, medium, owner, fate: 'connection', provider });

/* ── THE INVENTORY ────────────────────────────────────────────────────────────────────────────
 * Every row is one storage family, with the module that writes it beside it. A reviewer diffs
 * this against `grep -rn "Storage\." app/src`; the tool test does that diff on every run. */
export const CEDAR_STORES: readonly CedarStore[] = Object.freeze([
  /* THE APP'S OWN ANSWERS AND THE HOUSE THEY BELONG TO */
  store('rocoto-app-config', 'exact', 'config.ts', 'workspace', 'useConfig().reset'),
  store('rocoto-app-company', 'exact', 'company.ts', 'workspace', 'resetCompany'),
  store('rocoto-app-grants', 'exact', 'grants.ts', 'workspace', 'resetGrants'),
  store('rocoto-app-activation', 'exact', 'activation.ts', 'workspace'),
  store('rocoto-app-front-door', 'exact', 'activation-web.tsx', 'workspace'),
  store('rocoto-workspace-capabilities', 'prefix', 'workspace-capabilities.ts', 'workspace', 'resetWorkspaceCapabilities'),

  /* THE DAY, THE ORDERS AND WHAT A HAND CHANGED ON THEM */
  store('rocoto-app-day', 'exact', 'day.ts', 'workspace', 'resetDay'),
  store('rocoto-app-round-override', 'exact', 'truck-chip.tsx', 'workspace'),
  store('rocoto-app-note-reviews', 'prefix', 'line-notes.tsx', 'workspace'),
  store('rocoto-albaran-intake-v1', 'exact', 'albaran-intake-memory.ts', 'workspace'),
  store('rocoto-albaran-paper-review-v1', 'exact', 'albaran-paper-review.tsx', 'workspace'),
  store('rocoto-app-reply-drafts', 'exact', 'reply-draft.ts', 'workspace'),
  store('rocoto:scoped-conversation-notes:dismissed', 'prefix', 'scoped-conversation-note.tsx', 'workspace', undefined, 'session'),

  /* THE CATALOGUE, ITS PRICES AND WHAT A HOUSE KNOWS ABOUT ITS GOODS */
  store('rocoto-app-catalogue', 'exact', 'catalogue.ts', 'workspace'),
  store('rocoto-app-catalogue-import-v1', 'exact', 'catalogue-export.tsx', 'workspace'),
  store('rocoto-catalogue-imports', 'exact', 'catalogue-export.tsx', 'workspace', undefined, 'indexed'),
  store('rocoto-app-tiers', 'prefix', 'tiers.ts', 'workspace', 'resetTiers'),
  store('rocoto-app-units', 'exact', 'units.ts', 'workspace'),
  store('rocoto-app-imports', 'exact', 'knows.ts', 'workspace'),
  store('rocoto-app-menus', 'exact', 'knows.ts', 'workspace'),
  store('rocoto-app-rules', 'exact', 'rules.ts', 'workspace'),
  store('rocoto-app-rules-seeded', 'exact', 'rules.ts', 'workspace'),
  store('rocoto-product-ontology-v1', 'exact', 'product-ontology.ts', 'workspace'),
  store('rocoto-product-relations-v1', 'exact', 'product-relations.ts', 'workspace'),
  store('rocoto-product-creation-draft:', 'prefix', 'product-creation.tsx', 'workspace', undefined, 'session'),
  store('rocoto-sku-records-v1', 'exact', 'sku-record.ts', 'workspace'),
  store('rocoto-sku-artwork-v1', 'exact', 'sku-artwork.tsx', 'workspace'),
  store('rocoto-uncoded-catalogue-notes-v1', 'exact', 'uncoded-catalogue.tsx', 'workspace'),
  store('rocoto-stock-batches-v1:', 'scoped', 'stock-batch-memory.ts', 'workspace'),
  store('rocoto-stock-declared-v1:', 'scoped', 'incoming.ts', 'workspace'),

  /* THE PEOPLE THE HOUSE DEALS WITH */
  store('rocoto-app-customers-made', 'prefix', 'customers-made.ts', 'workspace', 'clearMadeCustomers'),
  store('rocoto-app-customer-edits', 'exact', 'customer-edits.ts', 'workspace', 'clearAccountEdits'),
  store('rocoto-app-partners', 'exact', 'suppliers.ts', 'workspace', 'resetPartners'),
  store('rocoto-app-partners-seeded', 'exact', 'suppliers.ts', 'workspace'),
  store('rocoto-app-partner-runs', 'exact', 'suppliers.ts', 'workspace'),

  /* PAPER: THE QUEUE, THE JOURNAL, THE TEMPLATES AND WHAT CAME OUT OF THE PRINTER */
  store('rocoto-app-print', 'exact', 'print-queue.ts', 'workspace', 'resetPrinting'),
  store('rocoto-app-print-journal', 'exact', 'print-queue.ts', 'workspace', 'resetPrinting'),
  store('rocoto-print-artifacts', 'exact', 'print-artifacts.ts', 'workspace', undefined, 'indexed'),
  store('rocoto-print-layout-v1:', 'scoped', 'print-layout.ts', 'workspace'),
  store('rocoto-packing-output-v1', 'exact', 'packing-output.ts', 'workspace'),
  store('rocoto-packing-marks-v1', 'exact', 'packing-output.ts', 'workspace'),
  store('rocoto-paper-read-v1', 'exact', 'paper-read.ts', 'workspace'),
  store('rocoto-paper-manifest-journal-v1', 'exact', 'paper-manifest.ts', 'workspace'),
  store('rocoto-app-export-files-v1', 'prefix', 'export-model.ts', 'workspace'),
  store('rocoto-app-export-file-requests-v1', 'prefix', 'export-model.ts', 'workspace'),
  store('rocoto:outputs:templates', 'prefix', 'output-templates.ts', 'workspace'),
  store('rocoto:export:saved-outputs', 'prefix', 'output-templates.ts', 'workspace'),
  store('rocoto:export:output-schedules', 'prefix', 'shell/printing.tsx', 'workspace'),
  store('rocoto:export:email-provider-receipts', 'prefix', 'shell/printing.tsx', 'workspace'),

  /* MONEY, ITS COLLECTION WORKSPACE AND THE REPAYMENT PLANS A HAND ACCEPTED */
  store('rocoto-cedar-money-v1:', 'scoped', 'money-store.ts', 'workspace'),
  store('rocoto-cedar-money-api-v1:', 'scoped', 'money-api.ts', 'workspace', 'resetCollectionWorkspace'),
  store('rocoto-cedar-finance-v1:', 'scoped', 'money-overview.tsx', 'workspace'),
  store('rocoto-cedar-finance-credit-sort-v1:', 'scoped', 'money-credit.tsx', 'workspace'),
  store('rocoto-cedar-chase-v1:', 'scoped', 'chase.ts', 'workspace'),
  store('rocoto-cedar-campaigns-v1:', 'scoped', 'campaigns.ts', 'workspace'),
  store('rocoto-cedar-dossier-v1:', 'scoped', 'dossier.ts', 'workspace'),

  /* SETUP PROGRESS AND THE REHEARSALS A PERSON WALKED */
  store('rocoto-cedar-onboarding-v1:', 'scoped', 'onboarding-model.ts', 'workspace'),
  store('rocoto-cedar-meta-preview-v1:', 'scoped', 'onboarding-meta.tsx', 'workspace'),
  store('rocoto-phone-connection-v1:', 'scoped', 'phone-connection-config.ts', 'workspace', 'resetPhoneConnectionConfig'),
  retired('rocoto-phone-inbound-preview-v1:', 'scoped', 'phone-connection.tsx',
    'PR #90 (4af822c5) retired the inbound-call preview that wrote it; phone-connection.tsx names the key'),

  /* WHAT REACHES A PERSON, AND WHAT THEY PUT AWAY */
  store('rocoto-app-briefing', 'prefix', 'briefings.ts', 'workspace', 'resetBriefing'),
  store('rocoto-app-dismissals', 'exact', 'dismissals.ts', 'workspace'),
  store('rocoto-app-anxieties', 'exact', 'dismissals.ts', 'workspace'),
  store('rocoto-app-email-cancelled', 'exact', 'dismissals.ts', 'workspace'),
  store('rocoto-call-voices', 'exact', 'voice.ts', 'workspace'),
  store('rocoto-copilot-v3:', 'scoped', 'copilot/store.ts', 'workspace'),

  /* THE WORDS THE INTERFACE USES. §247.6 returns them to their default with the data. */
  store('rocoto-display-language', 'exact', 'display-language.ts', 'workspace'),
  store('rocoto-spanish-entry', 'exact', 'display-language.ts', 'workspace'),

  /* ── CONNECTION STATE ──────────────────────────────────────────────────────────────────────
     Local mirrors of a provider account, each naming the account it mirrors. The disconnecting
     act clears a row only once THAT provider's own call has answered for it; the data act keeps
     them all, so a connection stands as it stands. */
  mirror('rocoto-cedar-whatsapp-selected-v1', 'exact', 'whatsapp-connection.tsx', 'whatsapp'),
  mirror('rocoto-cedar-whatsapp-intake-cursor-v2', 'prefix', 'whatsapp-intake.tsx', 'whatsapp'),
  mirror('rocoto-cedar-email-intake-cursor-v1', 'prefix', 'email-intake.tsx', 'email'),
  mirror('rocoto-cedar-phone-intake-v1', 'prefix', 'phone-intake.tsx', 'phone'),
  mirror('rocoto-cedar-phone-browser-v1', 'exact', 'phone-session.ts', 'phone'),
  mirror('rocoto-cedar-phone-device-v1', 'exact', 'phone-runtime.ts', 'phone', 'session'),

  /* ── KEPT BY BOTH ACTS ─────────────────────────────────────────────────────────────────────
     A view preference belongs to the person, a runtime pin belongs to the development machine,
     and the channel access record is the road the phone and email disconnects travel. */
  store('rocoto-rail-open', 'exact', 'shell/rail.tsx', 'kept'),
  store('rocoto-runtime-base', 'exact', 'runtime-client.ts', 'kept'),
  store('rocoto-cedar-collections-base', 'exact', 'money-api.ts', 'kept'),
  store('rocoto-cedar-channel-access-v1:', 'prefix', 'cedar-channel-api.ts', 'kept'),
]);

/** The fates each act clears. */
export const clearedFates = (disconnect: boolean): CedarStoreFate[] =>
  disconnect ? ['workspace', 'connection'] : ['workspace'];

/* ── THE MATCHER, AND WHY IT READS `shape` ────────────────────────────────────────────────────
 * This one function decides both what the gate calls covered and what the sweep calls stale, and
 * it used to answer on the head of the key alone: `key === row.key || key.startsWith(row.key)`.
 * That made the gate FAIL-OPEN in both directions for any key that begins with an existing row.
 *   forward   `rocoto-app-print-preview-v2` was reported COVERED by `rocoto-app-print`, an EXACT
 *             row — so it passed the gate green AND the sweep, which removes the literal key of
 *             an exact row, never touched it. A new store under a family name escaped Reset Cedar
 *             with nothing red anywhere, which is the one guarantee this file makes.
 *   mirror    `rocoto-app-print` was never reported stale while `rocoto-app-print-journal` was
 *             written, so a row whose store had left the tree stayed on the inventory for ever.
 * A row's `shape` already states how its key reaches a browser, so the matcher reads it: an exact
 * row answers for its own key, a scoped row for that key plus one scope segment, and a prefix row
 * for the family it heads. */
export const storeMatches = (key: string, row: CedarStore): boolean => {
  if (row.shape === 'exact') return key === row.key;
  if (!key.startsWith(row.key)) return false;
  if (row.shape === 'prefix') return true;
  return !key.slice(row.key.length).includes(':');
};

/** Is `key` a key this inventory already names? The tool test's coverage check reads this. */
export const inventoried = (key: string): CedarStore | null =>
  CEDAR_STORES.find((row) => storeMatches(key, row)) ?? null;

/** Is any key the tree writes still this row's? The tool test's stale check reads this. */
export const stillWritten = (row: CedarStore, keys: readonly string[]): boolean =>
  keys.some((key) => storeMatches(key, row));

/** The narrowest browser storage these acts need. A real `localStorage` satisfies it. */
export type StorageLike = {
  length?: number;
  key?(index: number): string | null;
  getItem(key: string): string | null;
  removeItem(key: string): void;
};

/** Every key a store is holding right now, through whichever door it offers. */
export function storedKeys(source: StorageLike | null | undefined): string[] {
  if (!source) return [];
  try {
    const size = typeof source.length === 'number' ? source.length : 0;
    if (size > 0 && typeof source.key === 'function') {
      const held: string[] = [];
      for (let index = 0; index < size; index += 1) {
        const name = source.key(index);
        if (typeof name === 'string') held.push(name);
      }
      return held;
    }
    return Object.keys(source as unknown as Record<string, unknown>);
  } catch {
    /* A browser with site data blocked holds nothing this act has to reach. */
    return [];
  }
}

export type WorkspaceResetPlan = {
  scope: string;
  disconnect: boolean;
  local: string[];
  session: string[];
  databases: string[];
};

export type WorkspaceResetPlanInput = {
  scope: string;
  disconnect: boolean;
  /** the providers that answered for themselves; only THEIR mirrors are cleared */
  released?: ProviderId[];
  /** narrow the act to one fate — the retry sweeps a single provider's mirrors and nothing else */
  fates?: CedarStoreFate[];
  local?: string[];
  session?: string[];
};

/** WHAT THE ACT REMOVES, decided from the inventory and the keys a browser is actually holding.
 *
 * ⚠ A MIRROR GOES ONLY WHEN ITS OWN PROVIDER SAID SO. The sweep used to clear every `connection`
 * row whenever `disconnect` was true, whatever the walk returned, so a mailbox that refused its
 * DELETE kept its Unipile connection while `rocoto-cedar-email-intake-cursor-v1` was dropped — and
 * the intake then restarted from the beginning of that mailbox's history. In the no-channel branch
 * the row's own sub says «Phone and email stay» while both mirrors were wiped anyway. `released`
 * carries the providers whose own call answered (`disconnected` or `absent`), and a provider that
 * said «Still connected» or «Stays as it is» keeps its mirrors until a retry releases them. */
export function workspaceResetPlan(input: WorkspaceResetPlanInput): WorkspaceResetPlan {
  const fates = input.fates ?? clearedFates(input.disconnect);
  const released = input.released ?? [];
  const held = { local: input.local ?? [], session: input.session ?? [] };
  const plan: WorkspaceResetPlan = { scope: input.scope, disconnect: input.disconnect, local: [], session: [], databases: [] };
  for (const row of CEDAR_STORES) {
    if (!fates.includes(row.fate)) continue;
    if (row.fate === 'connection' && !(row.provider && released.includes(row.provider))) continue;
    if (row.medium === 'indexed') { plan.databases.push(row.key); continue; }
    const target = row.medium === 'session' ? plan.session : plan.local;
    const present = row.medium === 'session' ? held.session : held.local;
    if (row.shape === 'exact') { if (present.includes(row.key)) target.push(row.key); continue; }
    if (row.shape === 'scoped') { const key = `${row.key}${input.scope}`; if (present.includes(key)) target.push(key); continue; }
    for (const key of present) if (key.startsWith(row.key) && !target.includes(key)) target.push(key);
  }
  return plan;
}

/** A store's own way back to its seed, run after the sweep so it re-writes its defaults. */
export type StoreReset = { name: string; run: () => boolean };

export type WorkspaceResetReport = {
  scope: string;
  disconnect: boolean;
  removed: { local: string[]; session: string[]; databases: string[] };
  /** the reset functions that answered `false`, by name */
  stalled: string[];
};

export type WorkspaceResetInput = {
  scope: string;
  disconnect: boolean;
  /** the providers whose own call answered; only their mirrors are swept */
  released?: ProviderId[];
  /** narrow the act to one fate — the retry's own sweep passes `['connection']` */
  fates?: CedarStoreFate[];
  local?: StorageLike | null;
  session?: StorageLike | null;
  databases?: { deleteDatabase(name: string): unknown } | null;
  stores?: StoreReset[];
  announce?: (event: string, detail: { scope: string; disconnect: boolean }) => void;
};

/** THE SWEEP, THE STORES' OWN RESETS, THEN THE ANNOUNCEMENT — in that order, every time. */
export function resetWorkspaceStores(input: WorkspaceResetInput): WorkspaceResetReport {
  const plan = workspaceResetPlan({
    scope: input.scope,
    disconnect: input.disconnect,
    released: input.released,
    fates: input.fates,
    local: storedKeys(input.local),
    session: storedKeys(input.session),
  });
  const removed = { local: [] as string[], session: [] as string[], databases: [] as string[] };
  for (const key of plan.local) {
    try { input.local?.removeItem(key); removed.local.push(key); } catch { /* the key stays; the act carries on */ }
  }
  for (const key of plan.session) {
    try { input.session?.removeItem(key); removed.session.push(key); } catch { /* the key stays; the act carries on */ }
  }
  for (const name of plan.databases) {
    try { input.databases?.deleteDatabase(name); removed.databases.push(name); } catch { /* the copies stay; the act carries on */ }
  }
  const stalled: string[] = [];
  for (const reset of input.stores ?? []) {
    let ok = false;
    try { ok = reset.run() !== false; } catch { ok = false; }
    if (!ok) stalled.push(reset.name);
  }
  input.announce?.(WORKSPACE_RESET_EVENT, { scope: input.scope, disconnect: input.disconnect });
  return { scope: input.scope, disconnect: input.disconnect, removed, stalled };
}

/* ── THE PROVIDERS ────────────────────────────────────────────────────────────────────────────
 * «but genuinely removes them». Each provider answers for itself, through its own disconnect
 * operation, and one provider's failure leaves the other two results standing. `ProviderId` is
 * declared with the inventory above, because every `connection` row names the account it mirrors. */
export type ProviderOutcome =
  /** the provider's own disconnect returned */
  | 'disconnected'
  /** this workspace held an account of that kind already free */
  | 'absent'
  /** the workspace's channel access is pending, so the provider stands as it stands */
  | 'held'
  /** the call came back with a reason, and the account is still there */
  | 'connected';

export type ProviderRun = { calls: number; outcome: 'disconnected' | 'absent' | 'held' };
/** One account's own disconnect. It receives the walk's signal so it can stop between its calls. */
export type ProviderDisconnect = { provider: ProviderId; run: (signal?: AbortSignal) => Promise<ProviderRun> };
export type ProviderResult = { provider: ProviderId; outcome: ProviderOutcome; calls: number; error: string };

/** HOW A WALK IS WATCHED AND HOW IT IS STOPPED. The held card reads both. */
export type ProviderWalkGuard = {
  /** «Stop» and a route change share one controller; an aborted walk stands the sweep down */
  signal?: AbortSignal;
  /** the account being asked right now, and `null` once the walk has ended */
  onAsking?: (provider: ProviderId | null) => void;
};

/** THE WORD A RESULT IS STATED IN. One word per outcome, the same word everywhere. */
export function providerWord(outcome: ProviderOutcome): string {
  if (outcome === 'disconnected') return 'Disconnected';
  if (outcome === 'absent') return 'Ready to connect';
  if (outcome === 'held') return 'Stays as it is';
  return 'Still connected';
}

const reason = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : 'This account needs another check. Try again.';

/** Walk the providers one at a time; every one of them reports its own result.
 *
 * ⚠ A WALK CAN BE STOPPED WHILE IT IS RUNNING. Cedar is a hash router, so a route change unmounts
 * the held card while this promise carries on — and it used to carry on to the end, disconnecting
 * the accounts and sweeping the stores under a live app that never reloaded. `signal` is the one
 * controller «Stop» and the route both reach for: a stopped walk asks no further account, and an
 * answer that arrives after the stop is discarded, so the account it came from is stated as
 * standing. `onAsking` names the account being asked, which is what the held card reads. */
export async function disconnectProviders(
  list: ProviderDisconnect[], guard: ProviderWalkGuard = {},
): Promise<ProviderResult[]> {
  const results: ProviderResult[] = [];
  for (const entry of list) {
    if (guard.signal?.aborted) break;
    guard.onAsking?.(entry.provider);
    let row: ProviderResult;
    try {
      const run = await entry.run(guard.signal);
      row = { provider: entry.provider, outcome: run.outcome, calls: run.calls, error: '' };
    } catch (error) {
      row = { provider: entry.provider, outcome: 'connected', calls: 0, error: reason(error) };
    }
    if (guard.signal?.aborted) break;
    results.push(row);
  }
  guard.onAsking?.(null);
  return results;
}

/** THE PROVIDERS WHOSE MIRRORS THIS ACT MAY CLEAR: the ones that answered for themselves. A
 *  `disconnected` account has gone at the provider and an `absent` one was already free, so both
 *  of those local mirrors are stale. `held` and `connected` accounts are still standing, and their
 *  mirrors stand with them until a retry releases them. */
export const releasedProviders = (results: readonly ProviderResult[]): ProviderId[] =>
  results.filter((row) => row.outcome === 'disconnected' || row.outcome === 'absent').map((row) => row.provider);

/** THE SECOND ACT WHOLE: the providers first, then the sweep, then the announcement. Each
 *  provider's own answer decides whether its mirrors go with it.
 *
 *  ⚠ A STOPPED WALK NEVER REACHES THE SWEEP. «Stop» and a route change abort the same signal, and
 *  a sweep that runs after that would leave a live app standing over stores that had gone — the
 *  exact half-reset state the held card exists to prevent. So the act stands down and reports
 *  `stopped`, with no sweep report to show. The accounts that already answered `disconnected` or
 *  `absent` are settled facts, so their own mirrors go with them, one released account at a time,
 *  on the same rule the retry follows. Everything else stays exactly as it was. */
export async function resetWorkspaceAndProviders(
  input: WorkspaceResetInput & { providers: ProviderDisconnect[] } & ProviderWalkGuard,
): Promise<{ providers: ProviderResult[]; report: WorkspaceResetReport | null; stopped: boolean }> {
  const providers = await disconnectProviders(input.providers, { signal: input.signal, onAsking: input.onAsking });
  if (input.signal?.aborted) {
    for (const provider of releasedProviders(providers)) {
      releaseProviderStores({
        scope: input.scope, provider, local: input.local, session: input.session,
        databases: input.databases, announce: input.announce,
      });
    }
    return { providers, report: null, stopped: true };
  }
  const report = resetWorkspaceStores({ ...input, disconnect: true, released: releasedProviders(providers) });
  return { providers, report, stopped: false };
}

/** THE RETRY'S OWN SWEEP. A provider that answered on the second ask hands over its mirrors then,
 *  and nothing else on the page moves — the workspace rows went with the first act. */
export function releaseProviderStores(
  input: Omit<WorkspaceResetInput, 'released' | 'fates' | 'disconnect' | 'stores'> & { provider: ProviderId },
): WorkspaceResetReport {
  return resetWorkspaceStores({
    ...input, disconnect: true, fates: ['connection'], released: [input.provider], stores: [],
  });
}
