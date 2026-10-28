/** A TELEPHONE TURN, AS A CALL RECORD (FEED-IA §246 acceptance 5).
 *
 * ═══ WHY THIS EXISTS ════════════════════════════════════════════════════════════════════════
 * Peter, 2026-09-10: «Just think about whether any of the chats and stuff is actually
 * appropriate. Some chats are WhatsApp-based or email-based, and think about what people are
 * going to expect to see.» A man in a van rang the house and said twelve kilos of merluza. What
 * the app drew was a chat bubble with a green WhatsApp composer under it — a messenger idiom
 * standing in for a telephone call, and a send button pointed at a channel this customer has
 * never used.
 *
 * So a telephone turn is drawn as what it is: DIRECTION · HOUR · LENGTH · RESULT, with the
 * recording and its transcript one press below. The transcript organ is the app's own
 * (`VoiceNoteBody` → `Reading`), so the words a person reads here are the same words the
 * albarán's arrival plays and the search index already holds — one recording, two doors.
 *
 * ═══ WHAT IS NOT CLAIMED ════════════════════════════════════════════════════════════════════
 * This draws the SEEDED conversation's own telephone turns. A commissioned Twilio line's saved
 * calls are `phone-history.tsx`, read from the provider with its own sids and durations; the two
 * keep their own provenance and neither dresses itself as the other.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react';
import { VoiceNoteBody } from './shell/media';
import { clock, type ThreadTurn } from './shell/threads';
import { openPhoneDial } from './phone-session';
import { accountNumber } from './customer-profile';
import { whatsappDoor } from './reply-channel';
import type { Customer } from '../../scenarios/data/cast';

/** the turn's own hour, where it carries one — a call that happened at a time says the time */
const hourOf = (turn: ThreadTurn): string => turn.time ?? '';

/**
 * ONE CALL. The customer's own turn is INCOMING; the house's is what it made.
 *
 * ⚠ THE RESULT IS READ OFF THE RECORD RATHER THAN DECIDED HERE. A turn carrying a recording is a
 * call that was answered and kept; a turn carrying only words is a call somebody wrote a note
 * about. Both are true things and the card says which it has.
 */
export function CallRecord({ turn, who, testid = 'call-record' }: {
  turn: ThreadTurn;
  /** the other end of the line, for the transcript's own speaker labels */
  who: string;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const incoming = turn.author === 'received';
  const length = turn.voice ? clock(turn.voice.durationMs) : '';
  const said = [who, hourOf(turn), length].filter(Boolean).join(' · ');
  return (
    <article
      data-testid={testid}
      data-call-turn={turn.id}
      data-direction={incoming ? 'inbound' : 'outbound'}
      data-transcript={turn.voice?.transcript ? 'saved' : 'pending'}
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        backgroundColor: theme.colors.backgroundPrimary,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* ⚠ THE RESULT SITS WITH THE FACTS, NOT IN A COLUMN OF ITS OWN. A third `auto` column took
          «Answered · transcript saved» out of the flow, and at 320 it squeezed the middle column
          until «Incoming call» broke across two lines and the length of the call broke across
          four. Seen at 320, then changed: one content column, and the two fact lines wrap inside
          it the way any sentence does. */}
      <header
        style={{
          display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', alignItems: 'center',
          gap: theme.sizing.scale400, padding: theme.sizing.scale500, minWidth: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 40, height: 40, display: 'grid', placeItems: 'center',
            borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          {incoming ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
        </span>
        <span style={{ minWidth: 0 }}>
          <strong data-testid={`${testid}-direction`} style={{ ...theme.typography.LabelMedium, display: 'block' }}>
            {incoming ? 'Incoming call' : 'Outgoing call'}
          </strong>
          {/* ⚠ IT WRAPS RATHER THAN ELLIPSISING. At 390 «Can Padrós · 08:29 · 0:09» came out as
              «Can Padrós · 08:29 …» — the length of the call, which is half of what a call record
              is for, cut off by a one-line rule that only earns its place on a fixed-width row.
              Measured on the phone, then changed. */}
          <span
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', minWidth: 0,
              columnGap: theme.sizing.scale400, rowGap: theme.sizing.scale100,
              marginTop: theme.sizing.scale200,
            }}
          >
            <span
              style={{
                ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary,
                minWidth: 0, overflowWrap: 'anywhere',
              }}
            >
              {said}
            </span>
            <span
              data-testid={`${testid}-result`}
              style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
            >
              {turn.voice ? 'Answered · transcript saved' : 'Answered'}
            </span>
          </span>
        </span>
      </header>
      <div style={{ padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale500}`, minWidth: 0 }}>
        {turn.voice
          ? <VoiceNoteBody note={turn.voice} testid={`${testid}-recording`} />
          : <p style={{ ...theme.typography.ParagraphSmall, margin: 0, overflowWrap: 'anywhere' }}>{turn.text}</p>}
      </div>
    </article>
  );
}

/**
 * WHERE A COMPOSER WOULD STAND ON A TELEPHONE CONVERSATION — the act that actually answers it.
 *
 * It goes through the app's one dial door (`openPhoneDial`), carrying this customer and the number
 * this account is actually reached on, so the call entrance is the same one the header's keypad and
 * the customer sheet use and the connection state is read in one place.
 */
export function CallDock({ customer, says, testid = 'call-action' }: {
  customer: Customer;
  /** the quiet sentence beside the act, where the conversation needs one said */
  says?: string;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={`${testid}-dock`}
      data-channel="phone"
      style={{
        display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap',
        minWidth: 0, padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
      }}
    >
      <Button
        kind={KIND.secondary}
        size={SIZE.compact}
        data-testid={testid}
        startEnhancer={() => <Phone size={16} aria-hidden />}
        onClick={() => {
          /* §196.6 — A TELEPHONE ACCOUNT'S NUMBER IS DERIVED, NOT STORED. `customer.phone` is
             undefined on every seeded telephone account, so this act opened the dial with an empty
             field, no customer selector and a dead Call button on a commissioned workspace. The
             sheet's own entrance resolves the same pair; this one now says it too, through the one
             door, which also keeps the surface it was pressed on standing. */
          openPhoneDial({ number: customer.phone?.trim() || accountNumber(customer), customerId: customer.id });
        }}
        overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
      >
        Call {customer.name}
      </Button>
      {says && (
        <span
          data-testid={`${testid}-says`}
          style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: 1, minWidth: 0 }}
        >
          {says}
        </span>
      )}
    </div>
  );
}

/**
 * AND AN ACCOUNT WITH NO MESSAGE DOOR SAYS WHERE ITS ORDERS COME FROM. A portal account and a
 * customer who orders across the counter both reach the house another way; a composer under their
 * conversation would point a person's words at a channel that account has never used.
 *
 * ═══ AND IT KEEPS AN ACT (FEED-IA §246 acceptance 5) ════════════════════════════════════════
 * The first pass took the composer away and put nothing in its place, so a merchant looking at a
 * portal customer's Delivery Note had the sentence and the way out and nothing else. The ladder is
 * three rungs and the surface picks the highest honest one:
 *
 *   1 · THE ACCOUNT HAS AN ADDRESS  → `replyChannelOf` gives it an email composer, and this
 *                                     component never mounts (`source-thread.tsx`'s `writes`).
 *   2 · THE ACCOUNT HAS A NUMBER    → the WhatsApp door, BEHIND AN EXPLICIT PRESS, which is what
 *                                     keeps «Channel changes must be explicit» true: the words
 *                                     travel because a person decided they should.
 *   3 · THE ACCOUNT HAS NEITHER     → the sentence, with «Open chat» in the chip's own header as
 *                                     the way into the whole conversation.
 */
export function ChannelNote({ customer, testid = 'channel-note' }: { customer: Customer; testid?: string }) {
  const [, theme] = useStyletron();
  const door = customer.channel === 'portal' ? 'through the portal' : 'in person';
  return (
    <div
      data-testid={`${testid}-dock`}
      data-channel="note"
      data-act={customer.phone ? 'whatsapp' : 'none'}
      style={{
        display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap',
        minWidth: 0, padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
      }}
    >
      <p
        data-testid={testid}
        style={{
          ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, minWidth: 0,
          margin: 0, flex: 1,
        }}
      >
        {customer.name} orders {door}.
      </p>
      {customer.phone && (
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          data-testid={`${testid}-whatsapp`}
          onClick={() => {
            window.open(whatsappDoor('', customer.phone).href, '_blank', 'noopener,noreferrer');
          }}
          overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
        >
          Reply on WhatsApp
        </Button>
      )}
    </div>
  );
}
