/* The demo shelf drives only the explicit theatre ledger controller. Timers live here so closing
 * Chats or changing house cancels a viewing sequence without touching its recorded events. */
import * as React from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { useStyletron } from 'baseui';
import type { Cast } from '../../../scenarios/data/cast';
import { useDay } from '../day';
import {
  advanceTheatre,
  resetTheatre,
  theatreScenesOf,
  theatreStatus,
  type TheatreScenario,
  type TheatreStatus,
} from './theatre';

/** Time to read each landed beat before the following one arrives. */
const AFTER: Record<string, number> = {
  processing: 1000,
  arrived: 1000,
  changed: 2500,
  amended: 1500,
  deferred: 1000,
};

const titleOf = (scenario: TheatreScenario): string =>
  scenario === 'order' ? 'Incoming order' : 'Question for the desk';

const actionOf = (status: TheatreStatus): string => {
  if (status.completed.length === 0) return 'Play';
  if (!status.next) return 'Replay';
  return 'Continue';
};

const progressOf = (status: TheatreStatus): string => {
  const complete = status.steps.filter((step) => step.complete);
  const last = complete[complete.length - 1];
  if (!last) return 'Ready';
  if (!status.next) return 'Complete';
  return ({ received: 'Received', processing: 'Reading', arrived: 'Order added', changed: 'Changed' } as Record<string, string>)[last.id]
    ?? 'In progress';
};

type TheatrePlayer = {
  scenes: ReturnType<typeof theatreScenesOf>;
  status: (scenario: TheatreScenario) => TheatreStatus;
  running: (scenario: TheatreScenario) => boolean;
  play: (scenario: TheatreScenario, replay: boolean) => void;
};

/** The player lives at the Chats overlay level: navigating from its list to the native customer
 * thread must not interrupt a demo, while closing the workspace must. */
export function useTheatrePlayer(
  cast: Cast,
  onOpen: (id: string) => void,
  workspaceOpen: boolean,
  onPreferOrder?: (threadId: string, saleId: string) => void,
): TheatrePlayer {
  const edits = useDay(cast.sector);
  const timers = React.useRef<Partial<Record<TheatreScenario, number>>>({});

  const stop = React.useCallback((scenario?: TheatreScenario) => {
    const keys = scenario ? [scenario] : (Object.keys(timers.current) as TheatreScenario[]);
    keys.forEach((key) => {
      const timer = timers.current[key];
      if (timer !== undefined) window.clearTimeout(timer);
      delete timers.current[key];
    });
  }, []);

  React.useEffect(() => {
    if (!workspaceOpen) stop();
    return () => stop();
  }, [workspaceOpen, cast.sector, stop]);

  const play = React.useCallback((scenario: TheatreScenario, replay: boolean) => {
    stop(scenario);
    const scene = theatreScenesOf(cast).find((candidate) => candidate.scenario === scenario);
    if (!scene) return;
    if (replay) resetTheatre(cast, scenario);
    onOpen(scene.threadId);
    onPreferOrder?.(scene.threadId, scene.saleId);
    const advance = () => {
      const status = advanceTheatre(cast, scenario);
      if (!status.next) {
        delete timers.current[scenario];
        return;
      }
      timers.current[scenario] = window.setTimeout(advance, AFTER[status.next] ?? 1000);
    };
    advance();
  }, [cast, onOpen, onPreferOrder, stop]);

  const status = React.useCallback(
    (scenario: TheatreScenario) => theatreStatus(cast, scenario, edits),
    [cast, edits],
  );
  const running = React.useCallback((scenario: TheatreScenario) => timers.current[scenario] !== undefined, []);
  return { scenes: theatreScenesOf(cast), status, running, play };
}

/** Two compact, explicit controls. Their events and conversation rows are the existing native
 * projections; this shelf only gives the kit a repeatable way to play them. */
export function TheatreControls({ player }: { player: TheatrePlayer }) {
  const [, theme] = useStyletron();
  return (
    <section data-testid="theatre-controls" aria-label="Test conversations"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200,
        padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale400} ${theme.sizing.scale600}` }}>
      {player.scenes.map((scene) => {
        const status = player.status(scene.scenario);
        const running = player.running(scene.scenario);
        const complete = !status.next;
        const replay = complete;
        return (
          <div key={scene.id} data-testid={`theatre-scene-${scene.scenario}`}
            data-theatre-sale={scene.saleId} data-theatre-thread={scene.threadId}
            data-status={status.next ?? 'complete'}
            style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300,
              padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`,
              border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300,
              background: theme.colors.backgroundSecondary, minWidth: 0 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelXSmall }}>Test · {titleOf(scene.scenario)}</span>
              <span data-testid={`theatre-progress-${scene.scenario}`}
                style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {scene.customer.name} · {running ? 'Playing' : progressOf(status)}
              </span>
            </span>
            <Button kind={replay ? KIND.secondary : KIND.tertiary} size={SIZE.mini}
              data-testid={replay ? `theatre-replay-${scene.scenario}` : `theatre-play-${scene.scenario}`}
              disabled={running}
              onClick={() => player.play(scene.scenario, replay)}>
              {running ? 'Playing' : actionOf(status)}
            </Button>
          </div>
        );
      })}
    </section>
  );
}
