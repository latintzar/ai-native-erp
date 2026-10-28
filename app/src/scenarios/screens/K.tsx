/* K · Absence, drawn as absence.
 *
 * K1 `D8.none` · K2 `D11.none` · K3 every family `D12 none` · K4 `D16.on-confirm`, so D17 is never
 * asked. The brief itself collapses the four into one card: «one card showing a menu with those
 * entries absent rather than disabled. The job is nothing, and that is the point.»
 *
 * POSITIVE SPACE. The rail has fewer destinations. There is no disabled entry, no greyed menu, no
 * upsell. `deriveRail` in `canonical/rail.tsx` is the argument in code: its only two outcomes are
 * «on the rail» and «absent», and there is no branch anywhere that keeps a destination and dims it.
 *
 * THE SECTOR IS THE SUBJECT, so all three are drawn at once. Three rails side by side is the one
 * place the whole thesis is visible at a glance — the same product, configured three ways, with
 * five destinations, four, and two.
 *
 * LIVE. Flip a dimension and a destination LEAVES. Watch the rails get shorter; nothing greys.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Checkbox, LABEL_PLACEMENT } from 'baseui/checkbox';
import type { ScenarioMeta } from '../meta';
import Rail, { deriveRail, absentFrom, type RailConfig } from '../canonical/rail';
import { GRegion } from '../ghosts/regions';
import { CASTS, SECTORS } from '../data/cast';
import type { SectorId } from '../meta';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'K',
  title: 'Absence, drawn as absence',
  group: 'K',
  frame: 'desk',
  ifText:
    'a dimension is configured off — no prices held, no stock position kept, no family recording a lote, or the albarán going at confirmation so nobody is asked who confirms a delivery',
  dims: ['D8.none', 'D11.none', 'D12.none', 'D16.on-confirm'],
  job: 'Show that a dimension switched off removes its destination from the product.',
  decides:
    'that a configuration removes a destination entirely — with no disabled entry, no greyed menu and no upsell in the space it left',
  inherits: [
    { region: 'the surface right of the rail', ref: 'A1' },
    { region: 'the batch ledger behind Lotes', ref: 'E3' },
    { region: 'the price surface behind Prices', ref: 'C3' },
    { region: 'the round behind Delivery', ref: 'I5' },
  ],
  open: [{ region: 'the questionnaire that produced the configuration', ref: 'OPEN-6' }],
  primitives: ['U12'],
  kit: ['Navigation', 'Checkbox', 'Ghost'],
  canonical: 'rail',
  delta: 'origin',
  deltaText: 'the card that IS the rail; the rail is a function of the configuration',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [],
  fills: [],
  reads: [],
  live:
    'tick a configuration and a destination leaves every rail it was on — it does not grey out; the three rails hold five, four and two destinations from one component',
};

/** The three accounts, as configurations. THIS is the sector thesis: not three products, three
 *  answers to the same questionnaire. */
const ACCOUNTS: Record<SectorId, RailConfig> = {
  fish: { d8: 'margin', d11: 'published', families: ['lot+fisheries', 'none'], d16: 'on-delivery' },
  meat: { d8: 'list', d11: 'declared', families: ['lot+animal', 'none'], d16: 'on-delivery' },
  fruit: { d8: 'list', d11: 'none', families: ['none', 'none'], d16: 'on-confirm' },
};

export default function K() {
  const [, theme] = useStyletron();
  const { sector } = useSector();
  const [priceless, setPriceless] = React.useState(false);
  const [lotless, setLotless] = React.useState(false);

  const configure = (base: RailConfig): RailConfig => ({
    ...base,
    d8: priceless ? 'none' : base.d8,
    families: lotless ? base.families.map(() => 'none' as const) : base.families,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700 }}>
      {/* the three rails, side by side — the thesis at a glance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale600 }}>
        {SECTORS.map((s) => {
          const config = configure(ACCOUNTS[s]);
          const destinations = deriveRail(config);
          const absent = absentFrom(config);
          const here = s === sector;
          return (
            <section
              key={s}
              style={{
                border: `1px solid ${here ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
                borderRadius: theme.borders.radius400,
                padding: theme.sizing.scale500,
                background: theme.colors.backgroundPrimary,
                minWidth: 0,
              }}
            >
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: theme.sizing.scale500 }}>
                <span style={theme.typography.LabelMedium}>{CASTS[s].label}</span>
                <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary }}>
                  {destinations.length} {destinations.length === 1 ? 'destination' : 'destinations'}
                </span>
              </header>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 160px) minmax(0, 1fr)', gap: theme.sizing.scale400 }}>
                <Rail config={config} active="orders" />
                {/* everything right of the rail is whichever surface is shown; A1 owns the landing */}
                <GRegion to="A1" height={168} label="the surface" />
              </div>

              <dl style={{ margin: `${theme.sizing.scale500} 0 0`, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                <dt style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Configuration
                </dt>
                <dd style={{ margin: `${theme.sizing.scale100} 0 0` }}>
                  {[
                    `D8.${config.d8}`,
                    `D11.${config.d11}`,
                    config.families.every((f) => f === 'none') ? 'every family records nothing' : `D12 ${config.families.filter((f) => f !== 'none').join(' · ')}`,
                    `D16.${config.d16}`,
                  ].join(' · ')}
                </dd>
                {absent.length > 0 && (
                  <>
                    <dt style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: theme.sizing.scale400 }}>
                      Off the rail
                    </dt>
                    <dd style={{ margin: `${theme.sizing.scale100} 0 0` }}>
                      {absent.map((d) => d.title).join(' · ')}
                    </dd>
                  </>
                )}
              </dl>
            </section>
          );
        })}
      </div>

      {/* THE CARD'S ONE INTERACTION. Tick a configuration; a destination leaves every rail. */}
      <div
        style={{
          display: 'flex',
          gap: theme.sizing.scale700,
          flexWrap: 'wrap',
          padding: theme.sizing.scale500,
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          background: theme.colors.backgroundSecondary,
        }}
      >
        <Checkbox
          checked={priceless}
          onChange={(e) => setPriceless((e.target as HTMLInputElement).checked)}
          labelPlacement={LABEL_PLACEMENT.right}
        >
          D8.none — prices stay in the accounting system
        </Checkbox>
        <Checkbox
          checked={lotless}
          onChange={(e) => setLotless((e.target as HTMLInputElement).checked)}
          labelPlacement={LABEL_PLACEMENT.right}
        >
          D12 — every family records nothing
        </Checkbox>
      </div>

      {/* the answers that produced these three configurations */}
      <GRegion open={6} height={120} label="the questionnaire" />
    </div>
  );
}
