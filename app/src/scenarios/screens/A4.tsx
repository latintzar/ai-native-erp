/* A4 · Admit an unknown sender.
 *
 * THE PUREST SECTOR-INVARIANT CARD IN THE CATALOGUE. A stranger has no species, no calibre and no
 * lote — the whole card is a number, a message and a decision, and the sector switch changes
 * nothing on it but the order underneath.
 *
 * POSITIVE SPACE. What the product can honestly show about a stranger: the number their message
 * came from, what they wrote, and the one piece of evidence it genuinely has — that a name in the
 * message matches a customer already on the books. Then the three acts: admit them, hold them, or
 * decline. Admitting creates the record, and the record is the card's second exit.
 *
 * A STRANGER HAS NO ENTRY IN `cast.ts`, AND THAT IS THE CARD'S SUBJECT (law 10's one honest
 * boundary). Every name on this screen still comes from the cast; what does not is the sender's
 * phone number, which is precisely the fact that no name exists yet. The moment Admit is pressed a
 * record exists — and from that moment the name on screen is read from the cast like every other.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { FormControl } from 'baseui/form-control';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface from '../canonical/order-surface';
import { GThread } from '../ghosts/regions';
import RefChip from '../shell/RefChip';
import Name from '../shell/Name';
import type { Cast, Customer, Order } from '../data/cast';
import { customerOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A4',
  title: 'Admit an unknown sender',
  group: 'A',
  frame: 'desk',
  ifText: 'senders never seen before are held, and this message came from a number with no record',
  dims: ['D2.new-customers'],
  job: 'Decide whether the number that just wrote becomes a customer.',
  decides:
    'whether a stranger becomes a record — with everything the product honestly knows about them beside the choice: the number, their words, and the name in the message that matches a customer already on the books',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the order and its lines', ref: 'A1' },
    { region: 'the rest of the record this creates', ref: 'J1a' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U01'],
  kit: ['Button', 'Input', 'Form Control', 'Message', 'Transcript', 'Overlay Card', 'Figure', 'Tag', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'the identity gate replaces the confirm gesture, and the card gains a second exit — the record',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1, 4],
  step: 2,
  fills: ['record'],
  reads: ['record'],
  live:
    'press Admit and the record appears inline with the number and the matched name already in it, editable, while the reason line changes to name the record just created; Hold and Decline each state where the message stands afterwards',
};

/** The sender, as the product has them: a number on a channel, and nothing else yet. `tier` is the
 *  fourth fact the head carries, and for a stranger the honest fourth fact is that this is their
 *  first message. */
const SENDER = { number: '+34 611 20 84 37', channel: 'WhatsApp' as const };

type Verdict = 'waiting' | 'admitted' | 'held' | 'declined';

export default function A4() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [verdict, setVerdict] = React.useState<Verdict>('waiting');

  /* the matched name — the one piece of evidence the product genuinely holds about a stranger */
  const matched = customerOf(cast, 'nou');
  const [name, setName] = React.useState(matched.name);
  const [phone, setPhone] = React.useState(SENDER.number);

  React.useEffect(() => {
    setVerdict('waiting');
    setName(matched.name);
    setPhone(SENDER.number);
  }, [cast.sector, matched.name]);

  /* The stranger stands in the cast for the length of this screen, so the order surface reads
     their identity exactly the way it reads everybody else's — through `cast.ts` and `Name`. */
  const stranger: Customer = {
    id: '__sender',
    name: SENDER.number,
    channel: SENDER.channel,
    tier: 'first message',
    settles: 'credit',
  };
  const castWithSender: Cast = { ...cast, customers: [...cast.customers, stranger] };
  const order: Order = {
    ...cast.order,
    customer: '__sender',
    words: [cast.order.words[0], `It's for ${matched.name}.`],
  };

  const reason =
    verdict === 'admitted' ? (
      <>
        Record created — {name}, {phone}. <RefChip to="J1a">their page</RefChip>
      </>
    ) : verdict === 'held' ? (
      <>Held for you. The order waits here and the thread stays open.</>
    ) : verdict === 'declined' ? (
      <>Declined. Their message stays in the thread, and the number can write again.</>
    ) : (
      <>
        First message from this number, at {order.placedAt}. It names{' '}
        <Name of={matched} />, a customer you already have.{' '}
        <RefChip to="J1a">their page</RefChip>
      </>
    );

  return (
    <DeskChassis dossier selected={0} rows={11} height={920}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={castWithSender}
            order={order}
            reason={reason}
            /* THE IDENTITY GATE, IN THE PLACE THE CONFIRM GESTURE OCCUPIES ON A1. Three acts, and
               the order underneath is not confirmed by any of them — admitting a sender and
               confirming their order are two decisions, and this card holds one. */
            primary={
              verdict === 'waiting' ? (
                <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
                  <Button kind={KIND.primary} size={SIZE.large} onClick={() => setVerdict('admitted')}>
                    Admit
                  </Button>
                  <Button kind={KIND.secondary} size={SIZE.large} onClick={() => setVerdict('held')}>
                    Hold
                  </Button>
                  <Button kind={KIND.tertiary} size={SIZE.large} onClick={() => setVerdict('declined')}>
                    Decline
                  </Button>
                </div>
              ) : undefined
            }
            /* THE SECOND EXIT. The record the decision creates, drawn where it is created and
               editable on the spot — the two fields A4 fills, with the page that holds the rest. */
            exits={
              verdict === 'admitted' ? (
                <div
                  style={{
                    border: `1px solid ${theme.colors.borderOpaque}`,
                    borderRadius: theme.borders.radius300,
                    padding: theme.sizing.scale500,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.sizing.scale400,
                    /* the ground stays PAPER, because Base's Input carries the secondary ground
                       itself — a field on a secondary block is a field nobody can see */
                    background: theme.colors.backgroundPrimary,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
                    <span style={theme.typography.LabelMedium}>The record</span>
                    {/* Base's Tag truncates, so the word on it is one word */}
                    <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                      Created
                    </Tag>
                    <RefChip to="J1a">everything else on it</RefChip>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale500 }}>
                    <FormControl label="Name" caption="read from the message">
                      <Input
                        size={INPUT_SIZE.compact}
                        value={name}
                        onChange={(e) => setName(e.currentTarget.value)}
                      />
                    </FormControl>
                    <FormControl label="Number" caption="the channel it wrote on">
                      <Input
                        size={INPUT_SIZE.compact}
                        value={phone}
                        onChange={(e) => setPhone(e.currentTarget.value)}
                      />
                    </FormControl>
                  </div>
                </div>
              ) : undefined
            }
          />
        </div>
        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
