import * as React from 'react';
import { FeatureArtwork, HeroArtwork } from './feature-artwork';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Input } from 'baseui/input';
import { Slider } from 'baseui/slider';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronRight, FileText, Landmark, Settings2, Users } from 'lucide-react';
import { useMoney } from './money-store';
import { collectionGuard } from './money-api';
import { invoiceClock, formatMoney, formatLedgerMoney, formatInvoiceMoney, formatSyntheticMoney, installmentStatusOf, invoiceBalance, invoiceOverdueDays, isCollectible, peruDate, planStatusOf, statusWordsOf, unpaidOrders, urgentUnpaidOrders } from './money-model';
import { moneyWorkspace, moneyNow, type MoneySourceSale } from './money-seed';
import { projectMoney } from './money-projections';
import { readBankActivity, useBankCapability, type BankActivity } from './money-bank-api';
import { BankActivityCard, BankIncomingChart } from './money-bank-activity';
import { CreditOverview, creditDate, dueWordsOf } from './money-credit';
import { ADVANCE_FLOOR_MINOR, ADVANCE_MINIMUM_MINOR, ADVANCE_PURPOSES, ADVANCE_STEP_MINOR, advanceLimitOf, advanceOutstanding,
  clampAdvanceAmount, createAdvance, parseAdvance, recordAdvanceRepayment,
  type AdvanceCount, type AdvanceLimit, type AdvancePlan, type AdvancePurpose } from './money-finance';
import { LenderDoor } from './money-dossier';
import { WorkflowDialog } from './workflow-dialog';
import { usePhone } from './shell';
import { LEGACY_EUR_TO_PEN, workspaceCurrency } from './currency';

/* THE BANK MONITOR'S WHOLE VOCABULARY, READ (FEED-IA §247.6). `money-api` parses five monitor
   states and two of them — `off` and `scheduled` — were rendered nowhere, so the parsed list and
   the readable list were different lists, and the unread `scheduled` collided with a word the
   repayment timeline was printing about something else. Each state now states what it means for
   the person, and «Scheduled» stays Sales' own delivery word. */
const MONITOR_WORDS: Record<'off' | 'scheduled' | 'running' | 'retrying' | 'reauthorization-required', string> = {
  off: 'Payment checks run when you refresh',
  scheduled: 'Next payment check queued',
  running: 'Checking incoming payments…',
  retrying: 'Bank update delayed · Retrying automatically',
  'reauthorization-required': 'Reconnect your bank to resume payment checks',
};

const advancePrefix = 'rocoto-cedar-finance-v1:';
const advanceCache = new Map<string, AdvancePlan | null>();
const advanceListeners = new Set<() => void>();
function readAdvance(scope: string): AdvancePlan | null {
  if (!advanceCache.has(scope)) {
    let value: AdvancePlan | null = null;
    try {
      const raw = localStorage.getItem(advancePrefix + scope);
      if (raw && raw.length < 12000) value = parseAdvance(JSON.parse(raw), scope);
    } catch { /* A fresh financing preview remains available. */ }
    advanceCache.set(scope, value);
  }
  return advanceCache.get(scope)!;
}
const subscribeAdvance = (listener: () => void) => { advanceListeners.add(listener); return () => { advanceListeners.delete(listener); }; };
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === null || event.key.startsWith(advancePrefix)) {
    advanceCache.clear(); advanceListeners.forEach(listener => listener());
  }
});
/* The shared reset contract (PRODUCT-SPEC «Reset»): the key is already cleared, so the module's
   copy of the plan goes with it and the card returns to the offer. */
if (typeof window !== 'undefined') window.addEventListener('rocoto:cedar-workspace-reset', event => {
  const scope = (event as CustomEvent<{ scope?: string }>).detail?.scope;
  if (scope) advanceCache.delete(scope); else advanceCache.clear();
  advanceListeners.forEach(listener => listener());
});
function useAdvance(scope: string) {
  const snapshot = React.useCallback(() => readAdvance(scope), [scope]);
  const plan = React.useSyncExternalStore(subscribeAdvance, snapshot, snapshot);
  const save = (next: AdvancePlan | null): boolean => {
    if (next && !parseAdvance(next, scope)) return false;
    try {
      if (next) localStorage.setItem(advancePrefix + scope, JSON.stringify(next));
      else localStorage.removeItem(advancePrefix + scope);
    } catch { return false; }
    advanceCache.set(scope, next); advanceListeners.forEach(listener => listener()); return true;
  };
  return { plan, save };
}

/** THE ROW PETER READ (FEED-IA §247.6). Every unpaid row used to say «Scheduled», and this same
 *  timeline is drawn inside the offer dialog — so an offer nobody had accepted was printed as a
 *  schedule. `accepted` says whether a plan exists; the word comes from the one state table in
 *  money-model, so an offer reads Offered and a live plan reads Paid, Due, Overdue and Upcoming. */
function RepaymentTimeline({ plan, today, accepted }: { plan: AdvancePlan; today: string; accepted: boolean }) {
  const [css, theme] = useStyletron();
  return <ol data-testid="advance-timeline" className={css({ listStyle: 'none', margin: 0, padding: 0, display: 'grid',
    gridTemplateColumns: `repeat(${Math.min(plan.count, 3)}, minmax(0, 1fr))`, gap: theme.sizing.scale500,
    /* Three columns of «S/ 1,675.00» stand 11px wider than a 320px card, so the narrowest phone
       takes two and the third instalment drops to the line below it. */
    '@media (max-width: 360px)': { gridTemplateColumns: `repeat(${Math.min(plan.count, 2)}, minmax(0, 1fr))` },
    '@media (min-width: 700px)': { gridTemplateColumns: `repeat(${plan.count}, minmax(0, 1fr))` } })}>
    {plan.installments.map((item, index) => {
      const status = accepted ? installmentStatusOf(plan, index, today) : 'offered';
      return <li key={item.dueAt} data-amount-minor={item.amountMinor} data-due-at={item.dueAt} data-status={status}
        style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0, borderTop: `2px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale400 }}>
        <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatSyntheticMoney(item.amountMinor)}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{creditDate(item.dueAt)}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{statusWordsOf(status)}</span>
      </li>;
    })}
  </ol>;
}

/** What each purpose is called on the card and in the dialog. */
const PURPOSE_WORDS: Record<AdvancePurpose, string> = {
  stock: 'Stock', prebuy: 'Pre-buy', payroll: 'Payroll', other: 'Other',
};

/* THE UBER MODAL ANATOMY (FEED-IA §247.6): image · title · body · one action. The hero runs the
   full width of the frame, so this dialog owns its own scrollport and gutter rather than the
   body's — the picture has to touch three edges, and a padded body cannot let it.
   THE ADVANCE IS ASKED FOR HERE AND GRANTED ON THE SPOT (§249, «just like in monzo»): the amount,
   the plan, the purpose and the repayment authorization, then one act. */
function AdvanceDialog({ scope, limit, prefilledMinor, onClose, onSave }: {
  scope: string; limit: AdvanceLimit; prefilledMinor?: number;
  onClose: () => void; onSave: (plan: AdvancePlan) => boolean;
}) {
  const [css, theme] = useStyletron();
  const id = React.useId();
  const [count, setCount] = React.useState<AdvanceCount>(3);
  const [createdAt] = React.useState(() => moneyWorkspace(scope).referenceAt);
  const opening = clampAdvanceAmount(prefilledMinor ?? ADVANCE_FLOOR_MINOR, limit.availableMinor);
  const [chosen, setChosen] = React.useState(opening);
  const [typed, setTyped] = React.useState(() => String(opening / 100));
  const [purpose, setPurpose] = React.useState<AdvancePurpose>('stock');
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState('');
  /* ⚠ 14 September 2026 — THE FRAME'S OWN ATTRIBUTE, STAMPED FROM HERE. `WorkflowDialog` takes a
     `testId` and carries no other data attribute, and the amount-carrying route's proof is read
     off the frame itself (FEED-IA §249). The scrollport's own ref callback walks up to the frame
     the moment the portal attaches it, so the attribute stands before anything reads it; the lead
     ask on workflow-dialog.tsx is a `dataProps` passthrough that retires these four lines. */
  const stamp = React.useCallback((node: HTMLDivElement | null) => {
    node?.closest('[data-testid="advance-dialog"]')?.setAttribute('data-prefilled-minor', String(prefilledMinor ?? 0));
  }, [prefilledMinor]);
  const amount = clampAdvanceAmount(chosen, limit.availableMinor);
  const maximum = Math.max(ADVANCE_MINIMUM_MINOR + ADVANCE_STEP_MINOR, limit.availableMinor);
  const draft = (option: AdvanceCount) => createAdvance({ scope, principalMinor: amount, count: option,
    createdAt, purpose, consentAt: createdAt, limitMinor: limit.limitMinor });
  const selected = draft(count);
  const gutter = css({ padding: theme.sizing.scale800, '@media (max-width: 600px)': { padding: theme.sizing.scale600 } });
  const legend = { ...theme.typography.LabelMedium, marginBottom: theme.sizing.scale500 };
  const take = (minor: number) => { setChosen(minor); setTyped(String(clampAdvanceAmount(minor, limit.availableMinor) / 100)); };
  return <WorkflowDialog title="Pay over time" onClose={onClose} testId="advance-dialog" flush
    actions={<Button data-testid="advance-confirm" disabled={!consent} onClick={() => {
      if (onSave(selected)) onClose(); else setError('Allow browser storage to save your advance.');
    }}>Get advance</Button>}>
    <div ref={stamp} className={css({ height: '100%', minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden',
      overscrollBehavior: 'contain', display: 'grid', gridTemplateRows: 'auto 1fr', alignContent: 'start' })}>
      <HeroArtwork kind="working-capital" />
      <div className={gutter} style={{ display: 'grid', gap: theme.sizing.scale800, alignContent: 'start' }}>
        <div style={{ display: 'grid', gap: theme.sizing.scale300 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
            <h3 style={{ ...theme.typography.HeadingMedium, margin: 0 }}>Working capital</h3>
            <strong data-testid="advance-principal" data-amount-minor={amount} style={{ ...theme.typography.HeadingSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatSyntheticMoney(amount)}</strong>
          </div>
          <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, margin: 0 }}>{formatSyntheticMoney(limit.availableMinor)} available from your last four weeks of sales.</p>
        </div>
        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={legend}>Amount</legend>
          {/* The coarse control and the exact figure answer each other: the slider moves the
              Input and the Input moves the slider, both on the S/ 100 grain the plan is built on. */}
          <div className={css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 136px', gap: theme.sizing.scale700,
            alignItems: 'center', '@media (max-width: 480px)': { gridTemplateColumns: 'minmax(0, 1fr)' } })}>
            <div style={{ minWidth: 0 }}>
              <Slider value={[amount]} min={ADVANCE_MINIMUM_MINOR} max={maximum} step={ADVANCE_STEP_MINOR}
                onChange={({ value }) => take(value[0] ?? amount)}
                valueToLabel={(value) => formatSyntheticMoney(value)}
                overrides={{
                  Root: { props: { 'data-testid': 'advance-amount' }, style: { minHeight: '44px' } },
                  Thumb: { props: { 'data-testid': 'advance-amount-thumb', 'aria-label': 'Advance amount' } },
                }} />
            </div>
            <Input value={typed} size="compact" startEnhancer="S/" aria-label="Advance amount in soles"
              inputMode="numeric"
              onChange={(event) => {
                const raw = event.currentTarget.value;
                setTyped(raw);
                const parsed = Number(raw.replace(/[^\d.]/g, ''));
                if (Number.isFinite(parsed) && raw.trim()) setChosen(clampAdvanceAmount(Math.round(parsed * 100), limit.availableMinor));
              }}
              onBlur={() => setTyped(String(amount / 100))}
              overrides={{ Input: { props: { 'data-testid': 'advance-amount-input' }, style: { fontVariantNumeric: 'tabular-nums' } } }} />
          </div>
        </fieldset>
        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={legend}>Choose how to pay</legend>
          <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
            {([1, 3, 6] as const).map(option => {
              const plan = draft(option), checked = option === count;
              return <div key={option} data-testid={`advance-option-${option}`} style={{ display: 'grid', gap: theme.sizing.scale600,
                border: `2px solid ${checked ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
                borderRadius: theme.borders.radius400, padding: theme.sizing.scale600, backgroundColor: theme.colors.backgroundPrimary }}>
                <label htmlFor={`${id}-${option}`} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, minHeight: 48, cursor: 'pointer' }}>
                  <input id={`${id}-${option}`} name={`${id}-repayment`} type="radio" value={option} checked={checked}
                    onChange={() => setCount(option)} data-testid={`advance-radio-${option}`}
                    style={{ width: 22, height: 22, flexShrink: 0, margin: 0, accentColor: theme.colors.contentPrimary }} />
                  <span style={{ display: 'grid', gap: theme.sizing.scale200 }}>
                    <span style={theme.typography.LabelLarge}>{option === 1 ? `Pay in full on ${creditDate(plan.installments[0].dueAt)}` : `${option} monthly payments`}</span>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{plan.interestMinor === 0 ? 'Interest free' : `${plan.interestBasisPoints / 100}% total interest · ${formatSyntheticMoney(plan.interestMinor)}`}</span>
                  </span>
                </label>
                {checked && <RepaymentTimeline plan={plan} today={peruDate(createdAt)} accepted={false} />}
              </div>;
            })}
          </div>
        </fieldset>
        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={legend}>What it is for</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale400 }}>
            {ADVANCE_PURPOSES.map(key => <Button key={key} type="button" size={SIZE.compact}
              kind={key === purpose ? KIND.primary : KIND.secondary} aria-pressed={key === purpose}
              data-testid={`advance-purpose-${key}`} onClick={() => setPurpose(key)}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{PURPOSE_WORDS[key]}</Button>)}
          </div>
        </fieldset>
        {/* THE AUTHORIZATION THE BaaS RULES ASK FOR (the Eleven brief, «Consent logs»). The grant
            and this consent are one act, so the plan records the moment it was given. */}
        <Checkbox checked={consent} onChange={(event) => setConsent((event.target as HTMLInputElement).checked)}
          overrides={{ Input: { props: { 'data-testid': 'advance-consent' } }, Root: { style: { minHeight: '44px', alignItems: 'center' } } }}>
          I authorize repayment from incoming Yape and Plin payments
        </Checkbox>
        <div data-testid="advance-total" style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, ...theme.typography.LabelMedium }}><span>Total repayment</span><strong style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatSyntheticMoney(selected.totalRepaymentMinor)}</strong></div>
        {error && <p role="alert" style={{ ...theme.typography.ParagraphSmall, margin: 0 }}>{error}</p>}
      </div>
    </div>
  </WorkflowDialog>;
}

function WorkingCapital({ scope, sales, advanceMinor }: { scope: string; sales: MoneySourceSale[]; advanceMinor?: number }) {
  const [css, theme] = useStyletron();
  const { state } = useMoney(scope);
  const { plan, save } = useAdvance(scope);
  /* THE BANK POSTURE IS WHAT GATES THIS CARD (FEED-IA §247.6, §247.8). A complete, fully
     operable credit product stood here with a 12px grey «Future» pill to say it transacts with
     nobody, and it was the one Money card that read identically with and without a bank. The word
     is gone and the gate is the bank's own answer: every act runs through `liveAct`, and the card
     answers a bank that is not ready exactly as the other money surfaces do — one picture, one
     act, «Connect bank». The day a provider exists, `live` is the one expression that changes. */
  const bank = useBankCapability(scope);
  const live = bank.posture === 'ready';
  const [open, setOpen] = React.useState(false);
  const [prefilled, setPrefilled] = React.useState<number | undefined>(undefined);
  const [expanded, setExpanded] = React.useState(false);
  const [error, setError] = React.useState('');
  const next = plan?.installments[plan.paidCount];
  /* The plan is made on the workspace's own clock, so it is judged on that same clock — the
     calendar the instalment dates came from. One state word, one date, one reading. */
  const today = peruDate(moneyNow(state));
  /* THE OFFER, FROM THIS WORKSPACE'S OWN BOOK (FEED-IA §249). Half of the last four weeks of
     sales, in S/ 500 steps, between the floor and the ceiling, raised a tenth for each plan
     repaid on time, less the principal already standing. */
  const limit = React.useMemo(() => advanceLimitOf({ day: today, sales, plans: plan ? [plan] : [] }), [today, sales, plan]);
  const planStatus = planStatusOf(plan);
  const nextStatus = installmentStatusOf(plan, plan?.paidCount ?? 0, today);
  const posture = live ? planStatus : 'setup';
  const rose = Boolean(plan && plan.limitMinor !== undefined && limit.repaidCount > 0 && limit.limitMinor > plan.limitMinor);
  React.useEffect(() => { setOpen(false); setPrefilled(undefined); setExpanded(false); setError(''); }, [scope]);
  /* THE ROUTE THAT CARRIES AN AMOUNT (FEED-IA §249). `#/money/advance/<minor>` is the road the
     campaigns' pre-buy card, the cash-crunch line and the 72 h chase all take: Pay over time opens
     on that amount and the hash returns to `#/money`, so Back leaves the dashboard behind rather
     than the dialog that was already closed. */
  React.useEffect(() => {
    if (advanceMinor === undefined || !live || plan) return;
    setPrefilled(advanceMinor);
    setOpen(true);
    window.history.replaceState(null, '', '#/money');
  }, [advanceMinor, live, plan]);
  const change = (value: AdvancePlan | null) => {
    const saved = save(value); setError(saved ? '' : 'Allow browser storage to save your repayment plan.'); return saved;
  };
  /** ONE GATE FOR EVERY ACT ON THIS CARD: the bank's own answer. */
  const liveAct = <T,>(run: () => T) => () => { if (live) run(); };
  const card = css({ padding: theme.sizing.scale800, borderRadius: theme.borders.radius400,
    backgroundColor: theme.colors.backgroundPrimary, border: `1px solid ${theme.colors.borderOpaque}`,
    minWidth: 0, '@media (max-width: 600px)': { padding: theme.sizing.scale600 } });
  const head = <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
    <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: 0 }}>Working capital</span>
    <span data-testid="advance-status" data-status={posture} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{live ? statusWordsOf(planStatus) : 'Connect bank'}</span>
  </div>;
  const figure: React.CSSProperties = { ...theme.typography.HeadingMedium, margin: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const unit: React.CSSProperties = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'normal' };
  const fact: React.CSSProperties = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 };
  if (!live) return <section data-testid="money-working-capital" data-plan-posture={posture} data-bank-posture={bank.posture} className={card}>
    <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
      {head}
      <div data-testid="money-working-capital-setup-state" style={{ display: 'grid', justifyItems: 'center', gap: theme.sizing.scale500, textAlign: 'center' }}>
        <FeatureArtwork kind="money" size={116} />
        <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0, maxWidth: 320 }}>Working capital opens once your bank is connected.</p>
        <Button data-testid="money-working-capital-open-setup" onClick={() => { window.location.hash = '#/admin/connections/payments'; }}>Connect bank</Button>
      </div>
    </div>
  </section>;
  return <section data-testid="money-working-capital" data-plan-posture={posture} data-bank-posture={bank.posture} className={card}>
    <div data-testid={plan ? 'advance-existing' : 'advance-offer'} style={{ display: 'grid', gap: theme.sizing.scale600 }}>
      {head}
      {/* At 320 the amount and the object together are wider than the card, so the object drops
          below rather than pushing the card past the viewport. It holds the right edge on the line
          it lands on, under the status word, rather than floating left of an empty gutter. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: theme.sizing.scale400, minWidth: 0, flex: '1 1 auto' }}>
          {plan ? <>
            <h3 data-testid="advance-granted" data-amount-minor={plan.principalMinor} style={figure}>{formatSyntheticMoney(plan.principalMinor)} <em style={unit}>granted</em></h3>
            <p data-testid="advance-next" style={fact}>
              {next ? `${statusWordsOf(nextStatus)} · ${formatSyntheticMoney(next.amountMinor)} on ${creditDate(next.dueAt)}`
                : `${plan.count} of ${plan.count} paid`}</p>
            <p data-testid="advance-available" data-amount-minor={limit.availableMinor} style={{ ...fact, whiteSpace: 'nowrap' }}>{formatSyntheticMoney(limit.availableMinor)} still available</p>
            {rose && <p data-testid="advance-limit-rose" style={fact}>Repaid on time · your limit rose to {formatSyntheticMoney(limit.limitMinor)}</p>}
          </> : <>
            <h3 data-testid="advance-available" data-amount-minor={limit.availableMinor} style={figure}>{formatSyntheticMoney(limit.availableMinor)} <em style={unit}>available</em></h3>
            <p style={fact}>From your last four weeks of sales. Repaid from incoming payments.</p>
          </>}
        </div>
        <span style={{ marginLeft: 'auto' }}><FeatureArtwork kind="money" size={116} /></span>
      </div>
      {plan ? <Button kind={KIND.secondary} data-testid="advance-details" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
        endEnhancer={() => <ChevronRight size={18} aria-hidden className={css({ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 400ms ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } })} />}>Repayment details</Button>
        : <Button data-testid="advance-open" onClick={liveAct(() => { setPrefilled(undefined); setOpen(true); })} endEnhancer={() => <ArrowUpRight size={18} aria-hidden />}>Get advance</Button>}
      {plan && <div ref={node => { if (node) node.inert = !expanded; }} aria-hidden={!expanded} className={css({ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', opacity: expanded ? 1 : 0, transition: 'grid-template-rows 400ms ease, opacity 400ms ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } })}><div style={{ minHeight: 0, overflow: 'hidden' }}><div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
        <RepaymentTimeline plan={plan} today={today} accepted />
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}><span data-testid="advance-outstanding" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatSyntheticMoney(advanceOutstanding(plan))}</span> to repay · {plan.paidCount} of {plan.count} paid · {plan.interestMinor ? `${formatSyntheticMoney(plan.interestMinor)} total interest` : 'Interest free'}</span>
        {plan.purpose && plan.consentAt && <span data-testid="advance-consent-record" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{PURPOSE_WORDS[plan.purpose]} · Repayment from incoming payments authorized {creditDate(plan.consentAt)}</span>}
        {next ? <Button size={SIZE.compact} kind={KIND.secondary} data-testid="advance-record-repayment" onClick={liveAct(() => change(recordAdvanceRepayment(plan)))}>Record repayment</Button>
          : <span data-testid="advance-complete" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, ...theme.typography.LabelMedium }}><Check size={18} aria-hidden />{statusWordsOf('repaid')}</span>}
        <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="advance-reset" onClick={liveAct(() => change(null))}>Close plan</Button>
      </div></div></div>}
      {error && <p role="alert" style={{ ...theme.typography.ParagraphSmall, margin: 0 }}>{error}</p>}
    </div>
    {open && <AdvanceDialog scope={scope} limit={limit} prefilledMinor={prefilled} onClose={() => setOpen(false)} onSave={change} />}
  </section>;
}

function IncomingChart({ projection, currency }: { projection: ReturnType<typeof projectMoney>; currency: 'PEN' | 'EUR' }) {
  const [, theme] = useStyletron();
  const title = React.useId(), description = React.useId();
  const phone = usePhone();
  const axis = { ...theme.typography.ParagraphXSmall, fontSize: phone ? '22px' : '11px' };
  const divisor = currency === 'EUR' ? 100 * LEGACY_EUR_TO_PEN : 100;
  const recentHistory = projection.dailyHistory.slice(-14);
  const history = recentHistory.map(point => point.amountMinor / divisor);
  const forecast = [history[history.length - 1], ...projection.forecast.map(point => point.amountMinor / divisor)];
  const maximum = Math.max(1, ...history, ...forecast);
  const ceiling = Math.ceil(maximum / 1000) * 1000;
  const count = history.length + forecast.length - 1;
  const x = (index: number) => 46 + index * (496 / (count - 1));
  const y = (amount: number) => 184 - amount / ceiling * 148;
  const points = (data: number[], start: number) => data.map((value, index) => `${x(index + start)},${y(value)}`).join(' ');
  const today = history.length - 1;
  const tick = (value: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  return <figure style={{ margin: 0, minWidth: 0 }}>
    <svg viewBox="0 0 580 225" role="img" aria-labelledby={`${title} ${description}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
      <title id={title}>Incoming money</title>
      <desc id={description}>Daily {currency} totals. Recorded bank receipts use a solid line. The dashed projection combines invoice amounts due and scheduled sales at the workspace exchange rate.</desc>
      {[0, ceiling / 2, ceiling].map(value => <g key={value}><line x1={46} x2={542} y1={y(value)} y2={y(value)} stroke={theme.colors.borderOpaque} />
        <text x={34} y={y(value) + 4} textAnchor="end" fill={theme.colors.contentTertiary} style={axis}>{tick(value)}</text></g>)}
      <polygon points={`${x(0)},184 ${points(history, 0)} ${x(today)},184`} fill={theme.colors.backgroundSecondary} />
      <line x1={x(today)} x2={x(today)} y1={24} y2={184} stroke={theme.colors.borderOpaque} strokeDasharray="3 5" />
      <polyline data-testid="money-history-line" data-amounts-minor={recentHistory.map(point => point.amountMinor).join(',')} points={points(history, 0)} fill="none" stroke={theme.colors.contentPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <polyline data-testid="money-forecast-line" data-amounts-minor={projection.forecast.map(point => point.amountMinor).join(',')} points={points(forecast, today)} fill="none" stroke={theme.colors.contentPrimary} strokeWidth={3} strokeDasharray="6 7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(today)} cy={y(history[today])} r={5} fill={theme.colors.contentPrimary} />
      {!phone && <text x={46} y={214} fill={theme.colors.contentSecondary} style={axis}>{creditDate(recentHistory[0].at)}</text>}
      <text x={x(today)} y={214} textAnchor="middle" fill={theme.colors.contentPrimary} style={axis}>Today</text>
      <text x={542} y={214} textAnchor="end" fill={theme.colors.contentSecondary} style={axis}>{creditDate(projection.forecast[projection.forecast.length - 1].at)}</text>
    </svg>
    <figcaption style={{ display: 'grid', gap: theme.sizing.scale400, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale600 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}><span style={{ width: 24, borderTop: `2px solid ${theme.colors.contentPrimary}` }} />Recorded bank receipts</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}><span style={{ width: 24, borderTop: `2px dashed ${theme.colors.contentPrimary}` }} />Sales projection · {currency}</span>
      </div>

    </figcaption>
  </figure>;
}

export function MoneyOverview({ scope, sales, view = 'overview', advanceMinor }: { scope: string; sales: MoneySourceSale[]; view?: 'overview' | 'transactions' | 'credit' | 'payments'; advanceMinor?: number }) {
  const [css, theme] = useStyletron();
  const { state } = useMoney(scope);
  const phone = usePhone();
  const projection = React.useMemo(() => projectMoney(state, sales), [state, sales]);
  /* ONE WITNESS FOR «IS THE BANK CONNECTED» (FEED-IA §247.2). The balance card, the incoming
     chart, the transactions card, the working-capital card and Settings → Connections read one
     polled capability, so the workspace can no longer answer that question two ways. */
  const bank = useBankCapability(scope);
  const connected = bank.posture === 'ready';
  const [activity, setActivity] = React.useState<BankActivity | null>(null);
  const [activityError, setActivityError] = React.useState('');
  const [bankLoading, setBankLoading] = React.useState(false);
  const refreshRef = React.useRef<() => Promise<void>>(async () => {});
  const refreshBank = bank.refresh;
  React.useEffect(() => {
    let active = true, running = false;
    const clear = () => { setActivity(null); setActivityError(''); setBankLoading(false); };
    clear();
    const refresh = async () => {
      if (!active || running || document.hidden) return;
      running = true;
      const current = collectionGuard(scope);
      setBankLoading(true);
      try {
        const [, feed] = await Promise.allSettled([refreshBank(), readBankActivity(scope)]);
        current();
        if (!active) return;
        if (feed.status === 'fulfilled') { setActivity(feed.value); setActivityError(''); }
        else setActivityError(feed.reason instanceof Error ? feed.reason.message : 'Refresh your bank transactions.');
      } catch { /* Workspace replacement clears its private projection. */ }
      finally { running = false; if (active) setBankLoading(false); }
    };
    const reset = (event: Event) => { if ((event as CustomEvent<{ scope: string }>).detail?.scope === scope) clear(); };
    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('rocoto:money-workspace-reset', reset);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('rocoto:money-workspace-reset', reset); };
  }, [scope, refreshBank]);
  const bankMonitor = bank.monitor;
  const bankError = bank.error;
  const balanceMinor = bank.balanceMinor ?? projection.bankBalanceMinor;

  const invoices = state.invoices.filter(invoice => isCollectible(invoice) && invoice.currency === 'PEN');
  const payments = state.receipts.filter(receipt => receipt.currency === 'PEN').slice().sort((a, b) => b.at.localeCompare(a.at));
  const overdueInvoices = invoices.filter(invoice => invoiceOverdueDays(state, invoice.id, invoiceClock(invoice, moneyNow(state))) > 0);
  const overdueMinor = overdueInvoices.reduce((sum, invoice) => sum + invoiceBalance(state, invoice.id), 0);
  const outstanding = invoices.reduce((sum, invoice) => sum + invoiceBalance(state, invoice.id), 0);
  const collected = payments.filter(receipt => receipt.status === 'matched').reduce((sum, receipt) => sum + receipt.amountMinor, 0);
  const bankId = bank.bank ?? state.setup.bank;
  const bankName = { bbva: 'BBVA', interbank: 'Interbank', scotiabank: 'Scotiabank' }[bankId] ?? 'Receiving bank';
  const card = css({ display: 'grid', alignContent: 'start', gap: theme.sizing.scale600, minWidth: 0,
    padding: theme.sizing.scale700, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
    backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, textDecoration: 'none',
    '@media (max-width: 600px)': { padding: theme.sizing.scale600 } });
  const linkCard = css({ ':hover': { backgroundColor: theme.colors.backgroundSecondary },
    ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '3px' } });
  const grid = css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: theme.sizing.scale600,
    '@media (max-width: 900px)': { gridTemplateColumns: 'minmax(0, 1fr)' } });
  const secondary: React.CSSProperties = { ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary };
  const container = css({ display: 'grid', gap: theme.sizing.scale800, width: '100%', maxWidth: '1200px', margin: '0 auto',
    padding: theme.sizing.scale800, boxSizing: 'border-box', minWidth: 0, '@media (max-width: 600px)': { padding: theme.sizing.scale500 } });
  if (view !== 'overview') return <div className={container} data-testid={`money-${view}-page`}>
    <a href="#/money" className={css({ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, color: theme.colors.contentPrimary,
      textDecoration: 'none', minHeight: '44px', ...theme.typography.LabelSmall })}><ArrowLeft size={18} aria-hidden />Money</a>
    {view === 'credit' || view === 'payments' ? <CreditOverview key={`${scope}:${view}`} scope={scope} title={view === 'payments' ? 'Payments' : undefined} /> : <BankActivityCard key={scope} scope={scope} activity={activity}
      posture={bank.posture} loading={bankLoading} error={activityError} onRefresh={() => refreshRef.current()} />}
  </div>;
  const categories = [
    { id: 'invoices', title: 'Invoices', Icon: FileText, value: formatLedgerMoney(state, outstanding), description: 'Outstanding', count: invoices.length },
    { id: 'payments', title: 'Payments', Icon: ArrowDownLeft, value: formatLedgerMoney(state, collected), description: 'Collected', count: payments.length },
    /* A BANK BRAND IS A CLAIM ABOUT AN ACCOUNT (§246 review). `state.setup.bank` carries the model
       default `bbva` on every workspace, so this tile advertised «BBVA» on the same dashboard whose
       balance card was offering «Connect bank». The brand stands where the provider answered. */
    { id: 'transactions', title: 'Transactions', Icon: Landmark, value: 'Bank activity', description: connected ? bankName : 'Bank transactions', count: undefined },
  ];
  const credit = unpaidOrders(state, moneyNow(state));
  const urgent = urgentUnpaidOrders(state, moneyNow(state));
  return <div data-testid="money-overview" className={container}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.sizing.scale400 }}>
      <h1 style={{ ...theme.typography.HeadingLarge, margin: 0 }}>Money</h1>
      <a href="#/admin/connections" data-testid="money-overview-connections" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary,
        textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}><Settings2 size={18} aria-hidden />Connections</a>
    </header>
    <div className={grid}>
      <section data-testid="money-balance-card" data-bank-posture={bank.posture} className={card} style={{ alignContent: 'space-between', minHeight: phone ? 230 : 300 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, alignItems: 'center' }}>
          {/* A provider mark is a claim about an account, so it stands only where the provider
              answered. Until then the card names the figure it is actually showing. */}
          <span style={theme.typography.LabelMedium}>{connected ? 'Bank balance' : 'Sales projection'}</span>
          {connected && <img src="/connection-brands/prometeo.png" alt="Prometeo" width={57} height={13} style={{ objectFit: 'contain' }} />}
        </div>
        <div style={{ display: 'grid', gap: theme.sizing.scale400 }}><strong data-testid="money-bank-balance" data-amount-minor={balanceMinor} style={{ ...theme.typography.DisplaySmall,
          fontSize: phone ? 'clamp(24px, 7.5vw, 36px)' : 'clamp(36px, 4vw, 54px)', lineHeight: 1.1, letterSpacing: '-0.04em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{connected && bank.currency ? formatMoney(balanceMinor, bank.currency) : formatSyntheticMoney(balanceMinor)}</strong>
          <span style={secondary}>{connected ? 'Available balance' : 'From your invoices and sales'}</span>
          {bankMonitor === 'retrying' && <span role="status" data-testid="money-bank-delay" style={secondary}>Bank update delayed · Retrying automatically</span>}
          {bankMonitor === 'reauthorization-required' && <a href="#/money/setup/payments" data-testid="money-bank-reconnect" style={{ ...secondary, color: theme.colors.contentPrimary }}>Reconnect your bank to resume payment checks</a>}
          {bankMonitor && bankMonitor !== 'retrying' && bankMonitor !== 'reauthorization-required'
            && <span role="status" data-testid="money-bank-monitor" data-monitor={bankMonitor} style={secondary}>{MONITOR_WORDS[bankMonitor]}</span>}
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{connected ? `Updated ${new Date(bank.asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : workspaceCurrency()}</span>{bankError && <span role="status" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{bankError}</span>}</div>
        <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', paddingTop: theme.sizing.scale500, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
          {connected ? <>
            <img src={`/connection-brands/${bankId || 'bbva'}.png`} alt={bankName} width={65} height={28} style={{ objectFit: 'contain' }} />
            <span style={{ ...theme.typography.ParagraphSmall, flex: 1 }}>{`${bank.accountLabel} · ${bank.accountMask}`}</span>
            <a href="#/money/setup/payments" aria-label="Review receiving account" style={{ color: theme.colors.contentPrimary, minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center' }}><ArrowUpRight size={18} aria-hidden /></a>
          </> : <Button size={SIZE.compact} data-testid="money-balance-open-setup" onClick={() => { window.location.hash = '#/admin/connections/payments'; }}>Connect bank</Button>}
        </div>
      </section>
      <section data-testid="money-incoming-card" className={card}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale400 }}><h2 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>Incoming money</h2><CalendarDays size={20} aria-hidden /></header>
        {connected && bank.currency ? activity?.ready ? <BankIncomingChart activity={activity} currency={bank.currency} asOf={activity.as_of || bank.asOf} />
          : <p role="status" style={secondary}>{activityError || 'Loading bank transactions…'}</p> : <IncomingChart projection={projection} currency={state.invoices.every(invoice => invoice.origin === 'demo') ? workspaceCurrency() : 'PEN'} />}
      </section>
    </div>
    <nav aria-label="Money records" className={css({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale600,
      '@media (max-width: 700px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } })}>
      {categories.map(({ id, title, Icon, value, description, count }) => <a key={id} href={`#/money/${id}`} data-testid={`money-${id}-card`} className={`${card} ${linkCard}`} style={phone ? { gridColumn: id === 'transactions' ? '1 / -1' : undefined, padding: theme.sizing.scale500, gap: theme.sizing.scale500 } : undefined}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
          <span style={{ display: 'grid', placeItems: 'center', width: phone ? 44 : 56, height: phone ? 44 : 56, borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary }}><Icon size={28} strokeWidth={1.6} aria-hidden /></span>
          <ChevronRight size={18} aria-hidden />
        </div>
        <h2 style={{ ...(phone ? theme.typography.LabelLarge : theme.typography.HeadingXSmall), margin: 0 }}>{title}{count !== undefined && <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, marginLeft: theme.sizing.scale300 }}>{count}</span>}</h2>
        <div style={{ display: 'grid', gap: theme.sizing.scale200 }}><strong style={{ ...theme.typography.HeadingSmall, fontSize: phone ? 'clamp(14px, 4vw, 18px)' : undefined, whiteSpace: 'nowrap' }}>{value}</strong><span style={secondary}>{description}</span></div>
        {id === 'invoices' && overdueInvoices.length > 0 && <span data-testid="money-overdue-summary" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentNegative }}>{overdueInvoices.length} overdue · {formatLedgerMoney(state, overdueMinor)}</span>}
      </a>)}
    </nav>
    <div className={css({ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: theme.sizing.scale600,
      '@media (max-width: 800px)': { gridTemplateColumns: 'minmax(0, 1fr)' } })}>
      <WorkingCapital scope={scope} sales={sales} advanceMinor={advanceMinor} />
      <LenderDoor scope={scope} />
      <a href="#/money/credit" data-testid="money-credit-card" className={`${card} ${linkCard}`} style={{ alignContent: 'space-between' }}>
        {/* The pill that balanced this row is gone (§247.8), so the icon takes the same seat its
            three siblings above it use: one tile, one size, one ground. */}
        <span style={{ display: 'grid', placeItems: 'center', width: phone ? 44 : 56, height: phone ? 44 : 56,
          borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary }}><Users size={28} strokeWidth={1.6} aria-hidden /></span>
        <div style={{ display: 'grid', gap: theme.sizing.scale400 }}><h2 style={{ ...theme.typography.HeadingXSmall, margin: 0 }}>Unpaid orders</h2>
          <strong style={{ ...theme.typography.HeadingMedium, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatLedgerMoney(state, credit.reduce((sum, item) => sum + item.amountMinor, 0))}</strong>
          <span data-testid="money-unpaid-count" style={secondary}>{credit.length} {credit.length === 1 ? 'unpaid order' : 'unpaid orders'}</span></div>
        <div style={{ display: 'grid' }}>
          {urgent.map(row => <div key={row.invoice.id} data-testid={`money-unpaid-preview-${row.invoice.id}`}
            data-invoice-id={row.invoice.id} data-amount-minor={row.amountMinor} data-due-at={row.invoice.dueAt} data-overdue-days={row.overdueDays}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300,
              paddingTop: theme.sizing.scale400, paddingBottom: theme.sizing.scale400, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
            <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{row.invoice.customerName}</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{dueWordsOf(row)}</span>
            </span>
            <strong style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatInvoiceMoney(row.invoice, row.amountMinor)}</strong>
          </div>)}
        </div>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, ...theme.typography.LabelSmall }}>View orders<ChevronRight size={18} aria-hidden /></span>
      </a>
    </div>
  </div>;
}
