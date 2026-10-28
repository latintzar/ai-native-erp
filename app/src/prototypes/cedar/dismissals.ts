/* THE DISMISSALS — «Is there any reason why?», and the answer is learning material.
 *
 * ═══ WHAT PETER ASKED FOR, VERBATIM (FEED-IA §127.2) ════════════════════════════════════════
 * «After dismissing the issue, it asks, "Is there any reason why?" and says, "They have a big
 * weekend," or "It's a national holiday coming up," or something like that. Put that in there.
 * It's the things about the anxiety the AI has about the order being possibly wrong: something we
 * can dismiss, or we take action.»
 *
 * So a dismissal is NOT a delete. It is an EVENT with a REASON on it, kept — «the human's why is
 * LEARNING MATERIAL; it feeds what Rocoto knows» (§127.2, §110's co-present loop with a capture
 * beat on the dismiss act itself). Nothing here throws a reason away, and nothing here dismisses
 * without one being asked for.
 *
 * ═══ ⚠ THE SEAM: THIS IS A STORE, AND IT SHOULD ONE DAY BE A LEDGER EVENT ═══════════════════
 * Every other learning act in this app is a `SaleEvent` in the day's ledger, folded read-side by
 * `trace.ts` — «no new event, no new store, no second copy of anything». A dismissal belongs there
 * too, as a seventh `TRACE_KINDS` member with the why as its `after`. It is written here instead
 * because `sale.ts`'s event vocabulary is another package's, and inventing a kind in it from this
 * side is exactly the drift that rule exists to stop.
 *
 * WHAT THAT COSTS AND WHAT IT DOES NOT. It costs one store. It does NOT cost the shape: a row here
 * carries the same six facts a trace row carries — the document, what Rocoto had decided, what was
 * held, the person's own words, and the hour — so the day `dismiss` becomes a ledger kind, this
 * file deletes and `tracesOf` reads the same rows out of the fold. Nothing on any surface changes.
 *
 * ═══ AND A DISMISSED ANXIETY IS SETTLED ═════════════════════════════════════════════════════
 * The tick reads this store: a document whose anxiety a person has answered asks nothing more of
 * them, so the organ settles and the red clears (§127.3: red «clears the moment the person acts or
 * dismisses-with-why»). That is why the store lives one import below the tick rather than beside
 * the card that writes it.
 */
import * as React from 'react';
import type { PolicyId } from './sale';

export const DISMISSALS_STORAGE_KEY = 'rocoto-app-dismissals';

/** ONE ANSWERED ANXIETY. Every field is a fact somebody can check on the document it came from —
 *  and `why` is the only one this app did not already know. */
export type Dismissal = {
  /** the document the anxiety was about */
  sale: string;
  /** stable concern identity; legacy anxiety callers use 'anxiety' */
  concern: string;
  /** what Rocoto had decided — the machine's own unpainted id (§120.3) */
  policy: PolicyId;
  /** the sentence Rocoto held on, exactly as the surfaces wrote it — never a second wording */
  withheld: string;
  /** THE PERSON'S OWN WHY. Their words where they typed them; the offered line where they took one
   *  (§65.3 — their word stays theirs either way). */
  why: string;
  /** whether the why was one of the offered lines or their own — the label a learning read needs */
  offered: boolean;
  /** the hour it was answered, in the day's own clock */
  at: string;
};

/* ── THE OFFERED WHYS, IN THE TRADE'S OWN WORDS (§127.2, and these two are HIS, verbatim) ──────
 * «"They have a big weekend," or "It's a national holiday coming up," or something like that.»
 * Two, written once, offered — never imposed: the field beside them takes anything, and a person
 * who does not want to pick may write. A third invented one would be this file putting words in
 * the trade's mouth, which is the one thing a learning capture may not do.
 */
export const OFFERED_WHYS = [
  'They have a big weekend',
  'It’s a national holiday coming up',
] as const;

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────── */

type Book = Record<string, Dismissal>;
const keyOf = (sale: string, concern = 'anxiety'): string => sale + ':' + concern;

function parse(raw: unknown): Book {
  if (!raw || typeof raw !== 'object') return {};
  const out: Book = {};
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    const d = row as Dismissal;
    if (d && typeof d === 'object' && typeof d.why === 'string' && typeof d.sale === 'string') {
      const concern = typeof d.concern === 'string' ? d.concern : 'anxiety';
      out[keyOf(d.sale, concern)] = { ...d, concern };
    }
  }
  return out;
}

let BOOK: Book = (() => {
  try {
    return parse(JSON.parse(window.localStorage.getItem(DISMISSALS_STORAGE_KEY) ?? 'null'));
  } catch {
    return {};
  }
})();

const listeners = new Set<() => void>();

function publish(next: Book): void {
  BOOK = next;
  try {
    window.localStorage.setItem(DISMISSALS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* a prototype in a private window still has to run */
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** WHAT A NON-COMPONENT READS — a fold, a script, the tick's own pure answer. */
export const dismissalsNow = (): Book => BOOK;

const snapshot = dismissalsNow;

/** WHAT A COMPONENT READS, so a dismissal re-renders every organ that was reading it. */
export const useDismissals = (): Book =>
  React.useSyncExternalStore(subscribe, snapshot, snapshot);

/** Has this document's anxiety already been answered? */
export const dismissedNow = (saleId: string, concern = 'anxiety'): Dismissal | undefined => BOOK[keyOf(saleId, concern)];

/**
 * ANSWER AN ANXIETY, AND KEEP THE ANSWER.
 *
 * The why is required by the SURFACE rather than by the type — a person may genuinely have no
 * words, and refusing the dismissal until they invent some would be the app extracting training
 * data rather than being told something. An empty why is stored as an empty why, honestly.
 */
export function dismiss(row: Dismissal): void {
  publish({ ...BOOK, [keyOf(row.sale, row.concern)]: row });
}

/** Take a dismissal back — the anxiety returns, exactly as it was. */
export function undismiss(saleId: string, concern = 'anxiety'): void {
  const next = { ...BOOK };
  delete next[keyOf(saleId, concern)];
  publish(next);
}

/** EVERY ANSWERED ANXIETY, oldest first — the learning read, in the shape `trace.ts` would take. */
export const dismissalsTaught = (): Dismissal[] =>
  Object.values(BOOK).sort((a, b) => a.at.localeCompare(b.at));

/* ══ THE ANXIETY AGES, IT NEVER EVAPORATES (FEED-IA §127.3's second tense) ═══════════════════
 *
 * ⚠ THE SEAM THAT MADE THIS NECESSARY. `policyOf` recomputes from the document's CURRENT state,
 * which is right for «what does this want now» and wrong for «what did you think, and why». The
 * moment a hold is acted on, `policyOf` answers `act` and the reasoning EVAPORATES — so the
 * reasoning door §127.3 describes on history («on live work the anxiety asks for an act; on
 * history it only explains») would open onto nothing on exactly the documents a person most wants
 * to ask about. An anxiety that disappears when it is dealt with was never a record.
 *
 * SO THE BIRTH IS WRITTEN DOWN. When a person first MEETS an anxiety, the sentence Rocoto held on
 * and the action it asked for are kept, stamped with the hour. The aged door reads THIS rather
 * than re-deriving a verdict that has since moved on, and the two tenses are one object: the same
 * reasoning, asking on live work and explaining on history.
 *
 * ⚠ AND IT IS A STORE FOR THE SAME REASON THE DISMISSALS ARE. The honest home is a `SaleEvent`
 * written the instant the verdict is taken, folded read-side like every other learning row. That
 * is `sale.ts`'s vocabulary and another package's; until it lands, the birth is recorded where a
 * person meets it, which covers every anxiety anybody has actually seen. Same six facts, same
 * shape — the day the event exists, this deletes and the fold reads the same rows.
 */

export const ANXIETIES_STORAGE_KEY = 'rocoto-app-anxieties';

/** WHAT ROCOTO WAS WORRIED ABOUT, AT THE MOMENT IT WAS WORRIED. */
export type Anxiety = {
  sale: string;
  /** what it decided then — the machine's own unpainted id (§120.3) */
  policy: PolicyId;
  /** the sentence it held on, exactly as the surfaces wrote it then */
  withheld: string;
  /** which of the two actions it asked for then — `edit` · `reply` */
  owed: string;
  /** the hour the anxiety was born, in the day's own clock */
  at: string;
};

type Book2 = Record<string, Anxiety>;

let BORN: Book2 = (() => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ANXIETIES_STORAGE_KEY) ?? 'null');
    return raw && typeof raw === 'object' ? (raw as Book2) : {};
  } catch {
    return {};
  }
})();

const born = new Set<() => void>();

/** WHAT WAS FELT ABOUT THIS DOCUMENT, where anything was — for a non-component. */
export const anxietyOf = (saleId: string): Anxiety | undefined => BORN[saleId];

/** WHAT A COMPONENT READS, so a birth re-renders the doors that explain it. */
export const useAnxieties = (): Book2 =>
  React.useSyncExternalStore(
    (l: () => void) => {
      born.add(l);
      return () => {
        born.delete(l);
      };
    },
    () => BORN,
    () => BORN,
  );

/**
 * WRITE THE BIRTH ONCE, AND NEVER REWRITE IT.
 *
 * The whole value of this row is that it is the reading Rocoto made THEN. A second write would
 * quietly re-date it against a document somebody has since edited — the very drift the record
 * exists to survive — so an anxiety already on the record is left exactly as it was.
 */
export function rememberAnxiety(row: Anxiety): void {
  if (BORN[row.sale]) return;
  BORN = { ...BORN, [row.sale]: row };
  try {
    window.localStorage.setItem(ANXIETIES_STORAGE_KEY, JSON.stringify(BORN));
  } catch {
    /* a prototype in a private window still has to run */
  }
  for (const l of born) l();
}

/* ══ THE SCHEDULED EMAIL, AND THE ONE ANSWER THAT STOPS IT (FEED-IA §129.4) ══════════════════
 *
 * Peter, verbatim: «the emails well all would be scheduled if its setup by default basically,
 * scheduled at the delivery time UNLESS IT WAS CANCELLED. that's the logic i think. the control
 * for cancelling should be in that sticky thing under the albaran.»
 *
 * SO THE SCHEDULE IS NOT AN ACT — IT IS THE DEFAULT, and the only act is the person's CANCEL.
 * `emailPlan` states it as a fold: a house with its mail set up, a customer who takes email, a
 * document that has been made, and nobody has said no — that email goes at the delivery hour. The
 * dock says the fact and its hour, and carries the one control that changes it.
 *
 * ⚠ SAME SEAM AS THE DISMISSALS. The honest home for a cancel is an `email-cancel` SaleEvent
 * folded by `buildSales` beside `email-schedule`; that vocabulary is `sale.ts`'s and another
 * package's. Until it lands, the answer is kept here in the same shape and read the same way —
 * the day the event exists, this deletes and the fold answers unchanged.
 */

export const EMAIL_CANCELLED_STORAGE_KEY = 'rocoto-app-email-cancelled';

let STOPPED: Record<string, string> = (() => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(EMAIL_CANCELLED_STORAGE_KEY) ?? 'null');
    return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
  } catch {
    return {};
  }
})();

const stopped = new Set<() => void>();

export const emailCancelledNow = (saleId: string): string | undefined => STOPPED[saleId];

export const useEmailCancelled = (): Record<string, string> =>
  React.useSyncExternalStore(
    (l: () => void) => {
      stopped.add(l);
      return () => {
        stopped.delete(l);
      };
    },
    () => STOPPED,
    () => STOPPED,
  );

/** THE ONE ACT ON A DEFAULT (§129.4). Pressing it again puts the default back — a cancel a person
 *  cannot take back would be a decision the app made permanent on their behalf. */
export function cancelEmail(saleId: string, at: string): void {
  STOPPED = STOPPED[saleId]
    ? Object.fromEntries(Object.entries(STOPPED).filter(([k]) => k !== saleId))
    : { ...STOPPED, [saleId]: at };
  try {
    window.localStorage.setItem(EMAIL_CANCELLED_STORAGE_KEY, JSON.stringify(STOPPED));
  } catch {
    /* a prototype in a private window still has to run */
  }
  for (const l of stopped) l();
}
