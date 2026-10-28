/* THE ARITHMETIC OF THE FRACTAL — pure functions, exported.
 *
 * The rule a price structure keeps has to be readable and testable without a browser, and the
 * component's own copy quotes these back to the person. Same doctrine as `moveLinked` in el
 * candado: the invariant is a function, not a gesture buried in a pointer handler.
 */
import { PRICE_STEP, RAMP_CEILING, RAMP_FLOOR } from './constants';
import type { AnchoredPrice, DiscretionaryPrice, PriceLogEntry, PriceModel, PriceStop } from './types';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const round = (value: number, step: number) => Math.round(value / step) * step;

/* ── LEVEL 3: the anchor and its stops ────────────────────────────────────────────────────── */

/** What a stop costs. A pinned stop holds its own absolute price; every other stop is the anchor
 *  wearing its offset, which is why moving the anchor moves them all. */
export const stopPrice = (stop: PriceStop, anchor: number): number =>
  stop.pinned && stop.price != null ? stop.price : anchor * (1 + stop.offset / 100);

/** What a stop's offset READS as. For a pinned stop it is derived from the price it is holding,
 *  so the number drifts while the anchor moves under it — that drift IS level 4 arriving, and it
 *  is meant to be watched. */
export const stopOffset = (stop: PriceStop, anchor: number): number =>
  stop.pinned && stop.price != null && anchor !== 0 ? (stop.price / anchor - 1) * 100 : stop.offset;

/** The ramp's ends. Named in the model, or derived from the anchor once — the caller holds the
 *  derived pair still afterwards, because a ramp whose ends chase the anchor never appears to move. */
export const rampBounds = (price: AnchoredPrice): { min: number; max: number } => ({
  min: price.min ?? round(price.anchor * RAMP_FLOOR, PRICE_STEP),
  max: price.max ?? round(price.anchor * RAMP_CEILING, PRICE_STEP),
});

/** The spread the set holds: the lowest and the highest offset in it. Drag the anchor and this
 *  pair does not move — that is the whole claim of level 3, printed where it can be checked. */
export const spreadOf = (price: AnchoredPrice): { low: number; high: number } => {
  if (!price.stops.length) return { low: 0, high: 0 };
  const offsets = price.stops.map((s) => stopOffset(s, price.anchor));
  return { low: Math.min(...offsets), high: Math.max(...offsets) };
};

/** Move ONE stop to a price. Pinned, it takes the price outright; unpinned, the price is written
 *  back as the relationship it implies, because the relationship is what level 3 stores. */
export function moveStop(
  price: AnchoredPrice,
  stopId: string,
  nextPrice: number,
  bounds: { min: number; max: number },
): AnchoredPrice {
  const step = price.step ?? PRICE_STEP;
  const target = round(clamp(nextPrice, bounds.min, bounds.max), step);
  return {
    ...price,
    stops: price.stops.map((stop) => {
      if (stop.id !== stopId) return stop;
      if (stop.pinned) return { ...stop, price: target };
      if (price.anchor === 0) return stop;
      return { ...stop, offset: round((target / price.anchor - 1) * 100, 0.1) };
    }),
  };
}

/** Move the ANCHOR, and the whole set slides with it — every relationship preserved.
 *
 * THE CLAMP IS PART OF THE INVARIANT (el candado's rule, and for the same reason): a move that
 * would push any following stop off the ramp is shortened to what the set can take, so the
 * constellation never flattens against an end. Pinned stops stay exactly where they are, which
 * is what pinning means, and their offsets re-read themselves as the anchor passes.
 */
export function moveAnchor(
  price: AnchoredPrice,
  nextAnchor: number,
  bounds: { min: number; max: number },
): AnchoredPrice {
  const step = price.step ?? PRICE_STEP;
  const following = price.stops.filter((s) => !s.pinned);
  let anchor = clamp(nextAnchor, bounds.min, bounds.max);

  for (const stop of following) {
    const factor = 1 + stop.offset / 100;
    if (factor <= 0) continue;
    anchor = clamp(anchor, bounds.min / factor, bounds.max / factor);
  }
  return { ...price, anchor: round(anchor, step) };
}

/** Pin or release a stop.
 *
 * Pinning freezes the price the stop is showing right now, so nothing jumps under the hand.
 * Releasing keeps that same price and writes it back as an offset, so nothing jumps on the way
 * out either. The only thing that changes either way is WHO decides the number: the anchor, or
 * the person. */
export function setStopPinned(price: AnchoredPrice, stopId: string, pinned: boolean): AnchoredPrice {
  return {
    ...price,
    stops: price.stops.map((stop) => {
      if (stop.id !== stopId) return stop;
      const at = stopPrice(stop, price.anchor);
      if (pinned) return { ...stop, pinned: true, price: at };
      if (price.anchor === 0) return { ...stop, pinned: false, price: undefined };
      return { ...stop, pinned: false, price: undefined, offset: round((at / price.anchor - 1) * 100, 0.1) };
    }),
  };
}

/** Every stop pinned: the anchor carries nothing, and each tier holds its own number. The item is
 *  behaving as a level 4 while still being stored as a level 3, and the surface says so. */
export const isFullyPinned = (price: AnchoredPrice): boolean =>
  price.stops.length > 0 && price.stops.every((s) => s.pinned);

/* ── LEVEL 4: the log ─────────────────────────────────────────────────────────────────────── */

/** Every entry written for one tier on one day, oldest first. More than one means somebody
 *  changed their mind, and both numbers stay. */
export const cellEntries = (price: DiscretionaryPrice, day: string, tierId: string): PriceLogEntry[] =>
  price.log.filter((e) => e.day === day && e.tierId === tierId);

/** What that cell says now, and what it said before — the pair the Figure draws. */
export function cellValue(
  price: DiscretionaryPrice,
  day: string,
  tierId: string,
): { value: number | null; was?: number } {
  const entries = cellEntries(price, day, tierId);
  if (!entries.length) return { value: null };
  return {
    value: entries[entries.length - 1].price,
    was: entries.length > 1 ? entries[entries.length - 2].price : undefined,
  };
}

/** Write a price. It APPENDS — the supersede idea, held in the data and not just in the drawing:
 *  the number it replaces is still in the log, so the row can keep showing it struck through. */
export function writeCell(
  price: DiscretionaryPrice,
  day: string,
  tierId: string,
  next: number,
): DiscretionaryPrice {
  const seq = price.log.filter((e) => e.day === day && e.tierId === tierId).length;
  const entry: PriceLogEntry = { id: `${day}:${tierId}:${seq}`, day, tierId, price: next };
  return { ...price, log: [...price.log, entry] };
}

/** The prices standing today, in the tiers' own order. */
export const todayPrices = (price: DiscretionaryPrice): number[] =>
  price.days.length
    ? price.tiers
        .map((t) => cellValue(price, price.days[0], t.id).value)
        .filter((v): v is number => v != null)
    : [];

/* ── THE ROW ──────────────────────────────────────────────────────────────────────────────── */

/** The one or two numbers the collapsed row carries. One fact per row is the Monzo law, so a set
 *  of tiers states its span and a single price states itself. */
export function headline(price: PriceModel): { value: number | null; was?: number; high?: number } {
  switch (price.level) {
    case 1:
      return { value: price.price, was: price.was };
    case 2: {
      if (!price.tiers.length) return { value: null };
      const values = price.tiers.map((t) => t.price);
      const low = Math.min(...values);
      const high = Math.max(...values);
      if (low === high) return { value: low, was: price.tiers.length === 1 ? price.tiers[0].was : undefined };
      return { value: low, high };
    }
    case 3:
      return { value: price.anchor };
    case 4: {
      const values = todayPrices(price);
      if (!values.length) return { value: null };
      const low = Math.min(...values);
      const high = Math.max(...values);
      if (low === high) {
        const only = price.tiers.length === 1 ? cellValue(price, price.days[0], price.tiers[0].id) : null;
        return { value: low, was: only?.was };
      }
      return { value: low, high };
    }
  }
}

/** How many tiers this level has. Level 1 has one price and no tiers, and says so. */
export const tierCount = (price: PriceModel): number => {
  switch (price.level) {
    case 1:
      return 1;
    case 2:
      return price.tiers.length;
    case 3:
      return price.stops.length;
    case 4:
      return price.tiers.length;
  }
};
