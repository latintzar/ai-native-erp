/* GROWN from Base Web's own `src/template-component/constants.ts` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships no conversation primitive at all.
 */

/** WHO SAID IT. The four standings a row in a thread can have.
 *
 *  `sent` and `received` are the two hands of an ordinary conversation. `ai` is a received
 *  message that Rocoto itself wrote, and it is the only standing that carries the identity mark.
 *  `system` is the thread talking about itself — a date, a hand-over, a setting that changed —
 *  and it wears no bubble at all.
 */
export const AUTHOR = {
  sent: 'sent',
  received: 'received',
  ai: 'ai',
  system: 'system',
} as const;

/** HOW FAR IT GOT. Delivery, and only delivery — it belongs to a `sent` message, because the
 *  outbound one is the only message whose journey this side owns.
 *
 *  NOTE the deliberate name collision: `AUTHOR.sent` says who wrote it, `STATUS.sent` says it
 *  left. They are different questions on different props and both words are the right one.
 */
export const STATUS = {
  sending: 'sending',
  sent: 'sent',
  error: 'error',
} as const;

/** What a screen reader hears for each delivery state. Stated as what IS, never as a denial. */
export const STATUS_LABEL: Record<keyof typeof STATUS, string> = {
  sending: 'Sending',
  sent: 'Sent',
  error: 'Failed',
};

/** THE HOLD. A press longer than this opens whatever the surface hung on the message.
 *  500ms is the platform norm for a long-press; below ~400ms an ordinary tap starts firing it. */
export const HOLD_MS = 500;

/** …and a press that travels further than this was a scroll, so the hold is abandoned.
 *  Same idea as the recorder's 12px tap drift: a finger is never still. */
export const HOLD_DRIFT = 10;
