import * as React from 'react';
import type { Customer } from '../../scenarios/data/cast';
import { dayForSector, setDayForSector } from './day';
import { useTestWorld } from './test-chat';
import { ProofApiError, proofApi } from './connections/api';
import type { WhatsAppIntakeMessage, WhatsAppIntakePage } from './connections/types';
import { useWhatsAppConnection } from './whatsapp-connection';
import { readSourceOrder } from './order-intake';
import type { SaleEvent } from './sale';

const CURSOR_KEY = 'rocoto-cedar-whatsapp-intake-cursor-v2';
const POLL_MS = 5000;

function clock(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima',
      })
    : '00:00';
}

function digits(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function customerFor(message: WhatsAppIntakeMessage, customers: Customer[]): Customer {
  const bound = message.customerId
    ? customers.find(candidate => candidate.id === message.customerId)
    : undefined;
  if (bound) return bound;
  const known = customers.find((candidate) => candidate.phone && digits(candidate.phone) === digits(message.number));
  if (known) return known;
  return {
    id: `whatsapp-${message.conversationId.slice(0, 24)}`,
    name: message.name || message.number,
    phone: message.number,
    channel: 'WhatsApp',
    tier: '',
    settles: 'cash on delivery',
  };
}

const alreadyApplied = (sector: ReturnType<typeof useTestWorld>['cast']['sector'], id: string) =>
  dayForSector(sector).events.some((row) => row.kind === 'source-arrive'
    && row.channel === 'whatsapp' && row.sourceEvent === id);

export async function applyWhatsAppMessage(
  message: WhatsAppIntakeMessage,
  world: ReturnType<typeof useTestWorld>,
  guard: {
    signal?: AbortSignal;
    current?: () => boolean;
    read?: typeof readSourceOrder;
  } = {},
): Promise<boolean> {
  if (message.historical !== false || !message.text.trim()) return true;
  if (alreadyApplied(world.cast.sector, message.id)) return true;
  const current = () => !guard.signal?.aborted && (guard.current?.() ?? true);
  if (!current()) return false;
  const customer = customerFor(message, world.cast.customers);
  const at = clock(message.timestamp);
  const reading = await (guard.read ?? readSourceOrder)({
    text: message.text, sourceEvent: message.id, at, occurredAt: message.timestamp,
    customer, world, signal: guard.signal,
  });
  // Account/workspace identity can change during a model read. Check the live generation at the
  // final mutation boundary so a delayed answer cannot cross a disconnect or scenario switch.
  if (!current()) return false;
  const event: SaleEvent = {
    kind: 'source-arrive',
    sale: `whatsapp:${message.id}`,
    at,
    customer: customer.id,
    customerName: customer.name,
    customerPhone: message.number,
    offset: 0,
    text: message.text,
    channel: 'whatsapp',
    sourceEvent: message.id,
    conversation: message.conversationId,
    occurredAt: message.timestamp,
    historical: false,
    lines: reading.lines,
    ...(reading.deliveryDay ? { deliveryDay: reading.deliveryDay } : {}),
    ...(reading.isOrder ? { needsReply: 'order' as const }
      : reading.needsReply ? { needsReply: 'ask' as const } : {}),
    intelligence: reading.intelligence,
  };
  const saved = setDayForSector(world.cast.sector, (previous) => {
    if (previous.events.some((row) => row.kind === 'source-arrive'
      && row.channel === 'whatsapp' && row.sourceEvent === message.id)) return {};
    return { events: [...previous.events, event] };
  });
  return saved.events.some((row) => row.kind === 'source-arrive'
    && row.channel === 'whatsapp' && row.sourceEvent === message.id);
}

/** Persistent, account-scoped bridge from Meta's live inbound feed into Cedar's existing order
 * proposal ledger. It renders nothing and requires the verified HttpOnly provider session held by
 * WhatsAppConnectionHost. Imported history never reaches this path. */
export function WhatsAppIntake(): null {
  const connection = useWhatsAppConnection();
  const world = useTestWorld();
  const provider = connection.state?.connection;
  const identity = provider ? `${provider.wabaId}:${provider.phoneId}` : '';
  const workspace = provider?.workspace ?? '';

  React.useEffect(() => {
    if (!identity || !workspace || workspace !== world.cast.sector) return undefined;
    const cursorKey = `${CURSOR_KEY}:${identity}`;
    let alive = true;
    let timer: number | undefined;
    let active: AbortController | undefined;
    let polling = false;
    const schedule = (delay = POLL_MS) => {
      if (alive) timer = window.setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      if (!alive || polling) return;
      if (document.hidden) { schedule(); return; }
      polling = true;
      const controller = new AbortController();
      active = controller;
      let cursor = '';
      try { cursor = window.localStorage.getItem(cursorKey) ?? ''; } catch { /* Replay remains idempotent. */ }
      try {
        const page = await proofApi<WhatsAppIntakePage>(`/intake?limit=50${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal });
        if (!alive || controller.signal.aborted) return;
        if (page.workspace !== workspace || world.cast.sector !== workspace) throw new Error('The workspace binding changed during intake.');
        const current = () => alive && !controller.signal.aborted
          && identity === `${connection.state?.connection?.wabaId}:${connection.state?.connection?.phoneId}`
          && workspace === connection.state?.connection?.workspace
          && workspace === world.cast.sector;
        for (const message of page.messages) {
          if (!current()) return;
          if (!await applyWhatsAppMessage(message, world, { signal: controller.signal, current })) {
            if (!current()) return;
            throw new Error('Order intake needs another save attempt.');
          }
        }
        if (!current()) return;
        if (page.nextCursor) {
          try { window.localStorage.setItem(cursorKey, page.nextCursor); } catch { /* Duplicate provider IDs keep replay safe. */ }
        }
        if (page.messages.length > 0) {
          window.dispatchEvent(new CustomEvent('rocoto:whatsapp-intake', { detail: { count: page.messages.length } }));
        }
        schedule(page.messages.length === 50 && page.nextCursor ? 0 : POLL_MS);
      } catch (error) {
        if (!alive || controller.signal.aborted) return;
        if (error instanceof ProofApiError && error.status === 400 && cursor) {
          try { window.localStorage.removeItem(cursorKey); } catch { /* Next session retries from the durable account baseline. */ }
        }
        schedule(POLL_MS);
      } finally {
        if (active === controller) active = undefined;
        polling = false;
      }
    };
    void poll();
    const visible = () => { if (!document.hidden) { if (timer) window.clearTimeout(timer); void poll(); } };
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      active?.abort();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [identity, workspace, world]);
  return null;
}
