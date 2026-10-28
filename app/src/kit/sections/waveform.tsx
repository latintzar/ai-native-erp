/* WAVEFORM — the kit page.
 *
 * Every field on this page is the real component drawing real marks off the real theme. The two
 * that move are driven by the deterministic level source that ships with the component, so this
 * page is alive on a browser that was never asked for a microphone — and identical on the second
 * load, which is what makes a screenshot of it worth diffing.
 *
 * Copy is Base's register: generic, unthemed, and about the control rather than about any
 * particular thing being said into it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Section, Tile, Grid } from '../chrome';
import { Waveform, createSimulatedAmplitude, peaksFromSeed } from '../../rocoto/waveform';

/** a label for a row inside a Tile — the kit's own furniture, not the component's */
const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        width: 68,
        flex: 'none',
      }}
    >
      {children}
    </span>
  );
};

/** A PAUSE ONLY MEANS SOMETHING ONCE THERE IS SOMETHING TO KEEP. An example that starts paused
 *  shows an empty field and proves nothing, so this one runs first and stops on its own. */
function PausesItself({ seed }: { seed: string }) {
  const [paused, setPaused] = React.useState(false);
  const source = React.useMemo(() => createSimulatedAmplitude(seed), [seed]);
  React.useEffect(() => {
    const id = window.setTimeout(() => setPaused(true), 3400);
    return () => window.clearTimeout(id);
  }, []);
  return <Waveform mode="live" amplitude={source} paused={paused} size="compact" />;
}

/** the scrubbing field holds a position, so the example holds it too */
function Scrubber({ durationMs, size }: { durationMs: number; size?: 'compact' | 'default' | 'large' }) {
  const [positionMs, setPositionMs] = React.useState(Math.round(durationMs * 0.38));
  return (
    <Waveform
      mode="scrubbing"
      seed="hello"
      size={size}
      positionMs={positionMs}
      durationMs={durationMs}
      onSeek={setPositionMs}
      label="Seek"
    />
  );
}

export default function WaveformSection() {
  const [, theme] = useStyletron();

  /* one source per field: they are counters, and two fields sharing one would each read every
     other sample and both run at double speed */
  const meter = React.useMemo(() => createSimulatedAmplitude('hello'), []);
  const compactMeter = React.useMemo(() => createSimulatedAmplitude('hello'), []);

  /** a ramp straight through the gate: the bottom of it is dots, the top of it is bars */
  const ramp = React.useMemo(() => Array.from({ length: 48 }, (unused, i) => i / 47), []);

  return (
    <Section
      t="Waveform"
      n="the audio bar field — one component in three modes: a live meter, a recording at rest, and a recording being scrubbed"
    >
      <Grid>
        <Tile
          span={6}
          name="Live"
          rule="Reads a level source every 60ms and grows marks in from the right edge. Under the noise gate a mark is its own dot, so the pauses between phrases flatten to dots and the speech stands up."
        >
          <div
            style={{
              width: 360,
              maxWidth: '100%',
              padding: 12,
              borderRadius: theme.borders.radius300,
              background: theme.colors.backgroundSecondary,
            }}
          >
            <Waveform mode="live" amplitude={meter} size="large" label="Audio level" />
          </div>
        </Tile>

        <Tile
          span={6}
          name="Static"
          rule="A recording at rest. Given levels it draws them; given a seed it draws the same field every time, which is what makes a screenshot of this page worth diffing."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <Waveform mode="static" seed="hello" durationMs={21000} label="Audio" />
            <Waveform mode="static" seed="hello" durationMs={21000} label="Audio" />
            <Waveform mode="static" seed="second" durationMs={7000} label="Audio" />
          </div>
        </Tile>

        <Tile
          span={12}
          name="Scrubbing"
          rule="The same field, split by the playhead: inked behind it, dimmed in front. Drag it, or tab to it and use the arrow keys — Page steps ten seconds, Home and End go to the ends."
        >
          <Scrubber durationMs={21000} />
        </Tile>

        <Tile
          span={6}
          name="Sizes"
          rule="Three densities of one field. The mark's thickness, the gap and the ceiling move together; the default step is 2.5px marks 2px apart, growing to 22px."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
            {(['compact', 'default', 'large'] as const).map((size) => (
              <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Caption>{size}</Caption>
                <Waveform mode="static" seed="hello" size={size} durationMs={21000} label="Audio" />
              </div>
            ))}
          </div>
        </Tile>

        <Tile
          span={6}
          name="The noise gate"
          rule="Levels ramp 0 → 1 across this field. Everything under 0.17 draws its baseline dot; the first level above it lifts clear of the dots rather than crawling up from them."
        >
          <Waveform mode="static" peaks={ramp} size="large" label="Audio" />
        </Tile>

        <Tile
          span={6}
          name="Paused"
          rule="A paused field keeps every mark it has and stops reading. The second row runs for three seconds and then stops on its own — the meter stopped listening, and the take is still there."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Caption>running</Caption>
              <Waveform mode="live" amplitude={compactMeter} size="compact" label="Audio level" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Caption>paused</Caption>
              <PausesItself seed="hello" />
            </div>
          </div>
        </Tile>

        <Tile
          span={6}
          name="Disabled"
          rule="Marks drop to the disabled ink, the level source is left unread, and the strip leaves the tab order."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <Waveform mode="static" seed="hello" durationMs={21000} disabled label="Audio" />
            <Waveform
              mode="scrubbing"
              seed="hello"
              positionMs={8000}
              durationMs={21000}
              disabled
              label="Seek"
            />
          </div>
        </Tile>

        <Tile
          span={12}
          name="In a row"
          rule="The field takes the width it is given and draws the number of marks that width allows — never the same marks stretched. Three widths, one component."
        >
          <div style={{ display: 'flex', gap: 24, width: '100%', alignItems: 'center' }}>
            {[200, 300, 420].map((width) => (
              <div
                key={width}
                style={{
                  width,
                  flex: 'none',
                  padding: 12,
                  borderRadius: theme.borders.radius300,
                  background: theme.colors.backgroundSecondary,
                }}
              >
                <Waveform
                  mode="static"
                  peaks={peaksFromSeed('hello', 64)}
                  size="compact"
                  label="Audio"
                />
              </div>
            ))}
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
