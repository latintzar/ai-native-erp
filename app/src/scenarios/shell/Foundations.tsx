/* THE FOUNDATIONS — what wave 0 hands wave 1, on one page.
 *
 * Not a scenario: nothing here decides a situation. It is the reference sheet for the shared
 * machinery — the three chassis, the paper stage, `el papel`, and the named Ghost regions — so a
 * builder can see the vocabulary rendered before writing a card in it, and so P0 could verify
 * what it was handing over rather than asserting it.
 *
 * Everything on it is driven by the global sector switch, exactly as a card is.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import DeskChassis from '../chassis/desk';
import PhoneChassis from '../chassis/phone';
import PublicChassis from '../chassis/public';
import PaperStage from '../chassis/paper';
import * as G from '../ghosts/regions';
import { useSector } from './context';
import { productOf, familyOf } from '../data/cast';
import Name from './Name';

function Part({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <section style={{ marginTop: theme.sizing.scale1200 }}>
      <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h2>
      <p style={{ margin: `${theme.sizing.scale200} 0 ${theme.sizing.scale600}`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '78ch' }}>
        {note}
      </p>
      {children}
    </section>
  );
}

export default function Foundations() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  /* a sheet built from the cast, so `el papel` is exercised with real rows and a real field set */
  const rows = cast.order.lines.map((l) => {
    const product = productOf(cast, l.product);
    const family = familyOf(cast, product);
    return {
      id: l.id,
      cells: {
        product: <Name of={product} />,
        qty: `${l.qty} ${l.unit}`,
        lot: l.lot ?? '',
      },
      sub: family.recordFields.map((f) => ({ label: f, value: product.trace[f] ?? '' })),
    };
  });

  return (
    <div style={{ maxWidth: 1400 }}>
      <h1 style={{ margin: 0, ...theme.typography.HeadingLarge }}>The foundations</h1>
      <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, maxWidth: '78ch' }}>
        The shared machinery every card is built out of. A builder writes the screen and the meta;
        everything on this page arrives already made, already pointered, and already re-themeable.
      </p>

      <Part
        title="The desk chassis"
        note="The rail, the day's bar, the day's orders with one row selected, the main slot, and an optional dossier drawer. OPEN-1 is drawn ONCE here for the twenty cards that stand inside it, so twenty cards show the same honest skeleton instead of twenty improvised greys."
      >
        <DeskChassis dossier height={420}>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>
            the positive space — the one thing this card decides
          </div>
        </DeskChassis>
      </Part>

      <Part
        title="The phone chassis and the public chassis"
        note="The phone puts the moment over the surface it interrupts, on a scrim, because a capture happens on top of what the person was doing and hands the surface back. The public frame has no chrome at all, and that is its subject: it is the only Rocoto screen a restaurant ever opens."
      >
        <div style={{ display: 'flex', gap: theme.sizing.scale700, flexWrap: 'wrap' }}>
          <PhoneChassis height={420} rows={6}>
            <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary }}>
              the moment
            </div>
          </PhoneChassis>
          <div style={{ flex: 1, minWidth: 320 }}>
            <PublicChassis height={420}>
              <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>
                the document, and nothing else
              </div>
            </PublicChassis>
          </div>
        </div>
      </Part>

      <Part
        title="El papel, on the paper stage"
        note="One column set, always. The traceability facts ride a smaller second line under the product name, which is why one sheet serves a family with eight facts and a family with two — and why the page count, rather than the layout, is what moves. Run the sector switch and watch the sub-line grow while the columns stay put."
      >
        <div style={{ maxWidth: 560 }}>
          <PaperStage
            height={520}
            stageWidth={560}
            columns={[
              { key: 'product', label: 'Product', width: '1fr' },
              { key: 'qty', label: 'Quantity', width: '110px', align: 'end' },
              { key: 'lot', label: 'Lote', width: '90px', align: 'end' },
            ]}
            rows={rows}
            masthead={
              <div>
                <div style={theme.typography.HeadingXSmall}>Albarán</div>
                <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                  {cast.order.deliveryDay}
                </div>
              </div>
            }
            runningHead={<><span>Albarán</span><span>{cast.order.deliveryDay}</span></>}
          />
        </div>
      </Part>

      <Part
        title="The named Ghost regions"
        note="Fifteen regions, each pre-loaded with its whisper and its pointer, so a builder writes <GLines /> and never chooses a grey. Hover one and its chip lights in the meta strip; click it and the catalogue goes to the card that owns it."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: theme.sizing.scale600 }}>
          <G.GDaybar />
          <G.GLines />
          <G.GThread rows={4} />
          <G.GComposer />
          <G.GDossier blocks={4} />
          <G.GCatalogue rows={5} />
          <G.GTiers rows={3} />
          <G.GBatchbook rows={4} />
          <G.GRoute rows={4} />
          <G.GSheet />
          <G.GErpfile />
          <G.GTabs to="J1a" />
          <div><G.GTotals /></div>
          <G.GDaylist rows={4} />
        </div>
      </Part>
    </div>
  );
}
