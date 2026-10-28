/* A3 · Resolve the line that could not be read.
 *
 * `D2.exceptions`, one line unresolved. The order is on screen for one reason: one line came
 * through unclearly, and until it is answered the order cannot go anywhere.
 *
 * POSITIVE SPACE. WHERE an unresolved line lives, and that it is answered WITHOUT LEAVING THE
 * ORDER. The line opens in place, `U01` answers it, and the order re-forms around the answer —
 * the second row fills, the money moves, the total moves with it. Nothing navigates.
 *
 * The unclear fragment is REPLAYABLE beside the chips. That is the difference between this card
 * and A6: A6's message was clear and incomplete, this one was not clear, so the evidence a person
 * needs is the sound itself and the chips stand next to it.
 *
 * THE SECTOR DELTA IS THE CANDIDATE SET AND THE REASON FOR THE FAILURE — fish, the species or the
 * origin unsaid; meat, the cut or the categoría; fruit, the calibre or the categoría. One control,
 * three candidate sets, all of them read out of `cast.ts`.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { HoldToConfirm, OrderState } from '../canonical/order-surface';
import {
  Resolution,
  Candidates,
  entriesOf,
  entryText,
  priceOf,
  rank,
  withUnplacedLine,
  type Candidate,
} from '../canonical/resolution';
import { Waveform } from '../../rocoto/waveform';
import { GThread, GCatalogue } from '../ghosts/regions';
import { customerOf, familyOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A3',
  title: 'Resolve the line that could not be read',
  group: 'A',
  frame: 'desk',
  ifText: 'only orders carrying something the software could not resolve are held, and one line on this one is unresolved',
  dims: ['D2.exceptions', 'D3.resolve'],
  job: 'Answer the line that came through unclearly, inside the order it belongs to.',
  decides:
    'where an unresolved line lives and how it is answered — the line opens in place, one press names the entry that was meant, and the order re-forms around the answer',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: 'the standing answer this write becomes', ref: 'J1b' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'the catalogue the candidates come from', ref: 'OPEN-2' },
  ],
  primitives: ['U01'],
  kit: ['Tile', 'Waveform', 'Figure', 'Message', 'Tag', 'Button', 'Ghost'],
  canonical: 'order-surface',
  delta: 'control',
  deltaText: 'one line opens in place and holds the chip row; the rest of the order card is unchanged',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [1],
  step: 3,
  fills: ['line.sku', 'record.preference'],
  reads: ['record'],
  live:
    'click the unresolved line and it opens; replay the unclear fragment on the waveform beside the chips; press a chip and the line re-forms, its second row fills, the chips collapse to a tag and the order total moves',
};

export default function A3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [open, setOpen] = React.useState(false);
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [committed, setCommitted] = React.useState(false);
  const [playhead, setPlayhead] = React.useState(0);

  React.useEffect(() => {
    setOpen(false);
    setChosen(null);
    setCommitted(false);
    setPlayhead(0);
  }, [cast.sector]);

  /* THE SITUATION, DERIVED FROM THE CAST. The first line is the one that came through unclearly;
     Rocoto put its best reading on it and held the order. Every name below is the cast's. */
  const target = cast.order.lines[0];
  const read = productOf(cast, target.product);
  const family = familyOf(cast, read);
  const customer = customerOf(cast, cast.order.customer);

  /* the candidates: every complete catalogue entry in the line's own family, ordered by what THIS
     customer has taken before */
  const candidates: Candidate[] = React.useMemo(() => {
    const entries = entriesOf(cast).filter((e) => e.product.family === family.id);
    return rank(entries, (e) => e.id, customer.id)
      .slice(0, 4)
      .map(({ item, history }) => ({
        id: item.id,
        label: entryText(item),
        history,
        detail: `${priceOf(cast, item.product).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${item.product.unit} today`,
      }));
  }, [cast, family.id, customer.id]);

  const chosenProduct = chosen ? productOf(cast, chosen) : null;

  /* the order as it stands. Before the answer the line carries no second row, because its sort is
     what could not be read; after it, the line IS the entry that was chosen and the money follows. */
  const shownCast = chosen ? cast : withUnplacedLine(cast, target.product);
  const order = React.useMemo(
    () => ({
      ...cast.order,
      lines: cast.order.lines.map((l) =>
        l.id === target.id && chosenProduct
          ? { ...l, product: chosenProduct.id, price: priceOf(cast, chosenProduct) }
          : l,
      ),
    }),
    [cast, target.id, chosenProduct],
  );

  const fragment = cast.order.utterances[0];

  return (
    <DeskChassis dossier selected={2} rows={11} height={1060}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={shownCast}
            order={order}
            state={<OrderState>{committed ? 'Confirmed' : chosen ? 'Ready for you' : 'One line waiting'}</OrderState>}
            reason={
              chosen ? undefined : (
                <>
                  The first line came through faintly. Rocoto put it on{' '}
                  <strong>{read.name}</strong> and held the order; the other{' '}
                  {cast.order.lines.length - 1} lines went through on their own.
                </>
              )
            }
            openLine={open ? target.id : undefined}
            onLineClick={(line) => setOpen(line.id === target.id)}
            renderOpenLine={() => (
              <Resolution
                ask={
                  <>
                    Which catalogue entry <strong>{customer.name}</strong> meant here. The words came
                    through faintly at {fragment ? `0:0${Math.round(fragment.at / 1000)}` : '0:00'}.
                  </>
                }
                media={
                  <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center' }}>
                    <Button
                      kind={KIND.secondary}
                      size={SIZE.mini}
                      onClick={() => setPlayhead((p) => (p >= 2400 ? 0 : p + 600))}
                    >
                      Replay
                    </Button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Waveform
                        mode="scrubbing"
                        seed={`${cast.sector}-${target.id}`}
                        positionMs={playhead}
                        durationMs={2400}
                        onSeek={setPlayhead}
                        size="compact"
                        label="the fragment that came through faintly"
                      />
                    </div>
                  </div>
                }
                writes={
                  chosen
                    ? [
                        {
                          object: 'This line',
                          text: candidates.find((c) => c.id === chosen)?.label,
                          ref: 'A1',
                        },
                        {
                          object: `${customer.name}'s record`,
                          text: 'the entry to lean on when this product is said plainly again',
                          ref: 'J1b',
                        },
                      ]
                    : undefined
                }
              >
                <Candidates
                  candidates={candidates}
                  chosen={chosen}
                  onChoose={setChosen}
                  ariaLabel="the entries this line could be"
                  settledText="Saved. This is settled."
                />
              </Resolution>
            )}
            primary={
              committed || !chosen ? undefined : (
                <HoldToConfirm onConfirm={() => setCommitted(true)}>Hold to confirm</HoldToConfirm>
              )
            }
            exits={
              committed ? (
                <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                  It is on today&rsquo;s file, under {cast.order.deliveryDay}.
                </p>
              ) : undefined
            }
          />

          {/* the shelf the candidates are drawn from — nobody has decided what it looks like */}
          <GCatalogue rows={6} />
        </div>

        {/* the conversation the order arrived on */}
        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
