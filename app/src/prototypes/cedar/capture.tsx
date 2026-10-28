/* THE CAPTURE DOORS — `capture.default`, made operable on both A-group surfaces.
 *
 * The second question is «how do orders reach you», and its answer is a DEFAULT: the door the
 * composer leads with. Every other door stays on the same surface, on every account, because a
 * house that mostly takes WhatsApp still gets a phone call, and a house whose reps put the orders
 * in still gets a voice note at 05:40.
 *
 * So the doors are a row of four, the account's own leads, and pressing another one re-leads the
 * composer under the person's hand. On the voice door the mic takes the row and the field follows
 * it; on the other three the field leads and the mic rides the composer's own voice slot. ONE
 * instance of the Composer and ONE of the Voice Button either way — the door decides where they
 * stand, never whether they exist.
 *
 * Today and Orders both hold this, which is why it is here rather than in either of them: two
 * copies of a door row is how two surfaces start disagreeing about what the answer meant.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Composer } from '../../rocoto/composer';
import { StatefulVoiceButton } from '../../rocoto/voice-button-kit';
import type { CaptureDoor } from './config';
import { FromYourSetup } from './anchors';

export const DOORS: Array<{ id: CaptureDoor; label: string }> = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'calls', label: 'Calls' },
  { id: 'voice', label: 'Voice' },
  { id: 'reps', label: 'The reps' },
];

export const PLACEHOLDER: Record<CaptureDoor, string> = {
  whatsapp: 'Write back to the customer',
  calls: 'Type what they said on the phone',
  voice: 'Hold the mic, or write it',
  reps: 'Put in the order the rep phoned through',
};

/** The four doors, the account's own leading. `short` is the derivation's own word for it, so the
 *  row and the day bar say the same thing. */
export function DoorRow({
  door,
  onDoor,
  short,
}: {
  door: CaptureDoor;
  onDoor: (d: CaptureDoor) => void;
  short: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', alignItems: 'center' }}>
      {DOORS.map((d) => (
        <span key={d.id} data-door={d.id} data-leading={d.id === door ? 'yes' : 'no'}>
          <Button
            kind={d.id === door ? KIND.primary : KIND.secondary}
            shape={SHAPE.pill}
            size={SIZE.mini}
            onClick={() => onDoor(d.id)}
          >
            {d.label}
          </Button>
        </span>
      ))}
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200 }}>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {short} leads
        </span>
        <FromYourSetup q="capture" />
      </span>
    </div>
  );
}

/** The composer, led by the door. */
export function DoorComposer({
  door,
  value,
  onChange,
  onSend,
  onVoice,
  seed,
  inputRef,
}: {
  door: CaptureDoor;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onVoice: (seconds: number) => void;
  /** the cast, so a simulated take is the same take on every reload of the same morning */
  seed: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}) {
  const [, theme] = useStyletron();
  /* THE TAKE GETS THE BAR (FEED-IA §13). On the three doors where the field leads, the mic rides
     the composer's one-button voice seat — and a take is a full-width instrument, so the composer
     is told the moment one starts and hands the row over until it ends. */
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const voice = (
    <StatefulVoiceButton
      simulate
      seed={seed}
      onBusyChange={setVoiceBusy}
      onRecord={(take) => onVoice(Math.round(take.durationMs / 1000))}
    />
  );

  if (door === 'voice') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }} data-testid="voice-leads">
        {voice}
        <Composer
          value={value}
          onChange={onChange}
          onSend={onSend}
          inputRef={inputRef}
          placeholder={PLACEHOLDER[door]}
        />
      </div>
    );
  }

  return (
    <Composer
      value={value}
      onChange={onChange}
      onSend={onSend}
      inputRef={inputRef}
      placeholder={PLACEHOLDER[door]}
      voiceActive={voiceBusy}
      voice={voice}
    />
  );
}
