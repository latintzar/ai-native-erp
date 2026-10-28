/* ONE ANSWER TO «CAN THIS WORKSPACE CALL SOMEBODY» (FEED-IA §246).
 *
 * «the connection related stuff should be state led … any action that has to do with calling
 *  someone should always result in the same thing, with the image … You hard-coded the state,
 *  which should always just sort of poll … for the state of the connection.»   — Peter, 2026-09-10
 *
 * Four surfaces used to answer that question four different ways: the dial dialog asked
 * `evidence.mode === 'commissioned'`, Connections mixed provider evidence with a browser draft's
 * `prepared` flag, onboarding repeated a fourth predicate and phone setup a fifth. One account
 * could therefore read Connected on one surface and uncommissioned on the next, and a line whose
 * caller ID was still pending got a keypad and a live Call button.
 *
 * This module is the single derivation, and it is PURE: a provider snapshot in, a posture out. It
 * imports nothing at runtime, so a tool test can run the real thing rather than a copy of it.
 * Live provider evidence is the only input — a seeded or drafted local status has no vote here.
 */
import type { PhoneLineEvidence, PhoneReadiness, PhoneSetupEvidence } from './phone-runtime';

/** The whole register a call entrance may find itself in. Every one that is not `ready` presents
 *  the same image and the same `Connect phone` action — one state, one picture. */
export type PhonePosture = 'checking' | 'unavailable' | 'setup' | 'partial' | 'ready';

/** What is still pending, in the order a person meets it. */
export type PhoneNeed = 'connection' | 'line' | 'account' | 'caller-id' | 'forwarding';

/** The shape `usePhoneProvider()` publishes; declared here so the selector stays free of React. */
export type PhoneProviderState = {
  status: 'checking' | 'ready' | 'unavailable';
  evidence: PhoneSetupEvidence | null;
  error: string;
  /** When the snapshot was last written, in epoch milliseconds. `0` means it has yet to answer. */
  checkedAt: number;
  /** When the EVIDENCE STANDING HERE stopped being confirmed: the first failed read since the last
   *  good one, in epoch milliseconds. A verified line keeps its evidence and its posture through a
   *  transient read; the surfaces say `Checking…` and nothing else changes, because a failed read
   *  is a fact about the network rather than about the line.
   *  `0` means the posture is SETTLED — the provider is answering, or it answered about this
   *  workspace and the evidence was cleared. A settled posture is never «Checking…». */
  staleSince: number;
};

/* ── THE RECORDING VOCABULARY, IN ONE PLACE ──────────────────────────────────────────────────
 * A line's own setup has always travelled as `off` | `notice`. The commissioning runtime adds the
 * operator's notice mode — `none` | `spoken` | `audio` — and can answer a line's `recording` in
 * that vocabulary once it lands. Reads accept both; writes stay on the pair the running server
 * accepts today, so the browser keeps working across that merge in either order. */
export type PhoneRecordingChoice = 'off' | 'notice' | 'none' | 'spoken' | 'audio';
export const PHONE_RECORDING_WIRE: readonly PhoneRecordingChoice[] = ['off', 'notice', 'none', 'spoken', 'audio'];
/** Does this wire value mean the line records its calls? `off` and `none` are the two silences. */
export function phoneRecordingOn(value: string): boolean {
  return value === 'notice' || value === 'spoken' || value === 'audio';
}
/** What the browser sends. The running runtime takes `off` | `notice`; the notice a recorded call
 *  plays is the operator's commissioning decision, so it is never written from here. */
export function phoneRecordingWire(on: boolean): PhoneRecordingChoice {
  return on ? 'notice' : 'off';
}

export type PhoneCapability = {
  posture: PhonePosture;
  /** The line every outgoing call and every status word on this workspace is about. */
  line: PhoneLineEvidence | null;
  callerId: string;
  inboundNumber: string;
  /** The provider account behind the selected line is live. Incoming calls, active-call recovery
   *  and hang-up need this and nothing more; placing a call additionally needs `ready`. */
  accountReady: boolean;
  browserReady: boolean;
  mobileReady: boolean;
  forwardingState: PhoneReadiness['forwarding_state'];
  transcriptionReady: boolean;
  needs: PhoneNeed[];
  error: string;
  checkedAt: number;
  /** The evidence stands, and the last read failed to confirm it. Surfaces keep what they draw and
   *  add one quiet line; only the provider's own answer moves the posture. */
  stale: boolean;
  staleSince: number;
};

const E164 = /^\+[1-9]\d{6,14}$/;

/** The outgoing line: the one the owner selected, else the first commissioned line, else the first
 *  draft. A commissioned account whose response predates per-line rows carries its default line in
 *  the compatibility fields, so that shape resolves to a line too. */
export function phoneDefaultLine(evidence: PhoneSetupEvidence): PhoneLineEvidence | null {
  const lines = Array.isArray(evidence.lines) ? evidence.lines : [];
  if (lines.length) {
    const named = evidence.default_line_id
      ? lines.find((row) => row.line_id === evidence.default_line_id)
      : undefined;
    return named ?? lines.find((row) => row.mode === 'commissioned') ?? lines[0];
  }
  if (evidence.mode === 'commissioned' && evidence.setup.source_number) {
    return {
      line_id: `line_default_${evidence.workspace_id}`,
      mode: 'commissioned',
      setup: evidence.setup,
      readiness: evidence.readiness,
      checks: evidence.checks,
    };
  }
  return null;
}

/** The one derivation every call entrance reads. */
export function phoneCapabilityOf(state: PhoneProviderState): PhoneCapability {
  const base = {
    line: null,
    callerId: '',
    inboundNumber: '',
    accountReady: false,
    browserReady: false,
    mobileReady: false,
    forwardingState: 'not-run' as PhoneReadiness['forwarding_state'],
    transcriptionReady: false,
    error: state.error,
    checkedAt: state.checkedAt,
    stale: state.staleSince > 0,
    staleSince: state.staleSince,
  };
  if (state.status === 'checking') return { ...base, posture: 'checking', needs: ['connection'] };
  if (state.status === 'unavailable' || !state.evidence) return { ...base, posture: 'unavailable', needs: ['connection'] };
  const line = phoneDefaultLine(state.evidence);
  if (!line) return { ...base, posture: 'setup', needs: ['line'] };
  const ready = line.readiness;
  const needs: PhoneNeed[] = [];
  if (line.mode !== 'commissioned' || !ready.account_verified) needs.push('account');
  if (!ready.caller_id_verified) needs.push('caller-id');
  if (ready.forwarding_state !== 'verified') needs.push('forwarding');
  return {
    ...base,
    posture: needs.length ? 'partial' : 'ready',
    line,
    callerId: ready.caller_id || line.setup.source_number,
    inboundNumber: ready.inbound_number,
    accountReady: line.mode === 'commissioned' && ready.account_verified,
    browserReady: ready.browser_ready,
    mobileReady: E164.test(line.setup.fallback_number),
    forwardingState: ready.forwarding_state,
    transcriptionReady: ready.transcription_ready,
    needs,
  };
}

/** One line is connected when the provider says its account, caller ID and forwarding are all
 *  verified. The lines list, the default-line word and the capability read the same sentence. */
export function phoneLineConnected(line: PhoneLineEvidence | null | undefined): boolean {
  return Boolean(line && line.mode === 'commissioned' && line.readiness.account_verified
    && line.readiness.caller_id_verified && line.readiness.forwarding_state === 'verified');
}

/** Where `Connect phone` resumes: the first step this line has yet to meet, so a person who left
 *  half way through returns to the question they stopped at rather than to the forwarding test. */
export function phoneSetupResumeStep(line: PhoneLineEvidence | null): 0 | 1 | 2 | 3 | 4 {
  if (!line || !line.setup.source_number) return 0;
  if (!line.setup.fallback_number) return 1;
  if (line.readiness.forwarding_state !== 'verified') return 2;
  if (!line.readiness.caller_id_verified) return 3;
  return 4;
}

/** The Connections card's own word for each posture. */
export function phoneStatusWord(posture: PhonePosture): string {
  if (posture === 'ready') return 'Connected';
  if (posture === 'partial') return 'Finish setup';
  return 'Connect phone';
}
