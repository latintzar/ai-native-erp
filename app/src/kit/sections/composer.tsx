/* Composer — the message-writing bar. Grown from Base's template-component scaffold over Base's
 * own Input anatomy (see src/rocoto/composer/); this page demonstrates it like any other
 * component, one Tile per state.
 *
 * THE COPY HERE IS NEUTRAL ON PURPOSE. «Hello», «Alpha … Echo», a grey photograph. A themed demo
 * silently decides which control serves which moment of the product; that mapping belongs to the
 * situations catalogue, made explicitly, later.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import Paperclip from 'baseui/icon/paperclip-filled';
import { Composer } from '../../rocoto/composer';
import type { Attachment, Suggestion } from '../../rocoto/composer';

/* ── DEMO CONTENT ─────────────────────────────────────────────────────────────────────────────
   A neutral photograph, drawn from the theme's own greys so the kit has no colour of its own in
   it. It stands for «an image is attached», and says nothing about what the image is of. */
const photograph = (ground: string, sun: string, hill: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
      `<rect width="96" height="96" fill="${ground}"/>` +
      `<circle cx="34" cy="30" r="11" fill="${sun}"/>` +
      `<path d="M0 96 L32 48 L58 78 L74 60 L96 84 L96 96 Z" fill="${hill}"/>` +
      `</svg>`
  )}`;

const SUGGESTIONS: Suggestion[] = [
  { id: 'alpha', label: 'Alpha', description: 'The first option' },
  { id: 'bravo', label: 'Bravo', description: 'The second option' },
  { id: 'charlie', label: 'Charlie', description: 'The third option' },
  { id: 'delta', label: 'Delta', description: 'The fourth option' },
  { id: 'echo', label: 'Echo', description: 'The fifth option' },
];

/** THE VOICE SEAT, DRAWN AS A SEAT. The Voice Button is its own component and mounts here; the
 *  kit draws the slot rather than a second voice control, so this page cannot quietly grow a
 *  rival to it. */
function VoiceSeat() {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: `1px dashed ${theme.colors.contentTertiary}`,
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
      }}
    >
      slot
    </div>
  );
}

/** the clip that rides inside the field, after the input */
function Clip({ disabled }: { disabled?: boolean }) {
  const [, theme] = useStyletron();
  return (
    <button
      type="button"
      aria-label="Attach a file"
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: theme.sizing.scale800,
        height: theme.sizing.scale800,
        padding: 0,
        border: 'none',
        background: 'transparent',
        color: theme.colors.contentPrimary,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Paperclip size={theme.sizing.scale700} title="" aria-hidden="true" />
    </button>
  );
}

const full: React.CSSProperties = { width: '100%' };

/* ── ONE TILE, ONE STATE ─────────────────────────────────────────────────────────────────── */

function Empty() {
  const [value, setValue] = React.useState('');
  return (
    <div style={full}>
      <Composer value={value} onChange={setValue} onSend={() => setValue('')} voice={<VoiceSeat />} />
    </div>
  );
}

function Typing() {
  const [value, setValue] = React.useState('Hello');
  return (
    <div style={full}>
      <Composer value={value} onChange={setValue} onSend={() => setValue('')} voice={<VoiceSeat />} />
    </div>
  );
}

function Growing() {
  const [value, setValue] = React.useState(
    'Hello\nSecond line\nThird line\nFourth line\nFifth line\nSixth line'
  );
  return (
    <div style={full}>
      <Composer value={value} onChange={setValue} onSend={() => setValue('')} voice={<VoiceSeat />} />
    </div>
  );
}

function WithAttachments() {
  const [, theme] = useStyletron();
  const initial: Attachment[] = React.useMemo(
    () => [
      {
        id: 'a',
        label: 'Photograph one',
        src: photograph(theme.colors.mono300, theme.colors.mono500, theme.colors.mono400),
      },
      {
        id: 'b',
        label: 'Photograph two',
        src: photograph(theme.colors.mono400, theme.colors.mono300, theme.colors.mono500),
      },
    ],
    [theme]
  );
  const [items, setItems] = React.useState(initial);
  const [value, setValue] = React.useState('');
  return (
    <div style={{ ...full, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <Composer
        value={value}
        onChange={setValue}
        onSend={() => setValue('')}
        attachments={items}
        onRemoveAttachment={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
        voice={<VoiceSeat />}
      />
      <Button
        size={BUTTON_SIZE.mini}
        kind={KIND.secondary}
        onClick={() => setItems(initial)}
        disabled={items.length === initial.length}
      >
        Reset
      </Button>
    </div>
  );
}

function Sending() {
  return (
    <div style={full}>
      <Composer value="Hello" onChange={() => undefined} sending voice={<VoiceSeat />} />
    </div>
  );
}

function Disabled() {
  return (
    <div style={full}>
      <Composer value="Hello" onChange={() => undefined} disabled voice={<VoiceSeat />} />
    </div>
  );
}

function AttachmentSlotExample() {
  const [value, setValue] = React.useState('');
  return (
    <div style={full}>
      <Composer
        value={value}
        onChange={setValue}
        onSend={() => setValue('')}
        attachment={<Clip />}
        voice={<VoiceSeat />}
      />
    </div>
  );
}

/** The combobox anatomy, on the last word being typed: the host filters, the component owns the
 *  roles and the keys. Taking a row replaces that word and leaves the caret in the field. */
function Autocomplete() {
  const [, theme] = useStyletron();
  const [value, setValue] = React.useState('');
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const token = value.slice(value.lastIndexOf(' ') + 1);
  const options = SUGGESTIONS.filter((s) => s.label.toLowerCase().startsWith(token.toLowerCase()));

  /* the stage is as tall as the list needs, because the list floats out of the bar's own box */
  return (
    <div
      style={{
        ...full,
        height: 248,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
        <Button
          size={BUTTON_SIZE.mini}
          kind={KIND.secondary}
          onClick={() => ref.current && ref.current.focus()}
        >
          Open the list
        </Button>
        <span
          style={{
            ...theme.typography.LabelXSmall,
            color: theme.colors.contentTertiary,
            maxWidth: '32ch',
          }}
        >
          Up and Down move the active row · Enter takes it · Escape closes the list
        </span>
      </div>
      <Composer
        inputRef={ref}
        value={value}
        onChange={setValue}
        onSend={() => setValue('')}
        suggestions={options}
        onSelectSuggestion={(s) => setValue(`${value.slice(0, value.lastIndexOf(' ') + 1)}${s.label} `)}
        voice={<VoiceSeat />}
      />
    </div>
  );
}

function Sizes() {
  const [, theme] = useStyletron();
  const [value, setValue] = React.useState('Hello');
  return (
    <div style={{ ...full, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {(['compact', 'default', 'large'] as const).map((s) => (
        <div key={s} style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <span
            style={{
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              width: 64,
              paddingBottom: 14,
            }}
          >
            {s}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Composer
              size={s}
              value={value}
              onChange={setValue}
              onSend={() => setValue('')}
              attachment={<Clip />}
              voice={<VoiceSeat />}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ComposerSection() {
  return (
    <Section
      t="Composer"
      n="The bar a message is written in. It grows with what is typed and stops at five lines, stages what is attached above the field, and hands its trailing seat back to voice the moment the field is empty."
    >
      <Grid>
        <Tile
          span={6}
          name="Empty"
          rule="Nothing written and nothing attached: the field states its placeholder, and the trailing seat belongs to voice. The seat is the send control's exact footprint, so the bar does not resize when the first character is typed."
        >
          <Empty />
        </Tile>

        <Tile
          span={6}
          name="Typing"
          rule="Words in the field: the send control takes the seat. Enter sends, Shift+Enter breaks the line. The field is controlled — the surface clears it once the message is away."
        >
          <Typing />
        </Tile>

        <Tile
          span={6}
          name="Growing"
          rule="The field takes the height of what is in it and stops at five lines; past that it scrolls. The ceiling is stated in lines and measured on the element, never held as a pixel number — a pixel ceiling changes how many lines you get the moment the type scale moves."
        >
          <Growing />
        </Tile>

        <Tile
          span={6}
          name="With attachments"
          rule="What is attached is shown before it is sent, in its own row above the field, each item removable. One attachment makes the message sendable with no words in it at all, so the send control is there while the field is still empty."
        >
          <WithAttachments />
        </Tile>

        <Tile
          span={4}
          name="Sending"
          rule="The message is in flight: the field is inert and the send control turns. The ring is ink, not saffron — saffron marks Rocoto's own act, and sending is the person's."
        >
          <Sending />
        </Tile>

        <Tile
          span={4}
          name="Disabled"
          rule="The whole bar is out of service. Base's own disabled field fill and disabled button pair, unchanged."
        >
          <Disabled />
        </Tile>

        <Tile
          span={4}
          name="Attachment slot"
          rule="Base's enhancer contract, on the trailing edge: a control that lives inside the field's own border and takes the field's padding. It sits after the input because that is where people already reach for it."
        >
          <AttachmentSlotExample />
        </Tile>

        <Tile
          span={6}
          name="Autocomplete"
          rule="Base's combobox anatomy, opening upward because the bar sits at the foot of its surface. Arrow keys move the active row, Escape closes it, and Enter takes the active row instead of sending — the one collision a composer makes, resolved in favour of the key the person just navigated with."
        >
          <Autocomplete />
        </Tile>

        <Tile
          span={6}
          name="Sizes"
          rule="Base's own field steps, minus mini. The trailing control is derived from the same line-height, padding and border as the field, so the two are the same height at every size instead of agreeing at the default one and drifting at the others."
        >
          <Sizes />
        </Tile>
      </Grid>
    </Section>
  );
}
