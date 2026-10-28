/* GROWN from Base Web's own `src/template-component/types.ts` — same `$`-prefixed shared style
 * props, same `Overrides` shape, same prop idiom.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 */
import type { Override } from 'baseui/helpers/overrides';
import type { MODE, SIZE } from './constants';

export type Mode = keyof typeof MODE;
export type Size = keyof typeof SIZE;

/** a level source: returns 0…1, read once per poll */
export type AmplitudeSource = () => number;

export type WaveformOverrides = {
  Root?: Override;
  /** the strip the marks live in — the seek target when scrubbing */
  Field?: Override;
  /** one mark */
  Bar?: Override;
  /** the elapsed / total readout */
  Time?: Override;
};

export type WaveformProps = {
  /** live reads a level source · static draws levels it is given · scrubbing seeks through them */
  mode?: Mode;
  /** LIVE — the level source, read every `pollMs`, returning 0…1 */
  amplitude?: AmplitudeSource;
  /** LIVE — a paused field holds the marks it has and stops reading */
  paused?: boolean;
  /** LIVE — how often the level is read, in ms */
  pollMs?: number;
  /** STATIC · SCRUBBING — the levels to draw, 0…1 each */
  peaks?: number[];
  /** STATIC · SCRUBBING — draws a deterministic field when `peaks` is absent. Same seed, same field. */
  seed?: string;
  /** SCRUBBING — where the playhead stands, in ms */
  positionMs?: number;
  /** the whole length in ms. Present ⇒ the time reads out. */
  durationMs?: number;
  /** SCRUBBING — called with the position a drag or an arrow key landed on, in ms */
  onSeek?: (positionMs: number) => void;
  /** SCRUBBING — how far one arrow key moves the playhead, in ms */
  stepMs?: number;
  size?: Size;
  disabled?: boolean;
  /** what a screen reader calls this field */
  label?: string;
  overrides?: WaveformOverrides;
};

export type SharedStyleProps = {
  $mode: Mode;
  $size: Size;
  $disabled: boolean;
  $isFocusVisible: boolean;
};

export type BarStyleProps = SharedStyleProps & {
  /** inked, rather than dimmed — every mark of a live or static field, the played ones of a scrub */
  $played: boolean;
};
