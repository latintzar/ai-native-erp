/* THE OPEN ITEMS — albaranes opened in full, and the strip you flip between them with.
 *
 * ═══ WHAT THE FOUNDER ASKED FOR (THE-APP-V2 §5.3) ═══════════════════════════════════════════
 * «Flipping between albaranes they opened in full easily — maybe they all appear in a sidebar.»
 * So opening a document in full does not replace the last one: it JOINS it. The open set is a
 * compact strip of chips — customer and figure, an X to close one — across the top of the detail,
 * and a click flips the desk to that document. The list yields while they are open; closing the
 * last chip gives the list back.
 *
 * ═══ WHO OWNS WHAT ═════════════════════════════════════════════════════════════════════════
 * V2-CORE owns this state, this strip, and the layout it drives. V2-SALES owns what a detail
 * looks like. So the strip renders in the FRAME, above whatever the area is drawing, and Sales
 * reads `useOpenItems()` for which sale to show. Neither package has to edit the other's files.
 *
 * NO PROVIDER TO MOUNT, THE SAME DECISION AS `rules.ts`: the state is a module singleton published
 * through `useSyncExternalStore`, so a surface written by another package calls `useOpenItems()`
 * and re-renders on every write with no wrapper above it. `OpenItemsProvider` exists for a subtree
 * that wants an explicit seam — it publishes exactly the same state, so both paths agree.
 *
 * A CHIP KNOWS AS LITTLE AS IT NEEDS TO. `open({ id })` is enough: the strip resolves the
 * customer and the figure from the same sale ledger the feed folds, so a caller never has to
 * assemble a chip and the chip can never quote a stale total.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Figure } from '../figure';
import { useConfig } from '../config';
import { useDay } from '../day';
import { useGrants } from '../grants';
import { buildSales } from '../sale';

/* ── THE OBJECT ───────────────────────────────────────────────────────────────────────────── */

/** One document open in full. Everything but the id is optional, because the strip can read the
 *  rest off the ledger — a caller that already holds the sale may pass them to save the lookup. */
export type OpenItem = {
  /** the Sale's own id — the key Sales already opens on */
  id: string;
  /** the chip's word */
  customer?: string;
  /** the chip's figure */
  figure?: number;
  /** the figure's unit, on the figure's own line. Money by default. */
  unit?: string;
  /** the albarán's number, once the document exists */
  number?: string;
  /** the chat thread this sale is about, so «see the chat AND the albarán» knows which chat */
  threadId?: string;
};

export type OpenItemsState = {
  /** every open document, in the order they were opened */
  items: OpenItem[];
  /** the one showing */
  currentId: string | null;
  current: OpenItem | null;
  count: number;
  isOpen: (id: string) => boolean;
  /** open one, or focus it when it is already open. An id alone is a valid item. */
  open: (item: OpenItem | string) => void;
  /** show one that is already open */
  flip: (id: string) => void;
  /** close one. The strip focuses a neighbour; closing the last one gives the list back. */
  close: (id: string) => void;
  closeAll: () => void;
  /** the neighbours, for the strip's arrows and the keyboard */
  next: () => void;
  prev: () => void;
};

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────── */

type Snapshot = { items: OpenItem[]; currentId: string | null };

const EMPTY: Snapshot = { items: [], currentId: null };

let state: Snapshot = EMPTY;

const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const snapshot = (): Snapshot => state;

function publish(next: Snapshot): void {
  state = next;
  for (const fn of listeners) fn();
}

/** Open a document in full, or focus one that already is. Re-opening refreshes its facts, so a
 *  chip follows the sale it names as the sale changes. */
export function openItem(item: OpenItem | string): void {
  const next: OpenItem = typeof item === 'string' ? { id: item } : item;
  const items = state.items.some((i) => i.id === next.id)
    ? state.items.map((i) => (i.id === next.id ? { ...i, ...next } : i))
    : [...state.items, next];
  publish({ items, currentId: next.id });
}

export function flipTo(id: string): void {
  if (!state.items.some((i) => i.id === id)) return;
  publish({ ...state, currentId: id });
}

/** Close one. The focus lands on the chip that took its place, or on the one before it — the
 *  document you were reading is gone, so the next one is already open rather than a blank. */
export function closeItem(id: string): void {
  const at = state.items.findIndex((i) => i.id === id);
  if (at < 0) return;
  const items = state.items.filter((i) => i.id !== id);
  const currentId =
    state.currentId !== id
      ? state.currentId
      : items.length === 0
        ? null
        : items[Math.min(at, items.length - 1)].id;
  publish({ items, currentId });
}

export function closeAllItems(): void {
  publish(EMPTY);
}

/** Where the strip is right now, for a caller outside React. */
export const openItemsSnapshot = (): Snapshot => state;

/* ── THE HOOK ─────────────────────────────────────────────────────────────────────────────── */

function useLive(): OpenItemsState {
  const s = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  return React.useMemo<OpenItemsState>(() => {
    const step = (by: number) => {
      if (s.items.length < 2) return;
      const at = s.items.findIndex((i) => i.id === s.currentId);
      const to = (at + by + s.items.length) % s.items.length;
      flipTo(s.items[to].id);
    };
    return {
      items: s.items,
      currentId: s.currentId,
      current: s.items.find((i) => i.id === s.currentId) ?? null,
      count: s.items.length,
      isOpen: (id) => s.items.some((i) => i.id === id),
      open: openItem,
      flip: flipTo,
      close: closeItem,
      closeAll: closeAllItems,
      next: () => step(1),
      prev: () => step(-1),
    };
  }, [s]);
}

const OpenItemsContext = React.createContext<OpenItemsState | null>(null);

/** An explicit seam for a subtree that wants one. It publishes the same store the hook reads, so
 *  a component inside it and one outside it are looking at the same open set. */
export function OpenItemsProvider({ children }: { children: React.ReactNode }) {
  const live = useLive();
  return <OpenItemsContext.Provider value={live}>{children}</OpenItemsContext.Provider>;
}

/** THE ONE HOOK ANY PACKAGE CALLS. Inside the provider or outside it, the answer is the same. */
export function useOpenItems(): OpenItemsState {
  const live = useLive();
  const fromContext = React.useContext(OpenItemsContext);
  return fromContext ?? live;
}

/* ── THE CHIPS ────────────────────────────────────────────────────────────────────────────── */

/** The facts a chip draws, resolved off the ledger where the caller left them out. */
function useChipFacts(items: OpenItem[]): Array<Required<Pick<OpenItem, 'id' | 'customer'>> & OpenItem> {
  const { derived } = useConfig();
  const cast = derived.cast;
  const edits = useDay(cast.sector);
  const grants = useGrants();
  return React.useMemo(() => {
    const sales = buildSales(cast, edits);
    return items.map((item) => {
      const sale = sales.find((s) => s.id === item.id);
      return {
        ...item,
        customer: item.customer ?? sale?.customer.name ?? item.id,
        figure: item.figure ?? sale?.figure,
        number: item.number ?? sale?.number,
        threadId: item.threadId ?? sale?.customer.id,
      };
    });
  }, [items, cast, edits]);
}

/**
 * THE STRIP. One line of chips across the top of the detail: the document you are reading is the
 * solid one, the others recede, and each carries the X that closes it. It draws only while
 * something is open, so the feed keeps its own first line on an ordinary morning.
 */
export default function OpenItemsStrip({ phone = false }: { phone?: boolean }) {
  const [, theme] = useStyletron();
  const { items, currentId, flip, close, closeAll } = useOpenItems();
  const chips = useChipFacts(items);

  if (chips.length === 0) return null;

  return (
    <section
      data-testid="open-items"
      data-count={chips.length}
      aria-label="Open delivery notes"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: phone
          ? `${theme.sizing.scale300} ${theme.sizing.scale500}`
          : `${theme.sizing.scale300} ${theme.sizing.scale800}`,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        overflowX: 'auto',
        overflowY: 'hidden',
        minWidth: 0,
      }}
    >
      {/* ⚠ NO WORD IN FRONT OF THEM (FEED-IA §254). «Open» read as a filter a person had switched
          on, and the chips beside it read as its values. They are documents; pressing one opens it. */}
      {chips.map((chip) => {
        const on = chip.id === currentId;
        return (
          <span
            key={chip.id}
            data-open-item={chip.id}
            data-current={on ? 'yes' : 'no'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
              border: `1px solid ${on ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius200,
              background: on ? theme.colors.backgroundPrimary : theme.colors.backgroundSecondary,
            }}
          >
            <button
              type="button"
              data-testid={`flip-${chip.id}`}
              /* PRESSING A DOCUMENT OPENS IT (FEED-IA §254 · Peter: «it should just go to that
                 order, easy»). Flipping the strip's own focus left the list standing where it was,
                 so the press looked like a filter that did nothing. */
              onClick={() => { flip(chip.id); window.location.hash = `#/sales/${encodeURIComponent(chip.id)}`; }}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: theme.sizing.scale200,
                padding: `${theme.sizing.scale100} 0`,
                border: 'none',
                background: 'transparent',
                color: on ? theme.colors.contentPrimary : theme.colors.contentSecondary,
                cursor: 'pointer',
                ...theme.typography.LabelSmall,
              }}
            >
              {chip.customer}
              {chip.figure !== undefined && <Figure value={chip.figure} unit={chip.unit ?? 'S/'} size="compact" />}
            </button>
            <button
              type="button"
              data-testid={`close-${chip.id}`}
              aria-label={`Close ${chip.customer}`}
              onClick={() => close(chip.id)}
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 18,
                height: 18,
                padding: 0,
                border: 'none',
                borderRadius: theme.borders.radius100,
                background: 'transparent',
                color: theme.colors.contentTertiary,
                cursor: 'pointer',
                ...theme.typography.LabelXSmall,
              }}
            >
              ✕
            </button>
          </span>
        );
      })}

      {chips.length > 1 && (
        <button
          type="button"
          data-testid="close-all-items"
          onClick={closeAll}
          style={{
            flex: '0 0 auto',
            marginLeft: 'auto',
            padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
            border: 'none',
            background: 'transparent',
            color: theme.colors.contentTertiary,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            ...theme.typography.LabelXSmall,
          }}
        >
          Back to the list
        </button>
      )}
    </section>
  );
}
