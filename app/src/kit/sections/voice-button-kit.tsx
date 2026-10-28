/* VOICE BUTTON — the kit page.
 *
 * FIVE OF THIS CONTROL'S SIX STATES EXIST ONLY UNDER A FINGER, so a page that could only show the
 * one you can reach with a mouse would have to draw the rest as pictures — and a picture of a
 * state is a claim that goes stale the first time the real one moves. Every tile below is the
 * real component, pinned: `VoiceButton` decides nothing, so handing it a phase draws that phase
 * exactly as a thumb would produce it, marks and all.
 *
 * The last tile is the whole machine, wired: press and hold it. It asks for the microphone, and
 * takes the deterministic level source when the browser says no — so the meter is alive either
 * way, and the tile states which one it got rather than pretending.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Section, Tile, Grid } from '../chrome';
import {
  StatefulVoiceButton,
  VoiceButton,
  LABELS,
  LOCK_DISTANCE,
} from '../../rocoto/voice-button-kit';
import { createSimulatedAmplitude } from '../../rocoto/waveform';
import type { Take } from '../../rocoto/voice-button-kit';
import { formatMs } from '../../rocoto/waveform';

/** a label for a row inside a Tile — the kit's own furniture, not the component's */
const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        width: 72,
        flex: 'none',
      }}
    >
      {children}
    </span>
  );
};

/** the wired control keeps whatever the last press produced, so the tile can state it */
function Live() {
  const [, theme] = useStyletron();
  const [last, setLast] = React.useState<Take | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <StatefulVoiceButton
        onRecord={setLast}
        onCancel={() => setLast(null)}
        seed="hello"
        labels={LABELS}
      />
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        {last
          ? `Last take ${formatMs(last.durationMs)} · ${
              last.source === 'microphone' ? 'microphone' : 'simulated level'
            }`
          : 'Press and hold. Drag left to cancel, drag up to keep recording after you let go, or tap once to go straight there.'}
      </span>
    </div>
  );
}

export default function VoiceButtonSection() {
  const [, theme] = useStyletron();

  /* one source per meter: they are counters, and two meters sharing one would each read every
     other sample and both run at double speed */
  const recordingMeter = React.useMemo(() => createSimulatedAmplitude('hello'), []);
  const lockedMeter = React.useMemo(() => createSimulatedAmplitude('hello'), []);
  const compactMeter = React.useMemo(() => createSimulatedAmplitude('second'), []);

  return (
    <Section
      t="Voice Button"
      n="press and hold to record · drag left past 90px to cancel · drag up past 70px and it keeps recording after you let go · a tap or a key press goes straight there"
    >
      <Grid>
        <Tile
          span={4}
          name="Idle"
          rule="A mic, and that is the whole control until it is pressed. Ink, like every other button a hand presses — the accent in this system belongs to Rocoto's own act."
        >
          <VoiceButton phase="idle" />
        </Tile>

        <Tile
          span={4}
          name="Too short"
          rule="Released under 1000ms. The take is dropped and the line says the thing to do, at full size, for two seconds."
        >
          <VoiceButton phase="idle" hint={LABELS.tooShort} />
        </Tile>

        <Tile
          span={4}
          name="Disabled"
          rule="Base's disabled fill and disabled ink, and the gesture never starts."
        >
          <VoiceButton phase="idle" disabled />
        </Tile>

        <Tile
          span={12}
          name="Recording"
          rule="The writing surface is replaced by the take: the open-microphone mark, the elapsed time in tabular figures, the live meter, and the sentence that teaches the gesture. The lock chip stands above the mic, stating where the finger can let go."
        >
          <VoiceButton phase="recording" elapsedMs={7000} amplitude={recordingMeter} />
        </Tile>

        <Tile
          span={6}
          name="In the cancel zone"
          rule="Dragged 90px left. The row says one thing, and it stays armed until the finger lifts — dragging back does not un-commit. Ink at full strength; this system keeps no colour for warnings."
        >
          <VoiceButton phase="recording" elapsedMs={4000} dragX={-110} cancelArmed />
        </Tile>

        <Tile
          span={6}
          name="Locked"
          rule="The finger left the glass and the take is still running, so the control grows the two verbs it now needs. Discard is minimal and send is filled — the weight says which one the recorder expects."
        >
          <VoiceButton phase="locked" elapsedMs={21000} amplitude={lockedMeter} />
        </Tile>

        <Tile
          span={6}
          name="The lock chip"
          rule="It shortens as the finger climbs, so the distance left to travel is the height of the thing being travelled to. At the lock line the mic has handed over completely."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
            {[0, LOCK_DISTANCE * 0.5, LOCK_DISTANCE].map((travel) => (
              <div key={travel} style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <Caption>{`${Math.round(travel)}px up`}</Caption>
                <VoiceButton phase="recording" elapsedMs={3000} dragY={-travel} />
              </div>
            ))}
          </div>
        </Tile>

        <Tile
          span={6}
          name="Compact"
          rule="The 40px step, for a row that already carries other controls. Same machine, same thresholds — the finger does not get smaller."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <Caption>idle</Caption>
              <VoiceButton phase="idle" size="compact" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <Caption>recording</Caption>
              <VoiceButton
                phase="recording"
                size="compact"
                elapsedMs={12000}
                amplitude={compactMeter}
              />
            </div>
          </div>
        </Tile>

        <Tile
          span={12}
          name="Press and hold"
          rule="The whole machine, wired: the real recorder, the real thresholds, the real clock. Tab to it and press Enter to start recording with no finger down — Enter sends and Escape discards from there."
        >
          <Live />
        </Tile>

        <Tile
          span={12}
          name="The gesture, stated"
          rule="Every number the machine reads. They are the app's, measured against real thumbs, and they are read from one place."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 18,
              width: '100%',
            }}
          >
            {[
              ['90px left', 'the cancel zone arms'],
              ['70px up', 'it keeps recording'],
              ['1000ms', 'the shortest take kept'],
              ['260ms · 12px', 'a tap, which keeps it recording'],
              ['60ms', 'the level is read'],
              ['0.17', 'the noise gate'],
            ].map(([figure, meaning]) => (
              <div key={figure} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    ...theme.typography.LabelLarge,
                    color: theme.colors.contentPrimary,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {figure}
                </span>
                <span
                  style={{
                    ...theme.typography.ParagraphXSmall,
                    color: theme.colors.contentSecondary,
                  }}
                >
                  {meaning}
                </span>
              </div>
            ))}
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
