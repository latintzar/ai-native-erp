/* THE CHANNEL A CONVERSATION IS ON, AND THE CHANNEL A REPLY LEAVES ON — one law, one file
 * (FEED-IA §196.7, amended by §246 acceptance 5).
 *
 * ═══ PETER'S ASK, VERBATIM (2026-09-04) ═════════════════════════════════════════════════════
 * «chats are per customer with chips. emails can be answered in the chip or by hitting reply and
 *  answering in the composer otherwise it's whatsapp. if whatsapp isnt hooked up, it's email.
 *  maybe it should denote that by putting the icon inthe composer or making the composer's outline
 *  green, or actually better: the send/record button. and if it's email, it can be blue button. in
 *  email's case, add a transcribe mic button like with copilot as that would indicate it
 *  transcribes to tex in composer.»
 *
 * ═══ AND PETER AGAIN (2026-09-10), WHICH IS WHY THE FOURTH CLAUSE CHANGED SHAPE ═════════════
 * «Just think about whether any of the chats and stuff is actually appropriate. Some chats are
 *  WhatsApp-based or email-based, and think about what people are going to expect to see. Also,
 *  what are the places for each chat?»
 *
 * ⚠ THE FOURTH CLAUSE IS NOW AN EXPLICIT CHOICE, AND §246 ACCEPTANCE 5 SUPERSEDES THE AUTOMATIC
 * FALLBACK: «Channel changes must be explicit.» A composer that silently became an email composer
 * because the house's number was still being confirmed changed the destination of a person's words
 * without telling them — the customer writes on WhatsApp, reads on WhatsApp, and the reply landed
 * in a mailbox. So a WhatsApp conversation KEEPS its WhatsApp composer, the line under the box
 * states the send state, and «Reply by email instead» is a press the person makes, reversible, and
 * printed on the composer itself (`data-channel`, `data-because`).
 *
 * ═══ THE LAW, AS FIVE CLAUSES IN ORDER ══════════════════════════════════════════════════════
 *   1 · A REPLY AIMED AT AN EMAIL IS AN EMAIL. Pressing Reply on a message in the thread names the
 *       channel for the reply being written, whatever the account's usual door is.
 *   2 · A TELEPHONE ACCOUNT IS ANSWERED BY CALLING IT. Its turns are call records; the surface
 *       carries a Call action where a composer would otherwise stand.
 *   3 · AN EMAIL ACCOUNT ANSWERS BY EMAIL. `customer.channel === 'email'`, or a conversation whose
 *       account door is mail.
 *   4 · OTHERWISE IT IS WHATSAPP — «otherwise it's whatsapp» — whether or not the house's number is
 *       bound yet. The line under the box says the send state either way.
 *   5 · AND THE PERSON MAY SEND IT BY EMAIL INSTEAD, where this conversation actually has an email
 *       door. That is clause 5, it is a press, and pressing it again puts the reply back.
 *
 * ═══ ⚠ WHAT «HOOKED UP» IS READ OFF — ONE PIECE OF EVIDENCE, AND NOTHING ELSE ═══════════════
 * A settings toggle is not evidence. A customer's stated channel is not evidence. An old incoming
 * message is not evidence: history survives a disconnect, so a turn that arrived in June proves
 * nothing about what the house can send today. Exactly ONE fact proves the number is bound NOW:
 *
 *   THE LIVE CONNECTION  `whatsappCapabilityOf(...).connection` — the provider's own answer about
 *                        THIS workspace, polled by the connection session, workspace-matched.
 *
 * Two others used to stand beside it and both are gone. `arrivedOnWhatsapp` counted any received
 * turn with no mail metadata, which made a telephone order and a seeded fixture row into provider
 * evidence and put a green WhatsApp composer under a call. And `activation.ts`'s `whatsapp-connect`
 * ledger row sat behind an `||`, where the weaker half wins: the ledger is append-only, has no
 * revocation path, and `activation.ts` seeds it on the demo path — so one row outvoted a live
 * provider reporting nothing, permanently. `phone-capability.ts:16` is the precedent.
 *
 * ═══ WHAT THE MIC DOES ══════════════════════════════════════════════════════════════════════
 * It DICTATES: speech becomes words in the box, through the kit runtime (Deepgram nova-3), «like
 * with copilot». §196.7 asks for that button in email's case; it stands on both channels because
 * this app sends nothing on either — it hands the words to the channel's own door — so an audio
 * payload would have nowhere to go. `standing()` below carries the reasoning and the one flag that
 * has to move the day a bound WhatsApp number can take a real voice note.
 */
import * as React from 'react';
import { RuntimeUnreachable, runtime as kitRuntime } from './runtime-client';
import type { Take } from '../../rocoto/voice-button-kit';
import type { Customer } from '../../scenarios/data/cast';

/* ── ZERO · WHAT CHANNEL ONE TURN TRAVELLED ON (FEED-IA §246 acceptance 5) ────────────────────
 * A conversation is a list of turns and each of them arrived somewhere. The account's own door is
 * the DEFAULT, never the answer: a customer who usually writes on WhatsApp can send one email, and
 * that turn is an email — with a sender, a subject and a Reply — standing in the same timeline.
 */

/** where a turn stood: a message channel, or a NOTE for an account with no message door at all */
export type TurnChannel = 'whatsapp' | 'email' | 'phone' | 'note';

export type AccountChannel = Customer['channel'];

/** THE ACCOUNT'S OWN DOOR, MAPPED ONCE. «in person» and «portal» accounts carry no message
 *  channel, so what stands in their conversation is a record of something that happened
 *  elsewhere — a note. Writing a green WhatsApp composer under one would invent a door. */
export function accountChannelOf(channel: AccountChannel): TurnChannel {
  if (channel === 'WhatsApp') return 'whatsapp';
  if (channel === 'phone') return 'phone';
  if (channel === 'email') return 'email';
  return 'note';
}

/** THE CHANNEL'S OWN WORD, WRITTEN ONCE (FEED-IA §246 acceptance 5).
 *
 * ⚠ TWO SURFACES NAMED ONE FACT TWO WAYS. The Delivery Note chip printed «Phone» and the Messages
 * thread header printed the cast's raw value — «phone · Marc», «portal · Laia» — about the same
 * account, because the header joined `customer.channel` straight into a sentence. The cast stores
 * `portal` and `in person` in lower case because they are DATA; a label is not. So the word is
 * folded here and every surface reads it: one channel, one word, everywhere. */
export function channelWord(channel: AccountChannel): string {
  if (channel === 'WhatsApp') return 'WhatsApp';
  if (channel === 'phone') return 'Phone';
  if (channel === 'email') return 'Email';
  return channel === 'portal' ? 'Portal' : 'In person';
}

/** the shape a turn needs for its channel to be read. Structural on purpose: `ThreadRow`,
 *  `ThreadTurn` and a drive's own fixture all satisfy it without importing each other. */
export type ChannelTurn = {
  /** mail metadata — sender, subject, recipients, provider source */
  email?: unknown;
  /** a recording, with its transcript */
  voice?: unknown;
  /** whose turn it is — the customer's (`received`), the house's (`sent`), or Rocoto's (`ai`) */
  author?: 'received' | 'sent' | 'ai';
  /** immutable provider provenance for a live turn, which OUTRANKS every other reading */
  source?: { channel: 'whatsapp' | 'phone' | 'email' } | undefined;
};

/**
 * THE PER-TURN READ. Provider provenance first — `ThreadRow.source.channel` is written by the
 * intake ledger and is the only fact here that came from outside the app. Then mail metadata.
 * Then the account's own door.
 */
export function channelOfTurn(row: ChannelTurn, customer: { channel: AccountChannel }): TurnChannel {
  if (row.source?.channel) return row.source.channel;
  if (row.email) return 'email';
  return accountChannelOf(customer.channel);
}

/**
 * A TURN THAT IS A CALL — a CUSTOMER's turn on a telephone account, recorded or written down.
 *
 * ⚠ IT USED TO REQUIRE THE RECORDING, WHICH LEFT A LATENT PATH TO A FABRICATED WHATSAPP SOURCE.
 * `spoken()` (`shell/threads.ts`) turns the FIRST received row of each sale into a recording, and
 * `withQuestion` (`sale.ts`) can append a SECOND received row to a day order — a customer turn on
 * a telephone account carrying only words, which the old test drew as a plain green bubble inside
 * a conversation that has no chat channel at all.
 *
 * MEASURED, rather than assumed: a sweep of the seeded fish day found 80 telephone conversations
 * and ZERO such bubbles, so the path was latent rather than firing. It is closed either way, and
 * `CallRecord`'s branch for a turn carrying only words is reachable now — a customer turn on a
 * telephone account is a record of what they said when they rang, whether or not audio was kept.
 *
 * Rocoto's own reading (`ai`) and the house's own note (`sent`) keep the existing trail rendering —
 * they are what the app did about the call, rather than the call.
 */
export const isCallTurn = (row: ChannelTurn, customer: { channel: AccountChannel }): boolean =>
  channelOfTurn(row, customer) === 'phone' && row.author === 'received';

/** a turn as the subject rule below needs to read it — an id, and mail metadata where it has any */
export type MailTurn = ChannelTurn & { id: string; email?: { subject?: string } };

/**
 * WHICH MAIL TURNS PRINT THEIR SUBJECT — the first one, and every one that CHANGES it.
 *
 * ⚠ ONE RULE, TWO HOUSINGS. `EmailConversation` has always printed three mails on «Order for
 * Monday» under one heading, because the same fact three times in one column is exactly the
 * crowding §40.3 and §25.5 spend their words avoiding. The chat stream mounted the SAME extracted
 * card with «print it whenever there is one», so a mixed conversation printed the heading on every
 * consecutive mail turn. The rule lives here now and both surfaces read it.
 *
 * A WhatsApp bubble standing between two mails on one subject changes no subject: this walks the
 * MAIL turns and ignores everything else, which is what makes a mixed timeline read correctly.
 */
export function mailSubjectsShown(
  rows: MailTurn[],
  customer: { channel: AccountChannel },
): Map<string, boolean> {
  const shown = new Map<string, boolean>();
  let previous: string | undefined;
  for (const row of rows) {
    if (channelOfTurn(row, customer) !== 'email') continue;
    const subject = row.email?.subject;
    shown.set(row.id, Boolean(subject) && subject !== previous);
    previous = subject;
  }
  return shown;
}

/* ── ONE · IS THE HOUSE'S WHATSAPP NUMBER BOUND ───────────────────────────────── */

/**
 * THE ONE BOUND READ, AND IT IS THE PROVIDER'S (§246 · §247.2).
 *
 * ⚠ IT USED TO BE `provider || ledger`, AND AN `||` LETS THE WEAKER HALF WIN. The activation
 * ledger is append-only and has no revocation path at all, so one `whatsapp-connect` row — seeded
 * on the demo path by `activation.ts` — outvoted a live provider that was reporting nothing, for
 * the rest of that browser's life. `phone-capability.ts:16` forbids exactly this: live provider
 * evidence is the only input, and a seeded or drafted local status has no vote. History survives a
 * disconnect; it establishes nothing about what the house can send today.
 *
 * ⚠ AND THE WORKSPACE MATCH IS STRICT, WHICH IS THE OTHER HALF. `Connection.workspace` is
 * optional: the store holds `{wabaId, phoneId, number, name, coexistence}` from a completed
 * Embedded Signup and the field appears only once `bind_workspace()` has run. The permissive read
 * — «a connection naming no workspace counts here» — made one unbound signup bind the fish house,
 * the meat house and every other one at the same time. `whatsapp-capability.ts` holds the same
 * sentence for every other WhatsApp entrance; this is the composer's reading of it, and both are
 * `connection.workspace === sector` and nothing else.
 */
export const whatsappBoundNow = (a: {
  sector: string;
  /** `whatsappCapabilityOf(...).connection` — the provider's own answer, where one stands */
  connection?: { workspace?: string } | null;
}): boolean => Boolean(a.connection && a.connection.workspace === a.sector);

/* ── ONE-AND-A-HALF · WHAT SEAT STANDS UNDER THE CONVERSATION ─────────────────────────────────
 * ⚠ ONE RULE, TWO HOUSINGS, TWO COPIES OF IT. The Messages workspace computed `conversationWrites`
 * and the albarán's chip computed `writes`, out of the same three facts, in two files — and
 * `ChannelStanding.writes` stated the same thing a third time while no surface read it. A seat law
 * restated is a seat law that can drift. It lives here now and both housings call it.
 */

/** what stands under the stream: a composer, a Call action, or a line naming the account's door */
export type ConversationSeat = 'composer' | 'call' | 'note';

/** this conversation has an email door — a stored address, a mail account, or a mail turn in it.
 *  It is what makes «Reply by email instead» an honest offer rather than a button into nowhere. */
export function conversationEmailDoor(
  customer: { channel: AccountChannel; email?: string },
  rows: ChannelTurn[],
): boolean {
  return accountChannelOf(customer.channel) === 'email'
    || Boolean(customer.email)
    || rows.some((row) => channelOfTurn(row, customer) === 'email');
}

/** THE SEAT, DERIVED ONCE. A telephone account is answered by calling it; an account with no
 *  message door at all says where its orders come from, unless a mail door stands in it. */
export function conversationSeatOf(
  customer: { channel: AccountChannel; email?: string },
  rows: ChannelTurn[],
): ConversationSeat {
  const account = accountChannelOf(customer.channel);
  if (account === 'phone') return 'call';
  if (account === 'whatsapp' || account === 'email') return 'composer';
  return conversationEmailDoor(customer, rows) ? 'composer' : 'note';
}

/* ── TWO · WHICH CHANNEL, AND WHAT IT IS CALLED ───────────────────────────────────────────── */

export type ReplyChannel = 'whatsapp' | 'email' | 'phone';

/** why the channel is the channel — the one line the composer says under itself */
export type ChannelBecause =
  | 'reply-aimed'
  | 'account'
  | 'connected'
  | 'whatsapp-pending'
  /** the person pressed «Reply by email instead» on this conversation (clause 5) */
  | 'chosen-email'
  /** the conversation is a telephone one: call records, and a Call action */
  | 'call'
  /** the account has no message door — orders reach the house another way */
  | 'note';

/** the one explicit switch a conversation offers, where a second door honestly exists */
export type ChannelSwitch = { to: ReplyChannel; label: string };

/** WHERE A HOUSE GOES TO BIND ITS NUMBER — `areas/admin/connections.tsx` answers this tail by
 *  opening the WhatsApp connection itself. It stands beside the pending sentence exactly as
 *  `CONNECTIONS_EMAIL_HASH` stands beside the mailbox one, so a stated blocker is a press away
 *  from the place it is lifted. */
export const CONNECTIONS_WHATSAPP_HASH = '#/admin/connections/whatsapp';

export type ChannelStanding = {
  channel: ReplyChannel;
  because: ChannelBecause;
  /** the channel's own name, for the button and the accessible name */
  word: string;
  /** what the send control is called */
  sendLabel: string;
  /** what the mic does here, for the control's own accessible name */
  micLabel: string;
  /** the mic turns speech into WORDS IN THE BOX rather than into an audio payload */
  dictates: boolean;
  /** the quiet sentence beside the button, where the channel needs one said */
  note?: string;
  /** a composer stands on this conversation. A telephone conversation carries a Call action and
   *  a portal account carries a line naming its own door, and both of those are `false`. */
  writes: boolean;
  /** ROCOTO ITSELF can carry these words from the house's own identity right now. `writes` says a
   *  composer stands here; this says the house is bound behind it. It gates what ROCOTO performs
   *  — which is nothing today, so it is read as a STATEMENT: the line under the box, the one
   *  Connect act beside it, and the house number on the strip. The send disc is a different
   *  question and is live on both channels: it opens the channel's own door (`wa.me`, `mailto:`),
   *  which belongs to the person rather than to Rocoto. */
  canSend: boolean;
  /** clause 5 — the press that moves this reply to the other channel, and back */
  offer?: ChannelSwitch;
};

const WORD: Record<ReplyChannel, string> = { whatsapp: 'WhatsApp', email: 'Email', phone: 'Phone' };

/**
 * THE FIVE CLAUSES, IN ORDER. Pure, so the drive and the surface read the same answer.
 *
 * ⚠ `chose` IS THE PERSON'S OWN PRESS AND IT ONLY EVER WIDENS. It can move a WhatsApp reply to
 * email and move it back; it can never move an email account onto WhatsApp, because an email
 * account has no WhatsApp door to move to.
 */
export function replyChannelOf(a: {
  customer: Pick<Customer, 'channel'>;
  /** the conversation's account door is mail */
  mail?: boolean;
  /** Reply was pressed on an email in the thread (§196.7 clause 1) */
  aimedAtEmail?: boolean;
  /** the house's number is bound RIGHT NOW — `whatsappBoundNow`, and nothing else */
  whatsappBound: boolean;
  /** this conversation has an email door: a stored address, or a mail turn standing in it */
  emailStanding?: boolean;
  /** the mailbox this workspace holds is CONNECTED — `emailCapabilityOf(...).posture === 'ready'`,
   *  the email worker's own fold. It is what makes «Reply by email instead» an honest offer. */
  emailConnected?: boolean;
  /** what the person pressed on this conversation's own switch (clause 5) */
  chose?: ReplyChannel | null;
}): ChannelStanding {
  const account = accountChannelOf(a.customer.channel);
  const mail = Boolean(a.mail) || account === 'email';
  /* ── AN OFFER TO SWITCH IS A PROMISE THE OTHER CHANNEL WORKS (§246 acceptance 5 · §247.2) ───
     `canEmail` was `emailStanding || mail` — an address on the customer record, or a mail turn in
     the history. That is RECORD PROVENANCE, and it moved a person's reply onto a mailbox nobody
     had connected. The reverse offer checked nothing at all, so pressing it put the words back on
     an unbound WhatsApp under a live Send. A door this control opens has to be a door: the email
     offer needs the mailbox's own send authority beside the conversation's address, and the
     WhatsApp offer needs the house's number bound. */
  const emailDoor = Boolean(a.emailStanding) || mail;
  const canEmail = emailDoor && Boolean(a.emailConnected);
  /* ⚠ WHAT `canSend` IS, AND WHAT IT IS NOT — ONE CASE FOR BOTH CHANNELS (§246 acceptance 5).
     Both doors belong to the PERSON: `whatsappDoor` opens `wa.me` in their own WhatsApp,
     `mailDoor` opens `mailto:`/the provider's compose window in their own mail client. Neither is
     Rocoto delivering anything, so neither is withheld — a disc that went dead while the house's
     number was being confirmed told a person they could not reach their own WhatsApp, and took
     the control out of the tab order while it did so.
     What `canSend` answers is the other half: whether ROCOTO can send from the house's own
     identity right now. On WhatsApp that is the number Meta binds; on email it is the mailbox's
     own send authority, which `mailboxStanding` states under the composer in its own words. It
     gates what Rocoto performs — nothing today — so today it is read as a statement: the pending
     line, the one Connect act beside it, and the house number on the identity strip. */
  if (a.aimedAtEmail) return standing('email', 'reply-aimed', undefined, true);
  if (account === 'phone') return standing('phone', 'call', undefined, false);
  if (mail) return standing('email', 'account', undefined, true);
  if (account === 'note') {
    return emailDoor ? standing('email', 'account', undefined, true) : standing('email', 'note', undefined, false);
  }
  const offer: ChannelSwitch | undefined = canEmail
    ? { to: 'email', label: 'Reply by email instead' }
    : undefined;
  if (a.chose === 'email' && canEmail) {
    /* ⚠ THE WAY BACK IS AN UNDO, WHICH IS A DIFFERENT OBJECT FROM AN OFFER. Requiring a bound
       number here was considered and rejected: it would strand a person on a destination THEY
       chose, with the press that made the choice gone from under them. Clause 4 is explicit that
       a WhatsApp conversation keeps its WhatsApp composer «whether or not the house's number is
       bound». The harm the audit named for this direction — «put the reply back on an unbound
       WhatsApp with a live Send» — is answered in words rather than by a dead control: going back
       lands on a composer whose disc still opens WhatsApp's own door, under a line saying what
       Rocoto's own sending is waiting on, beside one Connect WhatsApp act. */
    return standing('email', 'chosen-email', { to: 'whatsapp', label: 'Reply on WhatsApp instead' }, true);
  }
  return standing('whatsapp', a.whatsappBound ? 'connected' : 'whatsapp-pending', offer, a.whatsappBound);
}

function standing(channel: ReplyChannel, because: ChannelBecause, offer: ChannelSwitch | undefined, canSend: boolean): ChannelStanding {
  /* ⚠ THE MIC DICTATES ON BOTH CHANNELS, AND THAT IS THE HONEST ANSWER RATHER THAN A SHORTCUT.
   * §196.7 asks for the transcribe mic «in email's case… as that would indicate it transcribes to
   * text in composer», which is exactly what it does here. It does the same on WhatsApp because
   * this app SENDS NOTHING on either channel — it hands the words to the channel's own door — so a
   * take that produced an audio payload with nowhere to go would be a recorder miming a feature.
   * Speech into words is useful on both (a comercial talks faster than they type) and true on
   * both. OWED: with the house's number bound and the runtime carrying audio, a WhatsApp take can
   * become a real voice note, and this is the one flag that has to move for it. */
  const dictates = true;
  return {
    channel,
    because,
    word: WORD[channel],
    sendLabel: channel === 'whatsapp' ? 'Send on WhatsApp' : 'Send by email',
    micLabel: 'Dictate — press and hold',
    dictates,
    /* A COMPOSER STANDS WHERE THERE IS A CHANNEL TO WRITE ON. A telephone conversation is
       answered by calling, and a portal account by the door its orders come through. */
    writes: because !== 'call' && because !== 'note',
    /* ⚠ WHETHER ROCOTO ITSELF STANDS BEHIND THIS CHANNEL (§246 acceptance 5). `whatsappBound` used
       to be consumed exactly once, to pick a `because` string, so a composer marked
       `data-bound="no"` said one thing in words and another in every control it drew. This is the
       fact those surfaces read: the pending line, the one Connect act beside it, and the house
       number on the identity strip. The send disc reads it no longer — it opens the channel's own
       door, which is the person's, and that stays live. */
    canSend,
    offer,
    /* ⚠ EVERY LINE HERE STATES WHAT IS, AND NAMES ITS OWN SUBJECT. The pending sentence used to
       read «WhatsApp sends once Meta confirms your number.» — which a reader takes as a condition
       on the green disc an inch above it, and that disc hands the words to WhatsApp's own door
       whatever Meta has confirmed. What is actually waiting is ROCOTO sending from the house's own
       number, so the sentence says that, and `shell/chats.tsx` stands the Connections door beside
       it the way the mailbox line does — a state a person can act on. */
    note:
      because === 'whatsapp-pending'
        ? 'Rocoto sends from your own number once Meta confirms it.'
        : because === 'reply-aimed'
          ? 'Answering the email above.'
          : because === 'chosen-email'
            ? 'This reply goes by email.'
            : because === 'call'
              ? 'This conversation happens by telephone.'
              : undefined,
  };
}

/* ── THREE · WHERE THE WORDS GO WHEN THE PERSON PRESSES SEND ──────────────────────────────── */

/**
 * ⚠ THE APP NEVER SENDS FOR THEM (§196.8: «the person sends»). Two honest outcomes and no third:
 * an AUTHORIZED provider accepted the words and said so with a receipt, or the channel's own door
 * opened carrying them. Anything the door could not carry stays in the box — MSG-24's own rule,
 * kept: an intent is never discarded by a handoff.
 */
export type HandoffResult =
  | { kind: 'sent'; says: string }
  | { kind: 'opened'; says: string; carried: boolean }
  | { kind: 'held'; says: string };

const digits = (number?: string): string => (number ?? '').replace(/[^\d]/g, '');

/** the customer's own WhatsApp door, carrying the words where the account has a number on it */
export function whatsappDoor(text: string, number?: string): { href: string; carried: boolean } {
  const to = digits(number);
  return to
    ? { href: `https://wa.me/${to}?text=${encodeURIComponent(text)}`, carried: true }
    : { href: 'https://web.whatsapp.com/', carried: false };
}

/** THE MAIL DOOR, CARRYING THE WORDS. The connected provider's own compose window where the
 *  conversation names one — the same two official hosts `email-provider.ts` already trusts — and
 *  `mailto:` otherwise, which is the one destination every account has. */
export function mailDoor(a: {
  provider?: 'gmail' | 'm365' | 'forwarded';
  to?: string;
  subject?: string;
  text: string;
}): { href: string; where: 'gmail' | 'outlook' | 'mailbox' } {
  /* ⚠ A NAME IS NOT AN ADDRESS. The kit's own mail fixtures carry the customer's trading name in
     `from`, because this build deliberately holds no real mailboxes — so a recipient goes into the
     door only when it actually is one, and the person picks it in their mailbox otherwise. Writing
     «to=Hotel Rec» would hand the mail client a recipient it can never resolve. */
  const to = a.to && a.to.includes('@') ? a.to : '';
  const subject = a.subject ?? '';
  if (a.provider === 'gmail') {
    return {
      href: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`
        + `&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(a.text)}`,
      where: 'gmail',
    };
  }
  if (a.provider === 'm365') {
    return {
      href: `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}`
        + `&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(a.text)}`,
      where: 'outlook',
    };
  }
  const query = [subject ? `subject=${encodeURIComponent(subject)}` : '', `body=${encodeURIComponent(a.text)}`]
    .filter(Boolean).join('&');
  return { href: `mailto:${encodeURIComponent(to)}?${query}`, where: 'mailbox' };
}

/* ── FOUR · THE MIC, AND WHAT A TAKE BECOMES ON THIS CHANNEL ──────────────────────────────── */

/** the honest states a dictation can be in — the Copilot's own five, lifted rather than re-chosen */
export type Dictation =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'said'; words: number }
  | { state: 'unreachable' }
  | { state: 'no-microphone' }
  | { state: 'failed' };

export const dictationLine = (d: Dictation): { text: string; loud: boolean } | null =>
  d.state === 'working' ? { text: 'Transcribing…', loud: false }
  : d.state === 'said' ? { text: `Dictated ${d.words} ${d.words === 1 ? 'word' : 'words'} into the box. Edit it, then send.`, loud: false }
  : d.state === 'unreachable' ? { text: 'Runtime offline · type the words here.', loud: true }
  : d.state === 'no-microphone' ? { text: 'Dictation needs this browser’s microphone. Type it here meanwhile.', loud: true }
  : d.state === 'failed' ? { text: 'Say it again, or type it here.', loud: true }
  : null;

/**
 * THE DICTATION MACHINE, exactly the Copilot's (`app/copilot/composer.tsx`) — one runtime call,
 * one honest state, words APPENDED to what is already written so a take never eats a draft.
 * ⚠ A FABRICATED TRANSCRIPT IS NEVER AN OPTION: with no runtime behind it the state says so and
 * the typing surface stays exactly as usable.
 */
export function useDictation(value: string, onChange: (next: string) => void) {
  const [dictation, setDictation] = React.useState<Dictation>({ state: 'idle' });
  const latest = React.useRef(value);
  latest.current = value;

  const append = React.useCallback((words: string): number => {
    const trimmed = words.trim();
    if (!trimmed) return 0;
    const current = latest.current.trimEnd();
    onChange(current ? `${current} ${trimmed}` : trimmed);
    return trimmed.split(/\s+/).length;
  }, [onChange]);

  const take = React.useCallback(async (recorded: Take) => {
    if (!recorded.blob) { setDictation({ state: 'no-microphone' }); return; }
    setDictation({ state: 'working' });
    try {
      const result = await kitRuntime.transcribe(recorded.blob);
      const count = append(result.transcript);
      setDictation(count ? { state: 'said', words: count } : { state: 'failed' });
    } catch (error) {
      setDictation(error instanceof RuntimeUnreachable ? { state: 'unreachable' } : { state: 'failed' });
    }
  }, [append]);

  return { dictation, take, reset: () => setDictation({ state: 'idle' }) };
}
