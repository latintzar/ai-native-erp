/* TRANSCRIPT — the words a recording contained, in the surface that opens over the thing you were
 * already looking at.
 *
 * This page does two jobs at once. It demonstrates the component's state matrix, and it draws the
 * first line of the OVERLAY DOCTRINE, because a transcript is the moment where the question
 * «chromed or chromeless?» first has a real answer:
 *
 *   INLINE      the words live in the page's own flow. No layer, no scrim, no dismissal — the
 *               reader is already where the words belong.
 *   CHROMELESS  a bare card floating on the layer. Nothing frames it: no header, no title bar, no
 *               close control. It carries ONE decision, at its own foot, and Escape or the scrim
 *               takes it away. It is for a moment with a single question and a single answer.
 *   CHROMED     Base's Modal, whole: header, close control, footer, two decisions. It is for a
 *               moment that has to be closed deliberately, where the reader is choosing rather
 *               than looking.
 *
 * NEITHER HOUSING IS BUILT HERE. The chromeless one is Rocoto's own `OverlayCard`; the chromed one
 * is Base's `Modal`. This page writes no scrim, no Escape handler and no focus lock of its own —
 * a second overlay implementation on the same page would be the doctrine contradicting itself in
 * the one place it is being stated. The transcript is the CONTENT; both housings are given it with
 * `housing="plain"`, because the housing is already the surface and two nested surfaces read as a
 * mistake. `housing="card"` is for the inline case, where the transcript stands on its own.
 *
 * DEMO CONTENT IS GENERIC on purpose — two speakers, a greeting, a pause. A themed transcript
 * would quietly decide which moment of the product this component serves, and that mapping is the
 * situations catalogue's job, made explicitly, later.
 *
 * THE WAVEFORM IS A STUB. `media` is a loose slot and this page fills it with a placeholder band
 * plus a playhead — deliberately not a drawing of sound. The Waveform component is being grown
 * alongside this one; when it lands it drops into this slot and nothing in the transcript changes,
 * which is the whole argument for the slot being loose.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
  SIZE as MODAL_SIZE,
} from 'baseui/modal';
import { dots, DOT_TILE } from '../../rocoto-theme';
import { OverlayCard } from '../../rocoto/overlay-card';
import { Transcript } from '../../rocoto/transcript';
import type { Utterance } from '../../rocoto/transcript';

/* ── THE WORDS ────────────────────────────────────────────────────────────────────────────── */

const SAID: Utterance[] = [
  { speaker: 'Speaker 1', start: 0, end: 4, words: ['Hello — can you hear me?'] },
  { speaker: 'Speaker 2', start: 4, end: 9, words: ['Yes, clearly. Go ahead.'] },
  { speaker: 'Speaker 1', start: 9, end: 16, words: ['Good. I will start from the top.'] },
  {
    speaker: 'Speaker 1',
    start: 16,
    end: 24,
    words: ['There are three of them, and the last one runs long.'],
  },
  { speaker: 'Speaker 2', start: 24, end: 31, words: ['Take your time.'] },
  { speaker: 'Speaker 1', start: 31, end: 40, words: ['Right. That is all of it.'] },
];

const TOTAL = 40;

/* A `null` run is one the machine did not hear. It renders as an empty slot and stays empty. */
const SAID_WITH_GAPS: Utterance[] = [
  { speaker: 'Speaker 1', start: 0, end: 4, words: ['Hello — can you hear me?'] },
  { speaker: 'Speaker 2', start: 4, end: 10, words: ['Yes, and the', null, 'came through as well.'] },
  { speaker: 'Speaker 1', start: 10, end: 17, words: ['Say the second part again.'] },
  { speaker: 'Speaker 2', start: 17, end: 26, words: [null, null, 'on Thursday, at the earliest.'] },
];

const GAPS_TOTAL = 26;

/* ── THE WAVEFORM'S SLOT, stubbed ─────────────────────────────────────────────────────────── */

/** The stand-in for the Waveform component: the one texture Rocoto supplies, with the playhead
 *  drawn on it in ink. It states the slot's shape and holds no opinion about how sound looks. */
function WaveformStub({ at, of }: { at: number; of: number }) {
  const [, theme] = useStyletron();
  const pct = of > 0 ? Math.min(100, Math.max(0, (at / of) * 100)) : 0;
  return (
    <div
      style={{
        position: 'relative',
        height: theme.sizing.scale1000,
        borderRadius: theme.borders.radius200,
        backgroundColor: theme.colors.mono100,
        backgroundImage: dots(theme.colors.mono400),
        backgroundSize: DOT_TILE,
        border: `1px solid ${theme.colors.borderOpaque}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${pct}%`,
          width: 2,
          backgroundColor: theme.colors.contentPrimary,
        }}
      />
    </div>
  );
}

/* ── A PLAYHEAD ───────────────────────────────────────────────────────────────────────────── */

/** A quarter-second tick, looping — enough to watch the highlight walk down the words. */
function usePlayhead(total: number, running: boolean): [number, (t: number) => void] {
  const [at, setAt] = React.useState(0);
  React.useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => setAt((t) => (t + 0.25 >= total ? 0 : t + 0.25)), 250);
    return () => window.clearInterval(id);
  }, [running, total]);
  return [at, setAt];
}

/* ── THE EXAMPLES ─────────────────────────────────────────────────────────────────────────── */

/* READY — the words at rest. Nothing is playing, so nothing is marked. */
function TranscriptReady() {
  const [at, setAt] = React.useState<number | undefined>(undefined);
  return (
    <div style={{ width: '100%' }}>
      <Transcript
        utterances={SAID}
        duration={TOTAL}
        currentTime={at}
        onSeek={(start) => setAt(start)}
        maxHeight="240px"
      />
    </div>
  );
}

/* PLAYING — the playhead runs, the current utterance is marked, and the list brings it into view.
 * Picking a line moves the sound to it, which is the transcript's real job: the words are the
 * index of the recording. */
function TranscriptPlaying() {
  const [running, setRunning] = React.useState(true);
  const [at, setAt] = usePlayhead(TOTAL, running);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Transcript
        utterances={SAID}
        duration={TOTAL}
        currentTime={at}
        playing={running}
        onSeek={(start) => setAt(start)}
        media={<WaveformStub at={at} of={TOTAL} />}
        maxHeight="200px"
      />
      <Button size={BUTTON_SIZE.mini} kind={KIND.tertiary} onClick={() => setRunning(!running)}>
        {running ? 'Pause' : 'Play'}
      </Button>
    </div>
  );
}

/* EMPTY SLOTS — a run the machine did not hear, shown empty. */
function TranscriptWithGaps() {
  const [at, setAt] = React.useState<number | undefined>(6);
  return (
    <div style={{ width: '100%' }}>
      <Transcript
        utterances={SAID_WITH_GAPS}
        duration={GAPS_TOTAL}
        currentTime={at}
        onSeek={(start) => setAt(start)}
        maxHeight="240px"
      />
    </div>
  );
}

/* LOADING — the machine is still writing. The skeleton stands in the real grid, and the one mark
 * of saffron on this component says whose act is in progress. */
function TranscriptLoading() {
  return (
    <div style={{ width: '100%' }}>
      <Transcript utterances={[]} duration={TOTAL} loading loadingUtterances={3} />
    </div>
  );
}

/* CHROMELESS — Rocoto's own OverlayCard: a bare card on the layer, nothing framing it, dismissed by
 * Escape or the scrim. The transcript is its whole content, and carries the single decision at its
 * own foot, because there is no footer here to carry one. Chromeless has no header either, so the
 * card is named through `ariaLabel` instead. */
function TranscriptChromeless() {
  const [open, setOpen] = React.useState(false);
  const [at, setAt] = React.useState<number | undefined>(undefined);
  return (
    <React.Fragment>
      <Button onClick={() => setOpen(true)}>Open transcript</Button>
      <OverlayCard
        isOpen={open}
        onClose={() => setOpen(false)}
        size={520}
        ariaLabel="Transcript"
      >
        <Transcript
          utterances={SAID}
          housing="plain"
          duration={TOTAL}
          currentTime={at}
          onSeek={(start) => setAt(start)}
          media={<WaveformStub at={at ?? 0} of={TOTAL} />}
          maxHeight="280px"
          action={<Button onClick={() => setOpen(false)}>Done</Button>}
        />
      </OverlayCard>
    </React.Fragment>
  );
}

/* CHROMED — the same words in Base's Modal, whole: header, close control, footer, two decisions.
 * The card drops its own surface, because the dialog is already one. */
function TranscriptChromed() {
  const [open, setOpen] = React.useState(false);
  const [at, setAt] = React.useState<number | undefined>(undefined);
  return (
    <React.Fragment>
      <Button onClick={() => setOpen(true)}>Open transcript</Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} size={MODAL_SIZE.default}>
        <ModalHeader>Transcript</ModalHeader>
        <ModalBody>
          <Transcript
            utterances={SAID}
            housing="plain"
            duration={TOTAL}
            currentTime={at}
            onSeek={(start) => setAt(start)}
            media={<WaveformStub at={at ?? 0} of={TOTAL} />}
            maxHeight="240px"
          />
        </ModalBody>
        <ModalFooter>
          <ModalButton kind={KIND.tertiary} onClick={() => setOpen(false)}>
            Cancel
          </ModalButton>
          <ModalButton onClick={() => setOpen(false)}>Okay</ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}

/* COMPACT — the same anatomy one rung down the type scale, for a card that sits beside something
 * else rather than alone on a layer. */
function TranscriptCompact() {
  const [at, setAt] = React.useState<number | undefined>(11);
  return (
    <div style={{ width: '100%' }}>
      <Transcript
        utterances={SAID}
        size="compact"
        duration={TOTAL}
        currentTime={at}
        onSeek={(start) => setAt(start)}
        maxHeight="180px"
      />
    </div>
  );
}

/* READ-ONLY — no `onSeek`, so the utterances are blocks of text: out of the tab order, no pointer,
 * no hover. Reading, not operating. */
function TranscriptReadOnly() {
  return (
    <div style={{ width: '100%' }}>
      <Transcript utterances={SAID} currentTime={5} maxHeight="180px" />
    </div>
  );
}

/* UNAVAILABLE — seeking exists here but is off. The words keep full contrast: dimming them would
 * answer the one question the reader opened this to ask. */
function TranscriptDisabled() {
  return (
    <div style={{ width: '100%' }}>
      <Transcript
        utterances={SAID}
        disabled
        currentTime={5}
        onSeek={() => {}}
        maxHeight="180px"
      />
    </div>
  );
}

/* ── THE PAGE ─────────────────────────────────────────────────────────────────────────────── */

export default function TranscriptSection() {
  return (
    <Section
      t="Transcript"
      n="the words a recording contained — speaker, timestamp, and a target you can pick to move the sound there; an unclear run stays an empty slot"
    >
      <Grid>
        <Tile
          span={6}
          name="Ready"
          rule="The words at rest: the playhead is idle, so every line reads the same. Pick one and the playhead lands there — the words are the index of the sound. Tab in and the arrow keys walk them, Home and End jump to the ends, Enter and Space seek."
        >
          <TranscriptReady />
        </Tile>

        <Tile
          span={6}
          name="Playing"
          rule="The current utterance takes ink at full strength, Base's secondary ground, and an ink rule at its leading edge — reserved at every rest, so the line holds still as it becomes current. The list scrolls itself and leaves the page where it was. The band on top is the loose slot the Waveform lands in."
        >
          <TranscriptPlaying />
        </Tile>

        <Tile
          span={6}
          name="Empty slots"
          rule="An unclear run is shown empty and stays empty, so the reader knows the one second to go back to. The likeliest word would be an invention inside a record about to be trusted, and it would read exactly like the rest of it."
        >
          <TranscriptWithGaps />
        </Tile>

        <Tile
          span={6}
          name="Loading"
          rule="Base's own Skeleton in the utterance's real grid, so the words land in the shape that was already there. The saffron is Base's Spinner, and it is the only saffron here: the machine's own act, in progress."
        >
          <TranscriptLoading />
        </Tile>

        <Tile
          span={6}
          name="Chromeless housing"
          rule="Rocoto's OverlayCard: the card IS the overlay. It carries one decision, at the card's own foot, and Escape or the scrim takes it away. The transcript is its whole content, set to `plain` so the card is the only surface. For a moment with a single question."
        >
          <TranscriptChromeless />
        </Tile>

        <Tile
          span={6}
          name="Chromed housing"
          rule="Base's Modal whole — header, close control, footer, two decisions — with the card set to `plain` so the dialog is the only surface. For a moment the reader has to close deliberately."
        >
          <TranscriptChromed />
        </Tile>

        <Tile
          span={4}
          name="Compact"
          rule="One rung down Base's type scale, for a card that sits beside something rather than alone on a layer."
        >
          <TranscriptCompact />
        </Tile>

        <Tile
          span={4}
          name="Read-only"
          rule="Omit `onSeek` and each utterance becomes a block of text: reading, not operating. The keyboard walks past it in one step, and the playhead still marks its line."
        >
          <TranscriptReadOnly />
        </Tile>

        <Tile
          span={4}
          name="Disabled"
          rule="Seeking exists here and is switched off. The words keep full contrast on purpose: a transcript is opened to be read, and dimming it answers that question with «later»."
        >
          <TranscriptDisabled />
        </Tile>
      </Grid>
    </Section>
  );
}
