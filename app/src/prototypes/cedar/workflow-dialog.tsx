import * as React from 'react';
import { useStyletron } from 'baseui';
import type { Theme } from 'baseui/theme';
import { Button, KIND, SIZE } from 'baseui/button';
import { ChevronLeft, X } from 'lucide-react';
import { OverlayCard, PLACEMENT, type OverlayCardOverrides, type Placement } from '../../rocoto/overlay-card';
import { PHONE_MAX, usePhone } from './shell/viewport';

export const WORKFLOW_WIDTH = 800;
/** THE CEILING, NOT THE HEIGHT (§131 · §182.2 · E193.21). It used to be both, and that is what
 *  Peter saw: «Why is there so much space there?» — New product's two doors sat at the top of an
 *  800×600 box with 367px of white under them at 1600 and 571px at 390, and Stock update's tabs,
 *  one field and one empty block left 305/466. A frame that is 600px tall whatever is inside it
 *  is not a frame, it is a room with the furniture pushed against one wall. */
export const WORKFLOW_HEIGHT = 600;

/** Task dialogs share a frame. Popovers, object sheets and media viewers keep their own roles.
 *
 * THE FRAME IS AS TALL AS ITS STEP, up to the ceiling it already had (E193.21). `height: auto` is
 * BASE'S OWN Modal law — Base sizes a modal to its content and caps it; the fixed 600 was
 * Rocoto's override, so this is a return to the thing we lifted rather than a new invention
 * («never redraw — lift the real thing»). The body still owns the scrollport: capped by
 * `maxHeight`, the flex column compresses the body and it scrolls exactly as it did, so every
 * other task that uses this frame — the price run, the journey, the phone-connection walk, the
 * export centre — still fits, because their content already exceeded the cap.
 *
 * ON A PHONE THE FRAME DOCKS AND RISES TO ITS STEP. A task owns the phone's screen when it needs
 * it (the cap is the whole visual viewport, so a long task is unchanged), and a short one comes
 * up from the bottom edge as a sheet — the app's own phone pattern since §197.3 («inline on a
 * desk, a slide-up sheet on a phone… as per usual»). The scrim is the height of the VISUAL
 * viewport rather than the layout one, so a docked sheet's bottom edge is the top of the
 * keyboard and never behind it.
 *
 * ONE BREAKPOINT. This block asked `max-width: 600px` while the whole app asks `usePhone()` at
 * 559 (`shell/viewport.ts` PHONE_MAX), so 560–600px got the phone's card inside a desk's layout.
 * It reads the house's own number now.
 */
export function workflowCardOverrides({
  expanded = false,
  anchored = false,
  padded = false,
  visualHeight,
}: { expanded?: boolean; anchored?: boolean; padded?: boolean; visualHeight?: number } = {}): OverlayCardOverrides {
  const viewportHeight = visualHeight ? `${Math.floor(visualHeight)}px` : '100dvh';
  const phone = `@media (max-width: ${PHONE_MAX}px)`;
  return {
    Root: { style: { zIndex: 9, overflow: 'hidden' } },
    Scrim: {
      style: {
        boxSizing: 'border-box',
        paddingTop: anchored ? '64px' : '24px',
        paddingRight: '24px',
        paddingBottom: '24px',
        paddingLeft: '24px',
        alignItems: anchored ? 'flex-start' : 'center',
        justifyContent: anchored ? 'flex-end' : 'center',
        backdropFilter: expanded ? 'blur(10px)' : 'blur(5px)',
        WebkitBackdropFilter: expanded ? 'blur(10px)' : 'blur(5px)',
        [phone]: {
          paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
          alignItems: 'flex-end', justifyContent: 'stretch',
          height: viewportHeight, minHeight: viewportHeight, maxHeight: viewportHeight,
        },
      },
    },
    Card: {
      props: { 'data-workflow-frame': expanded ? 'expanded' : 'standard', 'data-workflow-fit': expanded ? 'screen' : 'content' },
      style: ({ $theme }: { $theme: Theme }) => ({
        width: expanded ? 'min(1160px, calc(100vw - 48px))' : `${WORKFLOW_WIDTH}px`,
        maxWidth: '100%',
        height: expanded ? `calc(${viewportHeight} - 88px)` : 'auto',
        minHeight: 0,
        maxHeight: anchored ? `calc(${viewportHeight} - 88px)` : `min(${WORKFLOW_HEIGHT}px, calc(${viewportHeight} - 48px))`,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        paddingTop: padded ? $theme.sizing.scale700 : 0,
        paddingRight: padded ? $theme.sizing.scale700 : 0,
        paddingBottom: padded ? $theme.sizing.scale700 : 0,
        paddingLeft: padded ? $theme.sizing.scale700 : 0,
        display: 'flex', flexDirection: 'column',
        overflowX: 'hidden', overflowY: padded ? 'auto' : 'hidden',
        boxShadow: $theme.lighting.shadow600,
        /* The corners are the CARD's own docked law (top rounded, bottom square on the edge it
           sits on), so this block states height and width and touches no radius. */
        /* ⚠ THE ONE LINE THAT MAKES `expanded` MEAN THE SAME THING ON BOTH POSTURES (E200.03 ·
           THE-OUTPUTS-SPEC OUT-04.3). This branch forced `height: 'auto'`, so a phone sheet grew
           to its content whatever the caller asked for — which is why the print screen arrived as
           a small card on a 360px phone and Peter could not find its pager: «the print screen
           should be full screen mobile». An expanded frame now takes the VISUAL viewport, which
           the Scrim above already does, so the frame and its scrim agree. Every other caller
           passes no `expanded` and keeps the content-height sheet it has today. */
        [phone]: { width: '100%', height: expanded ? viewportHeight : 'auto', maxHeight: viewportHeight },
      }),
    },
  };
}

/** A frame docks on a phone and is centred on a desk. The placement is a PROP rather than a media
 *  query because the card's motion turns on it: a docked sheet comes up from below and goes back
 *  down, and one that faded in where it stands would read as a fault (overlay-card's own words).
 *  Every housing of this frame asks here so the three of them cannot drift apart. */
export function useWorkflowPlacement(): Placement {
  return usePhone() ? PLACEMENT.bottom : PLACEMENT.center;
}

export type WorkflowDialogProps = {
  /** `data-*` facts a dialog states on its own frame — the element that carries `testId` — so a
   *  drive reads them off the frame it already finds (the advance dialog's `data-prefilled-minor`). */
  dataProps?: Record<`data-${string}`, string | number>;
  isOpen?: boolean;
  title: string;
  ariaLabel?: string;
  onClose: () => void;
  onBack?: () => void;
  step?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  /** A thread owns its scrollport and composer instead of the form-body gutter. */
  flush?: boolean;
  /** Some nested steps use Back as their single visible exit. */
  showClose?: boolean;
};

/** The on-screen keyboard changes the visual viewport without changing the layout viewport on
 * iOS and some Chromium shells. Every task frame reads that smaller box directly, then keeps the
 * focused field inside its own scrollport. This is shared here so Product, Customer, Export and
 * order forms cannot each invent a slightly different keyboard workaround. */
export function useWorkflowViewport(isOpen: boolean): number | undefined {
  const [height, setHeight] = React.useState<number>();
  React.useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) {
      setHeight(undefined);
      return;
    }
    const viewport = window.visualViewport;
    let frame = 0;
    const read = () => {
      setHeight(viewport.height);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !active.closest('[data-workflow-frame]')) return;
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };
    read();
    viewport.addEventListener('resize', read);
    viewport.addEventListener('scroll', read);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', read);
      viewport.removeEventListener('scroll', read);
    };
  }, [isOpen]);
  return height;
}

/** One focus boundary, one scrollport and an action row which never scrolls out of reach. */
export function WorkflowDialog({ isOpen = true, title, ariaLabel, ...content }: WorkflowDialogProps) {
  const visualHeight = useWorkflowViewport(isOpen);
  const placement = useWorkflowPlacement();
  return <OverlayCard isOpen={isOpen} onClose={content.onClose} size={WORKFLOW_WIDTH} placement={placement} ariaLabel={ariaLabel ?? title} overrides={workflowCardOverrides({ visualHeight })}><WorkflowContent title={title} {...content} /></OverlayCard>;
}

export function WorkflowContent({ title, onClose, onBack, step, actions, children, testId, flush = false, showClose = true, closeTestId = 'workflow-close', backTestId = 'workflow-back', dataProps }: Omit<WorkflowDialogProps, 'isOpen' | 'ariaLabel'> & { closeTestId?: string; backTestId?: string }) {
  const [css, theme] = useStyletron();
  const titleId = React.useId();
  const control = { BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', flexShrink: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 } } };
  return (
      <div data-testid={testId} {...dataProps} className={css({ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%' })}>
        <header className={css({ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexShrink: 0, minHeight: '64px', paddingLeft: theme.sizing.scale600, paddingRight: theme.sizing.scale600, borderBottom: `1px solid ${theme.colors.borderOpaque}` })}>
          {onBack && <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Back" data-testid={backTestId} onClick={onBack} overrides={control}><ChevronLeft size={20} aria-hidden /></Button>}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h2 id={titleId} style={{ ...theme.typography.HeadingXSmall, margin: 0, overflowWrap: 'anywhere' }}>{title}</h2>
            {step && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{step}</span>}
          </div>
          {showClose && <Button kind={KIND.tertiary} size={SIZE.compact} aria-label={`Close ${title.toLowerCase()}`} data-testid={closeTestId} onClick={onClose} overrides={control}><X size={20} aria-hidden /></Button>}
        </header>
        <div data-testid="workflow-body" className={css({ flex: '1 1 auto', minHeight: 0, minWidth: 0, overflowY: flush ? 'hidden' : 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', padding: flush ? 0 : theme.sizing.scale800, '@media (max-width: 600px)': { padding: flush ? 0 : theme.sizing.scale600 } })}>
          {children}
        </div>
        {actions && <footer data-testid="workflow-actions" className={css({ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: theme.sizing.scale400, flexShrink: 0, minHeight: '68px', boxSizing: 'border-box', paddingTop: theme.sizing.scale400, paddingRight: theme.sizing.scale800, paddingBottom: theme.sizing.scale400, paddingLeft: theme.sizing.scale800, borderTop: `1px solid ${theme.colors.borderOpaque}`, backgroundColor: theme.colors.backgroundPrimary, '@media (max-width: 600px)': { minHeight: '64px', paddingLeft: theme.sizing.scale600, paddingRight: theme.sizing.scale600, paddingBottom: `max(${theme.sizing.scale400}, env(safe-area-inset-bottom))`, '> button': { minHeight: '44px' } } })}>{actions}</footer>}
      </div>
  );
}
