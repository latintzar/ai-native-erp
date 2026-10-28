/* Produce Icons — the imagery of the customer's goods. Grown from Base's template-component
 * scaffold (see src/rocoto/produce-icons/); this page demonstrates it like any other component.
 *
 * The page is a MATRIX first and examples second, because the promise this component makes is
 * coverage: every family, every form, nothing missing, nothing repeated. You should be able to
 * scan the grid and say what each drawing is without reading its label — and where you cannot,
 * that cell is a bug.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { useStyletron } from 'baseui';
import { Figure } from '../../rocoto/figure';
import { ProduceIcon, FORMS, PALETTE, TONES, BESPOKE_INDEX } from '../../rocoto/produce-icons';
import type { Family, Form, Size } from '../../rocoto/produce-icons';

const FAMILIES: Family[] = ['fish', 'shellfish', 'meat', 'poultry', 'fruit', 'vegetable', 'dairy', 'dry'];

/** the quiet label under a drawing — the kit's own furniture, not the component's */
const Caption: React.FC<{ w?: number; children: React.ReactNode }> = ({ w, children }) => {
  const [, theme] = useStyletron();
  return (
    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, width: w, textAlign: 'center' }}>
      {children}
    </span>
  );
};

/** one cell of the matrix: the drawing, and what it is */
const Cell: React.FC<{ family: Family; form?: Form; species?: string; label: string; mono?: boolean }> = ({
  family, form, species, label, mono,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 62 }}>
    <ProduceIcon family={family} form={form} species={species} size="large" mono={mono} />
    <Caption>{label}</Caption>
  </div>
);

function Matrix() {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, width: '100%' }}>
      {FAMILIES.map((family) => (
        <div key={family} style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale700 }}>
          <span style={{ ...theme.typography.LabelSmall, width: 76, flex: 'none', paddingTop: 8 }}>{family}</span>
          <div style={{ display: 'flex', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
            {FORMS[family].map((form) => (
              <Cell key={form} family={family} form={form as Form} label={form} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** THE COMPOSED ROW — the icon doing its actual job: attribution on a line of an albarán.
 *  Monzo puts the merchant's logo on every transaction; here the goods put their own picture on
 *  every line, and the Figure carries the number. */
const LINE: Array<{ species?: string; family: Family; form: Form; name: string; qty: number; unit: string }> = [
  { species: 'merluza', family: 'fish', form: 'whole', name: 'Merluza del Cantábrico', qty: 12.4, unit: 'kg' },
  { species: 'gamba-roja', family: 'shellfish', form: 'whole', name: 'Gamba roja de Palamós', qty: 3.2, unit: 'kg' },
  { family: 'meat', form: 'minced', name: 'Carne picada de ternera', qty: 8, unit: 'kg' },
  { species: 'aguacate', family: 'fruit', form: 'whole', name: 'Aguacate hass', qty: 2, unit: 'cajas' },
];

function ComposedRows() {
  const [, theme] = useStyletron();
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {LINE.map((l) => (
        <div
          key={l.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale500,
            padding: `${theme.sizing.scale400} 0`,
            borderBottom: `1px solid ${theme.colors.borderTransparent}`,
          }}
        >
          <ProduceIcon family={l.family} form={l.form} species={l.species} size="default" />
          <span style={{ ...theme.typography.ParagraphSmall, flex: 1, minWidth: 0 }}>{l.name}</span>
          <Figure value={l.qty} unit={l.unit} size="compact" decimals={l.qty % 1 === 0 ? 0 : 1} />
        </div>
      ))}
    </div>
  );
}

export default function ProduceIconsSection() {
  const [, theme] = useStyletron();
  return (
    <Section
      t="Produce Icons"
      n="A picture of the goods, on every line, product card and print sheet. The taxonomy is family × form, with a bespoke silhouette where one has been drawn; resolution walks specific to general and always lands on a drawing, so a product nobody has catalogued still shows what kind of thing it is. Soft 2.5D flat illustration: two or three flat tones and one shade step, on one 24 × 24 grid."
    >
      <Grid>
        <Tile
          span={12}
          name="Every family, every form"
          rule="Eight families, and per family only the forms a counter actually distinguishes. Cover the labels: the four fish are told apart by silhouette alone — a lens with a forked tail, a long taper, a short domed block, four cubes — because at 16px the tones are three smudges and the outline is all that survives."
        >
          <Matrix />
        </Tile>

        <Tile
          span={12}
          name="Bespoke silhouettes"
          rule="The cast's own world, drawn by hand. Each carries a fact its generic cannot — the hake's outsized head, the monkfish's mouth, the bass's spiny fin, the octopus's arms, the prawn's antennae, the avocado's stone, the rib in the chuletón. A bespoke drawing that reads the same as its generic at 20px is costing bytes and giving nothing back."
        >
          <div style={{ display: 'flex', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
            {BESPOKE_INDEX.map((b) => (
              <Cell key={b.label} family={b.family} form={b.form} species={b.species} label={b.label} />
            ))}
          </div>
        </Tile>

        <Tile
          span={5}
          name="Sizes"
          rule="16 · 20 · 24 · 32, as four positions on Base's own sizing scale rather than four numbers this component invented. Every drawing is authored on the 24 grid and nothing smaller than about two grid units is asked to carry meaning, so the silhouette holds at the smallest step and the detail is texture."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, width: '100%' }}>
            {(['fish', 'meat', 'vegetable'] as Family[]).map((family) => (
              <div key={family} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale600 }}>
                {(['mini', 'compact', 'default', 'large'] as Size[]).map((size) => (
                  <ProduceIcon key={size} family={family} size={size} />
                ))}
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{family}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: theme.sizing.scale600 }}>
              {(['16', '20', '24', '32'] as const).map((px) => (
                <Caption key={px} w={32}>{px}</Caption>
              ))}
            </div>
            {/* 20px is the size a dense row actually uses, so every family is checked at it */}
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, paddingTop: theme.sizing.scale400, borderTop: `1px solid ${theme.colors.borderTransparent}`, width: '100%' }}>
              {FAMILIES.map((family) => (
                <ProduceIcon key={family} family={family} size="compact" />
              ))}
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>all eight, at 20</span>
            </div>
          </div>
        </Tile>

        <Tile
          span={7}
          name="On a line"
          rule="Where these live: attribution on a row, the way Monzo puts the merchant's mark on every transaction. The drawing sits on the text's own baseline box and takes a fixed size, so a column of forty lines has one left edge and the Figure keeps its separator."
        >
          <ComposedRows />
        </Tile>

        <Tile
          span={4}
          name="Single ink"
          rule="The same drawings in currentColor at three densities — the lit face, the body, the shade. For the print sheet, where there is one ink, and for any surface quiet enough that colour would shout. The drawings know nothing about it: the brush resolves the mode, so each one is authored once and prints both ways."
        >
          <div style={{ display: 'flex', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
            {(
              [
                ['fish', 'whole', 'merluza'],
                ['shellfish', 'whole', undefined],
                ['meat', 'steak', undefined],
                ['poultry', 'wings', 'pollo'],
                ['vegetable', 'bunch', undefined],
                ['dry', 'generic', undefined],
              ] as Array<[Family, Form, string | undefined]>
            ).map(([family, form, species]) => (
              <ProduceIcon key={`${family}${form}`} family={family} form={form} species={species} size="large" mono />
            ))}
          </div>
        </Tile>

        <Tile
          span={4}
          name="Resolution never misses"
          rule="A species nobody has drawn falls to its family and form; a form a family does not have falls to that family's default. The last step cannot fail, so the column never has a hole in it — an icon that sometimes renders nothing would teach the eye to stop looking, and then none of them work."
        >
          <div style={{ display: 'flex', gap: theme.sizing.scale700, flexWrap: 'wrap' }}>
            <Cell family="fish" form="fillet" species="merluza" label="merluza · fillet" />
            <Cell family="fish" form="fillet" species="bacalao" label="bacalao · fillet" />
            <Cell family="fish" form="minced" label="fish · minced" />
            <Cell family="dairy" label="dairy · no form" />
          </div>
        </Tile>

        <Tile
          span={4}
          name="The content palette"
          rule="Six hues, each with one shade step — the pairing is the point, because a tone and its shade are what a flat 2.5D drawing is made of. All desaturated: the reddest value here is well off saffron and browner, so a row of goods never competes with the mark that means the AI acted. These are the goods, not the brand, which is why they are the one thing on this page the theme does not own."
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300, width: '100%' }}>
            {TONES.map((tone) => (
              <div key={tone} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 62 }}>
                <span
                  style={{
                    width: 44,
                    height: 30,
                    borderRadius: theme.borders.radius200,
                    background: PALETTE[tone].hex,
                    border: `1px solid ${theme.colors.borderTransparent}`,
                  }}
                />
                <Caption>{tone}</Caption>
              </div>
            ))}
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
