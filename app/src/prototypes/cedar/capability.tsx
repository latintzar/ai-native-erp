/* THE CAPABILITY QUESTIONNAIRE — «Answer a few questions and Rocoto sets itself up».
 *
 * ═══ WHAT IT IS, AND WHAT IT IS NOT (THE-APP-V2 §1.2 vs THE-INTELLIGENCE §11) ═══════════════
 * The ONBOARDING questionnaire is dead and stays dead: nothing gates the app, first run lands in
 * Sales, and behaviour hangs off the product and off rules a person sets where they feel the need.
 * This is the other thing §11 asks for, and it is a different object in three ways that matter:
 *
 *   1 · IT IS REACHED FROM SETTINGS, never on the way in. The app works untouched without it.
 *   2 · IT BLOCKS NOTHING. Every question can be skipped, the card closes on any screen, and what
 *       is already answered stands. Leaving halfway is a legitimate way to use it.
 *   3 · EVERY ANSWER BECOMES A ROW. There is no «submit»: a chip writes to the grants store on the
 *       press, and Settings is already showing that answer as an editable sentence.
 *
 * ═══ ONE QUESTION COMPONENT, TWO DOORS ═════════════════════════════════════════════════════
 * `GrantQuestion` is the whole of a question, and it is what BOTH surfaces mount: the flow puts it
 * on a card one at a time, and Settings re-houses the identical component when a row is opened. So
 * «how big can one order be» has one implementation in the product, and re-answering it in Settings
 * goes through exactly the code path that answered it the first time.
 *
 * ═══ THE PACING ════════════════════════════════════════════════════════════════════════════
 * One question fills the card. The progress is a hairline strip, quiet enough to read only when you
 * look for it. The chips are Base's own pill Button in Base's own selected/unselected pair, so a
 * thumb on a phone has a 48px target and nothing here is invented. Under them, the chosen chip's
 * own line says what that answer means — one sentence, never a paragraph per option.
 *
 * THE GROUND IS PLAIN PAPER. The dots mean a conversation now (FEED-IA §11) and this is a person
 * setting their own house up, so nothing on these surfaces is dotted.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import {
  CAPABILITY_QUESTIONS, firstUnanswered, grantsNow, liveQuestions, setGrants, useGrants,
  type CapabilityQuestion, type Grants,
} from './grants';

/* ── THE MARK ─────────────────────────────────────────────────────────────────────────────────
 * The mark says exactly one thing: THIS is a thing Rocoto does by itself. A row where the work
 * comes to the person carries no mark, and the section reads at a glance as the division of
 * labour it is.
 *
 * ⚠ AND IT IS INK (FEED-IA §127.3 · THE-CHECKPOINT-AUDIT finding 1). It was a saffron ring — the
 * same 10px ring `NoticedMark` drew, and the same red the one claim is made in. Rocoto acting by
 * itself is the most ordinary event in this product; the claim red is reserved for is «a human
 * being is waiting on you». The division of labour is still legible with the colour gone, which
 * is the test that colour was never doing the work here.
 */

export function RocotoMark({
  label = 'Rocoto’s own act',
  inline = false,
}: {
  label?: string;
  /** IT RIDES A SENTENCE THAT CAN WRAP. Centred in a flex row, the ring drifts to the middle of a
   *  two-line paragraph and reads as a bullet for the wrong line — so where the mark sits inside
   *  running text it goes in the text flow instead, on the first line, where it is read. */
  inline?: boolean;
}) {
  const [, theme] = useStyletron();
  return (
    <svg
      data-testid="rocoto-mark"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke={theme.colors.contentTertiary}
      strokeWidth="1.4"
      role="img"
      aria-label={label}
      style={
        inline
          ? { display: 'inline-block', verticalAlign: 'middle', marginRight: theme.sizing.scale200 }
          : { flex: '0 0 auto' }
      }
    >
      <circle cx="5" cy="5" r="3.2" />
    </svg>
  );
}

/* ── ONE QUESTION ─────────────────────────────────────────────────────────────────────────── */

export function GrantQuestion({ q, big = false }: { q: CapabilityQuestion; big?: boolean }) {
  const [, theme] = useStyletron();
  const g = useGrants();
  const selected = q.selected(g);
  const chosen = q.choices.filter((c) => selected.includes(c.value));
  const line = q.summary ? q.summary(g) : chosen.map((c) => c.hint).join(' · ');

  return (
    <div
      data-question={q.id}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
    >
      <div>
        <h2 style={{ margin: 0, ...(big ? theme.typography.HeadingSmall : theme.typography.HeadingXSmall) }}>
          {q.prompt}
        </h2>
        <p
          style={{
            margin: `${theme.sizing.scale300} 0 0`,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          {q.aside}
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300, minWidth: 0 }}>
        {q.choices.map((c) => {
          const on = selected.includes(c.value);
          return (
            <span key={c.value} data-chip={c.value} data-selected={on ? 'yes' : 'no'}>
              <Button
                kind={on ? KIND.primary : KIND.secondary}
                shape={SHAPE.pill}
                size={SIZE.compact}
                data-testid={`grant-${q.id}-${c.value}`}
                onClick={() => setGrants(q.choose(g, c.value), q.id)}
              >
                {c.label}
              </Button>
            </span>
          );
        })}
      </div>

      {line && (
        <p
          data-testid={`grant-hint-${q.id}`}
          style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}
        >
          {line}
        </p>
      )}
    </div>
  );
}

/* ── THE PROGRESS ─────────────────────────────────────────────────────────────────────────────
 * A hairline per question, and the count in words beside it. It says where you are without
 * becoming the subject of the screen.
 */

function Progress({ step, total }: { step: number; total: number }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}>
      <div style={{ display: 'flex', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              height: 2,
              flex: 1,
              borderRadius: theme.borders.radius100,
              background: i <= step ? theme.colors.contentPrimary : theme.colors.mono300,
            }}
          />
        ))}
      </div>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
        {step + 1} of {total}
      </span>
    </div>
  );
}

/* ── WHAT THE ANSWERS COME TO ─────────────────────────────────────────────────────────────────
 * The last screen, and the same sentences Settings keeps as rows. It is a reading of the store, so
 * it cannot describe a set of answers the settings screen would describe differently.
 */

function Standing({ g }: { g: Grants }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      {liveQuestions(g).map((q) => (
        <div
          key={q.id}
          data-standing={q.id}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: theme.sizing.scale300,
            paddingTop: theme.sizing.scale300,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            minWidth: 0,
          }}
        >
          <span style={{ ...theme.typography.LabelSmall, flex: '0 0 auto' }}>{q.row.label}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              ...theme.typography.ParagraphSmall,
              color: theme.colors.contentSecondary,
              flex: 1,
              minWidth: 0,
              justifyContent: 'flex-end',
              textAlign: 'right',
            }}
          >
            {q.rocoto(g) && <RocotoMark />}
            {q.value(g)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── THE FLOW ─────────────────────────────────────────────────────────────────────────────── */

export default function CapabilityQuestionnaire({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const g = useGrants();
  const live = liveQuestions(g);
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState(false);

  /* IT RESUMES WHERE THEY LEFT IT. Somebody who answered two and closed the card comes back to the
     third rather than to the first — the questions they have already given are rows now. */
  React.useEffect(() => {
    if (!isOpen) return;
    setStep(firstUnanswered(grantsNow()));
    setDone(false);
  }, [isOpen]);

  /* ANSWERING CAN SHORTEN THE LIST. «Every order comes to you» takes the two size questions off the
     table, so the walk clamps rather than running off the end of it. */
  const at = Math.min(step, Math.max(live.length - 1, 0));
  const q = live[at];
  const last = at === live.length - 1;

  const advance = () => {
    if (last) {
      setDone(true);
      return;
    }
    setStep(at + 1);
  };

  return (
    <OverlayCard
      isOpen={isOpen}
      onClose={onClose}
      scrim={SCRIM.dim}
      size={560}
      ariaLabel="Workspace setup"
      data-testid="capability-questionnaire"
    >
      <div
        data-testid="questionnaire"
        data-step={done ? 'done' : q?.id}
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}
      >
        {done || !q ? (
          <>
            <div>
              <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Workspace setup</h2>
              <p
                style={{
                  margin: `${theme.sizing.scale300} 0 0`,
                  ...theme.typography.ParagraphSmall,
                  color: theme.colors.contentSecondary,
                }}
              >
                This is what it does on its own from here. Every line is a row in Settings, and you can
                change any of them whenever you want.
              </p>
            </div>
            <Standing g={g} />
            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={onClose} data-testid="questionnaire-done">
                Back to your setup
              </Button>
            </div>
          </>
        ) : (
          <>
            <Progress step={at} total={live.length} />
            <GrantQuestion q={q} big />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.sizing.scale400,
                flexWrap: 'wrap',
                minWidth: 0,
              }}
            >
              <Button kind={KIND.primary} size={SIZE.compact} onClick={advance} data-testid="questionnaire-next">
                {/* THE WORD IS «Continue» (FEED-IA §108.1). One word for «this step is done,
                    take me on» across every flow — «Next» names a POSITION IN A LIST and
                    «Continue» names what the person is doing, which is these steps' own register.
                    The last one still says what it finishes. */}
                {last ? 'Finish' : 'Continue'}
              </Button>
              {/* SKIPPABLE AT ANY POINT, and it says so in the open rather than hiding behind the
                  scrim: the answer that is there stays, and the walk moves on. */}
              <Button
                kind={KIND.tertiary}
                size={SIZE.compact}
                onClick={advance}
                data-testid="questionnaire-skip"
              >
                Skip this one
              </Button>
              <span style={{ flex: 1, minWidth: 0 }} />
              {at > 0 && (
                <Button
                  kind={KIND.tertiary}
                  size={SIZE.compact}
                  onClick={() => setStep(at - 1)}
                  data-testid="questionnaire-back"
                >
                  Back
                </Button>
              )}
              <Button
                kind={KIND.tertiary}
                size={SIZE.compact}
                onClick={onClose}
                data-testid="questionnaire-close"
              >
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </OverlayCard>
  );
}

/** How many questions the door in Settings offers. Read from the list, so the card cannot promise
 *  a number the walk does not deliver. */
export const QUESTION_COUNT = CAPABILITY_QUESTIONS.length;
