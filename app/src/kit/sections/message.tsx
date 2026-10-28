/* Message — the unit of conversation. Grown from Base's template-component scaffold
 * (see src/rocoto/message/); this page demonstrates it like any other component.
 *
 * The copy on this page is deliberately about nothing: «Hello», «Thanks», «0:07». A themed thread
 * would quietly decide which control serves which moment of the product, and that mapping belongs
 * to the situations catalogue, made explicitly, later.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, SIZE, KIND, SHAPE } from 'baseui/button';
import { Section, Tile, Grid } from '../chrome';
import { dots, DOT_TILE } from '../../rocoto-theme';
import { Message, groupThread } from '../../rocoto/message';
import type { Author } from '../../rocoto/message';

/* THE PICTURE — inline, in the theme's own colours, drawn as line art and of nothing in
 * particular. Same standing as the placeholder frames on the Card and Avatar pages. */
function placeholderImage(width: number, height: number, paper: string, ink: string) {
  const inset = Math.round(Math.min(width, height) * 0.18);
  const stroke = Math.max(4, Math.round(Math.min(width, height) / 50));
  const w = width - inset * 2;
  const h = height - inset * 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${paper}"/>` +
    `<g fill="none" stroke="${ink}" stroke-width="${stroke}">` +
    `<rect x="${inset}" y="${inset}" width="${w}" height="${h}"/>` +
    `<line x1="${inset}" y1="${inset}" x2="${inset + w}" y2="${inset + h}"/>` +
    `<line x1="${inset + w}" y1="${inset}" x2="${inset}" y2="${inset + h}"/>` +
    '</g></svg>';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** every demo below is a full-width column, because a message row IS the width of its thread */
const Stack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: '100%' }}>{children}</div>
);

/* ── THE AUDIO STUB ───────────────────────────────────────────────────────────────────────────
 * `slot` takes ANY payload, nested exactly like a photo. This is where the Waveform lands. It is
 * drawn here as an empty frame rather than imported, on purpose: the conversation primitive and
 * the audio one are grown side by side, and either has to be rebuildable without the other.
 */
function WaveformSlot() {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.sizing.scale400,
        width: 216,
        maxWidth: '100%',
        height: theme.sizing.scale1000,
        paddingLeft: theme.sizing.scale400,
        paddingRight: theme.sizing.scale400,
        boxSizing: 'border-box',
        borderRadius: `calc(${theme.borders.radius400} - ${theme.sizing.scale200})`,
        boxShadow: `inset 0 0 0 1px ${theme.colors.borderTransparent}`,
        background: theme.colors.backgroundSecondary,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
        Waveform
      </span>
      <span
        style={{
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentTertiary,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        0:07
      </span>
    </div>
  );
}

/* ── STREAMING ────────────────────────────────────────────────────────────────────────────────
 * A message that is still arriving: the words land a few at a time, the caret rides the end of
 * them, and the stamp stays away until the last word is in — because the time it was sent has
 * not happened yet. It restarts on its own so the page always has one running.
 */
const ARRIVING = 'Working through it now. Two of the three are already answered.';

function StreamingDemo() {
  const [chars, setChars] = React.useState(0);
  React.useEffect(() => {
    const step = window.setInterval(() => {
      setChars((n) => (n > ARRIVING.length + 14 ? 0 : n + 2));
    }, 60);
    return () => window.clearInterval(step);
  }, []);
  const done = chars >= ARRIVING.length;
  return (
    <Stack>
      <Message author="ai" streaming={!done} time={done ? '09:14' : undefined}>
        {ARRIVING.slice(0, chars)}
      </Message>
    </Stack>
  );
}

/* ── THE THREAD ───────────────────────────────────────────────────────────────────────────────
 * Several messages composing: the grouping rhythm computed once for the whole run, the dotted
 * paper under them, and the scroll pinned to the newest — but only while the reader is already
 * at the bottom, so sending a message never yanks someone out of what they were reading.
 */
type Turn = { author: Author; text: string; time?: string; grouped?: boolean };

const OPENING: Turn[] = [
  { author: 'system', text: 'Today' },
  { author: 'received', text: 'Hello', time: '09:11' },
  { author: 'received', text: 'Are you around this morning?', time: '09:11' },
  { author: 'sent', text: 'I am, until twelve.', time: '09:12' },
  { author: 'ai', text: 'Here is the summary you asked for.', time: '09:13' },
  { author: 'ai', text: 'Three items, all answered.', time: '09:13' },
  { author: 'received', text: 'Thanks', time: '09:14' },
];

const REPLIES = ['Sounds good.', 'On my way.', 'Give me ten minutes.', 'Done.'];

function ThreadDemo() {
  const [, theme] = useStyletron();
  const [turns, setTurns] = React.useState<Turn[]>(OPENING);
  const scroller = React.useRef<HTMLDivElement | null>(null);
  const pinned = React.useRef(true);

  // anchored to the newest: pin after every append, and keep pinning only while the reader has
  // not scrolled up. `pinned` is a ref rather than state — it is read during layout, never drawn.
  React.useLayoutEffect(() => {
    const node = scroller.current;
    if (node && pinned.current) node.scrollTop = node.scrollHeight;
  }, [turns]);

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24;
  };

  const send = () => {
    pinned.current = true;
    setTurns((list) => [
      ...list,
      { author: 'sent', text: REPLIES[list.length % REPLIES.length], time: '09:15' },
    ]);
  };

  const grouped = groupThread(turns.map((t) => t.author));

  return (
    <Stack>
      <div
        ref={scroller}
        onScroll={onScroll}
        style={{
          height: 340,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          backgroundColor: theme.colors.backgroundPrimary,
          backgroundImage: dots(theme.colors.mono400),
          backgroundSize: DOT_TILE,
          border: `1px solid ${theme.colors.borderTransparent}`,
          borderRadius: theme.borders.radius300,
          paddingTop: theme.sizing.scale300,
          paddingBottom: theme.sizing.scale600,
        }}
      >
        {turns.map((t, i) => (
          <Message
            key={`${t.text}-${i}`}
            author={t.author}
            time={t.time}
            grouped={grouped[i]}
            status={t.author === 'sent' ? 'sent' : undefined}
          >
            {t.text}
          </Message>
        ))}
      </div>
      <div style={{ marginTop: theme.sizing.scale400 }}>
        <Button size={SIZE.compact} kind={KIND.secondary} onClick={send}>
          Send another
        </Button>
      </div>
    </Stack>
  );
}

/* ── THE ACT SLOT ─────────────────────────────────────────────────────────────────────────────
 * The component owns the SLOT and the gesture; the menu is the surface's. Hover the row, or tab
 * into it, and the affordance appears. Press and hold — or right-click, or press the context-menu
 * key on a focused bubble — and `onHold` fires.
 */
function ActionsDemo() {
  const [, theme] = useStyletron();
  const [holds, setHolds] = React.useState(0);
  const [taps, setTaps] = React.useState(0);
  return (
    <Stack>
      <Message
        author="received"
        time="09:14"
        onHold={() => setHolds((n) => n + 1)}
        action={
          <Button
            size={SIZE.mini}
            kind={KIND.tertiary}
            shape={SHAPE.circle}
            onClick={() => setTaps((n) => n + 1)}
            aria-label="More"
          >
            ⋯
          </Button>
        }
      >
        Hold this one, or tab to its button.
      </Message>
      <Message
        author="sent"
        time="09:15"
        status="sent"
        onHold={() => setHolds((n) => n + 1)}
        action={
          <Button
            size={SIZE.mini}
            kind={KIND.tertiary}
            shape={SHAPE.circle}
            onClick={() => setTaps((n) => n + 1)}
            aria-label="More"
          >
            ⋯
          </Button>
        }
      >
        This one too.
      </Message>
      <div
        style={{
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentTertiary,
          paddingLeft: theme.sizing.scale300,
          paddingTop: theme.sizing.scale300,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        Held {holds} · Tapped {taps}
      </div>
    </Stack>
  );
}

export default function MessageSection() {
  const [, theme] = useStyletron();
  const picture = placeholderImage(
    720,
    540,
    theme.colors.backgroundTertiary,
    theme.colors.contentPrimary
  );

  return (
    <Section
      t="Message"
      n="One turn of a conversation. Four standings — the near hand, the far hand, Rocoto itself, and the thread talking about itself — with the payload, the stamp and the delivery state on the same row."
    >
      <Grid>
        <Tile
          span={6}
          name="Sent and received"
          rule="The near hand is the inked paper, the far hand the clean sheet with a hairline. The notch sits at the speaker's top corner, so the side is legible even in a screenshot with the sides cropped off."
        >
          <Stack>
            <Message author="received" time="09:11">
              Hello
            </Message>
            <Message author="sent" time="09:12" status="sent">
              Hi — I am here until twelve.
            </Message>
          </Stack>
        </Tile>

        <Tile
          span={6}
          name="AI-authored"
          rule="Rocoto signs its own messages with one saffron dot, the size of a dot on the paper underneath. This mark, the streaming caret and the thinking dots are the only saffron in a conversation; everything else, including a failed send, is ink."
        >
          <Stack>
            <Message author="received" time="09:12">
              Can you summarise this?
            </Message>
            <Message author="ai" time="09:13">
              Here is the summary you asked for.
            </Message>
          </Stack>
        </Tile>

        <Tile
          span={6}
          name="Grouping"
          rule="A new speaker gets a full step of air and wears the notch. A message continuing the same speaker's run is tightened to the smallest step on the scale and drops the notch, so a burst reads as one turn with several lines. groupThread() derives it for a whole thread at once."
        >
          <Stack>
            <Message author="received" time="09:11">
              Hello
            </Message>
            <Message author="received" grouped time="09:11">
              Are you around this morning?
            </Message>
            <Message author="sent" time="09:12" status="sent">
              I am.
            </Message>
            <Message author="sent" grouped time="09:12" status="sent">
              Until twelve.
            </Message>
            <Message author="sent" grouped time="09:12" status="sending">
              After that I am out.
            </Message>
          </Stack>
        </Tile>

        <Tile
          span={6}
          name="Delivery state"
          rule="Sending, sent, and failed — the three states of an outbound message. Failed is the hairline at full ink strength plus a way back: colour is not a status system here, and form survives being printed, dimmed or read by someone who sees no hue."
        >
          <Stack>
            <Message author="sent" time="09:12" status="sending">
              On its way.
            </Message>
            <Message author="sent" time="09:12" status="sent">
              This one landed.
            </Message>
            <Message
              author="sent"
              time="09:13"
              status="error"
              onRetry={() => undefined}
            >
              This one needs sending again.
            </Message>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Photo"
          rule="The frame is drawn from the given ratio before the bytes land, so the thread holds its place while an image decodes. Its radius is the concentric one — the bubble's, minus the nest — which keeps the picture and its bubble reading as one object."
        >
          <Stack>
            <Message
              author="received"
              time="09:14"
              photo={{ src: picture, alt: 'A drawn frame', aspectRatio: 4 / 3 }}
              onOpenPhoto={() => undefined}
            >
              By the door
            </Message>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Document"
          rule="A file arrives as a named row with its size beside it. The row sits in the same nest a picture takes, at the same concentric radius, and the stamp goes on its own line underneath."
        >
          <Stack>
            <Message
              author="received"
              time="09:14"
              document={{ name: 'Report.pdf', detail: '1.2 MB · 4 pages' }}
            />
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Audio slot"
          rule="slot takes any payload and nests it exactly like a photo. The Waveform is passed in rather than imported, so each of the two stays rebuildable on its own."
        >
          <Stack>
            <Message author="received" time="09:14" slot={<WaveformSlot />} />
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="System line"
          rule="The thread talking about itself: a date, a hand-over, a setting that changed. A centred line in ink's quietest tone, taking the full width. It breaks a run, so whoever speaks next starts again."
        >
          <Stack>
            <Message author="system">Today</Message>
            <Message author="received" time="09:11">
              Hello
            </Message>
            <Message author="system">Handed to a person</Message>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Typing"
          rule="The three dots, on the real bubble every other message uses. They take ink for a person and saffron when Rocoto is the one thinking, and they hold still under reduced motion."
        >
          <Stack>
            <Message author="received" typing typingLabel="Typing" />
            <Message author="ai" typing typingLabel="Typing" />
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Actions"
          rule="Hover the row, or tab into it, and whatever the surface hung on the message appears. Press and hold — or right-click, or the context-menu key on a focused bubble — and onHold fires. The slot and the gesture are the component's; the menu is the surface's."
        >
          <ActionsDemo />
        </Tile>

        <Tile
          span={6}
          name="Streaming"
          rule="A message still arriving. The caret is saffron because this is Rocoto's act in progress, and the stamp arrives with the last word, because that is the moment the message was sent."
        >
          <StreamingDemo />
        </Tile>

        <Tile
          span={6}
          name="Disabled"
          rule="A message that stays readable and turns read-only — a closed thread, an archived conversation. The words keep their full contrast; the affordances step back and let the pointer pass."
        >
          <Stack>
            <Message
              author="received"
              time="09:14"
              disabled
              onHold={() => undefined}
              action={
                <Button size={SIZE.mini} kind={KIND.tertiary} shape={SHAPE.circle} aria-label="More">
                  ⋯
                </Button>
              }
            >
              Still perfectly readable.
            </Message>
            <Message
              author="sent"
              time="09:14"
              status="error"
              disabled
              onRetry={() => undefined}
            >
              The way back is dimmed with the thread.
            </Message>
          </Stack>
        </Tile>

        <Tile
          span={12}
          name="Thread"
          rule="Several messages composing: the rhythm derived once for the whole run, the dotted paper under them, and the scroll pinned to the newest while the reader is at the bottom — so a reader who has scrolled up keeps their place when a message lands. Scroll up, then send."
        >
          <ThreadDemo />
        </Tile>
      </Grid>
    </Section>
  );
}
