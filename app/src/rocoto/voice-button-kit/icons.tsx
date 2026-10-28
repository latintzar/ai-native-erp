/* THE TWO GLYPHS BASE DOES NOT SHIP.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * Every other mark this control needs is Uber's own — `ChevronUp` for the direction the lock
 * lives in, `ArrowLeft` for the direction cancel lives in, `TrashCanFilled` for discard and
 * `ArrowUp` for send. Only a microphone and a padlock are missing, so only those are drawn here,
 * and they are drawn the way Base draws: one solid path on a 24 grid, wrapped in Base's own
 * `Icon`, so they inherit its sizing, its `color`, its `title` and its overrides contract and sit
 * beside Uber's four without a seam.
 */
import * as React from 'react';
import { Icon } from 'baseui/icon';

/** exactly what Base's own generated icons accept — `IconProps` widens `title` to `string | null`,
 *  which `Icon` itself does not take, so the component's own prop type is the honest one */
type GlyphProps = React.ComponentProps<typeof Icon>;

export const Microphone = (props: GlyphProps) => (
  <Icon viewBox="0 0 24 24" title="Microphone" {...props}>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10v1a7 7 0 0 0 6 6.93V20H8v2h8v-2h-3v-2.07a7 7 0 0 0 6-6.93v-1h-2v1a5 5 0 0 1-10 0v-1H5z" />
  </Icon>
);

export const Lock = (props: GlyphProps) => (
  <Icon viewBox="0 0 24 24" title="Lock" {...props}>
    <path d="M8 10V7a4 4 0 0 1 8 0v3h-2V7a2 2 0 0 0-4 0v3H8z" />
    <rect x="4" y="10" width="16" height="11" rx="2" />
  </Icon>
);
