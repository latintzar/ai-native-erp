/* THE ORDER SURFACE — C-8: ONE COMPONENT, FIVE INSTANTIATIONS (and fourteen cards in the end).
 *
 * FLOWS §8.1 says «draw the gate once». The brief's A2 entry says the card exists precisely to
 * show the missing button. Both are right, and the resolution is this file: A1, A2, A3, A4 and A5
 * are five calls to one component with different props and different data. FIVE CARDS, ONE
 * SCREEN, and the delta is visible because it is literally one prop.
 *
 * That is also the mechanism that stops five agents drawing five order cards. P0 authors it in
 * wave 0 and FREEZES it; P1, P2 and P5 read it and never edit it.
 *
 * THE PROPS THAT CARRY THE DELTAS
 *   `reason`   why this order is on screen at all. A4 replaces it with the identity gate's line;
 *              A5 with the threshold's. A1 has none — under `D2.all` there is no exception to
 *              explain, and a screen that says «this order is normal» is a screen narrating
 *              itself (law 7).
 *   `primary`  the gesture that ends the decision. `null` is A2: the primary is REMOVED and
 *              nothing replaces it. That one prop is the clearest evidence in the catalogue that
 *              review is a dimension rather than a feature.
 *   `exits`    a second door under the primary — A4's record, A13-bis's credit.
 *   `openLine` one line opens in place, and the resolution happens without leaving the order
 *              (A3, A6, A8–A12, J2).
 *   `aside`    a block above the lines — A5's evidence chart, A13's notice.
 *
 * EVERY NAME COMES FROM `cast.ts`. Nothing here is typed.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';
import { Message } from '../../rocoto/message';
import { Transcript } from '../../rocoto/transcript';
import { OverlayCard } from '../../rocoto/overlay-card';
import type { Cast, Order, OrderLine } from '../data/cast';
import { customerOf, productOf, lineFacts } from '../data/cast';
import Name from '../shell/Name';

/* ── THE HOLD ─────────────────────────────────────────────────────────────────────────────────
 * The gesture that ends a decision is a HOLD, not a click: a confirmation that commits an order
 * for a real customer should cost a second of intent, and the fill is the receipt for that second.
 *
 * Drawn with Base's own Button and Base's own timed-fill technique (`button-timed` paints a
 * `::after` layer and scales it), driven by the hand instead of by a clock. No new control is
 * invented and the button keeps every one of Base's states.
 */
export const HOLD_MS = 900;

export function HoldToConfirm({
  children,
  onConfirm,
  disabled,
}: {
  children: React.ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [progress, setProgress] = React.useState(0);
  const raf = React.useRef<number | null>(null);
  const start = React.useRef(0);

  const stop = React.useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setProgress(0);
  }, []);

  React.useEffect(() => stop, [stop]);

  const tick = React.useCallback(() => {
    const p = Math.min(1, (Date.now() - start.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) { stop(); onConfirm(); return; }
    raf.current = requestAnimationFrame(tick);
  }, [onConfirm, stop]);

  const begin = () => {
    if (disabled) return;
    start.current = Date.now();
    raf.current = requestAnimationFrame(tick);
  };

  /* THE HANDLERS RIDE A WRAPPER, NOT THE BUTTON, and that is not a style choice: Base's Button
     sets its own `onMouseDown` / `onMouseUp` / `onMouseEnter` / `onMouseLeave` AFTER spreading
     `restProps`, so a handler passed as a prop is silently dropped. It renders perfectly and does
     nothing — which is precisely why the gesture is verified by holding it in a browser and
     reading the frame, and never by reading the code. Pointer events bubble, so the wrapper
     hears the same gestures and Base keeps every one of its own states. */
  return (
    <span
      style={{ display: 'block' }}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if (e.key === ' ' && raf.current === null) begin(); }}
      onKeyUp={stop}
    >
      <Button
        kind={KIND.primary}
        size={SIZE.large}
        disabled={disabled}
        overrides={{
          BaseButton: {
            style: () => ({
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              ':after': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '100%',
                transformOrigin: 'left',
                transform: `scaleX(${progress})`,
                // theme-gate-allow: a white alpha is geometry, not brand — the primary is ink
                // under every brand, so the veil that fills it reads identically under all of them
                backgroundColor: 'rgba(255,255,255,0.3)',
              },
            }),
          },
        }}
      >
        {children}
      </Button>
    </span>
  );
}

/* ── THE SURFACE ──────────────────────────────────────────────────────────────────────────── */

export type OrderSurfaceProps = {
  cast: Cast;
  /** defaults to the sector's own order */
  order?: Order;
  /** WHY this order is on screen. Omitted under `D2.all`: there is no exception to explain. */
  reason?: React.ReactNode;
  /** the gesture that ends the decision. `null` REMOVES it and puts nothing in its place. */
  primary?: React.ReactNode;
  /** a second door under the primary */
  exits?: React.ReactNode;
  /** a block above the lines — evidence, a notice, a collision */
  aside?: React.ReactNode;
  /** the customer's own words, kept beside the reading */
  words?: boolean;
  /** the exit door for a message that is not an order (§3.5) — ONE control on the message */
  replyDoor?: React.ReactNode;
  /** the id of the line that opens in place */
  openLine?: string;
  /** what the open line holds */
  renderOpenLine?: (line: OrderLine) => React.ReactNode;
  onLineClick?: (line: OrderLine) => void;
  /** the order's own state, on the row rather than in a sentence */
  state?: React.ReactNode;
};

export default function OrderSurface({
  cast,
  order = cast.order,
  reason,
  primary,
  exits,
  aside,
  words = true,
  replyDoor,
  openLine,
  renderOpenLine,
  onLineClick,
  state,
}: OrderSurfaceProps) {
  const [, theme] = useStyletron();
  const [transcript, setTranscript] = React.useState(false);
  const customer = customerOf(cast, order.customer);
  const total = order.lines.reduce((s, l) => s + l.qty * l.price, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {/* ── the head. Who, for when, on which channel, and what state the order is in. ── */}
      <header style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...theme.typography.HeadingSmall }}>
            <Name of={customer} />
          </div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {order.deliveryDay} · {customer.channel} · {order.placedAt} · {customer.tier}
          </div>
        </div>
        {state}
      </header>

      {/* ── the reason line, where there is one. The evidence rides the gate it justifies. ── */}
      {reason && (
        <div
          style={{
            borderLeft: `3px solid ${theme.colors.contentPrimary}`,
            paddingLeft: theme.sizing.scale500,
            ...theme.typography.ParagraphSmall,
          }}
        >
          {reason}
        </div>
      )}

      {/* ── the customer's own words, kept BESIDE the reading rather than replaced by it ── */}
      {words && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          {order.words.map((w, i) => (
            <Message
              key={i}
              author="received"
              time={order.placedAt}
              grouped={i > 0}
              action={i === 0 ? replyDoor : undefined}
              onHold={() => setTranscript(true)}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={() => setTranscript(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') setTranscript(true); }}
                style={{ cursor: 'pointer' }}
              >
                {w}
              </span>
            </Message>
          ))}
        </div>
      )}

      {aside}

      {/* ── the lines, as Rocoto read them ── */}
      <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
        {order.lines.map((line, i) => {
          const product = productOf(cast, line.product);
          const facts = lineFacts(cast, product);
          const open = openLine === line.id;
          return (
            <div key={line.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}` }}>
              <div
                role={onLineClick ? 'button' : undefined}
                tabIndex={onLineClick ? 0 : undefined}
                onClick={onLineClick ? () => onLineClick(line) : undefined}
                onKeyDown={onLineClick ? (e) => { if (e.key === 'Enter') onLineClick(line); } : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                  gap: theme.sizing.scale600,
                  alignItems: 'baseline',
                  padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                  background: open ? theme.colors.backgroundSecondary : 'transparent',
                  cursor: onLineClick ? 'pointer' : 'default',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={theme.typography.LabelMedium}>
                    <Name of={product} />
                  </div>
                  {/* THE SECTOR, AS DATA. The same markup renders fish's zona + arte, meat's lote,
                      and fruit's calibre + categoría, because the family says which facts ride
                      here. This row IS A1's proof. */}
                  {facts.length > 0 && (
                    <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                      {facts.map((f) => `${f.label} ${f.value}`).join(' · ')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, whiteSpace: 'nowrap' }}>
                  {line.wasQty !== undefined && product.pack && (
                    <span
                      style={{
                        ...theme.typography.ParagraphXSmall,
                        color: theme.colors.contentTertiary,
                        textDecoration: 'line-through',
                      }}
                    >
                      {line.wasQty} {product.pack.unit}
                    </span>
                  )}
                  <Figure value={line.qty} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="compact" />
                </div>

                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Figure value={line.qty * line.price} unit="€" size="compact" />
                  <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                    {line.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/{product.unit}
                  </div>
                </div>
              </div>
              {open && renderOpenLine && (
                <div style={{ padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale500}`, background: theme.colors.backgroundSecondary }}>
                  {renderOpenLine(line)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── the total. The unit shares the number's line, at 320px as well as at 1440px. ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500 }}>
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
          {order.lines.length} lines
        </span>
        <Figure value={total} unit="€" size="large" />
      </div>

      {/* ── the gesture that ends the decision, or the space where one is not ── */}
      {(primary || exits) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          {primary}
          {exits}
        </div>
      )}

      {/* ── the words, replayed. Opened from the message, over the card. ── */}
      <OverlayCard
        isOpen={transcript}
        onClose={() => setTranscript(false)}
        placement="center"
        size="default"
        ariaLabel="what the customer said"
      >
        <Transcript
          housing="plain"
          utterances={order.utterances.map((u, i) => ({
            speaker: customer.name,
            start: u.at / 1000,
            end: (u.at + 2400) / 1000,
            words: [u.text],
            id: `u${i}`,
          }))}
          duration={9}
          action={
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setTranscript(false)}>
              Close
            </Button>
          }
        />
      </OverlayCard>
    </div>
  );
}

/** The state tag an order carries on its own row. Ink, never colour — this product has no traffic
 *  light, so a state is a word and a shape and never a hue. */
export function OrderState({ children }: { children: React.ReactNode }) {
  return (
    <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
      {children}
    </Tag>
  );
}
