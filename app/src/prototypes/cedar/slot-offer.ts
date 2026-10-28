/* THE SUGGESTED DELIVERY HOUR, AND WHETHER THIS DOCUMENT HAS TAKEN IT (FEED-IA §86.4b).
 *
 * «It should suggest the typical delivery time of the customer btw» — with §86.4 immediately
 * before it: «right now the new albarán ALREADY tells me a delivery time before I fucking even
 * entered it». One law in two halves. The account's usual hour may be OFFERED on a document nobody
 * gave an hour to; it may never be drawn as a fact that document carries.
 *
 * ═══ WHAT THIS HOLDS, AND WHAT IT DELIBERATELY DOES NOT ═════════════════════════════════════
 * It answers ONE question per document: has the desk taken the offer. It does not hold the hour —
 * the hour is the ACCOUNT's (`insights.usualHourOf`, off `Customer.slot`), which is why accepting
 * changes nothing about what the paper prints and everything about what the screen is entitled to
 * claim. Before the press the surface says «Rocoto's reading: they usually take 07:30»; after it,
 * the document states 07:30 as its own, because a person said so.
 *
 * ═══ ITS PERMANENT HOME IS THE LEDGER, AND IT IS IN IT NOW ══════════════════════════════════
 * This file used to be a module singleton with its own localStorage key, and it said in its own
 * header that the bit belonged in the document's event stream — «`sale.ts` belongs to another
 * package this hour». That hour ended. The fact is a `slot-taken` event on the sale, folded into
 * `Sale.stamps` beside every other act on an albarán, so it survives a rebuild of the fold, it
 * reaches the paper by the same road as the rest, and the trace export can see it.
 *
 * SO WHAT IS LEFT HERE IS A SEAM, NOT A STORE. Two functions in the shape the sheet already calls,
 * over the ledger: nothing is written twice and nothing is remembered in two places. The hour a
 * press is stamped with is THE MORNING'S OWN — `nowOf` off the cast the day is running — rather
 * than the wall clock, because every other event in this ledger is stamped in the morning it
 * happened in and one event carrying a different clock would be the ledger disagreeing with itself.
 *
 * ⚠ IT NO LONGER SURVIVES A RELOAD, AND THAT IS THE CORRECTION. The localStorage key made this one
 * bit outlive a line edit, a print and a commit, none of which persist in this build. A fact about
 * a document now lives exactly as long as the document's own history does.
 */
import { CASTS } from '../../scenarios/data/cast';
import { dayNow, nowOf } from './day';
import { takeSlot as stampSlot } from './sale';

/** the morning's own clock, read the way every surface reads it */
const hourNow = (): string => nowOf(CASTS[dayNow().sector]);

/** THE PRESS (§86.4b: «one press to accept»). Idempotent — the fold reads the first stamp. */
export const takeSlot = (sale: string): void => stampSlot(sale, hourNow());

/** WHICH DOCUMENTS HAVE TAKEN IT, read off the ledger. A component calling this re-reads it on
 *  every ledger append, because the append is what re-folds the morning the surface is drawing. */
export const slotsTakenNow = (): string[] =>
  dayNow().events.filter((e) => e.kind === 'slot-taken').map((e) => e.sale);

export const useSlotsTaken = (): string[] => slotsTakenNow();
