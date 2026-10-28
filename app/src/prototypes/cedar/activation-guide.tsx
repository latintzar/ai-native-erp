/* THE GUIDED LAYER — the walk through the live app (THE-JOURNEY-CANON §3.4, §3.5 · FEED-IA §91.4.7).
 *
 * «Then the platform, like the racing games: you always start with a test race and then the free
 * world. They land, see the whole thing, and the guide allows ONE act: "First, click on the chat
 * bubble" — nothing else works.»
 *
 * ═══ THE FRAMEWORK IS RULED, AND THE SPIKE RAN FIRST (§3.5) ═════════════════════════════════
 * The canon rules `react-joyride` 3.2.0, MIT, in CONTROLLED mode, on two properties nothing else in
 * the field gives: **the popover is OUR component**, and documented accessibility (`role`,
 * `aria-modal`, a real focus trap, a configurable Escape). Shepherd.js and intro.js are AGPL-3.0
 * with a paid commercial tier and are banned for a revenue-generating product; driver.js 1.8.0 is
 * the named fallback, and it was actually installed, wired and driven before this file existed —
 * it works, and it loses on the one clause that decides it: its chrome is CSS classes, so the
 * app's least-designed object would stand on the first screen a customer ever sees.
 *
 * ⚠ THE ACCEPTANCE TEST THE CANON ORDERED (§3.5, point 2) lives in this file as `paneSpike()`:
 * spotlight a control INSIDE a §38 pane that scrolls independently of the page, at 1600 and at 390.
 * It is kept as a preset rather than deleted after passing, because §38 is the app's own law and a
 * library that regresses on it would break the guide silently.
 *
 * ═══ THE LAW THE LIBRARY DOES NOT GIVE US, AND THIS FILE DOES (§3.4.6 · §91.5) ══════════════
 * «Clicking THE ACTUAL THING or clicking Next both advance — the action happens regardless.»
 *
 *   they press the real control  → the app's own handler runs, because the highlighted element IS
 *                                  the real control (`blockTargetInteraction` stays false, so the
 *                                  spotlight cuts through), and a one-shot listener moves the walk.
 *                                  The act is NOT re-run: it already happened, by their hand.
 *   they press Next              → the step's own ACT is run for them, then the walk moves on.
 *
 * The consequence is the point: the walk can never leave a person somewhere the app is not.
 *
 * ═══ WHAT THE LIBRARY DOES NOT SETTLE, AND ROCOTO OWNS (§3.5) ═══════════════════════════════
 *   1 · `prefers-reduced-motion` is unconfirmed for every package in the field, so the guide reads
 *       `useCalm()` — the rail's own hook — and switches joyride's scrolling and its transition off
 *       itself. Motion is Rocoto's to stop, never a library's to have thought about.
 *   2 · The STATE is Rocoto's (§27.16 · §3.6). The library presents; `activation.ts`'s ledger is
 *       what the account HAS DONE. Remove the guide and nothing about the account changes.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Joyride, ACTIONS, EVENTS, ORIGIN, type EventData, type Step, type TooltipRenderProps } from 'react-joyride';
import type { Cast } from '../../scenarios/data/cast';
import { record } from './activation';
import { useCalm } from './shell/rail';

export type GuideStep = {
  /** the ONE thing that is pressable while this step stands */
  target: string;
  title: string;
  body: string;
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'auto' | 'center';
  /** what pressing it does. Run on Next; not run when they pressed the thing themselves. */
  act?: () => void;
  /** how long the app needs before the next step's target exists — a panel that animates in */
  settle?: number;
  /** ── THE CUTOUT TAKES THE TARGET'S OWN SHAPE (the acceptance walk, P2-3) ──────────────────
   *  The mask is one rounded rectangle for every step, so over the round launcher it left four lit
   *  corners around a circle — a spotlight drawing a shape the app does not have. A step whose
   *  target is round says so, and the mask is its own radius plus the padding around it. */
  radius?: number;
};

/** Press a real control, the way a person does. A missing one is a no-op rather than a throw: a
 *  step whose element left the screen must not take the walk down with it. */
const press = (selector: string): void => {
  document.querySelector<HTMLElement>(selector)?.click();
};

/** THE WALK (§91.4.7), in Peter's own order: bubble → the chat → full screen → the test chat. */
export function firstSteps(): GuideStep[] {
  return [
    {
      target: '[data-testid=chats-launcher]',
      title: 'First, press the chat bubble',
      body: 'Everything your customers send you arrives here.',
      placement: 'left',
      /* the launcher is a 56px circle and the cutout pads it by 6 a side (P2-3) */
      radius: 34,
      act: () => press('[data-testid=chats-launcher][data-open=no]'),
      settle: 600,
    },
    {
      /* THE LIST'S OWN HEAD, not the whole panel: a spotlight the size of the panel is a spotlight
         that says nothing, and this is the row a person's eye lands on anyway. */
      target: '[data-testid=chats-list-header]',
      title: 'This is every conversation',
      body: 'One thread a customer. Rocoto reads them, writes the delivery note, and brings you what it '
        + 'leaves for you to settle.',
      placement: 'left',
      settle: 300,
    },
    {
      target: '[data-testid=chats-expand]',
      title: 'Give it the whole screen',
      body: 'The conversations open out, and the work stays behind them.',
      placement: 'left',
      act: () => press('[data-testid=chats-expand]'),
      settle: 600,
    },
    {
      target: '[data-testid=chats-list-header]',
      title: 'Now test it as one of your own customers',
      body: 'Write the way they write. Rocoto answers with the memory it read out of your year.',
      placement: 'bottom',
      settle: 250,
    },
  ];
}

/**
 * THE SPIKE (§3.5's acceptance test) — a control INSIDE a §38 pane that scrolls independently.
 *
 * «Behaviour inside a §38 pane is unproven — both leading packages carry a real history of
 * scroll-container bugs. So the first thing the guided layer builds is the spike: spotlight a
 * control inside a pane that scrolls independently of the page, at 1600 and at 390, screenshot
 * both, read them.»
 *
 * The river is the hardest case in the app and therefore the right one: the page itself never
 * scrolls (`data-panes=yes`), the list is one scrollport six hundred rows deep, and the target is a
 * row far enough down that the pane MUST scroll to bring it into view.
 */
export function paneSpike(): GuideStep[] {
  return [
    {
      target: '[data-guide-target="pane-spike"]',
      title: 'A row deep inside a pane',
      body: 'The scroll lives in this pane. This row is inside a scrollport of its own, and the '
        + 'spotlight has to find it there.',
      placement: 'right',
    },
    {
      target: '[data-testid=chats-launcher]',
      title: 'And a control fixed to the viewport',
      body: 'The other half of the same question: a spotlight over something the pane holds fixed.',
      placement: 'left',
      radius: 34,
    },
  ];
}

/* ═══ THE START SEAM ═════════════════════════════════════════════════════════════════════════
 * A walk is started from three places — the journey modal's own act, a drive, and (later) P1's
 * roleplay beats — so it is a tiny published store rather than a prop threaded through the frame.
 * Same shape as every other store in this app.
 */
type Preset = { id: string; steps: GuideStep[]; onEnd?: () => void };

let RUNNING: Preset | null = null;
const listeners = new Set<() => void>();

const publish = (next: Preset | null): void => {
  RUNNING = next;
  for (const fn of listeners) fn();
};

/** Start a walk. One at a time, always: a second spotlight over a first is two overlays and no
 *  single pressable thing, which is the one property §91.4.7 is about. */
export function startGuide(preset: Preset): void {
  if (RUNNING) return;
  publish(preset);
}

export function stopGuide(): void {
  publish(null);
}

export const guideRunning = (): boolean => RUNNING !== null;

const useRunning = (): Preset | null =>
  React.useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => RUNNING,
    () => RUNNING,
  );

/* ═══ OUR OWN POPOVER (§3.5's decisive clause) ═══════════════════════════════════════════════
 * «Every surface in this app is Base Web on the Rocoto theme. A library's own chrome would be the
 * single un-designed object in the product, on the screen a customer sees first.» So the tooltip is
 * a component of ours: the app's own card, the app's own type steps, the app's own buttons. The
 * library hands it position, the accessibility props and the two handlers, and draws none of it.
 */
function GuideTooltip({
  index,
  size,
  step,
  backProps,
  primaryProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps) {
  const [, theme] = useStyletron();
  return (
    <div
      {...tooltipProps}
      data-testid="guide-popover"
      data-step={index}
      /* ── THE POPOVER IS NOT «OUTSIDE» ANYTHING (found by driving it) ───────────────────────
       * joyride portals the popover to the end of the body, so a press on its Next button is a
       * DOCUMENT-LEVEL click as far as every layer in this app is concerned — and Base's `Layer`
       * closes on exactly that. Pressing Next on the step that points AT the conversation therefore
       * shut the conversation and took the walk down with it.
       * `stopPropagation` on the NATIVE event is what fixes it: React's listener sits on the root
       * container, so stopping the native flow there keeps the press from ever reaching the
       * document listeners the layers are built on. The buttons inside have already handled it. */
      onMouseDown={(e) => e.nativeEvent.stopPropagation()}
      onClick={(e) => e.nativeEvent.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale500,
        width: '320px',
        maxWidth: 'calc(100vw - 32px)',
        boxSizing: 'border-box',
        padding: theme.sizing.scale600,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        boxShadow: theme.lighting.shadow600,
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2 data-testid="guide-title" style={{ margin: 0, ...theme.typography.LabelLarge }}>
          {step.title}
        </h2>
        <p
          style={{
            margin: `${theme.sizing.scale300} 0 0`,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          {step.content}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
        <span
          data-testid="guide-progress"
          style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}
        >
          {index + 1} of {size}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: theme.sizing.scale300 }}>
          {index > 0 && (
            <Button {...(backProps as unknown as Record<string, unknown>)} kind={KIND.tertiary} size={SIZE.compact} data-testid="guide-back">
              Back
            </Button>
          )}
          <Button {...(primaryProps as unknown as Record<string, unknown>)} kind={KIND.primary} size={SIZE.compact} data-testid="guide-next">
            {/* «Continue», never «Next» (FEED-IA §108.1) — one word, every flow. */}
            {isLastStep ? 'Start testing' : 'Continue'}
          </Button>
        </span>
      </div>
    </div>
  );
}

/* ═══ THE HOST ═══════════════════════════════════════════════════════════════════════════════
 * Mounted once by the frame. It owns `stepIndex` — controlled mode, which is what makes «Next
 * performs the act» possible at all: the host decides when the walk moves, so it can do the thing
 * first.
 */
export function GuideHost({ cast }: { cast: Cast }) {
  const [, theme] = useStyletron();
  const preset = useRunning();
  const calm = useCalm();
  const [index, setIndex] = React.useState(0);
  /** true while the person's own press is what moved the walk on, so the act is not run twice */
  const byHand = React.useRef(false);

  const steps = preset?.steps ?? [];

  /* ── THE DRIVE'S AND THE DEMO'S WAY IN ──────────────────────────────────────────────────────
   * A walk normally starts from the card's own act. The SPIKE (§3.5's acceptance test) has no card
   * of its own, and an acceptance test that can only be run by hand is one nobody runs — so the
   * host listens for one named event and starts a preset by id. It is the same seam P1 will use to
   * start the roleplay's beats from inside the test chat. No other surface, no other trigger.
   */
  React.useEffect(() => {
    const onStart = (e: Event) => {
      const id = (e as CustomEvent<{ preset?: string }>).detail?.preset;
      if (id === 'pane-spike') startGuide({ id, steps: paneSpike() });
      if (id === 'first-steps') startGuide({ id, steps: firstSteps() });
    };
    window.addEventListener('rocoto-guide', onStart);
    return () => window.removeEventListener('rocoto-guide', onStart);
  }, []);

  React.useEffect(() => {
    if (preset) setIndex(0);
  }, [preset]);

  /* ── THE OTHER HALF OF THE LAW (§3.4.6) ──────────────────────────────────────────────────
   * joyride advances on ITS button. Pressing the real control has to advance too, and the library
   * has no opinion about that — so while a step stands, a one-shot listener rides its target. The
   * element is the app's own: its handler runs first, and this only moves the pointer after it. */
  React.useEffect(() => {
    const step = steps[index];
    if (!preset || !step) return undefined;
    let el: Element | null = null;
    const onPress = () => {
      byHand.current = true;
      window.setTimeout(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), step.settle ?? 300);
    };
    /* THE TARGET MAY ARRIVE A MOMENT AFTER THE STEP DOES — a panel animates in. Poll briefly rather
       than binding to nothing and silently losing half the law. */
    let tries = 0;
    const find = window.setInterval(() => {
      el = document.querySelector(step.target);
      tries += 1;
      if (el) {
        el.addEventListener('click', onPress, { once: true });
        window.clearInterval(find);
      } else if (tries > 30) {
        window.clearInterval(find);
      }
    }, 100);
    return () => {
      window.clearInterval(find);
      el?.removeEventListener('click', onPress);
    };
  }, [preset, index, steps]);

  const onEvent = React.useCallback((data: EventData) => {
    const { action, origin, type } = data;
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
      const step = steps[index];
      /* NEXT DOES THE THING. This is the half a tour library never has: the popover's button is not
         «acknowledge», it is the same act the control is. Pressing the control itself is handled
         above, and `byHand` is what stops the act running twice. */
      if (origin === ORIGIN.BUTTON_PRIMARY && !byHand.current) step?.act?.();
      byHand.current = false;
      if (index >= steps.length - 1) {
        /* THE WALK IS FINISHED, AND ROCOTO RECORDS IT (§3.6). The library is told nothing. */
        record({ cast, kind: 'guided' });
        stopGuide();
        preset?.onEnd?.();
        return;
      }
      window.setTimeout(() => setIndex(index + 1), steps[index]?.settle ?? 250);
      return;
    }
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.PREV) {
      setIndex(Math.max(index - 1, 0));
      return;
    }
    if (action === ACTIONS.CLOSE || action === ACTIONS.SKIP || type === EVENTS.TOUR_END) {
      /* ESCAPE RELEASES IT AND NOTHING IS RECORDED (§1.4). An abandoned walk is not a step taken,
         and the card offers it back. */
      stopGuide();
      preset?.onEnd?.();
    }
  }, [cast, index, preset, steps]);

  if (!preset || steps.length === 0) return null;

  const joyrideSteps: Step[] = steps.map((s) => ({
    target: s.target,
    title: s.title,
    content: s.body,
    placement: s.placement ?? 'auto',
    disableBeacon: true,
    /* P2-3 — a round target gets a round cutout; everything else keeps the seat's own 8 */
    ...(s.radius ? { spotlightRadius: s.radius } : null),
  }));

  return (
    <Joyride
      steps={joyrideSteps}
      run
      continuous
      stepIndex={index}
      onEvent={onEvent}
      tooltipComponent={GuideTooltip}
      options={{
        /* NOTHING ELSE WORKS (§91.4.7). The overlay takes every press outside the cutout, and a
           press ON the overlay does nothing at all — so the walk is finished rather than escaped.
           `blockTargetInteraction` stays FALSE, which is what keeps the real control real. */
        overlayClickAction: false,
        blockTargetInteraction: false,
        buttons: ['back', 'primary'],
        /* ESCAPE RELEASES THE WALK (§1.4). It is the app's own chain: the innermost thing first. */
        dismissKeyAction: 'close',
        skipBeacon: true,
        spotlightPadding: 6,
        spotlightRadius: 8,
        /* IT CLEARS EVERY LAYER THIS APP RAISES — the chats panel (9), its launcher (8), and the
           popovers Base opens from inside it (12). A guide painting under the thing it is pointing
           at is the one failure a spotlight cannot survive. */
        zIndex: 1000,
        /* THE SAME GROUND EVERY LAYER IN THIS APP STANDS ON. `backgroundOverlay` is the token
           `OverlayCard`'s dim scrim already uses, so the walk's mask and the journey's own modal
           recede the work by the same amount — the first spike drew this at full ink and the app
           behind it disappeared, which reads as a wall rather than as a spotlight. */
        overlayColor: theme.colors.backgroundOverlay,
        /* ── MOTION IS ROCOTO'S (§3.5, point 1) ──────────────────────────────────────────────
         * No package in the field confirms `prefers-reduced-motion`, so the guide reads the rail's
         * own `useCalm()` and switches the scroll animation off itself. */
        skipScroll: calm,
        scrollDuration: calm ? 0 : 300,
        scrollOffset: 80,
      }}
      floatingOptions={{ strategy: 'fixed' }}
    />
  );
}

/** THE JOURNEY'S OWN WALK, started from the card's modal. */
export const runFirstSteps = (a: { cast: Cast; onEnd?: () => void }): void =>
  startGuide({ id: 'first-steps', steps: firstSteps(), onEnd: a.onEnd });

export default GuideHost;
