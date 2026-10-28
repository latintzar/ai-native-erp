/* THE SUBSTITUTION — the canonical screen behind D3s · D4s.
 *
 * THE ONLY SCREEN IN THE PRODUCT THAT INCREASES REVENUE RATHER THAN REDUCING WORK. Everything
 * else in the catalogue saves a person an hour; this one turns «we have none» into a sale, while
 * the customer is still on the other end of the conversation. So it is drawn for the thirty
 * seconds it actually has.
 *
 * THE ORDERING IS THE SUBJECT, not the list. Any catalogue can produce four things that are a bit
 * like merluza. What makes an offer land is that the first one is the one THIS customer has taken
 * before, and the evidence for that ordering rides each row in the trade's own terms — «14 of
 * their last 16 orders» — never as a score. A confidence number is a claim about the software; a
 * count is a fact about the customer.
 *
 * THE MARGIN RIDES EVERY ROW, because the person choosing is choosing between two sales and not
 * between two products. It sits beside the price, with its unit on its own number's line.
 *
 * ONE PRESS, AND THE WORDS ARE ALREADY WRITTEN. The offer composes into the composer verbatim and
 * editable; the send is a second, separate act, because a message to a customer is theirs to
 * approve. D4s reaches the same panel through a collision notice — a `control` delta and one prop.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';

/* ── WHAT RAN OUT, AND WHAT COULD GO INSTEAD ──────────────────────────────────────────────── */

export type Wanted = {
  /** the product asked for, drawn by the caller through `<Name />` (law 10) */
  name: React.ReactNode;
  /** how much was asked for */
  qty: number;
  unit: string;
  /** how much of it there is */
  available: number;
};

export type Alternative = {
  id: string;
  name: React.ReactNode;
  /** the same name as plain words, for the offer that gets COMPOSED rather than rendered. It
   *  still comes from the cast — law 10 is about what a screen types, not about what it reads. */
  plain: string;
  /** the lote, the origin, the calibre — whatever makes this one this one */
  detail?: React.ReactNode;
  /** WHY IT IS AT THIS RANK, in the trade's own terms. Never a score. */
  evidence: React.ReactNode;
  /** how much of it there is */
  available: number;
  unit: string;
  /** what this customer would pay */
  price: number;
  /** what it cost, so the margin is a fact rather than a claim */
  cost: number;
};

export type SubstitutionProps = {
  wanted: Wanted;
  /** already ranked by the caller — the ranking is the card's argument, not the component's */
  alternatives: Alternative[];
  /** a notice above the alternatives (D4s's collision) */
  notice?: React.ReactNode;
  /** the alternatives stand behind a door until it is opened — a row is a door, forward and
   *  sideways, never back (law 9) */
  behindDoor?: boolean;
  onOpen?: () => void;
  openLabel?: React.ReactNode;
  /** an alternative was chosen; the caller composes the words */
  onOffer?: (alternative: Alternative) => void;
  /** which one is on offer */
  offered?: string | null;
  /** what the ranking is built from, stated once under the list */
  rankingNote?: React.ReactNode;
  /** the conversation this is happening inside */
  thread?: React.ReactNode;
  /** the words, ready to send */
  composer?: React.ReactNode;
};

/** A quantity's decimals: none when it is whole. «0,00 kg» is a price's habit worn by a count,
 *  and it makes an empty shelf look like a rounding. */
const q = (n: number): number => (Number.isInteger(n) ? 0 : 1);

/** The margin a row would earn, as a percentage of what the customer pays. */
export const marginOf = (a: Alternative): number =>
  a.price === 0 ? 0 : Math.round(((a.price - a.cost) / a.price) * 1000) / 10;

export default function Substitution({
  wanted,
  alternatives,
  notice,
  behindDoor = false,
  onOpen,
  openLabel = 'Offer something else',
  onOffer,
  offered,
  rankingNote,
  thread,
  composer,
}: SubstitutionProps) {
  const [, theme] = useStyletron();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {thread}

      {/* ── WHAT RAN OUT. One line, and the arithmetic of the shortfall on it. ── */}
      <section
        style={{
          display: 'flex',
          gap: theme.sizing.scale500,
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          padding: theme.sizing.scale500,
          borderRadius: theme.borders.radius300,
          borderLeft: `3px solid ${theme.colors.contentPrimary}`,
          background: theme.colors.backgroundSecondary,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={theme.typography.LabelMedium}>{wanted.name}</div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            asked for <Figure value={wanted.qty} unit={wanted.unit} decimals={q(wanted.qty)} size="compact" />
          </div>
        </div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <Figure value={wanted.available} unit={wanted.unit} decimals={q(wanted.available)} size="default" />
          <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
            on today&rsquo;s list
          </div>
        </div>
      </section>

      {notice}

      {/* ── THE ALTERNATIVES, RANKED ── */}
      {behindDoor ? (
        <Button kind={KIND.primary} size={SIZE.default} onClick={onOpen}>
          {openLabel}
        </Button>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <h3 style={{ margin: 0, ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            What this customer takes instead
          </h3>

          <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
            {alternatives.map((a, i) => {
              const margin = marginOf(a);
              const on = offered === a.id;
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.5fr) auto auto auto',
                    gap: theme.sizing.scale500,
                    alignItems: 'center',
                    padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                    borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                    background: on ? theme.colors.backgroundSecondary : 'transparent',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={theme.typography.LabelMedium}>{a.name}</div>
                    {a.detail && (
                      <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                        {a.detail}
                      </div>
                    )}
                    {/* THE EVIDENCE FOR THE RANK, riding the row it ranks */}
                    <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentPrimary, marginTop: 2 }}>
                      {a.evidence}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Figure value={a.available} unit={a.unit} decimals={q(a.available)} size="compact" />
                    <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                      on hand
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Figure value={a.price} unit={`€/${a.unit}`} decimals={2} size="compact" />
                    <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                      <Figure value={margin} unit="% margin" decimals={1} size="compact" />
                    </div>
                  </div>

                  <div style={{ whiteSpace: 'nowrap' }}>
                    {on ? (
                      <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                        written
                      </Tag>
                    ) : (
                      <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => onOffer?.(a)}>
                        Offer it
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {rankingNote && (
            <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
              {rankingNote}
            </p>
          )}
        </section>
      )}

      {composer}
    </div>
  );
}
