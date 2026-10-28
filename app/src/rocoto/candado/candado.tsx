/* EL CANDADO — the ratio lock (U05), grown on the forked slider in this directory.
 *
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.; the upstream notice below
 * travels with this copy as the licence requires, and the full licence is vendored at
 * app/src/rocoto/LICENSE.baseweb.txt. This file assembles Base's forked `Slider` (`./slider`) on Base's own overrides
 * contract and is a DERIVATIVE WORK — the same standing as every other file in this directory,
 * which is why it now carries the same notice they do.
 *
 * «One slider moves a set of related values while preserving the proportions between them»
 * (brief §5, U05). C4 is the situation: a house with several price tiers moves all of them at
 * once when the market moves, and the WHOLE POINT is that the relationship between the tiers
 * survives the move — a tier-1 customer does not silently become a tier-3 customer because
 * somebody dragged.
 *
 * WHAT THE LOCK HOLDS. Two invariants are defensible and the plan names both: §5.5 calls this
 * «linked sliders holding a ratio», and C4's own entry says twice that «the spread holds».
 * They are different arithmetic, so the component holds EITHER and the surface says which:
 *   · `spread` — every value moves by the same amount. Eight points of margin between tier 1
 *     and tier 4 is still eight points afterwards.
 *   · `ratio`  — every value scales by the same factor. Tier 4 at 1.4× tier 1 stays at 1.4×.
 * C4 is drawn with `spread`, because that is what C4's own text says and because margin is
 * quoted in points: a distributor who says «put two points on everything» means two points on
 * everything.
 *
 * WHAT RELEASING THE LOCK DOES. One value moves alone. There is no third mode and no partial
 * link — the Switch beside the set is the whole of the control's state.
 *
 * THE CLAMP IS PART OF THE INVARIANT. A locked drag that would push any value past `min` or
 * `max` is short-changed to the amount every value can take, so the set never loses its shape
 * at the ends of the track. Dragging into the ceiling stops the set; it never flattens it.
 */
/*
Copyright (c) Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import Slider from './slider';
import {
  Root as StyledRoot,
  Row as StyledRow,
  Names as StyledNames,
  Control as StyledControl,
  Result as StyledResult,
  Note as StyledNote,
} from './candado-styled';
import type { CandadoProps, Link } from './types';

/* ── THE INVARIANT ────────────────────────────────────────────────────────────────────────────
 * A pure function, exported, because the rule a lock keeps should be readable and testable
 * without a browser — and because the card's own copy quotes it.
 */

export function moveLinked(
  values: number[],
  index: number,
  next: number,
  opts: { min: number; max: number; step: number; link: Link; locked: boolean },
): number[] {
  const { min, max, step, link, locked } = opts;
  const round = (n: number) => Math.round(n / step) * step;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  if (!locked) {
    return values.map((v, i) => (i === index ? clamp(round(next)) : v));
  }

  if (link === 'ratio') {
    const from = values[index];
    if (from === 0) return values;
    let factor = next / from;
    /* the factor every value can take: nothing may leave the track */
    const high = Math.max(...values);
    const low = Math.min(...values);
    if (high > 0) factor = Math.min(factor, max / high);
    if (low > 0) factor = Math.max(factor, min / low);
    return values.map((v) => clamp(round(v * factor)));
  }

  /* spread: one amount, applied to every value, shortened to what the set can take */
  let delta = next - values[index];
  delta = Math.min(delta, max - Math.max(...values));
  delta = Math.max(delta, min - Math.min(...values));
  return values.map((v) => clamp(round(v + delta)));
}

/* ── THE SET ──────────────────────────────────────────────────────────────────────────────── */

export default function Candado({
  rows,
  value,
  onChange,
  locked = true,
  link = 'spread',
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  valueToLabel,
  overrides = {},
}: CandadoProps) {
  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Row, rowProps] = getOverrides(overrides.Row, StyledRow);
  const [Names, namesProps] = getOverrides(overrides.Names, StyledNames);
  const [Control, controlProps] = getOverrides(overrides.Control, StyledControl);
  const [Result, resultProps] = getOverrides(overrides.Result, StyledResult);

  return (
    <Root data-baseweb="candado" {...rootProps}>
      {rows.map((row, i) => (
        <Row key={row.id} $first={i === 0} {...rowProps}>
          <Names {...namesProps}>
            {row.name}
            {row.note ? <StyledNote>{row.note}</StyledNote> : null}
          </Names>

          <Control {...controlProps}>
            <Slider
              value={[value[i]]}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              valueToLabel={valueToLabel}
              /* the track's end labels belong to the SET, not to each row: four sliders each
                 announcing the same two ends is four times the same sentence. Base draws them
                 once, under the last row. */
              overrides={{
                ...overrides.Slider,
                ...(i === rows.length - 1
                  ? null
                  : { TickBar: { style: { display: 'none' } } }),
              }}
              onChange={({ value: v }) =>
                onChange(moveLinked(value, i, v[0], { min, max, step, link, locked }))
              }
            />
          </Control>

          <Result {...resultProps}>{row.result}</Result>
        </Row>
      ))}
    </Root>
  );
}
