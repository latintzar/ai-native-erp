/* LEVEL 3 — THE RAMP. The founder's own reference, built: a Photoshop gradient picker, where the
 * stops sit on a ramp and THE RELATIONSHIP BETWEEN THEM is the thing being edited.
 *
 * «You have a centre or one, and everything is minus certain percentages and plus certain
 * percentages.» So:
 *   · drag a STOP  → that stop's offset from the centre changes; nothing else moves
 *   · drag the ANCHOR → every stop slides with it, every relationship intact. The spread printed
 *     beside the header does not budge, which is the claim of level 3 made checkable
 *   · PIN a stop → it locks to an absolute price and stops following the anchor. Its percentage
 *     becomes a reading rather than a rule, and it drifts as the anchor passes underneath. Pin
 *     every stop and the item is behaving as a level 4 — which is exactly how items get there.
 *
 * The geometry is Base's slider, at Base's own measurements: a 2px track, a 24px handle, the 3px
 * focus ring, the value bubble above the thumb. Base Web is MIT, Copyright (c) Uber Technologies.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import { Figure } from '../figure';
import { ANCHOR_ID, OFFSET_STEP, PRICE_STEP } from './constants';
import {
  Ramp as StyledRamp,
  RampAnchor as StyledRampAnchor,
  RampAnchorBar as StyledRampAnchorBar,
  RampAnchorName as StyledRampAnchorName,
  RampBand as StyledRampBand,
  RampBubble as StyledRampBubble,
  RampEnds as StyledRampEnds,
  RampName as StyledRampName,
  RampStop as StyledRampStop,
  RampTrack as StyledRampTrack,
  StopList as StyledStopList,
  StopName as StyledStopName,
  StopOffset as StyledStopOffset,
  StopPrice as StyledStopPrice,
  StopRow as StyledStopRow,
  PinButton as StyledPinButton,
  PinSpacer as StyledPinSpacer,
} from './styled-components';
import type { AnchoredPrice, PriceAccordionOverrides, PriceStop } from './types';
import { clamp, moveAnchor, moveStop, round, setStopPinned, stopOffset, stopPrice } from './utils';

/** THE PIN, in line art: an open shackle when the stop follows the anchor, a closed one when it
 *  holds its own number. A mark is line work in this system; a filled glyph is somebody else's. */
const Lock = ({ closed }: { closed: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
    <rect x="3" y="6.5" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <path
      d={closed ? 'M5 6.5V4.6a2 2 0 0 1 4 0v1.9' : 'M5 6.5V4.6a2 2 0 0 1 4 0'}
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export type RampProps = {
  price: AnchoredPrice;
  /** the ramp's ends, held still by the caller so the constellation visibly travels along them */
  bounds: { min: number; max: number };
  onChange?: (price: AnchoredPrice) => void;
  /** the handle under the hand — a stop's id, or `anchor` */
  activeId: string | null;
  onActiveIdChange: (id: string | null) => void;
  disabled: boolean;
  editable: boolean;
  unit?: string;
  decimals: number;
  locale: string;
  overrides: PriceAccordionOverrides;
};

const Ramp = ({
  price,
  bounds,
  onChange,
  activeId,
  onActiveIdChange,
  disabled,
  editable,
  unit,
  decimals,
  locale,
  overrides,
}: RampProps) => {
  const [Root, rootProps] = getOverrides(overrides.Ramp, StyledRamp);
  const [Track, trackProps] = getOverrides(overrides.RampTrack, StyledRampTrack);
  const [Stop, stopProps] = getOverrides(overrides.RampStop, StyledRampStop);
  const [Anchor, anchorProps] = getOverrides(overrides.RampAnchor, StyledRampAnchor);
  const [Row, rowProps] = getOverrides(overrides.StopRow, StyledStopRow);

  const trackRef = React.useRef<HTMLDivElement>(null);
  /* the hand, kept apart from `activeId`: `activeId` is a controlled STATE the docs can set to
   * show a drag standing still, and a pointer that merely passes over a lit handle must not move
   * anything. Only a pointer that went down here drags. */
  const dragging = React.useRef<string | null>(null);

  const step = price.step ?? PRICE_STEP;
  const span = bounds.max - bounds.min || 1;
  const keyStep = Math.max(step, round(span / 50, step));
  const pct = (value: number) => clamp(((value - bounds.min) / span) * 100, 0, 100);

  const money = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const percent = (value: number) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    });

  const anchorName = price.anchorName ?? 'Anchor';
  const positions = price.stops.map((stop) => pct(stopPrice(stop, price.anchor)));
  const bandFrom = positions.length ? Math.min(...positions) : 0;
  const bandTo = positions.length ? Math.max(...positions) : 0;

  /* ── moving ───────────────────────────────────────────────────────────────────────────── */

  const put = (id: string, nextPrice: number) => {
    if (!onChange) return;
    onChange(
      id === ANCHOR_ID
        ? moveAnchor(price, nextPrice, bounds)
        : moveStop(price, id, nextPrice, bounds)
    );
  };

  const priceAt = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return null;
    return bounds.min + clamp((clientX - rect.left) / rect.width, 0, 1) * span;
  };

  const onPointerDown = (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = id;
    onActiveIdChange(id);
  };

  const onPointerMove = (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== id) return;
    const next = priceAt(event.clientX);
    if (next != null) put(id, next);
  };

  const onPointerUp = (id: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== id) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = null;
    onActiveIdChange(null);
  };

  /* THE KEYBOARD EDITS WHAT THE LEVEL STORES. A following stop moves in percentage points,
   * because its offset is the thing that exists; the anchor and a pinned stop move in money,
   * because a price is the thing THEY hold. */
  const onKeyDown = (id: string, stop?: PriceStop) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editable) return;
    const multiplier = event.shiftKey ? 10 : 1;
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;

    if (direction !== 0) {
      event.preventDefault();
      if (stop && !stop.pinned && price.anchor !== 0) {
        const nextOffset = stop.offset + direction * OFFSET_STEP * multiplier;
        put(id, price.anchor * (1 + nextOffset / 100));
      } else {
        const at = id === ANCHOR_ID ? price.anchor : stopPrice(stop as PriceStop, price.anchor);
        put(id, at + direction * keyStep * multiplier);
      }
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      put(id, bounds.min);
    } else if (event.key === 'End') {
      event.preventDefault();
      put(id, bounds.max);
    }
  };

  const handleProps = (id: string, stop?: PriceStop) => ({
    role: 'slider' as const,
    tabIndex: editable ? 0 : -1,
    'aria-orientation': 'horizontal' as const,
    'aria-valuemin': bounds.min,
    'aria-valuemax': bounds.max,
    'aria-disabled': disabled || undefined,
    'aria-readonly': !editable || undefined,
    onPointerDown: onPointerDown(id),
    onPointerMove: onPointerMove(id),
    onPointerUp: onPointerUp(id),
    onPointerCancel: onPointerUp(id),
    onKeyDown: onKeyDown(id, stop),
    onFocus: () => onActiveIdChange(id),
    onBlur: () => {
      if (dragging.current === null && activeId === id) onActiveIdChange(null);
    },
  });

  return (
    <>
      <Root $disabled={disabled} {...rootProps}>
        <Track ref={trackRef} $disabled={disabled} $readOnly={!editable} {...trackProps}>
          {price.stops.length > 1 && (
            <StyledRampBand
              $disabled={disabled}
              style={{ left: `${bandFrom}%`, width: `${bandTo - bandFrom}%` }}
            />
          )}

          {/* THE ANCHOR — a gate across the ramp, not a bead on it, because it is a different
              kind of thing: every following stop is measured from here. */}
          <Anchor
            $active={activeId === ANCHOR_ID}
            $disabled={disabled}
            $readOnly={!editable}
            style={{ left: `${pct(price.anchor)}%` }}
            aria-label={`${anchorName}, the anchor every following tier is measured from`}
            aria-valuenow={price.anchor}
            aria-valuetext={`${anchorName}, ${money(price.anchor)}${unit ? ` ${unit}` : ''}`}
            {...handleProps(ANCHOR_ID)}
            {...anchorProps}
          >
            <StyledRampAnchorName $disabled={disabled}>{anchorName}</StyledRampAnchorName>
            <StyledRampAnchorBar $active={activeId === ANCHOR_ID} $disabled={disabled} />
            {activeId === ANCHOR_ID && (
              <StyledRampBubble>
                {money(price.anchor)}
                {unit ? ` ${unit}` : ''}
              </StyledRampBubble>
            )}
          </Anchor>

          {price.stops.map((stop, index) => {
            const at = stopPrice(stop, price.anchor);
            const offset = stopOffset(stop, price.anchor);
            const active = activeId === stop.id;
            return (
              <Stop
                key={stop.id}
                $active={active}
                $pinned={!!stop.pinned}
                $disabled={disabled}
                $readOnly={!editable}
                style={{ left: `${positions[index]}%` }}
                aria-label={`${stop.name} price`}
                aria-valuenow={at}
                aria-valuetext={`${stop.name}, ${percent(offset)} %, ${money(at)}${unit ? ` ${unit}` : ''}${
                  stop.pinned ? ', pinned' : ''
                }`}
                {...handleProps(stop.id, stop)}
                {...stopProps}
              >
                {stop.pinned && <Lock closed />}
                <StyledRampName $disabled={disabled}>{stop.name}</StyledRampName>
                {active && (
                  <StyledRampBubble>
                    {money(at)}
                    {unit ? ` ${unit}` : ''} · {percent(offset)} %
                  </StyledRampBubble>
                )}
              </Stop>
            );
          })}
        </Track>

        <StyledRampEnds>
          <span>
            {money(bounds.min)}
            {unit ? ` ${unit}` : ''}
          </span>
          <span>
            {money(bounds.max)}
            {unit ? ` ${unit}` : ''}
          </span>
        </StyledRampEnds>
      </Root>

      {/* THE SET, READ AS A LIST. One fact per row: the tier, its relationship, its price, and
          the pin that decides which of the two the tier actually keeps. */}
      <StyledStopList>
        <Row $active={activeId === ANCHOR_ID} {...rowProps}>
          <StyledStopName>{anchorName}</StyledStopName>
          <StyledStopOffset aria-hidden="true">—</StyledStopOffset>
          <StyledStopPrice>
            <Figure value={price.anchor} unit={unit} decimals={decimals} locale={locale} size="compact" />
          </StyledStopPrice>
          <StyledPinSpacer aria-hidden="true" />
        </Row>

        {price.stops.map((stop) => {
          const at = stopPrice(stop, price.anchor);
          const offset = stopOffset(stop, price.anchor);
          return (
            <Row key={stop.id} $active={activeId === stop.id} {...rowProps}>
              <StyledStopName>{stop.name}</StyledStopName>
              <StyledStopOffset $pinned={!!stop.pinned}>{percent(offset)} %</StyledStopOffset>
              <StyledStopPrice>
                <Figure value={at} unit={unit} decimals={decimals} locale={locale} size="compact" />
              </StyledStopPrice>
              {editable ? (
                <StyledPinButton
                  type="button"
                  $pinned={!!stop.pinned}
                  aria-pressed={!!stop.pinned}
                  aria-label={`${stop.name}: hold ${money(at)}${unit ? ` ${unit}` : ''} whatever the anchor does`}
                  onClick={() => onChange && onChange(setStopPinned(price, stop.id, !stop.pinned))}
                >
                  <Lock closed={!!stop.pinned} />
                </StyledPinButton>
              ) : (
                /* a record says which stops are held and offers nothing to press */
                <StyledPinSpacer aria-hidden="true">
                  {stop.pinned ? <Lock closed /> : null}
                </StyledPinSpacer>
              )}
            </Row>
          );
        })}
      </StyledStopList>
    </>
  );
};

export default Ramp;
