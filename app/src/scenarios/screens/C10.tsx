/* C10 · Decide whether the arrangement continues.
 *
 * THE ONE CARD IN THE CATALOGUE WHERE A GHOST STANDS INSIDE THE POSITIVE SPACE.
 *
 * The decision is decided: a customer is behind on a quantity they agreed to, the shortfall and
 * what it is worth are stated plainly, and this is the screen where somebody says what happens
 * next. What is NOT decided is what the answers are. Revert to the general rule, invoice the
 * difference, renegotiate the terms — the brief says in its own words that this has never been
 * established, and it is `OPEN-14`.
 *
 * So the outcome buttons are drawn as Ghosts, carrying the OPEN-14 pointer, inside the subject
 * rather than around it. Pressing one does nothing and says why. Guessing an outcome here would
 * be the catalogue quietly deciding a commercial policy nobody has written, and a grey that
 * admits it is worth more than a button that lies.
 *
 * A CONTROL DELTA on C9b: the watching screen is unchanged — same progress, same chart, same
 * arithmetic — and the lapse decision stands under it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import Watch, { arrangementOf, costToday, paceQty, shortfall } from '../canonical/watch';
import { GhostBlock } from '../../rocoto/ghost';
import { Figure } from '../../rocoto/figure';
import { GRegion } from '../ghosts/regions';
import OpenChip from '../shell/OpenChip';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C10',
  title: 'Decide whether the arrangement continues',
  group: 'C',
  frame: 'desk',
  ifText: 'a price is fixed against a quantity, and the customer is behind on the quantity agreed',
  dims: ['D10.fixed-with-volume'],
  job: 'Decide what happens to an arrangement the customer is behind on.',
  decides:
    'that the lapse is put in front of a person with the shortfall and its value stated plainly — and that the answers to it are openly undecided rather than invented',
  inherits: [
    { region: "the arrangement's state", ref: 'C9b' },
    { region: 'the terms', ref: 'C9a' },
    { region: 'the customer dossier', ref: 'J1a' },
  ],
  open: [
    { region: 'the outcomes themselves', ref: 'OPEN-14' },
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
  ],
  primitives: ['U11'],
  kit: ['Ghost', 'Progress Bar', 'Line Chart', 'Figure'],
  canonical: 'watch',
  delta: 'control',
  deltaText: 'the lapse decision stands under the watching, and its outcomes are ghosts',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [2],
  step: 5,
  fills: [],
  reads: ['cost', 'price'],
  live:
    'press an outcome and it names itself as one of the three answers the brief lists, in place, and points at OPEN-14, which holds the founder sentence that would settle it',
};

/** The three outcomes the brief names and never chooses between. They are drawn in the words the
 *  brief uses, so the founder recognises his own question on the screen. */
const OUTCOMES = [
  { id: 'revert', label: 'Revert to the general rule' },
  { id: 'invoice', label: 'Invoice the difference' },
  { id: 'renegotiate', label: 'Renegotiate the terms' },
];

export default function C10() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const arrangement = React.useMemo(() => arrangementOf(cast), [cast]);

  const [pressed, setPressed] = React.useState<string | null>(null);
  React.useEffect(() => setPressed(null), [cast.sector]);

  const behind = shortfall(arrangement);
  const worth = behind * arrangement.price;
  const marginLost = behind * (arrangement.price - costToday(arrangement));

  return (
    <DeskChassis dossier daybar={false} daylist={{ open: 3, label: 'the customers' }} rows={12} selected={4} height={1000}>
      <Watch
        cast={cast}
        arrangement={arrangement}
        reason={
          <>
            {arrangement.customer.name} stands{' '}
            {behind.toLocaleString('es-ES', { maximumFractionDigits: 0 })} {arrangement.product.unit}{' '}
            behind the pace the period sets, with{' '}
            {Math.round((1 - arrangement.elapsed) * 100)}% of it left to run.
          </>
        }
        decision={
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale600,
              border: `1px solid ${theme.colors.contentPrimary}`,
              borderRadius: theme.borders.radius300,
              padding: theme.sizing.scale600,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={theme.typography.LabelMedium}>The shortfall, and what it is worth</div>
                <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  At the pace the period sets they would have taken{' '}
                  {paceQty(arrangement).toLocaleString('es-ES', { maximumFractionDigits: 0 })}{' '}
                  {arrangement.product.unit} by today.
                </div>
              </div>
              <OpenChip n={14}>the outcomes</OpenChip>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale600 }}>
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  Behind by
                </div>
                <Figure value={behind} unit={arrangement.product.unit} decimals={0} size="large" />
              </div>
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  Worth, at the price they hold
                </div>
                <Figure value={worth} unit="€" size="large" />
              </div>
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  Margin it would have left
                </div>
                <Figure value={marginLost} unit="€" size="large" />
              </div>
            </div>

            {/* ── THE GHOSTS, INSIDE THE SUBJECT ────────────────────────────────────────────
                Each outcome is a Ghost carrying the OPEN-14 pointer, drawn at the size of the
                control it will one day be. The press is real and the answer is honest: it names
                itself as one of three, and the register says what would settle it. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                What happens now
              </span>
              <div style={{ display: 'flex', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
                {OUTCOMES.map((o) => (
                  <span
                    key={o.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={pressed === o.id}
                    onClick={() => setPressed(o.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPressed(o.id); } }}
                    style={{ cursor: 'pointer', display: 'inline-block' }}
                  >
                    <GhostBlock
                      shape="pill"
                      height={44}
                      width={330}
                      tone={pressed === o.id ? 'strong' : 'default'}
                      label={o.label}
                      reference="OPEN-14"
                      aria-label={o.label}
                    />
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '68ch' }}>
                {pressed
                  ? `«${OUTCOMES.find((o) => o.id === pressed)?.label}» is one of the three answers the brief names. Which one this house gives is the founder’s sentence to write, and OPEN-14 holds what would settle it.`
                  : 'Three answers stand here — revert, invoice the difference, renegotiate. Which one this house gives is the founder’s sentence to write; until it is written, the shortfall is stated plainly and the decision stays with a person.'}
              </p>
            </div>
          </section>
        }
        aside={
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: theme.sizing.scale600, marginTop: theme.sizing.scale500 }}>
            <GRegion to="C9b" height={110} label="the state" />
            <GRegion to="C9a" height={110} label="the terms" />
            <GRegion to="J1a" height={110} label="the dossier" />
          </div>
        }
      />
    </DeskChassis>
  );
}
