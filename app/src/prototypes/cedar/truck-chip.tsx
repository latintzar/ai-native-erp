/* THE TRUCK RIDES THE CARD (FEED-IA §21).
 *
 * «Houses run trucks per area: the main cards carry a little truck icon + its number (1… 12) /
 * region name.» It lives in a file of its own because the round is a fact about a CUSTOMER, not
 * about a surface: the river's rows, the document and the map all name one round, and the words
 * come from `roundOf` off the customer — never typed.
 *
 * AND BECAUSE IT IS THE ONE DRAWING OF A ROUND, IT IS ALSO WHERE A HAND MOVES ONE. The checkpoint's
 * §19.7 — «manual override is required regardless» — is built below the chip's own type: the record
 * a hand writes, and the act on the chip's door that writes it. See the block before `TruckChip`.
 *
 * IT WAS BORN IN `day-view.tsx`, which §25.1 killed: «Prepare dies completely — the day zoom we
 * literally have in the feed itself.» The bay's own surface is parked at `_parked/day-view.tsx`,
 * out of the build; what deserved to survive it came here (this chip) and onto the day whisper in
 * `areas/sales.tsx` (the ‹ DATE › chevrons and the mini-calendar door, reborn as §27's narrow).
 * The per-order tick ceremony did not survive at all, by §26.1: «nobody marks off. They just DO it.»
 *
 * A MARK WITH ITS WORDS BESIDE IT (§30). The van is one of the app's determined icons — it means a
 * truck and a run everywhere it appears — and it carries the run's real name, so the chip reads
 * without a hover on a phone and reads identically wherever a round is stated.
 *
 * ═══ AND IT OPENS THE MAP (FEED-IA §43, §39.1) ═════════════════════════════════════════════
 * «Truck/zone chips open the big map modal.» A run is a PLACE said in two words, and a place a
 * person cannot look at is a place they have to already know. The chip states «3 · Costa Brava»,
 * and pressing it shows exactly what the albarán's own map square shows — the same `PinMap` on the
 * same `OverlayCard`, because «one grammar, three surfaces» is a claim about the code.
 *
 * IT IS A DOOR ONLY WHERE THERE IS SOMEWHERE TO GO. Without a location the chip stays the plain
 * mark it has always been: a control that looked pressable and was not would be the software
 * promising a door it has not got, which is the exact fault §43 is correcting.
 *
 * ═══ AND ONLY WHERE THE ROUND IS THE SUBJECT (§43's affordance, learned by a click) ═════════
 * The caller decides, by handing `where` or withholding it, and the rule is about what the chip is
 * standing INSIDE:
 *
 *   · ON A SHEET, where the round is one of the customer's own facts → a door. Nothing else on
 *     that line wants the press.
 *   · ON A ROW OR A CARD, whose whole body is already the door to an order or a customer → a mark.
 *
 * It was made a door everywhere first, and a phone caught it: at 390px the chip lands almost
 * exactly at the centre of a river row, which is where a thumb goes to open the order and where a
 * drive's click goes too. `elementFromPoint` at the row's middle came back «BUTTON · truck-4», the
 * document stopped opening, and the integration drive went red on a step about something else
 * entirely. A twelve-pixel control inside a thumb-sized target is a mis-tap generator, not a
 * choice — «think the affordance» is what §43 asks for, and this is what it means here.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { StatefulTooltip, PLACEMENT as TOOLTIP_PLACEMENT } from 'baseui/tooltip';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import { useCompany } from './company';
import { Glyph, STEP } from './glyphs';
import PinMap, { type LatLng } from './pin-map';
import RoundMap, { zoneNameOf } from './round-map';
import { roundWords, type Round } from './sale';
import { usePhoneFloorHeight } from './shell';

/** WHERE THE CHIP CAN TAKE A PERSON. The point on the map and whose door it is — the two things
 *  `PinMap` needs to draw a pin somebody recognises. */
export type ChipWhere = { at?: LatLng; name: string };

/* ═══ THE HAND MOVES THE TRUCK (THE CHECKPOINT §19.7 · §26.3) ═════════════════════════════════
 * «Users must always be able to manually override the truck / route assigned to an order… Manual
 * override is required regardless.» It is the one clause §19 marks required WHILE the capacity
 * model stays open, and it had no setter anywhere: `roundOf(sale)` reads the truck off the
 * customer, and nothing could put a different one on one order.
 *
 * ═══ WHY THE OVERRIDE IS ITS OWN RECORD AND NOT A FIELD ON THE SALE ═════════════════════════
 * A round is DERIVED — «the pair is read off the customer, where the round is already seeded, so
 * the feed row, the prep row and the map all name ONE round». Writing a truck onto the sale would
 * make that one derivation two, and the two would drift. So the hand's decision is an EVENT beside
 * the derivation, exactly as a price stamp stands beside a tarifa: the sale still derives its
 * standing run, and the override says «for THIS order, a person said otherwise, at this hour».
 * `roundOf` keeps meaning what it means, and the chip — which is the ONE drawing of a round in this
 * app — reads the override over it wherever an order is named.
 *
 * ═══ AND IT IS A READING, NEVER A SILENT SWAP (§51.14, §70.3's «the ground on the row») ══════
 * A truck that quietly became a different truck is a document nobody can audit. So the overridden
 * chip carries the hour it was moved and the run it would otherwise be on, and putting it back is
 * one press — the same shape every other correction in this app has.
 *
 * ═══ WHAT IS NOT HERE (§27.8 · §28) ═════════════════════════════════════════════════════════
 * No capacity. No weight, volume, pallets or boxes; no overflow to a second van; no rule that a run
 * is full. The house moves an order to a truck because the house knows why, and this records it.
 */
export type RoundOverride = {
  /** the order this was set on */
  sale: string;
  /** the run a person put it on */
  zone: string;
  /** the van that runs it, at the moment it was set */
  truck: number;
  /** the hour, in the house's own clock */
  at: string;
};

export const ROUND_OVERRIDE_STORAGE_KEY = 'rocoto-app-round-override';

const isOverride = (o: unknown): o is RoundOverride => {
  if (!o || typeof o !== 'object') return false;
  const x = o as Record<string, unknown>;
  return typeof x.sale === 'string' && typeof x.zone === 'string'
    && Number.isFinite(x.truck) && typeof x.at === 'string';
};

function readOverrides(): RoundOverride[] {
  try {
    const raw = window.localStorage.getItem(ROUND_OVERRIDE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isOverride) : [];
  } catch {
    return [];
  }
}

let OVERRIDES: RoundOverride[] = typeof window === 'undefined' ? [] : readOverrides();

const overrideListeners = new Set<() => void>();

const publishOverrides = (next: RoundOverride[]): void => {
  OVERRIDES = next;
  try {
    window.localStorage.setItem(ROUND_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* a prototype in a private window still has to run */
  }
  for (const fn of overrideListeners) fn();
};

/** THE HOUR, IN THE HOUSE'S OWN CLOCK — the form every stamp in this app is written in. */
const hourNow = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** A HAND PUTS THIS ORDER ON THAT RUN. The last word wins, and the record keeps its hour. */
export function setRoundOverride(sale: string, zone: string, truck: number): void {
  publishOverrides([...OVERRIDES.filter((o) => o.sale !== sale), { sale, zone, truck, at: hourNow() }]);
}

/** PUT IT BACK ON THE RUN IT DERIVES. Dropping the record restores the derivation rather than
 *  writing a second decision over the first — the same shape `dropStamps` gives a price. */
export function clearRoundOverride(sale: string): void {
  publishOverrides(OVERRIDES.filter((o) => o.sale !== sale));
}

export const roundOverridesNow = (): RoundOverride[] => OVERRIDES;

export const overrideOf = (sale: string | undefined): RoundOverride | undefined =>
  sale === undefined ? undefined : OVERRIDES.find((o) => o.sale === sale);

export const useRoundOverride = (sale: string | undefined): RoundOverride | undefined => {
  const all = React.useSyncExternalStore(
    (fn) => {
      overrideListeners.add(fn);
      return () => overrideListeners.delete(fn);
    },
    () => OVERRIDES,
    () => OVERRIDES,
  );
  return React.useMemo(() => (sale === undefined ? undefined : all.find((o) => o.sale === sale)), [all, sale]);
};

/* ── A LABEL MAY NEVER PAINT UNDER THE THING IT LABELS (FEED-IA §54.1) ────────────────────────
 * «There are some labels that appear behind the actual thing.» Base mounts a tooltip in a LAYER at
 * the end of the body with NO z-index of its own, so it paints in tree order — under every
 * positioned thing this app raises above it. This chip rides the band (z-index 4), the rows under
 * it and the sheet's own sticky dock (z-index 2), so its label went behind all three: the founder
 * hovered a truck mark and read the card through its own tooltip.
 *
 * 12 is the step this app gives a layer that must clear everything (`detail.tsx`'s PrintFlush wrote
 * it first, for the identical reason). It is stated here so the chip carries its own guarantee
 * wherever it is dropped, rather than depending on what its host happens to be standing on.
 */
const OVER_THE_CHROME = { Body: { style: { zIndex: 12 } } } as const;

/** ONE SKIN, BOTH FORMS AND BOTH AFFORDANCES — so the mark and the full chip can never drift into
 *  two objects with one meaning (§30's determination). */
const skinOf = (theme: ReturnType<typeof useStyletron>[1], on: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.sizing.scale100,
  flex: '0 0 auto',
  padding: `0 ${theme.sizing.scale200}`,
  borderRadius: theme.borders.radius100,
  background: on ? theme.colors.backgroundTertiary : theme.colors.backgroundSecondary,
  color: theme.colors.contentSecondary,
  ...theme.typography.LabelXSmall,
  whiteSpace: 'nowrap',
});

/* ── AND ON A REVIEW CARD IT IS A MARK (FEED-IA §51.1, §30) ───────────────────────────────────
 * «Facts line minimal: lines · holder-door · truck as a mark.» The run's name is the longest token
 * on a card the founder called extremely busy, and on the band it is competing with a customer's
 * name, a reason and a comercial's name for one line at 390px.
 *
 * SO THE MARK IS THE VAN AND ITS NUMBER, and the run's name rides Base's own hover label plus the
 * aria — which is exactly §30's bargain: «the icon IS the control, Base's hover/tooltip carries the
 * word on desk». It is the SAME mark with the same meaning, said shorter; the number is the run's
 * identity and the name is the fact about it, so what is dropped is the fact and never the identity.
 *
 * WHERE EACH FORM STANDS. The mark is for the two REVIEW altitudes — the band's cards and the rows
 * standing in their day — because those are the ones carrying a reason and a verb as well. The flat
 * river rows and the sheets keep the full chip, where §21 put it and where there is room for it.
 */
export function TruckChip({
  round,
  on = false,
  where,
  mark = false,
  order,
}: {
  round: Round;
  on?: boolean;
  where?: ChipWhere;
  /** the run said as its number alone, the name on the hover (§51.1) */
  mark?: boolean;
  /** THE ORDER THIS ROUND BELONGS TO (§19.7). Given one, the chip reads any override a hand has
   *  put on it and its door gains the act that sets one. Withheld — on a customer's own sheet, on
   *  a row whose subject is not an order — the chip is the derivation and nothing else, because a
   *  customer's standing run is not a thing one order may move. */
  order?: { id: string };
}) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  const company = useCompany();
  /* ── THE CHIP THAT IS A DOOR TAKES THE FLOOR (INTX-12 · §188.2 · E193.14) ─────────────────
     W8 measured `truck-N` at 22px at 390. The chip has TWO forms and only one of them is a
     control: as a MARK (`role="img"`, §51.1) it is a fact on a card and a floor would be a
     44px hole in a facts line; as a DOOR — the form below, the one that opens the run's map —
     it is a press, and INTX-12 gives a press 44px on a phone. Height only: the chip's width is
     its own word and must stay the run's measure. */
  const floor = usePhoneFloorHeight();
  const moved = useRoundOverride(order?.id);
  /* THE OVERRIDE IS READ OVER THE DERIVATION, never instead of it: `standing` stays what the
     customer's own record says, so the card can state both — what a hand chose, and what it would
     otherwise be. */
  const standing = round;
  const shown: Round = moved ? { truck: moved.truck, zone: moved.zone } : standing;
  const zone = zoneNameOf(shown.zone) ?? shown.zone;
  const standingZone = zoneNameOf(standing.zone) ?? standing.zone;

  const face = (
    <>
      {/* THE LADDER, NOT A NUMBER (§31.2). Glyphs snap to 16/20/24; asking for 12 drew at 16 with
          the chip still sized for 12, which is the container-fights-its-glyph habit the icon module
          exists to end. The chip states the step it is drawing. */}
      <Glyph id="van" size={STEP.small} />
      {/* the run's REAL name (round-map's geography), so the chip and the document's map agree —
          the raw seed id («centre», «costa») is the fallback, never the preferred word */}
      {mark ? shown.truck : `${shown.truck} · ${zone}`}
    </>
  );

  /* THE MARK CARRIES ITS WORD ON THE HOVER, NEVER NOWHERE (§30). A number with no name is a code
     the reader has to already know, so on a desk Base's own label says the whole sentence and the
     aria says it to everybody — which is the whole reason an icon may shed its words at all. */
  if (mark && !where?.at) {
    return (
      <StatefulTooltip content={roundWords(shown)} placement={TOOLTIP_PLACEMENT.top} showArrow overrides={OVER_THE_CHROME}>
        <span
          data-testid={`truck-${shown.truck}`}
          data-zone={shown.zone}
          data-truck-mark="yes"
          role="img"
          aria-label={roundWords(shown)}
          style={{ ...skinOf(theme, on), cursor: 'default' }}
        >
          {face}
        </span>
      </StatefulTooltip>
    );
  }

  const skin = skinOf(theme, on);

  if (!where?.at) {
    return (
      <span data-testid={`truck-${shown.truck}`} data-zone={shown.zone} role="img" aria-label={roundWords(shown)} style={skin}>
        {face}
      </span>
    );
  }

  return (
    <>
      {/* THE LABEL CARRIES THE ROUND; THE PICTURE CARRIES THE CREDIT (FEED-IA §247 ·
          LICENSES-AND-ATTRIBUTION.md). It held a credit of its own — first the literal
          «© OpenStreetMap contributors», then `MAP_CREDIT` — and both were a second attribution for a picture
          this chip merely OPENS. That picture is captioned, so under a configured key it is
          Google's ground with Google's own attribution inside it, and a chip naming OpenStreetMap
          beside it was one licence line written twice and already wrong. The chip says the round;
          the map's own caption says whose map it is. */}
      <StatefulTooltip
        content={roundWords(shown)}
        placement={TOOLTIP_PLACEMENT.top}
        showArrow
        overrides={OVER_THE_CHROME}
      >
        <button
          type="button"
          data-testid={`truck-${shown.truck}`}
          data-zone={shown.zone}
          data-door="round"
          aria-label={`${roundWords(shown)} · open the map`}
          onClick={(e) => {
            /* a chip inside a card that is itself a door owes the outer one nothing */
            e.stopPropagation();
            setOpen(true);
          }}
          style={{
            ...skin,
            ...floor,
            /* HOVER MAY NEVER CHANGE GEOMETRY (§37.3): the border is here at rest, in the ground's
               own colour, so becoming pressable costs the chip no pixels and moves no row. */
            border: `1px solid ${on ? theme.colors.backgroundTertiary : theme.colors.backgroundSecondary}`,
            font: 'inherit',
            ...theme.typography.LabelXSmall,
            cursor: 'pointer',
            /* IT SITS ON TOP OF THE CARD'S OWN DOOR, so it takes its own presses back. */
            position: 'relative',
            pointerEvents: 'auto',
          }}
        >
          {face}
        </button>
      </StatefulTooltip>

      <OverlayCard
        isOpen={open}
        onClose={() => setOpen(false)}
        scrim={SCRIM.dim}
        size={560}
        ariaLabel={roundWords(shown)}
      >
        <div
          data-testid="round-modal"
          data-moved={moved ? 'yes' : 'no'}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
        >
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{zone}</h2>
          <PinMap at={where.at} zone={zone} truck={shown.truck} note={where.name} height={order ? 220 : 320} />

          {/* ── THE HAND'S OWN ROW (THE CHECKPOINT §19.7) ─────────────────────────────────────
              The runs the house actually has, drawn as ground and as words, and pressing one puts
              THIS order on it. It appears only where the subject is an order: a customer's sheet
              opens the same card and gets the map alone, because a customer's standing run is not
              a thing one document may move. */}
          {order && (
            <div
              data-testid="round-override"
              style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
            >
              <span style={{ ...theme.typography.LabelSmall }}>Which run this order goes on</span>

              {/* THE GROUND IS THE PICKER (§19.2, §19.3 · §25.2's «grabbable»). The same choropleth
                  the zones seat draws, doing the same job: press the ground and the order moves to
                  that run. The rows under it are the keyboard's way to the identical act. */}
              <RoundMap
                zoneId={shown.zone}
                truck={shown.truck}
                notes={Object.fromEntries(company.zones.map((z) => [
                  z.id,
                  z.trucks.length === 1 ? `Truck ${z.trucks[0]}` : `Trucks ${z.trucks.join(' and ')}`,
                ]))}
                onPick={(id) => {
                  const band = company.zones.find((z) => z.id === id);
                  if (!band) return;
                  setRoundOverride(order.id, id, band.trucks[0]);
                }}
                testid="round-override-map"
              />

              <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap', minWidth: 0 }}>
                {company.zones.map((z) => {
                  const here = z.id === shown.zone;
                  return (
                    <Button
                      key={z.id}
                      kind={here ? KIND.primary : KIND.secondary}
                      size={SIZE.mini}
                      data-testid={`round-pick-${z.id}`}
                      data-on={here ? 'yes' : 'no'}
                      onClick={() => setRoundOverride(order.id, z.id, z.trucks[0])}
                    >
                      {zoneNameOf(z.id) ?? z.id} · {z.trucks.length === 1 ? `Truck ${z.trucks[0]}` : `Trucks ${z.trucks.join(' and ')}`}
                    </Button>
                  );
                })}
              </div>

              {/* WHAT A HAND DID, AND WHAT IT WOULD OTHERWISE BE — the reading, so a moved truck is
                  never a silent swap. Absent while nothing has been moved: a line saying «nobody has
                  changed this» would be a sentence spent on an absence. */}
              {moved && (
                <div
                  style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}
                >
                  <span
                    data-testid="round-moved"
                    style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
                  >
                    Moved by hand at {moved.at} · {standingZone} on truck {standing.truck} is this account’s own run.
                  </span>
                  <Button
                    kind={KIND.tertiary}
                    size={SIZE.mini}
                    data-testid="round-restore"
                    onClick={() => clearRoundOverride(order.id)}
                  >
                    Put it back
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </OverlayCard>
    </>
  );
}

export default TruckChip;
