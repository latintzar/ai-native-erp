/* D2s · Publish today's availability.
 * `D11.published` · PHONE (C-14) · canonical `spoken-capture` — CONTROL DELTA: the send, and what
 * the send means.
 *
 * ONE ACT, TWO CONSEQUENCES. The list goes out to customers AND it becomes the stock record. That
 * is the whole card, and it has to be said on the face of the screen without the screen narrating
 * itself (law 7): so the send control carries the sentence, and pressing it changes the list's own
 * state to «This is today's stock» in front of you. Watch the state change — that is the card.
 *
 * C-14 SETTLED THE FRAME. MAP drew D2s with two frames, «phone captured, desk sent», and two
 * frames is two jobs. The send happens AT THE MARKET, on the phone, because sending is what makes
 * it the stock and the person who knows what is on the lorry is standing beside it.
 *
 * THE MOST SECTOR-DIVERGENT CARD IN THE CATALOGUE. In fish this is the spine of the morning: the
 * disponible goes out and the day's orders are placed against it. In fruit, sometimes. IN MEAT IT
 * DOES NOT EXIST, and the card renders that absence rather than a screen it would have to break
 * to draw — which is group K's law, applied on a card of its own.
 *
 * THE GAP IT EXPOSES: `OPEN-7`. This is the only place the distributor sends to MANY customers at
 * once, and D1 models channels as inbound only. Who receives it, on which channel, what the
 * message looks like and what a reply to it is — none of that exists, and the region that would
 * hold it stands ghosted beside the send.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import SpokenCapture, { CaptureAbsent, type CaptureRow } from '../canonical/spoken-capture';
import RefChip from '../shell/RefChip';
import OpenChip from '../shell/OpenChip';
import { GRegion, GCatalogue } from '../ghosts/regions';
import { useSector } from '../shell/context';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'D2s',
  title: "Publish today's availability",
  group: 'D',
  frame: 'phone',
  ifText:
    'a list of what is available goes to customers each morning, and orders are placed against that list',
  dims: ['D11.published'],
  job: "Send today's list, which is also what makes it today's stock.",
  decides:
    'that sending is the commit — one act with two consequences, said on the control that performs it, with the list changing state in front of the person who pressed it',
  inherits: [
    { region: 'the orders that come back against it', ref: 'A1' },
    { region: 'a line that runs out while a customer is asking', ref: 'D3s' },
    { region: 'the same gesture, landing on a cost', ref: 'B1' },
  ],
  open: [
    { region: 'who receives the list, on which channel, and what a reply is', ref: 'OPEN-7' },
    { region: 'the catalogue the lines are drawn from', ref: 'OPEN-2' },
  ],
  primitives: ['U02', 'U03'],
  kit: ['Voice Button', 'Waveform', 'Figure', 'Button', 'Tag', 'Ghost'],
  canonical: 'spoken-capture',
  delta: 'control',
  deltaText: 'the same capture with a send, and the send is what makes the list the stock record',
  sector: { fish: '=', meat: '≠', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [3],
  step: 7,
  fills: ['lot.qty'],
  reads: [],
  live:
    'build the list by voice, or take yesterday in one press; press send and the list changes state to today’s stock and its rows become allocatable',
};

/** What is on the lorry today against what was on it yesterday, by position — deterministic, so
 *  the morning opens the same way every time the card is opened. */
const LANDED = [1.18, 0.79, 1.06, 0.92, 1.24];

/** the row the market noise took — the auctioneer started while the fourth was being said */
const UNHEARD = 3;

export default function D2s() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [sent, setSent] = React.useState(false);
  const [landed, setLanded] = React.useState(0);

  React.useEffect(() => {
    setSent(false);
    setLanded(0);
  }, [cast.sector]);

  const script: CaptureRow[] = React.useMemo(
    () =>
      cast.products.slice(0, 4).map((p, i) => {
        const batch = cast.batches.find((b) => b.product === p.id);
        const wasQty = batch ? batch.qty : Math.round(38 + i * 11);
        const qty = Math.round(wasQty * LANDED[i % LANDED.length]);
        const line = cast.order.lines.find((l) => l.product === p.id);
        const price = line ? line.price : Math.round((batch?.cost ?? 8) * 1.42 * 100) / 100;
        return {
          id: p.id,
          name: <Name of={p} />,
          detail: (
            <>
              {price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/{p.unit}
              {batch ? ` · lote ${batch.id}` : ''}
              {sent ? ' · open to allocate' : ''}
            </>
          ),
          value: qty,
          was: wasQty,
          unit: p.unit,
          decimals: 0,
          unheard: i === UNHEARD,
          durationMs: 2000,
        };
      }),
    [cast, sent],
  );

  const ready = landed >= script.length;

  return (
    <PhoneChassis
      header={{ to: 'K' }}
      behind={{ open: 7, label: 'the lists sent this week' }}
      rows={5}
      placement="bottom"
      height={840}
      width={392}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0, maxHeight: 760, overflowY: 'auto' }}>
        {/* MEAT DECLARES `≠`. A meat house sells from a catalogue its customers already hold, so
            no list goes out in the morning and the destination leaves the rail entirely (K). */}
        {cast.sector === 'meat' ? (
          <CaptureAbsent
            because={
              <>
                A meat house sells from a catalogue its customers already hold and its deliveries
                run on fixed weekly days, so no morning list goes out and there is no
                &laquo;Available&raquo; on its rail at all. Group K is the card where that absence
                is the subject.
              </>
            }
            instead={
              <>
                <RefChip to="K">the rail without it</RefChip>
                <RefChip to="B4">the agreed catalogue and its costs</RefChip>
                <RefChip to="A1">the orders that arrive anyway</RefChip>
              </>
            }
          />
        ) : (
          <SpokenCapture
            resetKey={cast.sector}
            onLanded={setLanded}
            head={
              <div style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Today&rsquo;s list</h2>
                  <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    {cast.hour} · {cast.order.deliveryDay}
                  </p>
                </div>
                {sent && (
                  <Tag
                    closeable={false}
                    kind={TAG_KIND.neutral}
                    hierarchy={HIERARCHY.primary}
                    /* Base clips a tag's words at a default width; this one IS the state change
                       the card is about, so it is allowed its whole sentence */
                    overrides={{ Text: { style: { maxWidth: 'none' } } }}
                  >
                    This is today&rsquo;s stock
                  </Tag>
                )}
              </div>
            }
            valueHead={sent ? 'Open to allocate' : 'On offer'}
            script={script}
            prefill={{ label: 'Like yesterday' }}
            empty={<>Hold the button and say the product and how much there is. Rows land as you speak.</>}
            commit={
              <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
                {/* THE SEND CARRIES THE SENTENCE, because the sentence is about the act and
                    evidence rides the element it justifies (law 7). */}
                <Button
                  kind={KIND.primary}
                  size={SIZE.large}
                  disabled={!ready || sent}
                  onClick={() => setSent(true)}
                  overrides={{ BaseButton: { style: { width: '100%' } } }}
                >
                  {sent ? 'Sent, and it is the stock' : 'Send it — this becomes the stock'}
                </Button>

                {sent && (
                  <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    The list went out and the same rows are now what this house holds.{' '}
                    <RefChip to="A1">the orders it brings back</RefChip>{' '}
                    <RefChip to="D3s">a line that runs out</RefChip>
                  </p>
                )}

                {/* THE GAP, STANDING WHERE IT BELONGS: beside the send that needs it. */}
                <GRegion open={7} height={110} label="who receives it, and on what" />
                <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                  This is the one place the distributor sends to many customers at once, and D1
                  holds channels as inbound only — <OpenChip n={7} size="mini" />
                </p>
              </section>
            }
          />
        )}

        <GCatalogue rows={5} label="the catalogue the lines come from" />
      </div>
    </PhoneChassis>
  );
}
