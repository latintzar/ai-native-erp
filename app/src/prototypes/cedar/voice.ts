/* THE KIT'S ONE VOICE SEAM — THE HERMES PORT (FEED-IA §196.6 · E193.07)
 *
 * Peter, 2026-09-04: «the hermes shit remember i wanted to port it. the number->gmaps info was
 * working flawlessly, and then the transcription too, with clear speaker diarisation. set to
 * spanish of course. i dont want dependencies on the actual hermes caller as thats a packed thing,
 * i want it all self contained in here, same as twilio. that shit proved capability now we're
 * doing it all for real, every part of the process, nothing half assed. if i missed a step when
 * explaining it, figure that out.»
 *
 * So this file is the kit's half of the human phone rail, and it is the ONLY place a voice surface
 * names the runtime. Four things come through it, each a real provider behind `runtime-client.ts`:
 *
 *   1 · THE HOUSE'S OWN LINE — `/api/health` says which providers the service holds a key for, and
 *       the settings seat (`phone-connection-config`) says which number customers already call.
 *       Readiness is the two of them AGREEING; neither alone is a connected line (§196.6 «every
 *       part of the process»).
 *   2 · IDENTITY FROM A NUMBER — `/api/identity` is the Hermes lookup, Google Places, ported. It
 *       answers with a place or with nothing; it never answers with a guess. VOICE-07C's order
 *       stands: the house's own customers are matched FIRST, and Google is asked only about a
 *       number nobody in the book owns.
 *   3 · CALLS AS COMMUNICATION OBJECTS — `/api/calls?number=` is the custody the runtime holds for
 *       one counterpart: direction, duration, recording custody, and the diarised Spanish
 *       transcript when there is one. They stand beside WhatsApp and email on the customer.
 *   4 · THE OUTBOUND CALL — `POST /api/calls` places it, gated on readiness, and says the sid back.
 *
 * ⚠ THE LAW THIS FILE KEEPS: a missing runtime is a STATE, never a fabricated answer. Every read
 * below ends in one of a small closed set of postures, and «Runtime offline» is one of
 * them. A surface that cannot say what it knows says that instead of inventing a call, a name or a
 * transcript (the same fail-closed law `parsing.ts` keeps for extraction).
 */
import * as React from 'react';
import { RETENTIONS, type Retention } from './company';
import {
  RuntimeRefused,
  RuntimeUnreachable,
  runtime,
  type CallObject,
  type Identity,
  type RuntimeHealth,
  type RuntimeProvider,
  type Transcript,
  type TwilioAccount,
  type Utterance,
} from './runtime-client';

/* ── THE HONEST WORDS ───────────────────────────────────────────────────────────────────────
 * House canon, and Peter's own contract wording where the contract already had it. Everything
 * that is not a STATE is written as what IS (the copy law): «Save the number customers call» —
 * never a sentence about the thing that has not happened yet. */
export const VOICE_COPY = {
  unreachable: 'Runtime offline',
  checking: 'Checking the line…',
  preparedNotConnected: 'Prepared · awaiting connection',
  connected: 'Connected',
  lookingUp: 'Looking this number up…',
  noPlace: 'Google knows this number as a private line.',
  fromGoogle: 'From Google Places',
  metadataOnly: 'Metadata only',
  transcriptReady: 'Transcript ready',
  callsLoading: 'Reading this number’s calls…',
  noCalls: 'This number’s calls will land here.',
  needsHouseNumber: 'Save the number customers call, in Connections.',
  needsTwilio: 'The runtime holds the Twilio keys; ask it for the line.',
  /** §RUN-03 · E195.21 — the keys are on the box and the account has still to accept them */
  needsAccount: 'Twilio answers the runtime once the account accepts its keys.',
  /** §RUN-03 · E195.21 repair — the account ROAD itself did not answer, so the account's own state
   *  is still open. Saying «Twilio said: …» here would put the kit's own transport words in
   *  Twilio's mouth; this sentence says what is true and what settles it. */
  accountUnasked: 'The Twilio account has still to answer the runtime for these keys.',
  /** the runtime's own refusal, in the house's words, for the boundary it names most often */
  needsRuntimeHouseNumber: 'The house number is still to be set on the runtime.',
  /** §196.6 · E195.21 repair — a refusal that arrived with a status and an EMPTY body is still an
   *  answer, and the house says it. `Runtime · 503 on /api/calls` is a number to look up, never a
   *  fact to act on, so it stays in the error object and off the page. */
  refusedSilently: 'The runtime turned this request down. Its journal holds the reason.',
  placing: 'Placing the call…',
  retentionHeading: 'What Rocoto keeps from a call',
  retentionSpoken: 'Every recorded call opens by telling the caller, in Spanish, that the call is '
    + 'recorded and transcribed to handle their order, and where to ask for a copy or an erasure.',
  /* ⚠ THE SWEEP SENTENCE IS HELD BEHIND THE DEPLOY GATE (E195.40). This line used to read «A
     daily sweep on the runtime keeps this clock.» — a claim about a daemon that is in the tree and
     installed by `deploy.sh` step 4b, and is NOT on the box: `systemctl list-unit-files
     'rocoto-kit-retention*'` answers «0 unit files listed». Publishing the kit ahead of the runtime
     deploy would ship a promise the box cannot honour, so the surface says the thing that is true
     the moment it is published — where the tenant sets the period — and the daemon returns to this
     copy when the timer is running. */
  retentionDial: 'Your data sets how long a transcript is kept.',
} as const;

/* ══ 0.1 · THE RETENTION CLOCK (VOICE-21 · E195.41) ═════════════════════════════════════════ */

/** THE TENANT NOTICE, as the clock the product actually keeps.
 *
 *  VOICE-21 states retention as a clock rather than a promise, and `backend/app/retention.py` is
 *  the worker that keeps it — audio goes as soon as its transcript is ready, audio with a pending
 *  transcript goes at 30 days (`ROCOTO_AUDIO_RETENTION_DAYS`), transcript text goes at the house's
 *  own period (`ROCOTO_TRANSCRIPT_RETENTION_DAYS`), and the call record stays for the house's
 *  business-record period. The numbers live HERE and on the runtime, so a change has two homes and
 *  both are named in each other's comments.
 *
 *  ⚠ IT IS A FUNCTION OF THE TENANT'S OWN DIAL, AND THAT IS THE POINT (E195.41 · §195). A constant
 *  here meant the app told one tenant two different things: «Your data» → «How long conversations
 *  are kept» offered 90 days / a year / until you ask, and this clock answered «Kept 12 months»
 *  whatever they had chosen. The transcript's period now comes from `RETENTIONS` in `company.ts`,
 *  which is the dial itself, so the two surfaces cannot drift. The AUDIO lines are fixed on
 *  purpose: audio custody is VOICE-09B's rule rather than a choice, and a dial that offered to keep
 *  audio longer would be offering something the runtime refuses to do.
 *
 *  Every line says what IS kept and for how long: a sentence about what a system does NOT hold
 *  spends the reader's attention on the wrong subject, and a house reading this wants the clock. */
export type RetentionRow = { object: string; kept: string };

/** The five objects, named once, so the two surfaces cannot name them differently. */
export const RETENTION_OBJECT = {
  metadata: 'Time, direction, participants and outcome',
  audio: 'Recorded audio',
  pending: 'Audio while its transcript is pending',
  transcript: 'Transcript text',
  facts: 'Order facts read from a call',
} as const;

export function retentionClock(kept: Retention): readonly RetentionRow[] {
  const dial = RETENTIONS.find((row) => row.value === kept) ?? RETENTIONS[1];
  return [
    { object: RETENTION_OBJECT.metadata, kept: 'Kept with your business records' },
    { object: RETENTION_OBJECT.audio, kept: 'Kept until its transcript is ready, then removed' },
    { object: RETENTION_OBJECT.pending, kept: 'Kept 30 days, then removed' },
    { object: RETENTION_OBJECT.transcript, kept: dial.kept },
    { object: RETENTION_OBJECT.facts, kept: 'Kept with the order, citing the call' },
  ];
}

/** One object's period out of a clock, by name — so a surface reads it rather than counting rows. */
export const retentionPeriod = (clock: readonly RetentionRow[], object: string): string =>
  clock.find((row) => row.object === object)?.kept ?? '';

/** The runtime's named refusals, said as the house says them. A code the kit has house words for
 *  reads them; anything else states the runtime's own sentence, which is already a fact with a
 *  name on it (`runtime-client.ts` · `RuntimeRefused`). */
/* ⚠ THE COPY LAW REACHES THE RELAY. A refusal the kit prints is the kit's copy, whoever wrote it,
 * and several of the runtime's own sentences are written as denials — «Twilio is not configured on
 * this runtime», «That is not a phone number». Every code that can reach a person's screen is
 * therefore said HERE, as what IS or what to do. A code with no house words falls through to the
 * runtime's own sentence, which is a named fact and better than a status number. */
export const REFUSAL_WORDS: Record<string, string> = {
  house_number_missing: VOICE_COPY.needsRuntimeHouseNumber,
  operator_missing: 'Set the operator’s phone on the runtime, so somebody is on the line.',
  twilio_missing: VOICE_COPY.needsTwilio,
  parsewise_missing: 'Set the Parsewise key on this runtime.',
  deepgram_missing: 'Set the Deepgram key on this runtime.',
  places_missing: 'Set the Google Places key on this runtime.',
  parsewise_timeout: 'Parsewise ran past this runtime’s reading budget. Read it again.',
  bad_number: 'A call needs a phone number in E.164 form, starting with +.',
  bad_request: 'A call needs the number to reach.',
  bad_kind: 'The kind must be albaran, catalogue or stock.',
  empty_audio: 'Send the recording again; this one arrived empty.',
  bad_signature: 'This endpoint accepts Twilio’s own signature.',
  /* ── A PROVIDER ANSWERED, AND ITS ANSWER WAS A REFUSAL (E195.21 repair) ──────────────────
   * The runtime writes these three as «<Provider> answered 502.» (twilio_voice.py:148,
   * deepgram.py:127, parsewise.py:164/224) — a status number, sometimes with the provider's own
   * path beside it, handed to a person to act on. `twilio_failed` is the one a DIAL raises, so it
   * reaches four call seats through `dialState.because`; the other two reach the identity and
   * calls seats through `refusalWords`. Each is said here as the fact plus the act that follows. */
  twilio_failed: 'Twilio turned this call down. Check the Twilio account, then place it again.',
  deepgram_failed: 'Deepgram turned this recording down. Check the Deepgram account, then send it again.',
  parsewise_failed: 'Parsewise turned this document down. Check the Parsewise account, then read it again.',
  /* ── WHAT ARRIVED AT THE DOOR (main.py:101 · :103) ───────────────────────────────────────── */
  too_large: 'This file is past the size this runtime accepts. Send a smaller one.',
  empty_upload: 'Send the file again; this one arrived empty.',
  /* ── THE TWO SHAPES THE FRAMEWORK ITSELF ANSWERS WITH (errors.py `install`) ───────────────
   * `http_error` carries Starlette's own detail («Not Found») and `runtime_error` carries an
   * exception CLASS NAME («TypeError while handling the request»). Both can reach a person
   * through any seat that prints `refusalWords`, and neither is a sentence the house would write. */
  http_error: 'The runtime turned this request down. Ask it again in a moment.',
  runtime_error: 'The runtime met a failure while handling this. Its journal holds the detail; ask again in a moment.',
};

export const refusalWords = (error: unknown): string => {
  if (error instanceof RuntimeRefused) {
    /* House words first; then the runtime's OWN sentence, which is already a named fact. A refusal
       that arrived with an empty body has neither, and E195.21's own `RuntimeRefused` message
       falls back to «Runtime · <status> on <path>» — the bare status this stream set out to
       remove — so the house says it instead (E195.21 repair). */
    return REFUSAL_WORDS[error.code] ?? (error.said || VOICE_COPY.refusedSilently);
  }
  /* ⚠ `RuntimeUnreachable`'s own message is «Runtime offline at <base>» — the base URL is a
     fact for a console and a LEAK on a page, and every seat that prints `refusalWords` is a page.
     The state word is what a person reads. */
  if (error instanceof RuntimeUnreachable) return VOICE_COPY.unreachable;
  return error instanceof Error ? error.message : VOICE_COPY.unreachable;
};

/* ══ 1 · THE HOUSE'S LINE ═══════════════════════════════════════════════════════════════════ */

export type RuntimePosture =
  | { state: 'checking' }
  | { state: 'ready'; health: RuntimeHealth }
  | { state: 'unreachable' }
  | { state: 'down'; because: string };

/** ONE HEALTH READ FOR THE WHOLE APP. Four surfaces ask the same question — Connections, the
 *  unmatched queue, the customer sheet, the call dialog — and four fetches would be four answers
 *  that can disagree. The read lives here and the surfaces subscribe. */
/* ⚠ EVERY SNAPSHOT BELOW IS A STABLE REFERENCE. `useSyncExternalStore` compares with Object.is,
 * so a getter that builds `{ state: 'idle' }` on each call is an infinite render — React error 185, met
 * on purpose in this build and fixed here rather than in the surfaces. */
const CHECKING: RuntimePosture = { state: 'checking' };
let posture: RuntimePosture = CHECKING;
let started = false;
const postureListeners = new Set<() => void>();

const publishPosture = (next: RuntimePosture) => {
  posture = next;
  postureListeners.forEach((listener) => listener());
};

function readHealth(): void {
  if (posture !== CHECKING) publishPosture(CHECKING);
  runtime.health().then(
    (health) => publishPosture({ state: 'ready', health }),
    (error: unknown) => publishPosture(error instanceof RuntimeUnreachable
      ? { state: 'unreachable' }
      : { state: 'down', because: refusalWords(error) }),
  );
}

const subscribePosture = (listener: () => void) => {
  postureListeners.add(listener);
  /* the first subscriber starts the read, but never DURING the render that subscribed */
  if (!started) { started = true; setTimeout(readHealth, 0); }
  return () => { postureListeners.delete(listener); };
};

const postureNow = () => posture;

export function useRuntimePosture(): { posture: RuntimePosture; recheck: () => void } {
  const value = React.useSyncExternalStore(subscribePosture, postureNow, postureNow);
  return { posture: value, recheck: React.useCallback(() => { readHealth(); }, []) };
}

/* ── THE ACCOUNT'S OWN ANSWER (§RUN-03 · VOICE-17 · E195.21) ────────────────────────────────
 * `/api/health` reports PRESENCE — which keys the box holds — and says so about itself: «Presence
 * is not reachability… `/api/health/twilio` is the one place an account can be asked about
 * itself.» The kit used to fold presence straight into «Connected», so a deployed runtime whose
 * Twilio account answers 401 read as a connected line while every dial it accepted would be
 * refused. VOICE-00 forbids exactly that claim, so the account is ASKED, once, and only where its
 * answer can still change the standing.
 */
export type AccountRead =
  | { state: 'unknown' }
  | { state: 'asking' }
  | { state: 'reachable' }
  /** The account did NOT answer for these keys. `because` is the finished sentence a person reads,
   *  decided HERE — the one place that knows whose words these are — so no surface has to guess. */
  | { state: 'unreachable'; because: string };

const ACCOUNT_UNKNOWN: AccountRead = { state: 'unknown' };
const ACCOUNT_ASKING: AccountRead = { state: 'asking' };
const ACCOUNT_REACHABLE: AccountRead = { state: 'reachable' };
let account: AccountRead = ACCOUNT_UNKNOWN;
let accountAsked = false;
const accountListeners = new Set<() => void>();

const publishAccount = (next: AccountRead) => {
  account = next;
  accountListeners.forEach((listener) => listener());
};

/* ── A RELAYED SENTENCE IS STILL THE KIT'S COPY (E195.21 repair) ────────────────────────────
 * `/api/health/twilio` answers `why` from THREE roads (backend/app/twilio_voice.py ·
 * `account_state`): Twilio's own `message` when the account road itself replied; a Python
 * EXCEPTION CLASS NAME («ConnectTimeout») when the transport failed; and the runtime's own words
 * («not configured») when it holds no keys. Only the first is Twilio speaking, and printing either
 * of the others as «Twilio said: …» is a mis-attribution — «Twilio said: ConnectTimeout.» names a
 * stack class as a person's next step, and the runtime's own words are a denial on the kit's page.
 *
 * The runtime marks the right road for us: `status` is set EXACTLY when Twilio's own HTTP answer
 * came back. So the kit relays `why` only then, and only a sentence that reads as one — bounded in
 * length, and free of the denials the copy law refuses, because a relayed «… is not …» is a
 * negative on this page whoever typed it. Everything else stands on the house's own sentence,
 * which already says what IS and what settles it.
 */
const DENIAL = /\b(?:not|no|never|nothing|cannot|can[’']t|without|isn[’']t|doesn[’']t|won[’']t|aren[’']t|didn[’']t)\b/i;

/** Twilio's own sentence about this account, or nothing at all. */
export const twilioSentence = (twilio: TwilioAccount | undefined): string => {
  if (typeof twilio?.status !== 'number') return '';
  const said = String(twilio.why ?? '').trim().replace(/[.\s]+$/, '');
  if (!said || said.length > 120 || DENIAL.test(said)) return '';
  return said;
};

const accountFrom = (twilio: TwilioAccount | undefined): AccountRead => {
  if (twilio?.reachable) return ACCOUNT_REACHABLE;
  /* ⚠ `status` DECIDES THE SENTENCE, not just the relay. Present, it means Twilio's own account road
     answered and declined these keys — «Twilio answers the runtime once the account accepts its
     keys» is then the true thing to say. Absent, the runtime never got an answer out of Twilio at
     all (its transport failed, or it holds no keys), so the ACCOUNT's own state is still open and
     claiming it declined anything would be a fact nobody has. Caught by `drive-199-voice-real.py`'s
     `account_unasked` band, which is why it exists. */
  if (typeof twilio?.status !== 'number') return { state: 'unreachable', because: VOICE_COPY.accountUnasked };
  const said = twilioSentence(twilio);
  return {
    state: 'unreachable',
    because: said ? `${VOICE_COPY.needsAccount} Twilio said: ${said}.` : VOICE_COPY.needsAccount,
  };
};

const askAccount = (): void => {
  accountAsked = true;
  publishAccount(ACCOUNT_ASKING);
  runtime.twilioAccount().then(
    (answer) => publishAccount(accountFrom(answer.twilio)),
    /* A runtime that REFUSED this road named its reason, and the house has words for that name.
       A road that did not answer at all leaves the ACCOUNT's own state open — so the house says
       that, rather than dressing its own transport words as Twilio's. */
    (error: unknown) => publishAccount({
      state: 'unreachable',
      because: error instanceof RuntimeRefused ? refusalWords(error) : VOICE_COPY.accountUnasked,
    }),
  );
};

const accountNow = () => account;

/** ONE ACCOUNT READ FOR THE WHOLE APP, made only when `when` is true — that is, only where the
 *  runtime already reported Twilio present and the house has saved its number, because anywhere
 *  else the standing is already settled and the request would spend a provider call for nothing.
 *  ⚠ `accountAsked` is a MODULE global and the effect below reads it without depending on it, so
 *  the answer is asked once per page life and re-asked only through `recheck` — the door the
 *  «Check again» control and `useReadiness` already use. */
export function useTwilioAccount(when: boolean): { read: AccountRead; recheck: () => void } {
  const subscribe = React.useCallback((listener: () => void) => {
    accountListeners.add(listener);
    return () => { accountListeners.delete(listener); };
  }, []);
  const read = React.useSyncExternalStore(subscribe, accountNow, accountNow);
  React.useEffect(() => {
    if (!when || accountAsked) return;
    askAccount();
  }, [when]);
  return { read, recheck: React.useCallback(() => { askAccount(); }, []) };
}

/** What the service says about ONE provider. `unknown` is its own answer — a runtime we could not
 *  reach has not told us that Twilio is missing, and the two must never read the same. */
export const providerState = (
  value: RuntimePosture,
  name: RuntimeProvider,
): 'configured' | 'missing' | 'unknown' =>
  value.state === 'ready' ? (value.health.providers?.[name] ?? 'unknown') : 'unknown';

/** THE READINESS FOLD (§196.6 · VOICE-01A.1 · E195.21). A call may be placed only when THREE facts
 *  agree: the runtime holds Twilio, the Twilio account itself answers, and the house has said
 *  which number customers call. Anything else states the ONE fact still outstanding, in a sentence
 *  that says what to do. Presence alone was «Connected» until E195.21 met a deployed runtime whose
 *  account replied 401 — the forbidden claim in VOICE-00, printed on the page. */
export type Readiness = {
  ready: boolean;
  /** the state word the surfaces print — house canon, never invented per surface */
  standing: string;
  /** the sentence under it: what IS, and what to do next */
  because: string;
  houseNumber: string;
  twilio: 'configured' | 'missing' | 'unknown';
  /** what the Twilio ACCOUNT answered when it was asked about itself */
  account: AccountRead['state'];
};

export function readinessOf(value: RuntimePosture, houseNumber: string, held: AccountRead = ACCOUNT_UNKNOWN): Readiness {
  const twilio = providerState(value, 'twilio');
  const number = houseNumber.trim();
  const account = held.state;
  if (value.state === 'checking') {
    return { ready: false, standing: VOICE_COPY.checking, because: 'Asking the runtime what it holds.', houseNumber: number, twilio, account };
  }
  if (value.state === 'unreachable') {
    return { ready: false, standing: VOICE_COPY.unreachable, because: 'Calls run through the kit runtime; the browser reads them once the runtime answers.', houseNumber: number, twilio, account };
  }
  if (value.state === 'down') {
    return { ready: false, standing: VOICE_COPY.unreachable, because: value.because, houseNumber: number, twilio, account };
  }
  if (twilio !== 'configured') {
    return { ready: false, standing: VOICE_COPY.preparedNotConnected, because: VOICE_COPY.needsTwilio, houseNumber: number, twilio, account };
  }
  if (!number) {
    return { ready: false, standing: VOICE_COPY.preparedNotConnected, because: VOICE_COPY.needsHouseNumber, houseNumber: number, twilio, account };
  }
  if (held.state === 'unknown' || held.state === 'asking') {
    return { ready: false, standing: VOICE_COPY.checking, because: 'Asking Twilio whether the account answers for these keys.', houseNumber: number, twilio, account };
  }
  if (held.state === 'unreachable') {
    /* The sentence was decided where its provenance was known (`accountFrom`, `askAccount`), so the
       fold prints it whole rather than composing a relay it cannot vouch for. */
    return { ready: false, standing: VOICE_COPY.preparedNotConnected, because: held.because, houseNumber: number, twilio, account };
  }
  return { ready: true, standing: VOICE_COPY.connected, because: `Customers reach the house on ${number}.`, houseNumber: number, twilio, account };
}

/** THE ONE FOLD EVERY VOICE SURFACE READS. Health, the account and the saved house number, folded
 *  once so Connections, the queue, the call dialog and a customer's sheet can never disagree about
 *  whether this house has a line. */
export function useReadiness(houseNumber: string): { readiness: Readiness; recheck: () => void } {
  const { posture, recheck: recheckPosture } = useRuntimePosture();
  const wanted = providerState(posture, 'twilio') === 'configured' && houseNumber.trim().length > 0;
  const { read, recheck: recheckAccount } = useTwilioAccount(wanted);
  const readiness = readinessOf(posture, houseNumber, read);
  const recheck = React.useCallback(() => {
    recheckPosture();
    if (wanted) recheckAccount();
  }, [recheckAccount, recheckPosture, wanted]);
  return { readiness, recheck };
}

/* ══ 2 · IDENTITY FROM A NUMBER ═════════════════════════════════════════════════════════════ */

export type IdentityRead =
  | { state: 'idle' }
  | { state: 'looking' }
  | { state: 'found'; identity: Identity }
  | { state: 'none'; number: string }
  | { state: 'unreachable' }
  | { state: 'unavailable'; because: string };

/** A place answered ONLY when Google actually named one. The runtime replies to an unknown number
 *  with the number, a phone type and confidence 0 — that is «Google knows this number as a private
 *  line», and it is a different fact from «we could not ask» (§196.6, nothing half arsed). */
const asRead = (identity: Identity): IdentityRead =>
  identity.name && identity.confidence > 0 ? { state: 'found', identity } : { state: 'none', number: identity.number };

const IDENTITY_IDLE: IdentityRead = { state: 'idle' };

type IdentityHeld = { read: IdentityRead; listeners: Set<() => void> };
const identities = new Map<string, IdentityHeld>();
const looked = new Set<string>();

const publishIdentity = (key: string, read: IdentityRead) => {
  const row = identities.get(key);
  if (!row) return;
  row.read = read;
  row.listeners.forEach((listener) => listener());
};

const lookUp = (key: string) => {
  const row = identities.get(key) ?? { read: IDENTITY_IDLE, listeners: new Set<() => void>() };
  identities.set(key, { ...row, read: { state: 'looking' } });
  row.listeners.forEach((listener) => listener());
  runtime.identity(key).then(
    (identity) => publishIdentity(key, asRead(identity)),
    (error: unknown) => publishIdentity(key, error instanceof RuntimeUnreachable
      ? { state: 'unreachable' }
      : { state: 'unavailable', because: refusalWords(error) }),
  );
};

/**
 * ONE LOOKUP PER NUMBER, and the person decides when it runs unless the caller is a stranger.
 *
 * VOICE-07C's order is the reason `auto` exists and is not always on: the house's own book is
 * matched first, and Google is asked only about a number the book does not own. So the UNMATCHED
 * queue looks a stranger up by itself — that is the Hermes behaviour Peter is porting, and the
 * call has already happened — while a customer's sheet asks only when a person presses, because
 * that number already belongs to somebody.
 */
export function useIdentity(number: string | undefined, auto = false): {
  read: IdentityRead;
  look: () => void;
} {
  const key = (number ?? '').trim();
  const subscribe = React.useCallback((listener: () => void) => {
    if (!key) return () => {};
    const row = identities.get(key) ?? { read: IDENTITY_IDLE, listeners: new Set<() => void>() };
    row.listeners.add(listener);
    identities.set(key, row);
    return () => { row.listeners.delete(listener); };
  }, [key]);
  const snapshot = React.useCallback((): IdentityRead => (key ? identities.get(key)?.read ?? IDENTITY_IDLE : IDENTITY_IDLE), [key]);
  const read = React.useSyncExternalStore(subscribe, snapshot, snapshot);

  React.useEffect(() => {
    if (!key || !auto || looked.has(key)) return;
    looked.add(key);
    lookUp(key);
  }, [key, auto]);

  const look = React.useCallback(() => {
    if (!key) return;
    looked.add(key);
    lookUp(key);
  }, [key]);

  return { read, look };
}

/** The map door on an identity card. Places hands the canonical URL; a card without one shows no
 *  door rather than a search that might land on the wrong street. */
export const mapDoorOf = (identity: Identity): string | undefined => identity.mapsUrl;

export const phoneTypeWord = (identity: Identity): string =>
  identity.phoneType === 'mobile' ? 'Mobile' : identity.phoneType === 'landline' ? 'Landline' : 'Line type unknown';

export const confidenceWord = (identity: Identity): string =>
  `${Math.round(Math.max(0, Math.min(1, identity.confidence)) * 100)}% match on the number`;

/* ══ 3 · CALLS AS COMMUNICATION OBJECTS ═════════════════════════════════════════════════════ */

export type CallsRead =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'list'; calls: CallObject[] }
  | { state: 'unreachable' }
  | { state: 'unavailable'; because: string };

const CALLS_IDLE: CallsRead = { state: 'idle' };

type CallsHeld = { read: CallsRead; listeners: Set<() => void> };
const calls = new Map<string, CallsHeld>();
const asked = new Set<string>();

const publishCalls = (key: string, read: CallsRead) => {
  const row = calls.get(key);
  if (!row) return;
  row.read = read;
  row.listeners.forEach((listener) => listener());
};

const readCalls = (key: string) => {
  const row = calls.get(key) ?? { read: CALLS_IDLE, listeners: new Set<() => void>() };
  calls.set(key, { ...row, read: { state: 'loading' } });
  row.listeners.forEach((listener) => listener());
  runtime.calls(key).then(
    (list) => publishCalls(key, { state: 'list', calls: [...list].sort((a, b) => b.startedAt.localeCompare(a.startedAt)) }),
    (error: unknown) => publishCalls(key, error instanceof RuntimeUnreachable
      ? { state: 'unreachable' }
      : { state: 'unavailable', because: refusalWords(error) }),
  );
};

/** The calls the runtime has custody of for ONE counterpart. Read when a surface that shows them
 *  opens, once per number, and re-read on an explicit refresh — never on a timer, because a call
 *  list that re-fetches behind a person's back is a provider bill nobody asked for. */
export function useCalls(number: string | undefined, when = true): {
  read: CallsRead;
  refresh: () => void;
} {
  const key = (number ?? '').trim();
  const subscribe = React.useCallback((listener: () => void) => {
    if (!key) return () => {};
    const row = calls.get(key) ?? { read: CALLS_IDLE, listeners: new Set<() => void>() };
    row.listeners.add(listener);
    calls.set(key, row);
    return () => { row.listeners.delete(listener); };
  }, [key]);
  const snapshot = React.useCallback((): CallsRead => (key ? calls.get(key)?.read ?? CALLS_IDLE : CALLS_IDLE), [key]);
  const read = React.useSyncExternalStore(subscribe, snapshot, snapshot);

  React.useEffect(() => {
    if (!key || !when || asked.has(key)) return;
    asked.add(key);
    readCalls(key);
  }, [key, when]);

  const refresh = React.useCallback(() => {
    if (!key) return;
    asked.add(key);
    readCalls(key);
  }, [key]);

  return { read, refresh };
}

/** THE RUNTIME'S POSTURE, FOLDED INTO A CALL READ. A list that was never asked for because the
 *  runtime is out of reach must not sit at «Reading…» forever — that is a lie told by a spinner.
 *  So the surfaces fold the two together and the honest state wins. */
export const callsPosture = (value: RuntimePosture, read: CallsRead): CallsRead =>
  value.state === 'unreachable' ? UNREACHABLE_CALLS
    : value.state === 'down' ? { state: 'unavailable', because: value.because }
      : read;

const UNREACHABLE_CALLS: CallsRead = { state: 'unreachable' };

/** Drop every held read. The activation test uses it so a second run asks the runtime again
 *  rather than showing the answer it got before the operator picked up the phone. */
export function forgetCalls(number?: string): void {
  if (!number) { calls.clear(); asked.clear(); return; }
  const key = number.trim();
  calls.delete(key);
  asked.delete(key);
}

/* ── WHAT A CALL SAYS ABOUT ITSELF ──────────────────────────────────────────────────────────
 * VOICE-07A's card anatomy, read off the contract's own fields and nothing else.
 *
 * A MISSED CALL IS A READING OF TWO FACTS, and this is the step §196.6 did not spell out: the
 * runtime hands direction and a duration. An inbound call with no answered seconds is a call
 * nobody in the house took — «Missed call» — and it is the one call state that OWES the house an
 * act, so it wears the flag vocabulary (§196.3) wherever it stands. An outbound call with no
 * seconds is one the customer did not take: «No answer».
 */
export const isMissed = (call: CallObject): boolean =>
  call.direction === 'inbound' && !(call.durationSeconds && call.durationSeconds > 0);

export const directionWord = (call: CallObject): string =>
  isMissed(call) ? 'Missed call'
    : call.direction === 'inbound' ? 'Incoming call'
      : call.durationSeconds && call.durationSeconds > 0 ? 'Outgoing call' : 'Outgoing call · rang out';

export const durationWords = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes} min ${rest} sec` : `${rest} sec`;
};

/** THE CUSTODY LINE (VOICE-09B). Each word is a different place the audio actually is, and none of
 *  them claims the audio is here: the kit never receives a provider media URL. */
export const custodyWords = (call: CallObject): string =>
  call.recordingCustody === 'ours' ? 'Recording held by Rocoto'
    : call.recordingCustody === 'provider' ? 'Recording with the provider'
      : VOICE_COPY.metadataOnly;

export const transcriptWords = (call: CallObject): string =>
  call.transcript ? VOICE_COPY.transcriptReady : VOICE_COPY.metadataOnly;

/** «Today · 08:42» / «3 Sep · 08:42» — the house reads a clock, not an ISO string. */
export function callWhen(call: CallObject, now = new Date()): string {
  const at = new Date(call.startedAt);
  if (Number.isNaN(at.getTime())) return call.startedAt;
  const hour = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  if (sameDay) return `Today · ${hour}`;
  return `${at.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][at.getMonth()]} · ${hour}`;
}

/* ══ THE DIARISED SPANISH TRANSCRIPT ════════════════════════════════════════════════════════
 * «and then the transcription too, with clear speaker diarisation. set to spanish of course.»
 *
 * THE STEP PETER DID NOT SPELL OUT — WHICH VOICE IS WHICH. Deepgram hands numbered speakers, and a
 * number is not a name. Two roads reach that number and they do not deserve the same trust:
 *
 *   · A TWO-TRACK RECORDING (Twilio `record-from-answer-dual`) has one voice per channel, so
 *     channel 0 IS the house's leg and channel 1 IS the caller's. No heuristic, no guess.
 *   · A SINGLE MIXED TRACK is read by the diarizer, and its speaker numbers are arbitrary labels
 *     in the order it first heard them.
 *
 * The kit cannot see which road a transcript took, so it takes the first as its DEFAULT — speaker
 * 0 is the house — SAYS SO on the panel, and gives one control that flips it. The choice is
 * remembered per call so the correction outlives a reload. A third voice (a colleague on the line,
 * a diarizer split) keeps its own number and never borrows either name.
 */
export const VOICES_STORAGE_KEY = 'rocoto-call-voices';

type Voices = Record<string, number>;
let voices: Voices | null = null;
const voiceListeners = new Set<() => void>();

const readVoices = (): Voices => {
  if (voices) return voices;
  let held: Voices = {};
  try {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(VOICES_STORAGE_KEY);
    if (stored) {
      const raw = JSON.parse(stored) as Record<string, unknown>;
      held = Object.fromEntries(Object.entries(raw)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .map(([key, value]) => [key, Math.max(0, Math.floor(value as number))]));
    }
  } catch {
    held = {};
  }
  voices = held;
  return held;
};

const subscribeVoices = (listener: () => void) => {
  voiceListeners.add(listener);
  return () => { voiceListeners.delete(listener); };
};

export function setHouseVoice(sid: string, speaker: number): void {
  const next = { ...readVoices(), [sid]: Math.max(0, Math.floor(speaker)) };
  voices = next;
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(VOICES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* a browser that refuses to remember still shows the correction for this session */
  }
  voiceListeners.forEach((listener) => listener());
}

/** The distinct speakers in a transcript, in the order they were first heard. */
export const speakersOf = (transcript: Transcript): number[] => {
  const seen: number[] = [];
  for (const utterance of transcript.utterances) if (!seen.includes(utterance.speaker)) seen.push(utterance.speaker);
  return seen;
};

export function useHouseVoice(sid: string): { houseSpeaker: number; swap: (speakers: number[]) => void } {
  const held = React.useSyncExternalStore(subscribeVoices, readVoices, readVoices);
  const houseSpeaker = held[sid] ?? 0;
  const swap = React.useCallback((speakers: number[]) => {
    const order = speakers.length > 0 ? speakers : [0, 1];
    const at = order.indexOf(houseSpeaker);
    setHouseVoice(sid, order[(at + 1 + order.length) % order.length]);
  }, [sid, houseSpeaker]);
  return { houseSpeaker, swap };
}

/** «0:07» — where a line sits in the call, so a person can find it in the audio the provider holds. */
export const atWords = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export type TranscriptLine = {
  utterance: Utterance;
  /** the party this line belongs to, decided by the house-voice assignment above */
  side: 'house' | 'them' | 'other';
  who: string;
  at: string;
  /** the line as it goes on a clipboard or into a message — named, timed, exact */
  quote: string;
};

export function transcriptLines(
  transcript: Transcript,
  a: { houseSpeaker: number; houseName: string; themName: string },
): TranscriptLine[] {
  return transcript.utterances.map((utterance) => {
    const side: TranscriptLine['side'] = utterance.speaker === a.houseSpeaker
      ? 'house'
      : speakersOf(transcript).length <= 2 ? 'them' : 'other';
    const who = side === 'house' ? a.houseName : side === 'them' ? a.themName : `Voice ${utterance.speaker + 1}`;
    const at = atWords(utterance.start);
    return { utterance, side, who, at, quote: `${who} · ${at} — ${utterance.text}` };
  });
}

/** Put a line where a person can paste it. The clipboard is the one hand-off every browser has;
 *  the composer's own prefill seam belongs to the Messages surface (§196.7 · §196.8). */
export async function copyLine(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* a denied clipboard is a browser fact, and the surface says so rather than claiming a copy */
  }
  return false;
}

/* ══ 4 · THE OUTBOUND CALL ══════════════════════════════════════════════════════════════════ */

export type DialState =
  | { state: 'idle' }
  | { state: 'placing'; to: string }
  | { state: 'placed'; to: string; sid: string }
  | { state: 'refused'; because: string }
  | { state: 'unreachable' };

/** Place a call through the runtime's Twilio. Readiness is checked by the CALLER (the surface owns
 *  the door it disables); this hook owns only what the provider said back. */
export function useDial(): { state: DialState; dial: (to: string) => void; reset: () => void } {
  const [state, setState] = React.useState<DialState>({ state: 'idle' });
  const dial = React.useCallback((to: string) => {
    const number = to.trim();
    if (!number) { setState({ state: 'refused', because: 'A call needs a number to reach.' }); return; }
    setState({ state: 'placing', to: number });
    runtime.dial(number).then(
      (answer) => setState({ state: 'placed', to: number, sid: answer.sid }),
      /* §196.6 · E195.21 — the runtime «refuses, by name, on any fact it does not have», so the
         name is what the person reads: a house sentence for the boundaries the kit knows by name,
         the runtime's own words for everything else. A bare status code is not an answer. */
      (error: unknown) => setState(error instanceof RuntimeUnreachable
        ? { state: 'unreachable' }
        : { state: 'refused', because: refusalWords(error) }),
    );
  }, []);
  const reset = React.useCallback(() => setState({ state: 'idle' }), []);
  return { state, dial, reset };
}

/* ══ 5 · THE ACTIVATION TEST ════════════════════════════════════════════════════════════════
 * VOICE-01A step 8, for real. Two calls prove a line, and each proof is EVIDENCE the runtime can
 * still show — never a boolean a browser wrote about itself (which is why
 * `phone-connection-config` normalises every provider fact back to pending on write).
 *
 *   INBOUND  · the operator rings the house number from their own phone; the kit re-reads
 *              `/api/calls?number=<house>` until a call the runtime did not have before appears.
 *              The sid IS the proof.
 *   OUTBOUND · the kit places a call to a number the operator is holding; Twilio's sid is the
 *              proof that the account accepted the request, and the RING is the proof the operator
 *              confirms with their own ear.
 *
 * A test that finds nothing stays «waiting», forever if need be. It never times out into a pass.
 */
export type ActivationLeg =
  | { state: 'idle' }
  | { state: 'waiting'; since: string }
  | { state: 'passed'; sid: string; evidence: string }
  | { state: 'unreachable' }
  | { state: 'unavailable'; because: string };

export function useInboundTest(houseNumber: string): {
  leg: ActivationLeg;
  start: () => void;
  poll: () => void;
  stop: () => void;
} {
  const [leg, setLeg] = React.useState<ActivationLeg>({ state: 'idle' });
  const before = React.useRef<Set<string>>(new Set());
  const timer = React.useRef<number | undefined>(undefined);

  const look = React.useCallback(() => {
    const number = houseNumber.trim();
    if (!number) return;
    runtime.calls(number).then(
      (list) => {
        const fresh = list.find((call) => call.direction === 'inbound' && !before.current.has(call.sid));
        if (fresh) {
          setLeg({
            state: 'passed',
            sid: fresh.sid,
            evidence: `${directionWord(fresh)} from ${fresh.from} · ${callWhen(fresh)} · ${durationWords(fresh.durationSeconds)}`,
          });
          if (timer.current) window.clearInterval(timer.current);
        }
      },
      (error: unknown) => {
        setLeg(error instanceof RuntimeUnreachable
          ? { state: 'unreachable' }
          : { state: 'unavailable', because: refusalWords(error) });
        if (timer.current) window.clearInterval(timer.current);
      },
    );
  }, [houseNumber]);

  const start = React.useCallback(() => {
    const number = houseNumber.trim();
    if (!number) return;
    runtime.calls(number).then(
      (list) => {
        before.current = new Set(list.map((call) => call.sid));
        setLeg({ state: 'waiting', since: new Date().toISOString() });
        if (timer.current) window.clearInterval(timer.current);
        timer.current = window.setInterval(look, 4000);
      },
      (error: unknown) => setLeg(error instanceof RuntimeUnreachable
        ? { state: 'unreachable' }
        : { state: 'unavailable', because: refusalWords(error) }),
    );
  }, [houseNumber, look]);

  const stop = React.useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    setLeg({ state: 'idle' });
  }, []);

  React.useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  return { leg, start, poll: look, stop };
}

export type { CallObject, Identity, RuntimeHealth, Transcript, Utterance };
