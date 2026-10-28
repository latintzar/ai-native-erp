/* EVERY FORM OF U01 — the resolution primitive. BUILD-PLAN §6: P2 owns it.
 *
 * `U01` in the brief is four lines long: «Two to four candidate answers, ordered by what this
 * customer has chosen before. One press. The answer is stored and not asked again.» Ten cards in
 * this package are that sentence in ten situations, and the reason they are ONE screen rather than
 * ten is this file. A6 differs from A11 by which candidates it holds and by the word on the label,
 * and by nothing else — which is only mechanically true if the control is literally the same
 * component. So it is.
 *
 * THE LAW THIS FILE EXISTS TO ENFORCE (FLOWS §1b). **Every resolution writes twice** — the line it
 * fixes today, and the record entry that stops the question tomorrow. A resolution screen that
 * writes only to today's line is a defect: it is what makes the product ask the same question every
 * morning instead of getting quieter. `Writes` draws the second write, so the promise is on the
 * screen rather than in a paragraph. In fish A6 writes THREE times — line, record and batch —
 * because the gear and the production method are the same fact as the D12 traceability field
 * (C-18), and `Writes` takes a third row without a second component.
 *
 * THE FORMS
 *   `Ask`         the machine's own line — the one field it is asking a person for. The ONLY
 *                 saffron in this package: the accent marks Rocoto's own act and nothing else.
 *   `Candidates`  the chip row and the evidence that orders it. Above `overflowAt` surviving
 *                 candidates it becomes a Combobox CARRYING THE SAME ORDER (A6's second state).
 *   `Capture`     the one-field capture, stored against the product (A9, F2).
 *   `Fork`        two verbs with different consequences (A8's over / under, A12's supply / hold).
 *   `AlwaysTail`  the tail of `U01` — «for this order» becoming «settled» (J2).
 *   `Writes`      the second write, made visible.
 *   `Resolution`  the housing all of them sit in, inside a line opened in place.
 *
 * THE EVIDENCE IS HISTORY, NEVER A CONFIDENCE SCORE. «11 of their last 16 orders» is a fact a
 * distributor can check; «87% confident» is the machine talking about itself. `rank` is the one
 * place in the package that decides an order, so every chip row in ten cards is ordered the same
 * way.
 *
 * ── THE FIXTURES BELOW, AND WHY THEY ARE HERE ────────────────────────────────────────────────
 * `cast.ts` is P0's and frozen for this wave, and it holds one order per sector. Three facts these
 * ten cards need are not in it: a customer's order history (the evidence U01 is ordered by), the
 * preparations D4.sku-plus-type names with their yields (C-12), and the class word each family
 * uses (D4's label problem). They live here, in one place, derived from cast names and never
 * typed into a screen — the same discipline `cast.ts` keeps. They belong in `cast.ts` the next
 * time it opens; moving them is one import.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Tile, TileGroup, TILE_KIND } from 'baseui/tile';
import { Combobox } from 'baseui/combobox';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { Cast, Family, Product } from '../data/cast';
import { familyOf } from '../data/cast';
import RefChip from '../shell/RefChip';

/* ── THE EVIDENCE ─────────────────────────────────────────────────────────────────────────────
 * What a customer took before, over a window a person can hold in their head. Sixteen orders is
 * three weeks of a restaurant that orders on weekdays — long enough to mean something, short
 * enough that «11 of their last 16» is checkable rather than statistical. */

export const WINDOW = 16;

export type History = { taken: number; of: number };

/** A stable weight per (customer, answer) pair. Deterministic, so the same customer ranks the same
 *  candidates the same way on every render and on every reload — a chip row that reshuffles is a
 *  chip row nobody trusts. FNV-1a, chosen because it is four lines and has no dependencies. */
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
};

/** How steeply a habit falls away. A restaurant does not spread its orders evenly over five
 *  entries — it has one it always takes, one it takes when the first is short, and a tail. 0.6 is
 *  that shape: each next candidate takes about three fifths of the one above it, which over
 *  sixteen orders reads 7 · 4 · 2 · 2 · 1 rather than a flat row of threes nobody can rank. */
const DECAY = 0.6;

/** Order candidates by what THIS customer has taken before, and hand each one its evidence.
 *  Largest-remainder allocation over the window, so the counts sum to the window exactly and a
 *  reader can add them up. */
export function rank<T>(items: T[], keyOf: (item: T) => string, customerId: string): Array<{ item: T; history: History }> {
  if (items.length === 0) return [];
  /* the hash decides the ORDER; the decay decides the SHAPE — so the evidence always ranks */
  const byHabit = items
    .map((item, i) => ({ item, i, w: hash(`${customerId}·${keyOf(item)}`) }))
    .sort((a, b) => b.w - a.w);
  const decay = byHabit.map((_, k) => Math.pow(DECAY, k));
  const total = decay.reduce((a, b) => a + b, 0);
  const exact = decay.map((d) => (d / total) * WINDOW);
  const floors = exact.map((e) => Math.floor(e));
  let left = WINDOW - floors.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((e, k) => ({ k, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r);
  for (const { k } of byRemainder) {
    if (left <= 0) break;
    floors[k] += 1;
    left -= 1;
  }
  return byHabit.map(({ item }, k) => ({ item, history: { taken: floors[k], of: WINDOW } }));
}

/** The evidence, in words. A candidate with no history reads as a first time, which is a fact
 *  about the customer and not a hedge about the machine. */
export const evidenceText = (h: History): string =>
  h.taken > 0 ? `${h.taken} of their last ${h.of} orders` : 'A first time for them';

/* ── THE CATALOGUE ENTRIES A CHIP CARRIES ─────────────────────────────────────────────────────
 * A6's sharpest call: THE CHIPS ANSWER THE WHOLE SKU, NEVER AN AXIS. Fish disambiguates on one
 * axis, meat on two, fruit on three, and three axes want a matrix — a different screen. A complete
 * catalogue entry keeps the control identical whatever the sector: «Mango de barco · calibre 12 ·
 * categoría I» is one press whether the account has one axis or three. */

export type Entry = {
  id: string;
  product: Product;
  /** the family's own line fields, filled for this product — the rest of the entry */
  facts: Array<{ label: string; value: string }>;
};

/** Every complete entry in the account's catalogue, family by family. */
export const entriesOf = (cast: Cast): Entry[] =>
  cast.products.map((product) => {
    const family = familyOf(cast, product);
    return {
      id: product.id,
      product,
      facts: family.lineFields.map((label) => ({ label, value: product.trace[label] ?? '' })),
    };
  });

/** The entry, spelled the way a chip says it. */
export const entryText = (e: Entry): string =>
  [e.product.name, ...e.facts.map((f) => `${f.label} ${f.value}`)].join(' · ');

/** The distinct values one family field takes across the account — the candidate set when the
 *  product is known and one of its facts is the thing that could not be read (A3). */
export const valuesOf = (cast: Cast, field: string): string[] =>
  Array.from(new Set(cast.products.map((p) => p.trace[field]).filter((v): v is string => !!v)));

/* ── THE DAY'S PRICE, DERIVED ────────────────────────────────────────────────────────────────
 * When a resolution changes WHICH entry a line is, the line's money changes with it and the
 * order's total moves — that movement is the proof the answer landed on the order rather than on a
 * form. The price comes out of the cast rather than out of a builder's head: the order's own price
 * where the order carries the product, and otherwise the account's own markup applied to that
 * product's lote cost. The markup is measured from the order itself, so a re-priced cast re-prices
 * every candidate with it. */

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The markup this account is running today, read off its own order. */
export function markupOf(cast: Cast): number {
  const pairs = cast.order.lines
    .map((l) => {
      const batch = cast.batches.find((b) => b.product === l.product);
      return batch && batch.cost > 0 ? l.price / batch.cost : null;
    })
    .filter((r): r is number => r !== null);
  return pairs.length > 0 ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 1.4;
}

/** What this product sells for today. */
export function priceOf(cast: Cast, product: Product): number {
  const onOrder = cast.order.lines.find((l) => l.product === product.id);
  if (onOrder) return onOrder.price;
  const batch = cast.batches.find((b) => b.product === product.id);
  if (batch) return round2(batch.cost * markupOf(cast));
  const mean = cast.order.lines.reduce((s, l) => s + l.price, 0) / cast.order.lines.length;
  return round2(mean);
}

/* ── A LINE THE MACHINE COULD NOT PLACE ───────────────────────────────────────────────────────
 * The order card draws a line's second row from ITS FAMILY's field set, which is what makes A1's
 * sector proof mechanical. So a line whose sort was not understood is drawn by giving that one
 * product a family with an empty field set — the row loses its facts, and only that row does. When
 * the answer lands the product goes back to its own family and the facts appear: THE ORDER
 * RE-FORMS AROUND THE ANSWER, in the canonical's own markup, with nothing special drawn for it. */
export function withUnplacedLine(cast: Cast, productId: string): Cast {
  const product = cast.products.find((p) => p.id === productId);
  if (!product) return cast;
  const family = familyOf(cast, product);
  const unplaced: Family = { ...family, id: `${family.id}-unplaced`, lineFields: [] };
  return {
    ...cast,
    families: [...cast.families, unplaced],
    products: cast.products.map((p) => (p.id === productId ? { ...p, family: unplaced.id } : p)),
  };
}

/* ── THE PREPARATIONS (C-12) ──────────────────────────────────────────────────────────────────
 * A10's exception to brief §2 rule 1, resolved: a preparation is `D4.sku-plus-type` — a NAMED
 * FIELD on the line with a stored yield ratio per product × preparation, feeding F1. The free-text
 * note stays inert in every sector. In fruit the slot is only ever the note; in fish and meat the
 * same slot carries a preparation that changes the weight that leaves by a third or more.
 *
 * The yields are the trade's own arithmetic: a hake gutted and headed loses better than a third,
 * filleted better than half. They are the shape of the fact, and the founder's own numbers replace
 * them in one edit. */

export type Preparation = { id: string; name: string; yield: number };

export const PREPARATIONS: Record<string, Preparation[]> = {
  pescado: [
    { id: 'limpio', name: 'limpio, sin cabeza', yield: 0.62 },
    { id: 'fileteado', name: 'fileteado', yield: 0.46 },
  ],
  carne: [
    { id: 'deshuesado', name: 'deshuesado', yield: 0.78 },
    { id: 'fileteado', name: 'fileteado', yield: 0.9 },
  ],
  fruta: [],
  ambient: [],
};

export const preparationsFor = (family: Family): Preparation[] => PREPARATIONS[family.id] ?? [];

/* ── THE CLASS WORD (A11) ─────────────────────────────────────────────────────────────────────
 * D4's label problem, drawn. Fruit says *categoría* daily; meat says *categoría* and
 * *conformación*; fish says *talla*. The CONTROL is the same in all three — the word on it is
 * configuration, and that is A11's whole argument. The values are the classes that exist for that
 * family; fruit's come from the cast itself, so only the two families the cast is silent about
 * carry a list here. */

export type ClassWord = {
  word: string;
  values: string[];
  /** the class customers say that this catalogue does not hold — A11's condition, per family */
  asked: string;
};

export const CLASS_WORD: Record<string, ClassWord> = {
  pescado: { word: 'talla', values: ['grande', 'mediana', 'pequeña'], asked: 'extra grande' },
  carne: { word: 'categoría', values: ['extra', 'primera', 'segunda'], asked: 'suprema' },
  fruta: { word: 'categoría', values: [], asked: 'extra' },
  ambient: { word: 'categoría', values: [], asked: 'extra' },
};

/** The word this family puts on the control, and the classes that exist behind it. Fruit's classes
 *  are read from the cast, because the cast already holds them. */
export function classesOf(cast: Cast, family: Family): ClassWord {
  const base = CLASS_WORD[family.id] ?? CLASS_WORD.fruta;
  const fromCast = valuesOf(cast, base.word);
  return { ...base, values: fromCast.length > 0 ? fromCast : base.values };
}

/* ── THE ANSWER, AS A TAG ─────────────────────────────────────────────────────────────────────
 * Base's Tag clips its text at a fixed width, which is right for a filter chip and wrong for an
 * answer: «Saved. This is se…» is a sentence the reader has to guess the end of. The override lifts
 * the clip and lets the answer wrap, and it lives here so all ten cards get it at once. */
export const ANSWER_TAG = {
  Text: { style: () => ({ maxWidth: 'none', whiteSpace: 'normal' as const }) },
};

/* ── PLURALS ──────────────────────────────────────────────────────────────────────────────────
 * «2 caja» is the kind of small wrongness that makes a screen look machine-made. The pack units in
 * the cast are Spanish nouns that all take an -s, so one rule covers caja, pieza and kg alike. */
export const packWord = (n: number, unit: string): string =>
  n === 1 || unit === 'kg' ? unit : `${unit}s`;

/** «extra, primera and segunda» — a list a person reads aloud without stumbling. */
export const listOf = (parts: string[]): string =>
  parts.length <= 1
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/** The order card draws the superseded pack count with the product's own pack unit, so the plural
 *  has to reach the cast rather than the screen. One derived product, nothing else moved. */
export function withPackPlural(cast: Cast, productId: string, n: number): Cast {
  return {
    ...cast,
    products: cast.products.map((p) =>
      p.id === productId && p.pack ? { ...p, pack: { ...p.pack, unit: packWord(n, p.pack.unit) } } : p,
    ),
  };
}

/* ── THE SORTS OF ONE PRODUCT (A6) ────────────────────────────────────────────────────────────
 * The customer named the product and left the sort unsaid, so the candidates are THE SAME PRODUCT
 * at every sort the account's catalogue holds — one axis in fish, two in meat, three in fruit, and
 * one control for all of them. The values come out of the cast's own products, so a catalogue with
 * four sorts offers four and a catalogue with one offers one. */

export type Sort = { id: string; facts: Array<{ label: string; value: string }> };

export function sortsOf(cast: Cast, product: Product): Sort[] {
  const family = familyOf(cast, product);
  if (family.lineFields.length === 0) return [];
  const seen = new Map<string, Sort>();
  for (const p of cast.products) {
    if (familyOf(cast, p).id !== family.id) continue;
    const facts = family.lineFields.map((label) => ({ label, value: p.trace[label] ?? '' }));
    const id = facts.map((f) => f.value).join('|');
    if (!seen.has(id) && facts.every((f) => f.value)) seen.set(id, { id, facts });
  }
  return [...seen.values()];
}

export const sortText = (product: Product, sort: Sort): string =>
  [product.name, ...sort.facts.map((f) => `${f.label} ${f.value}`)].join(' · ');

/** The line re-formed around the sort that was chosen: the product keeps its name and takes the
 *  facts it was given, so the order card's own second row fills with no special drawing. */
export function withSort(cast: Cast, productId: string, sort: Sort): Cast {
  return {
    ...cast,
    products: cast.products.map((p) =>
      p.id === productId
        ? { ...p, trace: { ...p.trace, ...Object.fromEntries(sort.facts.map((f) => [f.label, f.value])) } }
        : p,
    ),
  };
}

/* ── THE ASK ──────────────────────────────────────────────────────────────────────────────────
 * The machine's own line: the one field it is asking a person for. THE ONLY SAFFRON IN THIS
 * PACKAGE. The accent marks Rocoto's own act and nothing else, and asking is the act — a mark on
 * the person's own buttons would say the machine pressed them.
 *
 * It is a QUESTION, not a report. «Which zona this Merluza came from» names the field; «Rocoto
 * could not read the origin» spends the line on the machine (law 7, and the copy law: say what
 * IS). */
export function Ask({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        display: 'flex',
        gap: theme.sizing.scale400,
        alignItems: 'baseline',
        borderLeft: `2px solid ${theme.colors.accent}`,
        paddingLeft: theme.sizing.scale500,
      }}
    >
      <span style={{ ...theme.typography.LabelSmall, color: theme.colors.accent, whiteSpace: 'nowrap' }}>
        Rocoto asks
      </span>
      <span style={{ ...theme.typography.ParagraphSmall, minWidth: 0 }}>{children}</span>
    </div>
  );
}

/* ── THE CHIP ROW, AND ITS OVERFLOW ───────────────────────────────────────────────────────────
 * Two to four candidates, ordered by what this customer has chosen before, one press. Above
 * `overflowAt` survivors the same list becomes a Combobox CARRYING THE SAME ORDER — the ranking is
 * the product, so it survives the change of control. Drawing both states is A6's second state and
 * it is the reason `overflowAt` is a prop rather than a constant read once.
 *
 * The control is Base's own Tile group in single-select: a label, a body for the evidence, and
 * Base's keyboard behaviour intact. A chip that carried its evidence in a tooltip would be a chip
 * whose ordering nobody can check. */

export type Candidate = {
  id: string;
  /** the whole answer, said the way the catalogue says it */
  label: string;
  /** the evidence that put it here */
  history: History;
  /** a quieter clause under the label, where the answer needs one */
  detail?: string;
};

export type CandidatesProps = {
  candidates: Candidate[];
  /** the id that has been pressed, or null while the question stands */
  chosen: string | null;
  onChoose: (id: string) => void;
  /** what the Tag says once the answer is stored */
  settledText?: string;
  /** above this many survivors the row becomes a Combobox */
  overflowAt?: number;
  /** what the Combobox's field says while it is empty */
  placeholder?: string;
  /** what a screen reader calls the group */
  ariaLabel?: string;
  /** the block that replaces the row once an answer is pressed. Absent, the Tag stands alone. */
  children?: React.ReactNode;
};

export function Candidates({
  candidates,
  chosen,
  onChoose,
  settledText = 'Saved. This is settled.',
  overflowAt = 4,
  placeholder,
  ariaLabel = 'the candidates',
  children,
}: CandidatesProps) {
  const [, theme] = useStyletron();
  const [typed, setTyped] = React.useState('');
  const picked = candidates.find((c) => c.id === chosen) ?? null;

  /* pressed: the others leave and the answer stands as a Tag. «The chips collapse to a Tag» is
     literal — the row is gone, because a row of alternatives beside a settled answer invites the
     question to be asked again. */
  if (picked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
        <div style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary} overrides={ANSWER_TAG}>
            {picked.label}
          </Tag>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {settledText}
          </span>
        </div>
        {children}
      </div>
    );
  }

  /* more than four survive the ranking: the same order, in a field that can be typed into */
  if (candidates.length > overflowAt) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {ariaLabel}
        </span>
        <Combobox
          value={typed}
          onChange={(next, option) => {
            setTyped(next);
            const hit = (option as Candidate | null) ?? candidates.find((c) => c.label === next) ?? null;
            if (hit) onChoose(hit.id);
          }}
          options={candidates}
          mapOptionToString={(c) => (c as Candidate).label}
          mapOptionToNode={({ option }) => {
            const c = option as Candidate;
            return (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={theme.typography.LabelSmall}>{c.label}</span>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                  {evidenceText(c.history)}
                </span>
              </div>
            );
          }}
          size={INPUT_SIZE.compact}
          listBoxLabel={ariaLabel}
          clearable
          overrides={{
            /* Base's Combobox has no placeholder of its own; the field underneath does, and an
               empty field with nothing written on it is a control nobody knows how to start. */
            Input: { props: { placeholder: placeholder ?? 'Type to narrow the list' } },
          }}
        />
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
          {candidates.length} entries, the ones this customer takes most at the top.
        </span>
      </div>
    );
  }

  return (
    <TileGroup
      kind="singleSelect"
      ariaLabel={ariaLabel}
      selected={-1}
      onClick={(_e, index) => onChoose(candidates[index].id)}
    >
      {candidates.map((c) => (
        <Tile key={c.id} tileKind={TILE_KIND.selection} label={c.label}>
          <span style={{ display: 'block', ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            {evidenceText(c.history)}
          </span>
          {c.detail && (
            <span style={{ display: 'block', ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
              {c.detail}
            </span>
          )}
        </Tile>
      ))}
    </TileGroup>
  );
}

/* ── THE ONE-FIELD CAPTURE (A9 · F2) ──────────────────────────────────────────────────────────
 * A ratio, a weight, a number the product will hold from now on. The unit rides the field's own
 * line, because a figure and its unit on two lines is a mis-sale wherever it happens — a
 * `4` above `kg per caja` is read as a four and nothing else.
 *
 * The same component serves the desk (A9) and the bench (F2). F2 ≡ A9: one screen, two entry
 * points, and the phone one takes a voice control in `assist` because the hand at the bench is
 * holding a box. */
export type CaptureProps = {
  /** what the number is, in the fewest words that name it */
  label: string;
  /** the unit, on the field's own line */
  unit: string;
  value: string;
  onChange: (v: string) => void;
  onStore: () => void;
  /** the product the number lands on, once it is stored */
  storedOn?: React.ReactNode;
  stored: boolean;
  /** a control beside the field — the Voice Button, at the bench */
  assist?: React.ReactNode;
  /** what the store control says */
  storeLabel?: string;
  size?: 'compact' | 'default';
};

export function Capture({
  label,
  unit,
  value,
  onChange,
  onStore,
  storedOn,
  stored,
  assist,
  storeLabel = 'Store it',
  size = 'compact',
}: CaptureProps) {
  const [, theme] = useStyletron();
  if (stored) {
    return (
      <div style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary} overrides={ANSWER_TAG}>
          {value} {unit}
        </Tag>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          Stored on {storedOn}. This is settled.
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 180, flex: 1 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <Input
          value={value}
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          size={size === 'compact' ? INPUT_SIZE.compact : INPUT_SIZE.default}
          type="text"
          inputMode="decimal"
          endEnhancer={unit}
          placeholder="0"
        />
      </label>
      {assist}
      <Button kind={KIND.secondary} size={size === 'compact' ? SIZE.compact : SIZE.default} onClick={onStore} disabled={value.trim() === ''}>
        {storeLabel}
      </Button>
    </div>
  );
}

/* ── THE FORK (A8 · A12) ──────────────────────────────────────────────────────────────────────
 * Two verbs with two different consequences, and the consequence rides the verb rather than a
 * paragraph under it. This is not `Candidates` with two entries: a fork has no ranking, because
 * both answers are correct and the person is choosing which one to live with. */
export type ForkOption = { id: string; label: string; consequence: string };

export function Fork({
  options,
  chosen,
  onChoose,
}: {
  options: ForkOption[];
  chosen: string | null;
  onChoose: (id: string) => void;
}) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const isChosen = chosen === o.id;
        return (
          <Button
            key={o.id}
            kind={isChosen ? KIND.primary : KIND.secondary}
            size={SIZE.compact}
            shape={SHAPE.pill}
            onClick={() => onChoose(o.id)}
            overrides={{ BaseButton: { style: () => ({ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }) } }}
          >
            <span style={theme.typography.LabelSmall}>{o.label}</span>
            <span style={{ ...theme.typography.ParagraphXSmall, opacity: 0.75 }}>{o.consequence}</span>
          </Button>
        );
      })}
    </div>
  );
}

/* ── THE TAIL (J2) ────────────────────────────────────────────────────────────────────────────
 * The moment a one-off answer is made permanent, and that making it permanent takes NO NAVIGATION.
 * It is the tail of `U01` and it appears in A6, A9, A11, C7 and F2 — drawn once, here, so five
 * cards cannot drift from each other. */
export function AlwaysTail({
  scope,
  always,
  onAlways,
  onceText = 'Saved for this order',
  alwaysLabel = 'Always',
}: {
  /** what the standing answer would apply to — «Can Solé», «Can Solé · Merluza» */
  scope: React.ReactNode;
  always: boolean;
  onAlways: () => void;
  onceText?: string;
  alwaysLabel?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
      <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary} overrides={ANSWER_TAG}>
        {always ? 'Saved. This is settled.' : onceText}
      </Tag>
      {always ? (
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          It stands for {scope} from now on.
        </span>
      ) : (
        <>
          <Button kind={KIND.secondary} size={SIZE.mini} shape={SHAPE.pill} onClick={onAlways}>
            {alwaysLabel}
          </Button>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            for {scope}
          </span>
        </>
      )}
    </div>
  );
}

/* ── THE SECOND WRITE, MADE VISIBLE ───────────────────────────────────────────────────────────
 * FLOWS §1b is the whole reason this package exists as one package: every resolution writes twice,
 * and in fish A6 writes three times (C-18). The rows appear as the writes land, each naming the
 * object it wrote to and carrying the pointer to the card that owns that object — so the promise
 * «this question stops being asked» is a thing on screen with an address, rather than a claim. */

export type Write = {
  /** the object written — «the line», «Can Solé's record», «L-2208» */
  object: React.ReactNode;
  /** what landed on it */
  text: React.ReactNode;
  /** the card that owns the object */
  ref?: string;
};

export function Writes({ writes }: { writes: Write[] }) {
  const [, theme] = useStyletron();
  if (writes.length === 0) return null;
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        padding: theme.sizing.scale400,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale300,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Written {writes.length} {writes.length === 1 ? 'place' : 'places'}
      </span>
      {writes.map((w, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, auto) minmax(0, 1fr) auto',
            gap: theme.sizing.scale400,
            alignItems: 'baseline',
          }}
        >
          <span style={theme.typography.LabelSmall}>{w.object}</span>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
            {w.text}
          </span>
          {w.ref ? <RefChip to={w.ref} size="mini" /> : <span />}
        </div>
      ))}
    </div>
  );
}

/* ── THE HOUSING ──────────────────────────────────────────────────────────────────────────────
 * What a line looks like once it opens in place. Every card in this package puts its resolution
 * inside one of these, so «the order re-forms around the answer» reads the same everywhere: the
 * ask, the sound where there is sound to replay, the control, the writes, the tail. */
export function Resolution({
  ask,
  media,
  children,
  writes,
  tail,
  after,
}: {
  ask: React.ReactNode;
  /** the sound to replay — a Waveform, where the fragment is worth hearing again */
  media?: React.ReactNode;
  children: React.ReactNode;
  writes?: Write[];
  tail?: React.ReactNode;
  /** anything that belongs under the writes — a composed reply, a preview */
  after?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  /* THE HOUSING PAINTS ITS OWN GROUND. Base's secondary button, its input and its tiles are all
     drawn in the light greys of the light theme, and the order card's opened line is a light grey
     too — a control that lands on it disappears. One surface here, and every control in ten cards
     reads. */
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale500,
        marginTop: theme.sizing.scale400,
        background: theme.colors.backgroundPrimary,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
      }}
    >
      <Ask>{ask}</Ask>
      {media}
      {children}
      {writes && writes.length > 0 && <Writes writes={writes} />}
      {tail}
      {after}
    </div>
  );
}
