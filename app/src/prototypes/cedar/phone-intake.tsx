import * as React from 'react';
import type { Customer } from '../../scenarios/data/cast';
import { channelApi } from './cedar-channel-api';
import { dayForSector, setDayForSector } from './day';
import { readSourceOrder } from './order-intake';
import { callEnded, customerForPhone, parsePhoneCall, type PhoneCall } from './phone-call-model';
import { parsePhoneSources, phoneCallWindow, phoneChunkId, phoneSourceChunks, processPhoneCallWindow,
  readPhoneCursor, writePhoneCursor, type PhoneCursorStorage, type PhoneSourceChunk } from './phone-intake-model';
import { usePhoneProvider } from './phone-runtime';
import { phoneSessionNow } from './phone-session';
import type { SaleEvent } from './sale';
import { useTestWorld } from './test-chat';

const POLL_MS = 2500;
const CURSOR_KEY = 'rocoto-cedar-phone-intake-v1';
const sourceClock = (at: string) => new Date(at).toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false });

function customerFor(call: PhoneCall, world: ReturnType<typeof useTestWorld>): Customer {
  const session = phoneSessionNow();
  const number = call.direction === 'inbound' ? call.from : call.to;
  const selected = session.active?.sid === call.sid && session.customerId
    ? world.cast.customers.find(customer => customer.id === session.customerId) : undefined;
  return selected || customerForPhone(world.cast.customers, number) || {
    id: `phone-${number.replace(/\D/g, '')}`, name: number, phone: number, channel: 'phone', tier: '', settles: 'cash on delivery',
  };
}

export async function applyPhoneSourceChunk(call: PhoneCall, chunk: PhoneSourceChunk, world: ReturnType<typeof useTestWorld>, workspace: string,
  guard: { signal?: AbortSignal; current?: () => boolean; read?: typeof readSourceOrder } = {}): Promise<boolean> {
  const current = () => !guard.signal?.aborted && (guard.current?.() ?? true);
  if (!current()) return false;
  const sector = world.cast.sector;
  const id = await phoneChunkId(workspace, call.sid, chunk);
  if (!current()) return false;
  if (dayForSector(sector).events.some(row => row.kind === 'source-arrive' && row.channel === 'phone' && row.sourceEvent === id)) return true;
  const customer = customerFor(call, world), text = chunk.utterances.map(row => row.text).join('\n');
  const at = sourceClock(chunk.occurredAt);
  const reading = text.length <= 5000
    ? await (guard.read || readSourceOrder)({ text, sourceEvent: id, at, occurredAt: chunk.occurredAt,
      customer, world, signal: guard.signal })
    : { isOrder: false, needsReply: true, lines: [], deliveryDay: null, intelligence: { mode: 'heuristic' as const } };
  if (!current()) return false;
  const event: SaleEvent = { kind: 'source-arrive', sale: `phone:${id}`, sourceEvent: id, conversation: call.sid,
    channel: 'phone', customer: customer.id, customerName: customer.name, customerPhone: customer.phone || '',
    at, occurredAt: chunk.occurredAt, historical: false, offset: 0, text, lines: reading.lines,
    ...(reading.needsReply ? { needsReply: reading.isOrder ? 'order' as const : 'ask' as const } : {}), intelligence: reading.intelligence,
    ...(reading.deliveryDay ? { deliveryDay: reading.deliveryDay } : {}),
    phoneSource: { workspaceId: workspace, callSid: call.sid, eventIds: chunk.events,
      sourceIds: chunk.utterances.map(row => `phone:${workspace}:${call.sid}:${row.id}`),
      utterances: chunk.utterances.map(row => ({ ...row, speaker: row.speaker! })) },
  };
  const saved = setDayForSector(sector, previous => ({ events: previous.events.some(row => row.kind === 'source-arrive'
    && row.channel === 'phone' && row.sourceEvent === id) ? previous.events : [...previous.events, event] }));
  if (!saved.events.some(row => row.kind === 'source-arrive' && row.channel === 'phone' && row.sourceEvent === id)) return false;
  return true;
}

/** The runtime owns calls and transcripts; this bridge owns reviewable Cedar draft arrivals. */
export function PhoneIntake(): null {
  const provider = usePhoneProvider(), world = useTestWorld();
  const [epoch, resume] = React.useReducer(value => value + 1, 0);
  const cursors = React.useRef(new Map<string, number>());
  React.useEffect(() => {
    const refresh = () => resume();
    window.addEventListener('rocoto:phone-disconnect-end', refresh);
    return () => window.removeEventListener('rocoto:phone-disconnect-end', refresh);
  }, []);
  const latest = React.useRef(world); latest.current = world;
  const workspace = provider.evidence?.workspace_id || '';
  const ready = provider.evidence?.lines.some(line => line.mode === 'commissioned' && line.setup.live_transcription && line.readiness.account_verified && line.readiness.transcription_ready);
  const sector = world.cast.sector;
  React.useEffect(() => {
    if (!workspace || !ready) return;
    const controller = new AbortController();
    let timer: number | undefined, busy = false;
    let storage: PhoneCursorStorage | null = null;
    try { storage = window.localStorage; } catch { /* The mounted session uses its in-memory cursor. */ }
    const current = () => !controller.signal.aborted && latest.current.cast.sector === sector;
    const run = async () => {
      if (!current() || busy) return;
      busy = true;
      try {
        const calls = phoneCallWindow(await channelApi<unknown>('/phone/calls', { signal: controller.signal }));
        await processPhoneCallWindow(calls, current, async rawCall => {
          const call = parsePhoneCall(rawCall);
          const key = `${CURSOR_KEY}:${workspace}:${sector}:${call.sid}`;
          const after = readPhoneCursor(key, cursors.current, storage);
          const page = parsePhoneSources(await channelApi(`/phone/calls/${encodeURIComponent(call.sid)}/intake?after=${after}&limit=100`, { signal: controller.signal }), call.sid, after);
          if (!current()) return;
          const applied = new Set(dayForSector(sector).events.flatMap(event => event.kind === 'source-arrive' && event.channel === 'phone'
            && event.phoneSource?.workspaceId === workspace && event.phoneSource.callSid === call.sid ? event.phoneSource.utterances.map(row => row.id) : []));
          const planned = phoneSourceChunks(page, applied, Date.now(), callEnded(call));
          for (const chunk of planned.chunks) {
            if (!await applyPhoneSourceChunk(call, chunk, latest.current, workspace, { signal: controller.signal, current }))
              throw new Error('Save the call reading before continuing.');
          }
          if (!current()) return;
          writePhoneCursor(key, Math.max(after, planned.acknowledgedThrough), cursors.current, storage);
        });
      } catch { /* Retain the last committed cursor; the next poll resumes this source. */ }
      finally { busy = false; if (current()) timer = window.setTimeout(() => void run(), POLL_MS); }
    };
    const cancel = () => controller.abort();
    window.addEventListener('rocoto:channel-workspace-reset', cancel);
    window.addEventListener('rocoto:phone-disconnect-start', cancel);
    void run();
    return () => { controller.abort(); window.clearTimeout(timer); window.removeEventListener('rocoto:channel-workspace-reset', cancel); window.removeEventListener('rocoto:phone-disconnect-start', cancel); };
  }, [workspace, ready, sector, epoch]);
  return null;
}
