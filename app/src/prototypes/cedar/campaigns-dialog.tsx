import {moneyNow} from './money-seed';
/** CAMPAIGNS — the act in the Sales header and the modal behind it (FEED-IA §249, brief B).
 *
 * «Button: "Campaigns" (top nav, next to "Orders" and "Money"). Modal opens → two tabs.» — the
 * source thread, 14 September. Cedar's own reading adds the third: the campaigns already sent.
 *
 * ═══ THREE TABS, AND EACH ONE ANSWERS A DIFFERENT QUESTION ══════════════════════════════════
 *   RECOMMENDED CAMPAIGNS   what should I run? Three cards computed from this workspace's own
 *                           book by `campaigns.ts`; each states one sentence, one figure and one
 *                           act, and the act lands where its word says in a single press.
 *   CREATE CUSTOM CAMPAIGN  the six fields of the brief, in one column, with the real message a
 *                           customer will read standing under them.
 *   SENT                    what went out, to how many, and who ordered afterwards.
 *
 * ═══ THE SEND IS ONE SEAM ══════════════════════════════════════════════════════════════════
 * `sendCampaign` below is the whole send: one message per account into that account's own
 * conversation (the thread id IS the customer id), at the hour `replyHour` gives, and the record
 * grows its sends. **Send campaign**, **Launch campaign** and the scheduled runner all call it,
 * so a campaign sent by hand and one sent by the clock are the same event in the same place. The
 * connected WhatsApp number carries the text when it is commissioned; in Cedar the conversation
 * is the record, exactly as it is for a chase.
 *
 * ═══ THE LEDGER IS ENSURED, NEVER INVENTED ═════════════════════════════════════════════════
 * The early-pay card reads the Money ledger, so the dialog calls `ensureExamples(sales)` on open —
 * the same idempotent seeding `areas/money.tsx` and `demo-welcome.tsx` already do, so a person who
 * opens Campaigns before Money reads the same share on both surfaces and nothing is fabricated.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Datepicker, DENSITY } from 'baseui/datepicker';
import { Input } from 'baseui/input';
import { Select } from 'baseui/select';
import { Textarea } from 'baseui/textarea';
import { Megaphone } from 'lucide-react';
import { WorkflowDialog } from './workflow-dialog';
import { usePhone, usePhoneFloor } from './shell';
import { replyHour, sendToThread, useThreads } from './shell/threads';
import { nowOf } from './day';
import { dayFromId, dayIdOf, type Sale } from './sale';
import { useMoney } from './money-store';
import { formatSyntheticMoney } from './money-model';
import { workspaceCurrency } from './currency';
import { cedarDayFromId, cedarTodayId } from './scenario-clock';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { useWhatsAppCapability } from './whatsapp-connection';
import { whatsappWordFor } from './whatsapp-capability';
import {
  accountHistoryOf, campaignsNow, createCampaign, CUSTOM_TEMPLATE, dueCampaigns, messageOf, newCampaignId,
  offerLabel, putCampaign, recommendationsOf, recordSends, redemptionsOf, saveCampaigns, scheduleWords,
  useCampaigns, type CampaignAccount, type CampaignOffer, type CampaignRecord, type OfferType, type Recommendation,
} from './campaigns';
import type { Cast } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';

/** How often the scheduled runner looks, and the boundaries it also looks on — the same bounded
 *  shape `phone-runtime.ts`, the bank monitor and the chase timer already take. */
const CAMPAIGN_TICK_MS = 30_000;

/** The house's own money words, so a card, a row and a message all print one figure. */
const money = (minor: number): string => formatSyntheticMoney(minor);

export type CampaignSendInput = {
  scope: string;
  sector: SectorId;
  campaign: CampaignRecord;
  accounts: readonly CampaignAccount[];
  /** the conversation's own hour, from `replyHour`, so each message is the newest thing said */
  hour: string;
  /** the wall-clock instant the record keeps */
  at: string;
};

/** ONE CAMPAIGN, SENT. Every account on it gets its own merged message in its own conversation,
 *  and the record comes back holding the sends. */
export function sendCampaign(input: CampaignSendInput): CampaignRecord {
  const byId = new Map(input.accounts.map(account => [account.id, account]));
  const sends = [];
  for (const customerId of input.campaign.customers) {
    const account = byId.get(customerId);
    if (!account) continue;
    const text = messageOf(input.campaign.message, account, input.campaign.offer, money);
    if (!text) continue;
    sendToThread(input.sector, customerId, text, input.hour);
    sends.push({ customerId, at: input.at });
  }
  return recordSends(input.campaign, sends);
}

/* ── THE ACT IN THE SALES HEADER ──────────────────────────────────────────────────────────── */

export type CampaignsActProps = {
  scope: string;
  cast: Cast;
  /** the house's whole book, as the river holds it */
  sales: readonly Sale[];
  /** the row is short: the act is its mark alone, with its label on the control */
  compact: boolean;
};

/** **Campaigns**, beside the river's search. It carries the dialog and — only while a campaign is
 *  actually waiting on a date — the runner that sends it. */
export function CampaignsAct({ scope, cast, sales, compact }: CampaignsActProps) {
  const [, theme] = useStyletron();
  const floor = usePhoneFloor();
  const { book } = useCampaigns(scope);
  const [open, setOpen] = React.useState(false);
  const pending = book.campaigns.some(campaign => campaign.scheduledFor && campaign.sends.length === 0);

  return <>
    <span style={{ flex: '0 0 auto', display: 'inline-flex' }} title="Campaigns">
      {compact
        ? <button type="button" data-testid="sales-campaigns" aria-label="Campaigns" aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          style={{ display: 'inline-grid', placeItems: 'center', width: theme.sizing.scale950, height: theme.sizing.scale950,
            ...floor, border: 'none', borderRadius: '50%', background: 'transparent', color: theme.colors.contentPrimary,
            cursor: 'pointer', flex: '0 0 auto' }}>
          <Megaphone size={20} aria-hidden />
        </button>
        : <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.default} data-testid="sales-campaigns"
          aria-label="Campaigns" aria-haspopup="dialog" startEnhancer={<Megaphone size={16} aria-hidden />}
          onClick={() => setOpen(true)} overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}>Campaigns</Button>}
    </span>
    {open && <CampaignsDialog scope={scope} cast={cast} sales={sales} onClose={() => setOpen(false)} />}
    {pending && <CampaignRunner scope={scope} cast={cast} />}
  </>;
}

/** THE CLOCK THAT SENDS A SCHEDULED CAMPAIGN. It mounts only while one is waiting, because the
 *  conversation projection it needs for the reply hour is the app's heaviest fold and a workspace
 *  with nothing scheduled must pay none of it. Catch-up on mount, then every thirty seconds, on
 *  focus and on the tab becoming visible. */
function CampaignRunner({ scope, cast }: { scope: string; cast: Cast }) {
  const threads = useThreads(cast);
  const accounts = React.useMemo(() => cast.customers.map(person => ({ id: person.id, name: person.name })), [cast.customers]);
  const runRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    runRef.current = () => {
      const at = new Date().toISOString();
      const held = campaignsNow(scope);
      const due = dueCampaigns(held.campaigns, at);
      if (due.length === 0) return;
      const hour = replyHour(threads, nowOf(cast));
      let next = held;
      for (const campaign of due) next = putCampaign(next, sendCampaign({ scope, sector: cast.sector, campaign, accounts, hour, at }));
      saveCampaigns(next);
    };
  });
  React.useEffect(() => {
    const tick = () => { if (!document.hidden) runRef.current(); };
    tick();
    const timer = window.setInterval(tick, CAMPAIGN_TICK_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [scope]);
  return null;
}

/* ── THE DIALOG ───────────────────────────────────────────────────────────────────────────── */

type TabId = 'recommended' | 'create' | 'sent';

const TABS: { id: TabId; label: string }[] = [
  { id: 'recommended', label: 'Recommended campaigns' },
  { id: 'create', label: 'Create custom campaign' },
  { id: 'sent', label: 'Sent' },
];

type Draft = {
  name: string;
  audience: 'all' | 'chosen';
  customers: string[];
  offerType: OfferType;
  /** per cent, or the workspace's major units for a fixed amount */
  offerValue: string;
  message: string;
  schedule: 'now' | 'date';
  day: string;
  /** the largest discount this campaign gives away, in the workspace's major units */
  budget: string;
};

const blankDraft = (): Draft => ({
  name: '', audience: 'all', customers: [], offerType: 'percent', offerValue: '10',
  message: CUSTOM_TEMPLATE, schedule: 'now', day: '', budget: '',
});

/** A typed amount, in minor units. An unreadable field reads as zero, which is what the field
 *  itself shows, so the record and the form always agree. */
const minorOf = (value: string): number => {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
};

const offerOf = (draft: Draft): CampaignOffer => draft.offerType === 'fixed'
  ? { type: 'fixed', value: minorOf(draft.offerValue) }
  : { type: draft.offerType, value: draft.offerType === 'percent' ? Math.max(0, Math.round(Number.parseFloat(draft.offerValue) || 0)) : 0 };

export type CampaignsDialogProps = {
  scope: string;
  cast: Cast;
  sales: readonly Sale[];
  onClose: () => void;
};

export function CampaignsDialog({ scope, cast, sales, onClose }: CampaignsDialogProps) {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const { country } = useWorkspaceCapabilities(scope);
  const whatsapp = useWhatsAppCapability(cast.sector);
  const threads = useThreads(cast);
  const { state, ensureExamples } = useMoney(scope);
  const { book } = useCampaigns(scope);
  const [tab, setTab] = React.useState<TabId>('recommended');
  const [draft, setDraft] = React.useState<Draft>(blankDraft);
  const [note, setNote] = React.useState('');
  const nameField = React.useRef<HTMLInputElement | null>(null);
  const sending = React.useRef(false);

  const accounts: CampaignAccount[] = React.useMemo(
    () => cast.customers.map(person => ({ id: person.id, name: person.name })), [cast.customers]);
  const today = cedarTodayId();

  /* The ledger the early-pay card reads. Seeding is idempotent and writes no connection posture. */
  React.useEffect(() => { ensureExamples(sales as Sale[]); }, [cast.sector, sales]);

  const recommendations = React.useMemo(() => recommendationsOf({
    sales, products: cast.products, accounts, invoices: state.invoices, requests: state.requests,
    receipts: state.receipts, history: accountHistoryOf(scope), today, asOf:new Date().toISOString(),sampleAsOf:moneyNow(state),market: country, money,
  }), [sales, cast.products, accounts, state.invoices, state.requests, state.receipts, state.events, state.fixtureDay, scope, today, country]);

  const launch = (input: { name: string; kind: CampaignRecord['kind']; customers: readonly string[];
    offer: CampaignOffer; message: string; scheduledFor: string | null; budgetMinor: number | null }): CampaignRecord | null => {
    if (sending.current || input.customers.length === 0) return null;
    sending.current = true;
    try {
      const at = new Date().toISOString();
      const held = campaignsNow(scope);
      const draftRecord = createCampaign({ ...input, id: newCampaignId(at, held.campaigns.length), createdAt: at });
      const sent = input.scheduledFor
        ? draftRecord
        : sendCampaign({ scope, sector: cast.sector, campaign: draftRecord, accounts, hour: replyHour(threads, nowOf(cast)), at });
      saveCampaigns(putCampaign(held, sent));
      return sent;
    } finally { sending.current = false; }
  };

  /* ── THE CARDS' THREE ACTS ─────────────────────────────────────────────────────────────── */

  const openAdvance = (minor: number) => { window.location.hash = `#/money/advance/${Math.max(0, Math.round(minor))}`; };

  const sendRecommended = (recommendation: Recommendation) => {
    const sent = launch({ name: recommendation.name, kind: 'recommended', customers: recommendation.customers,
      offer: recommendation.offer, message: recommendation.message, scheduledFor: null, budgetMinor: null });
    if (sent) setNote(`Sent to ${sent.sends.length} ${sent.sends.length === 1 ? 'account' : 'accounts'}.`);
  };

  const prefill = (recommendation: Recommendation) => {
    setDraft({
      name: recommendation.name, audience: 'all', customers: [],
      offerType: recommendation.offer.type,
      offerValue: recommendation.offer.type === 'fixed' ? String(recommendation.offer.value / 100) : String(recommendation.offer.value),
      message: recommendation.message, schedule: 'now', day: '', budget: '',
    });
    setTab('create');
    setNote('');
    window.setTimeout(() => nameField.current?.focus(), 0);
  };

  /* A win-back campaign this workspace already ran today states what it did instead of offering
     the same send twice; the book answers, so a reload reads the same thing. */
  const sentToday = (recommendation: Recommendation): CampaignRecord | undefined => book.campaigns
    .filter(campaign => campaign.name === recommendation.name && campaign.sends.length > 0)
    .find(campaign => cedarTodayId(new Date(campaign.sends[campaign.sends.length - 1].at)) === today);

  /* ── THE REGISTERS THE MONEY DASHBOARD USES ────────────────────────────────────────────── */

  const card = css({ display: 'grid', gap: theme.sizing.scale500, minWidth: 0, alignContent: 'start',
    padding: theme.sizing.scale700, border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary,
    '@media (max-width: 600px)': { padding: theme.sizing.scale600 } });
  const secondary: React.CSSProperties = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 };
  const label: React.CSSProperties = { ...theme.typography.LabelSmall, color: theme.colors.contentSecondary };
  const figure: React.CSSProperties = { ...theme.typography.HeadingXSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const touch = { BaseButton: { style: { minHeight: '44px' } } };
  const field = { Root: { style: { minHeight: '44px' } } };
  const settled = { transition: `opacity ${theme.animation.timing400} ${theme.animation.easeOutCurve}` };

  const tabButton = (row: { id: TabId; label: string }) => <Button key={row.id} role="tab"
    id={`campaigns-tab-${row.id}`} aria-selected={tab === row.id} aria-controls="campaigns-panel"
    data-testid={`campaigns-tab-${row.id}`} kind={tab === row.id ? KIND.primary : KIND.tertiary}
    size={SIZE.compact} onClick={() => { setTab(row.id); setNote(''); }}
    onKeyDown={event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = TABS.findIndex(item => item.id === row.id);
      const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      setTab(next.id);
      setNote('');
      document.getElementById(`campaigns-tab-${next.id}`)?.focus();
    }}
    overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}>{row.label}</Button>;

  /* ── TAB 1 · RECOMMENDED CAMPAIGNS ─────────────────────────────────────────────────────── */

  const recommendedTab = <div style={{ display: 'grid', gap: theme.sizing.scale600, minWidth: 0,
    gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' }}>
    {recommendations.map((recommendation, index) => {
      const already = recommendation.key === 'win-back' ? sentToday(recommendation) : undefined;
      const acts = recommendation.key === 'pre-buy'
        ? recommendation.advanceMinor > 0
        : recommendation.key === 'win-back' ? recommendation.customers.length > 0 && !already : true;
      return <article key={recommendation.key} className={card} data-testid={`campaign-card-${recommendation.key}`}
        data-facts={JSON.stringify(recommendation.facts)}
        style={{ gridColumn: !phone && index === 2 ? '1 / -1' : undefined }}>
        <h3 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>{recommendation.heading}</h3>
        <p data-testid={`campaign-fact-${recommendation.key}`} style={{ ...secondary, overflowWrap: 'anywhere' }}>{recommendation.fact}</p>
        {recommendation.figureText && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
          justifyContent: 'space-between', gap: theme.sizing.scale400 }}>
          <span style={label}>{recommendation.figureLabel}</span>
          <strong data-testid={`campaign-figure-${recommendation.key}`} style={figure}>{recommendation.figureText}</strong>
        </div>}
        {acts && <div style={{ display: 'flex' }}>
          <Button kind={KIND.primary} size={SIZE.compact} overrides={touch} data-testid={`campaign-act-${recommendation.key}`}
            onClick={() => {
              if (recommendation.key === 'pre-buy') openAdvance(recommendation.advanceMinor);
              else if (recommendation.key === 'win-back') sendRecommended(recommendation);
              else prefill(recommendation);
            }}>{recommendation.act}</Button>
        </div>}
        {already && <p data-testid="campaign-win-back-sent" style={{ ...secondary, ...settled }}>
          Sent to {already.sends.length} {already.sends.length === 1 ? 'account' : 'accounts'} today · {hourWords(already.sends[already.sends.length - 1].at)}
        </p>}
        {recommendation.key === 'win-back' && <p style={{ ...label, margin: 0 }}>
          Each message lands in that customer’s own conversation · WhatsApp: {whatsappWordFor(whatsapp)}
        </p>}
      </article>;
    })}
  </div>;

  /* ── TAB 2 · CREATE CUSTOM CAMPAIGN ────────────────────────────────────────────────────── */

  const chosen = draft.audience === 'all' ? accounts.map(account => account.id) : draft.customers;
  const options = React.useMemo(() => accounts.map(account => ({ id: account.id, label: account.name })), [accounts]);
  const offer = offerOf(draft);
  const preview = messageOf(draft.message, accounts.find(account => account.id === chosen[0]) ?? { name: 'Bar' }, offer, money);
  const scheduledFor = draft.schedule === 'date' && draft.day ? cedarDayFromId(draft.day).toISOString() : null;
  const ready = draft.name.trim().length > 0 && chosen.length > 0 && draft.message.trim().length > 0
    && (draft.schedule === 'now' || Boolean(draft.day));

  const group = (name: string, rows: { id: string; label: string; on: boolean; pick: () => void }[]) =>
    <div role="group" aria-label={name} style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
      {rows.map(row => <Button key={row.id} size={SIZE.compact} kind={row.on ? KIND.secondary : KIND.tertiary}
        aria-pressed={row.on} data-testid={row.id} onClick={row.pick} overrides={touch}>{row.label}</Button>)}
    </div>;

  const createTab = <div style={{ display: 'grid', gap: theme.sizing.scale700, minWidth: 0, maxWidth: '520px' }}>
    <label style={{ display: 'grid', gap: theme.sizing.scale300, ...theme.typography.LabelSmall, minWidth: 0 }}>Campaign name
      <Input value={draft.name} onChange={event => setDraft({ ...draft, name: event.currentTarget.value })}
        placeholder="Spring offer" overrides={{ ...field, Input: { props: { 'data-testid': 'campaign-name', ref: nameField } } }} />
    </label>

    <div style={{ display: 'grid', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={theme.typography.LabelSmall}>Target customers</span>
      {group('Target customers', [
        { id: 'campaign-audience-all', label: 'All customers', on: draft.audience === 'all', pick: () => setDraft({ ...draft, audience: 'all' }) },
        { id: 'campaign-audience-chosen', label: 'Choose customers', on: draft.audience === 'chosen', pick: () => setDraft({ ...draft, audience: 'chosen' }) },
      ])}
      {draft.audience === 'chosen' && <Select multi searchable clearable options={options} aria-label="Choose customers"
        placeholder="Search your customers" data-testid="campaign-customers"
        value={options.filter(option => draft.customers.includes(String(option.id)))}
        onChange={({ value }) => setDraft({ ...draft, customers: value.map(option => String(option.id)) })} />}
      <span data-testid="campaign-audience-count" style={label}>{chosen.length} {chosen.length === 1 ? 'customer' : 'customers'}</span>
    </div>

    <div style={{ display: 'grid', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={theme.typography.LabelSmall}>Offer</span>
      {group('Offer', [
        { id: 'campaign-offer-percent', label: 'Discount %', on: draft.offerType === 'percent', pick: () => setDraft({ ...draft, offerType: 'percent', offerValue: '10' }) },
        { id: 'campaign-offer-fixed', label: 'Fixed amount', on: draft.offerType === 'fixed', pick: () => setDraft({ ...draft, offerType: 'fixed', offerValue: '20' }) },
        { id: 'campaign-offer-free-delivery', label: 'Free delivery', on: draft.offerType === 'free-delivery', pick: () => setDraft({ ...draft, offerType: 'free-delivery', offerValue: '0' }) },
      ])}
      {draft.offerType !== 'free-delivery' && <label style={{ display: 'grid', gap: theme.sizing.scale300, ...theme.typography.LabelSmall, minWidth: 0 }}>
        {draft.offerType === 'percent' ? 'Per cent off' : `Amount off · ${workspaceCurrency(scope)}`}
        <Input value={draft.offerValue} inputMode="decimal" onChange={event => setDraft({ ...draft, offerValue: event.currentTarget.value })}
          overrides={{ ...field, Input: { props: { 'data-testid': 'campaign-offer-value' } } }} />
      </label>}
      <span data-testid="campaign-offer-label" style={label}>{offerLabel(offer, money)}</span>
    </div>

    <label style={{ display: 'grid', gap: theme.sizing.scale300, ...theme.typography.LabelSmall, minWidth: 0 }}>Message template
      <Textarea value={draft.message} rows={4} aria-label="Message template"
        onChange={event => setDraft({ ...draft, message: event.currentTarget.value })}
        overrides={{ Input: { props: { 'data-testid': 'campaign-message' } } }} />
      <span style={label}>{'{name}'} takes the customer’s name and {'{offer}'} takes the offer’s words.</span>
    </label>
    <div style={{ display: 'grid', gap: theme.sizing.scale200, padding: theme.sizing.scale500,
      borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary, minWidth: 0 }}>
      <span style={label}>What a customer reads</span>
      <p data-testid="campaign-preview" style={{ ...theme.typography.ParagraphSmall, margin: 0, overflowWrap: 'anywhere' }}>{preview}</p>
    </div>

    <div style={{ display: 'grid', gap: theme.sizing.scale300, minWidth: 0 }}>
      <span style={theme.typography.LabelSmall}>Schedule</span>
      {group('Schedule', [
        { id: 'campaign-schedule-now', label: 'Send now', on: draft.schedule === 'now', pick: () => setDraft({ ...draft, schedule: 'now' }) },
        { id: 'campaign-schedule-date', label: 'Pick a date', on: draft.schedule === 'date', pick: () => setDraft({ ...draft, schedule: 'date', day: draft.day || today }) },
      ])}
      {draft.schedule === 'date' && <Datepicker value={draft.day ? dayFromId(draft.day) : null}
        highlightedDate={dayFromId(draft.day || today)} density={phone ? DENSITY.high : DENSITY.default}
        minDate={dayFromId(today)} formatString="dd/MM/yyyy" mask={null} aria-label="The day this campaign goes out"
        onChange={({ date }) => { const one = Array.isArray(date) ? date[0] : date; setDraft({ ...draft, day: one ? dayIdOf(one) : '' }); }}
        overrides={{ CalendarContainer: { props: { 'data-testid': 'campaign-calendar' }, style: { maxWidth: '100vw', boxSizing: 'border-box' } },
          Input: { props: { overrides: { Input: { props: { 'data-testid': 'campaign-date' } } } } } }} />}
    </div>

    <label style={{ display: 'grid', gap: theme.sizing.scale300, ...theme.typography.LabelSmall, minWidth: 0 }}>
      Budget · {workspaceCurrency(scope)}
      <Input value={draft.budget} inputMode="decimal" placeholder="500"
        onChange={event => setDraft({ ...draft, budget: event.currentTarget.value })}
        overrides={{ ...field, Input: { props: { 'data-testid': 'campaign-budget' } } }} />
      <span style={label}>The largest discount this campaign gives away.</span>
    </label>
  </div>;

  /* ── TAB 3 · SENT ──────────────────────────────────────────────────────────────────────── */

  const rows = [...book.campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sentTab = <div style={{ display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
    {rows.length === 0 && <p data-testid="campaigns-sent-empty" style={secondary}>
      Campaigns you launch appear here with their sends and the customers who ordered afterwards.</p>}
    {rows.map(campaign => {
      const redeemed = redemptionsOf(campaign, sales);
      return <article key={campaign.id} className={card} data-testid={`campaign-row-${campaign.id}`}
        data-sends={campaign.sends.length} data-customers={campaign.customers.length}
        data-redemptions={redeemed.length} data-scheduled={campaign.scheduledFor ? 'yes' : 'no'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400 }}>
          <span style={{ ...theme.typography.LabelLarge, overflowWrap: 'anywhere', minWidth: 0 }}>{campaign.name}</span>
          <span style={{ ...theme.typography.LabelMedium, whiteSpace: 'nowrap' }}>{offerLabel(campaign.offer, money)}</span>
        </div>
        <p style={secondary}>{campaign.customers.length} {campaign.customers.length === 1 ? 'customer' : 'customers'}
          {campaign.budgetMinor ? ` · Budget ${money(campaign.budgetMinor)}` : ''}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale700 }}>
          {campaign.scheduledFor
            ? <span data-testid={`campaign-schedule-${campaign.id}`} style={{ ...theme.typography.LabelMedium, ...settled }}>{scheduleWords(campaign)}</span>
            : <>
              <span style={{ display: 'grid', gap: theme.sizing.scale100 }}>
                <span style={label}>Sent</span>
                <strong data-testid={`campaign-sends-${campaign.id}`} style={figure}>{campaign.sends.length}</strong>
              </span>
              <span style={{ display: 'grid', gap: theme.sizing.scale100 }}>
                <span style={label}>Redemptions</span>
                <strong data-testid={`campaign-redemptions-${campaign.id}`} style={figure}>{redeemed.length}</strong>
              </span>
            </>}
        </div>
      </article>;
    })}
  </div>;

  const actions = tab === 'create'
    ? <Button data-testid="campaign-launch" disabled={!ready} overrides={touch}
      onClick={() => {
        const sent = launch({ name: draft.name, kind: 'custom', customers: chosen, offer,
          message: draft.message, scheduledFor, budgetMinor: minorOf(draft.budget) || null });
        if (!sent) return;
        setDraft(blankDraft());
        setTab('sent');
        setNote(sent.scheduledFor ? scheduleWords(sent) : `Sent to ${sent.sends.length} ${sent.sends.length === 1 ? 'account' : 'accounts'}.`);
      }}>Launch campaign</Button>
    : undefined;

  return <WorkflowDialog title="Campaigns" onClose={onClose} testId="campaigns-dialog" actions={actions}>
    <div style={{ display: 'grid', gap: theme.sizing.scale700, minWidth: 0 }}>
      <div role="tablist" aria-label="Campaigns" style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
        {TABS.map(tabButton)}
      </div>
      {note && <p role="status" data-testid="campaigns-note" style={{ ...theme.typography.LabelMedium, margin: 0, ...settled }}>{note}</p>}
      <div id="campaigns-panel" role="tabpanel" aria-labelledby={`campaigns-tab-${tab}`} data-testid="campaigns-panel"
        data-tab={tab} style={{ minWidth: 0 }}>
        {tab === 'recommended' ? recommendedTab : tab === 'create' ? createTab : sentTab}
      </div>
    </div>
  </WorkflowDialog>;
}

/** «09:41» — the hour a send landed, on the device it landed on. */
function hourWords(at: string): string {
  const instant = new Date(at);
  return Number.isFinite(instant.getTime())
    ? instant.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : '';
}
