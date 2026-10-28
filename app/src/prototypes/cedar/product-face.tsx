/* THE FACE OF THE GOODS — one seat, one walk, every surface (THE-DENSE-BRIEF §B/§C, §33.2).
 *
 * ═══ THIS FILE IS A SEAM BEING CLOSED ════════════════════════════════════════════════════════
 * `detail.tsx` said it out loud: «It is the same walk Stock's own `iconOf` makes; that file belongs
 * to another package and this one may not edit it, so the walk is written twice… The duplicate is
 * the seam between two packages, and it is named here so it can be collapsed the day one of them
 * owns both.» This session owns both, and `stock-tiers.tsx` had grown a third copy. So the walk,
 * the tile and the painted face live here, and the three surfaces read them.
 *
 * The consequence is the one §30 asks for: ONE VOCABULARY. A merluza wears the same face on a river
 * row, on a line of the document, on a Stock card, on a tarifa row and inside a chat embed — which
 * is what makes the picture language rather than decoration.
 *
 * ═══ AN EXACT SKU NEVER BORROWS A SIBLING'S FACE ═══════════════════════════════════════════
 * `ProductFace` and the product sheet resolve approved SKU artwork first, then a deliberate exact
 * library binding, then the drawn mark. Only the generic parser `Face` uses `paintingFor` to make
 * an unresolved catalogue suggestion readable. A SKU therefore never receives a related family's
 * picture as a stand-in; its honest no-art state remains the mark on the same fixed-size seat.
 *
 * ═══ THE RECORD STAYS QUIETER THAN THE WORK, IN COLOUR AS IN INK ════════════════════════════
 * `muted` desaturates the picture the same step a closed row's ink steps back, so a day's record
 * reads as texture and the open work keeps the colour. It is a filter rather than paint, so it
 * re-themes with the asset instead of against it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { ProduceIcon, type Family as IconFamily } from '../../rocoto/produce-icons';
import type { SectorId } from '../../scenarios/meta';
import { paintingFor, exactPaintingFor } from './painting-map';
import { useApprovedSKUArtwork } from './sku-artwork';
import { useConfig } from './config';
import { skuRecord, useSKURecords } from './sku-record';

export type { IconFamily };

/* ── THE DRAWN MARK (THE-INTELLIGENCE §7) ─────────────────────────────────────────────────────
 * «A set of custom icons for every kind of fruit, every kind of fish… the point is they feel that
 * we understand what it is they're selling.» The resolution walks specific → general and cannot
 * end empty: a word nothing claims is still goods, and goods have a family.
 */

type Mark = { family: IconFamily; species?: string; form?: string };

export function produceMarkOf(name: string): Mark {
  const n = name.toLowerCase();
  if (n.includes('merluza')) return { family: 'fish', species: 'merluza' };
  if (n.includes('lubina')) return { family: 'fish', species: 'lubina' };
  if (n.includes('rape')) return { family: 'fish', species: 'rape' };
  if (n.includes('sepia') || n.includes('pulpo')) return { family: 'shellfish', species: 'pulpo' };
  if (n.includes('gamba')) return { family: 'shellfish', species: 'gamba-roja' };
  if (n.includes('alitas')) return { family: 'poultry', species: 'pollo', form: 'wings' };
  if (n.includes('pollo')) return { family: 'poultry', species: 'pollo' };
  if (n.includes('lomo')) return { family: 'meat', species: 'lomo-cerdo' };
  if (n.includes('chulet')) return { family: 'meat', species: 'chuleton' };
  if (n.includes('canal') || n.includes('panceta')) return { family: 'meat', form: 'chunk' };
  if (n.includes('chorizo') || n.includes('jam')) return { family: 'meat' };
  if (n.includes('tomate')) return { family: 'vegetable', species: 'tomate' };
  if (n.includes('pimiento') || n.includes('cebolla') || n.includes('patata')) return { family: 'vegetable' };
  if (n.includes('perejil')) return { family: 'vegetable', form: 'bunch' };
  if (n.includes('aguacate')) return { family: 'fruit', species: 'aguacate' };
  if (n.includes('mango')) return { family: 'fruit', species: 'mango' };
  if (n.includes('caja') || n.includes('bulto')) return { family: 'dry' };
  return { family: 'dry' };
}

/** The family a sector's goods belong to — the mark that stands while the words resolve. */
export const familyMarkOf = (sector: SectorId): IconFamily =>
  sector === 'fish' ? 'fish' : sector === 'meat' ? 'meat' : 'fruit';

/** The goods, drawn. Decorative beside the name it depicts, so a screen reader is not made to say
 *  «merluza» twice. */
export function Produce({
  of,
  size = 'compact',
  mono = false,
}: {
  of: { name: string; id?: string; sector?: string };
  size?: 'mini' | 'compact' | 'default' | 'large';
  mono?: boolean;
}) {
  const { family, species, form } = produceMarkOf(of.name);
  return <ProduceIcon family={family} species={species} form={form as never} size={size} mono={mono} />;
}

/** THE SEAT ITSELF. Every face in this app is this box: one size, one corner, one quiet ground,
 *  and whatever resolved inside it on `contain`. Nothing that goes in it may change its size. */
function Seat({
  size,
  painted,
  children,
}: {
  size: number;
  painted: boolean;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <span
      aria-hidden="true"
      data-face={painted ? 'painting' : 'mark'}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        flex: '0 0 auto',
        borderRadius: theme.borders.radius200,
        /* THE GROUND COMES OFF WHERE A PAINTING IS DRAWN, because the painting carries its own
           white and a tinted square behind it reads as a sticker rather than as the goods. */
        background: painted ? undefined : theme.colors.backgroundSecondary,
        overflow: 'hidden',
      }}
    >
      {children}
    </span>
  );
}

/** The painting itself, at the seat's size. */
function Painted({ src, size, muted }: { src: string; size: number; muted: boolean }) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      /* SIX HUNDRED ROWS OF PAINTING IS A DECODE BUDGET, not a picture. Lazy keeps the ones nobody
         has scrolled to off the wire; async decoding keeps the ones arriving off the scroll's own
         frame. */
      loading="lazy"
      decoding="async"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
        /* theme-gate-allow: a filter is not paint — it takes whatever the brand's own picture is
           and desaturates it, so it re-themes with the asset rather than against it. */
        filter: muted ? 'grayscale(1)' : undefined,
        opacity: muted ? 0.62 : 1,
      }}
    />
  );
}

/**
 * THE PRODUCT'S FACE — the one component every surface calls.
 *
 * Hand it the goods and it draws the painting the library has for them, or the family's own mark
 * where the library has none. It is the row's face, the card's face and the tarifa's face, which
 * is the whole reason it is one function.
 */
export type ProductFaceProps = {
  /** the goods — only the name is read, because the name is what the library is keyed by */
  of: { name: string; id?: string; sector?: string };
  /** the seat's edge in px. The seat never changes size for what lands in it. */
  size?: number;
  /** the record steps back, in colour as in ink — a closed row's face, never a catalogue's */
  muted?: boolean;
};

export function ProductFace({ of, size = 36, muted = false }: ProductFaceProps) {
  const { config } = useConfig();
  const records = useSKURecords();
  const sector = of.sector ?? config.cast;
  const original = of.id ? skuRecord(sector, of.id, records)?.original.name : undefined;
  const approved = useApprovedSKUArtwork(sector, of.id);
  const painted = approved ?? exactPaintingFor(original ?? of.name);
  return (
    <Seat size={size} painted={Boolean(painted)}>
      {painted ? (
        <Painted src={painted} size={size} muted={muted} />
      ) : (
        <Produce of={of} size={size >= 36 ? 'compact' : 'mini'} />
      )}
    </Seat>
  );
}

/** The drawn mark on its seat, with no painting ever tried — for the places whose whole subject is
 *  the icon vocabulary itself. */
export function ProduceTile({ of, size = 36 }: { of: { name: string; id?: string; sector?: string }; size?: number }) {
  return (
    <Seat size={size} painted={false}>
      <Produce of={of} size={size >= 36 ? 'compact' : 'mini'} />
    </Seat>
  );
}

/**
 * THE RESOLVING FACE (§10's «the icons adapt»).
 *
 * The writing line's own seat: while the words support no kind yet the FAMILY's mark stands, and
 * the moment a kind resolves the painting takes its place. At no moment does a wrong specific
 * painting stand in for an ambiguous one, because ambiguity is a first-class state of the tree and
 * the honest drawing of it is the family silhouette.
 */
export function Face({
  name,
  family,
  size = 36,
}: {
  /** the resolved name — null while the words support no kind yet */
  name: string | null;
  /** the family's own mark, which is what stands while nothing is resolved */
  family: IconFamily;
  size?: number;
}) {
  const painting = name ? paintingFor(name) : null;
  return (
    <Seat size={size} painted={Boolean(painting)}>
      {painting ? (
        <Painted src={painting} size={size} muted={false} />
      ) : (
        <ProduceIcon family={family} size={size >= 36 ? 'compact' : 'mini'} />
      )}
    </Seat>
  );
}
