/** THE ONE RED CLAIM (FEED-IA §127.3) — AND ITS MARK IS NO LONGER A DOT (FEED-IA §196.3).
 *
 * «RED-DOT SEMANTICS: red is reserved for ONE claim — "a human being is waiting on you." The dot
 * appears only while something downstream is blocked on the person: a withheld reply not yet sent
 * (§120.4's restraint standing), or an unanswered issue that gates today's paper. It NEVER marks
 * Rocoto's own uncertainty (that is the anxiety card, in the product's neutral/saffron), never
 * decorates resolved history, and clears the moment the person acts or dismisses-with-why. Colour
 * stays out of the status system everywhere else — which is exactly what makes the one red claim
 * believable.» — Peter, round 5, 2026-08-29.
 *
 * ═══ ⚠ WHAT §196.3 CHANGED, AND WHAT IT LEFT EXACTLY WHERE IT WAS ═══════════════════════════
 * «any fuciking alert or message for "flagged" orders have to have red identifiers and not dots,
 *  like red outline ont he message etc like come on be top down!!!» — Peter, 2026-09-04.
 *
 * THE FOLD BELOW IS UNTOUCHED. Which documents raise the claim, the two blocks that raise it, the
 * two exits that clear it, and the rule that history never carries it — all §127.3, all still
 * decided here, all still decided ONCE. A boolean prop would have let every caller invent its own
 * condition, so the mark still takes a `Waiting` that only `waitingOnAPerson` can build, and that
 * object still carries the SENTENCE saying who is waiting and for what. A mark that cannot say why
 * it is there still cannot be drawn at all.
 *
 * WHAT MOVED IS THE ARTWORK. The 6px disc was a colour asking the reader to already know what it
 * meant; §196.3 replaces it with `red-flag.tsx`'s `FlagMark` — the flag, drawn, in the same red,
 * in the same reserved seat, carrying the same sentence as its accessible name. `AttentionDot`
 * stays as the name its callers use and is now a thin seat over that one vocabulary, so no surface
 * in the house can draw a second version of this claim.
 */
import { STEP } from './glyphs';
import { FlagMark } from './red-flag';
import { dismissedNow } from './dismissals';
import { answerOwed, policyOf, RANK, type Sale } from './sale';

/** WHAT A MARK IS ALLOWED TO MEAN. One shape, one builder — see `waitingOnAPerson`. */
export type Waiting = {
  /** who is waiting and for what, said as a sentence a person can read aloud */
  why: string;
  /** which of §127.3's two blocks this is — carried for the drives and for the reading below */
  kind: 'answer' | 'restraint';
};

/* ── THE ONE FOLD THAT DECIDES IT ─────────────────────────────────────────────────────────────
 * §127.3 names exactly two blocks, and both already exist as predicates this app decides
 * everything else with — so neither is re-implemented here:
 *
 *   AN UNANSWERED ISSUE THAT GATES TODAY'S PAPER → `answerOwed`, which is canon §2.4's ONE hold
 *   and is already what stops an export. Every clause in it is a MISSING FACT: unread does not
 *   hold, a complaint does not hold, a stale pick does not hold. That is precisely «a human being
 *   is waiting on you» and nothing wider.
 *
 *   A WITHHELD REPLY NOT YET SENT → `policyOf(sale).withheld` on a verdict that WITHHELD it. On
 *   `act` the reading went out with the confirmation, so nothing is standing; on hold, clarify and
 *   handoff, Rocoto prepared something and did not send it, and a person is the only one who can.
 *
 * AND RESOLVED WORK IS NEVER MARKED. A document at or past `made` has left the house — the
 * decision was taken, and a mark on it would be the app asking for something nobody can give. This
 * is the clause that makes the negative edge in `drive-122.py` assertable: history provably has
 * no mark, however loud its own past was.
 */
export function waitingOnAPerson(sale: Sale): Waiting | null {
  /* RESOLVED FIRST, so nothing below can re-light a document that is done. */
  if (RANK[sale.state] >= RANK.made) return null;

  /* ── AND DISMISSED-WITH-WHY IS THE SECOND EXIT (FEED-IA §127.2 · §127.3) ────────────────────
   * §127.3 names TWO ways the claim ends — «clears the moment the person acts or
   * dismisses-with-why». Acting is a state change and every clause below already reads it. The
   * other exit is a person telling Rocoto WHY they are not worried, which is not a state change
   * at all: the order is unchanged and the anxiety is answered.
   *
   * IT LIVES IN THIS FOLD RATHER THAN BESIDE IT, and that is the whole point: the mark, the tick,
   * the anxiety card and the chats' own reservation all read THIS function, so the two exits can
   * never disagree about whether somebody is still waiting. A dismissal filtered at one surface
   * and not another is exactly the drift that makes one believable claim into a decoration. */
  if (dismissedNow(sale.id)) return null;

  if (answerOwed(sale)) {
    return { kind: 'answer', why: `${sale.customer.name} is waiting on you` };
  }

  const policy = policyOf(sale);
  if (policy.id !== 'act' && policy.withheld) {
    return { kind: 'restraint', why: `Rocoto held its reply to ${sale.customer.name} for you` };
  }

  return null;
}

/** WHAT A HISTORY ENTRY GETS, WHICH IS NOTHING. It is stated as a function rather than left as an
 *  omission so the law is READABLE at the call site: a past albarán is resolved by construction —
 *  it is in the record because it happened — and §127.3 says red never decorates resolved history.
 *  A caller that reaches for a mark on the record finds this, and finds the reason with it. */
export const waitingOnHistory = (): Waiting | null => null;

/* ── THE MARK ─────────────────────────────────────────────────────────────────────────────────
 * §196.3's flag, in a seat the row already reserves, so a document that starts blocking a person
 * does not move the row it sits in (§37.3 · §77.2). Absent, the seat holds — a mark that comes and
 * goes shifts the two things beside it, which is the jump this app spends whole comments avoiding.
 *
 * THE NAME STAYS `AttentionDot` BECAUSE FOUR SURFACES SAY IT, and one of them (`shell/chats.tsx`)
 * is another workstream's this round. Renaming it would have been a rename in four files to say
 * the same thing; the DRAWING is what §196.3 was about, and the drawing is `FlagMark`'s.
 *
 * ⚠ `size` IS A FLOOR NOW, NOT A DIAMETER. A dot could be 6px and still be seen; a drawn mark
 * cannot, so the seat never goes under the icon ladder's smallest step (`STEP.small`). A caller
 * that asked for 8 gets 16 and a mark it can actually read.
 */
export function AttentionDot({
  waiting,
  testid,
  size = STEP.small,
}: {
  /** `null` draws the reserved seat and nothing in it */
  waiting: Waiting | null;
  testid: string;
  size?: number;
}) {
  /* BOTH OF §127.3's BLOCKS ARE ABOUT WORDS — an unanswered question that gates the paper, and a
     reply Rocoto wrote and held — so both draw the same mark: the one that means «somebody is owed
     an answer». One claim, one drawing (§51.19: one meaning each). */
  return <FlagMark claim={waiting} testid={testid} size={Math.max(size, STEP.small)} kind="response" />;
}
