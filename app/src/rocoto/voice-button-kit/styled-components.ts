/* GROWN from Base Web's own `src/template-component/styled-components.ts`, and shaped like
 * `src/button/styled-components.ts`: the paint of a state lives in a small function of the theme,
 * and the component only says which state it is in.
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY COLOUR HERE IS READ FROM BASE'S THEME. No hex, no rgba, no named colour.
 *
 * AND THE MIC IS INK, not the brand's accent. This is the one place a reader might expect the
 * accent, because the accent is the loudest colour in the system and the mic is the loudest
 * control on the surface. It gets ink anyway: in this system the accent marks Rocoto's own act,
 * and a person recording their own voice is the person's act. The button that starts it belongs
 * to the same ink as every other button a hand presses.
 */
import { styled } from 'baseui';
import { LOCK_CHIP_MAX, METER_WIDTH } from './constants';
import type { SharedStyleProps } from './types';

/* THE CONTROL SIZE. Base's own control heights — a 48px default that lines up with a default
 * Input and a default Button, and a 40px compact that lines up with their compact steps. */
const controlSize = ($theme: { sizing: { scale1000: string; scale1200: string } }, size: string) =>
  size === 'compact' ? $theme.sizing.scale1000 : $theme.sizing.scale1200;

/** the microphone is open — the one thing on this control that moves on its own */
const blink = {
  from: { opacity: 1 },
  to: { opacity: 0.25 },
};

export const Root = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale300,
  width: '100%',
  minWidth: 0,
}));
Root.displayName = 'VoiceButton';

/* THE ROW. Bottom-aligned, because the lock chip grows UPWARD out of the mic's box: the mic stays
 * put on the baseline it shares with the bar, and the chip appears above it. */
export const Row = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  gap: $theme.sizing.scale300,
  width: '100%',
  minWidth: 0,
}));
Row.displayName = 'VoiceButtonRow';

/* THE RECORDING BAR takes the writing surface's place, so it wears the writing surface's paint:
 * Base's own input fill and input radius, at the same height as a default Input. */
export const Bar = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  display: 'flex',
  alignItems: 'center',
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minWidth: 0,
  boxSizing: 'border-box',
  height: controlSize($theme, $size),
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
  gap: $theme.sizing.scale400,
  borderRadius: $theme.borders.inputBorderRadius,
  backgroundColor: $theme.colors.backgroundSecondary,
  overflow: 'hidden',
}));
Bar.displayName = 'VoiceButtonBar';

export const Dot = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  width: $theme.sizing.scale300,
  height: $theme.sizing.scale300,
  flexGrow: 0,
  flexShrink: 0,
  borderRadius: '50%',
  backgroundColor: $theme.colors.contentPrimary,
  animationName: blink,
  animationDuration: $theme.animation.timing600,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  animationTimingFunction: $theme.animation.easeInOutCurve,
  // a blink is information, not decoration — held steady rather than dropped for those who ask
  '@media (prefers-reduced-motion: reduce)': {
    animationName: 'none',
    opacity: 0.6,
  },
}));
Dot.displayName = 'VoiceButtonDot';

/* Tabular figures: 0:09 → 0:10 must not shove the meter sideways. */
export const Timer = styled<'span', SharedStyleProps>('span', ({ $theme, $size, $disabled }) => ({
  ...$theme.typography[
    ($size === 'compact' ? 'LabelSmall' : 'LabelMedium') as keyof typeof $theme.typography
  ],
  color: $disabled ? $theme.colors.contentStateDisabled : $theme.colors.contentPrimary,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
  flexGrow: 0,
  flexShrink: 0,
  whiteSpace: 'nowrap',
}));
Timer.displayName = 'VoiceButtonTimer';

export const Meter = styled<'div', SharedStyleProps>('div', ({ $size }) => ({
  display: 'flex',
  alignItems: 'center',
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minWidth: 0,
  maxWidth: `${METER_WIDTH[$size]}px`,
}));
Meter.displayName = 'VoiceButtonMeter';

/* «Slide to cancel» rides the finger: it translates with the drag and fades as the zone nears, so
 * the sentence is visibly being acted on rather than merely displayed. */
export const CancelHint = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale100,
  color: $theme.colors.contentSecondary,
  ...$theme.typography.LabelSmall,
  flexGrow: 0,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  transitionProperty: 'opacity, transform',
  transitionDuration: $theme.animation.timing100,
  transitionTimingFunction: $theme.animation.linearCurve,
}));
CancelHint.displayName = 'VoiceButtonCancelHint';

/* Once the zone is armed the whole row says one thing. Ink, at full strength — the sentence
 * carries the meaning, and this system keeps no colour for warnings. */
export const CancelZone = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale400,
  width: '100%',
  minWidth: 0,
  color: $theme.colors.contentPrimary,
  ...$theme.typography.LabelMedium,
}));
CancelZone.displayName = 'VoiceButtonCancelZone';

/* THE MIC'S BOX reserves the lock chip's tallest state for as long as the chip can appear, so the
 * row does not jump while the chip shrinks toward the lock line under the finger. */
export const MicBox = styled<'div', SharedStyleProps>(
  'div',
  ({ $theme, $size, $phase, $cancelArmed }) => {
    const chipVisible = $phase === 'recording' && !$cancelArmed;
    const control = controlSize($theme, $size);
    return {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: $theme.sizing.scale300,
      width: control,
      minHeight: chipVisible
        ? `calc(${control} + ${LOCK_CHIP_MAX}px + ${$theme.sizing.scale300})`
        : control,
      flexGrow: 0,
      flexShrink: 0,
    };
  }
);
MicBox.displayName = 'VoiceButtonMicBox';

export const Mic = styled<'button', SharedStyleProps>(
  'button',
  ({ $theme, $size, $disabled, $isFocusVisible }) => {
    const control = controlSize($theme, $size);
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: control,
      height: control,
      flexGrow: 0,
      flexShrink: 0,
      boxSizing: 'border-box',
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderTopStyle: 'none',
      borderBottomStyle: 'none',
      borderLeftStyle: 'none',
      borderRightStyle: 'none',
      borderRadius: '50%',
      WebkitAppearance: 'none',
      outline: 'none',
      cursor: $disabled ? 'not-allowed' : 'pointer',
      // the drag IS the gesture; the page must not scroll out from under the finger
      touchAction: 'none',
      WebkitTapHighlightColor: 'transparent',
      backgroundColor: $disabled ? $theme.colors.buttonDisabledFill : $theme.colors.buttonPrimaryFill,
      color: $disabled ? $theme.colors.buttonDisabledText : $theme.colors.buttonPrimaryText,
      boxShadow: $isFocusVisible
        ? `inset 0 0 0 ${$theme.sizing.scale0} ${$theme.colors.borderAccent}`
        : 'none',
      transitionProperty: 'background-color, opacity',
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: $theme.animation.linearCurve,
      ':hover': $disabled ? {} : { backgroundColor: $theme.colors.buttonPrimaryHover },
      ':active': $disabled ? {} : { backgroundColor: $theme.colors.buttonPrimaryActive },
    };
  }
);
Mic.displayName = 'VoiceButtonMic';

/* THE LOCK CHIP — the only affordance that teaches the gesture. It states the destination (a
 * lock) and the direction (up), and it shortens as the finger climbs, so the distance left to
 * travel is the height of the thing you are travelling toward. */
export const LockChip = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  boxSizing: 'border-box',
  width: $theme.sizing.scale1000,
  paddingTop: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale300,
  borderRadius: $theme.borders.radius500,
  backgroundColor: $theme.colors.backgroundPrimary,
  boxShadow: `inset 0 0 0 ${$theme.borders.border200.borderWidth} ${$theme.colors.borderTransparent}, ${$theme.lighting.shadow400}`,
  color: $theme.colors.contentPrimary,
  flexGrow: 0,
  flexShrink: 0,
  transitionProperty: 'height',
  transitionDuration: $theme.animation.timing100,
  transitionTimingFunction: $theme.animation.easeOutCurve,
}));
LockChip.displayName = 'VoiceButtonLockChip';

/* HANDS-FREE. The finger is gone, so the control grows the two verbs it now needs — and it takes
 * the whole row, because there is nothing else to share it with. */
export const LockedPanel = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale300,
  width: '100%',
  minWidth: 0,
}));
LockedPanel.displayName = 'VoiceButtonLockedPanel';

export const LockedPill = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  height: controlSize($theme, $size),
  paddingLeft: $theme.sizing.scale600,
  paddingRight: $theme.sizing.scale600,
  gap: $theme.sizing.scale400,
  borderRadius: $theme.borders.inputBorderRadius,
  backgroundColor: $theme.colors.backgroundSecondary,
  overflow: 'hidden',
}));
LockedPill.displayName = 'VoiceButtonLockedPill';

/* `border-box` is load-bearing: a full-width row that takes its padding OUTSIDE its width is 8px
 * wider than the box it stands in, and both verbs hang past the panel's edges. Measured on the
 * desk's 340px column, where 4px of a send control was painting outside the composer. */
export const LockedControls = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: $theme.sizing.scale300,
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  paddingLeft: $theme.sizing.scale100,
  paddingRight: $theme.sizing.scale100,
}));
LockedControls.displayName = 'VoiceButtonLockedControls';

export const HandsFree = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale100,
  paddingLeft: $theme.sizing.scale300,
  paddingRight: $theme.sizing.scale300,
  paddingTop: $theme.sizing.scale0,
  paddingBottom: $theme.sizing.scale0,
  borderRadius: $theme.borders.tagBorderRadius,
  backgroundColor: $theme.colors.backgroundTertiary,
  color: $theme.colors.contentPrimary,
  ...$theme.typography.LabelXSmall,
  flexGrow: 0,
  flexShrink: 0,
  whiteSpace: 'nowrap',
}));
HandsFree.displayName = 'VoiceButtonHandsFree';

/* DISCARD is minimal and SEND is filled: the weight of the two controls states which one the
 * recorder expects, without either of them needing a colour to say it. */
export const Discard = styled<'button', SharedStyleProps>(
  'button',
  ({ $theme, $size, $isFocusVisible }) => {
    const control = controlSize($theme, $size);
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: control,
      height: control,
      flexGrow: 0,
      flexShrink: 0,
      boxSizing: 'border-box',
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderTopStyle: 'none',
      borderBottomStyle: 'none',
      borderLeftStyle: 'none',
      borderRightStyle: 'none',
      borderRadius: '50%',
      WebkitAppearance: 'none',
      outline: 'none',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      color: $theme.colors.contentSecondary,
      boxShadow: $isFocusVisible
        ? `inset 0 0 0 ${$theme.sizing.scale0} ${$theme.colors.borderAccent}`
        : 'none',
      transitionProperty: 'background-color, color',
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: $theme.animation.linearCurve,
      ':hover': {
        backgroundColor: $theme.colors.backgroundSecondary,
        color: $theme.colors.contentPrimary,
      },
    };
  }
);
Discard.displayName = 'VoiceButtonDiscard';

export const Send = styled<'button', SharedStyleProps>(
  'button',
  ({ $theme, $size, $isFocusVisible }) => {
    const control = controlSize($theme, $size);
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: control,
      height: control,
      flexGrow: 0,
      flexShrink: 0,
      boxSizing: 'border-box',
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderTopStyle: 'none',
      borderBottomStyle: 'none',
      borderLeftStyle: 'none',
      borderRightStyle: 'none',
      borderRadius: '50%',
      WebkitAppearance: 'none',
      outline: 'none',
      cursor: 'pointer',
      backgroundColor: $theme.colors.buttonPrimaryFill,
      color: $theme.colors.buttonPrimaryText,
      boxShadow: $isFocusVisible
        ? `inset 0 0 0 ${$theme.sizing.scale0} ${$theme.colors.borderAccent}`
        : 'none',
      transitionProperty: 'background-color',
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: $theme.animation.linearCurve,
      ':hover': { backgroundColor: $theme.colors.buttonPrimaryHover },
      ':active': { backgroundColor: $theme.colors.buttonPrimaryActive },
    };
  }
);
Send.displayName = 'VoiceButtonSend';

export const Hint = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale200,
  ...$theme.typography.LabelSmall,
  color: $theme.colors.contentSecondary,
}));
Hint.displayName = 'VoiceButtonHint';
