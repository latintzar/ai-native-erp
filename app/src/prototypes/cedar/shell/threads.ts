/* THE THREADS — one conversation per customer, folded out of the sales they are about.
 *
 * ═══ WHY THE CHATS ARE NOT A SECOND STORE (THE-APP-V2 §5.1) ════════════════════════════════
 * A sale already carries its thread: the customer's words, Rocoto's reading, the desk's answers,
 * the complaint when there is one. Chats is therefore not new data — it is the SAME rows read by
 * customer instead of by document. So this file folds `buildSales()` by customer and adds the two
 * things a chat surface owns and a sale does not: what the person has written from the chat side,
 * and which threads they have read.
 *
 * That is the additive extension the founder asked for — «so they can see the comms and see all
 * the shit they're managing» — with no chance of the order surface and the chat surface quoting
 * two different conversations.
 *
 * NO PROVIDER, the same decision as `rules.ts` and `open-items.tsx`: a module singleton through
 * `useSyncExternalStore`, so the sidebar, the tab and a message embedded in an albarán all read
 * one store and all re-render on one write.
 *
 * THE SECTOR IS A DIFFERENT HOUSE. Switching the cast in Settings hands the app another catalogue
 * with other customers, so the written rows and the read marks start again — the same rule the
 * day store keeps.
 */
import * as React from 'react';
import type { Utterance } from '../../../rocoto/transcript';
import type { SectorId } from '../../../scenarios/meta';
import type { Cast, Customer } from '../../../scenarios/data/cast';
import { clockAfter, useDay } from '../day';
import { useGrants } from '../grants';
import { buildSales, baseDate, dayLabelOf, isMessageOnly, isSourceMessage, isStanding, RANK, todayId, type Sale, type ThreadRow } from '../sale';
import { wordsOf } from '../search';
import { relativeTradeText } from '../scenario-clock';
/* ── THE TEST CHAT'S TYPES ONLY, AND THE REASON THAT MATTERS ─────────────────────────────────
 * `import type` is erased at build, so this file takes NOTHING from `test-chat.tsx` at runtime.
 * That is deliberate rather than tidy: `test-chat.tsx` renders the emulated phone, which mounts
 * `shell/media`, which imports this file — a runtime import in this direction would close that
 * ring and leave a `const` in the temporal dead zone on whichever module loaded first. So the
 * conversation's own facts (the emulated customer, the label) are RESOLVED BY THE CALLER and
 * stored, and this file never calls into the capability it holds the rows for. */
import type { TestMark, TestReading, TestSubject } from '../test-chat';
import { embedsOf, type Embed, type OrderAct } from './embeds';
import { theatreScenesOf, theatreThreadOf } from './theatre';

/* ── THE OBJECT ───────────────────────────────────────────────────────────────────────────── */

/* ── A TURN CAN CARRY A WORK OBJECT (musing 5) ────────────────────────────────────────────────
 * An embed is not a second kind of message and it is not a second store: it is the app's own
 * rendering of an act the thread ALREADY holds — the reading, the document, the price that went
 * out, the flag that stopped one. So a turn grows one optional field and everything else derives.
 *
 * TWO SHAPES, ONE FIELD. Most embeds RIDE a sentence: the row says «Read from WhatsApp as 4 lines
 * for Friday» and the card under it draws those lines. The two that have no sentence of their own
 * — the document, and the reasoning that is still standing — arrive as turns with no text, and the
 * view draws the card alone. `embedsOf` in `embeds.tsx` decides which is which.
 */
/* A TURN ALSO KNOWS WHICH DAY IT BELONGS TO (FEED-IA §40.3) ──────────────────────────────────
 * «Date whispers between groups.» The ledger stamps an HOUR on every row and nothing else, so the
 * only date a conversation carries is the day the ORDER a run of turns is about is for — and that
 * is what the whisper says. It is a label folded at read time, not a second field in the store:
 * the sale already knows its day, and the turns it contributed inherit it.
 */
/* ── WHAT CHANNEL A TURN STOOD ON (FEED-IA §246 acceptance 5) ────────────────────────────────
 * The per-turn channel law lives in `reply-channel.ts`, which is the file that owns «which
 * channel» for the whole app — pure, and loadable by a tool test without React. It is re-exported
 * here because a conversation surface reads turns through this module and a second copy of the
 * rule would be a second answer to one question.
 */
export {
  accountChannelOf, channelOfTurn, isCallTurn,
  type AccountChannel, type ChannelTurn, type TurnChannel,
} from '../reply-channel';

/* ── WHAT ELSE A TURN CAN CARRY (FEED-IA §46.2, §47) ──────────────────────────────────────────
 * «The chat is super-Intercom… and then past them where we are stronger: VOICE-NOTE handling and
 * TRANSCRIPT handling at our fidelity.» And «customers get in on WhatsApp, so all of that
 * behaviour has to still be there» — a quote, a reaction, a photo.
 *
 * FOUR OPTIONAL FIELDS, NO SECOND STORE. Each one is a fact the conversation already contains: the
 * sound that arrived instead of typing, the picture that arrived instead of a sentence, the message
 * a turn is answering, and what somebody pressed on it. They hang on the turn for the same reason
 * `embed` does — one fold, one set of rows, one thing to render.
 */

/** THE SOUND A TURN CARRIED. `transcript` is `null` while the machine is still writing it, which
 *  is a real state the surface says out loud rather than a blank it hides. */
export type VoiceNote = {
  durationMs: number;
  /** the deterministic field the Waveform draws — same seed, same bars, on every render */
  seed: string;
  transcript: Utterance[] | null;
};

/** THE PICTURE A TURN CARRIED, and what it says. `reading` is the same grammar as a voice note's
 *  transcript: the words that are IN the photo, which is what makes a photo findable by search. */
export type Picture = {
  src: string;
  alt: string;
  /** width ÷ height, given rather than measured, so the thread never jumps when the bytes land */
  aspectRatio: number;
  reading: Utterance[] | null;
};

/** THE MESSAGE A TURN IS ANSWERING (§47.1). It holds the ORIGINAL'S ID, never a copy of it: the
 *  card prints a line of it and tapping the card walks to the message itself. */
export type Quote = {
  /** the turn it answers — the anchor the jump lands on */
  id: string;
  /** whose words those are, said the way the card says it */
  who: string;
  /** the first line of what was said, for the card */
  line: string;
};

/** WHAT SOMEBODY PRESSED ON A TURN (§47.2). Aggregated: one chip per emoji, with its count. */
export type Reaction = { emoji: string; count: number; mine: boolean };

/** THE SET A PERSON CAN PRESS. Closed, and short — WhatsApp's own row. */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏'] as const;

export type ThreadTurn = ThreadRow & {
  embed?: Embed;
  day?: string;
  voice?: VoiceNote;
  picture?: Picture;
  quote?: Quote;
  reactions?: Reaction[];
  /** WHAT THIS MESSAGE DID TO THE ORDER (FEED-IA §77.5b). Folded in `embeds.tsx` off facts the
   *  ledger already holds; a message that moved nothing carries nothing, and that silence is the
   *  law — an act line exists only where there is an act to show. */
  act?: OrderAct;
  /** Internal controller progress, shown as a compact tool trail rather than an outgoing message. */
  internal?: string;
};

/* ── THE WORDS OF A RECORDING, AND WHERE THEY COME FROM ───────────────────────────────────────
 * On the product these come from Deepgram, diarized, with real timings. On THIS surface the take
 * is `simulate`d — the Voice Button's own shipped prop — so the words come from the turn's own
 * sentence and the timings from a stated speaking rate. Nothing is invented: the transcript of a
 * message says exactly what that message says, split where the speaker stopped.
 *
 * WHY THE SPLIT IS AT SENTENCES. A person ordering fish stops between things: «12 kg merluza.»
 * «Nothing under a kilo.» That is what diarization gives back, and it is what makes a transcript
 * seekable — one target per thing said, rather than one target for the whole minute.
 */

/** words a minute, ordinary speech — the rate the design surface times a take at */
const SPEECH_WPM = 150;

/* HOW LONG A RUN GETS BEFORE THE SPEAKER BREATHES, and how short one may be before it is part of
 * the run before it. Both are read off the cast's OWN recorded utterances (`cast.order.utterances`
 * — «Morning. For tomorrow: 12 kg merluza,» / «3 kg gamba roja, and a caja of pulpo.»): a person
 * listing goods stops at the commas, not only at the full stops. */
const MAX_RUN = 9;
const MIN_RUN = 3;

const ENDS = new Set(['.', '!', '?', '…']);

const secondsOf = (words: number): number => Math.max(1, (words / SPEECH_WPM) * 60);

const countWords = (s: string): number => s.split(/\s+/).filter(Boolean).length;

/* ── WHERE A SENTENCE REALLY ENDS ─────────────────────────────────────────────────────────────
 * A full stop is only the end of something said when a SPACE follows it. Splitting on every stop
 * cut «For Thursday 21.08: 1.5 kg Gamba» into «For Thursday 21.» · «08: 1.» · «5 kg Gamba» — the
 * dates and the decimals of the trade, torn in half, in a record a person is meant to trust.
 */
function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (!ENDS.has(text[i])) continue;
    const next = text[i + 1];
    if (next && next !== ' ' && next !== '\n') continue;
    out.push(text.slice(start, i + 1).trim());
    start = i + 1;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** A long run, broken where the speaker takes a breath — at the commas, the way the cast's own
 *  recorded utterances break. Short runs are left whole. */
function breathe(sentence: string): string[] {
  if (countWords(sentence) <= MAX_RUN) return [sentence];
  /* split AFTER the comma, keeping it — the comma is part of what was said, and a lookbehind is
     the one regex feature this file will not depend on for it */
  const pieces: string[] = [];
  let at = 0;
  for (let i = 0; i < sentence.length; i += 1) {
    if (sentence[i] !== ',' || sentence[i + 1] !== ' ') continue;
    pieces.push(sentence.slice(at, i + 1).trim());
    at = i + 1;
  }
  pieces.push(sentence.slice(at).trim());
  const out: string[] = [];
  for (const piece of pieces.filter(Boolean)) {
    const held = out[out.length - 1];
    if (held && countWords(held) < MIN_RUN) out[out.length - 1] = `${held} ${piece}`;
    else out.push(piece);
  }
  return out;
}

/** One message's words, as the runs a machine would set down. */
export function utterancesOf(text: string, speaker: string): Utterance[] {
  const parts = sentencesOf(text).flatMap(breathe);
  const out: Utterance[] = [];
  let at = 0;
  parts.forEach((part, i) => {
    const words = part.split(/\s+/).filter(Boolean);
    const span = secondsOf(words.length);
    out.push({ id: `u${i}`, speaker, start: Math.round(at * 10) / 10, end: Math.round((at + span) * 10) / 10, words });
    at += span;
  });
  return out;
}

/** How long a recording of those runs lasts, in ms — the figure the bubble prints. */
export const lengthOf = (utterances: Utterance[]): number =>
  Math.round((utterances[utterances.length - 1]?.end ?? 0) * 1000);

/** The first line of a transcript — what a collapsed bubble and a list preview quote. */
export const firstLine = (utterances: Utterance[] | null | undefined): string =>
  utterances && utterances.length > 0 ? utterances[0].words.filter(Boolean).join(' ') : '';

/** Every word a transcript holds, flat — for the search index and for nothing else. */
export const spokenWords = (utterances: Utterance[] | null | undefined): string =>
  utterances ? utterances.map((u) => u.words.filter(Boolean).join(' ')).join(' ') : '';

/** What a turn READS AS in a list, a preview or a search: its own sentence, or the words its
 *  recording or its photo carried. A voice note whose transcript has yet to land says its length,
 *  because that is the only honest thing known about it. */
export function turnWords(turn: ThreadTurn): string {
  if (turn.text) return turn.text;
  if (turn.voice) return turn.voice.transcript ? spokenWords(turn.voice.transcript) : `Voice note · ${clock(turn.voice.durationMs)}`;
  if (turn.picture) return turn.picture.reading ? spokenWords(turn.picture.reading) : turn.picture.alt;
  return '';
}

/** m:ss — a length inside a recording, never a time of day. */
export const clock = (ms: number): string => {
  const whole = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export type Thread = {
  /** the customer's id — a conversation is with a customer, not with a document */
  id: string;
  customer: Customer;
  /** every turn, oldest first */
  rows: ThreadTurn[];
  /** the row the list quotes — the last thing SAID, never a card. A TURN rather than a bare row,
   *  because what was last said may have been a recording or a photograph (§46.2, §47.3) and the
   *  preview has to be able to ask it which. */
  last?: ThreadTurn;
  /** the newest work object in the conversation, for the one-line collapse the list draws */
  embed?: Embed;
  /** the hour of the last turn */
  at?: string;
  /** the last word came from them and the person has yet to open it */
  unread: boolean;
  /** a sale in this conversation is waiting on the person for words (FEED-IA §9.3 — the same
   *  flag the card carries, said on this door too) */
  waiting: boolean;
  /** the sales this conversation is about, newest first */
  saleIds: string[];
  /* ── THE ORDERS THIS CONVERSATION IS CARRYING (FEED-IA §77.5) ────────────────────────────────
   * «The actual content overlay should always be above the composer… it should handle multiple
   * scheduled orders etc.» So the conversation has to be able to hand a surface the ORDERS
   * themselves rather than their ids: the overlay names them, prints their figures and opens them.
   *
   * WHICH ONES. Every order in this conversation that has yet to leave the house — being formed,
   * or formed and scheduled to go out. From SENT onwards the document is the customer's and the
   * conversation is about something that has already happened; a pinned overlay is for what is
   * still moving.
   *
   * SOONEST FIRST, which is the order a person acts in: today's before Friday's. */
  forming: Sale[];
  /** Reply-only customer questions remain in Chat but never become an order card. */
  messageOnly: Sale[];
  /* ── THE SEARCH INDEX, FOLDED ONCE, HERE (FEED-IA §46.2) ────────────────────────────────────
   * «The message's words searchable like any text.» A voice note carries no text — the wire
   * carried sound — so a search that reads `last.text` cannot find what was SAID in one, and a
   * photo of a written order is invisible to it too. The index therefore holds the customer's
   * name, every sentence in the conversation, every TRANSCRIBED word, and every word read off a
   * photo — folded once per conversation rather than on every keystroke of a 295-row list. */
  words: string[];
  /* ── AND A CONVERSATION MAY BE A TEST (THE CHECKPOINT §10.6, §10.7) ──────────────────────────
   * «Clearly label the thread: TEST · Emulating Restaurante X.» And, in the coding-agent
   * instruction: «Keep test conversations isolated from live external messaging and clearly
   * labeled as test data.»
   *
   * ONE OPTIONAL FIELD CARRIES BOTH HALVES. Its PRESENCE is the isolation predicate — every
   * counter in this file and every narrow in the list reads `t.test` and nothing else — and what
   * it holds is what the surface draws: the label, who is being emulated, and the readings the
   * conversation has collected. A real conversation carries no such field, so the readers that
   * COUNT ask for its absence and the readers that DRAW ask for its presence.
   */
  test?: ThreadTest;
};

/** What a test conversation is, as the list row and the conversation both read it. */
export type ThreadTest = {
  /** «TEST · Emulating Bar Manolo» / «TEST · New customer» — §10.6, verbatim */
  label: string;
  subject: TestSubject;
  /** every reading the conversation has taken, oldest first */
  readings: TestReading[];
  /** what the operator said about each one, by the row it is about */
  marks: Record<string, TestMark>;
};

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────── */

/** A turn the person made from the chat side: a sentence, or a take, and whatever it answers. */
export type WrittenTurn = ThreadRow & { voice?: VoiceNote; quote?: Quote };

/* ── THE TEST CONVERSATIONS (THE CHECKPOINT §10) ───────────────────────────────────────────────
 * A test chat is a SECOND KIND OF ROW IN THIS STORE and deliberately not a second store: the same
 * singleton, the same publish, the same cast-switch rule, so a test conversation cannot outlive
 * the house it was run against and no surface has to subscribe to anything new.
 *
 * WHAT IT HOLDS, AND WHY IT HOLDS THE READING. Everything else in this file is folded at read time,
 * because a fold cannot disagree with the ledger it reads. A test reading is the opposite case: it
 * is a RECORD OF A DECISION taken at an hour, and re-deriving it later — against a catalogue
 * somebody has since taught, or a ceiling somebody has since raised — would quietly rewrite what
 * the operator was looking at when they marked it correct. So the reading is computed once, by
 * `readTestMessage`, and kept beside the message that caused it.
 *
 * AND IT TOUCHES NOTHING ELSE. No test row is ever written through `sale.ts`'s event log, so
 * `buildSales` cannot see one, so the river, the day's counts, the export centre and the badge
 * cannot either. §10.7's isolation is structural here rather than a filter anybody maintains.
 */

/** One turn in a test conversation. The same turn a real conversation carries — the media organs
 *  are the chat's own, lifted rather than re-drawn (§10.8a). */
export type TestTurn = ThreadRow & { voice?: VoiceNote; picture?: Picture };

export type TestChat = {
  /** `test:1`, `test:2` … — the id the focus store and the list row key on */
  id: string;
  subject: TestSubject;
  /** the account being emulated, resolved once at the start (see the import note above) */
  customer: Customer;
  /** §10.6's label, computed once at the start so every surface prints one string */
  label: string;
  /** the hour it was started */
  at: string;
  rows: TestTurn[];
  /** the reading each of the operator's messages produced, by that message's row id */
  readings: Record<string, TestReading>;
  /** Correct / Needs correction, by the same key (§10.11) */
  marks: Record<string, TestMark>;
};

type ChatState = {
  /** the cast these belong to */
  sector: SectorId | null;
  /** what the person wrote from the chat side, per customer */
  written: Record<string, WrittenTurn[]>;
  /** Draft text follows its conversation between the embedded order excerpt and the workspace. */
  drafts: Record<string, string>;
  /** customers whose thread has been opened since it last changed */
  read: string[];
  /** the thread showing — in the desk's sidebar, in the tab, or full screen on a phone */
  focus: string | null;
  /** what the person has pressed on a turn, per turn id (§47.2) */
  reacted: Record<string, string[]>;
  /** the test conversations, newest first */
  tests: TestChat[];
};

const BLANK: ChatState = { sector: null, written: {}, drafts: {}, read: [], focus: null, reacted: {}, tests: [] };

let state: ChatState = BLANK;

const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const snapshot = (): ChatState => state;

function publish(next: ChatState): void {
  state = next;
  for (const fn of listeners) fn();
}

/** The cast changed, so the conversation did. */
function forSector(sector: SectorId): ChatState {
  return state.sector === sector ? state : { ...BLANK, sector };
}

/** Write into a thread. The hour comes from `replyHour`, never raw from the surface — see below
 *  for the reason the difference matters. A reply carries what it is answering (§47.1). */
export function sendToThread(sector: SectorId, id: string, text: string, at: string, quote?: Quote, context?: Pick<ThreadRow, 'orderId' | 'email'> & { id?: string }): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const base = forSector(sector);
  const mine = base.written[id] ?? [];
  if (context?.id && mine.some(row => row.id === context.id)) return;
  publish({
    ...base,
    written: {
      ...base.written,
      [id]: [...mine, { id: `w${mine.length}`, author: 'sent', text: trimmed, time: at, quote, ...context }],
    },
    read: base.read.includes(id) ? base.read : [...base.read, id],
  });
}

/* ── A TAKE LANDS AS A MESSAGE (FEED-IA §46.2) ────────────────────────────────────────────────
 * «Sending a voice note from the composer lands one in the thread.» The Voice Button already
 * hands back a `Take`; what was missing was the other half — the take becoming a TURN, with the
 * length it really ran for, the field the bubble draws, and the machine's own honest interval
 * before the words are there.
 *
 * THE «TRANSCRIBING…» IS A REAL STATE, AND IT IS BRIEF. The row lands with `transcript: null`,
 * the bubble says the machine is working, and the words replace that the moment they are set
 * down. Nothing is faked in between: an empty transcript reads as empty, never as silence.
 */

/** how long the machine takes to set a take's words down, on this surface. Exported because the
 *  test chat's own take lands through the same interval and a second number would be a second
 *  answer to one question. */
export const TRANSCRIBING_MS = 900;

/** A take from the composer, as a turn. The transcript follows on its own. */
export function sendVoiceToThread(
  sector: SectorId,
  id: string,
  at: string,
  take: { durationMs: number; words: string },
  orderId?: string,
): void {
  const base = forSector(sector);
  const mine = base.written[id] ?? [];
  const turnId = `w${mine.length}`;
  const heard = utterancesOf(take.words, 'You');
  publish({
    ...base,
    written: {
      ...base.written,
      [id]: [
        ...mine,
        {
          id: turnId,
          author: 'sent',
          text: '',
          time: at,
          voice: { durationMs: take.durationMs, seed: `${sector}-${id}-${turnId}`, transcript: null },
          orderId,
        },
      ],
    },
    read: base.read.includes(id) ? base.read : [...base.read, id],
  });
  window.setTimeout(() => {
    const now = state;
    const rows = now.written[id];
    if (!rows) return;
    publish({
      ...now,
      written: {
        ...now.written,
        [id]: rows.map((r) =>
          r.id === turnId && r.voice ? { ...r, voice: { ...r.voice, transcript: heard } } : r,
        ),
      },
    });
  }, TRANSCRIBING_MS);
}

/* ── A REACTION IS A PRESS, AND PRESSING IT AGAIN TAKES IT BACK (§47.2) ───────────────────────
 * Keyed by the TURN'S id, which is the sale's own row id — so a reaction survives the fold being
 * rebuilt on every edit to the day, exactly the way the read marks do.
 */
export function toggleReaction(sector: SectorId, turnId: string, emoji: string): void {
  const base = forSector(sector);
  const held = base.reacted[turnId] ?? [];
  const next = held.includes(emoji) ? held.filter((e) => e !== emoji) : [...held, emoji];
  publish({
    ...base,
    reacted: { ...base.reacted, [turnId]: next },
  });
}

/* ── THE HOUR A REPLY CARRIES, AND WHY THE LIST DEPENDS ON IT ────────────────────────────────
 * THE LIST SORTS ON THE HOUR IT PRINTS. One key, visible on every row, so the order a person
 * reads is the order they can check — and that is worth keeping, which is why the fix below is a
 * clock fix rather than a second, hidden sort key that would let the order and the printed hour
 * disagree.
 *
 * WHAT WAS BROKEN. `nowOf` names «the hour the app is standing in», derived from the last order's
 * arrival — 07:20 on the fish cast. The day it describes runs on past that: a complaint at 16:25,
 * a settlement at 16:40. So a reply took 07:20, landed EARLIER than the message it was answering,
 * and the list did the only thing it could with that hour — it pushed the conversation the person
 * had just written to DOWN, past every conversation they had left alone. Writing to the last row
 * left it exactly where it was; writing to the second row sent it to the bottom.
 *
 * THE RULE. A reply is the newest thing anybody has said, so it takes an hour that says so: the
 * app's own hour when that is already the latest, and otherwise a minute past the latest turn the
 * conversations hold. The thread then reads forward, the list's newest row really is newest, and
 * the hour printed on it agrees with where it stands.
 */

const HOUR = /^(\d{1,2}):(\d{2})$/;

const minutesOf = (hour: string | undefined): number => {
  const m = hour ? HOUR.exec(hour) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};

/** The hour a reply written now should carry, given every conversation on the surface. */
export function replyHour(threads: Thread[], now: string): string {
  let latest = -1;
  for (const thread of threads) {
    for (const row of thread.rows) {
      const at = minutesOf(row.time);
      if (at > latest) latest = at;
    }
  }
  const here = minutesOf(now);
  return here > latest ? now : clockAfter(now, latest + 1 - here);
}

/** They have seen it. */
export function markThreadRead(sector: SectorId, id: string): void {
  const base = forSector(sector);
  if (base.read.includes(id)) {
    if (base !== state) publish(base);
    return;
  }
  publish({ ...base, read: [...base.read, id] });
}

/* ── THE DOORS THAT OPEN A CONVERSATION (FEED-IA §202.3 · THE-OUTPUTS-SPEC OUT-05) ───────────
 * Peter, 2026-09-05: «"open chat" for whatsapp should be opening the chat popup, and open email
 * as well. we become their chat and email client.»
 *
 * ONE MECHANISM, THREE NAMES. `focusThread` is the mechanism and it stays exactly what it was:
 * publish the focus, mark it read, ask the panel to come back. `openChat` and `openEmail` are the
 * two doors a caller names, and each carries one more fact the panel can act on — WHICH ORDER the
 * caller is standing in, and WHICH CHANNEL it wants read. Both facts ride in the event's detail,
 * because the panel is the only thing that can answer them and it is already listening.
 *
 * ⚠ AN OPENER TAKES A CUSTOMER, NEVER A URL. The thread is drawn from the rows the house is
 * authorized to hold; there is no provider address anywhere in this file, and that is the whole
 * of «we are their client» stated as code.
 */

/** What a door asked the chat panel for. `order` scopes the panel to one albarán's exchange;
 *  `channel: 'email'` opens the conversation as mail; `sourceRef` is the authorized reference the
 *  mail was drawn from, carried so the panel can aim at that message. */
export type ThreadOpening = {
  sector: SectorId;
  id: string | null;
  order?: string;
  channel?: 'email';
  sourceRef?: string;
};

/** Show a thread — in the sidebar on the desk, full screen on a phone. `null` goes back to the
 *  list. Focusing a thread reads it, because looking at it is reading it. */
export function focusThread(sector: SectorId, id: string | null): void {
  openThread({ sector, id });
}

/** Open the chat panel on this conversation. `order` scopes the panel to one albarán's exchange
 *  where the caller has one; the panel opens on the whole conversation without it. */
export function openChat(sector: SectorId, customer: string, order?: string): void {
  openThread({ sector, id: customer, order });
}

/** Open the email thread inside the app. `sourceRef` is the authorized source reference the
 *  runtime issued; the thread is rendered from it and never navigated to by a provider URL. A
 *  caller holding no reference passes the empty string, which means «this conversation's own
 *  mail» — the panel then opens the thread and aims at nothing in particular. */
export function openEmail(sector: SectorId, customer: string, sourceRef: string, order?: string): void {
  openThread({ sector, id: customer, order, channel: 'email', sourceRef });
}

/* ── AND ON A PHONE THE CONVERSATION IS THE SCREEN (§202.3 · OUT-05.2) ───────────────────────
 * A door is only open if a person can SEE through it. On a phone the panel is the whole screen —
 * and so is the albarán's own pane, fixed at `LAYER + 1` = 13 (`detail.tsx`). Both are «the
 * screen», so stacking them by rung decides nothing an author intended: pressing «Open the chat»
 * on an albarán opened the conversation UNDER it, the person saw the albarán unchanged, and every
 * assertion about the panel — visible, focused, standing on the right order — stayed green
 * underneath. MEASURED at 390: the panel fixed at 0,0,390×844, opacity 1, and the browser handing
 * `elementFromPoint` at its own centre back a product line of the pane in front of it.
 *
 * SO THE PANEL SAYS WHEN IT IS THE SCREEN AND THE WORK STEPS BACK. The pane keeps its state and
 * its scroll — it is hidden, never unmounted — and it is standing again the moment the
 * conversation is closed, which is what a person who opened a chat FROM an albarán expects to
 * come back to. A rung would have been the other answer, and the wrong one: above 13 the panel
 * would also cover the menus Base opens from inside it (12).
 */
let chatIsScreen = false;
const screenWatchers = new Set<() => void>();

/** THE PANEL'S OWN WORD. `ChatsOverlay` is the only caller — nothing else can know. */
export function setChatIsScreen(standing: boolean): void {
  if (standing === chatIsScreen) return;
  chatIsScreen = standing;
  for (const watcher of [...screenWatchers]) watcher();
}

/** True while a full-screen conversation is standing, so the work behind it can step back. */
export function useChatIsScreen(): boolean {
  return React.useSyncExternalStore(
    (watcher: () => void) => { screenWatchers.add(watcher); return () => { screenWatchers.delete(watcher); }; },
    () => chatIsScreen,
    () => false,
  );
}

function openThread(opening: ThreadOpening): void {
  const { sector, id } = opening;
  const base = forSector(sector);
  publish({
    ...base,
    focus: id,
    read: id && !base.read.includes(id) ? [...base.read, id] : base.read,
  });
  // A minimized workspace deliberately keeps its selected thread. Emit a request for every
  // focus, including the same id, so an order source can reopen that exact conversation.
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rocoto:focus-thread', { detail: opening }));
}

/* ── THE TEST CHAT'S OWN WRITERS (THE CHECKPOINT §10) ────────────────────────────────────────
 * Four acts and no more: start one, land a message in it, mark a reading correct, correct a field.
 * Every one of them writes only into `tests`, which is the whole of §10.7's isolation stated as
 * code — there is no path from this block to the sale ledger, and adding one would be visible.
 */

/** The prefix a test conversation's id carries, so a test is told from a customer by its id alone
 *  — no flag to look up, and nothing downstream has to branch on where a thread came from. */
export const TEST_PREFIX = 'test:';

export const isTestThread = (id: string | null | undefined): boolean =>
  Boolean(id && id.startsWith(TEST_PREFIX));

/** START ONE (§10.3's «Start test as [Customer]», and the new-customer path beside it). It opens
 *  focused, because a person who chose who to test as has already asked for the conversation. */
export function startTestChat(
  sector: SectorId,
  subject: TestSubject,
  customer: Customer,
  label: string,
  at: string,
): string {
  const base = forSector(sector);
  const id = `${TEST_PREFIX}${base.tests.length + 1}`;
  publish({
    ...base,
    tests: [
      { id, subject, customer, label, at, rows: [], readings: {}, marks: {} },
      ...base.tests,
    ],
    focus: id,
  });
  return id;
}

/** THE OPERATOR'S MESSAGE, AND WHAT ROCOTO MADE OF IT. The message arrives as `received` because
 *  in a test chat the operator is typing AS THE CUSTOMER — «the chat then behaves as if messages
 *  are arriving from that customer» (§10.3). Rocoto's answer follows as its own turn. */
export function pushTestTurn(
  sector: SectorId,
  id: string,
  said: TestTurn,
  /** what Rocoto answered — EMPTY on an abstention, and that silence is the behaviour (§9) */
  replies: TestTurn[],
  reading: TestReading,
): void {
  const base = forSector(sector);
  publish({
    ...base,
    tests: base.tests.map((t) =>
      t.id === id
        ? {
            ...t,
            rows: [...t.rows, said, ...replies],
            readings: { ...t.readings, [said.id]: reading },
          }
        : t),
  });
}

/** THE HOUSE'S OWN TURN (FEED-IA §91.4.8, and the .com demo's `deskComposer`). On the house's side
 *  of the roleplay the person at the desk speaks AS THE HOUSE, so their words are a message and
 *  not an order: no brain runs, no reading is taken, and the panel has nothing to say about it. */
export function pushTestDeskTurn(sector: SectorId, id: string, said: TestTurn): void {
  const base = forSector(sector);
  publish({
    ...base,
    tests: base.tests.map((t) => (t.id === id ? { ...t, rows: [...t.rows, said] } : t)),
  });
}

/** A TAKE LANDS BEFORE ITS WORDS DO, exactly as it does in a real conversation: the row arrives
 *  with `transcript: null`, the bubble says the machine is working, and Rocoto reads it the moment
 *  the words are there. Nothing is faked in between. */
export function pushTestVoice(sector: SectorId, id: string, said: TestTurn): void {
  const base = forSector(sector);
  publish({
    ...base,
    tests: base.tests.map((t) => (t.id === id ? { ...t, rows: [...t.rows, said] } : t)),
  });
}

/** The take's words landed: the row grows its transcript and Rocoto's reading arrives with it. */
export function landTestVoice(
  sector: SectorId,
  id: string,
  rowId: string,
  transcript: Utterance[],
  replies: TestTurn[],
  reading: TestReading,
): void {
  const base = forSector(sector);
  publish({
    ...base,
    tests: base.tests.map((t) =>
      t.id === id
        ? {
            ...t,
            rows: [
              ...t.rows.map((r) => (r.id === rowId && r.voice ? { ...r, voice: { ...r.voice, transcript } } : r)),
              ...replies,
            ],
            readings: { ...t.readings, [rowId]: reading },
          }
        : t),
  });
}

/** CORRECT / NEEDS CORRECTION (§10.11). The mark carries `test: true` by construction — the type
 *  admits no unmarked row — so what reaches the learning seam says what it is. */
export function markTestReading(sector: SectorId, id: string, rowId: string, mark: TestMark): void {
  const base = forSector(sector);
  publish({
    ...base,
    tests: base.tests.map((t) => (t.id === id ? { ...t, marks: { ...t.marks, [rowId]: mark } } : t)),
  });
}

/** Every mark the house's test chats have collected, for a learning surface that wants to read
 *  them. It is exported so the seam is a function rather than a reach into module state, and every
 *  row it hands back is flagged. */
export const testMarksNow = (): Array<{ thread: string; row: string; mark: TestMark }> =>
  state.tests.flatMap((t) =>
    Object.entries(t.marks).map(([row, mark]) => ({ thread: t.id, row, mark })));

/* ── THE HOOKS ────────────────────────────────────────────────────────────────────────────── */

function useChatState(sector: SectorId): ChatState {
  const s = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  /* the cast switch is a write, and it happens on the first read after it — so a surface that
     mounts under a new cast never sees the last one's rows */
  React.useEffect(() => {
    if (state.sector !== sector) publish({ ...BLANK, sector });
  }, [sector]);
  return React.useMemo(() => (s.sector === sector ? s : { ...BLANK, sector }), [s, sector]);
}

/** A chat draft belongs to its conversation, so a person can expand an embedded order conversation without losing the words already in its composer. */
export function useThreadDraft(cast: Cast, id: string): [string, (next: string) => void] {
  const chat = useChatState(cast.sector);
  const write = React.useCallback((next: string) => {
    const base = forSector(cast.sector);
    if ((base.drafts[id] ?? '') === next) return;
    publish({ ...base, drafts: { ...base.drafts, [id]: next } });
  }, [cast.sector, id]);
  return [chat.drafts[id] ?? '', write];
}

/* ── THE MEDIA THE DAY CARRIES (FEED-IA §46.2, §47.1–3) ───────────────────────────────────────
 * A house that takes its orders on WhatsApp gets voice notes, photographs of written orders and
 * photographs of labels, and its people quote and react to them. So the day has to CONTAIN those,
 * or the surface is designing against a conversation nobody has.
 *
 * WHAT IS SEEDED IS THE FORM, NEVER THE CONTENT. A seeded voice note carries the transcript of
 * the sentence that row already holds — the customer's own words, split where a speaker stops.
 * A seeded photograph carries a `reading` that states exactly the words drawn IN that asset. So
 * every word the surface claims to have heard or read is a word the repo already holds, and
 * nothing on this screen is a sentence invented to make a feature look finished.
 *
 * THE JOBS RUN TOP-DOWN, ONE SEAT EACH. The list is newest-first, so the media land where a
 * person opening the widget will actually meet them, and each job takes the first conversation
 * that fits it — which makes the seeding deterministic per cast without naming a customer.
 */

const NOTE_PHOTO = {
  src: '/notes/order-note.svg',
  alt: 'A written order on a notepad page',
  aspectRatio: 4 / 3,
  /* the words drawn in the asset, verbatim */
  reads: 'ORDER — Thursday. 6 cajas tomate rama. 2 kg gamba roja. 1 caja pulpo. Leave it at the back door.',
};

const LABEL_PHOTO = {
  src: '/notes/lot-label.svg',
  alt: 'A lot label photographed on the box',
  aspectRatio: 3 / 4,
  reads: 'LOT L-2208. MERLUZA · RUBIO. 21.08 · 3.200 kg. ORIGIN FAO 27.',
};

/** THE PHOTOGRAPHS THIS HOUSE ACTUALLY HAS, exported so the test composer can attach one (§10.8:
 *  «the operator can attach images»). They are the repo's own assets and their `reads` are the
 *  words drawn IN them, verbatim — so a photo attached in a test carries a real reading and the
 *  brain has something true to read, exactly as a seeded one does. */
export const CHAT_PHOTOS = [NOTE_PHOTO, LABEL_PHOTO];

/** One of them as a `Picture`, with the words it carries transcribed to the person who sent it. */
export const pictureOf = (asset: typeof NOTE_PHOTO, speaker: string): Picture => ({
  src: asset.src,
  alt: asset.alt,
  aspectRatio: asset.aspectRatio,
  reading: utterancesOf(relativeTradeText(asset.reads), speaker),
});

type Seat = {
  customer: Customer;
  rows: ThreadTurn[];
  saleIds: string[];
  /** the sales themselves, in the order they were folded — §77.5's overlay needs the objects */
  sales: Sale[];
  waiting: boolean;
};

const firstReceived = (rows: ThreadTurn[]): number => rows.findIndex((r) => r.author === 'received' && r.text);
const firstAi = (rows: ThreadTurn[]): number => rows.findIndex((r) => r.author === 'ai' && r.text);

/** the quote card's own line: the first thing that turn says, whatever carried it */
const quoteOf = (turn: ThreadTurn, who: string): Quote => ({ id: turn.id, who, line: turnWords(turn) });

type Job = { fits: (s: Seat) => boolean; apply: (s: Seat) => void };

function jobs(): Job[] {
  /** a sentence long enough that somebody would have said it rather than typed it */
  const speakable = (s: Seat): number => {
    const i = firstReceived(s.rows);
    return i >= 0 && s.rows[i].text.split(/\s+/).length >= 5 ? i : -1;
  };

  const asVoice = (s: Seat, extra: (s: Seat, at: number) => void): void => {
    const i = speakable(s);
    const row = s.rows[i];
    const heard = utterancesOf(row.text, s.customer.name);
    s.rows[i] = {
      ...row,
      text: '',
      voice: { durationMs: lengthOf(heard), seed: row.id, transcript: heard },
    };
    extra(s, i);
  };

  const photo = (s: Seat, asset: typeof NOTE_PHOTO, after: (s: Seat, turn: ThreadTurn) => void): void => {
    const i = firstReceived(s.rows);
    const row = s.rows[i];
    const turn: ThreadTurn = {
      id: `${row.id}-photo`,
      author: 'received',
      text: '',
      time: row.time,
      day: row.day,
      picture: {
        src: asset.src,
        alt: asset.alt,
        aspectRatio: asset.aspectRatio,
        reading: utterancesOf(asset.reads, s.customer.name),
      },
    };
    s.rows.splice(i, 0, turn);
    after(s, turn);
  };

  return [
    /* 1 · A CUSTOMER VOICE-ORDERING, and the desk pressing a thumb on Rocoto's reading of it. */
    {
      fits: (s) => speakable(s) >= 0 && firstAi(s.rows) >= 0,
      apply: (s) =>
        asVoice(s, (seat) => {
          const ai = firstAi(seat.rows);
          seat.rows[ai] = { ...seat.rows[ai], reactions: [{ emoji: '👍', count: 1, mine: false }] };
        }),
    },
    /* 2 · A SECOND ONE, with the reaction on the recording itself. */
    {
      fits: (s) => speakable(s) >= 0,
      apply: (s) =>
        asVoice(s, (seat, at) => {
          seat.rows[at] = { ...seat.rows[at], reactions: [{ emoji: '🙏', count: 1, mine: false }] };
        }),
    },
    /* 3 · A PHOTOGRAPH OF A WRITTEN ORDER, and Rocoto's reading quoting the photograph. */
    {
      fits: (s) => firstReceived(s.rows) >= 0 && firstAi(s.rows) >= 0,
      apply: (s) =>
        photo(s, NOTE_PHOTO, (seat, turn) => {
          const ai = firstAi(seat.rows);
          seat.rows[ai] = { ...seat.rows[ai], quote: quoteOf(turn, seat.customer.name) };
        }),
    },
    /* 4 · A PHOTOGRAPH OF A LABEL. */
    {
      fits: (s) => firstReceived(s.rows) >= 0,
      apply: (s) => photo(s, LABEL_PHOTO, () => undefined),
    },
    /* 5 · THE CUSTOMER ANSWERING ROCOTO'S READBACK, quoting it. */
    {
      fits: (s) => {
        const ai = firstAi(s.rows);
        return ai >= 0 && s.rows.slice(ai + 1).some((r) => r.author === 'received' && r.text);
      },
      apply: (s) => {
        const ai = firstAi(s.rows);
        const at = ai + 1 + s.rows.slice(ai + 1).findIndex((r) => r.author === 'received' && r.text);
        s.rows[at] = { ...s.rows[at], quote: quoteOf(s.rows[ai], 'Rocoto') };
      },
    },
  ];
}

/* ── A PHONE ORDER ARRIVED AS A VOICE (FEED-IA §54.3 · AUDIT-2 C8) ────────────────────────────
 * «Show me the voice recording thing.» THE-CUMULATIVE-AUDIT-2 measured the other side of that
 * sentence: on a phone-channel order the arrival block was a 28px row — «phone · 08:29 · read as
 * 5 lines · Open settings» — PIXEL-IDENTICAL to a typed WhatsApp arrival, with `data-voice="no"`,
 * zero `<audio>` and `VoiceNoteBody` mounted behind a `turn.voice` nothing ever reached. The
 * admin's own connections seat meanwhile promised «Phone — transcript kept with the order · Live».
 *
 * THE CAUSE WAS THE SEEDING SHAPE, NOT THE WIDGET. The five jobs below are DISCRETIONARY dressing
 * — each takes the first conversation that fits it, so exactly two recordings existed in a house
 * of three hundred documents, and which two was an accident of the sort order. A phone order does
 * not get a recording by luck. It IS one: a man in a van says twelve kilos of merluza and hangs
 * up, and the words in that row are the words he said.
 *
 * SO IT IS A LAW AND NOT A JOB. Every phone-channel conversation's arrival is a recording, on
 * every one of its orders, before the discretionary pass runs — which is why this is a separate
 * function called ahead of `dress` rather than a sixth entry in it.
 *
 * ONE TRUTH, TWO DOORS. The sheet reads this same fold (`detail.tsx`'s arrival memo keys every
 * turn `<sale>:<row>`), so the recording the albarán plays and the recording the chat widget
 * plays are one object. The alternative — the sheet minting a note of its own off the row's text —
 * is a second recording that could differ from the first, and that is a bug that must not be
 * writable.
 *
 * AND NOTHING IS INVENTED (the seeding law, stated above): the transcript is the sentence that row
 * already holds, split where a speaker stops. The FORM is seeded; the content is the customer's.
 */
function spoken(seat: Seat): void {
  if (seat.customer.channel !== 'phone') return;
  /* one recording per ORDER, not per conversation — a customer who orders by phone ordered by
     phone every time, and the sheet of the third albarán needs its own arrival to play */
  const heardOn = new Set<string>();
  seat.rows.forEach((row, i) => {
    if (row.author !== 'received' || !row.text) return;
    const at = row.id.indexOf(':');
    const sale = at < 0 ? row.id : row.id.slice(0, at);
    if (heardOn.has(sale)) return;
    heardOn.add(sale);
    const heard = utterancesOf(row.text, seat.customer.name);
    seat.rows[i] = { ...row, text: '', voice: { durationMs: lengthOf(heard), seed: row.id, transcript: heard } };
  });
}

/** Hand each job the first conversation that fits it, and never the same one twice. */
function dress(seats: Seat[]): void {
  const taken = new Set<number>();
  for (const job of jobs()) {
    const at = seats.findIndex((s, i) => !taken.has(i) && job.fits(s));
    if (at < 0) continue;
    taken.add(at);
    job.apply(seats[at]);
  }
}

/** The seeded presses plus the person's own, aggregated the way WhatsApp aggregates them. */
function reactionsOf(turn: ThreadTurn, mine: string[] | undefined): Reaction[] | undefined {
  if (!mine || mine.length === 0) return turn.reactions;
  const out = (turn.reactions ?? []).map((r) => ({ ...r }));
  for (const emoji of mine) {
    const held = out.find((r) => r.emoji === emoji);
    if (held) {
      held.count += 1;
      held.mine = true;
    } else out.push({ emoji, count: 1, mine: true });
  }
  return out;
}

type BaseSeat = { id: string; seat: Seat };

/** The ledger's part of the conversation. It is deliberately complete before the chat store is
 * applied: embeds, phone recordings and the discretionary media pass are expensive, but a focus,
 * draft or layout change cannot alter any of them. The pass mutates only seats born inside this
 * memo; later readers treat them as immutable source rows. */
function useBaseSeats(cast: Cast, edits: ReturnType<typeof useDay>, grants: ReturnType<typeof useGrants>): BaseSeat[] {
  return React.useMemo(() => {
    const sales = buildSales(cast, edits);
    const today = todayId(cast);
    const currentDay = dayLabelOf(baseDate(cast));
    const byCustomer = new Map<string, Seat>();

    /* OLDEST SALE FIRST — BY DAY, THEN BY HOUR. `at` is an hour of the clock with no date on it,
       so sorting a customer's sales by it alone interleaved four days by time of morning: a
       conversation carrying orders for Thursday, Friday, Saturday and Monday read Monday first
       and Thursday last, because Monday's request landed at 05:24 and Thursday's at 13:20. The
       day is the outer key and the hour the inner one, and the conversation reads forward — which
       is also what makes the day whispers (§40.3) monotonic instead of a list going backwards. */
    const byDayThenHour = (a: Sale, b: Sale): number =>
      a.day === b.day ? a.at.localeCompare(b.at) : a.day.localeCompare(b.day);

    [...sales].sort(byDayThenHour).forEach((sale) => {
      const seat = byCustomer.get(sale.customer.id)
        ?? { customer: sale.customer, rows: [], saleIds: [], sales: [], waiting: false };
      if (!sale.theatre) {
        /* THE EMBEDS FOLD OUT OF THE SALE ITSELF — no new store, and the row keys stay the thread's
           own, prefixed by the sale so two documents can carry a row called `l1` (musing 5).
           THE ACTS COME OUT OF THE SAME FOLD (§77.5b): a row that moved the order carries what it
           did, keyed by that row's own id, exactly as an embed is. */
        const fold = embedsOf(sale);
        seat.rows.push(
          ...sale.thread.map((r) => ({
            ...r,
            id: sale.id + ':' + r.id,
            kind: sale.theatre && r.author === 'ai' && r.text !== sale.reading ? 'activity' as const : r.kind,
            internal: sale.theatre && r.author === 'ai' && r.text !== sale.reading ? r.text : undefined,
            day: sale.deliveryDay,
            embed: fold.onRow[r.id],
            act: fold.acts[r.id],
          })),
          ...fold.turns.map((t) => ({
            id: `${sale.id}:${t.id}`,
            author: 'ai' as const,
            text: '',
            time: t.at,
            day: sale.deliveryDay,
            embed: t.embed,
          })),
        );
      }
      seat.saleIds.unshift(sale.id);
      seat.sales.push(sale);
      seat.waiting = seat.waiting || isStanding(sale, today);
      byCustomer.set(sale.customer.id, seat);
    });

    /* Theatre events are one current segment of a native conversation. The real Sale remains in
       the Sales fold with its promised delivery date, while its receipt, work trail and amendment
       append after prior traffic under today's existing date whisper. */
    theatreScenesOf(cast).forEach((scene) => {
      const rows = theatreThreadOf(edits, scene).sort((a, b) => a.at.localeCompare(b.at));
      if (rows.length === 0) return;
      const seat = byCustomer.get(scene.customer.id)
        ?? { customer: scene.customer, rows: [], saleIds: [], sales: [], waiting: false };
      seat.rows.push(...rows.map((row) => ({
        id: row.id,
        author: row.author,
        kind: row.visibility === 'internal' ? 'activity' as const : undefined,
        text: row.text,
        time: row.at,
        day: currentDay,
        // The albarán excerpt and native thread share the same source association.
        orderId: scene.saleId,
        internal: row.visibility === 'internal' ? row.text : undefined,
      })));
      byCustomer.set(scene.customer.id, seat);
    });

    /* ── THE MEDIA PASS RUNS ON THE ORDER A PERSON READS (§46.2, §47) ─────────────────────────
       The list stands newest-first, so the seats are put in that order BEFORE the jobs run and a
       voice note lands in a conversation the widget actually opens on. Sorting on the greatest
       hour any row carries is the same key the finished list sorts on, so the two agree. */
    const hourOf = (rows: ThreadTurn[]): number =>
      rows.reduce((best, r) => Math.max(best, minutesOf(r.time)), -1);
    const seats = [...byCustomer.entries()].sort((a, b) => hourOf(b[1].rows) - hourOf(a[1].rows));
    /* THE CHANNEL'S OWN FACT FIRST, THEN THE DRESSING (§54.3 · AUDIT-2 C8). A phone order is a
       recording by construction, so it is settled before the discretionary jobs choose their
       seats — and those jobs then find the phone conversations already spoken for. */
    seats.forEach(([, seat]) => spoken(seat));
    dress(seats.map(([, seat]) => seat));

    return seats.map(([id, seat]) => ({ id, seat }));
  }, [cast, edits, grants]);
}

/**
 * Every conversation the day carries, newest turn first. A customer with nothing to say today is
 * left out of the list rather than drawn as an empty row: the list is the comms, and a row with
 * no message on it is not one.
 */
export function useThreads(cast: Cast): Thread[] {
  const edits = useDay(cast.sector);
  const chat = useChatState(cast.sector);
  /* the ledger reads grants when it builds Sales, so the heavy source projection must subscribe
     to them too. Omitting this caused a change in autonomy to keep the old conversation facts. */
  const grants = useGrants();
  const seats = useBaseSeats(cast, edits, grants);

  /* These are the chat-owned facts. Focus and drafts deliberately stay out: opening, closing or
     resizing the widget has no effect on its source rows, its embeds or its seeded media. */
  return React.useMemo(() => {
    const threads: Thread[] = [];
    seats.forEach(({ id, seat }) => {
      /* what the person writes lands on the conversation's newest day, so a reply never opens a
         day whisper of its own for a day nobody ordered anything on */
      const latestDay = seat.rows[seat.rows.length - 1]?.day;
      const turns: ThreadTurn[] = [
        ...seat.rows,
        ...(chat.written[id] ?? []).map((r): ThreadTurn => ({ ...r, day: latestDay })),
      ];
      /* THE PRESSES ARE FOLDED ON, NEVER STORED TWICE (§47.2). What a person pressed lives in the
         chat store under the turn's own id; the seeded ones live on the turn. They meet here, so
         every surface drawing this turn draws one aggregate. */
      const rows: ThreadTurn[] = turns.map((r) => {
        const reactions = reactionsOf(r, chat.reacted[r.id]);
        return reactions === r.reactions ? r : { ...r, reactions };
      });
      /* THE LIST QUOTES THE LAST THING SAID. A card is not a sentence, so a document embedded at
         09:31 must not become the conversation's last word — it would take the unread mark off a
         customer who is still owed an answer, and take the hour off the row the list sorts on.
         AND «LAST» IS THE LATEST HOUR, NOT THE LAST ROW DRAWN. The turns are laid out by the day
         their order is for, so that a conversation READS FORWARD; the list sorts by the hour
         printed on its rows, so what it must quote is the row carrying the greatest hour. Taking
         the bottom row instead let a routine 05:24 request for next Monday outrank a complaint
         made at 16:40, and the three conversations waiting on somebody dropped out of sight. */
      /* AND A RECORDING IS A THING SAID (§46.2). The preview used to quote `text` alone, so a
         conversation whose newest turn was a voice note quoted the sentence before it — and lost
         the unread mark with it, because «who spoke last» was answered by the wrong row. What
         counts is a turn that CARRIED something: a sentence, a recording, or a photograph. */
      const said = rows.filter((r) => isSourceMessage(r) && (r.text || r.voice || r.picture));
      const last = said.reduce<ThreadTurn | undefined>(
        (best, r) => (!best || minutesOf(r.time) >= minutesOf(best.time) ? r : best),
        undefined,
      );
      const embed = [...rows].reverse().find((r) => r.embed)?.embed;
      threads.push({
        id,
        customer: seat.customer,
        rows,
        last,
        embed,
        at: last?.time,
        /* THE INDEX, FOLDED ONCE (§46.2). Every word of the conversation — typed, spoken or read
           off a photograph — in one flat, folded list, so a person looking for «pulpo» finds the
           voice note that said it. */
        words: wordsOf([seat.customer.name, ...rows.map(turnWords), last?.time]),
        /* UNREAD MEANS THE CUSTOMER SPOKE LAST (FEED-IA §26.4, §31.1). Rocoto's own reading closes
           almost every thread in the house — «Read from WhatsApp as 3 lines for Friday» — and
           counting that as something a person has yet to read put a 295 badge on the rail beside a
           «Messages · 4» band. The mark is for a sentence somebody is owed, so it belongs to the
           rows the customer wrote and to nothing the software said on their behalf. */
        unread: !!last && last.author === 'received' && !chat.read.includes(id),
        waiting: seat.waiting,
        saleIds: seat.saleIds,
        /* THE ORDERS STILL MOVING, SOONEST FIRST (§77.5). The sales were folded oldest-day-first,
           so this is already the order a person acts in; the filter is the one line of law —
           anything from SENT onwards has left the house and belongs to the stream, not to a
           pinned overlay. */
        forming: seat.sales.filter((s) => !isMessageOnly(s) && RANK[s.state] < RANK.sent),
        messageOnly: seat.sales.filter(isMessageOnly),
      });
    });

    /* newest turn first, on the very hour every row prints — see `replyHour` for the clock rule
       that keeps a turn the person has just written the newest one there is */
    threads.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

    /* ── AND THE TESTS STAND ABOVE THE BOOK (THE CHECKPOINT §10.6) ────────────────────────────
       They are pinned rather than sorted in, for the reason the label exists: a test conversation
       has to be «visually unmistakable as test», and a row that could turn up anywhere in three
       hundred is a row a person meets by accident. Pinned, labelled and newest-first, it is where
       a person left it and never where a real conversation should have been.

       THEY DO NOT JOIN THE HOUR SORT. A test carries the house's own clock like everything else,
       and interleaving it would make «the newest conversation» mean two different things on one
       list. */
    return [...chat.tests.map((t) => threadOfTest(t)), ...threads];
  }, [seats, chat.written, chat.reacted, chat.read, chat.tests]);
}

/** ONE TEST CONVERSATION, AS A THREAD — so the list row, the conversation view, the composer and
 *  the pinned order overlay are the SHIPPED ones and none of them is written twice (§27.5).
 *
 *  WHAT IS DIFFERENT IS EXACTLY THE THREE FACTS A TEST HAS: the label, the readings, and the fact
 *  that nothing here is owed to anybody — `unread` and `waiting` are false by construction, which
 *  is the arithmetic half of §10.7's isolation. */
function threadOfTest(t: TestChat): Thread {
  const customer = t.customer;
  /* THE ACT RIDES THE MESSAGE THAT CAUSED IT (§77.5b), keyed by that message's own row — the same
     shape `embedsOf` folds for a real conversation, off the reading instead of off the ledger. */
  const rows: ThreadTurn[] = t.rows.map((r) => {
    const reading = t.readings[r.id];
    return reading?.act ? { ...r, act: { ...reading.act, sale: reading.sale } } : r;
  });
  const said = rows.filter((r) => isSourceMessage(r) && (r.text || r.voice || r.picture));
  const last = said[said.length - 1];
  /* THE ORDER THE CONVERSATION IS CARRYING is the newest reading's — one order, cumulative, which
     is what makes the pinned overlay say something true about the conversation (§77.5). */
  const readings = t.rows.map((r) => t.readings[r.id]).filter((r): r is TestReading => Boolean(r));
  const newest = readings[readings.length - 1];
  return {
    id: t.id,
    customer,
    rows,
    last,
    at: last?.time ?? t.at,
    /* NOTHING IN A TEST IS OWED TO ANYBODY — no customer is waiting, so no counter may say one is */
    unread: false,
    waiting: false,
    saleIds: [],
    forming: newest && newest.sale.lines.length > 0 ? [newest.sale] : [],
    messageOnly: [],
    words: wordsOf([t.label, customer.name, ...rows.map(turnWords)]),
    test: { label: t.label, subject: t.subject, readings, marks: t.marks },
  };
}

/** ── HOW MANY CONVERSATIONS ARE WAITING (FEED-IA §75.2) ──────────────────────────────────────
 *  «The Messages card at the river's top goes — it should just be a number on the widget.»
 *
 *  This is THE fold, and it lives here because `Thread.unread` is defined here: «the customer
 *  spoke last and nobody has opened it». The river used to count its own message-only sales and
 *  the widget used to count threads, which was one fact with two arithmetics — so the river's
 *  count went (§75.2) and every remaining reader takes this function rather than writing the
 *  filter again. It is a pure read of a list: no clock, no store, no hook.
 */
/*  ⚠ AND A TEST IS NEVER IN IT (THE CHECKPOINT §10.7, §27.14). «Keep test conversations isolated
 *  from live external messaging.» The badge on the launcher, the header's own «N unread» and the
 *  river's retired Messages row are all this one function, so excluding tests HERE is the whole of
 *  it: there is no second place the number could come from. It is belt AND braces — a test thread
 *  is built with `unread: false` — because a counter this app leans on should refuse a test row on
 *  its own terms rather than trusting the row to be honest. */
export const unreadCount = (threads: Thread[]): number =>
  threads.filter((t) => t.unread && !t.test).length;

/** HOW MANY CONVERSATIONS THE BOOK IS ACTUALLY CARRYING — the other number the list's header says,
 *  and the other one a test may not move. Same law, same one place. */
export const openCount = (threads: Thread[]): number => threads.filter((t) => !t.test).length;

export type ThreadFocus = {
  /** the thread showing, or `null` for the list */
  id: string | null;
  show: (id: string | null) => void;
  /** how many conversations are waiting on a person */
  unread: number;
};

/** Which thread is open, and how many are waiting. The rail's mark, the sidebar and the tab all
 *  read this, so they cannot disagree about what is on screen. The threads are passed IN rather
 *  than folded again here — one fold per surface, and every reader of it agrees. */
export function useThreadFocus(cast: Cast, threads: Thread[]): ThreadFocus {
  const chat = useChatState(cast.sector);
  return React.useMemo(
    () => ({
      id: chat.focus,
      show: (id: string | null) => focusThread(cast.sector, id),
      unread: unreadCount(threads),
    }),
    [chat.focus, cast.sector, threads],
  );
}

/** One thread by id, for a surface that already knows which conversation it is about. */
export const threadOf = (threads: Thread[], id: string | null): Thread | null =>
  (id ? threads.find((t) => t.id === id) ?? null : null);
