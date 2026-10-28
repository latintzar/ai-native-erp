/* WEIGHT ENTRY — the kit page.
 *
 * Every field on this page is the real component, and every one of them takes a keystroke. The
 * three demonstrations that would otherwise be pictures — the typing shift, the accelerating hold
 * and the walk across the digit places — are driven by dispatching REAL keyboard and pointer
 * events at the component, so what the page shows is what a hand gets, not a reconstruction of it.
 *
 * DEMO CONTENT IS GENERIC. A weight, a unit, an ordered amount. No trade content: which moment of
 * the product this field serves is the situations catalogue's job, made explicitly, later.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Section, Tile, Grid, Row } from '../chrome';
import { WeightEntry } from '../../rocoto/weight-entry';

/** a real keydown, at the element that owns the keyboard contract */
const press = (el: HTMLElement, key: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

const spinbutton = (root: HTMLElement | null) =>
  (root?.querySelector('[role="spinbutton"]') as HTMLElement | null) ?? null;

/** a caption for one frame of the filmstrip — the kit's own furniture, not the component's */
const Keystroke: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </span>
  );
};

/** one frame of the shift, parked. Read-only, so the frame stays the frame. */
const Frame: React.FC<{ keys: string; value: number }> = ({ keys, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
    <WeightEntry readOnly attribution={false} marks="off" camera={false} size="compact" maxDigits={4} value={value} />
    <Keystroke>{keys}</Keystroke>
  </div>
);

/** play a queue of real keystrokes at a live field */
function useReplay(box: React.RefObject<HTMLDivElement | null>) {
  const timers = React.useRef<number[]>([]);
  const [playing, setPlaying] = React.useState(false);
  React.useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const play = (queue: Array<[string, number]>) => {
    const field = spinbutton(box.current);
    if (!field) return;
    field.focus();
    setPlaying(true);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    let at = 0;
    queue.forEach(([key, gap], i) => {
      timers.current.push(
        window.setTimeout(() => {
          press(field, key);
          if (i === queue.length - 1) setPlaying(false);
        }, at)
      );
      at += gap;
    });
  };
  return { play, playing };
}

/** the shift, played at typing speed on the live component */
function TypingReplay() {
  const box = React.useRef<HTMLDivElement>(null);
  const { play, playing } = useReplay(box);

  return (
    <div ref={box} style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
      <WeightEntry label="Weight given" camera={false} defaultValue={5.02} />
      <div style={{ alignSelf: 'flex-start' }}>
        <Button
          kind={KIND.tertiary}
          size={BUTTON_SIZE.compact}
          onClick={() =>
            play([
              ['Backspace', 70], ['Backspace', 70], ['Backspace', 70],
              ['Backspace', 70], ['Backspace', 70], ['Backspace', 380],
              ['5', 560], ['0', 560], ['2', 560], ['0', 0],
            ])
          }
          disabled={playing}
        >
          {playing ? 'Typing 5 · 0 · 2 · 0' : 'Type 5 · 0 · 2 · 0'}
        </Button>
      </div>
    </div>
  );
}

/** the arrows, played on the live component: the rule walks left, then the place steps */
function ArrowReplay() {
  const box = React.useRef<HTMLDivElement>(null);
  const { play, playing } = useReplay(box);

  return (
    <div ref={box} style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
      <WeightEntry label="Weight given" marks="on" camera={false} defaultValue={5.02} />
      <div style={{ alignSelf: 'flex-start' }}>
        <Button
          kind={KIND.tertiary}
          size={BUTTON_SIZE.compact}
          onClick={() =>
            play([
              ['ArrowLeft', 520], ['ArrowLeft', 520], ['ArrowLeft', 700],
              ['ArrowUp', 620], ['ArrowUp', 620], ['ArrowDown', 0],
            ])
          }
          disabled={playing}
        >
          {playing ? '← ← ← ↑ ↑ ↓' : 'Walk to the kilo and step it'}
        </Button>
      </div>
    </div>
  );
}

/** the hold, played on the 100 g place so the acceleration is legible against the kilo digit */
function HoldReplay() {
  const box = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<number | null>(null);
  const [holding, setHolding] = React.useState(false);

  React.useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const hold = () => {
    const mark = box.current?.querySelector('[aria-label="Up 100 g"]') as HTMLElement | null;
    if (!mark) return;
    setHolding(true);
    mark.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    timer.current = window.setTimeout(() => {
      mark.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      setHolding(false);
    }, 2800);
  };

  return (
    <div ref={box} style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
      <WeightEntry label="Weight given" marks="on" camera={false} defaultValue={1.2} />
      <div style={{ alignSelf: 'flex-start' }}>
        <Button kind={KIND.tertiary} size={BUTTON_SIZE.compact} onClick={hold} disabled={holding}>
          {holding ? 'Holding the 100 g mark' : 'Hold the mark over the 100 g digit'}
        </Button>
      </div>
    </div>
  );
}

/** what a commit hands back, said out loud — the desk's «done» made visible */
function CommitDemo() {
  const [, theme] = useStyletron();
  const [committed, setCommitted] = React.useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <WeightEntry
        label="Weight given"
        camera={false}
        defaultValue={5.02}
        onCommit={(v) => setCommitted(`${v.grams} g · ${v.source}`)}
      />
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
        {committed ? `Committed ${committed}` : 'Type into it, then press Enter or tab away.'}
      </span>
    </div>
  );
}

export default function WeightEntrySection() {
  const [, theme] = useStyletron();

  return (
    <Section
      t="Weight Entry"
      n="the field a final weight is captured in — typed from the right the way a phone takes an alarm, stepped on a mark that sits over the digit place it changes, or read off a photograph of the scale and still corrected by hand"
    >
      <Grid>
        <Tile
          span={6}
          name="Empty"
          rule="Four slots and a comma, waiting. The zeros are the frame, not an entry — they are dimmed, and the sentence under the field says the number is still to confirm and names the three ways in."
        >
          <WeightEntry label="Weight given" />
        </Tile>

        <Tile
          span={6}
          name="Typing — the shift"
          rule="Digits enter from the RIGHT and push the number leftward through its units. No decimal point is ever typed and no cursor is ever placed; backspace shifts back. Each digit is one DOM node that keeps its identity and flies to its new column, so the movement is the thing you read — and a digit crossing the comma is promoted to kilo size the instant it lands."
        >
          <TypingReplay />
        </Tile>

        <Tile
          span={12}
          name="Typing — the frames"
          rule="The same four keystrokes, parked. 5 lands in the grams; the zero after it carries the 5 up a column; 2 fills the gram slot the 5 left; the last zero pushes the 5 across the comma. Four keys, one number, no punctuation."
        >
          <Row>
            <Frame keys="5" value={0.005} />
            <Frame keys="5 0" value={0.05} />
            <Frame keys="5 0 2" value={0.502} />
            <Frame keys="5 0 2 0" value={5.02} />
          </Row>
        </Tile>

        <Tile
          span={6}
          name="The marks sit on the digit"
          rule="One mark above and one below EVERY digit place, on that digit's own column: press over the hundreds-of-grams digit to add a hundred grams, under it to take one away. There is no rung and no rung name, because the digit place is already the label."
        >
          <WeightEntry label="Weight given" marks="on" camera={false} defaultValue={5.02} />
        </Tile>

        <Tile
          span={6}
          name="Holding a mark"
          rule="Press and it steps once. Hold and it waits, then repeats, tightening from a quarter of a second down to a sixteenth — coarse enough to read on the way past, fast enough to cross a kilo on the 100 g place. Let go anywhere and it stops on the number you can see."
        >
          <HoldReplay />
        </Tile>

        <Tile
          span={6}
          name="The desk: quiet until a hand is on it"
          rule="A fine pointer gets the keyboard field. The marks hold their room so nothing reflows, and they fade in when the field is hovered or focused — hover this one to watch them arrive. A coarse pointer gets them from the first frame, because a thumb has no arrow keys."
        >
          <WeightEntry label="Weight given" camera={false} defaultValue={5.02} />
        </Tile>

        <Tile
          span={6}
          name="The keyboard walks the places"
          rule="Left and right move a rule under the digit place the arrows are driving; up and down step that place. The rule marks the COLUMN, so a digit that shifts leftward travels out from under it and the place stays where the hand left it."
        >
          <ArrowReplay />
        </Tile>

        <Tile
          span={6}
          name="Enter commits"
          rule="Type, then press Enter — or move the focus off the field, which is the other thing a desk means by done. The field reports the grams and where they came from, and it goes on taking keystrokes afterwards."
        >
          <CommitDemo />
        </Tile>

        <Tile
          span={6}
          name="A big number stays one number"
          rule="Kilo digits past three take a separator column of their own, so ten thousand kilos reads as a figure and not as five digits somebody has to count. The marks and the rule ride the same column list, so they land on the digit either way."
        >
          <WeightEntry label="Weight given" marks="on" camera={false} maxDigits={8} defaultValue={10460.5} />
        </Tile>

        <Tile
          span={6}
          name="Photo capture"
          rule="The camera is inside the field, because photographing the scale is a third way of saying the same number rather than a different job. Press Read the display and the accent sweeps it — the one mark in this component that means the machine acted."
        >
          <WeightEntry label="Weight given" capture="viewfinder" scaleReading={5.02} />
        </Tile>

        <Tile
          span={6}
          name="Arrived from the photo"
          rule="The number lands as a whole, left to right, and says where it came from. The photograph stays as a chip: tap it to look at it again, bin it to take another. The next keystroke owns the number."
        >
          <WeightEntry label="Weight given" source="photo" capture="taken" defaultValue={5.02} scaleReading={5.02} />
        </Tile>

        <Tile
          span={6}
          name="Overridden after the photo"
          rule="A hand corrected the reading, so the field says so and keeps the photo's number legible underneath it, struck through — the same supersede lockup that carries every changed number in this product. Type into it and watch the attribution move."
        >
          <WeightEntry label="Weight given" source="adjusted" capture="taken" defaultValue={5.04} scaleReading={5.02} />
        </Tile>

        <Tile
          span={6}
          name="Ordered against given"
          rule="One fact per row: the word, then the figure, unit on the number's own line. Ordered is what was asked for and given is what the scale said; the albarán carries the second one, and the difference is stated in words rather than left to be worked out."
        >
          <WeightEntry label="Weight given" ordered={5} defaultValue={5.02} camera={false} />
        </Tile>

        <Tile
          span={12}
          name="Over and under"
          rule="Both directions in the same ink. The tick is the ordered amount and the bar runs to what was given — left is under, right is over, and the sentence says which. A colour here would make one of these two an error, and neither of them is."
        >
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <WeightEntry label="Over the ordered amount" ordered={5} defaultValue={5.14} camera={false} marks="off" />
            <WeightEntry label="Under the ordered amount" ordered={5} defaultValue={4.86} camera={false} marks="off" />
          </div>
        </Tile>

        <Tile
          span={6}
          name="Disabled"
          rule="Shown and taking nothing: the ground drops to Base's disabled fill, every digit and every mark to its disabled content, and the field leaves the tab order. It keeps its sentence, because a weight that is on the page is still a weight that was weighed."
        >
          <WeightEntry label="Weight given" disabled defaultValue={5.02} />
        </Tile>

        <Tile
          span={6}
          name="On a finished line"
          rule="Read-only. The field gives up its ground, its marks and its camera, and what is left is the number, its unit and where it came from — the shape a weight takes once the albarán is made."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
            <WeightEntry label="Weight given" readOnly source="photo" defaultValue={5.02} ordered={5} />
            <WeightEntry label="Weight given" readOnly source="typed" defaultValue={0.85} size="compact" />
          </div>
        </Tile>

        <Tile
          span={12}
          name="Sizes"
          rule="Three densities of one field. The digit box, the marks and the camera move together on Base's own spacing scale, and the grams stay exactly one type step below the kilos at every size — the hierarchy is the ramp, never a decoration on top of it."
        >
          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {(['compact', 'default', 'large'] as const).map((size) => (
              <div key={size} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
                  {size}
                </span>
                <WeightEntry size={size} marks="on" defaultValue={5.02} camera={false} />
              </div>
            ))}
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
