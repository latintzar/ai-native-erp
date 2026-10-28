/* D4s · An order exceeds what is available.
 * desk · canonical `substitution` — CONTROL DELTA: the collision notice stands above the
 * alternatives.
 *
 * WHAT IS OVER, BY HOW MUCH, AND WHO ELSE IS ALREADY WAITING ON THE SAME STOCK. The last fact is
 * the one that makes this a decision instead of an error: 12 kg against 8 kg is arithmetic, and
 * anybody can do it. «12 kg against 8 kg, and two other customers are holding 5 of those 8 since
 * 06:20» is a morning, and it is what the person actually needs before they answer anybody.
 *
 * NOTHING MOVES ON ITS OWN. The notice states and never reallocates — no queue is re-cut, no
 * customer is silently trimmed. The screen's only act is the door.
 *
 * A ROW IS A DOOR — FORWARD AND SIDEWAYS, NEVER BACK (law 9). D3s opens IN PLACE, under the
 * notice, on the same screen: the person does not navigate away from the collision to answer it,
 * because the collision is the reason the offer is being made and it should stay legible while
 * the offer is chosen.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Substitution, { type Alternative } from '../canonical/substitution';
import { Figure } from '../../rocoto/figure';
import { Message } from '../../rocoto/message';
import { Composer } from '../../rocoto/composer';
import RefChip from '../shell/RefChip';
import { GLines, GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { customerOf, productOf } from '../data/cast';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'D4s',
  title: 'An order exceeds what is available',
  group: 'D',
  frame: 'desk',
  ifText: 'an order asks for more of a product than there is',
  dims: ['D11.published', 'D11.declared'],
  job: 'Show what is over and who else is waiting on the same stock.',
  decides:
    'that a shortage is stated with its whole claim list — who is already holding the stock and since when — and that nothing is reallocated on its own',
  inherits: [
    { region: 'the alternatives panel', ref: 'D3s' },
    { region: 'the order the line belongs to', ref: 'A1' },
    { region: 'today’s list the claims are against', ref: 'D2s' },
  ],
  open: [{ region: 'the day’s orders behind this one', ref: 'OPEN-1' }],
  primitives: ['U11'],
  kit: ['Figure', 'Message', 'Composer', 'Button', 'Tag', 'Ghost'],
  canonical: 'substitution',
  delta: 'control',
  deltaText: 'the collision notice stands above the alternatives, and the alternatives wait behind a door',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [3, 1],
  step: 7,
  fills: [],
  reads: ['record', 'lot.qty'],
  live:
    'read the collision and who is holding the stock, then open the alternatives in place — the notice stays legible while the offer is chosen',
};

/** Who else is already holding this stock, and since when. Deterministic by position, so the same
 *  morning has the same claims every time the card is opened. */
const CLAIMS = [
  { share: 0.38, at: '06:20' },
  { share: 0.25, at: '06:44' },
];

const WORKING_MARGIN = 1.42;

export default function D4s() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const customer = customerOf(cast, cast.order.customer);
  const line = cast.order.lines[0];
  const product = productOf(cast, line.product);

  /* what today's list actually holds of it, and what is already spoken for */
  const onHand = Math.max(1, Math.round(line.qty * 0.65));
  const claims = CLAIMS.map((c, i) => ({
    customer: cast.customers.filter((x) => x.id !== customer.id)[i],
    qty: Math.max(1, Math.round(onHand * c.share)),
    at: c.at,
  }));
  const held = claims.reduce((s, c) => s + c.qty, 0);
  const free = Math.max(0, onHand - held);
  const over = Math.max(0, line.qty - free);

  const alternatives: Alternative[] = React.useMemo(
    () =>
      cast.products
        .filter((p) => p.id !== product.id)
        .slice(0, 3)
        .map((p, i) => {
          const batch = cast.batches.find((b) => b.product === p.id);
          const other = cast.order.lines.find((l) => l.product === p.id);
          const cost = batch ? batch.cost : Math.round((cast.batches[0].cost + i * 2) * 100) / 100;
          const price = other ? other.price : Math.round(cost * WORKING_MARGIN * 100) / 100;
          return {
            id: p.id,
            name: <Name of={p} />,
            plain: p.name,
            detail: batch ? `lote ${batch.id} · ${batch.day}` : undefined,
            evidence: `${[11, 7, 2][i % 3]} of their last 16 orders`,
            available: batch ? batch.qty : 22 + i * 8,
            unit: p.unit,
            price,
            cost,
          };
        }),
    [cast, product.id],
  );

  const [open, setOpen] = React.useState(false);
  const [offered, setOffered] = React.useState<string | null>(null);
  const [words, setWords] = React.useState('');
  const [sentence, setSentence] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOpen(false);
    setOffered(null);
    setWords('');
    setSentence(null);
  }, [cast.sector]);

  return (
    <DeskChassis dossier selected={2} rows={10} height={880}>
      {/* THE FLOOR. The alternatives carry four figures and a control on one row; below this the
          row wraps a name one word per line, so the stage scrolls sideways instead. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(560px, 1fr) 220px', gap: theme.sizing.scale600, minWidth: 800 }}>
        <Substitution
          wanted={{
            name: <Name of={product} />,
            qty: line.qty,
            unit: line.unit,
            available: free,
          }}
          alternatives={alternatives}
          behindDoor={!open}
          onOpen={() => setOpen(true)}
          openLabel="Offer something else"
          offered={offered}
          onOffer={(a) => {
            setOffered(a.id);
            setWords(
              `I have ${free} ${line.unit} of ${product.name} left for ${cast.order.deliveryDay}. ` +
                `I can put ${over} ${line.unit} of ${a.plain} against the rest at ` +
                `${a.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${a.unit} — shall I?`,
            );
          }}
          thread={
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
              <div style={{ ...theme.typography.LabelSmall }}>
                <Name of={customer} /> · {customer.channel} · {cast.order.placedAt}
              </div>
              <Message author="received" time={cast.order.placedAt}>
                {cast.order.words[0]}
              </Message>
            </div>
          }
          notice={
            /* THE COLLISION. It states, and it changes nothing. */
            <section
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.sizing.scale400,
                padding: theme.sizing.scale500,
                borderRadius: theme.borders.radius300,
                border: `1px solid ${theme.colors.contentPrimary}`,
              }}
            >
              <header style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={theme.typography.LabelMedium}>Over by</span>
                <Figure value={over} unit={line.unit} decimals={0} size="large" />
              </header>

              <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                    gap: theme.sizing.scale400,
                    padding: `${theme.sizing.scale200} ${theme.sizing.scale400}`,
                    background: theme.colors.backgroundSecondary,
                    ...theme.typography.LabelXSmall,
                    color: theme.colors.contentTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <span>Already holding it</span>
                  <span style={{ textAlign: 'right' }}>Held</span>
                  <span style={{ textAlign: 'right' }}>Since</span>
                </div>
                {claims.map((c) => (
                  <div
                    key={c.customer.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                      gap: theme.sizing.scale400,
                      alignItems: 'baseline',
                      padding: `${theme.sizing.scale300} ${theme.sizing.scale400}`,
                      borderTop: `1px solid ${theme.colors.borderOpaque}`,
                    }}
                  >
                    <span style={theme.typography.LabelSmall}>
                      <Name of={c.customer} />
                    </span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Figure value={c.qty} unit={line.unit} decimals={0} size="compact" />
                    </span>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, textAlign: 'right' }}>
                      {c.at}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                Today&rsquo;s list holds <Figure value={onHand} unit={line.unit} decimals={0} size="compact" />, of
                which <Figure value={held} unit={line.unit} decimals={0} size="compact" /> is held by the two
                orders above. Those stay exactly as they are; the door below is the whole of what
                this screen does.
              </p>
            </section>
          }
          rankingNote={
            <>
              The order is this customer&rsquo;s own history — the same ranking{' '}
              <RefChip to="D3s">the substitution</RefChip> is drawn on.
            </>
          }
          composer={
            open ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
                {sentence && (
                  <Message author="sent" time="now" status="sent">
                    {sentence}
                  </Message>
                )}
                <Composer
                  value={words}
                  onChange={setWords}
                  onSend={() => {
                    if (!words.trim()) return;
                    setSentence(words);
                    setWords('');
                  }}
                  placeholder="Press an alternative and the words appear here."
                  sendLabel="Send the offer"
                />
              </div>
            ) : undefined
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          <GLines rows={3} />
          <GRegion to="D2s" height={120} label="today’s list" />
        </div>
      </div>
    </DeskChassis>
  );
}
