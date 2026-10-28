/* THE RAIL — the canonical screen behind group K, and the one place the sector thesis is visible
 * at a glance.
 *
 * Brief §6, stated as machinery: when a dimension is configured off, the corresponding part of the
 * product DOES NOT EXIST. It is not disabled and it is not greyed out. «A menu containing entries
 * a company will never use is a monthly reminder that they are paying for something they do not
 * use.»
 *
 * So the rail is a FUNCTION OF THE CONFIGURATION, and this file is that function. Flip a
 * dimension and a destination LEAVES THE RAIL ENTIRELY — nothing greys, nothing disables, nothing
 * moves aside to make room for an upsell. `deriveRail` is the whole argument, and it is fifteen
 * lines long.
 *
 * DESTINATION NAMES. English, per C-1, with one exception that is not an exception: `Lotes` stays
 * Spanish because *lote* is the trade's own noun and a term, never a translation. That is also
 * exactly the word brief §6 says disappears when every family records nothing.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Navigation } from 'baseui/side-navigation';
import type { TraceProfile } from '../data/cast';

/* ── THE CONFIGURATION ────────────────────────────────────────────────────────────────────── */

export type RailConfig = {
  /** D8 — how the selling price is arrived at */
  d8: 'none' | 'list' | 'margin' | 'negotiated';
  /** D11 — how stock is recorded */
  d11: 'none' | 'supplier-doc' | 'declared' | 'published';
  /** D12, per FAMILY (C-2). Every profile `none` is the account where the word «lote» is absent. */
  families: TraceProfile[];
  /** D16 — when the albarán is sent */
  d16: 'on-confirm' | 'on-delivery';
};

export type Destination = {
  id: string;
  title: string;
  /** the configuration that put this destination on the rail */
  because: string;
  /** the card that decides what stands behind it */
  decidedIn: string;
};

/* ── THE FUNCTION ─────────────────────────────────────────────────────────────────────────────
 * Read it as the card's argument. There is no `disabled` anywhere in it, and there is no branch
 * that keeps a destination and dims it — the only two outcomes are «on the rail» and «absent». */

export function deriveRail(config: RailConfig): Destination[] {
  const rail: Destination[] = [
    { id: 'orders', title: 'Orders', because: 'every account', decidedIn: 'A1' },
  ];
  if (config.d11 === 'published') {
    rail.push({ id: 'available', title: 'Available', because: 'D11.published', decidedIn: 'D2s' });
  }
  if (config.families.some((f) => f !== 'none')) {
    rail.push({ id: 'lotes', title: 'Lotes', because: 'a family records a lote', decidedIn: 'E3' });
  }
  if (config.d8 !== 'none') {
    rail.push({ id: 'prices', title: 'Prices', because: `D8.${config.d8}`, decidedIn: 'C3' });
  }
  if (config.d16 === 'on-delivery') {
    rail.push({ id: 'delivery', title: 'Delivery', because: 'D16.on-delivery', decidedIn: 'I5' });
  }
  return rail;
}

/** What the configuration REMOVED, for the card that is about absence to be able to state it in
 *  one line — beside the rail, never inside it. Nothing on the rail says what is missing; that is
 *  the whole point of the card. */
export function absentFrom(config: RailConfig): Destination[] {
  const present = new Set(deriveRail(config).map((d) => d.id));
  const all: Destination[] = [
    { id: 'available', title: 'Available', because: 'D11.published', decidedIn: 'D2s' },
    { id: 'lotes', title: 'Lotes', because: 'a family records a lote', decidedIn: 'E3' },
    { id: 'prices', title: 'Prices', because: 'D8', decidedIn: 'C3' },
    { id: 'delivery', title: 'Delivery', because: 'D16.on-delivery', decidedIn: 'I5' },
  ];
  return all.filter((d) => !present.has(d.id));
}

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type RailProps = {
  config: RailConfig;
  /** which destination the surface is standing on */
  active?: string;
  /** the account's own name for itself, above the rail */
  title?: React.ReactNode;
  onSelect?: (id: string) => void;
};

export default function Rail({ config, active = 'orders', title, onSelect }: RailProps) {
  const [, theme] = useStyletron();
  const destinations = deriveRail(config);

  return (
    <nav
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        padding: `${theme.sizing.scale500} 0`,
        minWidth: 0,
      }}
    >
      {title && (
        <div
          style={{
            ...theme.typography.LabelSmall,
            color: theme.colors.contentSecondary,
            padding: `0 ${theme.sizing.scale600} ${theme.sizing.scale400}`,
          }}
        >
          {title}
        </div>
      )}
      <Navigation
        items={destinations.map((d) => ({ title: d.title, itemId: `#${d.id}` }))}
        activeItemId={`#${active}`}
        onChange={({ item, event }) => {
          event.preventDefault();
          if (onSelect) onSelect(String(item.itemId).replace('#', ''));
        }}
      />
    </nav>
  );
}
