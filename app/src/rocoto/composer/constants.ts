/* GROWN from Base Web's own `src/template-component/constants.ts` scaffold.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc. The scaffold this follows is
 * theirs; the component is Rocoto's, because Base ships no message-writing bar.
 */

/** Base's own field sizes, minus `mini` — a bar you write paragraphs into has no mini. */
export const SIZE = {
  compact: 'compact',
  default: 'default',
  large: 'large',
} as const;

/** THE STATE MATRIX, named. Every state the bar can be in has a name here, `stateOf` derives it
 *  from the props, and the styled elements switch on it — so a state cannot exist in the paint
 *  without existing in the vocabulary. */
export const STATE = {
  /** nothing written and nothing attached — the voice slot holds the trailing position */
  empty: 'empty',
  /** there are words in the field — the send control has taken the trailing position */
  typing: 'typing',
  /** at least one attachment is staged above the field; it can be sent with or without words */
  attached: 'attached',
  /** the message has been committed and is in flight — the field is inert, the send shows progress */
  sending: 'sending',
  /** the whole bar is out of service */
  disabled: 'disabled',
} as const;

/* ── WHO SITS IN THE TRAILING POSITION (FEED-IA §196.7 · §196.8, Peter 2026-09-04) ────────────
 * Two clauses of one directive were cancelling each other. §196.7: «in email's case, add a
 * transcribe mic button like with copilot as that would indicate it transcribes to text in
 * composer.» §196.8: «if we tell them to reply to a message, we should draft the reply… it's a
 * draft inside the composer itself.» A prefilled draft is `typing` from the first render, so on
 * exactly the messages that carry a draft the trailing seat held SEND and the mic was unreachable
 * — the killer feature hid the transcribe button.
 *
 * SO THE SEAT FOLLOWS WHAT THE MIC IS FOR, which is the distinction that was missing:
 *
 *   · `shared` — THE MIC RECORDS. The take IS the message, so it is an alternative to sending
 *     words and shares one footprint with send: something to send ⇒ send, an empty box ⇒ voice.
 *     Every messenger draws it this way, and it stays this component's default.
 *   · `own`   — THE MIC DICTATES. The take becomes WORDS IN THE BOX, which is a thing you do
 *     BEFORE sending and often on top of words already there. It is not an alternative to send;
 *     it is a second control, so it takes a second seat beside it. This is the Copilot's own
 *     arrangement, ported from `app.soyrocoto.com`'s editor variant («send ALWAYS visible, a
 *     backgroundless mic beside it — because on this surface the mic DICTATES»).
 *
 * A running take still takes the WHOLE BAR in both (`voiceActive`): a recorder is a clock, a
 * meter and a cancel sentence, and neither seat is 300px wide.
 */
export const VOICE_SEAT = {
  /** one footprint, two occupants — the messenger idiom */
  shared: 'shared',
  /** the mic keeps a seat of its own beside an always-present send — the dictation idiom */
  own: 'own',
} as const;

/** THE CEILING, IN LINES — never in pixels. The bar grows upward with what is written and stops
 *  at five lines, then scrolls. The app states the same ceiling as 112px because its body line is
 *  19px; here the line is Base's, so five lines lands wherever Base's type scale puts it (140px at
 *  the default size). A pixel ceiling silently changes how many lines you get the moment the type
 *  scale moves, which is the drift this kit exists to stop. */
export const MAX_LINES = 5;
