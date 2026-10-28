/* THE KIT RUNTIME'S ONE CLIENT (FEED-IA §196.5 · §196.6 — «now we're doing it all for real»)
 *
 * The kit is a static page. The calls that need a SECRET — Parsewise extraction, Google Places
 * identity, Deepgram transcription, Twilio — run in a small self-hosted service behind
 * kit.soyrocoto.com/api (E193.06). This file is the ONLY place the kit names that service, so
 * every surface reads the same contract and the same honest posture when it is unreachable.
 *
 * Base resolution: same origin by default (kit.soyrocoto.com/api); a developer may point a local
 * build at a local runtime with localStorage['rocoto-runtime-base'] = 'http://127.0.0.1:8790'.
 * A missing runtime is a STATE («Runtime offline»), never a fake answer. */
import type { PaperManifest } from './paper-manifest';

export type RuntimeProvider = 'parsewise' | 'deepgram' | 'places' | 'twilio';
/* THE FIFTH AND SIXTH NAMES STAND BESIDE THE FOUR, EACH IN ITS OWN WORDS (RELEASE-195).
   The four keys report `configured` or `missing` — that is what `providerState()` promises its
   callers, so neither of the two below widens that record. The ARTWORK road is built and waiting,
   so it reports «awaiting key» (FEED-IA §200.2 · THE-RUNTIME-SPEC RUN-12). The COPILOT names the
   MIND that is standing rather than merely stating that some key exists (§196.2 · §199.3): Gemini
   and Claude are two different products to the person reading the reply. */
export type ArtworkProviderState = 'configured' | 'awaiting key';
export type CopilotProviderState = 'gemini' | 'anthropic' | 'awaiting key';
export type RuntimeHealth = {
  ok: boolean;
  version: string;
  providers: Record<RuntimeProvider, 'configured' | 'missing'>
    & { artwork?: ArtworkProviderState; copilot?: CopilotProviderState };
};

/* §RUN-03 · A KEY IN AN ENV FILE IS NOT AN ACCOUNT THAT ANSWERS. `/api/health` reports what the
   service HOLDS; `/api/health/twilio` is the one place the account is asked about itself, and it
   answers with what actually happened when it was asked. */
export type TwilioAccount = { reachable: boolean; status?: number; why?: string };

/** ONE ROW OFF A DOCUMENT, WHATEVER KIND IT WAS (§PAR-02.1).
 *  `name` is what the page called the goods — the printed name, or the printed code where the
 *  line carried only a code, because the kit resolves a row against product NAME or CODE.
 *  `code` is the literal SKU the row printed BESIDE its name, and it exists because a supplier's
 *  catalogue is a list of CODES: a house importing one whose codes had been folded into the name
 *  column would have to retype every one of them. Optional on purpose — a runtime that answers
 *  without it still parses, and the surface asks for the code as an identity check (E200.08).
 *  `date` is the date the row itself printed, ISO 8601 — a stock count's own goods-in date. It is
 *  declared in §PAR-02.1's stock kind and the runtime's `Date` agent has always read it; it had no
 *  seat in this type, so it was read and dropped. The stock table takes it as the row's production
 *  date and the house's own today stands where the paper printed none (E200.08). */
export type ParsedRow = { name: string; code?: string; qty?: number; unit?: string; price?: number; lot?: string; date?: string; raw: string };
export type ParseResult = {
  rows: ParsedRow[];
  columns: string[];
  confidence: number;
  provider: 'parsewise';
  /* §PAR-09 (W14): the runtime states where the row ORDER came from and what it folded — a
     read whose order it could not establish says so, and the kit repeats it beside the proposal */
  evidence: { pages: number; tables: number; documentId?: string; lineOrder?: 'numbered' | 'read-order' | 'unknown'; rowsMerged?: number; rowsDropped?: number };
};

export type Identity = {
  number: string;
  name?: string;
  address?: string;
  placeId?: string;
  mapsUrl?: string;
  phoneType?: 'landline' | 'mobile' | 'unknown';
  confidence: number;
  provider: 'google-places';
};

/** The two markets the Settings toggle selects; the runtime searches addresses in that country. */
export type AddressCountry = 'PE' | 'ES';
export type AddressSuggestions = {
  provider: 'google-places';
  country: AddressCountry;
  suggestions: { placeId: string; text: string; mainText: string; secondaryText: string }[];
};

export type Utterance = { speaker: number; start: number; end: number; text: string };
export type Transcript = { transcript: string; utterances: Utterance[]; language: 'es'; provider: 'deepgram nova-3' };

export type CallObject = {
  sid: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  startedAt: string;
  durationSeconds?: number;
  recordingCustody: 'none' | 'provider' | 'ours';
  transcript?: Transcript;
};

/* ══ THE PAPER CONTRACT (E196 · «our paper, read back») ══════════════════════════════════════
 * A packing list is printed, the goods are weighed, somebody writes the final weight in the box
 * the sheet left for it, and a photograph of that paper comes back. Two calls carry the whole
 * road, and the geometry that joins them is recorded ONCE, at print time.
 *
 *   THE MANIFEST  is what the kit knew when it printed: where every cell sits on every page, in
 *                 MILLIMETRES from that page's top-left, plus the four marks that let a camera
 *                 find the page again — the QR at its spec'd corner and three solid squares at
 *                 the other three. It is keyed by the locator's token, and its HOME is
 *                 `./paper-manifest` (E196.1), which measures it off the print DOM. This file
 *                 re-exports the type so every consumer of the runtime reads one vocabulary.
 *   THE READING   is what the runtime made of the photograph, cell by cell, with the CROP of the
 *                 ink beside every value, so the person judges the handwriting rather than
 *                 trusting a transcription of it.
 *
 * ⚠ NO MANIFEST, NO READING. A photograph the runtime holds no layout for is answered 422 with a
 * positively worded reason, and the kit falls back to the Parsewise road (§196.5). Reading cells
 * off a page whose geometry nobody recorded would be a number invented at exactly the moment a
 * person stops checking, which is the failure every line of THE-PARSING-SPEC is written against.
 *
 * ⚠ ONE VOCABULARY, RESOLVED AT RELEASE-195. E196.1 built the print half and named the answer
 * `PaperReadResult`; E196.3 built the surface that consumes it and named it `PaperRead`. The
 * names below are E196.3's, because they are what the mounted surfaces import; the older names
 * stand as aliases so nothing that already compiled has to be rewritten to say the same thing.
 */

export type { PaperManifest };
/** millimetres from the page's top-left, page-local */
export type PaperRect = { x: number; y: number; w: number; h: number };
/** WHICH CORNER A MARK STANDS IN — all four are named, and the paper uses three of them.
 *  THE-QR-SPEC QR-03 puts the QR at the TOP RIGHT of the packing masthead, so the squares take
 *  `tl · bl · br`. Naming the whole vocabulary and letting the geometry come from each mark's own
 *  millimetres reads either producer, which is what `backend/app/paper.py`'s `CORNER_IDS` does. */
export type PaperCornerId = 'tl' | 'tr' | 'bl' | 'br';
/** which box on the row a reading came out of */
export type PaperCell = 'finalWeight' | 'qty' | 'unit';
/** the name E196.1 gave the same union */
export type PaperReadingCell = PaperCell;

export type PaperReading = {
  sale: string;
  line: string;
  cell: PaperCell;
  /** whether the crop carries new ink at all — a blank cell is a fact, not a failure */
  written: boolean;
  value: string | null;
  /** 0..1 */
  confidence: number;
  /** the ink itself, as a data URL, so the person reads the handwriting and not a claim about it */
  crop: string;
  /** what the runtime wants a person to look at, in words, or null when nothing is in doubt */
  check: string | null;
};
export type PaperPageQuality = { tiltDeg: number; blurScore: number; lightScore: number };
export type PaperPageRead = { index: number; quality: PaperPageQuality; readings: PaperReading[] };
export type PaperRead = {
  locator: string;
  token: string;
  matched: { day: string; sales: string[] } | null;
  pages: PaperPageRead[];
  /** `reader` NAMES THE MODEL THAT ACTUALLY READ. The two words below are what the runtime answers
   *  as it ships; a box pointed at another model says that model's own name, because evidence that
   *  kept naming the default would be a false line in the field a person consults to decide whether
   *  to trust a number. The union keeps the two known words in autocomplete and accepts the rest. */
  evidence: { reader: 'gemini-2.5-flash' | 'claude' | (string & {}); ms: number; marksFound: number };
};
/** the names E196.1 gave the same two shapes */
export type PaperPageReading = PaperPageRead;
export type PaperReadResult = PaperRead;
export type PaperManifestReceipt = { ok: boolean; token: string };

/* ── THE COPILOT'S MIND (FEED-IA §196.2 · E198) ──────────────────────────────────────────────
 * The kit's Copilot has sessions, a ported composer and cards that do real work. What it did not
 * have was a mind: `copilot/router.ts` was a keyword table. The runtime holds one now, behind this
 * one road, and the CONTRACT below is the whole agreement between them.
 *
 * WHAT THE KIT SENDS is the desk as it stands — the day, the area, the open document, the day's
 * orders with their flags, the shortage ledger, the customer in hand — because the mind may state
 * NOTHING it was not given. What comes back is a reply and PROPOSALS, and the proposals are the
 * shapes `copilot/flows.tsx` already renders. Every id a proposal names exists in the context that
 * was sent; the runtime drops the ones that do not, so «Open order» lands on a real document. */

export type CopilotRole = 'person' | 'copilot';
export type CopilotSessionMessage = { role: CopilotRole; text: string; at: string };
export type CopilotContextLine = { product: string; qty: number; unit: string };
export type CopilotDocumentLine = CopilotContextLine & { price?: number };
export type CopilotContextOrder = {
  id: string;
  number: string;
  customer: string;
  /** the account behind the name — what an `open-chat` proposal is grounded against */
  customerId: string;
  state: string;
  flags: string[];
  lines: CopilotContextLine[];
};
export type CopilotContextStock = { product: string; available: number; unit: string; expected?: string };
export type CopilotContext = {
  day: string;
  area: string;
  document: { number: string; customer: string; state: string; lines: CopilotDocumentLine[] } | null;
  orders: CopilotContextOrder[];
  stock: CopilotContextStock[];
  customer: { name: string; tariff: string; rhythm?: string } | null;
};

export type CopilotProposal =
  /** open the supply report on these goods, with the orders it touches already laid out */
  | { kind: 'supply-report'; product?: string; orderIds: string[] }
  /** §196.9 — one drafted customer message per affected order, for the person to read and send */
  | { kind: 'drafts'; drafts: Array<{ orderId: string; customer: string; text: string }> }
  | { kind: 'open-order'; orderId: string }
  | { kind: 'open-chat'; customerId: string }
  | { kind: 'stock-note'; product: string; text: string }
  /** the words alone answer the ask */
  | { kind: 'answer' };

export type CopilotAsk = {
  session: { id: string; messages: CopilotSessionMessage[] };
  context: CopilotContext;
  ask: string;
};

export type CopilotAnswer = {
  reply: { text: string };
  proposals: CopilotProposal[];
  /** what the answer cost and which mind gave it — printed on the turn, kept in the journal */
  evidence: { model: string; ms: number; tokens: number };
};

export class RuntimeUnreachable extends Error {
  constructor(public readonly base: string, public readonly cause?: unknown) { super(`Runtime offline at ${base}`); }
}

/* ⚠ THE REFUSAL IS THE RUNTIME'S OWN ENVELOPE, NOT A GUESS AT ONE (resolved at RELEASE-195).
 * E196.3 read a `{reason}` / `{detail}` body; `backend/app/errors.py` sends
 * `{"error":{"code","message"}}` on every road, paper included, so `said` is where the runtime's
 * sentence — «This paper's layout is on another device. Read the lines from the photo.» — actually
 * arrives, and `code` is the name a surface may branch on. */

/* ── A REFUSAL IS AN ANSWER, AND IT HAS A NAME (E195.21) ────────────────────────────────────
 * The runtime «refuses, by name, on any fact it does not have»: `{"error":{"code":"…","message":
 * "…"}}` beside the status. A client that reduced that to «Runtime · 503 on /api/calls» would
 * throw the name away and hand a person a status code to act on. So the code and the runtime's own
 * sentence travel with the error, and the surfaces state the boundary they name. */
export class RuntimeRefused extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly said: string,
    public readonly path: string,
  ) { super(said || `Runtime · ${status} on ${path}`); }
}

const refusalOf = async (response: Response, path: string): Promise<RuntimeRefused> => {
  let code = '';
  let said = '';
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    code = String(body?.error?.code ?? '');
    said = String(body?.error?.message ?? '');
  } catch { /* a refusal without a body is still a refusal, and the status is what it said */ }
  return new RuntimeRefused(response.status, code, said, path);
};

export function runtimeBase(): string {
  if (typeof window === 'undefined') return '';
  // `make dev` owns this runtime. It wins over an old manual pin so one worktree cannot silently
  // call the runtime selected in another task. Published builds receive an empty constant.
  const configured = typeof __RUNTIME_BASE__ === 'string' ? __RUNTIME_BASE__.trim() : '';
  if (configured) return configured.replace(/\/$/, '');
  try {
    const pinned = window.localStorage.getItem('rocoto-runtime-base');
    if (pinned) return pinned.replace(/\/$/, '');
  } catch { /* storage may be unavailable — same-origin is the answer */ }
  return '';
}

/** A LOCAL BUILD WITH NO PINNED RUNTIME HAS NO RUNTIME. A kit served from localhost or 127.0.0.1
 *  (a drive's static server, a developer's preview) would otherwise ask its own origin for /api
 *  and log a 404 on every boot — noise every «no browser errors» gate rightly refuses. So without
 *  a pinned base the local origin is answered as unreachable at once, no request made; the
 *  deployed kit (kit.soyrocoto.com) and any pinned base still fetch. */
function localWithoutRuntime(base: string): boolean {
  if (base || typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const base = runtimeBase();
  if (localWithoutRuntime(base)) throw new RuntimeUnreachable(window.location.origin);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers: { Accept: 'application/json', ...(init?.headers ?? {}) } });
  } catch (cause) {
    throw new RuntimeUnreachable(base || window.location.origin, cause);
  }
  if (!response.ok) throw await refusalOf(response, path);
  return (await response.json()) as T;
}

export const runtime = {
  health: () => call<RuntimeHealth>('/api/health'),
  /** §RUN-03 — the Twilio ACCOUNT's own answer, because presence is not reachability */
  twilioAccount: () => call<{ twilio: TwilioAccount }>('/api/health/twilio'),
  /** §196.5 — tabular source documents go through Parsewise; `kind` selects the standard format */
  parse: (file: Blob, kind: 'albaran' | 'catalogue' | 'stock' = 'albaran') => {
    const body = new FormData(); body.append('file', file); body.append('kind', kind);
    return call<ParseResult>('/api/parse', { method: 'POST', body });
  },
  /** §196.6 — number → Google Places identity, the Hermes lookup that «was working flawlessly» */
  identity: (number: string) => call<Identity>(`/api/identity?number=${encodeURIComponent(number)}`),
  /** §247.1 · the address search follows the Peru/Spain toggle, never a separate setting */
  addressSuggestions: (query: string, sessionToken: string, signal?: AbortSignal, country: AddressCountry = 'PE') => call<AddressSuggestions>('/api/address-suggestions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, sessionToken, country }), signal,
  }),
  /** §196.6 · §196.7 — audio → Deepgram nova-3, Spanish, diarised */
  transcribe: (audio: Blob, language: 'es' = 'es') => {
    const body = new FormData(); body.append('audio', audio); body.append('language', language);
    return call<Transcript>('/api/transcribe', { method: 'POST', body });
  },
  /** §196.2 · E198 — the Copilot's own mind. The desk's context in, a reply and proposals out. */
  copilot: {
    ask: (payload: CopilotAsk) => call<CopilotAnswer>('/api/copilot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  },
  /** §196.6 — the calls the runtime has custody of, by counterpart number */
  calls: (number: string) => call<CallObject[]>(`/api/calls?number=${encodeURIComponent(number)}`),
  /** §196.6 — place an outbound call through Twilio to the number, from the house's number */
  dial: (to: string) => call<{ sid: string }>('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to }) }),
  /** §199.1 — OUR paper: the layout the print recorded, and the photograph read against it */
  paper: {
    /** the print's own record of where it put everything, kept by token */
    manifest: (manifest: PaperManifest) => call<PaperManifestReceipt>('/api/paper/manifest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manifest),
    }),
    /** the manifest a token names, as the runtime holds it */
    manifestOf: (token: string) => call<PaperManifest>(`/api/paper/manifest/${encodeURIComponent(token)}`),
    /** a photograph of the paper, registered onto its manifest and read cell by cell */
    read: (file: Blob) => {
      const body = new FormData(); body.append('file', file);
      return call<PaperRead>('/api/paper/read', { method: 'POST', body });
    },
  },
};
