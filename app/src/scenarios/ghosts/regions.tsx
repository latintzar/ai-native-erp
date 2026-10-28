/* THE NAMED GHOST REGIONS — BUILD-PLAN §5.2.
 *
 * LAW 4: EVERY GREY REGION CARRIES A POINTER OR THE WORD OPEN. NO ANONYMOUS GREY ANYWHERE.
 *
 * So a builder never chooses a grey and never chooses a pointer either: they write `<GLines />`
 * and get the day's order lines, ghosted, already annotated «lines →A1». Fifty-eight cards then
 * show the SAME honest skeleton instead of fifty-eight agents' improvised greys, and the web of
 * cross-references is drawn by construction rather than by discipline.
 *
 * Each region ships with the pointer the map gives it, and each accepts a retarget — `to` for a
 * card, `open` for an OPEN-n — because the same region genuinely points somewhere else on some
 * cards (`GDaylist` is the day's orders on A1 and the document inbox on B2). The retarget is one
 * prop; it is never a different grey.
 *
 * Hovering a region lights its chip in the meta strip, and hovering the chip lights the region.
 * Clicking a region navigates to the card that owns it — a row is a door.
 *
 * GHOST NEVER SETS `loading` (law 3). Architecture does not load.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import {
  GhostBlock,
  GhostList,
  GhostRow,
  GhostNav,
  GhostTabs,
  GhostHeader,
  GhostCard,
  GhostFigure,
} from '../../rocoto/ghost';
import { useRefLink } from '../shell/context';

/* ── THE POINTER ──────────────────────────────────────────────────────────────────────────── */

export type Pointer = {
  /** retarget at a card — «A1», «J1a», «chat» */
  to?: string;
  /** retarget at an open region — `4` renders «OPEN-4» */
  open?: number;
  /** override the whisper that names what stands here */
  label?: React.ReactNode;
};

type Resolved = { ref: string; text: string };

const resolve = (p: Pointer, fallback: Resolved): Resolved => {
  if (p.open !== undefined) return { ref: `OPEN-${p.open}`, text: `OPEN-${p.open}` };
  if (p.to) return { ref: p.to, text: p.to };
  return fallback;
};

/* ── THE REGION WRAPPER ───────────────────────────────────────────────────────────────────── */

/** Wraps a ghost so the region itself is a door and a highlight target. The ghost inside stays
 *  inert; the wrapper carries the hand. */
const Region: React.FC<{
  pointer: Resolved;
  children: React.ReactNode;
  grow?: boolean;
  style?: React.CSSProperties;
}> = ({ pointer, children, grow, style }) => {
  const [, theme] = useStyletron();
  const { lit, handlers } = useRefLink(pointer.ref);
  const go = () => {
    window.location.hash = pointer.ref.startsWith('OPEN-')
      ? `#/open/${pointer.ref.slice(5)}`
      : `#/${pointer.ref}`;
  };
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`decided in ${pointer.text}`}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      }}
      {...handlers}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: theme.borders.radius200,
        outline: lit ? `2px solid ${theme.colors.contentPrimary}` : '2px solid transparent',
        outlineOffset: '2px',
        transition: `outline-color ${theme.animation.timing200} ${theme.animation.easeOutCurve}`,
        ...(grow ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ── THE FIFTEEN ──────────────────────────────────────────────────────────────────────────────
 * MAP §2's roll, each with the pointer the map gives it. GSheet's pointer changed: the map wrote
 * it OPEN-4 and F0 now owns it (C-10). */

/** The product's own rail. Group K decides which destinations exist at all. */
export const GNav: React.FC<Pointer & { items?: number; selected?: number; variant?: 'side' | 'bottom' }> = ({
  items = 5, selected = 0, variant = 'side', ...p
}) => {
  const ptr = resolve(p, { ref: 'K', text: 'K' });
  return (
    <Region pointer={ptr}>
      <GhostNav variant={variant} items={items} selected={selected} label={p.label ?? 'the rail'} reference={ptr.text} />
    </Region>
  );
};

/** The bar above the day's list: the date, the day's aggregate, the filters. */
export const GDaybar: React.FC<Pointer> = (p) => {
  const ptr = resolve(p, { ref: 'OPEN-1', text: 'OPEN-1' });
  return (
    <Region pointer={ptr}>
      <GhostHeader subtitle actions={3} divider label={p.label ?? "the day's bar"} reference={ptr.text} />
    </Region>
  );
};

/** The day's orders, one row each, with the one this card is standing on selected. */
export const GDaylist: React.FC<Pointer & { rows?: number; selected?: number }> = ({
  rows = 9, selected = 2, ...p
}) => {
  const ptr = resolve(p, { ref: 'OPEN-1', text: 'OPEN-1' });
  return (
    <Region pointer={ptr} grow>
      <GhostList
        rows={rows}
        selected={selected}
        divider
        leading="avatar"
        trailing="figure"
        lines={2}
        label={p.label ?? "the day's orders"}
        reference={ptr.text}
      />
    </Region>
  );
};

/** Tabs on a surface. THE ONLY REGION WITH NO DEFAULT POINTER — a tab set belongs to whichever
 *  surface carries it, so the card must say where it is decided. The prop is required, which is
 *  law 4 enforced by the type system rather than by review. */
export const GTabs: React.FC<(Required<Pick<Pointer, 'to'>> | Required<Pick<Pointer, 'open'>>) & Pointer & { tabs?: number; selected?: number }> = ({
  tabs = 4, selected = 0, ...p
}) => {
  const ptr = resolve(p, { ref: 'OPEN-18', text: 'OPEN-18' });
  return (
    <Region pointer={ptr}>
      <GhostTabs tabs={tabs} selected={selected} label={p.label ?? 'tabs'} reference={ptr.text} />
    </Region>
  );
};

/** The conversation. The one SETTLED surface in the product, so it reads at HIGHER CONFIDENCE than
 *  an undecided region — and confidence is drawn as STRUCTURE, never as a darker grey: real rows,
 *  hairlines between them, an identity on each, two lines of words. A darker wash would say «this
 *  matters more»; the extra structure says «this one is already decided», which is the true claim. */
export const GThread: React.FC<Pointer & { rows?: number }> = ({ rows = 6, ...p }) => {
  const ptr = resolve(p, { ref: 'chat', text: 'chat' });
  return (
    <Region pointer={ptr} grow>
      <GhostList
        rows={rows}
        divider
        leading="avatar"
        lines={2}
        size="compact"
        label={p.label ?? 'the thread'}
        reference={ptr.text}
      />
    </Region>
  );
};

/** The composer at the foot of the thread. Settled, like the thread it belongs to. */
export const GComposer: React.FC<Pointer> = (p) => {
  const ptr = resolve(p, { ref: 'chat', text: 'chat' });
  return (
    <Region pointer={ptr}>
      <GhostRow leading="square" trailing="control" lines={1} label={p.label ?? 'the composer'} reference={ptr.text} />
    </Region>
  );
};

/** The order's lines, as the order card holds them. A1 owns the anatomy. */
export const GLines: React.FC<Pointer & { rows?: number }> = ({ rows = 4, ...p }) => {
  const ptr = resolve(p, { ref: 'A1', text: 'A1' });
  return (
    <Region pointer={ptr}>
      <GhostList rows={rows} divider lines={2} trailing="figure" label={p.label ?? 'the lines'} reference={ptr.text} />
    </Region>
  );
};

/** Everything the software knows about this customer, as a drawer beside the surface. */
export const GDossier: React.FC<Pointer & { blocks?: number }> = ({ blocks = 5, ...p }) => {
  const ptr = resolve(p, { ref: 'J1a', text: 'J1a' });
  return (
    <Region pointer={ptr} grow>
      <GhostList rows={blocks} divider lines={2} leading="none" label={p.label ?? 'the dossier'} reference={ptr.text} />
    </Region>
  );
};

/** Products, units, classes, calibres, origins, and the tree they hang on. */
export const GCatalogue: React.FC<Pointer & { rows?: number }> = ({ rows = 8, ...p }) => {
  const ptr = resolve(p, { ref: 'OPEN-2', text: 'OPEN-2' });
  return (
    <Region pointer={ptr} grow>
      <GhostList rows={rows} divider lines={1} leading="square" label={p.label ?? 'the catalogue'} reference={ptr.text} />
    </Region>
  );
};

/** The tier columns, wherever a price surface implies them. */
export const GTiers: React.FC<Pointer & { rows?: number }> = ({ rows = 4, ...p }) => {
  const ptr = resolve(p, { ref: 'C1', text: 'C1 · C4' });
  return (
    <Region pointer={ptr}>
      <GhostList rows={rows} divider lines={1} trailing="figure" size="compact" label={p.label ?? 'the tiers'} reference={ptr.text} />
    </Region>
  );
};

/** Where captured documents and batches live between capture and use. */
export const GBatchbook: React.FC<Pointer & { rows?: number }> = ({ rows = 6, ...p }) => {
  const ptr = resolve(p, { ref: 'OPEN-5', text: 'OPEN-5' });
  return (
    <Region pointer={ptr} grow>
      <GhostList rows={rows} divider lines={2} trailing="figure" label={p.label ?? 'the batch ledger'} reference={ptr.text} />
    </Region>
  );
};

/** The round, and whoever put the stops in that order. */
export const GRoute: React.FC<Pointer & { rows?: number }> = ({ rows = 7, ...p }) => {
  const ptr = resolve(p, { ref: 'OPEN-17', text: 'OPEN-17' });
  return (
    <Region pointer={ptr} grow>
      <GhostList rows={rows} divider lines={1} leading="square" label={p.label ?? 'the route'} reference={ptr.text} />
    </Region>
  );
};

/** The day's picking sheet. F0 owns it now (C-10); the map wrote it OPEN-4. */
export const GSheet: React.FC<Pointer> = (p) => {
  const ptr = resolve(p, { ref: 'F0', text: 'F0' });
  return (
    <Region pointer={ptr}>
      <GhostCard media={false} lines={5} action={false} label={p.label ?? 'the picking sheet'} reference={ptr.text} />
    </Region>
  );
};

/** The file that goes to the accounting system, and the proof it arrived. */
export const GErpfile: React.FC<Pointer> = (p) => {
  const ptr = resolve(p, { ref: 'G2', text: 'G2' });
  return (
    <Region pointer={ptr}>
      <GhostRow leading="square" trailing="figure" lines={2} label={p.label ?? "today's file"} reference={ptr.text} />
    </Region>
  );
};

/** A total nobody on this card is deciding. The figure lockup, ghosted. */
export const GTotals: React.FC<Pointer & { digits?: number; unit?: boolean }> = ({
  digits = 5, unit = true, ...p
}) => {
  const ptr = resolve(p, { ref: 'A1', text: 'A1' });
  return (
    <Region pointer={ptr} style={{ display: 'inline-block' }}>
      <GhostFigure digits={digits} unit={unit} size="large" label={p.label ?? 'the total'} reference={ptr.text} />
    </Region>
  );
};

/* ── THE ESCAPE HATCH ─────────────────────────────────────────────────────────────────────────
 * A region MAP never named. It still cannot be anonymous: the pointer is required, so the only
 * way to draw a new grey is to say who owns it. */
export const GRegion: React.FC<
  (Required<Pick<Pointer, 'to'>> | Required<Pick<Pointer, 'open'>>) &
  Pointer & { height?: string | number; width?: string | number; shape?: 'block' | 'line' | 'square' | 'circle' | 'pill'; children?: React.ReactNode }
> = ({ height, width, shape = 'block', children, ...p }) => {
  const ptr = resolve(p, { ref: 'OPEN-18', text: 'OPEN-18' });
  return (
    <Region pointer={ptr} grow>
      <GhostBlock shape={shape} height={height} width={width} label={p.label} reference={ptr.text}>
        {children}
      </GhostBlock>
    </Region>
  );
};
