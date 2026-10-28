/* ONE ANSWER TO «CAN THIS WORKSPACE MESSAGE SOMEBODY ON WHATSAPP» (FEED-IA §246 · §247.2).
 *
 * «same for emailabout the connection state. always we havbe to be super consistent and not fget
 *  people igo confusing menus when they shouldnt see them»                    — Peter, 2026-09-11
 *
 * Five surfaces used to answer that question five different ways. Connections asked
 * `Boolean(state.connection)` and so said Connected about a connection belonging to ANOTHER
 * workspace; onboarding asked `connection.workspace === cast.sector` and said the opposite on the
 * very next tile; the connected inbox asked a third; setup-progress counted a local onboarding
 * draft row; and the composer let a local activation ledger outvote the provider. One account,
 * five readings.
 *
 * This module is the single derivation and it is the phone's, in WhatsApp's vocabulary:
 * `phone-capability.ts` is the precedent and the two files are meant to be read side by side.
 * It is PURE — a provider snapshot in, a posture out — so a tool test runs the real thing rather
 * than a copy of it, and it imports nothing at runtime beyond the provider's own DTOs.
 *
 * ⚠ LIVE PROVIDER EVIDENCE IS THE ONLY INPUT. A browser flag written by opening the setup dialog,
 * a seeded onboarding row with status `sample`, an append-only activation ledger — none of them
 * reach this function. `phone-capability.ts:16` forbids exactly this in as many words, and the
 * WhatsApp half of the app is now held to the same rule.
 */
import type { Connection, ProofState } from './connections/types';

/** The whole register a WhatsApp entrance may find itself in — the phone's five postures, and
 *  every one that is not `ready` presents the same picture and the same `Connect WhatsApp` act. */
export type WhatsAppPosture = 'checking' | 'unavailable' | 'setup' | 'partial' | 'ready';

/** What is still pending, in the order a person meets it. */
export type WhatsAppNeed = 'connection' | 'account' | 'workspace';

/** The shape the WhatsApp connection store publishes; declared here so the selector stays free of
 *  React and a test can hand it a plain object. */
export type WhatsAppProviderState = {
  /** the polled `/state` answer, or `null` while the provider has yet to answer one */
  state: ProofState | null;
  /** the sentence the last failed read left behind */
  error: string;
  /** when a read last landed, in epoch milliseconds. `0` means the provider has yet to answer. */
  checkedAt: number;
  /** the workspace visited the WhatsApp door. A UI fact about this browser, and NEVER connection
   *  evidence — it is carried here so a surface can see it and a reset can clear it. */
  visited: boolean;
};

export type WhatsAppCapability = {
  posture: WhatsAppPosture;
  /** the connection this workspace owns, and `null` for every other posture */
  connection: Connection | null;
  /** the house's own WhatsApp number, as the provider issued it. Empty until one is bound. */
  number: string;
  /** the business name the provider reports for the bound account */
  name: string;
  /** the house can send on WhatsApp right now. `posture === 'ready'`, named for the readers. */
  bound: boolean;
  /** history sharing, in the provider's own word */
  historyStatus: ProofState['history']['status'] | 'unknown';
  needs: WhatsAppNeed[];
  error: string;
  checkedAt: number;
  /** the workspace opened the WhatsApp door in this browser (a visit, never a connection) */
  visited: boolean;
  /** a snapshot stands and the last read failed to confirm it — surfaces keep what they draw */
  stale: boolean;
};

/** The one derivation every WhatsApp entrance reads.
 *
 * ⚠ THE WORKSPACE MATCH IS STRICT, AND THAT IS THE POINT. `Connection.workspace` is optional: the
 * store holds a completed Embedded Signup from the moment it lands, and the field appears only
 * once `bind_workspace()` has run. A permissive read — «a connection naming no workspace counts
 * here» — bound the fish house, the meat house and every other one at once. `whatsapp-intake.tsx`
 * requires the strict match at every mutation boundary; this is that same sentence, in the one
 * place every surface reads.
 */
export function whatsappCapabilityOf(state: WhatsAppProviderState, sector: string): WhatsAppCapability {
  const base = {
    connection: null,
    number: '',
    name: '',
    bound: false,
    historyStatus: 'unknown' as const,
    error: state.error,
    checkedAt: state.checkedAt,
    visited: state.visited,
    stale: Boolean(state.error) && state.state !== null,
  };
  /* 1 · THE PROVIDER HAS YET TO ANSWER. A posture of its own, exactly as the phone's is: between
     the first paint and the first `/state` the card used to assert `Connect WhatsApp` about an
     account that may well be connected. */
  if (!state.state) {
    return { ...base, posture: state.error ? 'unavailable' : 'checking', needs: ['connection'] };
  }
  const answer = state.state;
  /* 2 · THIS WORKSPACE'S OWN CONNECTION. The only fact that reads Connected anywhere in Cedar. */
  if (answer.connection && answer.connection.workspace === sector) {
    return {
      ...base,
      posture: 'ready',
      connection: answer.connection,
      number: answer.connection.number,
      name: answer.connection.name,
      bound: true,
      historyStatus: answer.history.status,
      needs: [],
    };
  }
  /* 3 · AN ACCOUNT CONNECTED TO CEDAR AND BOUND SOMEWHERE ELSE. A house switch leaves exactly
     this, and the card used to print ✓Connected on it while the tile beside it read unconnected.
     It is one step short, so it says so and opens the same door. */
  if (answer.connection) return { ...base, posture: 'partial', needs: ['workspace'] };
  /* 4 · A META WALK LEFT HALF WAY THROUGH. The provider is reporting the walk, so the word is
     `Finish setup` rather than the word an account that was never started gets. */
  if (answer.setup && answer.setup.status !== 'ready') {
    return { ...base, posture: 'partial', error: answer.setup.error || state.error, needs: ['account'] };
  }
  /* 5 · THE DOOR ITSELF IS SHUT — the provider answered, and it answered with blockers. */
  if (!answer.ready) {
    return { ...base, posture: 'unavailable', error: answer.blockers[0] || state.error, needs: ['connection'] };
  }
  /* 6 · READY TO BE CONNECTED, AND CONNECTED TO NOTHING. */
  return { ...base, posture: 'setup', needs: ['connection'] };
}

/** The Connections card's own word for each posture — `phoneStatusWord`'s counterpart, and the
 *  same three words in the same three places, so the two channels read as one design.
 *
 *  ⚠ `checking` KEEPS THE PHONE'S SHAPE ON PURPOSE. `phoneStatusWord` (`phone-capability.ts:164`)
 *  answers `Connect phone` for `checking` too, so in the second between the first paint and the
 *  first provider answer a call entrance and a chat entrance say the same kind of thing. The
 *  composer's send is unaffected either way: it hands the words to `wa.me`, the person's own
 *  WhatsApp, and that door opens in every posture (`reply-channel.ts`). */
export function whatsappStatusWord(posture: WhatsAppPosture): string {
  if (posture === 'ready') return 'Connected';
  if (posture === 'partial') return 'Finish setup';
  return 'Connect WhatsApp';
}

/* ── `partial` HAS TWO CAUSES, AND ONLY ONE OF THEM IS THIS HOUSE'S TO FINISH ────────────────
 * An interrupted Meta walk (`needs: ['account']`) resumes where the person stopped. A connection
 * an operator bound to another workspace (`needs: ['workspace']`) reads the same posture and has
 * no such step behind it: `Connection.workspace` is written solely from
 * `config.workspace_for(wabaId, phoneId)` — the operator's `CEDAR_PROOF_WORKSPACE_BINDINGS` map —
 * and `Store.bind_workspace` keeps an existing binding where it is, so walking Meta's signup again
 * returns the same answer. «Finish setup» beside a door was therefore a promise of a repair only
 * an operator can make. It states what is instead, and it carries no act; `connections/HANDOFF.md`
 * holds the operator's side of it.
 */

/** What a connection bound to another workspace says about itself here. */
export const WHATSAPP_OTHER_WORKSPACE = 'This WhatsApp account is set up for another workspace.';

/** Does a WhatsApp entrance stand on an act that lifts the state it names? */
export function whatsappActs(capability: Pick<WhatsAppCapability, 'posture' | 'needs'>): boolean {
  return capability.needs.includes('workspace') === false;
}

/** The word a WhatsApp entrance says about THIS capability. `whatsappStatusWord` answers from the
 *  posture alone, which is the whole answer for the four single-cause postures; the card, Team
 *  numbers and every other surface that can carry a sentence read this one. */
export function whatsappWordFor(capability: Pick<WhatsAppCapability, 'posture' | 'needs'>): string {
  return whatsappActs(capability) ? whatsappStatusWord(capability.posture) : WHATSAPP_OTHER_WORKSPACE;
}
