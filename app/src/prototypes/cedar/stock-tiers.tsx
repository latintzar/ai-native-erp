/* TARIFAS — the per-product price block, the house-level SETTING, and §76's price entry.
 *
 * ═══ WHERE THIS LIVES AND WHY (FEED-IA §75.4 · THE-OBJECT-MAP C1–C4) ════════════════════════
 * «But the catalogue is the main thing. Tariffs are inside each thing. It's a per-product thing.»
 * That sentence splits this file's contents in two, and each half now stands where it belongs:
 *
 *   THE PER-PRODUCT HALF   `ProductTarifas` — every band's price for ONE product, written in
 *                          place, with the chain and the percentage relationship. It mounts on
 *                          the PRODUCT'S SHEET (`product-card.tsx`, frame='sheet') and nowhere
 *                          else. A tarifa is a subobject of a product; this is that subobject.
 *   THE HOUSE-LEVEL HALF   `TarifasCard` — the band names, their sizes, add and rename. That is
 *                          settings-weight content: rare, consequential, phone-tweakable. It is
 *                          hosted by ONE ADMIN ROW (`areas/admin/operations.tsx`), in the
 *                          `rows.tsx` grammar every other setting is written in.
 *
 * WHAT DIED WITH THAT SPLIT: `TiersSection` and the TARIFAS SEAT it stood on. Stock had three
 * seats — catalogue · incoming · tarifas — and a rate card standing at a register's own rank is
 * the object-model error §75.4 names. Stock has two seats now; the tarifas are a setting and a
 * subobject, which is what they always were.
 *
 * ═══ AND §76's PRICE ENTRY LIVES HERE TOO ═══════════════════════════════════════════════════
 * «Make changing 80 prices feel like triaging notifications, not editing 80 database records.»
 * `PriceEntry` is that surface: one task at a time, the number with visual priority, the previous
 * value stated, Save & next, and an Undo that means it. It lives beside `PriceCell` because they
 * are the same act at two sizes — the figure IS the field — and a second file would let them
 * drift.
 *
 * ═══ §115.2 · THE RUN IS THE TARIFFS, NEVER THE PRODUCTS ════════════════════════════════════
 * «They click Save and Next, and then nothing happens… they click Save and Next, GO TO THE NEXT
 * TARIFF, and click Save and Next again. If it's 3/10, is that the tariff, or what? Why would they
 * change just one tariff and not change the other? That's silly! They wouldn't be doing Save and
 * Next for individual products, because what if they just want to change 10 of the 200 products
 * they have? They wouldn't be following this linear fashion. THEY ONLY FOLLOW IT LINEARLY FOR THE
 * TARIFFS.»
 *
 * That inverts the whole surface, and it is the correct object model besides: a price is a fact
 * about (product, tarifa, day), a person decides about a PRODUCT, and the thing that is genuinely
 * a queue is the handful of bands that one decision has to be written across.
 *
 * ── THE FILM (§115.6 — the beats, before the layout) ────────────────────────────────────────
 *   BEAT 0 · BEFORE    a product was picked AD HOC — a catalogue row, a search hit, the tap on
 *                      its own price bar. The sheet opens holding that one product.
 *   BEAT 1 · THE       the face at 72px, the name, the keyword. IT HOLDS STILL for the whole
 *            SUBJECT   run — one product is being priced, and it may not flicker under the hand.
 *   BEAT 2 · THE BAND  the house's bands as chips, the one being written selected, «2 of 3»
 *                      beside them. The chips ARE the progress: no second rail saying it again.
 *   BEAT 3 · THE       the number is the field. Enter or «Save & next» writes it and THE BAND
 *            ACTION    ADVANCES — chip, field and standing price arrive together while the
 *                      subject above them does not move. That is the change he could not see.
 *   BEAT 4 · THE       the last band's Save opens the reading of what this product now costs on
 *            LANDING   every band; Publish closes the sheet and the person is back at the
 *                      catalogue, picking the next product.
 *
 * ── WHAT SURVIVED ROUND 1 (§111.3), AND WHY ─────────────────────────────────────────────────
 * The centred subject, the keyword under the name, the fixed one-line slots, the tightened gaps
 * and V19's «the standing price is a Figure, not prose» all stand — they were about what the
 * sheet SAYS, and only the walk was wrong. What died with the product walk: the run rail, and the
 * place counter that read «3 of 12» about a queue of products, which is the exact «3/10 — is that
 * the tariff, or what?» he could not parse.
 *
 * ── THE ONE RUN THAT IS STILL PRODUCTS, AND WHY IT IS NOT AN EXCEPTION ──────────────────────
 * §16.5's PASTE is a different act from day-pricing. Its rates are ALREADY KNOWN and arrive
 * attached to their products; the walk is a confirmation, not a decision, and «bulk update» is the
 * whole point of it. Peter's correction is about the run a person TYPES into — «what if they just
 * want to change 10 of the 200 products» — which is precisely the run whose numbers nobody has.
 * So the sheet reads the shape off the run rather than off a mode: a target carrying `given` is a
 * pasted line and walks products; a target with no rate on it is the hand's own and walks tarifas.
 *
 * ═══ ONE TIER MEANS THE WORD DISAPPEARS ════════════════════════════════════════════════════
 * A house with one tarifa gets ONE FACT and nothing else: no dropdown, no column, no chain, no
 * percentage control, no chevron. The vocabulary is absent rather than disabled, and it appears
 * the moment the house grows a second band. Progressive disclosure BY DATA — nothing here is a
 * mode, and no switch turns the machinery on.
 *
 * ═══ THE TWO CONTROLS ON A PRODUCT, AND WHAT EACH ONE MEANS ════════════════════════════════
 *   · THE CHAIN — Figma's corner-radius link, exactly. Closed: one price serves every tarifa and
 *     typing it writes them together. Open: the typed price moves its own band alone. It is
 *     visible at rest, and a house whose seed already prices its bands apart reads as OPEN on the
 *     first render, because that is what the numbers say.
 *   · THE PERCENTAGE — the founder's own spec: an arrow anchors the middle band (the upper middle
 *     when the count is even), the others become symmetric ±10/20/30 relationships, the anchor's
 *     price is the ONLY ink and every other price renders grey and computed. Dragging or clicking
 *     the arrow onto another band re-anchors, and the offsets recompute so no absolute price
 *     moves at that instant. NOTHING COMMITS UNTIL SAVE; Back restores exactly.
 *
 * ═══ AND THE MODE'S TWO ACTS STAND IN THE PANE'S ONE STICKY FOOTER (AUDIT-2 C1 · §59.1) ══════
 * «An act TRANSFORMS ITS OWN CONTROL, in place; acting NEVER stacks new rows.» Entering the
 * percentage state used to INSERT a full-width band between the mode label and the list — measured
 * at 1600: the three tarifa rows fell 658→728, 743→813, 828→898, a 70px shove — and then park Save
 * and Cancel as ordinary content at the foot of a pane that already has a sticky price dock. At
 * 1600×1000 `elementFromPoint` on the centre of Save (1005, 962) and of Cancel (1074, 962) both
 * returned the dock's own span: two sticky footers at one y, and the only two exits from a
 * committed state unclickable. The band is gone and the acts moved INTO the dock (`TarifaModeActs`,
 * mounted by `product-card.tsx`), so the pane keeps ONE sticky footer and the rows never move.
 *
 * ═══ BREATHING SPACE (FEED-IA §33) ═════════════════════════════════════════════════════════
 * A pricing table is the surface people fear, so it is the surface that has to feel roomy: bands
 * are 56px rows at their tightest, the relationship column gets its own air rather than being
 * squeezed between the name and the figure, the anchor arrow has a column to itself, and the
 * cards stand apart at scale800. Generosity is Base's own scale, used at the top of its range.
 *
 * ═══ WHAT IT NEVER DOES ════════════════════════════════════════════════════════════════════
 * No colour encodes anything: grey-computed against ink-typed is HIERARCHY, and the tarifas never
 * own colours. Saffron appears nowhere here, because every number on this surface is a person's.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { ButtonGroup, MODE as GROUP_MODE } from 'baseui/button-group';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import {
  SnackbarProvider,
  useSnackbar,
  DURATION as SNACK_DURATION,
  PLACEMENT as SNACK_PLACEMENT,
} from 'baseui/snackbar';
import { Figure } from './figure';
import { Glyph } from './glyphs';
import { OverlayCard, PLACEMENT, SCRIM, SIZE as OVERLAY_SIZE } from '../../rocoto/overlay-card';
import { WorkflowDialog } from './workflow-dialog';
import { usePhone } from './shell';
/* §16.7's DICTATE — the app's own voice control, the one that already takes a note in a chat. */
import { StatefulVoiceButton, type Take } from '../../rocoto/voice-button-kit';
import type { Cast, Customer, Product } from '../../scenarios/data/cast';
import { useConfig } from './config';
import { canonicalSyntheticAmount, syntheticAmountForCountry } from './currency';
import { useWorkspaceCapabilities, type WorkspaceCountry } from './workspace-capabilities';
import { posthog, isPostHogConfigured } from '../../posthog';
/* THE SORT THIS HOUSE SHIPS THE GOODS AS (§111.3). The keyword under the name comes off the same
   fold the ladder and the albarán's own line read, so «Merluza» on a price sheet and «Merluza» on a
   line are the same thing said the same way. */
import { sortOf } from './knows';
import { ProductFace } from './product-face';
/* THE SECOND DOOR ONTO A SHORTAGE (FEED-IA §101.2). The first is the message the goods came
   short on; this is the PRODUCT's own reading, where a person is already looking at that
   product's prices. One component, mounted twice — never a second reading of one fact. */
import { SupplyDoor } from './supply-broadcast';
import {
  ONE_LIST_WORDS,
  addTier,
  bandOf,
  chainOf,
  conflictWords,
  dropStamps,
  lastSetOf,
  offsetWords,
  parsePasted,
  priceHistoryOf,
  priceOn,
  priceUnitOf,
  writtenOn,
  pricesFrom,
  publishReading,
  publishWords,
  reanchor,
  registryOf,
  relationshipOf,
  renameTier,
  saveRelationship,
  seedRelationship,
  setChain,
  setPrices,
  sourceWords,
  tierNameOf,
  tiersOfHouse,
  useTiers,
  usePriceSaveError,
  writtenSince,
  type PriceStamp,
  type Relationship,
  type Tier,
} from './tiers';

const LOCALE = 'es-ES';

/** Price stores stay canonical PEN; editors speak in the active country's amount and unit. */
export const priceEditorAmount = (value: number, country: WorkspaceCountry): number =>
  syntheticAmountForCountry(value, country);
export const canonicalPriceEditorAmount = (value: number, country: WorkspaceCountry): number =>
  canonicalSyntheticAmount(value, country);
export const priceEditorUnit = (unit: string, country: WorkspaceCountry): string =>
  country === 'spain' ? unit.replace(/^S\//, '€') : unit;

export function PriceSaveNotice() {
  const [, theme] = useStyletron();
  const error = usePriceSaveError();
  return error ? <p role="alert" data-testid="price-save-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, margin: 0 }}>{error}</p> : null;
}

/* ── THE VARIATION MARK, IN ONE PLACE (FEED-IA §127.4c / S10) ─────────────────────────────────
 * «There needs to be a little bullet or bent arrow on each of the variations, and each of these
 * things should show that we cover different variations.»
 *
 * THE TENSION S10 NAMED, AND WHAT IT REALLY WAS. «The tariff selector at the top and then tariffs
 * in one of these feels wrong. Maybe this is all about how the catalog has different variations.»
 * Two surfaces were telling one story in two languages: the catalogue's LIST said «variation» with
 * a bent arrow on every member, while the sheet and the price run said it with an indent and a
 * sub-line — so the same relationship looked like two different relationships depending on which
 * pane a person was in, and the band vocabulary filled the gap by repeating itself.
 *
 * So the mark is ONE drawing and every surface that names a member wears it: the list, the sheet's
 * «What it comes as», and the run's own subject. A reader who has met one has met all of them (§30).
 *
 * WHY IT LIVES HERE. This is the file both price surfaces already import, and it is free of the
 * catalogue's own machinery. `areas/stock.tsx` still draws the identical path inline — it is a
 * parked file this pass may not touch — and it is owed this import the next time it is open.
 */
export function VariationMark({ nudge = false }: { nudge?: boolean }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-variation-mark="yes"
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flex: '0 0 auto',
        marginLeft: nudge ? `-${theme.sizing.scale600}` : undefined,
        color: theme.colors.contentTertiary,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4v8a4 4 0 0 0 4 4h11" />
        <path d="m15 12 4 4-4 4" />
      </svg>
    </span>
  );
}

/** «2025-08-20» → «20.08» — the house's own date form (FEED-IA §134.3.3's «as of»). It is written
 *  here rather than imported from `sale.ts` because this file prices goods and never folds them,
 *  and one four-line reader is cheaper than an edge from the price layer into the object layer. */
const dayShort = (id: string): string => {
  const parts = id.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : id;
};

/* ── THE MARKS ────────────────────────────────────────────────────────────────────────────────
 * Line work, on the Ramp's own terms («a mark is line work in this system», ramp.tsx's Lock). They
 * are drawn here rather than asked of `glyphs.tsx` because they are this control's own anatomy —
 * a chain whose two halves come apart, and an arrow that points at the band it anchors — and both
 * are STATES of one control rather than two meanings in the app's vocabulary.
 */

/** THE CHAIN. Closed, the links hold; open, they are apart and the gap is the whole message. */
const Chain = ({ closed }: { closed: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path
      d={closed ? 'M10 13.5h4' : 'M9.4 13.5H8.2M15.8 13.5h-1.2'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M9.6 9.2H7.8a3 3 0 0 0 0 6h1.8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.4 9.2h1.8a3 3 0 0 1 0 6h-1.8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {!closed && (
      <path d="M12 6.4v1.6M12 16.4V18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    )}
  </svg>
);

/** THE PERCENTAGE. The relationship, said as the thing it is: one number against another. */
const Percent = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M18.5 5.5 5.5 18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8.2" cy="8.2" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="15.8" cy="15.8" r="2.4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/** THE ARROW THAT ANCHORS. It points AT the band it holds, and it is the thing the hand drags.
 *  A band that is NOT the anchor shows the arrow's empty seat — a ring, which reads as somewhere
 *  to put something. It was a short dash for one build, and a dash in a column of −18,2% reads as
 *  a minus sign: the shot is how that was caught. */
const StepChevron = ({ direction }: { direction: 'back' | 'next' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={direction === 'back' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);

const Arrow = ({ on }: { on: boolean }) =>
  on ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 12h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m12 7.6 4.4 4.4-4.4 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );

/* ── THE SMALL SEATS ─────────────────────────────────────────────────────────────────────────── */

/** The product's own face — the app's one seat, one walk, one fallback (FEED-IA §33.2, item 2).
 *  This file used to draw its own painted tile with a MISS that rendered an empty grey square, so a
 *  product the library has no painting for stood on the tarifa sheet with a blank beside its name.
 *  `ProductFace` falls back to the drawn family mark, which is what every other surface does. */
const Face = ({ product, size = 40 }: { product: Product; size?: number }) => (
  <ProductFace of={product} size={size} />
);

/* ── THE PRICE CELL ───────────────────────────────────────────────────────────────────────────
 * IMMERSION EDITING (FEED-IA §31.3): the figure IS the affordance. There is no pencil, no edit
 * button and no dialog — the number is a button and typing over it is the edit. The unit shares
 * the number's line at every state, typed or read.
 *
 * IT WEARS THE APP'S ONE EDITABLE MARK (§51.14, the decision stated in full on `Editable` in
 * `detail.tsx`): a quiet underline AT REST, the ground painting under a pointer, the full box when
 * it opens. It used to answer «can I change this number» only to a mouse, which meant a person
 * reading a sheet of prices could not tell which of them were theirs to write.
 */

export function PriceCell({
  value,
  unit,
  ink,
  editable,
  size = 'compact',
  unset = false,
  testid,
  onCommit,
  onOpenSheet,
  onAdvance,
  buttonRef,
  country = 'peru',
}: {
  value: number;
  unset?: boolean;
  unit: string;
  /** the typed price. Grey means computed from the anchor, and grey is hierarchy, never status. */
  ink: boolean;
  editable: boolean;
  /** `large` is the sheet's own step (§37.5: «today's price per tier big») and the action bar's */
  size?: 'compact' | 'large';
  testid: string;
  onCommit: (next: number) => void | boolean;
  /** THE SAME ACT, IN A THUMB'S HOUSING (§76). «Use bottom sheets instead of sending users into
   *  deep edit pages» — at 390 an inline field under a caret is a target the thumb covers, so the
   *  number opens the price sheet instead of writing in place. Given, this REPLACES the inline
   *  field: one tap, one edit surface, never both. */
  onOpenSheet?: () => void;
  /** Enter is the fast desktop rhythm: commit this card and put the next tariff directly in edit. */
  onAdvance?: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  country?: WorkspaceCountry;
}) {
  const [, theme] = useStyletron();
  const [writing, setWriting] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [over, setOver] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);

  const commit = (): boolean => {
    const next = Number(draft.replace(',', '.'));
    if (!Number.isFinite(next) || next <= 0) {
      setInvalid(true);
      return false;
    }
    if (onCommit(canonicalPriceEditorAmount(next, country)) === false) return false;
    setInvalid(false);
    setWriting(false);
    return true;
  };

  if (writing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
        <span style={{ width: size === 'large' ? 132 : 104 }}>
          <Input
            autoFocus
            size={size === 'large' ? INPUT_SIZE.default : INPUT_SIZE.compact}
            value={draft}
            /* THE OLD PRICE IS SELECTED THE MOMENT THE FIELD OPENS. Immersion editing means the
               figure IS the field, so the first digit a person types is the new price — a caret
               parked after «14,82» makes the fast act («click, 18,40, Enter») write «14,8218,40»
               and refuse it. Found in a drive. */
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            onChange={(e) => { setDraft((e.target as HTMLInputElement).value); setInvalid(false); }}
            onBlur={() => { commit(); }}
            error={invalid}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (commit()) window.requestAnimationFrame(() => onAdvance?.());
              }
              if (e.key === 'Escape') setWriting(false);
            }}
            aria-label="Price"
            overrides={{ Input: { props: { 'data-testid': `${testid}-input`, inputMode: 'decimal' } } }}
          />
        </span>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{priceEditorUnit(unit, country)}</span>
      </span>
    );
  }

  const figure = unset ? <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>Set price</span> : (
    <Figure
      value={value}
      unit={unit}
      decimals={2}
      locale={LOCALE}
      size={size}
      overrides={ink ? undefined : { Value: { style: { color: theme.colors.contentTertiary } }, Unit: { style: { color: theme.colors.contentTertiary } } }}
    />
  );

  if (!editable) {
    return (
      <span data-testid={testid} data-price={value} data-ink={ink ? 'yes' : 'no'} style={{ display: 'inline-flex' }}>
        {figure}
      </span>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      data-testid={testid}
      data-price={value}
      data-ink={ink ? 'yes' : 'no'}
      data-editable="yes"
      data-opens={onOpenSheet ? 'sheet' : 'field'}
      onClick={() => {
        if (onOpenSheet) {
          onOpenSheet();
          return;
        }
        setDraft(String(priceEditorAmount(value, country)).replace('.', ','));
        setWriting(true);
      }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      title="Write a new price"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: '44px',
        minHeight: '44px',
        padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`,
        margin: `0 -${theme.sizing.scale300}`,
        /* THE ONE MARK (§51.14): a transparent ring that only ever paints, so a hover moves no
           geometry (§37.3), and the bottom edge standing in `mono400` at rest. */
        borderWidth: '1px',
        borderStyle: 'solid',
        borderTopColor: 'transparent',
        borderLeftColor: over ? theme.colors.mono400 : 'transparent',
        borderRightColor: over ? theme.colors.mono400 : 'transparent',
        borderBottomColor: theme.colors.mono400,
        ...(over ? { borderTopColor: theme.colors.mono400 } : null),
        borderRadius: theme.borders.radius200,
        background: over ? theme.colors.backgroundSecondary : 'transparent',
        color: 'inherit',
        cursor: 'default',
        fontFamily: 'inherit',
      }}
    >
      {figure}
    </button>
  );
}

/* ── THE REGISTRY ─────────────────────────────────────────────────────────────────────────────
 * A tarifa is a house object: a name, and the size of it. Creating and renaming are rare and
 * consequential, so they keep their words. Tapping the count opens the list of who is on it —
 * the number is the door, because the number is what a person doubts.
 */

/** A BAND'S NAME, TYPED OVER. Bands are created and renamed here and nowhere else, and renaming is
 *  rare enough to keep its words — so the name states itself, and a click puts a cursor in it. */
function TierName({ cast, tier }: { cast: Cast; tier: Tier }) {
  const [, theme] = useStyletron();
  const [writing, setWriting] = React.useState(false);
  const [draft, setDraft] = React.useState(tier.name);
  const [over, setOver] = React.useState(false);

  const commit = () => {
    if (renameTier(cast, tier.id, draft)) setWriting(false);
  };

  if (writing) {
    return (
      <span style={{ display: 'inline-flex', width: 220 }}>
        <Input
          autoFocus
          size={INPUT_SIZE.compact}
          value={draft}
          onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(tier.name);
              setWriting(false);
            }
          }}
          aria-label="Tariff name"
          overrides={{ Input: { props: { 'data-testid': `tier-name-input-${tier.id}` } } }}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid={`tier-name-${tier.id}`}
      data-editable="yes"
      title="Write a new name"
      onClick={() => {
        setDraft(tier.name);
        setWriting(true);
      }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        ...theme.typography.LabelMedium,
        display: 'inline-flex',
        padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`,
        margin: `0 -${theme.sizing.scale300}`,
        /* the app's one editable mark (§51.14) */
        borderWidth: '1px',
        borderStyle: 'solid',
        borderTopColor: over ? theme.colors.mono400 : 'transparent',
        borderLeftColor: over ? theme.colors.mono400 : 'transparent',
        borderRightColor: over ? theme.colors.mono400 : 'transparent',
        borderBottomColor: theme.colors.mono400,
        borderRadius: theme.borders.radius200,
        background: over ? theme.colors.backgroundSecondary : 'transparent',
        color: theme.colors.contentPrimary,
        cursor: 'text',
        fontFamily: 'inherit',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {tier.name}
    </button>
  );
}

function Registry({ cast, onMembers }: { cast: Cast; onMembers: (tier: Tier) => void }) {
  const [, theme] = useStyletron();
  const rows = registryOf(cast);
  /* ONE BAND IS STILL A REGISTRY (§75.4 · C4). The single-tarifa house used to get a different
     control — a one-line fact card with no name in it — which is exactly the «absence» the
     correction names: the house HAS a tarifa, so it stands in the registry with its name editable
     like any other, and the line under it says who is on it. One row, one grammar, and growing a
     second band changes nothing except the number of rows. */
  const sole = rows.length === 1;

  return (
    <div
      data-testid="tiers-registry"
      data-tiers={rows.length}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {rows.map((t, i) => (
        <div
          key={t.id}
          data-testid={`tier-row-${t.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale600,
            padding: `${theme.sizing.scale600} ${theme.sizing.scale700}`,
            borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
            minWidth: 0,
          }}
        >
          {/* THE NAME IS THE EDIT. Renaming a band is typing over it — no pencil, no dialog, the
              same immersion the prices keep (§31.3). */}
          <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
            <TierName cast={cast} tier={t} />
            {sole && (
              <span
                data-testid="tiers-one-fact"
                style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
              >
                {ONE_LIST_WORDS}
              </span>
            )}
          </span>
          <Button
            kind={KIND.tertiary}
            size={SIZE.compact}
            shape={SHAPE.pill}
            onClick={() => onMembers(t)}
            data-testid={`tier-count-${t.id}`}
          >
            {t.customers} {t.customers === 1 ? 'customer' : 'customers'}
          </Button>
        </div>
      ))}
    </div>
  );
}

/** WHO IS ON A BAND. The count's own door — names, in the house's own order. */
function Members({ cast, tier, onClose }: { cast: Cast; tier: Tier | null; onClose: () => void }) {
  const [, theme] = useStyletron();
  const members: Customer[] = tier ? cast.customers.filter((c) => bandOf(cast, c) === tier.id) : [];
  return (
    <OverlayCard isOpen={tier !== null} onClose={onClose} scrim={SCRIM.dim} size={480} ariaLabel="Who is on this tarifa">
      {tier ? (
        <div data-testid="tier-members" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <div>
            <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{tier.name}</h2>
            <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {members.length} {members.length === 1 ? 'customer buys' : 'customers buy'} on this tarifa. Their band
              lives on their own profile.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '52vh', overflowY: 'auto', minWidth: 0 }}>
            {members.slice(0, 60).map((c, i) => (
              <span
                key={c.id}
                data-testid={`tier-member-${c.id}`}
                style={{
                  ...theme.typography.LabelSmall,
                  padding: `${theme.sizing.scale500} 0`,
                  borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                  minWidth: 0,
                }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <span />
      )}
    </OverlayCard>
  );
}

/* ── ONE PRODUCT'S TARIFAS ────────────────────────────────────────────────────────────────────
 * The card is the product: its face, its name, its unit — and under it one row per band. In
 * percentage mode the same rows grow ONE column, which is the relationship, and the arrow takes
 * the gutter. That is the whole difference between the two states: a column and a gutter.
 */

export type Draft = {
  product: string;
  rel: Relationship;
  /** the anchor's own price — the only number a hand types in this mode */
  anchorPrice: number;
  /** Keep incomplete input in this unsaved calculator, never in the price log. */
  anchorText?: string;
};

export type ProductTarifasProps = {
  /** the house whose bands these are */
  cast: Cast;
  /** the goods the card is about — its face, its name and its unit come off this */
  product: Product;
  /** a newly authored variation starts at its family's standing price until somebody writes the
   * member's own number; writes and history still belong to `product` alone. */
  priceParent?: Product;
  /** the bands the house sells at, in the order they are drawn */
  tiers: Tier[];
  /** the day the sheet is being read at */
  day: string;
  /** the hour a price written now is stamped with */
  hour: string;
  /** the open percentage-mode relationship, where this card is the one holding it */
  draft: Draft | null;
  /** open, move or leave percentage mode. Null closes it and keeps what was saved. */
  onDraft: (d: Draft | null) => void;
  /** Opens the real price-entry sheet focused on this tarifa. */
  onOpenTariff?: (tierId: string) => void;
  /** Opens the history/statistics reading for this tarifa only. */
  onStatsTariff?: (tierId: string) => void;
  /**
   * WHICH HOUSING IT IS STANDING IN (FEED-IA §37.5, §38).
   *
   * `card` — the kit's own tile: its border, its face, its name. It is a specimen of the control.
   * `sheet` — the block ON the product's sheet, where the pane has already said which product this
   *   is and drawn the painting the size of a portrait. So the face and the name come off, the
   *   border comes off (a pane holds no boxes), and the figures take the sheet's own big step.
   */
  frame?: 'card' | 'sheet';
};

export function ProductTarifas({
  cast,
  product,
  priceParent,
  tiers,
  day,
  hour,
  draft,
  onDraft,
  onOpenTariff,
  onStatsTariff,
  frame = 'card',
}: ProductTarifasProps) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { country } = useWorkspaceCapabilities(cast.sector);
  const priceButtons = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const unit = priceUnitOf(product);
  /* Unset members have no commercial price. Zero is only an internal draft seed; the visible
     cell says Set price until this SKU receives a stamp. Family context is never copied here. */
  const sheet = Object.fromEntries(tiers.map((tier) => [
    tier.id,
    writtenOn(product, tier.id, day) ?? (priceParent ? 0 : priceOn(cast, product, tier.id, day)),
  ]));
  const chained = chainOf(cast, product, day);
  const mine = draft && draft.product === product.id ? draft : null;
  const saved = relationshipOf(product);
  const validAnchor = !mine || (Number.isFinite(mine.anchorPrice) && mine.anchorPrice > 0);
  const shown = mine ? pricesFrom(mine.rel, tiers, validAnchor ? mine.anchorPrice : 0) : sheet;
  const last = lastSetOf(product);
  /* the count of what a hand has written here — the CARD's own line says it, because the card has
     no dock under it. On the sheet the dock's History door carries the count instead (C24/C37). */
  const history = priceHistoryOf(product);

  /* THE ARROW IS DRAGGED AS WELL AS TAPPED. A pointer that went down on it and came up over
     another band re-anchors, which is the same act the tap performs — one meaning, two hands. */
  const dragging = React.useRef(false);

  const reanchorTo = (tierId: string) => {
    if (!mine || !validAnchor || tierId === mine.rel.anchor || shown[tierId] <= 0) return;
    const prices = pricesFrom(mine.rel, tiers, mine.anchorPrice);
    const rel = reanchor(tiers, prices, tierId);
    onDraft({ product: product.id, rel, anchorPrice: prices[tierId] });
  };

  const write = (tierId: string, next: number) => {
    if (mine) {
      onDraft({ ...mine, anchorPrice: next });
      return;
    }
    /* THE CHAIN, DOING ITS ONE JOB. Closed, one typed price writes every band together; open, it
       moves its own band and leaves the others exactly where they were. */
    const targets = chained ? tiers.map((t) => t.id) : [tierId];
    return setPrices(targets.map((id) => ({ product: product.id, tier: id, day, price: next, at: hour, author: 'hand' as const }))).length > 0;
  };

  const onSheet = frame === 'sheet';
  /* ONE TARIFA MEANS THE WORD DISAPPEARS. On the sheet a single-band house sees today's price and
     nothing else: no band name to read, no chain, no percentage. The vocabulary is ABSENT rather
     than disabled, and it arrives the moment the house writes a second band. */
  const single = onSheet && tiers.length === 1;

  return (
    <div
      data-testid={`product-tiers-${product.id}`}
      data-mode={mine ? 'percentage' : chained ? 'chained' : 'own'}
      data-frame={frame}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale500,
        /* §38: A PANE HOLDS NO BOXES. On the sheet the block is the sheet's own column — no border,
           no ground of its own, no padding fighting the pane's. */
        padding: onSheet ? 0 : `${theme.sizing.scale600} ${theme.sizing.scale600}`,
        border: onSheet ? undefined : `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: onSheet ? undefined : theme.borders.radius300,
        background: onSheet ? undefined : theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {/* §101.2 · THE PRODUCT'S OWN SHORTAGE READS HERE, and nowhere else on this block: the
          door draws only where an issue stands against these goods, so a product with nothing
          wrong with it carries no seat for it. */}
      <SupplyDoor cast={cast} products={[product.id]} testid={`supply-door-${product.id}`} />
      {/* THE HEAD: what this is, and the two quiet controls that decide how its bands move.
          On the sheet the painting and the name are already the head of the pane, so what is left
          is the two controls.

          WHERE TODAY'S NUMBER CAME FROM IS SAID ONCE (AUDIT-2 C37 · §59.4 · §58.2). This line read
          «On your own margin» and the dock 500px below read «On your own margin · Today · 3
          tarifas» — one fact, two tokens, on one sheet. The dock's line is the fuller sentence and
          it is §76's own typed one, so it keeps the fact; the card frame keeps this line, because
          a card has no dock under it. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
        {!onSheet && <Face product={product} />}
        <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
          {!onSheet && (
            <>
              <span style={{ ...theme.typography.LabelMedium }}>{product.name}</span>
              <span
                data-testid={`price-source-${product.id}`}
                style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
              >
                {sourceWords(last)}
                {history.length > 0 && ` · ${history.length} ${history.length === 1 ? 'change' : 'changes'}`}
              </span>
            </>
          )}
        </span>
        {!single && (
          <>
            {!onSheet && <Button
              kind={chained ? KIND.secondary : KIND.tertiary}
              size={SIZE.compact}
              shape={SHAPE.pill}
              data-testid={`chain-${product.id}`}
              data-on={chained ? 'yes' : 'no'}
              aria-pressed={chained}
              aria-label={chained ? 'Use separate prices for each tariff' : 'Apply the next saved price to every tariff'}
              disabled={!!mine}
              onClick={() => setChain(product, !chained)}
              startEnhancer={<Chain closed={chained} />}
            >
              {chained ? 'Same price for all: on' : 'Same price for all: off'}
            </Button>}
            {/* ── ENTERING THE MODE IS AN ACT, NOT A TOGGLE (FEED-IA §51.13) ────────────────
                «The percentage mode must not be a casual icon click — it is a COMMITTED state
                change; make entering it deliberate.»
                So the bare icon is dead as the entry. What stands here is a LABELLED control that
                says the state it is about to put the product into, and pressing it does not
                quietly change a number: it opens a state that CANNOT be left except by confirming
                it (Save, which stamps every band) or cancelling it (which restores exactly what
                was there). §30's own rule already said this — «words survive where the act is rare
                or consequential» — and restructuring a product's whole sheet is both.
                It is also ONE-WAY. A toggle that both enters and leaves a committed state is the
                casualness the founder is naming: leaving happens through the mode's own two acts,
                where the consequence is stated. */}
            {!mine && (
              <Button
                kind={KIND.tertiary}
                size={SIZE.compact}
                shape={SHAPE.pill}
                data-testid={`pct-${product.id}`}
                data-on={saved ? 'yes' : 'no'}
                /* NO MARK ON THE ENTRY (§30, §51.19). The words already end in «%», and a percent
                   glyph in front of them is the same symbol twice on one control. The mark belongs
                   on the STATE, where it is the state's own badge and says something the words
                   beside it do not. */
                onClick={() => {
                  const rel = saved && tiers.some((tier) => tier.id === saved.anchor)
                    && Object.values(saved.offsets).every((offset) => Number.isFinite(offset) && offset > -100)
                    ? saved : seedRelationship(tiers);
                  onDraft({ product: product.id, rel, anchorPrice: sheet[rel.anchor] ?? sheet[tiers[0].id] });
                }}
              >
                Set by percentage
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── THE STATE SAYS ITSELF IN THE FOOTER, AND NOWHERE ELSE (AUDIT-2 C1 · §59.1 · §51.13) ─
          There was a band HERE — «Set by percentage» beside a sentence explaining the anchor — and
          it was three defects in one row. It STACKED A NEW ROW on the act (§59.1's exact ban), it
          shoved the three tarifa rows 70px down the pane, and its sentence was helper slop of the
          kind §51.7 bans app-wide («The anchor holds the only price a hand writes…»). §51.13 asks
          that the committed state be legible as one, and it now is where its exits are: the pane's
          one sticky footer names the mode and carries Save and Cancel (`TarifaModeActs`). What
          changes HERE on entering is only what the relationship itself changes — the anchor's
          gutter, the offsets column, and grey against ink — and none of it moves a row. */}

      {!single && (mine || chained) && (
        <p data-testid={`price-method-${product.id}`} style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {mine
            ? 'Preview: percentages are relative to the base tariff.'
            : chained
              ? `Saving a price updates all ${tiers.length} tariffs.`
              : ''}
        </p>
      )}
      <PriceSaveNotice />
      {/* THE BANDS. One row each, roomy, and in percentage mode one more column. */}
      <div style={{ display: onSheet ? 'grid' : 'flex', gridTemplateColumns: onSheet ? (phone || tiers.length === 1 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))') : undefined, flexDirection: onSheet ? undefined : 'column', gap: onSheet ? theme.sizing.scale400 : undefined, minWidth: 0 }}>
        {tiers.map((t, i) => {
          const anchored = mine?.rel.anchor === t.id;
          const ink = !mine || anchored;
          const tierHistory = priceHistoryOf(product, t.id);
          const effectiveState = mine
            ? anchored ? 'Base tariff · preview' : 'Calculated preview'
            : priceParent && writtenOn(product, t.id, day) === null
              ? `From ${priceParent.name}`
              : tierHistory.length
                ? `Effective · ${tierHistory.length} ${tierHistory.length === 1 ? 'change' : 'changes'}`
                : 'Effective today';
          return (
            <div
              key={t.id}
              data-testid={`tier-price-row-${product.id}-${t.id}`}
              data-product-price-card={onSheet ? 'true' : undefined}
              data-anchor={anchored ? 'yes' : 'no'}
              onPointerUp={() => {
                if (dragging.current) {
                  dragging.current = false;
                  reanchorTo(t.id);
                }
              }}
              style={{
                display: mine || onSheet ? 'grid' : 'flex',
                gridTemplateColumns: onSheet ? (mine ? '32px minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto') : mine ? '32px minmax(0, 1fr) auto' : undefined,
                alignItems: 'center',
                gap: theme.sizing.scale300,
                /* ONE RHYTHM WITH THE REST OF THE PAGE (FEED-IA §33 — the air pass). A band is ONE
                   fact — a name and a number — and it was standing taller than a river row that
                   carries a face, a customer, three facts and a figure. Roomy is the goods' card;
                   the rows inside it read as a set, and a set is read by its rhythm. 48 is Base's
                   own touch target, which is the floor a row like this may not go under.
                   ON THE SHEET the band is the subject rather than a line of a table (§37.5:
                   «today's price per tier BIG»), so the row takes the taller step. */
                minHeight: onSheet ? 132 : 48,
                padding: onSheet ? theme.sizing.scale500 : `${theme.sizing.scale300} 0`,
                border: onSheet ? `1px solid ${theme.colors.borderOpaque}` : undefined,
                borderTop: onSheet || i === 0 ? undefined : `1px solid ${theme.colors.borderOpaque}`,
                borderRadius: onSheet ? theme.borders.radius300 : undefined,
                background: onSheet ? theme.colors.backgroundPrimary : undefined,
                minWidth: 0,
              }}
            >
              {/* THE GUTTER — the arrow's own column, present only while a relationship is open */}
              {mine && (
                <button
                  type="button"
                  data-testid={`anchor-${product.id}-${t.id}`}
                  data-on={anchored ? 'yes' : 'no'}
                  aria-label={anchored ? `${t.name} is the base tariff` : `Use ${t.name} as the base tariff`}
                  title={anchored ? `${t.name} is the base tariff` : `Use ${t.name} as the base tariff`}
                  disabled={!validAnchor || shown[t.id] <= 0}
                  onPointerDown={() => {
                    if (anchored) dragging.current = true;
                  }}
                  onClick={() => reanchorTo(t.id)}
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: onSheet ? 44 : theme.sizing.scale900,
                    height: onSheet ? 44 : theme.sizing.scale900,
                    flex: '0 0 auto',
                    border: 'none',
                    background: 'transparent',
                    color: anchored ? theme.colors.contentPrimary : theme.colors.contentTertiary,
                    cursor: anchored ? 'grab' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <Arrow on={anchored} />
                </button>
              )}

              {!single && (
                <button
                  type="button"
                  data-testid={`open-tariff-${product.id}-${t.id}`}
                  disabled={!!mine || !onOpenTariff || (onSheet && !phone)}
                  onClick={() => { if (!mine && (!onSheet || phone)) onOpenTariff?.(t.id); }}
                  style={{
                    ...(onSheet ? theme.typography.LabelMedium : theme.typography.LabelSmall),
                    color: ink ? theme.colors.contentPrimary : theme.colors.contentSecondary,
                    gridColumn: onSheet ? (mine ? '2' : '1') : undefined,
                    gridRow: onSheet ? '1' : undefined,
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    border: 'none',
                    padding: 0,
                    background: 'transparent',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    minWidth: onSheet ? '44px' : 0,
                    minHeight: onSheet ? '44px' : 0,
                    cursor: 'default',
                  }}
                >
                  {t.name}
                </button>
              )}

              {/* THE RELATIONSHIP COLUMN — one column, with air on both sides of it */}
              {mine && (
                <span
                  data-testid={`offset-${product.id}-${t.id}`}
                  data-offset={anchored ? 0 : mine.rel.offsets[t.id] ?? 0}
                  style={{
                    ...theme.typography.LabelSmall,
                    color: theme.colors.contentTertiary,
                    gridColumn: onSheet ? '3' : undefined,
                    gridRow: onSheet ? '1' : undefined,
                    minWidth: 72,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    flex: '0 0 auto',
                  }}
                >
                  {anchored ? 'Base tariff' : offsetWords(mine.rel.offsets[t.id] ?? 0)}
                </span>
              )}

              <span style={{ gridColumn: onSheet ? (mine ? '2' : '1') : mine ? '2' : undefined, gridRow: onSheet ? (single ? '1' : '2') : undefined, minWidth: onSheet ? 132 : 104, display: 'flex', justifyContent: onSheet || single ? 'flex-start' : 'flex-end', flex: single ? '1 1 auto' : '0 0 auto' }}>
                {mine && anchored ? (
                  <Input
                    size={INPUT_SIZE.compact}
                    value={mine.anchorText ?? priceEditorAmount(mine.anchorPrice, country).toLocaleString(LOCALE, { maximumFractionDigits: 2 })}
                    onChange={(event) => {
                      const anchorText = (event.target as HTMLInputElement).value;
                      onDraft({ ...mine, anchorText, anchorPrice: canonicalPriceEditorAmount(Number(anchorText.replace(',', '.')), country) });
                    }}
                    error={!validAnchor}
                    aria-label={`Base price for ${t.name}`}
                    endEnhancer={priceEditorUnit(unit, country)}
                    overrides={{ Root: { style: { width: onSheet ? '132px' : '120px' } }, Input: { props: { 'data-testid': `price-${product.id}-${t.id}-input`, inputMode: 'decimal' } } }}
                  />
                ) : <PriceCell
                  value={shown[t.id] ?? 0}
                  unset={!!priceParent && !mine && writtenOn(product, t.id, day) === null}
                  unit={unit}
                  ink={ink}
                  editable={!mine || anchored}
                  size={onSheet ? 'large' : 'compact'}
                  testid={`price-${product.id}-${t.id}`}
                  onOpenSheet={!mine && phone && onOpenTariff ? () => onOpenTariff(t.id) : undefined}
                  buttonRef={(button) => { priceButtons.current[t.id] = button; }}
                  onAdvance={!mine && !chained && tiers[i + 1] ? () => priceButtons.current[tiers[i + 1].id]?.click() : undefined}
                  onCommit={(next) => write(t.id, next)}
                  country={country}
                />}
              </span>
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                shape={SHAPE.pill}
                data-testid={`tariff-stats-${product.id}-${t.id}`}
                aria-label={`Price history for ${t.name} · ${product.name}`}
                onClick={() => onStatsTariff?.(t.id)}
                overrides={onSheet ? { BaseButton: { style: { gridColumn: mine ? '3' : '2', gridRow: mine ? '2' : '1', justifySelf: 'end', minHeight: '44px' } } } : undefined}
              >
                <Glyph id="chart" size={16} />{onSheet && <span style={{ marginLeft: theme.sizing.scale100 }}>History</span>}
              </Button>
              {onSheet && <span data-testid={`tariff-effective-${product.id}-${t.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, gridColumn: mine ? '2 / -1' : '1 / -1', gridRow: single ? '2' : '3', overflowWrap: 'anywhere' }}>{effectiveState}</span>}
            </div>
          );
        })}
      </div>

      {/* THE MODE'S OWN CONFIRM AND CANCEL, IN THE ONE HOUSING THAT HAS NO FOOTER (AUDIT-2 C1).
          On the SHEET these two stand in the price dock, which is the pane's one sticky footer —
          see `TarifaModeActs` below. The kit's card has no dock under it, so the card frame keeps
          them at its own foot, where nothing can cover them. */}
      {mine && !onSheet && (
        <TarifaModeActs product={product} tiers={tiers} draft={mine} onDraft={onDraft} day={day} hour={hour} />
      )}
    </div>
  );
}

/* ── THE PERCENTAGE STATE'S FOOTER (AUDIT-2 C1 · FEED-IA §59.1 · §51.13) ──────────────────────
 * The mode named, and the only two acts that end it. It is a SEPARATE export because on the
 * product's sheet it stands inside the price dock (`product-card.tsx`) rather than in the scrolling
 * column: a pane gets ONE sticky footer, and two of them at one y is how Save and Cancel came to
 * be unclickable at 1600×1000. Save is the one deliberate exception to immersion editing — it
 * restructures several bands at once, so it is asked for out loud — and Cancel restores exactly
 * what was there. They stay the ONLY two ways out, which is what makes the state committed rather
 * than a toggle.
 */
export function TarifaModeActs({
  product,
  tiers,
  draft,
  onDraft,
  day,
  hour,
}: {
  product: Product;
  tiers: Tier[];
  /** the open relationship — this component is drawn only while one is held */
  draft: Draft;
  onDraft: (d: Draft | null) => void;
  day: string;
  hour: string;
}) {
  const [, theme] = useStyletron();
  const prices = pricesFrom(draft.rel, tiers, draft.anchorPrice);
  const valid = Number.isFinite(draft.anchorPrice) && draft.anchorPrice > 0
    && Object.values(prices).every((price) => Number.isFinite(price) && price > 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
      <p data-testid={`pct-effect-${product.id}`} style={{ margin: 0, flexBasis: '100%', ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        Price = base tariff × (1 + difference ÷ 100). Apply saves these {tiers.length} prices for {dayShort(day)}. After applying, edits are separate; this calculator does not keep an automatic link.
      </p>
      {!valid && <p role="alert" style={{ margin: 0, flexBasis: '100%', ...theme.typography.ParagraphXSmall }}>Enter a base price greater than zero.</p>}
      {/* THE STATE, NAMED WHERE ITS EXITS ARE (§51.13). The mark belongs on the STATE — the entry
          control's own words already end in «%», so it carries none. */}
      <span
        data-testid={`pct-state-${product.id}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.sizing.scale300,
          ...theme.typography.LabelSmall,
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <Percent />
        Set by percentage
      </span>
      <Button
        kind={KIND.primary}
        size={SIZE.compact}
        data-testid={`tiers-save-${product.id}`}
        disabled={!valid}
        onClick={() => {
          if (valid && saveRelationship(product, draft.rel, prices, day, hour)) onDraft(null);
        }}
      >
        Apply to {tiers.length} tariffs
      </Button>
      <Button
        kind={KIND.tertiary}
        size={SIZE.compact}
        data-testid={`tiers-back-${product.id}`}
        onClick={() => onDraft(null)}
      >
        Cancel
      </Button>
    </div>
  );
}

/* ── THE HOUSE-LEVEL TARIFAS, AS A SETTING (FEED-IA §75.4 · THE-OBJECT-MAP C3) ─────────────────
 * «Maybe tariffs are a setting yeah — let them enable that they have tariffs for all, super easily
 * tweak them even on their phone, and set a global single tariff.»
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ ONE ADMIN ROW, in Operations ───────────────────────────────────────────────────────────┐
 *   │ [price]  Tarifas                              3 bands · 41 customers                  ›  │
 *   │          What each band pays for the same goods.                                         │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *                                        │ press
 *   ┌─ THE DRILL-IN (an OverlayCard) ─────▼────────────────────────────────────────────────────┐
 *   │ HEADING   Tarifas                                                                        │
 *   │ REGISTRY  one row per band: the name (typed over) · N customers (the count is the door)   │
 *   │           on a single-tarifa house the one row names it and says who is on it             │
 *   │ ACT       «Add tariff»                                                                  │
 *   │ MEMBERS   the count's overlay, names in the house's own order                             │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS  HeadingXSmall (the card) · LabelMedium (a band's name) · ParagraphXSmall (its line)
 *   STATES      the name is editable in place (§51.14); the count opens; adding appends a band
 *
 * WHY A SETTING AND NOT A SEAT. A register is browsed, a feed is read in time order, a RATE CARD
 * is edited — rarely, and by one person. Three bands with their names and their sizes is four
 * facts; four facts do not take a seat beside a three-hundred-row catalogue. And phone-tweakable
 * comes for free, because the admin rows already are.
 */

/** WHAT THE SETTING'S ROW SAYS ON THE RIGHT. One string, read from the same registry the card
 *  draws, so the row and the card can never disagree about the house's own bands. */
export function tarifasValue(cast: Cast): string {
  const rows = registryOf(cast);
  const people = rows.reduce((n, t) => n + t.customers, 0);
  const bands = `${rows.length} ${rows.length === 1 ? 'band' : 'bands'}`;
  return `${bands} · ${people} ${people === 1 ? 'customer' : 'customers'}`;
}

/** WHAT THE SETTING'S ROW IS CALLED. A house with bands has «Tarifas»; a house with one names the
 *  tarifa it has, because that is the thing the row is about (§75.4's global single tariff). */
export const tarifasLabel = (cast: Cast): string => {
  const rows = tiersOfHouse(cast);
  return rows.length > 1 ? 'Tarifas' : rows[0].name;
};

export function TarifasCard({ cast: given }: { cast?: Cast } = {}) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = given ?? derived.cast;
  /* the store is read through its hook so a band added or renamed here re-renders the row behind
     the card, the product sheets, and the customers' own tarifa names in one pass */
  useTiers();
  const tiers = tiersOfHouse(cast);
  const [members, setMembers] = React.useState<Tier | null>(null);

  return (
    <section
      data-testid="tiers-section"
      data-tiers={tiers.length}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
    >
      <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Tariffs</h2>

      <PriceSaveNotice />
      <Registry cast={cast} onMembers={setMembers} />

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <Button kind={KIND.secondary} size={SIZE.compact} shape={SHAPE.pill} onClick={() => addTier(cast)} data-testid="tiers-add">
          Add tariff
        </Button>
      </div>

      {/* WHERE A PRICE IS WRITTEN, said once, at the foot. The bands are named here; the numbers
          belong to the goods, and the row that carries them is the product's own sheet. */}
      <p
        data-testid="tiers-foot"
        style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}
      >
        Prices are written in Stock, on the product card.
      </p>

      <Members cast={cast} tier={members} onClose={() => setMembers(null)} />
    </section>
  );
}

/* ═══ §76 · PRICE ENTRY — MONZO CONFIDENCE × LINEAR SPEED ═════════════════════════════════════
 *
 * «Make changing 80 prices feel like triaging notifications, not editing 80 database records.»
 *
 * ═══ WHAT THE SPEC BANS, AND WHAT STANDS INSTEAD ════════════════════════════════════════════
 * «Instead of Price: [] · Effective Date: [] · Tariff: [dropdown]» — three database fields in a
 * row, each of them asking the person to look up what it wants. THE NUMBER IS THE THING:
 *
 *      €18,40
 *      Previous €17,80 · Today · 3 tarifas
 *
 * The figure has visual priority and everything else sits UNDER it as context rather than beside
 * it as a competing field. The date is not asked for — it is today, and the line says so. The
 * tarifa is not a dropdown — it is a segmented row of chips, and it only exists at all where the
 * house has bands (progressive disclosure BY DATA, the same rule the whole of this file keeps).
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ THE SHEET · docked to the bottom edge at 390, centred on a desk ────────────────────────┐
 *   │ ▭ the drag handle — a phone dismisses this by dragging it down                            │
 *   │ [face] Merluza · sin cabeza                                        3 of 12                │
 *   │ ( Tarifa 1 )( Tarifa 2 )( Tarifa 3 )        ← only where the house has bands              │
 *   │ ┌──────────────────────────────────────────────┐                                          │
 *   │ │  18,40                                €/kg   │  ← THE NUMBER, big, and it is the field  │
 *   │ └──────────────────────────────────────────────┘                                          │
 *   │ Previous €17,80 · Today · 3 tarifas                                                       │
 *   │ ─────────────────────────────────────────────────────────────────────────────────────────│
 *   │ [ Save & next ]  [ Done ]      ← the primary reads «Next» while nothing is typed           │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS  LabelMedium (the name) · the input at the display step · ParagraphXSmall (context)
 *   STATES      empty (nothing typed yet, the standing price is the placeholder — the primary
 *               reads «Next» and passes) · typed («Save & next») · saved (the toast stands with
 *               Undo, and the sheet has moved to the next one) · last (there is no next, so the
 *               act is «Save», and it waits for its number with «Done» live beside it) · GIVEN
 *               (a pasted list or a dictated take put the number there, and the context line says
 *               which) · CLASH (another hand wrote this band since the sheet opened on it; the
 *               two numbers stand side by side and the acts row becomes the two verbs that answer
 *               it) · CLOSING (the round's own reading — every price it wrote, each with the one
 *               it replaced, and the act that closes it)
 *
 * ═══ THE FOUR VERBS §16 NAMES, AND WHERE EACH ONE LIVES ═════════════════════════════════════
 * «Daily price entry needs far better UX than a giant ERP matrix: paste; type; dictate; bulk
 * update; resolve conflicts; publish.» PASTE is the catalogue's own door (`areas/stock.tsx`) and
 * it hands this sheet a run whose targets already carry their rates. TYPE is the field. DICTATE
 * is the app's voice control in this sheet's head, its take read by the paste's own parse. BULK
 * UPDATE is what the two of them become at queue scale — eighty targets, Save & next, one rhythm.
 * RESOLVE CONFLICTS and PUBLISH are the two states above. Nothing here is a second implementation
 * of anything: one parse, one log, one Undo (§27.5).
 *
 * ═══ SAVE & NEXT IS THE WHOLE POINT ════════════════════════════════════════════════════════
 * «The real job is usually repetitive. You want a user to enter 40–80 changes almost
 * rhythmically.» So the primary act writes AND advances, the field re-focuses and selects itself
 * on the way in, and the sheet never closes between two products. The person's thumb stays in one
 * place and the goods move underneath it.
 *
 * ═══ A RUN THAT CANNOT PASS A PRICE IS NOT A RUN (AUDIT-2 C10 · §76) ════════════════════════
 * «Triaging notifications» is mostly LEAVING THINGS ALONE, and the run used to stall on the first
 * correct price: at «1 of 10» the primary stood `disabled` with nothing typed, no Skip and no
 * Next, and the only live control was «Done», which ends the run. So while the queue is running
 * the primary is never disabled — its LABEL is its state (§59.1: an act transforms its own
 * control, in place), and with nothing typed it reads «Next» and passes without writing. On the
 * LAST one there is no next to offer, so it keeps the name of the act it is waiting on and «Done»
 * stands live beside it. That is not the stall: the stall was nine goods deep in a queue.
 *
 * ═══ AND IT IS REVERSIBLE, OUT LOUD (§76: «immediate feedback after saving, ideally with Undo») ═
 * Every save enqueues the kit's own Snackbar naming what was written, with UNDO on it. Undo drops
 * the stamp rather than writing a second one — the reasoning is on `dropStamps` in `tiers.ts`.
 *
 * THE TOAST HAS TO BE ON THE SCREEN, WHICH TOOK TWO FIXES (AUDIT-2 C10). Measured at 390: the
 * Undo node sat at (−20000, −20000) — Base's SnackbarProvider always renders a hidden copy there
 * to measure, and a probe that finds a button by its words finds THAT one. The visible copy did
 * render, at (277, 784), and painted NOTHING: it mounts in a `Layer` with no z-index of its own,
 * under a price sheet whose layer stands at 8. So the placement container is lifted above the
 * sheet, and on a phone it stands at the TOP — a bottom toast lands exactly on «Save & next»,
 * which is the one control the rhythm keeps pressing.
 */

/** ONE THING TO PRICE. The list hands these over in the order it draws them, so the run and the
 *  eye agree about what «next» means. */
export type PriceTarget = {
  /** the row's own key in the list it came from */
  key: string;
  /** the family's name, or the family's name with the member's word under it */
  name: string;
  /** what this member adds to its family's name, where the target is a member */
  word?: string;
  product: Product;
  /** A sellable variation reads its family’s standing price until it has its own stamp. */
  priceParent?: Product;
  /** A RATE THAT ARRIVED WITH IT (§16.5). A pasted list hands its number over here; the sheet
   *  lands with the field already carrying it, attributed, and a hand may type over it. */
  given?: number;
  /** nobody has written this band's price for today (§16.12) — the reason it leads the run */
  waiting?: boolean;
};

/** HOW FAR A THUMB HAS TO DRAG BEFORE THE SHEET GOES. Short enough to feel like a flick, long
 *  enough that a scroll inside the card never throws it away. */
const DISMISS_PX = 72;

/**
 * ONE ARRIVAL, AS A HOOK — the mechanism behind beats 1 and 3.
 *
 * False for the single frame after `key` changes and true from the next, so a style can travel
 * from its origin to its rest with a plain transition: no keyframes, no library, no remount, and
 * nothing moving once it has landed. `still` lands the rest state immediately, which is what a
 * person who asked for less motion should get — the state, not the travel.
 *
 * TWO OF THEM RUN ON THIS SHEET AND THEY MEAN DIFFERENT THINGS: the PRODUCT arriving (a new thing
 * is being priced) and the BAND arriving (the same thing, the next tarifa). Keeping them apart is
 * the whole of §115.2's reading — the subject must hold still while the tarifa moves under it.
 */
function useArrival(key: string | number, on: boolean, still: boolean): boolean {
  const [landed, setLanded] = React.useState(true);
  React.useEffect(() => {
    if (!on || still) {
      setLanded(true);
      return;
    }
    setLanded(false);
    const frame = window.requestAnimationFrame(() => setLanded(true));
    return () => window.cancelAnimationFrame(frame);
  }, [key, on, still]);
  return landed;
}

/** WHAT THE SHEET'S NUMBER CAME IN AS. The three doors §16 names, and the line under the field
 *  says which one — the same attribution grammar the stock panel already uses for a document's
 *  proposal («From the document» · «Set by hand»), so a person meets one idea in two places. */
type Given = 'hand' | 'list' | 'take';

export type PriceEntryProps = {
  cast: Cast;
  /** the products a caller handed over, in the list's own order. §115.2: this is WHERE THE SHEET
   *  LANDS, never a queue it walks — the walk is `at`'s product's own tarifas. */
  targets: PriceTarget[];
  /** which of them the sheet is standing on — the product picked ad hoc */
  at: number;
  isOpen: boolean;
  phone: boolean;
  day: string;
  hour: string;
  /**
   * ⚠ §115.2 KILLED THE PRODUCT WALK FOR THE HAND'S OWN RUN. «They wouldn't be doing Save and Next
   * for individual products… they only follow it linearly for the tariffs.» A run the person is
   * typing prices into never calls this: the sheet writes ONE product across its bands and then
   * closes, and the person picks the next product off the catalogue.
   *
   * IT SURVIVES FOR §16.5's PASTE, which is the other act — a list whose rates are already known,
   * arriving attached to their products, where the walk IS the confirmation. That run still steps
   * product by product, and the sheet tells the two apart by whether the targets carry `given`.
   *
   * THE SEAM: `areas/stock.tsx` (held) still opens the hand's run as a QUEUE of everything that
   * needs a price, and the sheet now spends only its head. When that file is next opened, its
   * «Update prices» bar should become a PICKER — search or tap a product — and hand this sheet one
   * `PriceTarget`, keeping `targets`/`at`/`onAt` for the pasted run alone.
   */
  onAt: (next: number) => void;
  onClose: () => void;
  /** A tariff row can name the band this real entry sheet opens on. */
  initialTier?: string;
  /** §16.7 · DICTATE. What a kept take set down, in the words the person said. The parse is the
   *  paste's own (`parsePasted`), so a take saying «merluza catorce con ochenta y dos» and a
   *  pasted line saying «Merluza 14,82» reach the field through ONE reading.
   *
   *  THE EAR IS THE BACKEND'S, and this prop is the seam — exactly the standing `chip-parse.ts`
   *  gives its own model layer. A host that has no transcription hands nothing and the control
   *  stays off the sheet, because a mic that cannot set anything down is a button that lies. */
  dictate?: (a: { target: PriceTarget; take: Take }) => string | undefined;
};

export function PriceEntry(props: PriceEntryProps) {
  /* THE SNACKBAR NEEDS AN ANCESTOR, AND THE SHEET IS NOT IT. `useSnackbar` reads a context, so the
     provider has to stand OUTSIDE the component that enqueues — and outside the card, which
     unmounts on the last save while the toast it just raised has three seconds left to stand. */
  return (
    <SnackbarProvider
      /* WHERE THE TOAST STANDS (AUDIT-2 C10). A phone's sheet is docked to the bottom edge and its
         «Save & next» sits in the last 90px of the screen, so a bottom toast covers the control the
         rhythm keeps pressing. It takes the top there, and the bottom on a desk, where the sheet is
         centred and the foot of the window is empty. */
      placement={props.phone ? SNACK_PLACEMENT.top : SNACK_PLACEMENT.bottom}
      overrides={{
        /* ABOVE THE SHEET IT IS THE FEEDBACK FOR (AUDIT-2 C10). Base mounts the toast in a `Layer`
           with no z-index of its own; the price sheet's layer stands at 8 (`overlay-card`'s own
           rule, so an overlay clears the app's bottom navigation at 6). One step above that is the
           whole fix — the toast was rendering all along, at a real coordinate, under the card. */
        PlacementContainer: { style: { zIndex: 9 } },
      }}
    >
      <PriceEntryBody {...props} />
    </SnackbarProvider>
  );
}

function PriceEntryBody({
  cast,
  targets,
  at,
  isOpen,
  phone,
  day,
  hour,
  onAt,
  onClose,
  initialTier,
  dictate,
}: PriceEntryProps) {
  const [, theme] = useStyletron();
  const { enqueue } = useSnackbar();
  const { country } = useWorkspaceCapabilities(cast.sector);
  useTiers();
  const tiers = tiersOfHouse(cast);
  const many = tiers.length > 1;

  const target = targets[at] ?? null;
  const together = !!target && many && chainOf(cast, target.product, day);
  const openingBand = initialTier && tiers.some((tier) => tier.id === initialTier) ? initialTier : tiers[0].id;
  const [band, setBand] = React.useState(openingBand);
  const [draft, setDraft] = React.useState('');
  const [leaving, setLeaving] = React.useState(false);
  const [pendingMove, setPendingMove] = React.useState<{ at: number; band: string } | null>(null);
  const [statAt, setStatAt] = React.useState(0);
  /* WHERE THIS NUMBER CAME FROM. A pasted list and a dictated take both put a figure in the field,
     and the line under it says so — the number stays a hand's the moment the hand types. */
  const [given, setGiven] = React.useState<Given>('hand');
  /* A TAKE NEEDS THE ROW (§13). True from the moment a take starts until the control is back to
     one idle button, so the head hands its line over for exactly that long. */
  const [takeBusy, setTakeBusy] = React.useState(false);
  /* the sheet is dragged down to dismiss it; the offset is the card's own, never the layer's */
  const [pull, setPull] = React.useState(0);
  const grab = React.useRef<number | null>(null);
  const swipe = React.useRef<{ x: number; y: number } | null>(null);
  const field = React.useRef<HTMLInputElement>(null);

  /* ── WHAT THE RUN HAS DONE (§16 «publish» · §16.9) ────────────────────────────────────────
     Two facts, and they are the whole of the run's memory. `written` is every stamp this run
     appended, in order — the material the closing reading is folded from, and the set the
     conflict check has to ignore, because a price I just wrote is not somebody else writing.
     `openedOn` is the stamp each target STOOD ON when the sheet arrived at it: if the newest is
     no longer that one, another hand has been here since (`writtenSince` in tiers.ts). */
  const [written, setWritten] = React.useState<string[]>([]);
  const [openedOn, setOpenedOn] = React.useState<Record<string, string | null>>({});
  /** the price this target stood at when the sheet arrived — the «yours» half of a conflict, so
   *  the choice is between two numbers on screen rather than one and a memory */
  const [opened, setOpened] = React.useState(0);
  /* the conflict the person has looked at and answered. Cleared on every arrival. */
  const [settled, setSettled] = React.useState<string[]>([]);
  /* THE CLOSING ACT (§51.13: entering a committed state is deliberate). The run's last press does
     not slam the sheet shut on forty changes — it opens the reading of what was written. */
  const [closing, setClosing] = React.useState(false);

  /* ── THE TWO ARRIVALS (§115.2's beats 1 and 3) ────────────────────────────────────────────
     «They click Save and Next, and then nothing happens.» The change on «next» is now the TARIFA
     changing, so the tarifa is what arrives: the chip's selection jumps, and the field and the
     standing price under it rise into place together. THE SUBJECT DOES NOT MOVE — it arrives once,
     when its product does, and then holds still for the whole run, because a face that flickers
     every time you save a band is the surface telling you the wrong thing changed.

     IT IS THE APP'S OWN MOTION, NOT AN EFFECT: theme timings and the shared `easeOutCurve`, the
     pair every other transition in the app is drawn with, and NOTHING MOVES AT REST. A person who
     asked for less motion gets each change as a straight cut; the read is once, at mount, because
     a media query that flipped mid-run would leave a half-travelled card. */
  const [still] = React.useState(
    () =>
      typeof window !== 'undefined'
      && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  /** BEAT 1 — a product arrives. Keyed on the sheet's own place, so it fires when the sheet opens
   *  and when a caller stands it on something else, and never on a save. */
  const subjectLanded = useArrival(at, isOpen, still);
  /** BEAT 3 — a tarifa arrives. Keyed on the band, which is what «Save & next» now advances. */
  const bandLanded = useArrival(band, isOpen, still);

  const ownStanding = target ? writtenOn(target.product, band, day) ?? (cast.products.some((p) => p.id === target.product.id) ? priceOn(cast, target.product, band, day) : null) : null;
  const suggestion = ownStanding === null && target?.priceParent && target.priceParent.unit === target.product.unit ? priceOn(cast, target.priceParent, band, day) : null;
  const standing = ownStanding ?? suggestion ?? 0;
  const unit = target ? priceUnitOf(target.product) : '';
  const editorUnit = priceEditorUnit(unit, country);
  const last = target ? lastSetOf(target.product, band) : null;
  const tierChanges = target ? priceHistoryOf(target.product, band).length : 0;
  const statWords = [
    standing > 0 ? `Last ${priceEditorAmount(standing, country).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${editorUnit}` : 'Price still to save',
    `${tierChanges} ${tierChanges === 1 ? 'change' : 'changes'}`,
    last ? `Updated ${dayShort(last.day)} · ${last.at}` : 'Catalogue price',
  ];

  /* EVERY ARRIVAL IS A FRESH FIELD, SELECTED. Landing on the next product with the previous
     product's digits still in the box is how a rhythm writes the wrong price twice.
     AND A RATE THAT CAME WITH THE TARGET IS ALREADY IN IT (§16.5). A pasted list is a run whose
     numbers are known: the field lands carrying them, attributed, and Save & next becomes a
     rhythm of confirming rather than of typing — which is what «bulk update» is at queue scale. */
  const arriving = targets[at] ?? null;
  React.useEffect(() => {
    if (!isOpen) return;
    setDraft(
      arriving?.given === undefined
        ? ''
        : arriving.given.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
    setGiven(arriving?.given === undefined ? 'hand' : 'list');
    setOpenedOn(Object.fromEntries(tiers.map((tier) => [tier.id, arriving ? lastSetOf(arriving.product, tier.id)?.id ?? null : null])));
    setOpened(standing);
    setSettled([]);
    setPull(0);
    const frame = window.requestAnimationFrame(() => field.current?.focus());
    return () => window.cancelAnimationFrame(frame);
    /* `targets` rather than `arriving`: the run is a SNAPSHOT taken when it opened (see the memo
       in `areas/stock.tsx`), so this array's identity is stable for the run's whole life and the
       arrival effect can never re-fire under a person's hand mid-rhythm. */
  }, [isOpen, at, band, targets]); // eslint-disable-line react-hooks/exhaustive-deps

  /* A RUN THAT ENDS FORGETS NOTHING IT SHOULD KEEP AND KEEPS NOTHING IT SHOULD FORGET. The written
     ids and the closing state belong to ONE opening of the sheet. */
  React.useEffect(() => {
    if (isOpen) return;
    setWritten([]);
    setClosing(false);
    setLeaving(false); setPendingMove(null);
  }, [isOpen]);

  /* a house that loses the band the sheet was standing on prices on the one it has */
  React.useEffect(() => {
    if (!tiers.some((t) => t.id === band)) setBand(tiers[0].id);
  }, [tiers, band]);

  /* ── BEAT 0 → BEAT 2 · A SHEET OPENS ON THE FIRST BAND (§115.2) ────────────────────────────
     The tarifas are the queue now, so the queue has to begin where a queue begins. Without this
     the sheet reopened on whatever band the last product's run ended on, and the person would
     have written tarifa 3 of the new product first — which is «why would they change just one
     tariff and not change the other» arriving by the back door.

     IT KEYS ON THE OPENING AND NOT ON `at`, deliberately: inside a pasted run (below) the person
     may have chosen which band the list is being confirmed against, and re-seating that on every
     product would silently move forty rates onto the wrong band. */
  React.useEffect(() => {
    if (!isOpen) return;
    setBand(openingBand);
    // Open on the tariff that was pressed. A fresh registry array or a saved price must never
    // reset the chosen band while the person is walking the other tariffs.
  }, [isOpen, openingBand]);

  if (!target) return null;

  const typed = Number(draft.replace(',', '.'));
  const ready = draft.trim().length > 0 && Number.isFinite(typed) && typed > 0;
  const canonicalTyped = canonicalPriceEditorAmount(typed, country);

  /* ── THE TWO RUNS THIS SHEET CAN BE, AND THE DIFFERENCE IS IN THE DATA ────────────────────
     §115.2 killed the LINEAR PRODUCT WALK for day-pricing: «what if they just want to change 10
     of the 200 products they have? They wouldn't be following this linear fashion. They only
     follow it linearly for the tariffs.»
     §16.5's PASTE is the other thing entirely: a list whose rates are ALREADY KNOWN, arriving
     attached to their products, where the walk IS the confirmation and «bulk update» is the whole
     feature. Making a person re-pick each of forty pasted products would delete it.

     So the run's shape is read off the run rather than off a mode: A PASTED RUN CARRIES ITS RATES
     (`PriceTarget.given`), and nothing else does. Paste walks products; a hand walks tarifas. */
  const pasted = targets.some((t) => t.given !== undefined);

  /* ── WHERE IN THE RUN (§115.2) ────────────────────────────────────────────────────────────
     «If it's 3/10, is that the tariff, or what?» On the hand's own run it is the tariff, and it is
     the only linear thing on the surface. A house with one band has no run at all: it is on its
     last band from the first frame, so the act asks for «Save» and never announces a next that
     does not exist. */
  const bandAt = Math.max(0, tiers.findIndex((t) => t.id === band));
  const lastBand = bandAt >= tiers.length - 1;
  const lastProduct = at >= targets.length - 1;
  /** A manual matrix advances tariff first, then product. A one-tariff house naturally becomes a
   * product walk; a linked product writes all tariffs and then advances as one cell. */
  const atEnd = pasted ? lastProduct : lastProduct && (together || lastBand);

  /* ── THE KEYWORD UNDER THE NAME (§111.3) ──────────────────────────────────────────────────
     «Why is it not like a centered thing with a keyword below?» The keyword is what tells one
     merluza from the next: the MEMBER'S OWN WORD where the target is a member of a family, and
     the SORT this house ships the goods as — §109.5's «name and sort», in the sheet's own seat.
     A sort that is only the product's own name back again says nothing, so it stands down and the
     line carries whatever is left. */
  const sort = sortOf(cast, target.product);
  const keyword = [
    target.word,
    sort && sort !== target.name && sort !== target.product.name ? sort : '',
  ]
    .filter(Boolean)
    .join(' · ');

  /* ── TWO HANDS ON ONE PRICE (§16.9) ───────────────────────────────────────────────────────
     A stamp that is newer than the one this sheet opened on, that this run did not write, and
     that the person has not already answered. It is a fact about a moment and a number, and
     while it stands the acts row IS the resolution: the run does not write a third price over
     two it never showed anybody. */
  const editTiers = together ? tiers.map((tier) => tier.id) : [band];
  const clashes = editTiers.flatMap((tierId) => {
    const newest = lastSetOf(target.product, tierId);
    if (!newest || newest.id === openedOn[tierId] || settled.includes(newest.id) || written.includes(newest.id)) return [];
    const changed = writtenSince(target.product, tierId, openedOn[tierId] ?? null);
    return changed ? [changed] : [];
  });
  const clash: PriceStamp | null = clashes[0] ?? null;

  const write = (): boolean => {
    if (!ready) return false;
    const ids = setPrices(editTiers.map((tier) => (
      { product: target.product.id, tier, day, price: canonicalTyped, at: hour, author: 'hand' as const }
    )));
    if (ids.length === 0) return false;
    if (isPostHogConfigured) {
      posthog.capture('price_saved', {
        price_count: ids.length,
        update_scope: together ? 'all_tariffs' : 'single_tariff',
        entry_method: given,
      });
    }
    setWritten((held) => [...held, ...ids]);
    enqueue(
      {
        message: `${target.name} · ${typed.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${editorUnit}${together ? ` · all ${tiers.length} tariffs` : ''}`,
        actionMessage: 'Undo',
        actionOnClick: () => {
          if (!dropStamps(ids)) return;
          setWritten((held) => held.filter((h) => !ids.includes(h)));
        },
      },
      SNACK_DURATION.short,
    );
    return true;
  };

  /* ── §16.7 · WHAT A TAKE SET DOWN, READ THE WAY A PASTE IS ────────────────────────────────
     One organ, two doors. The words go through `parsePasted` — the same reading a pasted list
     gets — and the first rate it finds fills the field, attributed to the take. A take the parse
     cannot answer leaves the field exactly as it was: nothing is invented from a bad hearing. */
  const heard = (take: Take) => {
    const words = dictate?.({ target, take });
    if (!words) return;
    const line = parsePasted(words)[0];
    if (!line) return;
    setDraft(line.price.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setGiven('take');
    field.current?.focus();
  };

  /* ── BEAT 4 · THE LANDING (§115.2 · §16 «publish» · §76's «strong review states») ──────────
     The run ends in a READING of itself: what this product now costs on every band it was written
     across, each with the number it replaced. It is deliberate (§51.13) — the last press opens it
     rather than dismissing the sheet — and it holds nothing back: every price in it went live to
     the tarifas at the moment it was saved, which is §76's own directive and why `dropStamps` is
     the way out of any of them. The act closes the product; it does not gate it. Publish returns
     the person to the catalogue, which is where the next product is picked.

     A ROUND IS MORE THAN ONE PRICE. One price is already answered by its own toast, with Undo on
     it, an inch from the caret — putting a review card in front of that would be friction on the
     app's highest-frequency single act (one band written on a one-tarifa house). So the reading is
     what a ROUND ends in, and a run that wrote nothing or wrote once leaves. */
  const finish = (savedOrDiscarded = false) => {
    if (!savedOrDiscarded && draft.trim()) { setPendingMove(null); setLeaving(true); return; }
    if (written.length > 1) setClosing(true);
    else onClose();
  };
  const applyMove = (move: { at: number; band: string }) => {
    setBand(move.band);
    if (move.at !== at) onAt(move.at);
    window.requestAnimationFrame(() => field.current?.focus());
  };
  const requestMove = (move: { at: number; band: string }) => {
    if (move.at === at && move.band === band) return;
    if (draft.trim()) { setPendingMove(move); setLeaving(true); }
    else applyMove(move);
  };
  const moveAfterReview = () => {
    const move = pendingMove;
    setDraft(''); setLeaving(false); setPendingMove(null);
    if (move) applyMove(move);
    else finish(true);
  };

  /* The matrix follows reading order: every tariff for this product, then the first tariff for the
     next product. Paste remains a confirmation queue because each target already carries a rate. */
  const pass = (saved = false) => {
    if (atEnd) { finish(saved); return; }
    if (pasted) { onAt(at + 1); return; }
    if (together || lastBand) {
      setBand(tiers[0].id);
      onAt(at + 1);
      return;
    }
    setBand(tiers[bandAt + 1].id);
  };
  const canPrevious = pasted ? at > 0 : at > 0 || bandAt > 0;
  const previous = () => {
    if (!canPrevious) return;
    if (pasted) { requestMove({ at: at - 1, band }); return; }
    if (bandAt > 0) { requestMove({ at, band: tiers[bandAt - 1].id }); return; }
    requestMove({ at: at - 1, band: tiers[tiers.length - 1].id });
  };
  const nextProduct = () => { if (!lastProduct) requestMove({ at: at + 1, band: tiers[0].id }); };
  const previousProduct = () => { if (at > 0) requestMove({ at: at - 1, band: tiers[0].id }); };

  const saveAndNext = () => {
    if (!write()) return;
    pass(true);
  };

  const reading = closing ? publishReading(written) : null;

  /* ONE CONTROL, AND ITS LABEL IS ITS STATE (§59.1). «Save & next» is Peter's own word for the act
     it names and it ships verbatim the moment there is a price to save; with nothing typed and
     bands still to go, the same control PASSES and says «Next» — and after §115.2 the next thing
     is the NEXT TARIFA of the product on screen.
     THE LAST BAND IS THE ONE PLACE IT RESTS. There is no next to offer there, so the control keeps
     the name of the act it is waiting on and «Done» beside it is the live way out — which is what
     C10 was actually about: the stall it found was a queue with things left in it and nothing but
     «Done» alive. A HOUSE WITH ONE TARIFA is on its last band from the first frame, so it asks for
     «Save» rather than announcing an exit that does not exist. */
const act = ready || atEnd
    ? together
      ? (atEnd ? `Save all ${tiers.length} tariffs` : 'Save all & next')
      : (atEnd ? 'Save price' : 'Save & next')
    : 'Skip';
  const waiting = !ready && atEnd;

  /* ── THE PUBLISH READING (§16 «publish») ──────────────────────────────────────────────────
     One task at a time is §76's first line, so the round's end is its own surface rather than a
     panel bolted under the field. It states the size of what was done, lists every price with the
     one it replaced, and offers the two acts a person actually wants there: close it, or take the
     whole round back. */
  if (reading) {
    const undoAll = () => {
      if (!dropStamps(written)) return;
      setWritten([]);
      onClose();
    };
    return (
      <WorkflowDialog isOpen={isOpen} onClose={onClose} title="Prices saved" ariaLabel="Today’s prices" actions={<div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
            <Button
              kind={KIND.primary}
              size={SIZE.large}
              data-testid="price-publish-act"
              onClick={onClose}
              overrides={{ BaseButton: { style: { flex: '1 1 auto', whiteSpace: 'nowrap' } } }}
            >
              Done
            </Button>
            <Button kind={KIND.tertiary} size={SIZE.large} data-testid="price-publish-undo" onClick={undoAll}>
              Undo changes
            </Button>
          </div>}>
        <div
          data-testid="price-publish"
          data-lines={reading.lines.length}
          data-products={reading.products}
          data-tiers={reading.tiers.length}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
            <span
              data-testid="price-publish-count"
              style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}
            >
              {publishWords(reading)}
            </span>
          </div>

          <PriceSaveNotice />
          {/* EVERY PRICE, WITH THE ONE IT REPLACED. The supersede pair is `Figure`'s own idiom, so
              a round of eighty reads exactly like one row of the product sheet does. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale300,
              maxHeight: phone ? '46vh' : '40vh',
              overflowY: 'auto',
              minWidth: 0,
            }}
          >
            {reading.lines.map((line) => {
              const of = targets.find((t) => t.product.id === line.stamp.product);
              return (
                <div
                  key={line.stamp.id}
                  data-published={line.stamp.product}
                  style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}
                >
                  <span
                    style={{
                      ...theme.typography.LabelSmall,
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {of ? of.name : line.stamp.product}
                  </span>
                  {many && (
                    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
                      {tierNameOf(cast, line.stamp.tier)}
                    </span>
                  )}
                  <Figure
                    value={line.stamp.price}
                    was={line.was ?? undefined}
                    unit={of ? priceUnitOf(of.product) : undefined}
                    decimals={2}
                    locale={LOCALE}
                    size="compact"
                  />
                </div>
              );
            })}
          </div>


        </div>
      </WorkflowDialog>
    );
  }

  return (
    <WorkflowDialog isOpen={isOpen} onClose={() => finish()} title={targets.length > 1 ? 'Update prices' : 'Set price'} ariaLabel="Today’s price" actions={<>
        {leaving && <section data-testid="price-unsaved-review" role="alert" style={{ padding: theme.sizing.scale400, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          <span style={theme.typography.LabelMedium}>You have an unsaved price</span>
          <span style={theme.typography.ParagraphSmall}>Save it or discard it before {pendingMove ? (pendingMove.at === at ? 'switching tariffs' : 'switching products') : 'closing'}.</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => { setLeaving(false); setPendingMove(null); }}>Keep editing</Button>
            <Button kind={KIND.secondary} size={SIZE.compact} onClick={moveAfterReview}>Discard changes</Button>
            <Button kind={KIND.primary} size={SIZE.compact} disabled={!ready || clashes.length > 0} onClick={() => { if (write()) moveAfterReview(); }}>{together ? `Save all ${tiers.length} tariffs` : 'Save price'}</Button>
          </div>
        </section>}
{leaving ? null : clash ? (
          /* THE ACTS ROW IS THE RESOLUTION WHILE A CLASH STANDS (§59.1: an act transforms its own
             control, in place). Two verbs, each naming what it leaves standing. Answering is the
             only way on — which is what makes it a review state rather than a notice. */
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
            <Button
              kind={KIND.primary}
              size={SIZE.large}
              data-testid="price-sheet-keep-theirs"
              onClick={() => {
                setSettled((held) => [...held, clash.id]);
                setOpenedOn((held) => ({ ...held, [clash.tier]: clash.id }));
                setOpened(clash.price);
                setDraft('');
                setGiven('hand');
                pass();
              }}
              overrides={{ BaseButton: { style: { flex: '1 1 auto', whiteSpace: 'nowrap' } } }}
            >
              Keep theirs
            </Button>
            <Button
              kind={KIND.secondary}
              size={SIZE.large}
              data-testid="price-sheet-keep-mine"
              onClick={() => {
                setSettled((held) => [...held, clash.id]);
                setOpenedOn((held) => ({ ...held, [clash.tier]: clash.id }));
                if (ready && clashes.length === 1) saveAndNext();
                else field.current?.focus();
              }}
              overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}
            >
              Write mine
            </Button>
          </div>
        ) : phone ? (
          <div data-testid="price-mobile-actions" style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 56px', alignItems: 'center', gap: theme.sizing.scale300, width: '100%' }}>
            <Button
              kind={KIND.secondary}
              size={SIZE.large}
              shape={SHAPE.circle}
              disabled={!canPrevious}
              data-testid="price-sheet-prev"
              aria-label="Previous price"
              onPointerDown={(event) => event.preventDefault()}
              onClick={previous}
              overrides={{ BaseButton: { style: { width: '56px', height: '56px', minWidth: '56px', minHeight: '56px' } } }}
            >
              <StepChevron direction="back" />
            </Button>
            <Button
              kind={KIND.tertiary}
              size={SIZE.large}
              data-testid="price-sheet-done"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => finish()}
              overrides={{ BaseButton: { style: { minHeight: '56px', whiteSpace: 'nowrap' } } }}
            >
              Done
            </Button>
            <Button
              kind={KIND.primary}
              size={SIZE.large}
              shape={SHAPE.circle}
              disabled={waiting}
              data-testid="price-sheet-next"
              data-last={atEnd ? 'yes' : 'no'}
              data-act={ready ? 'save' : atEnd ? 'waiting' : 'pass'}
              aria-label={act}
              onPointerDown={(event) => event.preventDefault()}
              onClick={ready ? saveAndNext : () => pass()}
              overrides={{ BaseButton: { style: { width: '56px', height: '56px', minWidth: '56px', minHeight: '56px' } } }}
            >
              <StepChevron direction="next" />
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
            <Button
              kind={KIND.primary}
              size={SIZE.large}
              disabled={waiting}
              data-testid="price-sheet-next"
              data-last={atEnd ? 'yes' : 'no'}
              data-act={ready ? 'save' : atEnd ? 'waiting' : 'pass'}
              onClick={ready ? saveAndNext : () => pass()}
              overrides={{ BaseButton: { style: { flex: '1 1 auto', whiteSpace: 'nowrap' } } }}
            >
              {act}
            </Button>
            <Button kind={KIND.tertiary} size={SIZE.large} data-testid="price-sheet-done" onClick={() => finish()}>
              Done
            </Button>
          </div>
        )}
    </>}>
      <div
        data-testid="price-sheet"
        data-at={at}
        data-of={targets.length}
        data-product={target.product.id}
        data-target={target.key}
        /* §115.2 · WHERE THE RUN IS, and the run is the tarifas. A drive that used to watch
           `data-product` change on «Save & next» watches THESE change instead — and asserts that
           `data-product` HOLDS while they do, which is the whole of the correction. */
        data-band-at={bandAt}
        data-bands={tiers.length}
        onTouchStart={(event) => { const touch = event.touches[0]; swipe.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }}
        onTouchEnd={(event) => {
          const start = swipe.current;
          swipe.current = null;
          const touch = event.changedTouches[0];
          if (!phone || !start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
          if (dx < 0) nextProduct();
          else previousProduct();
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          /* ── THE DEAD SPACE DIES (§111.3) ─────────────────────────────────────────────────
             «Also, why is there so much space?» Six stacked children at scale500 spent 80px of a
             390px sheet on gaps alone, which is what made a surface with one number on it read as
             a mostly-empty card. scale400 between the groups; the groups carry their own scale200
             inside. Dense the way a working surface is — Base's own scale, one step down its
             range rather than at the top of it. */
          gap: theme.sizing.scale400,
          minWidth: 0,
        }}
      >
        <PriceSaveNotice />
        {/* ── THE HANDLE (§76: «dismissible by dragging down») ──────────────────────────────
            A phone's sheet says how it leaves. It is the card's own bar, it is the thing the
            thumb takes hold of, and it is drawn only where the sheet is docked — a centred card
            on a desk is dismissed by Escape and the scrim, which is what a desk already knows. */}


        {/* ── §16.7 · DICTATE, IN THE SHEET'S HEAD ─────────────────────────────────────────
            «Paste; type; DICTATE; bulk update.» It is the app's own voice control — the one that
            already takes a note in a chat — and it rests as ONE BUTTON in the head's trailing
            seat. A TAKE NEEDS THE ROW (§13, the Composer's own law): the moment one starts, the
            row gives itself over and takes itself back when the control is finished.
            It draws only where the host can set words down (`dictate`): a mic that cannot reach
            an ear is a control that lies about what pressing it does — and where there is no ear
            the row is ABSENT rather than empty, because an empty row is a gap with a name. */}
        {dictate && (
          <div
            data-testid="price-sheet-voice"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              minWidth: 0,
              minHeight: 40,
            }}
          >
            {/* A TAKE NEEDS THE ROW: idle it is one button in the trailing seat, and the moment
                one starts it takes the whole line and gives it back when it is finished. */}
            <span
              style={{
                flex: takeBusy ? '1 1 auto' : '0 0 auto',
                minWidth: 0,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <StatefulVoiceButton
                simulate
                seed={`${cast.sector}-price-${target.product.id}`}
                size="compact"
                onBusyChange={setTakeBusy}
                onRecord={heard}
              />
            </span>
          </div>
        )}

        {/* ── BEAT 1 · WHAT IS BEING PRICED — CENTRED, AND IT HOLDS STILL (§111.3 · §115.2) ─
            «Why is it not like a centered thing with a keyword below?» The face and the name sit
            together in the middle of the sheet at the size a face is actually recognisable at,
            and the keyword — the member's word, the sort — stands under them. The thing being
            priced is the subject of the surface, so it is drawn as the subject.

            AND IT ARRIVES ONCE, WITH ITS PRODUCT. §115.2 moved the run onto the tarifas, so this
            block is the CONSTANT of the film: it enters when a product is picked and then does
            not move again while three bands are written under it. A subject that re-animated on
            every save would be the surface insisting the wrong thing changed.

            THE HEIGHT IS FIXED, AT EVERY PRODUCT (§77.2). Both text slots are one line with an
            end ellipsis and the full name rides the `title`, so «Gamba roja de Palamós» and
            «Rape» leave the field, the acts and the context on exactly the same y. A sheet that
            is pressed forty times may never move its own controls under the thumb.

            THE CLIP IS LOAD-BEARING: the block travels 20px on arrival, and `overflow-x: clip`
            keeps that travel off the page's own scroll — it is the one overflow value that
            clips without making the box a scrollport (§13). */}
        <div data-testid="price-form-grid" style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 220px) minmax(0, 1fr)', gap: theme.sizing.scale800, alignItems: 'start', minWidth: 0 }}>
        <div style={{ overflowX: 'clip', minWidth: 0 }}>
          <div
            data-testid="price-sheet-subject"
            data-subject={target.product.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              minWidth: 0,
              textAlign: 'center',
              opacity: subjectLanded ? 1 : 0,
              transform: subjectLanded ? 'none' : 'translate3d(20px, 0, 0)',
              transitionProperty: still ? undefined : 'opacity, transform',
              transitionDuration: still ? undefined : theme.animation.timing400,
              transitionTimingFunction: still ? undefined : theme.animation.easeOutCurve,
            }}
          >
            <Face product={target.product} size={72} />
            <span
              data-testid="price-sheet-name"
              title={target.name}
              style={{
                ...theme.typography.HeadingSmall,
                display: 'block',
                maxWidth: '100%',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                minWidth: 0,
              }}
            >
              {target.name}
            </span>
            <span
              data-testid="price-sheet-keyword"
              data-variation={target.word ? 'yes' : 'no'}
              title={keyword || undefined}
              style={{
                ...theme.typography.LabelSmall,
                color: theme.colors.contentSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                maxWidth: '100%',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                minWidth: 0,
                /* THE SEAT IS KEPT EVEN WHERE THE WORD IS EMPTY — a product with no sort of its
                   own may not shorten the sheet and move the field up under the thumb. */
                minHeight: '1em',
              }}
            >
              {/* THE SUBJECT SAYS WHICH VARIATION IT IS, IN THE LIST'S OWN LANGUAGE (S10). The run
                  walks a member's price and the member's word was sitting in a grey sub-line with
                  nothing to say that it WAS a member — so the tarifa chips above read as the only
                  structure on the sheet. The bent arrow is what the catalogue already uses for
                  exactly this relationship, and it costs 12px. */}
              {target.word ? <VariationMark /> : null}
              {keyword}
            </span>
          </div>
        </div>

        {/* ── BEAT 2 · THE BAND, AND THE CHIPS ARE THE PROGRESS (§76 · §115.2) ─────────────
            «Never a huge dropdown labeled "Variant"» — Base's own ButtonGroup in radio mode, at
            the size a thumb takes, and only where the house has bands.

            AFTER §115.2 THE CHIPS ARE ALSO THE RUN. «Save & next» moves the selection along them,
            so the progress indicator and the control are ONE THING — which is why the rail this
            file grew in round 1 is gone: it drew the same fact a second time, about the wrong
            queue. «2 of 3» rides beside them because he asked the question outright («if it's
            3/10, is that the tariff, or what?»), and here the answer is unambiguous: the counter
            sits on the tarifa row, counting tarifas.

            AND JUMPING IS STILL ALLOWED. A chip pressed out of order re-seats the run there —
            linear is the RHYTHM, never a rail the person is locked onto. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
        {(many || pasted) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
            {many && !together ? (
              phone ? (
                <div data-testid="price-sheet-bands" data-band={band} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, flex: '1 1 auto', minWidth: 0 }}>
                  <div role="radiogroup" aria-label="Choose tariff" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
                    {tiers.map((tier) => {
                      const active = tier.id === band;
                      const price = writtenOn(target.product, tier.id, day) ?? priceOn(cast, target.product, tier.id, day);
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-testid={`price-sheet-band-${tier.id}`}
                          data-active={active ? 'yes' : 'no'}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => requestMove({ at, band: tier.id })}
                          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale300, width: '100%', minHeight: '48px', padding: `${theme.sizing.scale200} ${theme.sizing.scale400}`, border: `1px solid ${active ? theme.colors.contentPrimary : theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, boxShadow: active ? `inset 0 0 0 1px ${theme.colors.contentPrimary}` : 'none', background: active ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, fontFamily: 'inherit', textAlign: 'left', cursor: 'default' }}
                        >
                          <span style={{ ...theme.typography.LabelMedium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{tier.name}</span>
                          <Figure value={price} unit={unit} decimals={2} locale={LOCALE} size="compact" />
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    kind={KIND.tertiary}
                    size={SIZE.mini}
                    data-testid="price-sheet-stat"
                    data-stat={statAt}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => { setStatAt((held) => (held + 1) % statWords.length); window.requestAnimationFrame(() => field.current?.focus()); }}
                    overrides={{ BaseButton: { style: { justifyContent: 'flex-start', minHeight: '36px', color: theme.colors.contentSecondary } } }}
                  >
                    {statWords[statAt]}
                  </Button>
                </div>
              ) : (
                <span data-testid="price-sheet-bands" data-band={band} style={{ flex: '1 1 auto', minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}>
                  <ButtonGroup mode={GROUP_MODE.radio} size={SIZE.compact} kind={KIND.secondary} selected={bandAt} onClick={(_event, index) => requestMove({ at, band: tiers[index].id })} aria-label="Choose tariff">
                    {tiers.map((tier) => <Button key={tier.id} data-testid={`price-sheet-band-${tier.id}`} overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}>{tier.name}</Button>)}
                  </ButtonGroup>
                </span>
              )
            ) : (
              <span style={{ flex: '1 1 auto', minWidth: 0 }} />
            )}
            {/* ── AND THE COUNT DIES WHERE THE THINGS THEMSELVES SHOW (FEED-IA §134.3.2) ──────
                «Never say "tarifa one of three" where the tarifas are VISIBLE.» Three chips are
                drawn, one of them is black, and «1 of 3» beside them is the surface counting
                objects the eye has already counted — a number whose whole content is what the
                chips are. The chips ARE the progress (§115.6 beat 2 said so and then said it
                twice); the counter survives only on §16.5's PASTED run, where the run is a queue
                of products that is NOT on the screen and the number is the only thing that says
                how far in a person is. */}
            {pasted && (
              <span
                data-testid="price-sheet-place"
                data-run="product"
                style={{
                  ...theme.typography.LabelXSmall,
                  color: theme.colors.contentTertiary,
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {`${at + 1} of ${targets.length}`}
              </span>
            )}
          </div>
        )}

        {together && (
          <p data-testid="price-sheet-scope" style={{ margin: 0, ...theme.typography.ParagraphSmall }}>
            This price replaces all {tiers.length} tariffs: {tiers.map((tier) => tier.name).join(', ')}. Undo restores them together.
          </p>
        )}

        {/* ── BEAT 3 · THE ACTION — THE NUMBER, AND IT IS THE FIELD ────────────────────────
            The one thing on this surface with visual priority. The unit rides the number's own
            line as an end enhancer — the house price law, at every width — and the standing price
            stands in the box as the placeholder, so an empty field still says what the goods cost
            today rather than reading as a value that was lost.

            AND THIS GROUP IS WHAT ARRIVES ON «SAVE & NEXT» (§115.2). The field and the standing
            price belong to ONE TARIFA, so they travel together when the tarifa does: they rise
            8px and fade in while the subject above them and the chips beside them hold their
            place. That is the answer to «they click Save and Next, and then nothing happens» —
            the thing that changed is the thing that moved. Vertical, because the run is a stack
            of bands rather than a queue you walk along, and because a caret may not be dragged
            sideways under a thumb. */}
        <div
          data-testid="price-sheet-value"
          data-band={band}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale400,
            minWidth: 0,
            opacity: bandLanded ? 1 : 0,
            transform: bandLanded ? 'none' : 'translate3d(0, 8px, 0)',
            transitionProperty: still ? undefined : 'opacity, transform',
            transitionDuration: still ? undefined : theme.animation.timing400,
            transitionTimingFunction: still ? undefined : theme.animation.easeOutCurve,
          }}
        >
        <Input
          inputRef={field}
          size={INPUT_SIZE.large}
          value={draft}
          onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              /* a clash is answered by pressing one of the two verbs, never by a reflex on Enter */
              if (!clash) saveAndNext();
            }
          }}
          placeholder={ownStanding === null && suggestion === null ? 'Enter price' : priceEditorAmount(standing, country).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          aria-label={`Today’s price for ${target.name}`}
          endEnhancer={
            <span data-testid="price-sheet-unit" style={{ ...theme.typography.LabelMedium, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
              {editorUnit}
            </span>
          }
          overrides={{
            Input: {
              props: { 'data-testid': 'price-sheet-input', inputMode: 'decimal', autoComplete: 'off' },
              style: { ...theme.typography.HeadingLarge, fontVariantNumeric: 'tabular-nums' },
            },
            EndEnhancer: { style: { whiteSpace: 'nowrap' } },
          }}
        />

        {/* ── THE STANDING PRICE IS A FIGURE, NOT A SENTENCE (§111.3 V19 · §84 · §109.3) ───
            «Yesterday's price doesn't make it very clear. Again, we're just doing plain text for
            half of the stuff.» It was: «Previous 14,20 €/kg · Today · Tarifa 1 · set 08:12» — the
            one number a person checks the new one against, set in 12px grey prose between three
            other facts, on a surface whose whole subject is a price.

            So it is the app's own product-level ROW: the label on the left, the facts under it,
            THE FIGURE ON THE RIGHT with its unit on the number's own line — `Figure`, the same
            primitive the publish reading and the tarifa rows draw. A price on the left is a
            violation wherever it appears (§109.5); a price rendered as prose is the same
            violation with the geometry hidden. */}
        {!phone && <div
          data-testid="price-sheet-context"
          data-previous={standing}
          data-given={given}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'baseline',
            gap: theme.sizing.scale400,
            paddingTop: theme.sizing.scale300,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            minWidth: 0,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
            {/* «PREVIOUS» IS THE APP'S OWN WORD FOR IT and it stays — V19 was about the number
                being PROSE, never about the label. The figure moved to the right; the word did
                not move at all. */}
            {/* ── «LAST PRICE», AND IT STANDS ALONE (FEED-IA §134.3.3, his own line) ──────────
                «The previous price stands alone as "Last Price: 16,07 as of 02:00 27 Aug" — never
                "today", never "tarifa 3".»
                WHAT DIED, AND WHY EACH ONE WAS WRONG. «Today» was the field's tense printed under
                the OLD number, so the one line about the past opened with the present. The band
                name was §134.3.2's fault one row down: the chips above are drawn, one is black,
                and naming it again is the surface saying a visible thing out loud. What is left is
                the only thing a person checking a new price against an old one needs — the number,
                and when it was written.
                THE WORDS ARE HIS AND THE GEOMETRY IS THE HOUSE'S. The figure stays in the row's
                right cell (§109.5: a price on the left is a violation wherever it appears), so the
                line reads exactly as he wrote it — «Last Price … 16,07 / as of 08:12 on 20.08» —
                with the date in the house's own form rather than a second date language. */}
            <span style={theme.typography.LabelSmall}>{ownStanding !== null ? 'Last price' : suggestion !== null ? 'Family starting suggestion' : 'Price still to set'}</span>
            <span
              data-testid="price-sheet-asof"
              style={{
                ...theme.typography.LabelXSmall,
                color: theme.colors.contentSecondary,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                minWidth: 0,
              }}
            >
              {[
                last ? `as of ${last.at} on ${dayShort(last.day)}` : ownStanding !== null ? 'From your catalogue' : suggestion !== null ? 'Only copied if you enter and save it' : 'This tariff’s price is still to save',
                given === 'list' ? 'from your list' : '',
                given === 'take' ? 'from your take' : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          {(ownStanding !== null || suggestion !== null) && <Figure value={standing} unit={unit} decimals={2} locale={LOCALE} size="compact" />}
        </div>}
        </div>

        </div>
        </div>
        {/* ── §16.9 · TWO HANDS ON ONE PRICE, RESOLVED IN THE OPEN ─────────────────────────
            «Resolve conflicts.» Another hand wrote this band since the sheet opened on it, so the
            two numbers stand side by side with whose and when — and the round does not move until
            one of them is answered. THE PREVIOUS ONE STAYS VISIBLE, which is the whole review:
            nobody is asked to choose between a number they can see and one they remember. */}
        {!leaving && clash && (
          <div
            data-testid="price-sheet-clash"
            data-clash-at={clash.at}
            data-clash-price={clash.price}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale300,
              padding: theme.sizing.scale400,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius200,
              minWidth: 0,
            }}
          >
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>
              {tierNameOf(cast, clash.tier)} · {conflictWords(clash)}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale200 }}>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Theirs</span>
                <Figure value={clash.price} unit={unit} decimals={2} locale={LOCALE} size="compact" />
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale200 }}>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Yours</span>
                <Figure value={ready ? canonicalTyped : opened} unit={unit} decimals={2} locale={LOCALE} size="compact" />
              </span>
            </div>
          </div>
        )}



        {/* ── THE ACTS: LOW, LARGE, AND THE RHYTHMIC ONE FIRST ─────────────────────────────
            «The high-frequency action sits LOW and LARGE.» Save & next writes and advances; with
            nothing typed and a queue still running, the same button PASSES and says «Next». Done
            is the quiet way out and it writes nothing. */}

      </div>
    </WorkflowDialog>
  );
}

export default TarifasCard;
