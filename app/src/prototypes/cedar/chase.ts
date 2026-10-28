import scenario from './fixtures/money-v1.json';
import { invoiceBalance, invoiceOverdueDays, isCollectible, formatMoney, type MoneyState } from './money-model';
/** UNPAID ORDERS: THE CHASE RECORD AND ITS TIMER (FEED-IA §249, brief A).
 *
 * «the missing payments thing with a chase now button and auto timer on each» — Peter, 14 Sept.
 *
 * ═══ WHAT THIS MODULE IS ═══════════════════════════════════════════════════════════════════
 * One record per unpaid invoice, holding what has already been said to that customer about it,
 * whether the timer is running, and when it fires next. It is pure: no React, no storage side
 * effects beyond the two named readers below, no clock of its own. Every surface that draws a
 * chase reads these functions, so «Chased 09:41 · next in 23 h» has exactly one author.
 *
 * ═══ TWO CLOCKS, AND EACH ONE ANSWERS ITS OWN QUESTION ══════════════════════════════════════
 * The invoices belong to the Money sample world and read `moneyNow(state)` — the workspace's own
 * reference instant — which is what keeps «5 days overdue» stable across a reload. The TIMER is
 * a different fact: it measures real elapsed minutes on the device, exactly as WhatsApp's own
 * «last seen» does, so every `at` and `nextAt` in this file is a wall-clock ISO instant taken
 * from `Date.now()`. Mixing them would make a countdown that never moved.
 *
 * ═══ THREE RUNGS, THEN A PERSON ════════════════════════════════════════════════════════════
 * Step 1 is softer, step 2 carries the late fee, step 3 repeats step 2's words and flags the
 * card for a call with the advance offered beside it. The ladder ENDS there: `recordSend` stops
 * scheduling once the third send lands, because §249's own reading of 72 h is «a flag for a
 * person and the advance offered» rather than a fourth identical message.
 */

export const CHASE_KEY_PREFIX = 'rocoto-cedar-chase-v1:';

/** The rungs of the ladder. A step is capped here and nowhere else. */
export const CHASE_STEPS = 3;
export type ChaseStep = 1 | 2 | 3;

/** How often the timer fires. 24 h is the default Peter named; 12 and 48 are the other two. */
export const CHASE_HOURS = [12, 24, 48] as const;
export type ChaseEvery = (typeof CHASE_HOURS)[number];
export const CHASE_EVERY_DEFAULT: ChaseEvery = 24;

/** The late fee a firmer reminder states: two per cent of what is still owed, from seven days on. */
export const CHASE_FEE_BASIS_POINTS = 200;
export const CHASE_FEE_DAYS = 7;

export type ChaseSend = {
  /** the wall-clock instant this reminder went out */
  at: string;
  step: ChaseStep;
  /** the door it travelled: the account's own WhatsApp, or mail */
  channel: 'whatsapp' | 'email';
  /** exactly the words the conversation holds */
  text: string;
};

export type ChaseRecord = {
  invoiceId: string;
  sends: ChaseSend[];
  auto: { on: boolean; everyHours: ChaseEvery; nextAt: string | null };
  /** set when the third reminder lands: this one is a person's to finish */
  flaggedAt: string | null;
};

export type ChaseBook = { version: 1; scope: string; records: Record<string, ChaseRecord>;
  fixture?: { day: string; records: string } };

export const chaseKey = (scope: string): string => `${CHASE_KEY_PREFIX}${scope}`;
export const emptyChaseBook = (scope: string): ChaseBook => ({ version: 1, scope, records: {} });

export const emptyChaseRecord = (invoiceId: string): ChaseRecord => ({
  invoiceId, sends: [], auto: { on: false, everyHours: CHASE_EVERY_DEFAULT, nextAt: null }, flaggedAt: null,
});

const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isEvery = (value: unknown): value is ChaseEvery => CHASE_HOURS.includes(value as ChaseEvery);

/** One record, validated field by field. A damaged record reads as ABSENT rather than as a
 *  half-chase: the card then offers the ladder from step 1, which is the honest state. */
function parseRecord(raw: unknown, invoiceId: string): ChaseRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ChaseRecord>;
  if (value.invoiceId !== invoiceId || !Array.isArray(value.sends) || value.sends.length > 24) return null;
  const sends: ChaseSend[] = [];
  for (const row of value.sends) {
    const send = row as Partial<ChaseSend> | null;
    if (!send || typeof send !== 'object' || !instant(send.at)) return null;
    if (send.step !== 1 && send.step !== 2 && send.step !== 3) return null;
    if (send.channel !== 'whatsapp' && send.channel !== 'email') return null;
    if (typeof send.text !== 'string' || send.text.length > 2000) return null;
    sends.push({ at: send.at, step: send.step, channel: send.channel, text: send.text });
  }
  const auto = value.auto as ChaseRecord['auto'] | undefined;
  if (!auto || typeof auto !== 'object' || typeof auto.on !== 'boolean' || !isEvery(auto.everyHours)) return null;
  if (auto.nextAt !== null && !instant(auto.nextAt)) return null;
  if (value.flaggedAt !== null && !instant(value.flaggedAt)) return null;
  return { invoiceId, sends, auto: { on: auto.on, everyHours: auto.everyHours, nextAt: auto.nextAt }, flaggedAt: value.flaggedAt };
}

/** Validate the stored book before restoring it; a damaged book starts empty. */
export function parseChase(raw: unknown, scope: string): ChaseBook {
  if (!raw || typeof raw !== 'object') return emptyChaseBook(scope);
  const value = raw as Partial<ChaseBook>;
  if (value.version !== 1 || value.scope !== scope || !value.records || typeof value.records !== 'object') return emptyChaseBook(scope);
  const records: Record<string, ChaseRecord> = {};
  for (const [invoiceId, row] of Object.entries(value.records)) {
    const record = parseRecord(row, invoiceId);
    if (record) records[invoiceId] = record;
  }
  const fixture = value.fixture;
  return { version: 1, scope, records, ...(fixture && typeof fixture.day === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(fixture.day) && typeof fixture.records === 'string'
    && fixture.records.length <= 30000 ? { fixture } : {}) };
}

/** Authored reminders anchor both books; pristine seeded ladders can advance with their invoices. */
export const hasAuthoredChase = (book: ChaseBook): boolean => Object.keys(book.records).length > 0
  && book.fixture?.records !== JSON.stringify(book.records);

export function readChase(scope: string): ChaseBook {
  try { return parseChase(JSON.parse(localStorage.getItem(chaseKey(scope)) || 'null'), scope); }
  catch { return emptyChaseBook(scope); }
}

export function writeChase(book: ChaseBook): void {
  try { localStorage.setItem(chaseKey(book.scope), JSON.stringify(book)); window.dispatchEvent(new CustomEvent('rocoto:chase-changed',{detail:{scope:book.scope}})); }
  catch { /* The current session keeps the record it is holding. */ }
}

export const chaseRecordOf = (book: ChaseBook, invoiceId: string): ChaseRecord =>
  book.records[invoiceId] ?? emptyChaseRecord(invoiceId);

/** The latest reminder already sent when this receipt arrived, compared as exact instants. */
export function lastChaseBeforeReceipt(record: ChaseRecord, receiptAt: string): ChaseSend | null {
  const receivedAt = Date.parse(receiptAt);
  if (!Number.isFinite(receivedAt)) return null;
  let latest: ChaseSend | null = null;
  let latestAt = -Infinity;
  for (const send of record.sends) {
    const at = Date.parse(send.at);
    if (Number.isFinite(at) && at <= receivedAt && at >= latestAt) {
      latest = send;
      latestAt = at;
    }
  }
  return latest;
}

export const putChase = (book: ChaseBook, record: ChaseRecord): ChaseBook =>
  ({ ...book, records: { ...book.records, [record.invoiceId]: record } });

/** The rung the NEXT reminder stands on. Three sends is the whole ladder, so it stays at 3. */
export const chaseStepOf = (record: ChaseRecord): ChaseStep =>
  (Math.min(record.sends.length + 1, CHASE_STEPS) as ChaseStep);

/** «Reminder 1 of 3 · softer» — the rung, said the way the dialog says it. */
export const chaseStepWords = (step: ChaseStep): string =>
  step === 1 ? `Reminder 1 of ${CHASE_STEPS} · softer`
    : step === 2 ? `Reminder 2 of ${CHASE_STEPS} · firmer`
      : `Reminder 3 of ${CHASE_STEPS} · firmer`;

/** Two per cent of what is still owed, in the invoice's own minor units. */
export const chaseFeeMinor = (balanceMinor: number): number =>
  Number.isSafeInteger(balanceMinor) && balanceMinor > 0 ? Math.round(balanceMinor * CHASE_FEE_BASIS_POINTS / 10000) : 0;

/** The calendar day the fee starts on: seven days from the day the reminder goes out. */
export function chaseFeeDate(at: string): string {
  const day = Date.parse(at);
  return Number.isFinite(day) ? new Date(day + CHASE_FEE_DAYS * 86400000).toISOString().slice(0, 10) : '';
}

export type ChaseMessageInput = {
  step: ChaseStep;
  customerName: string;
  documentNumber: string;
  amountText: string;
  dueText: string;
  link: string;
  feeText: string;
  feeDateText: string;
};

/** THE THREE TEXTS, AND THEY ARE THE ONLY THREE (§249 brief A, the lead's escalation).
 *
 *  Step 1 asks. Step 2 states the fee that has started running, and step 3 says the same firmer
 *  thing once more beside the flag a person acts on — the card carries the escalation from there,
 *  so the customer meets one sentence rather than a third register nobody drafted. */
export function chaseMessageOf(input: ChaseMessageInput): string {
  const pay = input.link ? ` Pay here: ${input.link}.` : '';
  if (input.step === 1) {
    return `Hi ${input.customerName}, your order ${input.documentNumber} for ${input.amountText} is due ${input.dueText}.${pay} Thank you.`;
  }
  return `Hi ${input.customerName}, order ${input.documentNumber} for ${input.amountText} was due ${input.dueText}. A late fee of ${input.feeText} applies from ${input.feeDateText}.${pay}`;
}

const scheduleFrom = (at: string, everyHours: ChaseEvery): string | null => {
  const from = Date.parse(at);
  return Number.isFinite(from) ? new Date(from + everyHours * 3600000).toISOString() : null;
};

/** A reminder landed. It joins the record, the timer moves on by its own interval, and the third
 *  one flags the card. Once the ladder is finished nothing is scheduled: the next act is a call. */
export function recordSend(record: ChaseRecord, send: ChaseSend, everyHours: ChaseEvery): ChaseRecord {
  const sends = [...record.sends, send];
  const finished = sends.length >= CHASE_STEPS;
  return {
    ...record,
    sends,
    auto: { on: record.auto.on, everyHours, nextAt: record.auto.on && !finished ? scheduleFrom(send.at, everyHours) : null },
    flaggedAt: send.step >= CHASE_STEPS ? send.at : record.flaggedAt,
  };
}

/** The switch, and the interval beside it. Turning it on starts the countdown from right now. */
export function setAuto(record: ChaseRecord, on: boolean, everyHours: ChaseEvery, now: string): ChaseRecord {
  const finished = record.sends.length >= CHASE_STEPS;
  return { ...record, auto: { on, everyHours, nextAt: on && !finished ? scheduleFrom(now, everyHours) : null } };
}

/** The chases whose moment has come: the timer is on, its instant has passed, the ladder has a
 *  rung left, and the invoice still owes money. Balances come from the caller, because the
 *  ledger is Money's to read and this module holds no state. Stable order, by invoice id. */
export function dueChases(records: Record<string, ChaseRecord>, now: string, balances: Record<string, number>): ChaseRecord[] {
  const at = Date.parse(now);
  if (!Number.isFinite(at)) return [];
  return Object.values(records)
    .filter(record => record.auto.on
      && record.sends.length < CHASE_STEPS
      && instant(record.auto.nextAt)
      && Date.parse(record.auto.nextAt as string) <= at
      && (balances[record.invoiceId] ?? 0) > 0)
    .sort((a, b) => a.invoiceId.localeCompare(b.invoiceId));
}

/** «next in 23 h» · «next in 40 min» · «due now». Hours from an hour up, minutes below it. */
export function countdownWords(nextAt: string | null, now: string): string {
  if (!instant(nextAt) || !Number.isFinite(Date.parse(now))) return '';
  const minutes = Math.round((Date.parse(nextAt) - Date.parse(now)) / 60000);
  if (minutes <= 0) return 'due now';
  return minutes >= 60 ? `next in ${Math.floor(minutes / 60)} h` : `next in ${minutes} min`;
}

const HOUR_FORMAT = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
const DAY_FORMAT = { day: 'numeric', month: 'short' } as const;

/** «Chased 09:41» on the day it happened, «Chased 13 Sep 09:41» on any day after it. */
export function chasedWords(lastAt: string | null, now = new Date().toISOString()): string {
  if (!instant(lastAt)) return '';
  const at = new Date(lastAt);
  const hour = at.toLocaleTimeString('en-GB', HOUR_FORMAT);
  const today = new Date(now).toDateString() === at.toDateString();
  return today ? `Chased ${hour}` : `Chased ${at.toLocaleDateString('en-GB', DAY_FORMAT)} ${hour}`;
}

/** The whole status line a card prints under its acts: what was said last, and what happens next. */
export function chaseStatusWords(record: ChaseRecord, now: string): string {
  const chased = chasedWords(record.sends[record.sends.length - 1]?.at ?? null, now);
  const countdown = record.auto.on ? countdownWords(record.auto.nextAt, now) : '';
  return [chased, countdown].filter(Boolean).join(' · ');
}


/** Three aged orders already stand on the reminder ladder when a fresh demo opens. */
export function seedChaseBook(state: MoneyState, at: string, sales: readonly { customer: { id: string; channel?: string } }[] = []): ChaseBook {
  let book = emptyChaseBook(state.scope);
  const candidates = state.invoices.filter(invoice => isCollectible(invoice) && !invoice.disputed
    && invoiceBalance(state, invoice.id) > 0 && invoiceOverdueDays(state, invoice.id, at) >= 5);
  const chosen = new Set<string>();
  for (const [index, pattern] of scenario.history.chases.entries()) {
    const targetDays = [5, 15, 30][index];
    const invoice = candidates.filter(row => !chosen.has(row.id)).sort((a, b) =>
      Math.abs(invoiceOverdueDays(state, a.id, at) - targetDays) - Math.abs(invoiceOverdueDays(state, b.id, at) - targetDays)
      || a.id.localeCompare(b.id))[0];
    if (!invoice) continue;
    chosen.add(invoice.id);
    let record = emptyChaseRecord(invoice.id);
    record = setAuto(record, true, pattern.everyHours as ChaseEvery, at);
    const balance = invoiceBalance(state, invoice.id);
    for (let step = 1; step <= pattern.step; step += 1) {
      const initial=state.requests?.find(link=>link.invoiceId===invoice.id)?.sentAt;
      const sentAt = new Date(initial ? Date.parse(initial)+step*24*3600000 : Date.parse(at) - (pattern.hoursAgo + (pattern.step - step) * pattern.everyHours) * 3600000).toISOString();
      const words = chaseMessageOf({ step: step as ChaseStep, customerName: invoice.customerName,
        documentNumber: invoice.number, amountText: formatMoney(balance, invoice.currency), dueText: invoice.dueAt,
        link: '', feeText: formatMoney(chaseFeeMinor(balance), invoice.currency), feeDateText: chaseFeeDate(sentAt) });
      const channel = sales.find(sale => sale.customer.id === invoice.customerId)?.customer.channel === 'email' ? 'email' : 'whatsapp';
      record = recordSend(record, { at: sentAt, step: step as ChaseStep, channel, text: words }, pattern.everyHours as ChaseEvery);
    }
    book = putChase(book, record);
  }
  return { ...book, fixture: { day: state.fixtureDay ?? at.slice(0, 10), records: JSON.stringify(book.records) } };
}
