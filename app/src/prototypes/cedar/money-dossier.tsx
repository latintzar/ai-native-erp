/** THE LENDER DOSSIER — THE DOOR ON THE MONEY DASHBOARD, AND THE DOCUMENT (FEED-IA §249).
 *
 * «a dossier is a dossier. it's underlated to an action/loan.»              — Peter, 14 September
 *
 * Two surfaces over `dossier.ts`. `LenderDoor` stands on the dashboard after the working-capital
 * card and states what the document holds, the last share, and one act. `MoneyDossier` at
 * `#/money/dossier` IS the document: a head and six sections — Identity, Movements, Collections,
 * Order book, Risk signals, Consents — every figure derived from this workspace's own ledger,
 * book and consent record.
 *
 * **Share with lender** prepares a fixed A4 PDF, named after the workspace and accounting day.
 * After generation succeeds, `rocoto-cedar-dossier-v1:<scope>` records the actual preparation
 * instant. Its legacy `shares` field is preparation history. The document contains the history
 * captured before this export; the page and subsequent exports include the completed action.
 *
 * THE PAGE STANDS IN EVERY BANK POSTURE. A workspace whose bank is still ahead of it reads
 * «Receiving account · Added at bank connection» and every other figure exactly as it is: the
 * dossier is the workspace's own data, so a provider answers for one line of it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { ArrowLeft, ArrowUpRight, ScrollText, Share2 } from 'lucide-react';
import onboardingFixture from './fixtures/onboarding-v1.json';
import { useConfig } from './config';
import { useCompany } from './company';
import { readChase, chaseKey } from './chase';
import { moneyStorageKey, useMoney } from './money-store';
import { useBankCapability } from './money-bank-api';
import { formatLedgerMoney } from './money-model';
import { moneyNow, moneyWorkspace, type MoneySourceSale } from './money-seed';
import { parseAdvance } from './money-finance';
import { WORKSPACE_TIME_ZONE } from './scenario-clock';
import {
  DOSSIER_CONSENT_WORDS, DOSSIER_KEY_PREFIX, dayWords, dossierFileName, dossierKey, dossierOf,
  dossierWindowWords, emptyDossierLog, lastShareAt, parseDossierLog, preparedWords, recordShare,
  shareWords, sharedWords, writeDossierLog, dossierSourceWords, requestDossierAdvance,
  type Dossier, type DossierConsent, type DossierLog, type DossierSectionId,
} from './dossier';

/* ── THE SHARE LOG'S STORE · ONE SCOPED KEY, ONE HOOK (money-store.ts' own shape) ─────────────*/

const logCache = new Map<string, DossierLog>();
const logListeners = new Set<() => void>();

function readLog(scope: string): DossierLog {
  if (!logCache.has(scope)) {
    let value = emptyDossierLog(scope);
    try {
      const raw = localStorage.getItem(dossierKey(scope));
      if (raw && raw.length < 8000) value = parseDossierLog(JSON.parse(raw), scope);
    } catch { /* A fresh log leaves the share act standing. */ }
    logCache.set(scope, value);
  }
  return logCache.get(scope)!;
}

const subscribeLog = (listener: () => void) => { logListeners.add(listener); return () => { logListeners.delete(listener); }; };
const emitLog = () => { logListeners.forEach(listener => listener()); };

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === null || event.key.startsWith(DOSSIER_KEY_PREFIX)) { logCache.clear(); emitLog(); }
});
/* The shared reset contract (PRODUCT-SPEC «Reset»): the key is already cleared, so the module's
   copy of the log goes with it and the door returns to its own sentence. */
if (typeof window !== 'undefined') window.addEventListener('rocoto:cedar-workspace-reset', event => {
  const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope;
  if (scope) logCache.delete(scope); else logCache.clear();
  emitLog();
});

/** The one reader of the share log, and the one writer. */
export function useDossierLog(scope: string) {
  const snapshot = React.useCallback(() => readLog(scope), [scope]);
  const log = React.useSyncExternalStore(subscribeLog, snapshot, snapshot);
  const share = React.useCallback((at: string): boolean => {
    const next = recordShare(readLog(scope), at);
    if (!writeDossierLog(next)) return false;
    logCache.set(scope, next); emitLog(); return true;
  }, [scope]);
  const requestAdvance = React.useCallback((amountMinor: number): boolean => {
    const next = requestDossierAdvance(readLog(scope), amountMinor);
    if (!writeDossierLog(next)) return false;
    logCache.set(scope, next); emitLog(); return true;
  }, [scope]);
  return { log, share, requestAdvance };
}

/* THE PLAN'S OWN KEY, READ FOR ONE FIELD. `money-overview.tsx` owns the advance store; the dossier
   reads the same record for its `consentAt` alone — the moment repayment from incoming payments
   was authorized — because that consent belongs in the log a lender is handed. */
const ADVANCE_STORE_PREFIX = 'rocoto-cedar-finance-v1:';
function advanceConsentAt(scope: string): string | null {
  try {
    const raw = localStorage.getItem(ADVANCE_STORE_PREFIX + scope);
    if (!raw || raw.length > 12000) return null;
    return parseAdvance(JSON.parse(raw), scope)?.consentAt ?? null;
  } catch { return null; }
}

/* ── THE DOOR ────────────────────────────────────────────────────────────────────────────────*/

/** The six sections the document holds, in the order it prints them. */
export const DOSSIER_SECTION_WORDS = ['Identity', 'Movements', 'Collections', 'Order book', 'Risk signals', 'Consents'] as const;

/** One sentence, the last share, one act. The card grammar of the Money dashboard: a 1px opaque
 *  border, `radius400`, `scale700` padding, the tile the sibling cards carry. */
export function LenderDoor({ scope }: { scope: string }) {
  const [css, theme] = useStyletron();
  const { log } = useDossierLog(scope);
  const shared = lastShareAt(log);
  const card = css({
    display: 'grid', alignContent: 'space-between', gap: theme.sizing.scale600, minWidth: 0,
    padding: theme.sizing.scale700, border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary,
    /* At 1600 the dashboard's last row holds Working capital beside this door and Customer credit
       under it, so the door takes the whole right column rather than leaving the corner empty.
       Below the grid's own 800px breakpoint every card is one column and the placement lifts. */
    '@media (min-width: 801px)': { gridColumn: 2, gridRow: 'span 2' },
    '@media (max-width: 600px)': { padding: theme.sizing.scale600 },
  });
  return <section data-testid="lender-door" data-shared={shared ? 'yes' : 'pending'} className={card}>
    <div style={{ display: 'grid', gap: theme.sizing.scale600, minWidth: 0 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 56, height: 56,
        borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary }}>
        <ScrollText size={28} strokeWidth={1.6} aria-hidden />
      </span>
      <h2 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>Lender dossier</h2>
      <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>
        Your identity, movements, order book and risk signals in one document.</p>
      {/* The document's own table of contents, so a person knows what the lender receives. */}
      <ul data-testid="lender-door-sections" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid' }}>
        {DOSSIER_SECTION_WORDS.map(name => <li key={name} style={{ ...theme.typography.LabelSmall,
          borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale300,
          paddingBottom: theme.sizing.scale300 }}>{name}</li>)}
      </ul>
    </div>
    <div style={{ display: 'grid', gap: theme.sizing.scale400, minWidth: 0 }}>
      {shared && <p data-testid="lender-door-shared" data-at={shared}
        style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, margin: 0 }}>
        {sharedWords(shared, WORKSPACE_TIME_ZONE)}</p>}
      <Button data-testid="lender-door-open" onClick={() => { window.location.hash = '#/money/dossier'; }}
        endEnhancer={() => <ArrowUpRight size={18} aria-hidden />}>Share with lender</Button>
    </div>
  </section>;
}

/* ── THE DOCUMENT ────────────────────────────────────────────────────────────────────────────*/

/* THE PAPER THE SHARE PRODUCES. Every ancestor of the document carries `data-print-root` while
   this page stands, so printing hides the app around it wherever the shell puts the page, and the
   document alone lands on A4 with its own acts left off the paper. */
const PRINT_STYLES = `
@media print {
  @page { size: A4; margin: 14mm; }
  [data-print-root] > *:not([data-print-root]):not([data-dossier]) { display: none !important; }
  [data-print-root] {
    display: block !important; width: auto !important; max-width: none !important;
    height: auto !important; max-height: none !important; min-height: 0 !important;
    overflow: visible !important; margin: 0 !important; padding: 0 !important;
  }
  [data-dossier] { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  [data-print-hide] { display: none !important; }
  [data-dossier-section] { break-inside: avoid; page-break-inside: avoid; }
}
`;

type Fact = { label: string; value: string; wrap?: boolean; testid?: string; data?: Record<string, string | number>; note?: string };

export function MoneyDossier({ scope, sales }: { scope: string; sales: MoneySourceSale[] }) {
  const [css, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;
  const company = useCompany();
  const { state } = useMoney(scope);
  const bank = useBankCapability(scope);
  const [chaseBook, setChaseBook] = React.useState(() => readChase(scope));
  React.useEffect(() => {
    const refresh = () => setChaseBook(readChase(scope));
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === chaseKey(scope)) refresh(); };
    refresh(); window.addEventListener('storage', storage); window.addEventListener('rocoto:cedar-workspace-reset', refresh);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('rocoto:cedar-workspace-reset', refresh); };
  }, [scope, state]);
  const reminders = React.useMemo(() => Object.values(chaseBook.records)
    .flatMap(record => record.sends.map(send => ({ invoiceId: record.invoiceId, at: send.at }))), [chaseBook]);
  const { log, share, requestAdvance } = useDossierLog(scope);
  const savedRequested = React.useMemo(() => {
    let amount = log.requestedAdvanceMinor;
    if (amount === undefined) {
      try { amount = parseAdvance(JSON.parse(localStorage.getItem(ADVANCE_STORE_PREFIX + scope) || 'null'), scope)?.principalMinor; }
      catch { /* The amount is entered on this document. */ }
    }
    return amount ? (amount / 100).toFixed(2) : '';
  }, [scope, log.requestedAdvanceMinor]);
  const [requested, setRequested] = React.useState(savedRequested);
  React.useEffect(() => { setRequested(savedRequested); }, [scope, savedRequested]);
  const requestedMinor = requested.trim() ? Math.round(Number(requested) * 100) : 0;
  const [sharing, setSharing] = React.useState(false);
  const exportGeneration = React.useRef(0);
  const exportAbort = React.useRef<AbortController | null>(null);
  const article = React.useRef<HTMLElement | null>(null);
  const [error, setError] = React.useState('');
  const shared = lastShareAt(log);

  React.useLayoutEffect(() => {
    const cancel = () => {
      exportGeneration.current += 1;
      exportAbort.current?.abort(); exportAbort.current = null;
      setSharing(false);
    };
    const reset = (event: Event) => {
      const resetScope = (event as CustomEvent<{ scope?: string }>).detail?.scope;
      if (!resetScope || resetScope === scope) cancel();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === null || (event.newValue === null
        && (event.key === dossierKey(scope) || event.key === moneyStorageKey(scope)))) cancel();
    };
    setSharing(false);
    window.addEventListener('rocoto:cedar-workspace-reset', reset);
    window.addEventListener('storage', storage);
    return () => {
      exportGeneration.current += 1;
      exportAbort.current?.abort(); exportAbort.current = null;
      window.removeEventListener('rocoto:cedar-workspace-reset', reset);
      window.removeEventListener('storage', storage);
    };
  }, [scope]);

  React.useEffect(() => {
    const node = article.current;
    if (!node) return undefined;
    const marked: HTMLElement[] = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      parent.setAttribute('data-print-root', '');
      marked.push(parent);
    }
    return () => { marked.forEach(element => element.removeAttribute('data-print-root')); };
  }, []);

  /* THE LEDGER'S CLOCK, ONCE. The financial document — its window and overdue days — is
     read from this one instant, so every figure on the page belongs to the same moment. */
  const preparedAt = moneyNow(state);
  const openingBalanceMinor = React.useMemo(() => {
    try { return moneyWorkspace(scope).openingBalanceMinor; } catch { return 0; }
  }, [scope]);

  /* The address the workspace gave at setup, and the one the company card holds the moment
     anybody edits it — `demo-welcome.tsx`'s own rule, so one address stands in both places. */
  const addresses = onboardingFixture.addresses as Record<string, string | undefined>;
  const address = company.fiscalAddress && company.fiscalAddress !== cast.house.fiscalAddress
    ? company.fiscalAddress : addresses[scope] || company.fiscalAddress;

  const consents: DossierConsent[] = React.useMemo(() => {
    const rows: DossierConsent[] = [];
    if (state.setup.consentAt) rows.push({ kind: 'bank-access', at: state.setup.consentAt });
    const repayment = advanceConsentAt(scope);
    if (repayment) rows.push({ kind: 'auto-repayment', at: repayment });
    for (const row of log.shares) rows.push({ kind: 'share', at: row.at });
    return rows;
  }, [scope, state.setup.consentAt, log]);

  const dossier: Dossier = React.useMemo(() => dossierOf({
    scope, preparedAt, openingBalanceMinor, state, sales, consents, reminders, requestedAdvanceMinor: requestedMinor,
    identity: {
      legalName: state.setup.sellerName || company.legalName,
      ruc: state.setup.ruc,
      address,
      owner: cast.owner.name,
      receivingAccount: bank.posture === 'ready' ? `${bank.accountLabel} · ${bank.accountMask}`.trim() : '',
    },
  }), [scope, preparedAt, openingBalanceMinor, state, sales, consents, reminders, requestedMinor, company.legalName, address, cast.owner.name, bank.posture, bank.accountLabel, bank.accountMask]);

  const money = (minor: number) => formatLedgerMoney(state, minor);

  const onShare = async () => {
    if (sharing) return;
    const generation = ++exportGeneration.current;
    const abort = new AbortController(); exportAbort.current = abort;
    const current = () => generation === exportGeneration.current && !abort.signal.aborted;
    setSharing(true); setError('');
    try {
      const { createDossierPdf } = await import('./dossier-pdf');
      if (!current()) return;
      const bytes = await createDossierPdf(dossier, money,
        { ink: theme.colors.contentPrimary, muted: theme.colors.contentSecondary,
          line: theme.colors.borderOpaque, paper: theme.colors.backgroundPrimary, faint: theme.colors.contentTertiary }, abort.signal);
      if (!current()) return;
      const at = new Date().toISOString();
      if (!share(at)) { setError('Allow browser storage to record this PDF preparation.'); return; }
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url; link.download = dossierFileName(dossier.identity.legalName, dossier.preparedDay);
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      if (current()) setError('Create the document again.');
    } finally {
      if (current()) { exportAbort.current = null; setSharing(false); }
    }
  };

  /* ── the document's own registers ──────────────────────────────────────────────────────── */
  const container = css({ display: 'grid', gap: theme.sizing.scale700, width: '100%', maxWidth: '1080px',
    margin: '0 auto', padding: theme.sizing.scale700, boxSizing: 'border-box', minWidth: 0,
    '@media (max-width: 600px)': { padding: theme.sizing.scale300, gap: theme.sizing.scale500 } });
  const paper = css({ display: 'grid', gap: theme.sizing.scale900, minWidth: 0,
    padding: theme.sizing.scale1000, border: `1px solid ${theme.colors.borderOpaque}`,
    borderTop: `3px solid ${theme.colors.contentPrimary}`, backgroundColor: theme.colors.backgroundPrimary,
    '@media (max-width: 600px)': { padding: theme.sizing.scale600, gap: theme.sizing.scale800 } });
  const card = css({ display: 'grid', alignContent: 'start', gap: theme.sizing.scale500, minWidth: 0,
    paddingTop: theme.sizing.scale700, borderTop: `1px solid ${theme.colors.borderOpaque}` });
  const facts = css({ display: 'grid', gap: theme.sizing.scale600, minWidth: 0,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '@media (max-width: 480px)': { gridTemplateColumns: 'minmax(0, 1fr)' } });
  const titleClass = css({ ...theme.typography.HeadingXLarge, margin: 0, overflowWrap: 'anywhere',
    '@media (max-width: 600px)': { ...theme.typography.HeadingLarge } });
  const depthGrid = css({ display: 'grid', gap: theme.sizing.scale600, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    padding: `${theme.sizing.scale600} 0`, borderTop: `1px solid ${theme.colors.contentPrimary}`,
    borderBottom: `1px solid ${theme.colors.borderOpaque}`,
    '@media (max-width: 600px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } });
  const rows = css({ display: 'grid', gap: theme.sizing.scale500, listStyle: 'none', margin: 0, padding: 0 });
  const label: React.CSSProperties = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary };
  const figure: React.CSSProperties = { ...theme.typography.LabelLarge, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const unit: React.CSSProperties = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'normal', fontStyle: 'normal' };
  const note: React.CSSProperties = { ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, margin: 0 };

  const factList = (testid: string, items: Fact[]) => <div className={facts} data-testid={testid}>
    {items.map(item => <div key={item.label} style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
      <span style={label}>{item.label}</span>
      <span data-testid={item.testid} {...(item.data ?? {})} style={{ ...figure, ...(item.wrap ? { whiteSpace: 'normal', overflowWrap: 'anywhere' } : {}) }}>{item.value}</span>
      {item.note && <span style={note}>{item.note}</span>}
    </div>)}
  </div>;

  const bar = (basisPoints: number) => <span aria-hidden style={{ display: 'block', height: theme.sizing.scale100,
    borderRadius: theme.borders.radius100, backgroundColor: theme.colors.backgroundSecondary, overflow: 'hidden' }}>
    <span style={{ display: 'block', height: '100%', width: `${Math.min(100, basisPoints / 100)}%`,
      backgroundColor: theme.colors.contentPrimary }} /></span>;

  /* ── ONE BAR, THREE PARTS (FEED-IA §255) ─────────────────────────────────────────────────────
     Peter, 14 September: «in terms of takings surely it should be a 3-part circle chart or a 3
     part bar?? weird to have it like that, with the top thing being a full bar LOL». A column of
     bars where the largest is full width says nothing about the whole: it ranks what the figures
     beside it already rank. A share is a part OF something, so it is drawn as one bar cut into
     its parts, each part carrying its own share, and the legend under it names them. */
  const shares = (testid: string, parts: Array<{ key: string; name: string; basisPoints: number; value: string }>) => {
    const inks = [theme.colors.contentPrimary, theme.colors.contentSecondary, theme.colors.contentTertiary];
    return <div data-testid={testid} style={{ display: 'grid', gap: theme.sizing.scale400, minWidth: 0 }}>
      <span role="img" aria-label={parts.map(part => `${part.name} ${shareWords(part.basisPoints)}`).join(', ')}
        style={{ display: 'flex', height: theme.sizing.scale300, borderRadius: theme.borders.radius100,
          overflow: 'hidden', backgroundColor: theme.colors.backgroundSecondary }}>
        {parts.map((part, index) => <span key={part.key} data-share-part={part.key} data-basis-points={part.basisPoints}
          style={{ display: 'block', width: `${Math.max(0, Math.min(100, part.basisPoints / 100))}%`,
            backgroundColor: inks[index % inks.length] }} />)}
      </span>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: theme.sizing.scale300, minWidth: 0 }}>
        {parts.map((part, index) => <li key={part.key} data-share-legend={part.key}
          style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span aria-hidden style={{ width: 10, height: 10, flexShrink: 0, borderRadius: theme.borders.radius100,
            backgroundColor: inks[index % inks.length], transform: 'translateY(1px)' }} />
          <span style={{ ...theme.typography.LabelSmall, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}>{part.name}</span>
          <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{part.value} <em style={unit}>{shareWords(part.basisPoints)}</em></span>
        </li>)}
      </ol>
    </div>;
  };

  const section = (id: DossierSectionId, title: string, subtitle: string, body: React.ReactNode) =>
    <section data-testid={`dossier-${id}`} data-dossier-section className={card}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <h2 style={{ ...theme.typography.HeadingXSmall, margin: 0, display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400 }}>
          <span data-dossier-section-number style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary,
            fontVariantNumeric: 'tabular-nums' }}>{String(['identity', 'movements', 'collections', 'order-book', 'risk', 'consents'].indexOf(id) + 1).padStart(2, '0')}</span>{title}</h2>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{subtitle}</span>
      </header>
      <p data-testid={`dossier-source-${id}`} data-from={dossier.evidence[id].window.from}
        data-to={dossier.evidence[id].window.to} style={note}>{dossierSourceWords(dossier.evidence[id])}</p>
      {body}
    </section>;

  const { identity, movements, collections, orderBook, risk, operating } = dossier;
  const link = css({ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300, minHeight: '44px',
    color: theme.colors.contentPrimary, textDecoration: 'none', ...theme.typography.LabelSmall });

  return <article ref={article} data-testid="money-dossier" data-dossier data-prepared-day={dossier.preparedDay} className={container}>
    <style data-testid="dossier-print-styles" dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
    <div data-print-hide style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
      <a href="#/money" data-testid="dossier-back" className={link}><ArrowLeft size={18} aria-hidden />Money</a>
      <Button data-testid="dossier-share" isLoading={sharing} onClick={() => void onShare()} endEnhancer={() => <Share2 size={18} aria-hidden />}>Share with lender</Button>
    </div>
    <div data-testid="dossier-paper" className={paper}>
    <header data-testid="dossier-masthead" style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap', ...theme.typography.LabelSmall }}>
        <span>Lender dossier</span><span style={{ color: theme.colors.contentSecondary }}>{preparedWords(dossier.preparedDay)}</span>
      </div>
      <h1 className={titleClass}>{identity.legalName}</h1>
      <p style={{ ...theme.typography.ParagraphSmall, margin: 0, overflowWrap: 'anywhere' }}>RUC {identity.ruc} · {identity.address}</p>
      <p style={note}>Operational and financial record · Movements {dossierWindowWords(movements.window.from, movements.window.to)}</p>
      {shared && <p data-testid="dossier-shared" data-at={shared} style={{ ...theme.typography.LabelSmall, margin: 0 }}>
        {sharedWords(shared, WORKSPACE_TIME_ZONE)}</p>}
      {error && <p role="alert" style={{ ...theme.typography.ParagraphSmall, margin: 0 }}>{error}</p>}
    </header>
    <div data-testid="dossier-record-depth" className={depthGrid}>
      {[
        { label: 'Recorded orders', count: orderBook.orders }, { label: 'Order lines', count: operating.orderLines },
        { label: 'Customers served', count: operating.customers }, { label: 'Matched receipts', count: operating.matchedReceipts },
      ].map(item => <div key={item.label} style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
        <strong style={{ ...theme.typography.HeadingSmall, fontVariantNumeric: 'tabular-nums' }}>{item.count.toLocaleString('en-GB')}</strong>
        <span style={label}>{item.label}</span>
      </div>)}
    </div>
    <section data-testid="dossier-executive-summary" style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
      <h2 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>Business overview</h2>
      <p style={{ ...theme.typography.ParagraphMedium, margin: 0 }}>
        From {dossierWindowWords(orderBook.window.from, orderBook.window.to)}, {operating.customers} customers placed {orderBook.orders.toLocaleString('en-GB')} orders worth {money(orderBook.valueMinor)}.
        {' '}{operating.repeatCustomers} customers ordered repeatedly, accounting for {shareWords(operating.repeatOrderBasisPoints)} of orders.
      </p>
      {factList('dossier-summary-facts', [
        { label: 'Received last month', value: money(dossier.capacity.takingsMinor), note: dossierWindowWords(dossier.capacity.window.from, dossier.capacity.window.to) },
        { label: 'Orders per week', value: String(orderBook.ordersPerWeek), note: `${operating.deliveredOrders} orders recorded as delivered` },
      ])}
    </section>

    {section('identity', 'Identity', 'KYB', factList('dossier-identity-facts', [
      { label: 'Legal name', wrap: true, value: identity.legalName },
      { label: 'RUC', value: identity.ruc, testid: 'dossier-ruc' },
      { label: 'Owner', wrap: true, value: identity.owner },
      { label: 'Address', wrap: true, value: identity.address },
      { label: 'Receiving account', wrap: true, value: identity.receivingAccount, testid: 'dossier-account' },
    ]))}

    <section aria-labelledby="dossier-capacity-heading" className={card}>
      <h2 id="dossier-capacity-heading" style={{ ...theme.typography.HeadingSmall, margin: 0 }}>Repayment capacity</h2>
      <p style={note}>From this workspace's receipts, {dossierWindowWords(dossier.capacity.window.from, dossier.capacity.window.to)}</p>
      <label style={{ display: 'grid', gap: theme.sizing.scale300, maxWidth: '360px', ...theme.typography.LabelSmall }}>
        Requested advance · PEN
        <Input type="number" min={0} step={0.01} value={requested} placeholder="Amount"
          onChange={event => setRequested(event.currentTarget.value)}
          onBlur={() => {
            if (Number.isSafeInteger(requestedMinor) && requestedMinor >= 0 && requestedMinor <= 1_000_000_000_000) {
              setRequested(requestedMinor ? (requestedMinor / 100).toFixed(2) : '');
              if (!requestAdvance(requestedMinor)) setError('Allow browser storage to keep the requested amount.');
            }
          }} overrides={{ Input: { props: { 'data-testid': 'dossier-requested-advance' }, style: { minHeight: '44px', boxSizing: 'border-box' } } }} />
      </label>
      <div data-testid="dossier-capacity" data-requested-minor={dossier.capacity.requestedMinor}
        data-takings-minor={dossier.capacity.takingsMinor} data-basis-points={dossier.capacity.ratioBasisPoints ?? ''}
        style={{ display: 'grid', gap: theme.sizing.scale300 }}>
        <span style={label}>Received last month</span>
        <span style={figure}>{money(dossier.capacity.takingsMinor)}</span>
        <p style={{ ...theme.typography.ParagraphSmall, margin: 0 }}>
          {dossier.capacity.requestedMinor > 0 && dossier.capacity.ratioBasisPoints !== null
            ? <><strong style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{shareWords(dossier.capacity.ratioBasisPoints)}</strong> of last month's takings</>
            : dossier.capacity.takingsMinor > 0 ? "Enter an advance amount to compare it with last month's takings."
              : 'The comparison appears when the previous month holds receipts.'}
        </p>
      </div>
    </section>

    {section('movements', 'Movements', dossierWindowWords(movements.window.from, movements.window.to), <>
      {factList('dossier-movement-facts', [
        { label: 'Money in', value: money(movements.inflowMinor), testid: 'dossier-inflow',
          data: { 'data-amount-minor': movements.inflowMinor, 'data-count': movements.inflowCount },
          note: `${movements.inflowCount} bank receipts` },
        { label: 'Invoiced', value: money(movements.issuedMinor), testid: 'dossier-issued',
          data: { 'data-amount-minor': movements.issuedMinor, 'data-count': movements.issuedCount },
          note: `${movements.issuedCount} invoices` },
        { label: 'Average daily balance', value: money(movements.averageDailyBalanceMinor), testid: 'dossier-average-balance',
          data: { 'data-amount-minor': movements.averageDailyBalanceMinor },
          note: `Read across ${dossierWindowWords(movements.balanceWindow.from, movements.balanceWindow.to)}` },
        { label: 'Balance today', value: money(movements.closingBalanceMinor), testid: 'dossier-closing-balance',
          data: { 'data-amount-minor': movements.closingBalanceMinor } },
      ])}
      <p style={note}>Bank receipts matched to this workspace&rsquo;s receiving account, on the ledger&rsquo;s own clock.</p>
    </>)}

    {section('collections', 'Collections', `${collections.requestsSent} payment requests`, <>{factList('dossier-collection-facts', [
      { label: 'Requests sent', value: String(collections.requestsSent), testid: 'dossier-requests',
        data: { 'data-count': collections.requestsSent } },
      { label: 'Paid', value: String(collections.paid), testid: 'dossier-paid',
        data: { 'data-count': collections.paid }, note: money(collections.paidMinor) },
      { label: 'Success rate', value: shareWords(collections.successBasisPoints), testid: 'dossier-success-rate',
        data: { 'data-basis-points': collections.successBasisPoints } },
      { label: 'Average time to pay', value: dayWords(collections.averageDaysToPay), testid: 'dossier-days-to-pay',
        data: { 'data-days': collections.averageDaysToPay } },
    ])}
      <h3 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Payment behaviour</h3>
      <p data-testid="dossier-payment-source" style={note}>Matched receipts and recorded reminders · {dossierWindowWords(movements.window.from, movements.window.to)}</p>
      {factList('dossier-payment-depth', [
        { label: 'Split payments', value: String(operating.splitPaymentInvoices), note: 'Invoices with two or more matched receipts' },
        { label: 'Part-paid invoices', value: String(operating.partPaidInvoices), note: `${money(operating.partPaidOutstandingMinor)} still due` },
        { label: 'Reminders recorded', value: String(operating.reminders), note: `${operating.remindedInvoices} invoices contacted` },
        { label: 'Paid after a reminder', value: String(operating.paidAfterReminder), note: money(operating.paidAfterReminderMinor) },
      ])}
    </>)}

    {section('order-book', 'Order book', dossierWindowWords(orderBook.window.from, orderBook.window.to), <>
      {factList('dossier-order-facts', [
        { label: 'Orders per week', value: String(orderBook.ordersPerWeek), testid: 'dossier-orders-per-week',
          data: { 'data-orders': orderBook.ordersPerWeek }, note: `${orderBook.orders} orders in this window` },
        { label: 'Average ticket', value: money(orderBook.averageTicketMinor), testid: 'dossier-average-ticket',
          data: { 'data-amount-minor': orderBook.averageTicketMinor } },
        { label: 'Book value', value: money(orderBook.valueMinor), testid: 'dossier-book-value',
          data: { 'data-amount-minor': orderBook.valueMinor } },
        { label: 'Delivery days per week', value: String(orderBook.deliveryDaysPerWeek), testid: 'dossier-delivery-days',
          data: { 'data-days': orderBook.deliveryDaysPerWeek } },
      ])}
      {factList('dossier-repeat-customers', [
        { label: 'Repeat customers', value: String(operating.repeatCustomers), note: `${operating.customers} customers served` },
        { label: 'Orders from repeat customers', value: shareWords(operating.repeatOrderBasisPoints), note: `${operating.repeatOrders} orders` },
        { label: 'Delivered orders', value: String(operating.deliveredOrders), note: `${operating.deliveryDays} delivery days` },
        { label: 'Products traded', value: String(operating.products), note: `${operating.orderLines.toLocaleString('en-GB')} order lines` },
      ])}
      <div data-testid="dossier-weekly-trading" style={{ display: 'grid', gap: theme.sizing.scale400, minWidth: 0 }}>
        <h3 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Delivered orders by week</h3>
        <p style={note}>Delivered and settled orders. The current week runs through {dossierWindowWords(dossier.preparedDay, dossier.preparedDay)}.</p>
        <div role="img" aria-label={orderBook.weeks.map(week => `${week.week}: ${week.delivered} delivered orders`).join(', ')}
          style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, orderBook.weeks.length)}, minmax(0, 1fr))`, gap: theme.sizing.scale200,
            height: 112, alignItems: 'end', borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
          {orderBook.weeks.map(week => <span key={week.week} data-week={week.week} data-orders={week.delivered}
            title={`${week.week} · ${week.delivered} delivered orders`}
            style={{ height: `${week.delivered * 100 / Math.max(1, ...orderBook.weeks.map(row => row.delivered))}%`, backgroundColor: theme.colors.contentPrimary }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...label }}>
          <span>{dossierWindowWords(orderBook.window.from, orderBook.window.from)}</span><span>{dossierWindowWords(orderBook.window.to, orderBook.window.to)}</span>
        </div>
      </div>
      <h3 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Where the takings come from</h3>
      {orderBook.topCustomers.length > 0 ? (() => {
        const first = orderBook.topCustomers[0];
        const next = orderBook.topCustomers.slice(1, 5);
        const nextBps = next.reduce((sum, row) => sum + row.shareBasisPoints, 0);
        const nextMinor = next.reduce((sum, row) => sum + row.valueMinor, 0);
        const restBps = Math.max(0, 10000 - first.shareBasisPoints - nextBps);
        const restMinor = Math.max(0, orderBook.valueMinor - first.valueMinor - nextMinor);
        return shares('dossier-takings-shares', [
          { key: 'first', name: first.name, basisPoints: first.shareBasisPoints, value: money(first.valueMinor) },
          { key: 'next', name: next.length ? `The next ${next.length} customers` : 'The next customers', basisPoints: nextBps, value: money(nextMinor) },
          { key: 'rest', name: 'Every other customer', basisPoints: restBps, value: money(restMinor) },
        ]);
      })() : <p style={note}>Your customers rank here as their orders land.</p>}
      <ol className={rows} data-testid="dossier-top-customers">
        {orderBook.topCustomers.map((row, index) => <li key={row.customerId} data-testid="dossier-top-customer"
          data-customer-id={row.customerId} data-amount-minor={row.valueMinor} data-basis-points={row.shareBasisPoints}
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400, minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelSmall, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {row.name}</span>
          <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(row.valueMinor)} <em style={unit}>{shareWords(row.shareBasisPoints)}</em></span>
        </li>)}
      </ol>
    </>)}

    {section('risk', 'Risk signals', `${risk.overdue.count} overdue`, <>
      {factList('dossier-risk-facts', [
        { label: 'Overdue invoices', value: String(risk.overdue.count), testid: 'dossier-overdue',
          data: { 'data-count': risk.overdue.count, 'data-amount-minor': risk.overdue.amountMinor },
          note: `${money(risk.overdue.amountMinor)} · ${dayWords(risk.overdue.averageDaysLate)} late on average` },
        { label: 'Disputed orders', value: String(risk.disputed.count), testid: 'dossier-disputed',
          data: { 'data-count': risk.disputed.count, 'data-basis-points': risk.disputed.shareBasisPoints },
          note: `${shareWords(risk.disputed.shareBasisPoints)} of the book` },
      ])}
      <h3 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Orders by weekday</h3>
      <ol className={rows}>
        {risk.weekdays.map(row => <li key={row.name} data-testid="dossier-weekday" data-weekday={row.weekday}
          data-orders={row.orders} data-basis-points={row.shareBasisPoints}
          style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400 }}>
            <span style={theme.typography.LabelSmall}>{row.name}</span>
            <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.orders} <em style={unit}>{shareWords(row.shareBasisPoints)}</em></span>
          </span>
          {bar(row.shareBasisPoints)}
        </li>)}
      </ol>
      <h3 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Unit price range</h3>
      <ol className={rows}>
        {risk.prices.map(row => <li key={row.product} data-testid="dossier-price" data-product={row.product}
          data-min-minor={row.minMinor} data-max-minor={row.maxMinor} data-average-minor={row.averageMinor}
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
          <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>{row.product}</span>
          <span style={{ ...theme.typography.LabelSmall, display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{row.steady ? money(row.averageMinor) : `${money(row.minMinor)} – ${money(row.maxMinor)}`}</span>
            <em style={unit}>{row.steady ? `steady across ${row.lines} lines` : `average ${money(row.averageMinor)}`}</em></span>
        </li>)}
        {risk.prices.length === 0 && <li style={note}>Your products rank here as their lines land.</li>}
      </ol>
    </>)}

    {section('consents', 'Consents', `${dossier.consents.length} recorded`, <ol className={rows}>
      {dossier.consents.map(row => <li key={`${row.kind}-${row.at}`} data-testid="dossier-consent" data-kind={row.kind} data-at={row.at}
        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <span style={theme.typography.LabelSmall}>{DOSSIER_CONSENT_WORDS[row.kind]}</span>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {sharedWords(row.at, WORKSPACE_TIME_ZONE).replace('PDF prepared ', '')}</span>
      </li>)}
      {dossier.consents.length === 0 && <li style={note}>Bank access, repayment and document preparation records appear here with their dates.</li>}
    </ol>)}
    </div>
  </article>;
}
