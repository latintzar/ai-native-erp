/* THE APP'S OWN PRIMITIVES, IN THE REFERENCE (FEED-IA §33.2 item 7, §45's cumulative law).
 *
 * Eight things the app grew this season that had no page in the design system: the product card,
 * the tarifas editor, the four chat embeds, the keycap, the painted tile — and, from the panes
 * round, the FIELDS ROW (§41.5), the OBJECT DOOR (§43) and the PROFILE SEAT (§44.5). A primitive with no page is
 * a primitive nobody can check against anything — it drifts, and then a second copy of it appears
 * somewhere else, which is exactly the history `product-face.tsx` was written to end.
 *
 * THEY ARE THE REAL COMPONENTS, RUN. Nothing on this page is a picture of a component or a
 * re-implementation of one: every tile below imports the module the app imports and drives it with
 * the seeded cast, so a change in the app is visible here in the same build. That is the same rule
 * the scenarios keep, and it is the only reason a reference is worth having.
 *
 * The section grammar is the kit's own — `Section` · `Grid` · `Tile`, the specs switch on each tile
 * — so these five read as five more pages of one book.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Section, Tile, Grid, Row } from '../chrome';
import { CASTS } from '../../scenarios/data/cast';
import type { Cast, Product } from '../../scenarios/data/cast';
import { ProductFace, ProduceTile } from '../../prototypes/cedar/product-face';
import { Keycap, Shortcut } from '../../prototypes/cedar/glyphs';
import AppProductCard from '../../prototypes/cedar/product-card';
import { ProductTarifas, type Draft } from '../../prototypes/cedar/stock-tiers';
import { ChatEmbed, embedsOf } from '../../prototypes/cedar/shell/embeds';
import type { Embed } from '../../prototypes/cedar/shell/embeds';
/* THE PANES ROUND'S OWN THREE. Each is the module the app imports, driven with the seeded cast —
   the page is the component running, never a drawing of it. */
import { Fields, type FieldSpec } from '../../prototypes/cedar/detail';
import { Door } from '../../prototypes/cedar/anchors';
import { ProfileSeat } from '../../prototypes/cedar/shell/rail';
import { seedRelationship, tiersOfHouse } from '../../prototypes/cedar/tiers';
import { buildSales, todayId } from '../../prototypes/cedar/sale';
import type { Sale } from '../../prototypes/cedar/sale';
import { nowOf } from '../../prototypes/cedar/day';

/* ── THE HOUSE EVERY TILE ON THIS PAGE IS DRAWN FROM ──────────────────────────────────────────
 * One cast, one day, one set of sales — so the product on the card, the product on the tarifa sheet
 * and the albarán inside the chat embed are the same house's goods and not three unrelated demos.
 */
const useHouse = (): { cast: Cast; sales: Sale[]; day: string; hour: string } => {
  const cast = CASTS.fish;
  const sales = React.useMemo(
    () => buildSales(cast, { sector: cast.sector, surfaced: [], confirmed: [], answered: {}, always: [], released: [], notice: {}, events: [] }),
    [cast],
  );
  return { cast, sales, day: todayId(cast), hour: nowOf(cast) };
};

/* ── THE PAINTED TILE ─────────────────────────────────────────────────────────────────────── */

function PaintedTile() {
  const { cast } = useHouse();
  const painted = cast.products[0] ?? { name: 'Merluza' };
  /* a word the painted library has no row for, so the tile falls back to the drawn family mark —
     the state that MATTERS, because it is the one that proves there is never a gap */
  const unpainted: Pick<Product, 'name'> = { name: 'Caja isotérmica' };
  return (
    <Section
      t="Painted Tile"
      n="The face of the goods. One seat, one size, one corner — the painting the library has for a word, or the drawn family mark where it has none. There is no third state: never a gap, never a placeholder, and the seat never grows for what lands in it."
    >
      <Grid>
        <Tile name="Painted" rule="The library answered the word. The seat's ground comes off — the painting carries its own white." span={3}>
          <ProductFace of={painted} size={56} />
        </Tile>
        <Tile name="Drawn" rule="No painting answers, so the family's own mark stands on the quiet ground. The row's weight is unchanged." span={3}>
          <ProductFace of={unpainted} size={56} />
        </Tile>
        <Tile name="Muted" rule="The record steps back in colour as it does in ink. Closed rows only — a catalogue is never muted, because everything on it is equally live." span={3}>
          <ProductFace of={painted} size={56} muted />
        </Tile>
        <Tile name="Drawn only" rule="`ProduceTile` never tries a painting. For the places whose subject IS the icon vocabulary." span={3}>
          <ProduceTile of={painted} size={56} />
        </Tile>
      </Grid>
      <div style={{ height: 14 }} />
      <Grid>
        <Tile name="At every size, one seat" rule="A chip, a line and a card ask for different edges; the asset is normalized into the box, so nothing is cropped and nothing floats." span={12}>
          <Row>
            {[20, 28, 36, 44, 56, 72].map((size) => (
              <ProductFace key={size} of={painted} size={size} />
            ))}
          </Row>
        </Tile>
      </Grid>
    </Section>
  );
}

/* ── THE KEYCAP ───────────────────────────────────────────────────────────────────────────── */

function KeycapPage() {
  const [, theme] = useStyletron();
  return (
    <Section
      t="Keycap"
      n="A key, drawn the classic way — a little square with the letter in it. It rides a hover label and never stands alone: a keycap on a surface with no shortcut behind it is a promise the keyboard does not keep."
    >
      <Grid>
        <Tile name="One key" rule="A single letter, no modifier. That is the whole shortcut vocabulary of this app." span={3}>
          <Keycap>P</Keycap>
        </Tile>
        <Tile name="A walk" rule="The arrows step through the list without acting on anything." span={3}>
          <Row>
            <Keycap>←</Keycap>
            <Keycap>→</Keycap>
          </Row>
        </Tile>
        <Tile name="On its label" rule="`Shortcut` is how it reaches a person: the sentence first, the key after it. Words teach; the cap is the reminder." span={6}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, alignItems: 'flex-start' }}>
            <Shortcut label="Print it and go to the next" keys={['P']} />
            <Shortcut label="Walk the list" keys={['←', '→']} />
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}

/* ── THE CHAT EMBEDS ──────────────────────────────────────────────────────────────────────── */

/** The order the four are read in: what Rocoto read, what it answered, what it made, why one waits. */
const ORDER: Array<Embed['kind']> = ['readback', 'price', 'albaran', 'reasoning'];

/** One of each kind the fold can produce, taken off real sales rather than composed by hand. */
function embedSet(sales: Sale[]): Array<{ kind: Embed['kind']; embed: Embed; rule: string }> {
  const rules: Record<Embed['kind'], string> = {
    readback: 'What Rocoto read out of their message, as lines. Their own words stand above it in the thread.',
    albaran: 'The finished document, folded to a card. The door opens the albarán itself.',
    price: 'One line’s price, answered on the spot from today’s sheet.',
    reasoning: 'Why this one is waiting, in the customer’s terms — and the door into the composer.',
  };
  const out: Array<{ kind: Embed['kind']; embed: Embed; rule: string }> = [];
  for (const sale of sales) {
    const fold = embedsOf(sale);
    const all: Embed[] = [...fold.turns.map((t) => t.embed), ...Object.values(fold.onRow)];
    for (const embed of all) {
      if (out.some((o) => o.kind === embed.kind)) continue;
      out.push({ kind: embed.kind, embed, rule: rules[embed.kind] });
    }
    if (out.length === 4) break;
  }
  /* A REFERENCE PAGE OWES ALL FOUR FACES. The price answer is the rarest of them — it only folds
     onto a sale whose customer asked what something was at — so a morning that happens to contain
     none would leave this page documenting three of four. The sale and the line are still the
     house's own; only the pairing is the page's, which is the same thing every demo on this site
     does when it hands a component a subject. */
  if (!out.some((o) => o.kind === 'price')) {
    const sale = sales.find((s) => s.lines.length > 0);
    if (sale) out.push({ kind: 'price', embed: { kind: 'price', sale, line: sale.lines[0] }, rule: rules.price });
  }
  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

function ChatEmbeds() {
  const { cast, sales } = useHouse();
  const set = React.useMemo(() => embedSet(sales), [sales]);
  return (
    <Section
      t="Chat Embeds"
      n="A document rendered inside a conversation. Four kinds, one grammar: a label that names the thing, the fact underneath it, and a door — the whole card is the door. They ride the dotted paper, which in this app means exactly one thing: this is the talk."
    >
      <Grid>
        {set.map(({ kind, embed, rule }) => (
          <Tile key={kind} name={kind} rule={rule} span={6}>
            <div style={{ width: '100%', maxWidth: 380 }}>
              <ChatEmbed embed={embed} cast={cast} />
            </div>
          </Tile>
        ))}
      </Grid>
    </Section>
  );
}

/* ── THE TARIFAS EDITOR ───────────────────────────────────────────────────────────────────── */

function TiersEditor() {
  const { cast, day, hour } = useHouse();
  const tiers = tiersOfHouse(cast);
  const product = cast.products[0];
  const second = cast.products[1] ?? product;
  /* THE PERCENTAGE MODE IS A STATE OF THE SAME CARD, so the page opens it on one card and leaves
     the other at rest — which is how a reader sees that the difference is a column and a gutter
     rather than a different object. */
  const [draft, setDraft] = React.useState<Draft | null>(null);
  React.useEffect(() => {
    if (!product || tiers.length < 2 || draft) return;
    /* THE RELATIONSHIP IS THE MODULE'S OWN, never a shape composed here. A demo that hand-rolls a
       component's state is a demo that goes stale the day the state grows a field — which is
       exactly what a reference page exists to catch rather than to commit. */
    setDraft({ product: second.id, rel: seedRelationship(tiers), anchorPrice: 14.8 });
  }, [product, second, tiers, draft]);

  if (!product) return null;
  return (
    <Section
      t="Tiers Editor"
      n="One product's bands, and today's price on each. The figure IS the affordance — no pencil, no dialog, and the unit shares the number's line at every state. Percentage mode grows the same rows ONE column and gives the arrow the gutter; that is the whole difference between the two."
    >
      <Grid>
        <Tile name="At rest" rule="Each band holds its own price. Typing over a figure writes that band and leaves the others where they were." span={6}>
          <div style={{ width: '100%' }}>
            <ProductTarifas cast={cast} product={product} tiers={tiers} day={day} hour={hour} draft={null} onDraft={() => {}} />
          </div>
        </Tile>
        <Tile name="Percentage mode" rule="The bands are held at percentages of one another. One typed number moves the anchor and every band follows it; the arrow says which band is the anchor and can be dragged to another." span={6}>
          <div style={{ width: '100%' }}>
            <ProductTarifas cast={cast} product={second} tiers={tiers} day={day} hour={hour} draft={draft} onDraft={setDraft} />
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}

/* ── THE PRODUCT CARD ─────────────────────────────────────────────────────────────────────── */

function ProductCardPage() {
  const { cast } = useHouse();
  const product = cast.products[0];
  if (!product) return null;
  return (
    <Section
      t="Product Card"
      n="What the goods ARE — opened from any line that names them. One column of one-fact rows: what it is on the tree, what it costs and how that price has moved, who takes it, and the units it is sold in. It is a reading surface with one way back, never a second place to edit a sale."
    >
      <Grid>
        <Tile name="The card" rule="The face is large here, because on this surface the goods are the subject rather than the row's mark." span={12}>
          <div style={{ width: '100%', maxWidth: 640 }}>
            <AppProductCard cast={cast} product={product} onBack={() => {}} />
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}

/* ── THE FIELDS ROW (FEED-IA §41.5, §45.1) ────────────────────────────────────────────────── */

function FieldsRow() {
  const { cast } = useHouse();
  const goods = cast.products.slice(0, 6);
  const [name, setName] = React.useState('');
  const [sort, setSort] = React.useState('');
  const [lot, setLot] = React.useState('');

  /* THE SHALLOW REGISTER — a closed set of a few words, which lands its six and needs no shelves. */
  const shallow: FieldSpec[] = [
    { id: 'name', label: 'Name', kind: 'write', value: name, placeholder: 'merluza de pincho',
      suggest: goods.map((p) => ({ word: p.name, why: 'they take it', face: p.name })), put: setName },
    { id: 'sort', label: 'Sort', kind: 'write', value: sort, placeholder: 'de pincho',
      suggest: [{ word: 'de pincho' }, { word: 'de roca' }, { word: 'salvaje' }], put: setSort },
    /* THE CLAUSE UNDER A FIELD IS A FACT ABOUT ITS VALUE, NEVER AN INSTRUCTION (FEED-IA §51.24).
       «Kept inside the house» and «Off today's sheet» explained the fields they sat under; the
       label carries the first now and the second says whose number it is and when it was written.
       ⚠ THIS SEAT WAS «Internal class» UNTIL FEED-IA §197.2 «Remove class everywhere». The kit
       shows the field the app actually has: the lot, which is when the goods came in (§193.4). */
    { id: 'lot', label: 'Lote', kind: 'pick', value: lot, placeholder: '—',
      suggest: [{ word: 'L-2408-11' }, { word: 'L-2408-09' }], put: setLot },
    { id: 'qty', label: 'Quantity', kind: 'number', value: '5', placeholder: '1' },
    { id: 'price', label: 'Price', kind: 'fact', value: '18', unit: '€/kg', note: 'Set 09:45 · 22.08' },
  ];

  /* THE DEEP ONE — the whole catalogue, grouped by the house's own shelves. Same component. */
  const [deep, setDeep] = React.useState('');
  const deepFields: FieldSpec[] = [
    { id: 'name', label: 'Name', kind: 'write', value: deep, placeholder: 'start typing', deep: true,
      suggest: goods.map((p, i) => ({
        word: p.name, why: i === 0 ? 'they take it' : 'on your list', face: p.name,
        group: i % 2 === 0 ? 'Pescado fresco' : 'Marisco',
      })), put: setDeep },
  ];

  return (
    <Section
      t="Fields"
      n="How a line is written and how one is corrected — the same row, because they are the same job seen twice. Each part keeps its own label, its own register and its own typo scoping, and it gains the thing a read-out chip could never have: a caret. Arrows walk between the fields; ↑↓ walk the suggestions; a value the register holds wears the token look."
    >
      <Grid>
        <Tile name="A row of parts" rule="`write` takes any words · `pick` is a closed register with no free-text path · `number` takes digits · `fact` states something no act on this surface writes. The unit shares the number's own line, never a line of its own." span={12}>
          <Fields fields={shallow} testid="kit-fields" />
        </Tile>
      </Grid>
      <div style={{ height: 14 }} />
      <Grid>
        <Tile name="A deep register" rule="`deep` says the register is the whole catalogue (§45.1: «they all have hundreds of SKUs — this is the normal customer»). It becomes search-first: the typing filters every SKU rather than six pre-ranked rows, the answer comes back under the house's own shelf headers, the 28px paintings carry the recognition, and the arrows walk it inside its own layer. Click the field to see the shelves." span={12}>
          <Fields fields={deepFields} testid="kit-fields-deep" />
        </Tile>
      </Grid>
    </Section>
  );
}

/* ── THE OBJECT DOOR (FEED-IA §43) ────────────────────────────────────────────────────────── */

function ObjectDoorPage() {
  const { cast } = useHouse();
  const customer = cast.customers[0];
  const product = cast.products[0];
  return (
    <Section
      t="Object Door"
      n="«There's a relationship between orders, customers, and products. Those are objects. Clickable across all… no dead names.» Every appearance of an object anywhere is a door to it, and every door wears ONE mark: a hairline underline on hover. Ink, because saffron belongs to Rocoto's own acts and a name is the person's. A word, because the chevron is the app's mark for a whole row. Drawn in the space the text already reserves, because hover may never change geometry."
    >
      <Grid>
        <Tile name="A customer" rule="Opens their sheet in the book — the same destination from a band card, a river row, a product's buyer list or an albarán's head." span={4}>
          <Door label={`Open ${customer.name}`} onOpen={() => {}}>{customer.name}</Door>
        </Tile>
        <Tile name="A product" rule="Opens the goods in the catalogue. A lot reference goes to the same place: the batches that came in live with the product." span={4}>
          <Door label={`Open ${product.name}`} onOpen={() => {}}>{product.name}</Door>
        </Tile>
        <Tile name="Inside a bigger door" rule="A card that is itself a door draws its press as a stretched target UNDER inert content, because a button may not contain a button. The door puts its own pointer events back — which is part of what a door IS, not something each site remembers." span={4}>
          <div style={{ position: 'relative', pointerEvents: 'none' }}>
            <Door label={`Open ${customer.name}`} onOpen={() => {}}>{customer.name}</Door>
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}

/* ── THE PROFILE SEAT (FEED-IA §44.5) ─────────────────────────────────────────────────────── */

function ProfileSeatPage() {
  return (
    <Section
      t="Profile Seat"
      n="«Settings moves to the profile, bottom-left of the sidebar, like most apps: the username/profile seat at the rail's foot; clicking opens a little menu — Settings · Subscription — each deep-linking into its part of Settings.» Settings leaves the rail's tab row on the desk, because a seat in the navigation is for a place you work and Settings is a place you visit."
    >
      <Grid>
        <Tile name="At the rail's foot" rule="The house's own name, its mark, and the menu under it. The rail draws it; nothing else does." span={6}>
          <div style={{ width: 76, background: 'transparent' }}>
            <ProfileSeat brand="Rocoto" current="sales" />
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}

export default function AppPrimitives() {
  return (
    <>
      <ProductCardPage />
      <TiersEditor />
      <ChatEmbeds />
      <FieldsRow />
      <ObjectDoorPage />
      <ProfileSeatPage />
      <KeycapPage />
      <PaintedTile />
    </>
  );
}
