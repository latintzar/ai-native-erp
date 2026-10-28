import type { LiveUtterance } from './phone-call-model';

export type PhoneSourceEvent = {
  id: string; sequence: number; call_sid: string; kind: 'final_delta' | 'full_transcript';
  mode: 'incremental' | 'historical'; created_at: string; evidence: LiveUtterance[];
};
export type PhoneSourcePage = { call_sid: string; events: PhoneSourceEvent[]; next_cursor: number; has_more: boolean };
export type PhoneSourceChunk = {
  events: string[]; utterances: LiveUtterance[]; through: number; occurredAt: string;
  boundary: 'silence' | 'size' | 'ended';
};
export type PhoneCursorStorage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** The private runtime already bounds this newest-first window. Every returned call remains eligible. */
export function phoneCallWindow(raw: unknown): unknown[] {
  if (!Array.isArray(raw) || raw.length > 200) throw new Error('Refresh the call list.');
  return raw;
}

/** Browser storage is an optimization; the durable source evidence remains the replay authority. */
export function readPhoneCursor(key: string, memory: ReadonlyMap<string, number>, storage: PhoneCursorStorage | null): number {
  let durable = 0;
  try {
    const value = Number(storage?.getItem(key) || '0');
    if (Number.isSafeInteger(value) && value >= 0) durable = value;
  } catch { /* The in-memory cursor and durable ledger keep this mounted session moving. */ }
  return Math.max(durable, memory.get(key) || 0);
}

export function writePhoneCursor(key: string, value: number, memory: Map<string, number>, storage: PhoneCursorStorage | null): void {
  const cursor = Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const advanced = Math.max(memory.get(key) || 0, cursor);
  memory.set(key, advanced);
  try { storage?.setItem(key, String(advanced)); } catch { /* Durable evidence filters replay after reload. */ }
}

/** A corrupt or temporarily unavailable call cannot hold the rest of the bounded source window. */
export async function processPhoneCallWindow<T>(calls: readonly T[], current: () => boolean, consume: (call: T) => Promise<void>): Promise<void> {
  for (const call of calls) {
    if (!current()) return;
    try { await consume(call); } catch { if (!current()) return; }
  }
}

/** Reject a malformed page before it can move the durable cursor. */
export function parsePhoneSources(raw: unknown, sid: string, after: number): PhoneSourcePage {
  const page = raw as PhoneSourcePage;
  if (!page || page.call_sid !== sid || !Array.isArray(page.events) || page.events.length > 100
    || !Number.isSafeInteger(page.next_cursor) || page.next_cursor < after || typeof page.has_more !== 'boolean')
    throw new Error('Refresh the call to continue reading its transcript.');
  let previous = after;
  for (const event of page.events) {
    if (!event || typeof event.id !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(event.id)
      || event.call_sid !== sid || !Number.isSafeInteger(event.sequence) || event.sequence <= previous
      || !['final_delta', 'full_transcript'].includes(event.kind)
      || event.mode !== (event.kind === 'final_delta' ? 'incremental' : 'historical')
      || typeof event.created_at !== 'string' || !Number.isFinite(Date.parse(event.created_at))
      || !Array.isArray(event.evidence) || event.evidence.length > 50
      || event.evidence.some(row => !row || typeof row.id !== 'string' || !row.id || row.id.length > 160
        || !['inbound', 'outbound'].includes(row.track) || ![0, 1].includes(row.speaker ?? -1)
        || !finite(row.start) || !finite(row.end) || row.end < row.start
        || typeof row.text !== 'string' || row.text.length > 10000 || typeof row.final !== 'boolean'))
      throw new Error('Refresh the call to continue reading its transcript.');
    previous = event.sequence;
  }
  if (page.next_cursor !== previous) throw new Error('Refresh the call to continue reading its transcript.');
  return page;
}

/** Only finalized customer speech becomes a proposal. Source IDs make regrouped replay safe. */
export function phoneSourceChunks(page: PhoneSourcePage, applied: ReadonlySet<string>, now: number, ended: boolean) {
  const chunks: PhoneSourceChunk[] = [];
  let held: PhoneSourceChunk | null = null;
  let chars = 0, lastReceived = 0;
  const seen = new Set(applied);
  const flush = (boundary: PhoneSourceChunk['boundary']) => {
    if (held) chunks.push({ ...held, boundary });
    held = null; chars = 0;
  };
  for (const event of page.events) {
    if (event.kind !== 'final_delta') continue;
    for (const row of event.evidence) {
      if (!row.final || row.speaker !== 1 || !row.text.trim() || seen.has(row.id)) continue;
      const current = held as PhoneSourceChunk | null;
      if (current) {
        const first = current.utterances[0], last = current.utterances[current.utterances.length - 1];
        if (row.start - last.end >= 1.8) flush('silence');
        else if (chars + row.text.length > 800 || current.utterances.length >= 12 || row.end - first.start > 30) flush('size');
      }
      if (!held) held = { events: [], utterances: [], through: event.sequence, occurredAt: event.created_at, boundary: 'silence' };
      if (!held.events.includes(event.id)) held.events.push(event.id);
      held.utterances.push(row); held.through = event.sequence;
      chars += row.text.length; lastReceived = Date.parse(event.created_at); seen.add(row.id);
    }
  }
  if (held && (ended || now - lastReceived >= 1800)) flush(ended ? 'ended' : 'silence');
  // A pending customer chunk retains the cursor ahead of it. Skipped history/house rows are safe.
  const pending = held as PhoneSourceChunk | null;
  const acknowledgedThrough = pending
    ? Math.max(0, (page.events.find(event => event.id === pending.events[0])?.sequence ?? 1) - 1)
    : page.next_cursor;
  return { chunks, acknowledgedThrough };
}

export async function phoneChunkId(workspace: string, sid: string, chunk: PhoneSourceChunk): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([workspace, sid, chunk.events, chunk.utterances.map(row => row.id)]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
