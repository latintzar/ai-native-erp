/* PARKED (THE-FEED §6.5 and THE-APP-V2 §1): requests are grey rows inside Sales, so the queue has no tab of its own. Out of the area glob; the file stays readable and still typechecks. */
/* REQUESTS — the old Orders area, retired into the feed.
 *
 * ═══ WHAT HAPPENED TO THIS AREA ════════════════════════════════════════════════════════════
 * «What we call orders are TECHNICALLY requests… orders are suggestions for what could become an
 * albarán» (THE-FEED §0). So Orders has no subject left: there is no Order object for an area to
 * be about. What used to stand here — the day's list, one order open beside it, the gate — is the
 * feed and its detail, and this file is nine lines of filter on top of them.
 *
 * ═══ WHY A FILTER AND NOT A DISAPPEARANCE ══════════════════════════════════════════════════
 * The brief offered two ways to retire it. Taking it off the rail is the wrong one twice over:
 * APP-CORE builds the rail from the area glob and `RAIL_ORDER`, so an area cannot remove itself
 * without editing the shell contract every area package was told never to touch — and a rail
 * entry that silently redirects somewhere else is a door that lies about where it goes. So the
 * DOOR stays honest and the SUBJECT is the one that disappears: this is the same feed, the same
 * rows, the same detail, filtered to the sales still waiting on a person. One surface, one
 * grammar, one store — and a person who knew where the requests lived still finds them there.
 *
 * ═══ AND THEN THE INVERSION FINISHED IT (FEED-IA §6.2) ═════════════════════════════════════
 * «Arrivals land COMMITTED BY DEFAULT. Uncommitted is the EXCEPTION state.» So «the sales still
 * waiting on a person» is no longer a filter anybody has to apply: it is the band standing at the
 * head of the feed, above today, before everything else on the surface. The filtered `Feed` this
 * file used to call therefore has nothing left to filter, and the door — which stays honest, per
 * the paragraph above — opens the one surface the requests are already on top of.
 */
import * as React from 'react';
import type { AreaMeta } from '../../shell/area';
import Sales from '../sales';

export const meta: AreaMeta = {
  id: 'orders',
  title: 'Requests',
  owner: 'APP-FEED',
};

export default function Requests() {
  return <Sales />;
}
