/* A13-bis · The customer says what arrived was wrong.
 *
 * THE MOST COMMON POST-DELIVERY EVENT IN THE TRADE, AND THE BRIEF HAS NO CARD FOR IT (SECTORS §8).
 * The chef opens the box, some of it is bad, and a photograph lands in the thread. Everything the
 * catalogue does downstream of an albarán assumes the goods arrived as the document says; this is
 * the card where they did not.
 *
 * POSITIVE SPACE. Record what was wrong and what is owed back, without leaving the conversation:
 * the photograph they sent, the line it belongs to, the money it comes to, and the two acts —
 * replace it or credit it — ordered by what THIS customer took last time.
 *
 * THE DELTA FROM A13. Same notice, anchored to a SENT albarán instead of a live order, so the
 * albarán row is «Gone» from the first frame and cannot come back; and the primary opens a credit
 * line instead of an edit.
 *
 * THE CARD STATES ITS OWN BOUNDARY. Rocoto captures the incidencia; the ERP issues the abono — the
 * albarán/factura law, one step later. Drawn with fruit, where this happens daily and at volume.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import ChangeNotice, { type NoticeRow, type Outcome } from '../canonical/change-notice';
import { GThread, GComposer, GErpfile, GRegion } from '../ghosts/regions';
import { Gallery, type GalleryPhoto } from '../../rocoto/gallery';
import RefChip from '../shell/RefChip';
import Name from '../shell/Name';
import { customerOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A13-bis',
  title: 'The customer says what arrived was wrong',
  group: 'A',
  frame: 'desk',
  ifText: 'the customer reports that delivered goods were wrong',
  dims: [],
  job: 'Record what was wrong and what is owed back, without leaving the conversation.',
  decides:
    'what was wrong, what it comes to in euros, and whether it is replaced or credited — with the delivered albarán left exactly as it was signed',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'the thread the photo arrived on', ref: 'chat' },
    { region: 'the composer that answers them', ref: 'chat' },
    { region: 'the albarán it is anchored to', ref: 'G1' },
    { region: "tomorrow's file", ref: 'G2' },
    { region: "tomorrow's picking sheet", ref: 'F0' },
    { region: 'the lines and their anatomy', ref: 'A1' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U11', 'U01'],
  kit: ['Gallery', 'Button Group', 'Button', 'Figure', 'Tag', 'Ghost'],
  canonical: 'change-notice',
  delta: 'control',
  deltaText: 'anchored to a sent albarán, and the primary opens a credit line instead of an edit',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fruit',
  thread: [1, 4],
  step: 9,
  fills: ['credit'],
  reads: ['albarán', 'record'],
  live:
    'open the photograph they sent in the gallery; choose replace or credit — ordered by what this customer took last time — and the records recompute; the primary then opens the credit line and states where the abono is issued',
};

/* ── THE PHOTOGRAPH ───────────────────────────────────────────────────────────────────────────
 * Drawn from the theme's own ink on the theme's own paper, so it re-tints with the brand like
 * everything else and needs no network. It stands for what a customer's phone actually sends: a
 * box, shot from above, in a kitchen's light. */
function boxPhoto(ink: string, ground: string, w: number, h: number, bad: number): string {
  const cell = (x: number, y: number, r: number, o: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}" fill-opacity="${o}"/>`;
  const parts: string[] = [
    `<rect width="${w}" height="${h}" fill="${ground}"/>`,
    `<rect x="${w * 0.06}" y="${h * 0.08}" width="${w * 0.88}" height="${h * 0.84}" fill="${ink}" fill-opacity="0.08"/>`,
    `<rect x="${w * 0.06}" y="${h * 0.08}" width="${w * 0.88}" height="${h * 0.84}" fill="none" stroke="${ink}" stroke-opacity="0.28" stroke-width="${w * 0.006}"/>`,
  ];
  let n = 0;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = w * (0.17 + col * 0.222);
      const y = h * (0.25 + row * 0.25);
      parts.push(cell(x, y, Math.min(w, h) * 0.085, n < bad ? 0.62 : 0.24));
      n += 1;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function A13bis() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [outcome, setOutcome] = React.useState('leave');
  const [recorded, setRecorded] = React.useState(false);

  React.useEffect(() => { setOutcome('leave'); setRecorded(false); }, [cast.sector]);

  const customer = customerOf(cast, cast.order.customer);

  /* the line the incidencia is on: the one carrying the most money, which is where a complaint
     lands and where a credit is worth recording */
  const line = [...cast.order.lines].sort((a, b) => b.qty * b.price - a.qty * a.price)[0];
  const product = productOf(cast, line.product);
  const wrongQty = Math.max(1, Math.round(line.qty * 0.25));
  const owed = wrongQty * line.price;

  const photos: GalleryPhoto[] = [
    {
      src: boxPhoto(theme.colors.contentPrimary, theme.colors.backgroundSecondary, 1600, 1200, 3),
      alt: `A box of ${product.name} shot from above, three of the twelve pieces marked`,
      caption: <>What <Name of={customer} /> sent at {cast.order.placedAt}</>,
    },
    {
      src: boxPhoto(theme.colors.contentPrimary, theme.colors.backgroundSecondary, 1200, 1200, 2),
      alt: `Two pieces of ${product.name} held up close to the camera`,
      caption: <>The same box, closer</>,
    },
  ];

  const replacing = outcome === 'replace';
  const crediting = outcome === 'credit';

  const rows: NoticeRow[] = [
    {
      id: 'albaran',
      what: <>The albarán they signed</>,
      ref: 'G1',
      when: `delivered ${cast.order.deliveryDay}`,
      figure: { value: line.qty, unit: line.unit },
      state: 'gone',
      consequence: 'It stands exactly as it was signed, and the correction rides the next one.',
    },
    {
      id: 'file',
      what: <>Tomorrow&rsquo;s file</>,
      ref: 'G2',
      when: 'written tonight',
      figure: crediting || replacing ? { value: owed, unit: '€', decimals: 2 } : undefined,
      state: crediting || replacing ? 'reopens' : 'holds',
      consequence: crediting ? (
        <>A credit line for {wrongQty} {line.unit} of <Name of={product} /> goes with it.</>
      ) : replacing ? (
        <>A replacement line for {wrongQty} {line.unit} of <Name of={product} /> goes with it.</>
      ) : (
        <>It carries today&rsquo;s lines as they stand.</>
      ),
    },
    ...(replacing
      ? [{
          id: 'sheet',
          what: <>Tomorrow&rsquo;s picking sheet</>,
          ref: 'F0',
          when: 'cut at 05:40',
          figure: { value: wrongQty, unit: line.unit },
          state: 'reopens' as const,
          consequence: <>The replacement is picked with their next drop.</>,
        }]
      : []),
  ];

  const outcomes: Outcome[] = [
    /* ORDERED BY WHAT THIS CUSTOMER TOOK LAST TIME (`U01`'s law), never alphabetically and never
       by what suits the distributor. They took a credit on 08.08, so credit stands first. */
    {
      id: 'credit',
      label: 'Credit it',
      detail: (
        <>
          {wrongQty} {line.unit} of <Name of={product} /> comes back to them as money on
          tomorrow&rsquo;s file.
        </>
      ),
    },
    {
      id: 'replace',
      label: 'Replace it',
      detail: (
        <>
          {wrongQty} {line.unit} of <Name of={product} /> goes on tomorrow&rsquo;s sheet and travels
          with their next drop.
        </>
      ),
    },
  ];

  return (
    <DeskChassis selected={5} rows={11} height={920}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: theme.sizing.scale700, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <ChangeNotice
            what={
              <>
                <Name of={customer} /> says {wrongQty} {line.unit} of <Name of={product} /> arrived
                unusable
              </>
            }
            anchor={<>Their albarán of {cast.order.deliveryDay}</>}
            when={`they wrote at ${cast.order.placedAt}`}
            /* the evidence they sent, above the records it explains */
            aside={
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)',
                  gap: theme.sizing.scale600,
                  alignItems: 'start',
                  border: `1px solid ${theme.colors.borderOpaque}`,
                  borderRadius: theme.borders.radius300,
                  padding: theme.sizing.scale500,
                }}
              >
                {/* THE APP'S OWN VIEWER, opening the way it opens on a phone: the grid holds the
                    thumbnails at the ratio a camera sends, and a press puts the photograph over
                    everything. A viewer boxed into a 300px pane is a viewer nobody can read the
                    evidence in, and the evidence is the point of this card. */}
                <Gallery
                  photos={photos}
                  columns={2}
                  aspectRatio={4 / 3}
                  container="viewport"
                  aria-label="what the customer sent"
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
                  <span style={theme.typography.LabelMedium}>
                    <Name of={product} />
                  </span>
                  <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    {line.qty} {line.unit} left on the round at{' '}
                    {line.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/{product.unit}.{' '}
                    {wrongQty} {line.unit} of it came back.
                  </span>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                    Tap a photograph to open it.
                  </span>
                </div>
              </div>
            }
            rows={rows}
            outcomes={outcomes}
            outcome={outcome}
            onOutcome={(id) => { setOutcome(id); setRecorded(false); }}
            outcomesNote={<>Last time, on 08.08, they took a credit.</>}
            empty={<>The albarán stands as it was signed.</>}
            /* the primary opens a credit line — the delta from A13, where it opens an edit */
            primary={
              outcome === 'leave' ? undefined : recorded ? (
                <div style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                    {crediting ? 'Credit recorded' : 'Replacement recorded'}
                  </Tag>
                  <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    {wrongQty} {line.unit} of {product.name},{' '}
                    {owed.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €, on tomorrow&rsquo;s file.
                  </span>
                  <RefChip to="G2">the file</RefChip>
                </div>
              ) : (
                <Button kind={KIND.primary} size={SIZE.large} onClick={() => setRecorded(true)}>
                  {crediting ? 'Open a credit line' : 'Put it on tomorrow'}
                </Button>
              )
            }
            boundary={
              <>
                Rocoto records the incidencia; the ERP issues the abono, one step after the albarán.
              </>
            }
          />
        </div>

        {/* the conversation this arrived on, and the file it leaves for tonight */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          <GThread rows={8} />
          <GComposer />
          <GRegion to="G1" height={96} label="the albarán" />
          <GErpfile label="tomorrow's file" />
        </div>
      </div>
    </DeskChassis>
  );
}
