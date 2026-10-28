/* THE COPILOT — one door (FEED-IA §196.2).
 *
 *   types.ts      the objects: session, message, card, and the provider seam
 *   store.ts      the sessions, per tenant, in localStorage — list, current, new, forget
 *   context.ts    what the Copilot is looking at — the desk, as the runtime's contract types it
 *   router.ts     the road to the mind in the runtime, and the offline posture behind it
 *   composer.tsx  the writing box ported from app.soyrocoto.com's editor variant
 *   flows.tsx     the supply and catalogue work, as CARDS inside a turn
 *   surface.tsx   the column: head, ruled thread, starters, composer, disclaimer
 */
export { CopilotHost, openAssistant } from './surface';
export { CopilotComposer } from './composer';
export { useSessions, readStore, writeStore, blank } from './store';
export { answer, ask, offlineTurn, turnOf, productIn, customerIn, ordersFor, OFFLINE_NOTE, type Reading } from './router';
export { askContext, areaOf, openOrderId, ordersOf, stockOf, CONTEXT_CAPS } from './context';
export * from './types';
