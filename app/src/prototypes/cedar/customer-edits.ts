/* THE ACCOUNT'S OWN FACTS, WRITTEN WHERE THEY ARE READ (FEED-IA §122).
 *
 * «The whole editing-and-having-to-confirm-to-edit: I don't like that. EVERYTHING SHOULD ALWAYS BE
 * EDITABLE FROM THE GET-GO. You shouldn't need to confirm anything — that's exactly what RAQUEL
 * complained about. Everything should be clickable, we're not in 2002 SaaS territory.»
 *
 * ═══ WHAT WAS DEAD ══════════════════════════════════════════════════════════════════════════
 * The customer sheet stated four facts about an account — its name, the channel its orders arrive
 * on, the hour it asked for, and how it settles — as plain text. Every one of them is a fact a
 * HAND put there, and not one of them answered a press. A person who learned on the phone that
 * Can Solé now wants its drop at eight had nowhere on that sheet to say so.
 *
 * ═══ WHY A FOLD, AND WHY THIS SHAPE (`tiers.ts` IS THE PRECEDENT, TO THE LINE) ═══════════════
 * `Customer.tier` is a standing fact ON THE CAST, and `tiers.ts` holds the moves a hand has made
 * since; every pricing surface reads `bandOf(cast, customer)` rather than the raw field, which is
 * what keeps the albarán, the profile and the registry from ever disagreeing about who is on what.
 * This is the same object, one layer wider: the cast keeps the seeded truth, this store holds what
 * a hand wrote, and `accountOf` is the ONE read every surface goes through.
 *
 * It is a module singleton published through `useSyncExternalStore` — the shape `tiers.ts`,
 * `company.ts`, `grants.ts` and `customers-made.ts` already settled for this app — so a name typed
 * on the sheet re-renders the book behind it in the same pass, with no provider to mount above
 * anything, and a NON-COMPONENT (`sale.ts`'s fold, the print rails) can read it too.
 *
 * ═══ WHAT MAY BE WRITTEN, AND WHAT MAY NOT ══════════════════════════════════════════════════
 * AUTHORED facts only. `name` · `channel` · `slot` · `settles` are things somebody decided and
 * somebody can change. What is COUNTED off the record — their order days, their usual order, what
 * one of theirs comes to, their months, the leaderboard — is not here and never will be: §122
 * asks for every authored value to be live, and a derived figure that answered a press would be
 * the app inviting a person to edit an arithmetic. Derived facts stay facts.
 *
 * `zone` · `truck` · `at` are authored too and are NOT here: the round is written on the map and
 * the truck chip, which own their own writers (`truck-chip.tsx`), and a second door onto one fact
 * is how two surfaces start disagreeing. `erp` is not here either — a customer's own system is
 * ARRANGED, in Connections, so the sheet's fact is a door rather than a field.
 */
import * as React from 'react';
import type { Customer } from '../../scenarios/data/cast';

export const CUSTOMER_EDITS_STORAGE_KEY = 'rocoto-app-customer-edits';

/** The authored facts a hand may write on an account, and nothing else. */
export type CustomerEdit = Partial<Pick<Customer, 'name' | 'email' | 'channel' | 'slot' | 'settles'>>;

export type CustomerEdits = Record<string, CustomerEdit>;

const CHANNELS: ReadonlyArray<Customer['channel']> = [
  'WhatsApp',
  'phone',
  'email',
  'in person',
  'portal',
];

/** THE CHANNELS A HOUSE'S ORDERS ARRIVE ON — published, because the chip row that writes one has
 *  to draw exactly the set the type allows and a second list of them would drift on the first
 *  channel anybody adds. */
export const channelsOfTrade = (): ReadonlyArray<Customer['channel']> => CHANNELS;

/** HOW AN ACCOUNT SETTLES. Two answers, and the words are the type's own. */
export const settlementsOfTrade = (): ReadonlyArray<Customer['settles']> => ['credit', 'cash on delivery'];

const isChannel = (v: unknown): v is Customer['channel'] =>
  typeof v === 'string' && (CHANNELS as readonly string[]).includes(v);

const isSettles = (v: unknown): v is Customer['settles'] =>
  v === 'credit' || v === 'cash on delivery';

function parseEdit(raw: unknown): CustomerEdit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: CustomerEdit = {};
  if (typeof r.name === 'string' && r.name.trim().length > 0) out.name = r.name;
  if (typeof r.email === 'string' && r.email.trim().length > 0) out.email = r.email.trim();
  if (isChannel(r.channel)) out.channel = r.channel;
  /* AN EMPTY HOUR IS A WRITTEN FACT, NOT A MISSING ONE. «They stopped asking for eight» is
     something a hand said, and it has to survive a reload — so the blank is stored and `accountOf`
     is what turns it back into the absence the type states. */
  if (typeof r.slot === 'string') out.slot = r.slot;
  if (isSettles(r.settles)) out.settles = r.settles;
  return Object.keys(out).length > 0 ? out : null;
}

function parseEdits(raw: unknown): CustomerEdits {
  if (!raw || typeof raw !== 'object') return {};
  const out: CustomerEdits = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const edit = parseEdit(value);
    if (edit) out[id] = edit;
  }
  return out;
}

function read(): CustomerEdits {
  try {
    const raw = window.localStorage.getItem(CUSTOMER_EDITS_STORAGE_KEY);
    return raw ? parseEdits(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

let EDITS: CustomerEdits = typeof window === 'undefined' ? {} : read();

const listeners = new Set<() => void>();

/** Publish only data that was durably accepted by this browser. A failed local-storage write is
 * not a saved customer edit: callers keep their draft and show the failure rather than making the
 * current sheet look as though it updated. */
function publish(next: CustomerEdits): void {
  EDITS = next;
  for (const l of listeners) l();
}

function persistThenPublish(next: CustomerEdits): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(CUSTOMER_EDITS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  publish(next);
  return true;
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/* THE OTHER TAB, exactly as `tiers.ts` hears it: the write is already in storage, so this window
   parses it, publishes it to its own listeners, and puts nothing back. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CUSTOMER_EDITS_STORAGE_KEY || e.newValue === null) return;
    try {
      EDITS = parseEdits(JSON.parse(e.newValue));
    } catch {
      return;
    }
    for (const l of listeners) l();
  });
}

/** WHAT THE OBJECT LAYER READS, from outside React. */
export const customerEditsNow = (): CustomerEdits => EDITS;

const snapshot = customerEditsNow;

/** The hook a surface reads, so a fact written on the sheet re-renders the book beside it. */
export const useCustomerEdits = (): CustomerEdits =>
  React.useSyncExternalStore(subscribe, snapshot, snapshot);

/* ── THE ONE READ ─────────────────────────────────────────────────────────────────────────────
 * `bandOf` is the model: every surface that prices anything reads THAT rather than `customer.tier`,
 * and that is the whole reason the tarifa never disagrees with itself. So every surface that names
 * an account reads THIS rather than the raw record.
 *
 * IT HANDS BACK THE CUSTOMER ITSELF where nothing has been written — the same object, not a copy —
 * because half this app memoises on the cast's own identity and a fold that minted a new customer
 * on every render would quietly defeat every one of those memos.
 */
export function accountOf(customer: Customer): Customer {
  const edit = EDITS[customer.id];
  if (!edit) return customer;
  const out = { ...customer, ...edit };
  /* THE HOUR CLEARED READS AS THE HOUR NOBODY ASKED FOR. `slot` is optional on the type and every
     surface asks «did they ask for one», so a stored blank has to come back as the absence rather
     than as an empty word painted where an hour goes. */
  if (out.slot !== undefined && out.slot.trim().length === 0) delete out.slot;
  return out;
}

/** THE WRITER. It persists before publishing. `false` means no shared customer state changed;
 * the live field keeps its own draft and the sheet can explain the failure honestly. */
export function setAccount(id: string, patch: CustomerEdit): boolean {
  const clean: CustomerEdit = {};
  if (typeof patch.name === 'string' && patch.name.trim().length > 0) clean.name = patch.name.trim();
  if (typeof patch.email === 'string' && patch.email.trim().length > 0) clean.email = patch.email.trim();
  if (isChannel(patch.channel)) clean.channel = patch.channel;
  if (typeof patch.slot === 'string') clean.slot = patch.slot.trim();
  if (isSettles(patch.settles)) clean.settles = patch.settles;
  if (Object.keys(clean).length === 0) return true;

  const was = EDITS[id] ?? {};
  return persistThenPublish({ ...EDITS, [id]: { ...was, ...clean } });
}

/** Back to the book as it was seeded, with nothing remembered. */
export function clearAccountEdits(): boolean {
  return persistThenPublish({});
}
