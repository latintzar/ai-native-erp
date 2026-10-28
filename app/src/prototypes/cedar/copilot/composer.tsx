/* THE AGENT'S COMPOSER — the desk's writing box, ported from app.soyrocoto.com (FEED-IA §196.2:
 * «i told u to port from the fucking app.soyrocoto.com which has the exact UX i wanted for the
 * actual chat and composer in full even down to the grid»).
 *
 * ═══ WHAT WAS PORTED, AND FROM WHERE ════════════════════════════════════════════════════════
 * The live app's `src/chat/Composer.tsx` carries TWO shapes on one machine (its own header says
 * so): the WhatsApp `pill` — one seat that swaps mic ↔ send — and the `editor`, which is the
 * copilot's: «a multi-line editor with a control row under it — send ALWAYS visible, a
 * backgroundless mic beside it — because on this surface the mic DICTATES: speak, the words land
 * in the box, type more, speak more, send once».
 *
 * That is the anatomy below, element for element (`src/chat/composer-editor.css`):
 *
 *     ┌──────────────────────────────────────────┐
 *     │  what you are writing, wrapping, growing │
 *     │                                          │
 *     │  live state                🎤     ( ➤ )  │   send ALWAYS there, dimmed until
 *     └──────────────────────────────────────────┘   there is something to send
 *
 *   · the BOX owns focus, not the field inside it (two chromes for one control is what the app
 *     measured and fixed; here the box's border thickens and the field's own ring is suppressed);
 *   · the field grows with what is written and then scrolls — measured on the element, never a
 *     pixel ceiling, so it follows the type scale;
 *   · Enter sends, Shift+Enter breaks the line — the editor grammar, not the chat one;
 *   · a take REPLACES the writing surface and the recorder owns the row, then the handoff row
 *     («Transcribing…») stands where the waveform was until the words arrive IN the box, added
 *     onto whatever was already typed.
 *
 * ═══ WHAT WAS NOT COPIED, AND WHY ═══════════════════════════════════════════════════════════
 * THE RECORDER. The app's file re-earns VoiceRecorderBar.kt line by line; this kit already
 * carries that machine as its own component (`rocoto/voice-button-kit` — gesture, lock chip,
 * meter, hands-free verbs, MediaRecorder and the dBFS window). «Never redraw — lift the real
 * thing»: this file is LAYOUT over that component, which is exactly the relationship the app's
 * own header describes between its two variants.
 *
 * THE SEND CIRCLE'S SAFFRON. The app paints it accent; in this kit the accent marks Rocoto's own
 * act and nothing else, and sending is the person's act — so send is ink (the kit Composer's own
 * law, `rocoto/composer/composer.tsx`).
 *
 * ═══ THE MIC IS DICTATION, AND IT IS HONEST ABOUT ITS RUNTIME (§196.2 · §196.6) ══════════════
 * The words go to Deepgram nova-3 in Spanish through the kit runtime (`runtime.transcribe`).
 * When that service is not there the row says «Runtime offline» and the typing surface
 * stays exactly as usable — a fabricated transcript is never an option.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import ArrowUp from 'baseui/icon/arrow-up';
import { StatefulVoiceButton, type Take } from '../../../rocoto/voice-button-kit';
import { Glyph, STEP } from '../glyphs';
import { RuntimeUnreachable, runtime as kitRuntime } from '../runtime-client';
import type { AssistantRuntimeAdapter } from './types';

/** the writing surface's ceiling, stated in LINES and measured on the element (the port's law) */
const MAX_LINES = 7;

export type CopilotComposerProps = {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  placeholder?: string;
  sendLabel?: string;
  disabled?: boolean;
  /** the approved dictation seam — a host adapter wins over the kit runtime */
  adapter?: AssistantRuntimeAdapter;
  /** the deterministic level source's seed, so a screenshot of a take is the same picture tomorrow */
  seed: string;
  testId?: string;
  /** the line under the box. A phone has no Enter and no Shift, so the surface says which it is. */
  helpText?: string;
  /** the row above the box: starters, a channel note, whatever the surface puts on its doorstep */
  children?: React.ReactNode;
};

type Dictation =
  | { state: 'idle' }
  | { state: 'working'; ms: number }
  | { state: 'said'; words: number }
  | { state: 'unreachable' }
  | { state: 'no-microphone' }
  | { state: 'failed' };

export function CopilotComposer({
  value, onChange, onSend, placeholder = 'Tell it what you need…', sendLabel = 'Send to the Copilot',
  disabled = false, adapter, seed, testId = 'copilot-composer', children,
  helpText = 'Enter sends · Shift+Enter for a new line',
}: CopilotComposerProps) {
  const [css, theme] = useStyletron();
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [dictation, setDictation] = React.useState<Dictation>({ state: 'idle' });
  const areaRef = React.useRef<HTMLTextAreaElement>(null);
  const latest = React.useRef(value);
  latest.current = value;

  const hasText = value.trim().length > 0;
  const canSend = hasText && !disabled;
  const working = dictation.state === 'working';

  /* THE GROWTH (the port's, computed rather than stated): the box takes the height of what is in
     it — including words dictation appended, which is why this watches `value` and not a key. */
  React.useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const ceiling = Math.round(line * MAX_LINES + padding);
    const wanted = Math.ceil(el.scrollHeight);
    el.style.height = `${Math.min(wanted, ceiling)}px`;
    el.style.overflowY = wanted > ceiling ? 'auto' : 'hidden';
  }, [value, theme]);

  const appendWords = (words: string) => {
    const trimmed = words.trim();
    if (!trimmed) return 0;
    const current = latest.current.trimEnd();
    onChange(current ? `${current} ${trimmed}` : trimmed);
    return trimmed.split(/\s+/).length;
  };

  /** THE HANDOFF (§196.2 · §196.6). A take becomes WORDS, never audio: the copilot reads what was
   *  meant. The adapter's approved transport wins; otherwise the kit runtime's Deepgram call. */
  const takeWords = async (take: Take) => {
    const said = adapter?.dictate?.(take);
    if (said !== undefined) {
      const count = appendWords(said);
      setDictation(count ? { state: 'said', words: count } : { state: 'failed' });
      return;
    }
    if (!take.blob) { setDictation({ state: 'no-microphone' }); return; }
    setDictation({ state: 'working', ms: take.durationMs });
    try {
      const result = await kitRuntime.transcribe(take.blob);
      const count = appendWords(result.transcript);
      setDictation(count ? { state: 'said', words: count } : { state: 'failed' });
    } catch (error) {
      setDictation(error instanceof RuntimeUnreachable ? { state: 'unreachable' } : { state: 'failed' });
    }
  };

  /* the state line under the box — one sentence, and every one of them says what to do next */
  const line: { text: string; tone: 'quiet' | 'loud' } | null =
    dictation.state === 'working' ? { text: 'Transcribing…', tone: 'quiet' }
    : dictation.state === 'said' ? { text: `Dictated ${dictation.words} ${dictation.words === 1 ? 'word' : 'words'} into the box. Edit it, then send.`, tone: 'quiet' }
    : dictation.state === 'unreachable' ? { text: 'Runtime offline · type the words here.', tone: 'loud' }
    : dictation.state === 'no-microphone' ? { text: 'Dictation needs this browser’s microphone. Type it here meanwhile.', tone: 'loud' }
    : dictation.state === 'failed' ? { text: 'Say it again, or type it here.', tone: 'loud' }
    : null;

  return (
    <div data-testid={testId} data-dictation={dictation.state} style={{ display: 'grid', gap: theme.sizing.scale300, minWidth: 0 }}>
      {children}
      <div
        data-testid={`${testId}-box`}
        className={css({
          display: 'grid',
          gap: theme.sizing.scale200,
          padding: theme.sizing.scale400,
          boxSizing: 'border-box',
          minWidth: 0,
          borderRadius: theme.borders.radius400,
          backgroundColor: theme.colors.backgroundPrimary,
          /* THE BOX OWNS FOCUS, not the field inside it (the port's measured fix) */
          boxShadow: `inset 0 0 0 1px ${theme.colors.borderOpaque}`,
          ':focus-within': { boxShadow: `inset 0 0 0 2px ${theme.colors.borderSelected}` },
        })}
      >
        {!voiceBusy && (
          <textarea
            ref={areaRef}
            data-testid={`${testId}-input`}
            rows={1}
            value={value}
            disabled={disabled || working}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (canSend) onSend();
              }
            }}
            className={css({
              width: '100%',
              boxSizing: 'border-box',
              minWidth: 0,
              resize: 'none',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: theme.colors.contentPrimary,
              caretColor: theme.colors.contentPrimary,
              ...theme.typography.ParagraphSmall,
              lineHeight: '1.55',
              paddingTop: theme.sizing.scale100,
              paddingBottom: 0,
              paddingLeft: theme.sizing.scale100,
              paddingRight: theme.sizing.scale100,
              '::placeholder': { color: theme.colors.contentTertiary },
            })}
          />
        )}

        {/* THE CONTROL ROW — spring, mic, send. The recorder takes the whole row for as long as a
            take runs (the kit Composer's own `voiceActive` law), and hands it straight back. */}
        <div
          data-testid={`${testId}-controls`}
          data-voice={voiceBusy ? 'leading' : 'resting'}
          style={{ display: 'flex', alignItems: 'flex-end', gap: theme.sizing.scale200, minHeight: '44px', minWidth: 0 }}
        >
          <span style={{ flex: '1 1 auto', minWidth: 0 }} />
          <StatefulVoiceButton
            seed={seed}
            disabled={disabled || working}
            onBusyChange={setVoiceBusy}
            onRecord={(take) => { void takeWords(take); }}
            /* the verbs are DICTATION's here: a take becomes words in the box, not a voice note */
            labels={{ record: 'Dictate — press and hold', send: 'Turn the note into words' }}
            overrides={{
              Mic: {
                props: { 'data-testid': `${testId}-mic` },
                /* the ghost mic: the drawing IS the target, no filled disc beside the send */
                style: ({ $theme }) => ({
                  backgroundColor: 'transparent',
                  color: $theme.colors.contentSecondary,
                  ':hover': { backgroundColor: $theme.colors.backgroundSecondary, color: $theme.colors.contentPrimary },
                }),
              },
            }}
          />
          {!voiceBusy && (
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              data-testid={`${testId}-send`}
              aria-label={sendLabel}
              disabled={!canSend}
              onClick={() => { if (canSend) onSend(); }}
              overrides={{ BaseButton: { style: { width: '44px', height: '44px', minWidth: '44px', flexShrink: 0, borderTopLeftRadius: theme.borders.radius500, borderTopRightRadius: theme.borders.radius500, borderBottomLeftRadius: theme.borders.radius500, borderBottomRightRadius: theme.borders.radius500, paddingLeft: 0, paddingRight: 0 } } }}
            >
              <ArrowUp size={STEP.large} title="" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <span data-testid={`${testId}-help`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          {helpText}
        </span>
        {line && (
          <span
            data-testid={`${testId}-state`}
            role="status"
            style={{ ...theme.typography.LabelXSmall, color: line.tone === 'loud' ? theme.colors.negative : theme.colors.contentSecondary }}
          >
            {line.text}
          </span>
        )}
      </div>
    </div>
  );
}

/** the small mark the surfaces use to say «this is the agent» — one drawing, one meaning */
export function AgentMark({ size = STEP.medium }: { size?: number }) {
  return <Glyph id="ask" size={size} />;
}
