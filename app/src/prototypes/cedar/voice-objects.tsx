/* THE VOICE OBJECTS — one drawing of each, mounted everywhere they stand (FEED-IA §196.6 · E193.07)
 *
 * Peter, 2026-09-04: «every part of the process, nothing half assed.»
 *
 * The identity card, the call row, the call sheet and the diarised transcript appear on THREE
 * surfaces — Messages' unmatched queue, the customer's own sheet, and the sheet an albarán opens
 * over itself — and «never redraw, lift the real thing» means they are ONE component each. A house
 * that draws a call twice ends up with two grammars for one fact, which is the defect §137 already
 * repealed on the customer sheet.
 *
 * Every read comes through `voice.ts`, so every posture here is one of the seam's closed set and
 * «Runtime offline» is drawn once, in `RuntimeStanding`, for all of them.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Glyph, STEP } from './glyphs';
import { FlagPill, flagBox, flagEdge, flagInk, flagTint } from './red-flag';
import {
  VOICE_COPY,
  atWords,
  callWhen,
  confidenceWord,
  copyLine,
  custodyWords,
  directionWord,
  durationWords,
  isMissed,
  mapDoorOf,
  phoneTypeWord,
  speakersOf,
  transcriptLines,
  transcriptWords,
  useHouseVoice,
  type CallObject,
  type CallsRead,
  type IdentityRead,
  type Readiness,
} from './voice';

/* ── THE STANDING LINE ──────────────────────────────────────────────────────────────────────
 * ONE sentence about the rail, wherever the rail is named: the state word, then what is true and
 * what to do. It is the only place the kit prints «Runtime offline», so the phrase cannot
 * drift between Connections and a customer's sheet. */
export function RuntimeStanding({
  readiness,
  testid = 'voice-standing',
  onRecheck,
}: {
  readiness: Readiness;
  testid?: string;
  onRecheck?: () => void;
}) {
  const [, theme] = useStyletron();
  const live = readiness.ready;
  return (
    <div
      data-testid={testid}
      data-voice-ready={live ? 'yes' : 'no'}
      data-voice-standing={readiness.standing}
      style={{
        display: 'grid',
        gridTemplateColumns: onRecheck ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        padding: theme.sizing.scale500,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelSmall, display: 'block', overflowWrap: 'anywhere' }}>{readiness.standing}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>
          {readiness.because}
        </span>
      </span>
      {onRecheck && (
        <Button
          kind={KIND.tertiary}
          size={SIZE.compact}
          onClick={onRecheck}
          data-testid={`${testid}-recheck`}
          overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
        >
          Check again
        </Button>
      )}
    </div>
  );
}

/* ── THE IDENTITY CARD (§196.6 «the number->gmaps info was working flawlessly») ──────────────
 * The Hermes lookup, ported: a number goes to Google Places through the runtime and comes back as
 * a place or as nothing. The card states its PROVENANCE on its own face — «From Google Places» —
 * because VOICE-07C's whole point is that Google is a suggestion and the house is the authority.
 * A found place carries its name, its address, the door onto the map, the line type and how well
 * the number matched. Nothing here links a customer; a person does that. */
export function IdentityCard({
  read,
  number,
  onLook,
  testid = 'identity-card',
  actions,
}: {
  read: IdentityRead;
  number: string;
  onLook?: () => void;
  testid?: string;
  actions?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const fact = (label: string, value: React.ReactNode, key: string) => (
    <div key={key} data-testid={`${testid}-${key}`} style={{ minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, display: 'block' }}>{label}</span>
      <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );

  const state = read.state;
  const identity = read.state === 'found' ? read.identity : undefined;
  const door = identity ? mapDoorOf(identity) : undefined;

  return (
    <section
      data-testid={testid}
      data-identity-state={state}
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        padding: theme.sizing.scale600,
        background: theme.colors.backgroundSecondary,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale400,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <span style={{ ...theme.typography.LabelSmall }}>Who this number belongs to</span>
        <span data-testid={`${testid}-provenance`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>
          {VOICE_COPY.fromGoogle}
        </span>
      </div>

      {state === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
            Ask Google Places what business answers on {number}.
          </span>
          {onLook && (
            <Button
              kind={KIND.secondary}
              size={SIZE.compact}
              onClick={onLook}
              data-testid={`${testid}-look`}
              overrides={{ BaseButton: { style: { minHeight: '44px', alignSelf: 'flex-start' } } }}
            >
              Look this number up
            </Button>
          )}
        </div>
      )}

      {state === 'looking' && (
        <span data-testid={`${testid}-looking`} aria-live="polite" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {VOICE_COPY.lookingUp}
        </span>
      )}

      {identity && (
        <>
          <div style={{ minWidth: 0 }}>
            <span data-testid={`${testid}-name`} style={{ ...theme.typography.HeadingXSmall, display: 'block', overflowWrap: 'anywhere' }}>{identity.name}</span>
            {identity.address && (
              <span data-testid={`${testid}-address`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>
                {identity.address}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: theme.sizing.scale400, minWidth: 0 }}>
            {fact('Number', identity.number, 'number')}
            {fact('Line', phoneTypeWord(identity), 'line')}
            {fact('Match', confidenceWord(identity), 'confidence')}
          </div>
          <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center' }}>
            {door && (
              /* THE MAP DOOR IS GOOGLE'S OWN CANONICAL LINK. A card without one shows no door at
                 all rather than a search that could land on the wrong street (VOICE-07C). */
              <Button
                kind={KIND.secondary}
                size={SIZE.compact}
                data-testid={`${testid}-map`}
                onClick={() => window.open(door, '_blank', 'noopener,noreferrer')}
                startEnhancer={<Glyph id="map" size={STEP.small} />}
                overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
              >
                Open the door on the map
              </Button>
            )}
            {actions}
          </div>
        </>
      )}

      {state === 'none' && (
        <span data-testid={`${testid}-none`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
          {VOICE_COPY.noPlace}
        </span>
      )}

      {(state === 'unreachable' || state === 'unavailable') && (
        <div data-testid={`${testid}-unreachable`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          <span style={{ ...theme.typography.LabelSmall }}>{VOICE_COPY.unreachable}</span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
            {read.state === 'unavailable' ? read.because : 'The lookup runs in the kit runtime; the browser reads it once the runtime answers.'}
          </span>
          {onLook && (
            <Button
              kind={KIND.tertiary}
              size={SIZE.compact}
              onClick={onLook}
              data-testid={`${testid}-retry`}
              overrides={{ BaseButton: { style: { minHeight: '44px', alignSelf: 'flex-start' } } }}
            >
              Look it up again
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/* ── ONE CALL, AS A COMMUNICATION OBJECT (VOICE-07A) ────────────────────────────────────────
 * The same anatomy on every row, in the same columns, whether the call lasted two seconds or nine
 * minutes (§195's checkout-grade consistency, applied to this rail): the channel mark, what kind
 * of call it was, when and how long, and one state about audio. A MISSED inbound call wears the
 * red vocabulary (§196.3) — outline, pill and ink — because it is the one call that owes the house
 * an act. */
export function CallRow({
  call,
  onOpen,
  testid,
}: {
  call: CallObject;
  onOpen?: () => void;
  testid?: string;
}) {
  const [css, theme] = useStyletron();
  const missed = isMissed(call);
  const body = (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: theme.borders.radius300,
          background: missed ? flagTint(theme) : theme.colors.backgroundSecondary,
          border: missed ? `1px solid ${flagEdge(theme)}` : undefined,
          color: missed ? flagInk(theme) : undefined,
          flexShrink: 0,
        }}
      >
        <Glyph id={missed ? 'callEnd' : 'call'} size={STEP.medium} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
          <span data-testid={testid ? `${testid}-kind` : undefined} style={{ ...theme.typography.LabelSmall, color: missed ? flagInk(theme) : undefined }}>
            {directionWord(call)}
          </span>
          {missed && <FlagPill kind="response" word="Missed" testid={testid ? `${testid}-flag` : undefined} />}
        </span>
        {/* WHEN, AND HOW LONG — and on a call nobody took, only WHEN. A dash where a duration
            belongs is a value that says nothing and still takes a column (§195). */}
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', overflowWrap: 'anywhere' }}>
          {[callWhen(call), missed ? '' : durationWords(call.durationSeconds)].filter(Boolean).join(' · ')}
        </span>
      </span>
      {/* THE TAIL IS THE ONE CONCISE STATE (VOICE-07A), never a second way of saying the kind:
          «Incoming call» already says who rang, so the right column carries what came of the audio. */}
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', textAlign: 'right' }}>
        {transcriptWords(call)}
      </span>
    </>
  );

  const shape = {
    minHeight: 64,
    padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
    display: 'grid',
    gridTemplateColumns: '40px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: theme.sizing.scale400,
    boxSizing: 'border-box' as const,
    width: '100%',
    borderRadius: theme.borders.radius400,
    ...flagBox(theme, missed),
  };

  if (!onOpen) {
    return <div data-testid={testid} data-call={call.sid} data-call-missed={missed ? 'yes' : 'no'} style={shape}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testid}
      data-call={call.sid}
      data-call-missed={missed ? 'yes' : 'no'}
      aria-label={`${directionWord(call)} · ${callWhen(call)}`}
      className={css({
        appearance: 'none',
        border: 'none',
        font: 'inherit',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'default',
        backgroundColor: 'transparent',
        ':hover': { backgroundColor: theme.colors.backgroundSecondary },
        ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' },
      })}
      style={shape}
    >
      {body}
    </button>
  );
}

/* ── THE CALLS ON ONE NUMBER, WITH THEIR HONEST POSTURES ────────────────────────────────────
 * Four states and not one of them invents a call: loading, the list (empty is an answer), the
 * runtime out of reach, and the runtime refusing by name. */
export function CallList({
  read,
  onOpen,
  testid = 'call-list',
  empty,
}: {
  read: CallsRead;
  onOpen?: (call: CallObject) => void;
  testid?: string;
  empty?: string;
}) {
  const [, theme] = useStyletron();
  if (read.state === 'idle' || read.state === 'loading') {
    return (
      <span data-testid={`${testid}-loading`} aria-live="polite" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
        {VOICE_COPY.callsLoading}
      </span>
    );
  }
  if (read.state === 'unreachable' || read.state === 'unavailable') {
    return (
      <div data-testid={`${testid}-unreachable`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        <span style={{ ...theme.typography.LabelSmall }}>{VOICE_COPY.unreachable}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
          {read.state === 'unavailable' ? read.because : 'Calls are held by the kit runtime; the browser reads them once the runtime answers.'}
        </span>
      </div>
    );
  }
  if (read.calls.length === 0) {
    return (
      <span data-testid={`${testid}-empty`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
        {empty ?? VOICE_COPY.noCalls}
      </span>
    );
  }
  return (
    <div data-testid={testid} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
      {read.calls.map((call) => (
        <CallRow key={call.sid} call={call} onOpen={onOpen ? () => onOpen(call) : undefined} testid={`${testid}-row`} />
      ))}
    </div>
  );
}

/* ── THE DIARISED SPANISH TRANSCRIPT (§196.6 «clear speaker diarisation. set to spanish») ────
 * Every line names its voice and its second in the call. The house's voice and the caller's are
 * told apart by the channel assumption `voice.ts` states out loud, and ONE control flips it — a
 * correction the call remembers. Each line can be taken away as a quote, named and timed, because
 * the reason to read a call is to answer it. */
export function TranscriptPanel({
  call,
  houseName,
  themName,
  testid = 'call-transcript',
}: {
  call: CallObject;
  houseName: string;
  themName: string;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const { houseSpeaker, swap } = useHouseVoice(call.sid);
  const [copied, setCopied] = React.useState<string | null>(null);
  const transcript = call.transcript;

  if (!transcript) {
    return (
      <span data-testid={`${testid}-absent`} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
        {custodyWords(call)} · this call kept no words.
      </span>
    );
  }

  const speakers = speakersOf(transcript);
  const lines = transcriptLines(transcript, { houseSpeaker, houseName, themName });

  return (
    <div data-testid={testid} data-transcript-language={transcript.language} data-house-speaker={houseSpeaker} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <span data-testid={`${testid}-provenance`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
          {transcript.provider} · Spanish · {speakers.length} {speakers.length === 1 ? 'voice' : 'voices'} · {houseName} is voice {houseSpeaker + 1}
        </span>
        {speakers.length > 1 && (
          <Button
            kind={KIND.tertiary}
            size={SIZE.compact}
            onClick={() => swap(speakers)}
            data-testid={`${testid}-swap`}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
          >
            Swap voices
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
        {lines.map((line, index) => {
          const mine = line.side === 'house';
          const id = `${call.sid}-${index}`;
          return (
            <div
              key={id}
              data-testid={`${testid}-line`}
              data-side={line.side}
              style={{
                maxWidth: '86%',
                alignSelf: mine ? 'flex-end' : 'flex-start',
                border: `1px solid ${theme.colors.borderOpaque}`,
                borderRadius: theme.borders.radius400,
                padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                background: mine ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
                minWidth: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{line.who}</span>
                <span data-testid={`${testid}-at`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{line.at}</span>
              </span>
              <span style={{ ...theme.typography.ParagraphSmall, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>{line.utterance.text}</span>
              <Button
                kind={KIND.tertiary}
                size={SIZE.mini}
                data-testid={`${testid}-quote`}
                onClick={() => { copyLine(line.quote).then((done) => setCopied(done ? id : null)); }}
                overrides={{ BaseButton: { style: { minHeight: '44px', marginTop: theme.sizing.scale200, paddingLeft: theme.sizing.scale300, paddingRight: theme.sizing.scale300 } } }}
              >
                {copied === id ? 'Copied · paste it in the reply' : 'Quote this line'}
              </Button>
            </div>
          );
        })}
      </div>

      {/* WHAT THE TRANSCRIPT IS, IN THE PLACE IT IS READ (VOICE-09B · VOICE-18). The audio is not
          here and never was: the browser is handed words, and the recording's custody is stated
          beside them so nobody assumes a file they can play. */}
      <span data-testid={`${testid}-custody`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
        {custodyWords(call)} · the words stay in this account.
      </span>
    </div>
  );
}

/* ── THE CALL, OPENED (VOICE-07A's call detail) ─────────────────────────────────────────────
 * Facts first, then the words, then what the rail actually did. Provider identifiers and media
 * URLs never appear; the sid is the runtime's own reference and stays out of the reader's way. */
export function CallDetail({
  call,
  houseName,
  themName,
  testid = 'call-detail',
  actions,
}: {
  call: CallObject;
  houseName: string;
  themName: string;
  testid?: string;
  actions?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const facts: [string, string][] = [
    ['Direction', directionWord(call)],
    ['Duration', durationWords(call.durationSeconds)],
    ['Audio', custodyWords(call)],
  ];
  return (
    <div data-testid={testid} data-call={call.sid} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: theme.sizing.scale300, minWidth: 0 }}>
        {facts.map(([label, value]) => (
          <div key={label} style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{label}</span>
            <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: theme.sizing.scale400, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, display: 'block' }}>Between</span>
          <span data-testid={`${testid}-parties`} style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>
            {call.from} → {call.to}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, display: 'block' }}>When</span>
          <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2 }}>{callWhen(call)}</span>
        </div>
      </div>

      {isMissed(call) && (
        /* THE MISSED CALL SAYS WHAT IT LEFT BEHIND (§196.3 · the step §196.6 did not spell out):
           nobody in the house took it, so the act it owes is stated where the call is read. */
        <div
          data-testid={`${testid}-missed`}
          style={{
            border: `1px solid ${flagEdge(theme)}`,
            background: flagTint(theme),
            borderRadius: theme.borders.radius300,
            padding: theme.sizing.scale500,
            color: flagInk(theme),
            ...theme.typography.LabelSmall,
            overflowWrap: 'anywhere',
          }}
        >
          The call rang out. Ring them back from here.
        </div>
      )}

      <details style={{ minWidth: 0 }}>
        <summary style={{ minHeight: 44, paddingTop: theme.sizing.scale400, ...theme.typography.LabelMedium, cursor: 'pointer' }}>Transcript</summary>
        <TranscriptPanel call={call} houseName={houseName} themName={themName} testid={`${testid}-transcript`} />
      </details>

      {actions && <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

/** «0:07» is worth exporting beside the objects that print it, so a drive and a surface read the
 *  same clock. */
export { atWords };
