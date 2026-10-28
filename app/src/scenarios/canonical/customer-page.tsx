/* THE CUSTOMER PAGE — the record, drawn as ARCHITECTURE.
 *
 * J1a's subject is which blocks exist on a customer and in what order, and NOTHING about their
 * contents: every block on this page is decided by some other card, so drawing a block's contents
 * here would silently decide somebody else's screen. The headings are the positive space — they
 * are what J1a decides — and every body is a Ghost carrying the pointer to the card that owns it.
 * The page is a map of the web, and clicking a block is how you read it.
 *
 * TWO CARDS INSTANTIATE IT (BUILD-PLAN §9.1, cluster S21):
 *   J1a  origin — every block ghosted. The order of the blocks is the argument.
 *   J1b  control delta — ONE block at full fidelity, nested inside the ghosted page, so you see
 *        exactly where in the undecided page the decided moment lives.
 *
 * THE ORDER, AND WHY. The record is read DURING a morning, not browsed: identity names the page,
 * then the blocks a question mid-order lands on (what they take, what they pay, what they may
 * order), then the blocks set once, then the log. That order is J1a's whole claim, and it is one
 * array in this file, so moving a block is one edit and zero screens.
 *
 * NO NAME IS TYPED HERE (law 10). The customer comes from `data/cast.ts`.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { GRegion } from '../ghosts/regions';
import type { Cast, Customer } from '../data/cast';
import Name from '../shell/Name';

/* ── THE ARCHITECTURE ─────────────────────────────────────────────────────────────────────── */

export type CustomerBlock = {
  id: string;
  /** the block's name. A LABEL for what is under it, never a remark about it. */
  title: string;
  /** what it holds, in one clause — so the architecture is legible without its contents */
  holds: string;
  /** the card that decides the contents */
  ref?: string;
  /** or the region nobody owns yet */
  open?: number;
  /** how tall the body stands. A tier is one value; a catalogue is a list; the shape is part of
   *  the architecture and a block drawn at the wrong height is a wrong claim. */
  height: number;
};

export const BLOCKS: CustomerBlock[] = [
  {
    id: 'identity',
    title: 'Identity, contacts and addresses',
    holds: 'the name, the numbers their orders arrive on, and where the goods go',
    ref: 'A4',
    height: 84,
  },
  {
    id: 'preferences',
    title: 'Preferred varieties',
    holds: 'what this customer takes whenever a line leaves the choice open',
    ref: 'J2',
    height: 128,
  },
  {
    id: 'prices',
    title: 'Agreed prices',
    holds: 'the price fixed for this customer, product by product',
    ref: 'C8',
    height: 88,
  },
  {
    id: 'tier',
    title: 'Tier',
    holds: 'the price list this customer is on',
    ref: 'C7',
    height: 48,
  },
  {
    id: 'catalogue',
    title: 'Agreed catalogue',
    holds: 'the products this customer may order',
    ref: 'A12',
    height: 88,
  },
  {
    id: 'volume',
    title: 'Volume arrangement',
    holds: 'a price held against an agreed quantity, and how far along it is',
    ref: 'C9b',
    height: 64,
  },
  {
    id: 'days',
    title: 'Delivery days',
    holds: 'the days of the week this customer takes a delivery',
    ref: 'I2',
    height: 48,
  },
  {
    id: 'history',
    title: 'Order history',
    holds: 'every order this customer has placed, newest first',
    open: 1,
    height: 112,
  },
];

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type CustomerPageProps = {
  cast: Cast;
  customer: Customer;
  /** the id of the block drawn at full fidelity — J1b's nesting. A LIST is the same idea with
   *  more than one block open, which is what the app's own customer surface is: every block has
   *  an owner by then, so nothing on the page is still a pointer. Additive: a single id behaves
   *  exactly as it did. */
  full?: string | string[];
  /** what that block holds. Returning nothing falls back to the block's ghost, so a page may open
   *  the blocks it has content for and leave the rest pointing at the card that owns them. */
  renderFull?: (block: CustomerBlock) => React.ReactNode;
};

export default function CustomerPage({ cast, customer, full, renderFull }: CustomerPageProps) {
  const [, theme] = useStyletron();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
      {/* ── whose page this is. A name identifies the page; it decides nothing on it. ── */}
      <header>
        <div style={theme.typography.HeadingMedium}>
          <Name of={customer} />
        </div>
        <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {customer.channel} · settles {customer.settles}
        </div>
      </header>

      {/* ── the blocks. The heading is decided here; the body belongs to the card it points at. ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600 }}>
        {BLOCKS.map((block) => {
          const open = Array.isArray(full) ? full.includes(block.id) : full === block.id;
          const body = open && renderFull ? renderFull(block) : null;
          return (
            <section key={block.id} style={{ minWidth: 0 }}>
              <div style={{ marginBottom: theme.sizing.scale300 }}>
                <div style={theme.typography.LabelMedium}>{block.title}</div>
                <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  {block.holds}
                </div>
              </div>
              {body ? (
                body
              ) : block.ref ? (
                /* NO WHISPER ON THE GHOST. The heading above it already names the block at full
                   size; a second, smaller copy of the same words inside the grey is noise. What
                   the ghost still carries is the POINTER, which is law 4's whole requirement. */
                <GRegion to={block.ref} height={block.height} />
              ) : (
                <GRegion open={block.open ?? 1} height={block.height} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
