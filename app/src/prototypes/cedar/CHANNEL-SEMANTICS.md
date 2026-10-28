# Channel semantics — what a conversation shows, and where a reply goes

FEED-IA §246 acceptance 5, on top of §196.7. Peter, 10 September 2026:

> Just think about whether any of the chats and stuff is actually appropriate. Some chats are
> WhatsApp-based or email-based, and think about what people are going to expect to see. Also, what
> are the places for each chat? If the chat screen is supposed to be crowded but it's not, ask if it
> is appropriate.

One rule, said once: **a turn is drawn as the thing it was, and a reply leaves on the channel the
person chose.** The law is [`reply-channel.ts`](reply-channel.ts); every surface reads it and none
of them keeps a second copy.

## 1 · Each turn states its own channel

`channelOfTurn(row, customer)` answers `whatsapp | email | phone | note`, in this order:

| Read | Fact | Why it is first |
| --- | --- | --- |
| `row.source.channel` | provider provenance, written by the intake ledger | the only fact here that came from outside the app |
| `row.email` | mail metadata — subject, sender, recipients, provider source | a turn carrying mail is mail, whatever the account usually does |
| the account's own door | `accountChannelOf(customer.channel)` | the default, never the answer |

`in person` and `portal` accounts carry no message channel, so `accountChannelOf` maps them to
`note` — a record of something that happened elsewhere. `isCallTurn` is the narrower predicate: a
CUSTOMER's turn on a telephone account, recorded or written down.

⚠ It used to require the recording, and that left one fabricated WhatsApp source standing.
`spoken()` ([`shell/threads.ts`](shell/threads.ts)) turns the FIRST received row of each sale into
a recording, and `withQuestion` ([`sale.ts`](sale.ts)) can append a SECOND received row to a day
order — so a customer's follow-up question on a telephone account had nothing to be drawn as
except a chat bubble, inside a conversation with no chat channel. `CallRecord` already carried the
branch for a turn with only words (`turn.voice ? VoiceNoteBody : <p>{turn.text}</p>`); the
predicate is what makes it reachable. Rocoto's own reading (`ai`) and the house's own note (`sent`)
keep the existing trail rendering: they are what the app did about the call, rather than the call.

**How far this reaches today, measured rather than assumed.** Every telephone conversation in the
seeded fish day — 80 of them, swept at 1600 on a build with the old predicate and again on this one
— draws every customer turn as a call record, because the fixtures record each one. So this repairs
a path the fixtures do not currently walk. `[data-turn][data-turn-author][data-turn-drawn]` is what
makes the claim checkable at all: the kit's bubble carries its author as a style prop only, so a
reader counting `[data-author]` was reading the MAIL card's attribute and calling every telephone
conversation clean.

**The label is written once.** `channelWord(customer.channel)` gives `WhatsApp · Phone · Email ·
Portal · In person`. The cast stores `portal` and `in person` in lower case because they are DATA;
the Delivery Note chip and the Messages thread header both read this function, so one channel has
one word on every surface.

**The subject is printed where it changes.** `mailSubjectsShown(rows, customer)` walks the MAIL
turns and answers which of them print their `<h4>`: the first, and each one that changes the
subject. A WhatsApp bubble standing between two mails on one subject changes no subject. Both
housings read it — `EmailConversation`, which always had the rule inline, and the chat stream,
which had been mounting the extracted card with «print it whenever there is one».

**What each turn looks like.**

- **WhatsApp** — the app's own bubble, grouped, with delivery state on the turns this house sent
  ([`shell/chats.tsx`](shell/chats.tsx)'s stream, `rocoto/message`).
- **Email** — `EmailTurnCard` ([`email-thread.tsx`](email-thread.tsx)): sender, subject where it
  changes, recipients, the words, `SourceAttachment` expansion, and **Reply**, which aims this
  conversation's composer at that message.
- **Phone** — `CallRecord` ([`call-record.tsx`](call-record.tsx)): direction, who, hour, length,
  result, the recording, and the transcript one press below it. The transcript organ is the app's
  own (`VoiceNoteBody` → `Reading`), so the words here are the words the albarán's arrival plays.
- **Note** — the bubble, with `ChannelNote` under the conversation saying where the orders come
  from. A portal account keeps its own door rather than borrowing WhatsApp's.

A roleplay (`thread.test`) is exempt: it is the operator emulating one customer through one
emulated channel, so its turns stay bubbles.

## 2 · The reply target is the conversation's, and a change is a press

`replyChannelOf` returns a `ChannelStanding` — five clauses, in order:

1. **Reply aimed at an email is an email** (`reply-aimed`).
2. **A telephone account is answered by calling it** (`call`, `writes: false`). The surface mounts
   `CallDock`, which walks [`phone-route.ts`](phone-route.ts)'s `phoneDialRoute`, so every call
   entrance reads one connection state.
3. **An email account answers by email** (`account`).
4. **Otherwise it is WhatsApp** (`connected` when the house's number is bound now,
   `whatsapp-pending` while it is being confirmed) — the channel is the same either way.
5. **And the person may send it by email instead** (`chosen-email`), where this conversation has an
   email door. Pressing it again puts the reply back.

⚠ Clause 4 changed shape. It used to read «if whatsapp isnt hooked up, it's email» as an automatic
fallback, which moved a person's words into a mailbox without telling them, on a conversation the
customer reads on their phone. §246 supersedes that: «Channel changes must be explicit.» The
composer prints the outcome as `data-channel`, the reason as `data-because`, and whose choice it was
as `data-chose`.

### Acceptance 5's «compact order summaries preserve the source message and composer», read exactly

The Delivery Note chip keeps the source message whole in every case. The WRITING SURFACE follows
the account's own door, because a composer that points a person's words down a channel the account
has never used is a promise the app cannot keep — the portal customer would never receive it. So
the chip picks the highest honest rung of a three-rung ladder, and there is no rung with nothing
on it:

| The account has | What stands under the compact summary |
| --- | --- |
| a message channel (WhatsApp · email) | the composer, on that channel |
| a telephone line | `CallDock` — **Call {name}**, walking `phoneDialRoute` |
| a stored email address | the composer, by email (`replyChannelOf` clause 3) |
| a stored number, and no address | `ChannelNote` plus **Reply on WhatsApp**, an explicit press |
| neither | `ChannelNote`, with **Open chat** in the chip's own header as the way in |

Today's seeded cast stores neither `phone` nor `email` on a customer, so every portal and in-person
account lands on the last rung: the sentence, and the whole conversation one press away. The rung
the surface is standing on is printed as `[data-testid=channel-note-dock][data-act]`.

**The chip owns the aim it can act on.** Reply on a mail turn inside the chip hands the aim UP to
[`source-thread.tsx`](source-thread.tsx), which is where the composer lives (`onAimMail` /
`aimedMailAt` through `EmbeddedConversation`). Where the chip stands no composer, the aim is
withheld and `EmailTurnCard` paints no Reply at all — a button that flips to «Replying» and changes
nothing is worse than no button.

## 3 · What «bound» is read off, and what it decides

`whatsappBoundNow` folds exactly ONE fact, and the composer prints the answer as `data-bound`: the
live connection — `whatsappCapabilityOf(...).connection`, the polled `/state` answer whose
`workspace` IS this workspace ([`whatsapp-capability.ts`](whatsapp-capability.ts)).

Two other pieces of evidence used to stand here and both are gone. `activation.ts`'s
`whatsapp-connect` ledger entry is append-only and the demo path writes it, so a local row outvoted
a live provider reporting nothing, for the rest of that browser's life; `phone-capability.ts:16`
forbids exactly that, and the WhatsApp half is held to the same rule. `arrivedOnWhatsapp` counted
any received turn without mail metadata, so a telephone order and a seeded fixture row both read as
a bound WhatsApp number. An old incoming message is **history**, and history survives a disconnect.

⚠ **The workspace match is strict, and a connection naming no workspace binds none.**
`Connection.workspace` is optional: the store holds a completed Embedded Signup as
`{wabaId, phoneId, number, name, coexistence}` and the field appears only once `bind_workspace()`
has run. Reading a missing field as «this one counts here» made a single unbound signup bind the
fish house, the meat house and every other at once — the weak evidence this whole change exists to
remove. `whatsapp-connection.tsx` has always required `connection?.workspace === cast.sector`; that
is now the one rule, in the one place every surface reads.
[`test-reply-channel.mjs`](../../../tools/test-reply-channel.mjs) covers the missing field, the
matching workspace, another workspace's, and no connection at all.

In the demo's own house that fact stands for nobody: a static build answers `/api/proof/session`
with a 404, so the snapshot never lands. An unauthenticated browser reads `data-bound="no"` and
`data-because="whatsapp-pending"`, the conversation keeps its WhatsApp composer, and the line under
the box says **Rocoto sends from your own number once Meta confirms it.** — with a
**Connect WhatsApp** press beside it, walking to `#/admin/connections/whatsapp`.

**Why the sentence names Rocoto's own sending.** It used to read «WhatsApp sends once Meta confirms
your number.», which a reader takes as a condition on the green disc an inch above it — and that
disc hands the words to WhatsApp's own door whatever Meta has confirmed, so the app told them a
press would wait and it did not. What is actually pending is Rocoto sending from the house's own
number. And a stated blocker carries the door that lifts it, exactly as the mailbox line has since
OUT-05.4: the state is now something a person can act on rather than something they are told.

### The send disc opens the channel's own door, on both halves of this file

⚠ **`canSend` is about ROCOTO, and the disc is about the person.** The two channels are one case,
and it is worth writing down because the file once argued both sides of it:

| | WhatsApp | Email |
| --- | --- | --- |
| Where the disc sends the words | `wa.me` / `web.whatsapp.com`, the person's own WhatsApp | `mailto:` or the provider's compose window, the person's own mail client |
| Who delivers them | the person, in that app | the person, in that app |
| Is the disc live | yes, in every posture | yes, in every posture |
| What `ChannelStanding.canSend` says | the house's number is bound, so ROCOTO could send from it | the mailbox holds its own send authority (`mailboxStanding`) |
| Where a person reads that | the line under the box, and the one **Connect WhatsApp** act beside it | the mailbox line under the box, and its own act |

Withholding `onSend` to dim the disc was built, measured and removed. The kit renders a withheld
send as `disabled` ([`rocoto/composer/composer.tsx`](../../rocoto/composer/composer.tsx)), which
takes it out of the tab order, leaves `Enter` with words in the box doing nothing at all, and says
the person cannot reach their own WhatsApp — which is untrue, and is the same sentence the email
half has always rejected. What waits is Rocoto's own sending, and that is said in words.
`drives/drive-cedar-channels.py` presses the disc on an unbound conversation and asserts all three
halves of the law: the channel's real door opens, the conversation gains no turn, and the pending
line and its act are still standing afterwards.

## 4 · Where each seat stands

| Housing | Source | What stands under the conversation |
| --- | --- | --- |
| Messages workspace | `ThreadView` in [`shell/chats.tsx`](shell/chats.tsx) | composer · `CallDock` · `ChannelNote`, by the account's own door |
| Mail workspace | `WorkspaceConversation` | the read-only record, with the composer beside it |
| Delivery Note chip | [`source-thread.tsx`](source-thread.tsx) | the same three seats, on the document's own draft key |
| Connected accounts | [`connected-inbox.tsx`](connected-inbox.tsx) | the provider's own imported history, with its own call list ([`phone-history.tsx`](phone-history.tsx)) |

The compact order summary on the Delivery Note keeps the source message whole and the act reachable
— the ladder in §2 says which act; at 390 and 320 the composer stays on screen with the keyboard up.
A telephone conversation carries `CallDock` in BOTH housings, which is the half no drive read until
`walk_phone_workspace`: `CallDock` mounts in `ThreadView`'s own dock, so the Messages workspace
could have drawn a WhatsApp composer over a telephone account with every check still green.

## 5 · What a drive reads

⚠ **Every `data-channel` on these surfaces is the LOWERCASE canonical value** — `whatsapp · email ·
phone · note` — which is `TurnChannel`, the type. The chip used to print the cast's own
`customer.channel`, so it said `WhatsApp` and `portal`; a saved selector keyed to that casing stops
matching, with no error, which is why the value set is written down here. `data-channel` outside
these surfaces still carries its own vocabulary and says so: `[data-copilot-row=order]`
([`copilot/flows.tsx`](copilot/flows.tsx)) and `[data-testid=arrival]`
([`detail.tsx`](detail.tsx), which adds `desk`) both print the cast value.

| Attribute or testid | Says |
| --- | --- |
| `[data-testid=conversation][data-channel]` | the chip's account channel — `whatsapp · email · phone · note` |
| `[data-testid=reply-composer][data-channel]` | where this reply goes — `whatsapp · email` |
| `…[data-because]` | which clause decided it |
| `…[data-bound]` | whether the house's number is bound right now |
| `…[data-chose]` | whose choice moved it |
| `[data-testid=composer-channel-state]` | the send state, in full, wrapping, in its own element |
| `[data-testid=reply-composer-connect-whatsapp]` | the Connections press beside that state |
| `[data-testid=reply-composer-connect-mailbox]` | the mailbox's own, the line this one copies |
| `[data-testid=reply-composer-switch-act]` | the one explicit switch |
| `[data-turn][data-turn-author]` | whose turn this row is — `received · sent · ai` |
| `…[data-turn-drawn]` | how it was drawn — `call · mail · bubble` |
| `[data-call-turn][data-direction][data-transcript]` | one call record |
| `[data-testid=call-action]` · `[data-testid=call-action-says]` | the Call act that replaces a composer, and its sentence |
| `[data-testid=channel-note]` | where an account with no message door gets its orders |
| `[data-testid=channel-note-dock][data-act]` | which rung of the note's ladder is standing — `whatsapp · none` |
| `[data-testid=channel-note-whatsapp]` | the explicit WhatsApp press, where a number is stored |

Proofs: [`test-reply-channel.mjs`](../../../tools/test-reply-channel.mjs) for the pure law (51
checks), and `drives/drive-cedar-channels.py` for the painted surfaces at 1600 · 390 · 320 — the
WhatsApp conversation, the mail room, the chip, the telephone order in BOTH its housings, the
account with no message door, the mixed customer's explicit switch, and the phone keyboard.
`drives/drive-197-hybrid-composer.py` holds the composer's own geometry and colour at seven widths;
its two §246 rewrites and the `connected` source flip are recorded in
[`drives/README.md`](../../../../docs/omitted-sources.md).

## 6 · What is not claimed

`CallRecord` draws the seeded conversation's telephone turns. A commissioned Twilio line's saved
calls are `phone-history.tsx`, read from the provider with its own sids and durations; the two keep
their own provenance and neither dresses itself as the other. Handing words to a channel's own door
is a handoff, never a receipt — the words stay in the box
([`EMAIL-IMPLEMENTATION.md`](EMAIL-IMPLEMENTATION.md) holds the mail half of that rule).
