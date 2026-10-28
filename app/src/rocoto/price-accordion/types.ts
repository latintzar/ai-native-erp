/* GROWN from Base Web's own `src/template-component/types.ts` — same `$`-prefixed shared style
 * props, same Overrides shape. Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
import type { Override } from 'baseui/helpers/overrides';
import type { LEVEL, VIEW } from './constants';

export type Level = (typeof LEVEL)[keyof typeof LEVEL];
export type View = (typeof VIEW)[keyof typeof VIEW];

/* ── THE FOUR LEVELS ──────────────────────────────────────────────────────────────────────────
 * One union, because an item sits at exactly one level and the level decides what its price IS.
 * The two axes of the fractal are visible in the shapes: level 2 grows HORIZONTALLY into tiers,
 * level 4 grows again VERTICALLY into a log of days.
 */

/** LEVEL 1 — one price, fixed. The whole structure is a value. */
export type FixedPrice = {
  level: 1;
  /** the price. `null` is an item waiting for its first price. */
  price: number | null;
  /** the price this one replaced, kept legible beside it */
  was?: number;
  /** when it was set — the whole of this level's chronology */
  since?: string;
};

/** One fixed tier: a band, a customer class, a tariff. */
export type PriceTier = {
  id: string;
  name: string;
  price: number;
  /** the price this tier replaced */
  was?: number;
};

/** LEVEL 2 — tiers, fixed. The row expands horizontally and stops there. */
export type TieredPrice = {
  level: 2;
  tiers: PriceTier[];
};

/** One stop on the ramp: a tier held at a percentage of the anchor. */
export type PriceStop = {
  id: string;
  name: string;
  /** percentage points from the anchor — the RELATIONSHIP, which is the thing being edited */
  offset: number;
  /** pinned to an absolute price: this stop stops following the anchor. Pinning every stop is
   *  how an item drifts out of level 3 and into level 4. */
  pinned?: boolean;
  /** the absolute price a pinned stop holds */
  price?: number;
};

/** LEVEL 3 — tiers that change daily holding a fixed relationship: an anchor, and offsets. */
export type AnchoredPrice = {
  level: 3;
  /** the centre. Moving it slides every unpinned stop with it, relationships intact. */
  anchor: number;
  /** what the centre is called */
  anchorName?: string;
  stops: PriceStop[];
  /** the ramp's ends, in price. Left off, they are derived from the anchor once and held. */
  min?: number;
  max?: number;
  /** the price granularity the ramp steps through */
  step?: number;
};

/** One entry in the log. Entries are APPENDED, never overwritten: an edit supersedes its
 *  predecessor and the predecessor stays readable underneath. */
export type PriceLogEntry = {
  id: string;
  /** the day this price was set for */
  day: string;
  tierId: string;
  price: number;
};

/** LEVEL 4 — tiers that change daily and are all discretionary. No percentage expresses it:
 *  a person decides what each tier is for that item that day. So it is a grid, and it has a log. */
export type DiscretionaryPrice = {
  level: 4;
  tiers: Array<{ id: string; name: string }>;
  /** days, TODAY FIRST. Today's row is editable; everything under it is the record. */
  days: string[];
  log: PriceLogEntry[];
};

/** An item's price structure — and, by its `level`, where in the fractal that item sits. */
export type PriceModel = FixedPrice | TieredPrice | AnchoredPrice | DiscretionaryPrice;

export type PriceAccordionOverrides = {
  Root?: Override;
  /** the collapsed row: the whole of the component when it is shut */
  Header?: Override;
  /** the glyph that draws the level's own shape */
  LevelMark?: Override;
  /** name and level line */
  HeaderText?: Override;
  Name?: Override;
  Note?: Override;
  /** the figure at the tail of the row */
  Trailing?: Override;
  ToggleIcon?: Override;
  /** the animated box the content grows inside */
  ContentAnimationContainer?: Override;
  Content?: Override;
  /** «3 tiers · Anchor and offsets», and the invariant beside it */
  CardHeader?: Override;
  /** level 2's horizontally scrolling tier chips */
  Chips?: Override;
  Chip?: Override;
  /** level 3's price ramp */
  Ramp?: Override;
  RampTrack?: Override;
  RampStop?: Override;
  RampAnchor?: Override;
  /** level 3's stop list: name · offset · price · pin */
  StopRow?: Override;
  /** level 4's grid of tiers by days */
  Grid?: Override;
  GridCell?: Override;
};

export type PriceAccordionProps = {
  /** the item this price belongs to */
  name: string;
  /** one more fact about the item, drawn after the level line */
  note?: string;
  /** the item's price structure. Controlled: the surface that owns the catalogue owns this. */
  price: PriceModel;
  /** every edit — a drag, a pin, a written cell — arrives here as a whole new structure.
   *  Left off, the component reads as a record and every editing affordance stands down. */
  onPriceChange?: (price: PriceModel) => void;
  /** open or shut. Left off, the component keeps its own. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** the level-3 stop under the hand. Controlled, so a drag can be shown as a state. */
  activeStopId?: string | null;
  onActiveStopChange?: (id: string | null) => void;
  /** the level-4 cell being written. Controlled, for the same reason. */
  editingTierId?: string | null;
  onEditingTierIdChange?: (id: string | null) => void;
  /** level 4 reads as its grid or as its chart */
  view?: View;
  onViewChange?: (view: View) => void;
  /** the record, open to read and shut to editing */
  readOnly?: boolean;
  /** inert: the row still states its price, and nothing responds */
  disabled?: boolean;
  /** «€/unit» — it shares the figure's line, always */
  unit?: string;
  /** decimal places on every price */
  decimals?: number;
  /** BCP 47 tag for grouping and the decimal comma */
  locale?: string;
  overrides?: PriceAccordionOverrides;
};

/* Base's own shape: `$`-prefixed, all optional, so a styled element can be lifted out of the
 * component and used on its own without inventing state it does not have. */
export type SharedStyleProps = {
  $level?: Level;
  $expanded?: boolean;
  $disabled?: boolean;
  $readOnly?: boolean;
};

export type RampStyleProps = {
  /** the stop under the hand, or today's row */
  $active?: boolean;
  /** locked to an absolute price, holding its own number instead of the anchor's */
  $pinned?: boolean;
  $disabled?: boolean;
  /** the record: it still reads, and no hand moves it */
  $readOnly?: boolean;
};
