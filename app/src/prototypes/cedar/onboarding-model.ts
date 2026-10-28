export const ONBOARDING_STEPS = ['name', 'address', 'ruc', 'channel', 'channel-setup', 'more-channels', 'bank', 'invoicing', 'catalogue', 'history', 'gmail-permission', 'invoice-results', 'complete'] as const;
export type OnboardingStep = typeof ONBOARDING_STEPS[number];
export type OnboardingChannel = 'whatsapp' | 'email' | 'phone';
export type OnboardingConnection = { channel: OnboardingChannel; status: 'sample' | 'prepared' | 'connected' };
export type OnboardingFile = { name: string; size: number; type: string };
export type OnboardingState = {
  version: 1; scope: string; step: OnboardingStep; workspacePrepared: boolean;
  businessName: string; address: string; ruc: string;
  selectedChannel: OnboardingChannel | null; channels: OnboardingConnection[];
  catalogue: 'pending' | 'sample' | 'imported';
  invoiceHistory: OnboardingFile[]; invoiceSearch: 'pending' | 'allowed' | 'skipped';
};
export const onboardingStorageKey = (scope: string) => `rocoto-cedar-onboarding-v1:${scope}`;
export function newOnboarding(scope: string, values: { businessName: string; address: string; ruc?: string }): OnboardingState {
  return { version: 1, scope, step: 'channel', workspacePrepared: false, ...values, ruc: values.ruc || '20123456789',
    selectedChannel: null, channels: [], catalogue: 'pending', invoiceHistory: [], invoiceSearch: 'pending' };
}
const channel = (value: unknown): value is OnboardingChannel => ['whatsapp', 'email', 'phone'].includes(String(value));
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
/* ── THE WALK THIS WORKSPACE ACTUALLY TAKES (FEED-IA §247.9) ─────────────────────────────────
 * «also ensure you have the good spain / peru toggle which in spains case hides the money shit»
 *                                                                       — Peter, 13 September 2026
 * `ONBOARDING_STEPS` above is the whole vocabulary a stored step is validated against, legacy names
 * included. It is NOT the sequence: a workspace with Money off keeps no bank account here, so the
 * bank step — which mounts `MoneySetup` — is a Money door, and the walk is the channel and then the
 * finished workspace. Every function below takes `money` so the model answers one way and the
 * screen, the address bar and a stored draft all read that one answer.
 *
 * AND THE WALK IS WHAT DECIDES. It is read by `afterChannel` below, which is where `saveChannel`
 * sends a person and where every legacy bank route resumes — so editing this list moves the
 * product, rather than describing a sequence spelled out a second time somewhere else.
 */
export const onboardingWalk = (money: boolean): readonly OnboardingStep[] =>
  money ? ['channel', 'channel-setup', 'bank', 'complete'] : ['channel', 'channel-setup', 'complete'];

/** Where the channel's own Continue lands: the entry after `channel-setup` in this workspace's
 *  walk — the bank account where Money is on, the finished workspace where it is off. */
const afterChannel = (money: boolean): OnboardingStep => {
  const walk = onboardingWalk(money);
  return walk[walk.indexOf('channel-setup') + 1] ?? 'complete';
};

export function parseOnboarding(raw: unknown, fallback: OnboardingState, money = true): OnboardingState {
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Partial<OnboardingState>;
  if ((value.workspacePrepared !== undefined && typeof value.workspacePrepared !== 'boolean') || value.version !== 1 || value.scope !== fallback.scope || !ONBOARDING_STEPS.includes(value.step as OnboardingStep)
    || !text(value.businessName, 160) || !text(value.address, 300) || !text(value.ruc, 11)
    || (value.selectedChannel !== null && !channel(value.selectedChannel))
    || !Array.isArray(value.channels) || value.channels.length > 3
    || value.channels.some(row => !row || !channel(row.channel) || !['sample', 'prepared', 'connected'].includes(row.status))
    || new Set(value.channels.map(row => row.channel)).size !== value.channels.length
    || !['pending', 'sample', 'imported'].includes(value.catalogue ?? '')
    || !['pending', 'allowed', 'skipped'].includes(value.invoiceSearch ?? '')
    || !Array.isArray(value.invoiceHistory) || value.invoiceHistory.length > 20
    || value.invoiceHistory.some(file => !file || !text(file.name, 200) || !text(file.type, 100)
      || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 20000000)) return fallback;
  const parsed = { ...value, workspacePrepared: value.workspacePrepared ?? false } as OnboardingState;
  /* Money off retires the bank step, so every route that used to end there — the two legacy names
     and `bank` itself — ends at the finished workspace instead, and the guard below decides whether
     this draft has earned it. */
  const banking:OnboardingStep=afterChannel(money);
  const legacyStep:Partial<Record<OnboardingStep,OnboardingStep>>={
    name:'channel',address:'channel',ruc:'channel','more-channels':banking,invoicing:banking,'gmail-permission':'history','invoice-results':'history',
  };
  if(!onboardingWalk(money).includes('bank'))legacyStep.bank=banking;
  parsed.step=legacyStep[parsed.step]??parsed.step;
  if (parsed.step === 'channel-setup' && !parsed.selectedChannel) return { ...parsed, step: 'channel' };
  if (parsed.step === 'bank' && !parsed.channels.length) return { ...parsed, step: 'channel' };
  /* The step that PREPARES the workspace is the last one of the walk before the finished
     workspace: banking where Money is on, the channel's own Continue where it is off — and there
     `afterChannel` IS `complete`, so an unprepared draft resumes at the channel question. */
  const prepares:OnboardingStep=banking==='complete'?'channel':banking;
  if (['catalogue','history','complete'].includes(parsed.step) && !parsed.workspacePrepared)
    return { ...parsed, step: parsed.channels.length ? prepares : 'channel' };
  return parsed;
}

export function saveChannel(state: OnboardingState, connection: OnboardingConnection, money = true): OnboardingState {
  return { ...state, selectedChannel: connection.channel,
    channels: [...state.channels.filter(row => row.channel !== connection.channel), connection],
    step: afterChannel(money) };
}

/* ── ONE DEFINITION OF «COMMUNICATION IS SET UP» (FEED-IA §246 · §247.2) ───────────────────────
 * «always we havbe to be super consistent and not fget people igo confusing menus when they
 *  shouldnt see them»                                                          — Peter, 2026-09-11
 *
 * There were four. `communicationReady` read `state.channels.length > 0` — any row of any status,
 * so a `sample` row written by the Meta test-data walk and a `prepared` row left by a half-
 * finished phone walk both read as a complete milestone with a ✓; `essentialSetupComplete` built
 * on it; setup-progress rolled a third predicate that also counted those rows and never asked the
 * phone at all; and onboarding rolled a fourth, which was the only correct one. So a workspace
 * with a genuinely commissioned, caller-ID-verified phone read «0 of 2» on one card and
 * «connected» on the screen beside it.
 *
 * The correct one is lifted here and both surfaces call it. `sample` and `prepared` are onboarding
 * NOTES about a walk; the three booleans below are the providers' own answers, and they are the
 * only thing this question is decided on.
 */
export const ONBOARDING_CHANNELS: readonly OnboardingChannel[] = ['whatsapp', 'email', 'phone'];

/** Which channels this workspace can actually message on, one entry per channel. */
export type ConnectedChannels = Record<OnboardingChannel, boolean>;

/** The three provider answers, folded into the map every surface reads. `whatsappBound` is
 *  `whatsappCapabilityOf(...).bound`, `emailConnected` is the mailbox capability's ready posture,
 *  and `phoneReady` is `phoneCapabilityOf(...).posture === 'ready'`. */
export function connectedChannelsOf(evidence: {
  whatsappBound: boolean; emailConnected: boolean; phoneReady: boolean;
}): ConnectedChannels {
  return { whatsapp: evidence.whatsappBound, email: evidence.emailConnected, phone: evidence.phoneReady };
}

/** The milestone: this workspace can take an order on at least one channel. */
export const communicationReady = (connected: ConnectedChannels): boolean =>
  ONBOARDING_CHANNELS.some(channel => connected[channel]);

/** How many of them are live — the count onboarding prints above its Continue act. */
export const connectedChannelCount = (connected: ConnectedChannels): number =>
  ONBOARDING_CHANNELS.filter(channel => connected[channel]).length;
