/* THE ONE GLYPH BASE DOES NOT SHIP FOR PLAYBACK.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * A field being played needs exactly two marks, and Base already has one of them: `TriangleRight`
 * is the play mark, drawn by Uber, and a hand-drawn triangle beside Uber's pack would announce
 * itself as the odd one. Only PAUSE is missing, so only pause is drawn here — one solid path on
 * the 24 grid, wrapped in Base's own `Icon`, so it inherits its sizing, its `color`, its `title`
 * and its overrides contract and sits beside the triangle without a seam.
 *
 * It lives in the Waveform's kit rather than the Voice Button's because the Voice Button RECORDS
 * and the Waveform is the instrument a recording is played on. One meaning, one home (§30).
 */
import * as React from 'react';
import { Icon } from 'baseui/icon';

/** exactly what Base's own generated icons accept */
type GlyphProps = React.ComponentProps<typeof Icon>;

export const Pause = (props: GlyphProps) => (
  <Icon viewBox="0 0 24 24" title="Pause" {...props}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </Icon>
);
