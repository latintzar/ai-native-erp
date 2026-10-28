/* THE DRAFTED REPLY — the killer feature, written down (FEED-IA §196.8).
 *
 * ═══ PETER'S ASK, VERBATIM (2026-09-04) ═════════════════════════════════════════════════════
 * «also i missed something, if we tell them to reply to a message, we should draft the reply just
 *  like you can draft emails for me in my gmail. it's a draft inside the composer itself, and the
 *  composer in the chip embedded in the albaran. they can select and delete that draft if they want
 *  to, we just prefill thats all. that would make it super strong and super hybrid. we make them
 *  trust us by soing that. this is a KILLER feature»
 *
 * ═══ THE FOUR RULES THAT FALL OUT OF THAT SENTENCE ══════════════════════════════════════════
 *   1 · IT EXISTS EXACTLY WHERE THE APP ASKED FOR A REPLY. «if we tell them to reply» — so the
 *       draft is a function of the STANDING RESPONSE CONCERN and of nothing else. No concern, no
 *       draft; a dismissed concern takes its draft with it.
 *   2 · IT IS IN THE COMPOSER, not on a control beside it. The words are already in the box, the
 *       way Gmail puts them there.
 *   3 · IT IS THEIRS THE MOMENT THEY TOUCH IT. Selected on focus, so one keystroke replaces the
 *       lot; deletable, and a deletion STICKS — a draft that grew back would be the app arguing.
 *   4 · IT IS A PREFILL, NEVER A SEND. «we just prefill thats all.» Nothing in this file reaches a
 *       channel; it returns words, and a person presses the button.
 *
 * ═══ ⚠ WHAT THIS SUPERSEDES, STATED RATHER THAN DELETED ═════════════════════════════════════
 * §110's GHOST (`chat-ghost`) offered Rocoto's withheld reading on a pill above an EMPTY field —
 * «offered, never imposed». §196.8 imposes it where a reply is owed, which is the case §110 was
 * written for. So the two are one organ at two altitudes, and the boundary is the concern:
 *   · a RESPONSE concern stands  → the draft is IN the field, marked «Draft», deletable (here)
 *   · nothing is owed            → §110's ghost pill stands exactly as it did (`chats.tsx`)
 * The withheld reading is not lost: `policyOf(sale).withheld` is what the composer's own Reading
 * line still carries beside the draft, so the person sees what Rocoto read AND what to send.
 *
 * ═══ ⚠ AND WHAT NEVER CROSSES INTO IT ═══════════════════════════════════════════════════════
 * Every sentence the app writes ABOUT an order is internal by construction and stays internal:
 * `sale.reading` («Read from WhatsApp as 3 lines for Friday 22.08.»), `needsReply.about` («They
 * ask the Gamba roja price — add it before replying»), `policyOf().withheld`, every POLICY_WORD.
 * Those are instructions to the operator. A DRAFT is a message to a customer, so it is composed
 * from customer-safe facts only — who they are, what goods the concern names, the delivery day —
 * and it promises nothing the house has yet to decide. No price, no quantity, no availability.
 *
 * ═══ THE LANGUAGE ══════════════════════════════════════════════════════════════════════════
 * The words below are English because §194.1 publishes English only this release. They are written
 * as ONE TABLE of whole sentences rather than glued fragments, so the Spanish pass has exactly one
 * place to work and no surface has to concatenate grammar.
 */
import * as React from 'react';
import { activeAttentionConcernsOf } from './red-flag';
import { jobOf, policyOf, type Sale, type StandingConcern } from './sale';

/** which shape of reply is owed — the fold's own answer, and the drive's readable claim */
export type DraftKind = 'complaint' | 'question' | 'more' | 'held';

export type ReplyDraft = {
  /** the document the reply answers */
  sale: string;
  /** the standing concern that asked for it — the stable scope a deletion is remembered under */
  concern: string;
  kind: DraftKind;
  /** the words, ready to send or to replace */
  words: string;
  /** what Rocoto read and held, for the line beside the draft (§9.11 — internal, never sent) */
  withheld?: string;
};

/* ── THE SENTENCES ────────────────────────────────────────────────────────────────────────────
 * One whole sentence per case. Direct, complete, and every one of them states what IS: «I'm
 * looking at it now» rather than «I haven't forgotten», «I'll confirm straight away» rather than
 * «sorry for the delay». Peter's standing law on negatives reaches a draft as much as a heading.
 */
const SAYS: Record<DraftKind, (a: { who: string; subject: string; day: string }) => string> = {
  complaint: ({ who, subject }) =>
    `Hi ${who}. Thanks for telling me about the ${subject}. I'm looking at it now and I'll come back to you today.`,
  question: ({ who, subject }) =>
    `Hi ${who}. Thanks for asking about the ${subject}. I'm checking it now and I'll confirm straight away.`,
  more: ({ who, subject, day }) =>
    `Hi ${who}. I have your extra ${subject} for ${day}. I'm checking what we have and I'll confirm straight away.`,
  held: ({ who, day }) =>
    `Hi ${who}. I have your order for ${day}. I'm going through it now and I'll confirm straight away.`,
};

/** THE GOODS THE CONCERN IS ABOUT. The concern's own line where it names one, the document's first
 *  line otherwise — both are facts the customer already wrote to us about. */
const subjectOf = (sale: Sale, concern: StandingConcern): string =>
  concern.line?.product.name ?? sale.lines[0]?.product.name ?? 'order';

/** WHICH SHAPE. Read off the document's own state in the order of consequence, the same order
 *  `liveReadingOf` walks: a complaint outranks a question, a question outranks a hold. */
const kindOf = (sale: Sale): DraftKind =>
  sale.state === 'disputed' ? 'complaint'
  : sale.needsReply?.kind === 'ask' ? 'question'
  : sale.needsReply?.initial ? 'held'
  : sale.needsReply?.kind === 'order' ? 'more'
  : 'held';

/**
 * THE DRAFT FOR ONE DOCUMENT, where one is owed. `null` where nothing is owed — a document nobody
 * is waiting on gets no words put in anybody's mouth.
 */
export function replyDraftFor(sale: Sale): ReplyDraft | null {
  if (sale.archived) return null;
  const concern = activeAttentionConcernsOf(sale).find((c) => c.kind === 'response');
  if (!concern) return null;
  const kind = kindOf(sale);
  return {
    sale: sale.id,
    concern: concern.id,
    kind,
    words: SAYS[kind]({
      who: sale.customer.name,
      subject: subjectOf(sale, concern),
      day: sale.deliveryDay,
    }),
    withheld: policyOf(sale).withheld,
  };
}

/**
 * THE ONE DRAFT A COMPOSER SHOWS, over the orders a conversation is carrying.
 *
 * WHICH ONE, when a conversation holds several. The job the composer is for comes first — an
 * ANSWER is the reply being written — which is `ghostOf`'s own rule (§110), kept, so the draft and
 * the withheld reading can never be about two different documents on one screen.
 */
export function replyDraftOf(sales: Sale[]): ReplyDraft | null {
  const owed = sales
    .map((sale) => ({ draft: replyDraftFor(sale), job: jobOf(sale) }))
    .filter((row): row is { draft: ReplyDraft; job: ReturnType<typeof jobOf> } => Boolean(row.draft));
  const one = owed.find((row) => row.job?.id === 'answer') ?? owed[0];
  return one ? one.draft : null;
}

/* ══ THE DELETION, REMEMBERED (rule 3) ════════════════════════════════════════════════════════
 * «they can select and delete that draft if they want to.» A deletion that lasted until the next
 * render would be the app putting the words back after being told to take them away — the exact
 * opposite of the trust this feature is for. So it is a record, keyed by the DOCUMENT and the
 * CONCERN: the same concern never re-drafts, and a new concern on the same order does.
 *
 * ⚠ SAME SEAM AS `dismissals.ts`, and stated for the same reason: the honest home is a ledger
 * event folded read-side. `sale.ts`'s event vocabulary is another package's, so this is a store of
 * the same shape — the day the kind exists, this file deletes and the fold answers unchanged.
 */

export const REPLY_DRAFTS_STORAGE_KEY = 'rocoto-app-reply-drafts';

type Book = Record<string, true>;
const keyOf = (sale: string, concern: string): string => `${sale}:${concern}`;

let BOOK: Book = (() => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(REPLY_DRAFTS_STORAGE_KEY) ?? 'null');
    return raw && typeof raw === 'object' ? (raw as Book) : {};
  } catch {
    return {};
  }
})();

const listeners = new Set<() => void>();

const publish = (next: Book): void => {
  BOOK = next;
  try {
    window.localStorage.setItem(REPLY_DRAFTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* a prototype in a private window still has to run */
  }
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const snapshot = (): Book => BOOK;

/** WHAT A COMPONENT READS, so deleting a draft in the albarán's chip clears it in Messages too. */
export const useDeletedDrafts = (): Book => React.useSyncExternalStore(subscribe, snapshot, snapshot);

export const draftDeletedNow = (sale: string, concern: string): boolean => BOOK[keyOf(sale, concern)] === true;

/** THE PERSON TOOK THE WORDS AWAY. Nothing re-drafts this concern. */
export function deleteDraft(sale: string, concern: string): void {
  publish({ ...BOOK, [keyOf(sale, concern)]: true });
}

/** Put it back — a deletion a person cannot undo would be a decision made permanent for them. */
export function restoreDraft(sale: string, concern: string): void {
  const next = { ...BOOK };
  delete next[keyOf(sale, concern)];
  publish(next);
}

/** THE DRAFT THAT ACTUALLY STANDS, after the person's own deletions. The one call a surface makes. */
export function standingDraftOf(sales: Sale[]): ReplyDraft | null {
  const draft = replyDraftOf(sales);
  return draft && !draftDeletedNow(draft.sale, draft.concern) ? draft : null;
}
