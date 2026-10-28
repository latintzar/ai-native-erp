/* THE MEDIA A TURN CARRIES — sound, and pictures (FEED-IA §46.2, §47.3).
 *
 * ═══ WHY THIS IS THE PLACE WE GO PAST THE REFERENCE ═════════════════════════════════════════
 * «The chat is super-Intercom: studied against Intercom's own design assets, not a vibe of them —
 * and then past them where we are stronger: VOICE-NOTE handling and TRANSCRIPT handling at our
 * fidelity (playback with the waveform, the diarized transcript in the thread, the message's words
 * searchable like any text).»
 *
 * Intercom's Messenger has no voice note. This house's customers send them all morning — a man in
 * a van says twelve kilos of merluza and hangs up. So the bubble a voice note lands in is the one
 * surface where the reference has nothing to teach us, and the bar is our own:
 *
 *   THE FIELD IS THE SCRUBBER    Not a progress bar under a waveform — THE waveform, with the
 *                                playhead riding its own marks: played ones inked, the rest
 *                                dimmed, and a drag or an arrow key lands anywhere in the take.
 *                                That is the shipped Waveform's `scrubbing` mode, mounted, not
 *                                re-drawn (§ never redraw — lift the real thing).
 *   THE WORDS ARE IN THE THREAD  Not behind a «view transcript» door. The first line stands under
 *                                the field where the eye already is, and the whole diarized record
 *                                is one press away — the shipped Transcript, in its `plain`
 *                                housing, because the bubble is already the surface.
 *   THE WORDS ARE THE INDEX      Picking an utterance moves the sound to it, and the sound moving
 *                                marks the utterance. The transcript is how you get to a second of
 *                                audio without dragging for it.
 *   THE WORDS ARE SEARCHABLE     `threads.ts` folds them into the conversation's own index, so the
 *                                widget's search finds what was SAID in a recording exactly the
 *                                way it finds what was typed.
 *
 * ═══ AND A PHOTOGRAPH IS THE SAME OBJECT (§47.3) ════════════════════════════════════════════
 * A photograph of a written order is a message whose words are in an image. So it carries a
 * READING in the identical grammar — the same component, the same collapse, the same search index
 * — and the picture itself opens on the app's own chromeless overlay. One idea, two carriers.
 *
 * ═══ §37.3: THE GEOMETRY DOES NOT MOVE ══════════════════════════════════════════════════════
 * «Hover must never change geometry.» Playback is the same law one level along: play and pause
 * trade one mark inside a fixed circle, the readout is tabular so 0:00 and 0:11 are the same
 * width, and the collapsed reading holds exactly one line whether it is there yet or not. A
 * bubble that grew every time somebody pressed play would shove the whole conversation.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import TriangleRight from 'baseui/icon/triangle-right';
import { Spinner, SIZE as SPINNER_SIZE } from 'baseui/spinner';
import { Waveform, Pause, MODE } from '../../../rocoto/waveform';
import { Transcript, type Utterance } from '../../../rocoto/transcript';
import { OverlayCard } from '../../../rocoto/overlay-card';
import { Glyph, STEP } from '../glyphs';
import { clock, firstLine, type Picture, type VoiceNote } from './threads';

/* ── THE CLOCK THAT RUNS THE PLAYHEAD ─────────────────────────────────────────────────────────
 * There is no audio element on this surface: the take is `simulate`d, the way the Voice Button's
 * own shipped prop simulates its level source. So the playhead is advanced by a timer at real
 * time — the same seconds a real file would take — and it stops at the end rather than looping,
 * because a voice note that restarted itself would be a surface deciding to talk twice.
 */
const TICK_MS = 60;

/** THE SHORTEST ROW A RECORDING READS ON: the 36px transport, a field with enough marks to show a
 *  playhead moving through them, and the readout. Under this the field is a decoration; the panel
 *  is 400 wide and a bubble takes 78% of it, so this fits the narrowest housing there is. */
const VOICE_ROW = 208;

function usePlayhead(durationMs: number) {
  const [playing, setPlaying] = React.useState(false);
  const [positionMs, setPositionMs] = React.useState(0);

  React.useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setPositionMs((was) => {
        const next = was + TICK_MS;
        if (next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, durationMs]);

  /** the end is a finished take, so the next press starts it again rather than doing nothing */
  const toggle = React.useCallback(() => {
    setPlaying((was) => {
      if (!was && positionMs >= durationMs) setPositionMs(0);
      return !was;
    });
  }, [positionMs, durationMs]);

  const seek = React.useCallback((to: number) => setPositionMs(to), []);

  return { playing, positionMs, toggle, seek };
}

/* ── THE READING, COLLAPSED TO ITS FIRST LINE ─────────────────────────────────────────────────
 * The whole point of putting the words IN the thread is that a person reads them without asking.
 * So the first line is always there, at one line exactly, and the rest is one press away. The
 * press is a real disclosure control — it says what it opens and it says whether it is open —
 * never a chevron on its own, because a chevron on its own is a control that has to be tried.
 */
function Reading({
  utterances,
  currentTime,
  playing,
  onSeek,
  testid,
}: {
  utterances: Utterance[];
  currentTime?: number;
  playing?: boolean;
  onSeek?: (seconds: number) => void;
  testid: string;
}) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);

  return (
    <div data-testid={testid} data-open={open ? 'yes' : 'no'} style={{ minWidth: 0 }}>
      {open ? (
        <Transcript
          size="compact"
          housing="plain"
          utterances={utterances}
          currentTime={currentTime}
          playing={playing}
          onSeek={onSeek ? (start) => onSeek(start) : undefined}
          follow
          maxHeight="164px"
          overrides={{
            /* the card's own padding is the bubble's already — a nested surface would double it */
            Root: { style: { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 } },
          }}
        />
      ) : (
        <p
          data-testid={`${testid}-line`}
          style={{
            margin: 0,
            /* THE TRANSCRIPTION IS READ, SO IT IS SET TO BE READ (§111.12: «the transcription can
               be bigger»). It was the smallest step in the app — the one used for machinery lines
               — under a control offering to open it. It is the words somebody said. */
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentPrimary,
            /* ONE LINE, ALWAYS. The collapsed reading is a fixed shape so the bubble it stands in
               is a fixed shape (§37.3) — the words that do not fit are behind the control below. */
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {firstLine(utterances)}
        </p>
      )}
      <span style={{ display: 'inline-flex', marginTop: theme.sizing.scale200 }}>
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          shape={SHAPE.pill}
          data-testid={`${testid}-toggle`}
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          endEnhancer={
            <span
              style={{
                display: 'inline-flex',
                transform: open ? 'rotate(180deg)' : undefined,
                transition: `transform ${theme.animation.timing400} ${theme.animation.easeOutCurve}`,
              }}
            >
              <Glyph id="caret" size={STEP.small} />
            </span>
          }
        >
          {/* «what is transcript - 2?» (S16). A count of utterances is the machine's own number
              and it stood on the control as if it were a fact worth reading. The control says
              what pressing it does, and nothing else. */}
          {open ? 'The line alone' : 'Read it all'}
        </Button>
      </span>
    </div>
  );
}

/** The machine is still writing. It says so, and it says nothing else — an empty transcript
 *  drawn as words would be the software claiming to have heard something. */
function Transcribing({ testid }: { testid: string }) {
  const [, theme] = useStyletron();
  return (
    <p
      data-testid={testid}
      style={{
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentTertiary,
        minWidth: 0,
      }}
    >
      <Spinner $size={SPINNER_SIZE.small} />
      Transcribing…
    </p>
  );
}

/* ── THE VOICE NOTE ───────────────────────────────────────────────────────────────────────────
 * Mounted in the Message's `slot`, which the kit documents as exactly this: «This is where a voice
 * note goes: the Waveform is passed IN rather than imported.» So the conversation primitive and
 * the audio primitive meet here and nowhere else, and either can be rebuilt without the other.
 */
export function VoiceNoteBody({ note, testid = 'voice-note' }: { note: VoiceNote; testid?: string }) {
  const [, theme] = useStyletron();
  const { playing, positionMs, toggle, seek } = usePlayhead(note.durationMs);

  return (
    <div
      data-testid={testid}
      data-playing={playing ? 'yes' : 'no'}
      data-length={clock(note.durationMs)}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      {/* ── THE FIELD NEEDS ROOM, AND A BUBBLE GIVES IT NONE ────────────────────────────────────
          A message bubble is shrink-to-fit, and the Waveform's strip is `flex-basis: 0` so that it
          takes whatever a row has left. Put one inside the other and the strip resolves to zero
          width, draws zero marks, and the bubble comes out as a play button beside a clock — which
          is exactly what it did the first time it was mounted. So the recording states a floor:
          the shortest row a waveform can still be read on. It is a MINIMUM rather than a width, so
          a long conversation at fullscreen still lets the field breathe. */}
      {/* ── AND IT FILLS THE WIDTH IT IS GIVEN (FEED-IA §111.12, off S16: «the voice note doesn't
          even fill the whole width») ─────────────────────────────────────────────────────────
          A minimum kept the waveform readable in a shrink-to-fit bubble; it also let the row stop
          at 208px inside a card that had three times that, so a voice note read as a small object
          in a large box. `width: 100%` makes the minimum a FLOOR rather than a size: the strip
          takes the room the surface actually gives it, and the bubble it stands in decides how
          much that is. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, width: '100%', minWidth: VOICE_ROW }}>
        {/* THE TRANSPORT IS ONE SEAT, TWO MARKS (§30). Base's own circle at `compact` is 36px,
            which is the target a pointer expects and the size the header's marks already take. */}
        <span style={{ flex: '0 0 auto' }}>
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            shape={SHAPE.circle}
            data-testid={`${testid}-play`}
            data-state={playing ? 'playing' : 'paused'}
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={toggle}
          >
            {playing ? <Pause size={18} /> : <TriangleRight size={22} />}
          </Button>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <Waveform
            mode={MODE.scrubbing}
            size="compact"
            seed={note.seed}
            positionMs={positionMs}
            durationMs={note.durationMs}
            onSeek={seek}
            label="Scrub the recording"
            overrides={{
              /* TABULAR, SO THE GEOMETRY HOLDS (§37.3). `0:00 / 0:07` and `0:11 / 0:07` have to
                 occupy one width, or the field beside them resizes eleven times a second. */
              Time: { style: { fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' } },
            }}
          />
        </span>
      </div>

      {note.transcript ? (
        <Reading
          testid={`${testid}-transcript`}
          utterances={note.transcript}
          currentTime={positionMs / 1000}
          playing={playing}
          onSeek={(seconds) => seek(Math.round(seconds * 1000))}
        />
      ) : (
        <Transcribing testid={`${testid}-transcribing`} />
      )}
    </div>
  );
}

/* ── WHAT A PHOTOGRAPH SAYS (§47.3) ───────────────────────────────────────────────────────────
 * A written order photographed on a notepad is a message. Its words are pixels, so the app reads
 * them — and having read them, it owes the reader the same three things a recording gets: the line
 * under the picture, the whole reading one press away, and the words in the search index.
 *
 * The reading is NOT seekable: there is no playhead in a photograph, so the utterances are read-
 * only and the roving tab stop stays out of the way. The Transcript takes that decision through
 * the absence of `onSeek`, which is its own documented contract.
 */
export function PictureReading({ picture, testid = 'picture' }: { picture: Picture; testid?: string }) {
  return picture.reading ? (
    <Reading testid={`${testid}-reading`} utterances={picture.reading} />
  ) : (
    <Transcribing testid={`${testid}-reading-pending`} />
  );
}

/* ── THE PICTURE, OPENED (§47.3, §37.10) ──────────────────────────────────────────────────────
 * «The paper preview opens in a MODAL — that feels normal.» A photograph is the same: the thumb
 * in the bubble is a real button, and pressing it puts the picture on the app's own chromeless
 * overlay at the size it was sent at. The overlay is the shipped OverlayCard, so Escape, the
 * scrim, the focus lock and the return of focus are all Base's machinery and none of them are
 * re-implemented here.
 */
export function PictureLightbox({
  picture,
  onClose,
}: {
  picture: Picture | null;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    <OverlayCard
      isOpen={Boolean(picture)}
      onClose={onClose}
      /* the sent picture's own room: wide enough for a written page to be readable, short of the
         viewport's edges so the card still reads as a card */
      size={720}
      placement="center"
      ariaLabel={picture?.alt ?? 'The picture'}
      /* ── IT OPENS FROM INSIDE THE WIDGET, SO IT HAS TO OUTRANK IT ──────────────────────────
         The chat panel takes a rung of its own (9) so the river's sticky band cannot paint over
         the conversations; Base opens its popovers from inside it at 12. A picture opened from a
         bubble is above BOTH — it is the thing the person asked to be looking at — and on Base's
         own layer that means saying so, because `Layer` alone computes `z-index: auto` and the
         panel simply painted over the photograph. */
      overrides={{ Root: { style: { zIndex: 13 } } }}
    >
      {picture && (
        <div
          data-testid="picture-lightbox"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale500,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <img
            src={picture.src}
            alt={picture.alt}
            data-testid="picture-lightbox-image"
            style={{
              display: 'block',
              maxWidth: '100%',
              /* the card carries its own padding and the viewport carries the rest, so the picture
                 takes what is left rather than a number this file invents */
              maxHeight: '70vh',
              objectFit: 'contain',
              borderRadius: theme.borders.radius300,
              background: theme.colors.backgroundSecondary,
            }}
          />
          <span
            style={{
              ...theme.typography.ParagraphSmall,
              color: theme.colors.contentSecondary,
              textAlign: 'center',
              maxWidth: 560,
            }}
          >
            {picture.reading ? firstLine(picture.reading) : picture.alt}
          </span>
          <Button kind={KIND.secondary} size={SIZE.compact} data-testid="picture-lightbox-close" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </OverlayCard>
  );
}
