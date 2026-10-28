import { proofApi, ProofApiError } from './api';
import type { ProofState } from './types';

type LoginResponse = { authResponse?: { code?: string }; status?: string };
export type MetaSdk = {
  init(options: { appId: string; version: string; cookie: boolean; xfbml: boolean; autoLogAppEvents: boolean }): void;
  login(callback: (response: LoginResponse) => void, options: Record<string, unknown>): void;
};

declare global {
  interface Window { FB?: MetaSdk; fbAsyncInit?: () => void }
}

let sdkPromise: Promise<MetaSdk> | undefined;

export function loadMetaSdk(): Promise<MetaSdk> {
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<MetaSdk>((resolve, reject) => {
    const id = 'cedar-meta-sdk';
    let script = document.getElementById(id) as HTMLScriptElement | null;
    const fail = () => {
      window.clearTimeout(timeout);
      script?.remove();
      sdkPromise = undefined;
      reject(new Error('Meta is taking longer to open. Try loading the connection again.'));
    };
    const timeout = window.setTimeout(fail, 20000);
    window.fbAsyncInit = () => {
      window.clearTimeout(timeout);
      if (window.FB) resolve(window.FB); else fail();
    };
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = fail;
      document.head.appendChild(script);
    }
  });
  return sdkPromise;
}

export type SignupSession = { event: string; wabaId: string; phoneNumberId?: string };
export type SignupDiagnostic = {
  event: 'CANCEL' | 'ERROR'; errorCode?: string; currentStep?: string; sessionId?: string; reportedAt?: string;
};
export type DiagnosticDelivery = {
  state: 'sending' | 'saved' | 'failed'; errorCode?: string; receiptId?: string;
};
const META_ORIGINS = new Set(['https://www.facebook.com', 'https://web.facebook.com']);

/** Provider text can contain account details. Only bounded support metadata leaves this parser. */
function readDiagnostic(event: 'CANCEL' | 'ERROR', data: unknown): SignupDiagnostic {
  if (!data || typeof data !== 'object') return { event };
  const fields = data as Record<string, unknown>;
  const diagnostic: SignupDiagnostic = { event };
  const numeric = (value: unknown) => typeof value === 'string' ? value
    : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : '';
  const code = numeric(fields.error_code);
  const timestamp = numeric(fields.timestamp);
  if (/^\d{1,12}$/.test(code)) diagnostic.errorCode = code;
  if (typeof fields.current_step === 'string' && /^[A-Z_]{1,64}$/.test(fields.current_step)) diagnostic.currentStep = fields.current_step;
  if (typeof fields.session_id === 'string' && /^[a-fA-F0-9-]{8,64}$/.test(fields.session_id)) diagnostic.sessionId = fields.session_id;
  if (/^\d{10,13}$/.test(timestamp)) diagnostic.reportedAt = timestamp;
  return diagnostic;
}

/** The origin is exact, and provider session data is accepted only during an explicit attempt. */
export function readSignupEvent(origin: string, input: unknown): {
  session?: SignupSession; cancelled?: boolean; failed?: boolean; diagnostic?: SignupDiagnostic;
} | null {
  if (!META_ORIGINS.has(origin)) return null;
  let value = input;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'WA_EMBEDDED_SIGNUP') return null;
  const event = 'event' in value && typeof value.event === 'string' ? value.event : '';
  const data = 'data' in value ? value.data : undefined;
  if (event === 'CANCEL') return { cancelled: true, diagnostic: readDiagnostic(event, data) };
  if (event === 'ERROR') return { failed: true, diagnostic: readDiagnostic(event, data) };
  if (event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' && event !== 'FINISH') return null;
  if (!data || typeof data !== 'object') return null;
  const wabaId = 'waba_id' in data && typeof data.waba_id === 'string' ? data.waba_id : '';
  const phoneNumberId = 'phone_number_id' in data && typeof data.phone_number_id === 'string' ? data.phone_number_id : undefined;
  if (!/^\d+$/.test(wabaId) || (phoneNumberId !== undefined && !/^\d+$/.test(phoneNumberId))) return null;
  return { session: { event, wabaId, phoneNumberId } };
}

export type SignupStatus = 'opening' | 'authorizing' | 'exchanging' | 'awaiting_details' | 'connecting';

/** One attempt owns its callback, listener and abort signal; the two provider answers may race. */
export function beginSignup(options: {
  sdk: MetaSdk;
  configId: string;
  historyRequested: boolean;
  onStatus(status: SignupStatus): void;
  onConnected(state: ProofState): void;
  onError(error: unknown): void;
  onDiagnostic?(delivery: DiagnosticDelivery): void;
}): () => void {
  const controller = new AbortController();
  let alive = true;
  let authorizationId: string | undefined;
  let session: SignupSession | undefined;
  let codeStarted = false;
  let submitted = false;
  let listening = true;
  let latestReport = '';
  let latestReportScore = -1;
  const reports = new Set<string>();
  const retries = new Set<number>();
  let diagnosticTimeout: number;
  let timeout: number;

  const stopAuthorization = () => {
    alive = false;
    controller.abort();
    window.clearTimeout(timeout);
  };
  const cleanup = () => {
    stopAuthorization();
    listening = false;
    window.clearTimeout(diagnosticTimeout);
    for (const retry of retries) window.clearTimeout(retry);
    retries.clear();
    window.removeEventListener('message', onMessage);
  };
  const fail = (error: unknown) => {
    if (!alive) return;
    stopAuthorization();
    options.onError(error);
  };
  const report = (diagnostic: SignupDiagnostic) => {
    const signature = JSON.stringify(diagnostic);
    if (reports.has(signature) || reports.size >= 10) return;
    reports.add(signature);
    // Each distinct report gets an idempotency key so later, richer metadata is retained.
    const attemptId = crypto.randomUUID();
    const score = Object.keys(diagnostic).length + (diagnostic.errorCode ? 10 : 0);
    if (score >= latestReportScore) { latestReport = attemptId; latestReportScore = score; }
    const update = (delivery: DiagnosticDelivery) => {
      if (listening && latestReport === attemptId) options.onDiagnostic?.({ ...delivery, errorCode: diagnostic.errorCode });
    };
    const send = (retry: number) => {
      if (!listening) return;
      update({ state: 'sending' });
      void proofApi<{ receiptId: string }>('/whatsapp/diagnostics', {
        body: { attemptId, ...diagnostic }, timeoutMs: 5000,
      }).then((answer) => {
        if (!/^[a-f0-9]{64}$/.test(answer.receiptId)) throw new Error('Invalid report receipt');
        update({ state: 'saved', receiptId: answer.receiptId });
      }).catch((error: unknown) => {
        if (!listening) return;
        const transient = error instanceof ProofApiError && (error.status === 0 || (error.status >= 500 && error.status <= 599));
        if (transient && retry < 2) {
          const timer = window.setTimeout(() => { retries.delete(timer); send(retry + 1); }, retry === 0 ? 1000 : 3000);
          retries.add(timer);
        } else update({ state: 'failed' });
      });
    };
    send(0);
  };
  const connect = () => {
    if (!alive || submitted || !authorizationId || !session) return;
    submitted = true;
    options.onStatus('connecting');
    void proofApi<ProofState>('/whatsapp/connect', {
      body: { authorizationId, ...session, historyRequested: options.historyRequested },
      signal: controller.signal,
      timeoutMs: 60000,
    }).then((state) => {
      if (!alive) return;
      cleanup();
      options.onConnected(state);
    }).catch(fail);
  };
  const onMessage = (event: MessageEvent) => {
    if (!listening) return;
    const answer = readSignupEvent(event.origin, event.data);
    if (answer?.diagnostic) report(answer.diagnostic);
    // A cancelled/expired attempt may receive support reports, but cannot authorize again.
    if (!alive) return;
    if (answer?.cancelled) { fail(new Error('Setup closed. You can continue when you are ready.')); return; }
    if (answer?.failed) { fail(new Error('Meta needs another connection attempt. Continue to review the setup.')); return; }
    if (answer?.session && !session) { session = answer.session; connect(); }
  };
  window.addEventListener('message', onMessage);
  // Bound support capture independently of the five-minute authorization timeout. The caller
  // also disposes this listener on retry/unmount; success disposes it before account access.
  diagnosticTimeout = window.setTimeout(cleanup, 30 * 60 * 1000);
  timeout = window.setTimeout(() => fail(new Error('The setup window has expired. Continue to open a fresh connection.')), 5 * 60 * 1000);
  options.onStatus('opening');
  try {
    // FB.login runs synchronously from the user's click, preserving popup permission.
    options.sdk.login((response) => {
      if (!alive || codeStarted) return;
      const code = response.authResponse?.code;
      if (!code) {
        fail(new Error('Setup closed. You can continue when you are ready.'));
        return;
      }
      codeStarted = true;
      options.onStatus('exchanging');
      // The exchange starts immediately: Meta codes expire in 30 seconds. Do not wait for postMessage.
      void proofApi<{ authorizationId: string }>('/whatsapp/code', { body: { code }, signal: controller.signal })
        .then((answer) => {
          if (!alive) return;
          if (!answer.authorizationId || typeof answer.authorizationId !== 'string') {
            fail(new Error('The authorization needs another connection attempt. Continue to try again.'));
            return;
          }
          authorizationId = answer.authorizationId;
          options.onStatus(session ? 'connecting' : 'awaiting_details');
          connect();
        }).catch(fail);
    }, {
      config_id: options.configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
    });
    if (alive && !codeStarted) options.onStatus('authorizing');
  } catch { fail(new Error('Allow the Meta setup window, then continue again.')); }
  return cleanup;
}
