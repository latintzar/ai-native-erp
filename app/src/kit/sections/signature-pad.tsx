/* SIGNATURE PAD — the kit page.
 *
 * Every pad on this page is the real component. The ones that arrive already signed are drawn by
 * the component's own seeded hand (`signatureFromSeed`), so this page is alive on a browser
 * nobody has touched, and it draws the SAME signature on the second load — which is what makes a
 * screenshot of it worth diffing. The seeded hand spells nothing on purpose: a legible name would
 * be somebody's.
 *
 * DEMO CONTENT IS GENERIC. A signature, a date, a name in a name field. A pad captioned with a
 * delivery or an acceptance would quietly decide which moment of the product this control serves,
 * and that mapping is the situations catalogue's job, made explicitly, later.
 *
 * THE STATE TILES ARE PINNED, the rest are live. `state` pins a pad to one of the six so the
 * matrix can be read at rest; every other pad on this page runs its own state, so signing on one
 * and clearing it walks the whole cycle: empty → signing → signed → cleared.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Section, Tile, Grid } from '../chrome';
import { SignaturePad, signatureFromSeed } from '../../rocoto/signature-pad';
import type { SignatureValue } from '../../rocoto/signature-pad';

/* the box the seeded hands are captured in — close to the width a default pad gets in a tile, so
   the marks land at their own scale rather than fitted down to it */
const CAPTURE = { width: 420, height: 132 };

const SIGNED: SignatureValue = signatureFromSeed('hello', CAPTURE);
const HALF: SignatureValue = signatureFromSeed('hello', CAPTURE, 0.55);
const SECOND: SignatureValue = signatureFromSeed('second', CAPTURE);
const TYPED: SignatureValue = {
  strokes: [],
  path: '',
  width: CAPTURE.width,
  height: CAPTURE.height,
  durationMs: 0,
  typedName: 'Alex Morgan',
};

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

/** the typed-name field, controlled — the way a form owns what was typed into it */
function TypedNameExample() {
  const [name, setName] = React.useState('Alex Morgan');
  return (
    <SignaturePad
      size="compact"
      typedNameValue={name}
      onTypedNameChange={setName}
      hint="Both ways to sign are open at once."
    />
  );
}

/** a stored mark, drawn in again on demand — a record page re-entering is what this is */
function ReplayExample() {
  const [take, setTake] = React.useState(0);
  // a new value is what triggers a draw-in, so each press hands the pad the same signature afresh
  const shown = React.useMemo(() => ({ ...SIGNED }), [take]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <SignaturePad readOnly replay value={shown} />
      <div style={{ alignSelf: 'flex-start' }}>
        <Button kind={KIND.tertiary} size={BUTTON_SIZE.compact} onClick={() => setTake(take + 1)}>
          Play again
        </Button>
      </div>
    </div>
  );
}

/** one line of a record: when it was signed, and the mark it was signed with */
function RecordRow({ when, value }: { when: string; value: SignatureValue }) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        paddingTop: 10,
        paddingBottom: 10,
        borderTop: `1px solid ${theme.colors.borderTransparent}`,
      }}
    >
      <span
        style={{
          ...theme.typography.LabelSmall,
          color: theme.colors.contentSecondary,
          width: 104,
          flex: 'none',
        }}
      >
        {when}
      </span>
      <div style={{ width: 150, flex: 'none' }}>
        <SignaturePad readOnly size="compact" value={value} />
      </div>
    </div>
  );
}

export default function SignaturePadSection() {
  const [, theme] = useStyletron();

  return (
    <Section
      t="Signature Pad"
      n="the surface a hand signs on — a canvas while the finger is down, one SVG path afterwards, and a typed name for a hand that signs by saying who it is"
    >
      <Grid>
        <Tile
          span={6}
          name="Empty"
          rule="The ✕ says which end of the line the hand starts at. Sign with a finger, a mouse or a stylus — pressure is never read, so the same hand draws the same signature on all three."
        >
          <SignaturePad />
        </Tile>

        <Tile
          span={6}
          name="Signing"
          rule="Ink is down and the decision is open. Every sample the digitiser delivered inside the frame is kept, so a fast loop stays a loop; the marks are smoothed through their own midpoints, and no sample is moved."
        >
          <SignaturePad state="signing" defaultValue={HALF} />
        </Tile>

        <Tile
          span={6}
          name="Signed"
          rule="Confirmed. The canvas hands over to one SVG path — the form a record stores and replays — and the only decision left is to clear it. This pad is live: clear it and sign it again."
        >
          <SignaturePad defaultValue={SIGNED} />
        </Tile>

        <Tile
          span={6}
          name="Cleared"
          rule="The ink came off and the line is ready. It is empty with a memory: the pad says what just happened, then asks for the same thing the empty state asks for."
        >
          <SignaturePad state="cleared" />
        </Tile>

        <Tile
          span={6}
          name="Disabled"
          rule="Shown and taking nothing: the ground drops to Base's disabled fill, the ink and the line drop to its disabled content, and the surface leaves the tab order. It is the one state with no sentence under it — an instruction under a surface that will refuse it is worse than silence."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
            <SignaturePad disabled typedName={false} />
            <SignaturePad disabled typedName={false} defaultValue={SIGNED} />
          </div>
        </Tile>

        <Tile
          span={6}
          name="Error"
          rule="A signature is required here. The edge takes weight rather than a hue — this system has no red — and the line under the pad says what IS required, never what is missing."
        >
          <SignaturePad error />
        </Tile>

        <Tile
          span={6}
          name="Typed name"
          rule="Some hands cannot draw a name. The field is part of the component, in the tab order, at full weight beside the pad — and what is typed lands on the line as it is typed, set in the company's own face. A typed signature is a typed signature; a script face pretending to be handwriting would be the one dishonest thing here."
        >
          <TypedNameExample />
        </Tile>

        <Tile
          span={6}
          name="Replay"
          rule="A stored mark draws itself in over the time the signing took, held between 0.4s and 3.2s, and drawn at once for anyone who asked their system for less motion."
        >
          <ReplayExample />
        </Tile>

        <Tile
          span={12}
          name="On a record"
          rule="The same component, read-only and compact: the mark and the line it was signed on. Here it is framed by its own ink rather than by the pad it was captured on, and placed by its own baseline, so a signature written across a phone fills a record row and still sits ON the line. The ink thins with the square root of the scale — constant ink fills every loop at this size, proportional ink disappears."
        >
          <div style={{ width: '100%', maxWidth: 520 }}>
            <RecordRow when="12 Mar 2026" value={SIGNED} />
            <RecordRow when="14 Mar 2026" value={SECOND} />
            <RecordRow when="19 Mar 2026" value={TYPED} />
          </div>
        </Tile>

        <Tile
          span={6}
          name="The path"
          rule="What is actually kept. The canvas and this string are generated by one smoothing function, so the record holds exactly the marks the person watched — two implementations would be how a signature comes back looking like somebody else's."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <SignaturePad readOnly value={SIGNED} />
            <div
              style={{
                ...theme.typography.ParagraphXSmall,
                color: theme.colors.contentSecondary,
                wordBreak: 'break-all',
              }}
            >
              {SIGNED.path.slice(0, 128)}…
            </div>
            <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
              {SIGNED.strokes.length} strokes · {SIGNED.path.length} characters ·{' '}
              {SIGNED.durationMs} ms
            </div>
          </div>
        </Tile>

        <Tile
          span={6}
          name="Sizes"
          rule="Three densities of one pad. The surface, the record height and the ink move together; the ink takes the same three thicknesses the Waveform's marks take, because a hand-drawn line and a sound-drawn line on one screen at two weights is two systems."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
            {(['compact', 'default', 'large'] as const).map((size) => (
              <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Caption>{size}</Caption>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SignaturePad size={size} typedName={false} defaultValue={SIGNED} />
                </div>
              </div>
            ))}
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
