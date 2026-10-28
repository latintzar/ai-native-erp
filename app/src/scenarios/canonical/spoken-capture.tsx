/* THE SPOKEN CAPTURE — `U02` + `U03`, and the canonical screen behind B1 · D1s · D2s.
 *
 * THE HARDEST ENVIRONMENT IN THE PRODUCT: the lonja at 05:00, cold, wet, gloved, one hand, and
 * the number is gone in minutes. Draw the capture for that and it serves every other place a
 * quantity is spoken. Everything on the screen follows from it:
 *
 *   · THE GESTURE IS A HOLD, and it is the app's own gesture machine, unmodified — 90px left to
 *     cancel, 70px up for hands-free, a slip under a second dropped. Nothing is retuned here.
 *   · ROWS APPEAR AS WORDS LAND, so the person hears themselves being understood while they are
 *     still talking. A list that appears all at once at the end teaches nobody anything.
 *   · A ROW THAT WAS NOT HEARD STAYS EMPTY, WITH ITS AUDIO ATTACHED. It is never guessed and it
 *     is never a colour: this product has no traffic light, so «not understood» is drawn as an
 *     empty figure and a playable field, which is what it actually is. The recording is the
 *     evidence, and evidence rides the element it justifies (law 7).
 *   · YESTERDAY IS ONE PRESS (`U03`), and every row carries yesterday struck through beside
 *     today's, because a cost that moved 40 cents overnight is the fact the morning is about.
 *
 * THREE CARDS, ONE SCREEN. B1 lands these rows on a COST. D1s lands the same rows, from the same
 * gesture, on STOCK — a `data` delta, and the brief's own example of identical screens holding
 * true. D2s adds the SEND, and the send is what makes the list the stock record — a `control`
 * delta. The `commit` slot below the rows is where all three differ, and it is the only place.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';
import { Waveform } from '../../rocoto/waveform';
import { StatefulVoiceButton, type Phase } from '../../rocoto/voice-button-kit';

/* ── ONE ROW OF A TAKE ────────────────────────────────────────────────────────────────────── */

export type CaptureRow = {
  id: string;
  /** the product, drawn by the caller through `<Name />` so no name is typed (law 10) */
  name: React.ReactNode;
  /** a quieter second line — the lote, the pack, the vessel */
  detail?: React.ReactNode;
  /** what was heard */
  value: number;
  /** «€/kg», «kg», «cajas» — it shares the number's line, always */
  unit: string;
  /** what the same row held yesterday. Struck through beside today's. */
  was?: number;
  decimals?: number;
  /** THE ROW THAT WAS NOT HEARD. It stands empty with its recording attached. */
  unheard?: boolean;
  /** how long that recording runs, in ms */
  durationMs?: number;
};

export type SpokenCaptureProps = {
  /** who, where, and what hour it is */
  head: React.ReactNode;
  /** WHAT THE TAKE PRODUCES, in the order the words land. The screen reveals them one at a time
   *  while the button is held, so a person hears themselves being understood. */
  script: CaptureRow[];
  /** what the column of figures is — «what we paid», «what we have» */
  valueHead?: React.ReactNode;
  /** yesterday, as a one-press start (`U03`) */
  prefill?: { label: React.ReactNode; onPress?: () => void };
  /** the card's own control under the rows: a destination switch, a send */
  commit?: React.ReactNode;
  /** what stands where the rows will be, before a word has been said */
  empty?: React.ReactNode;
  /** every landing, so the card outside can gate its own control */
  onLanded?: (landed: number, total: number) => void;
  /** changing this starts the capture again — the sector switch passes its own name */
  resetKey?: string;
};

/** How fast a spoken row lands. Measured against reading a list aloud rather than chosen: a
 *  product, a number and a unit is about three quarters of a second of speech. */
const WORD_MS = 750;

export default function SpokenCapture({
  head,
  script,
  valueHead = 'Today',
  prefill,
  commit,
  empty,
  onLanded,
  resetKey,
}: SpokenCaptureProps) {
  const [, theme] = useStyletron();
  const [landed, setLanded] = React.useState(0);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [replaying, setReplaying] = React.useState<string | null>(null);
  const [position, setPosition] = React.useState(0);

  /* the sector switch hands the card a different market. A different market is a different
     morning, so nothing has been said yet. */
  React.useEffect(() => {
    setLanded(0);
    setReplaying(null);
  }, [resetKey]);

  React.useEffect(() => {
    onLanded?.(landed, script.length);
  }, [landed, script.length, onLanded]);

  /* ROWS APPEAR AS WORDS LAND. The reveal runs only while the button is actually held, so it is
     the take that fills the list and never a clock the screen is running on its own. */
  React.useEffect(() => {
    if (phase === 'idle') return undefined;
    const t = window.setInterval(
      () => setLanded((n) => Math.min(script.length, n + 1)),
      WORD_MS,
    );
    return () => window.clearInterval(t);
  }, [phase, script.length]);

  const rows = script.slice(0, landed);
  const done = landed >= script.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <header style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>{head}</div>
        {prefill && landed === 0 && (
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            onClick={() => {
              prefill.onPress?.();
              setLanded(script.length);
            }}
          >
            {prefill.label}
          </Button>
        )}
      </header>

      {/* ── the rows ── */}
      {rows.length === 0 ? (
        <div
          style={{
            padding: theme.sizing.scale700,
            borderRadius: theme.borders.radius300,
            border: `1px dashed ${theme.colors.borderOpaque}`,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          {empty}
        </div>
      ) : (
        <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: theme.sizing.scale400,
              padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
              background: theme.colors.backgroundSecondary,
              borderBottom: `1px solid ${theme.colors.borderOpaque}`,
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            <span>{rows.length} of {script.length}</span>
            <span style={{ textAlign: 'right' }}>{valueHead}</span>
          </div>

          {rows.map((r, i) => {
            const open = replaying === r.id;
            const move =
              r.was !== undefined && r.was !== 0
                ? Math.round(((r.value - r.was) / r.was) * 1000) / 10
                : undefined;
            return (
              <div
                key={r.id}
                style={{
                  borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                  padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: theme.sizing.scale400,
                    alignItems: 'baseline',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={theme.typography.LabelMedium}>{r.name}</div>
                    {r.detail && (
                      <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                        {r.detail}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.unheard ? (
                      /* EMPTY, AND SAYING SO WITH ITS OWN VOICE. Never guessed, never a colour. */
                      <Button
                        kind={KIND.secondary}
                        size={SIZE.mini}
                        onClick={() => { setReplaying(open ? null : r.id); setPosition(0); }}
                      >
                        {open ? 'Close' : 'Play it back'}
                      </Button>
                    ) : (
                      <>
                        <Figure
                          value={r.value}
                          was={r.was}
                          unit={r.unit}
                          decimals={r.decimals ?? 2}
                          size="compact"
                        />
                        {move !== undefined && move !== 0 && (
                          <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                            {move > 0 ? '+' : '−'}
                            {Math.abs(move).toLocaleString('es-ES', { maximumFractionDigits: 1 })}% on yesterday
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* THE RECORDING, ATTACHED TO THE ROW IT BELONGS TO */}
                {r.unheard && (
                  <div style={{ marginTop: theme.sizing.scale300 }}>
                    {open ? (
                      <Waveform
                        mode="scrubbing"
                        seed={r.id}
                        positionMs={position}
                        durationMs={r.durationMs ?? 2600}
                        onSeek={setPosition}
                        size="compact"
                        label="what was said on this row"
                      />
                    ) : (
                      <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                        the words are kept
                      </Tag>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── THE GESTURE. The app's own machine, unmodified. ── */}
      <StatefulVoiceButton
        simulate
        seed={resetKey}
        size="default"
        disabled={done}
        onPhaseChange={setPhase}
        onRecord={() => setLanded(script.length)}
        onCancel={() => setLanded(0)}
      />

      {/* ── what this card does with the rows ── */}
      {commit}
    </div>
  );
}

/* ── THE ABSENCE ──────────────────────────────────────────────────────────────────────────────
 * A sector whose configuration switches this capture off does not get a disabled capture. Brief
 * §6 is the law and group K is its card: the destination LEAVES. So a card that declares `≠` in
 * one sector renders this instead of a screen it would have to break to draw — the account's
 * own reason, and the doors that do the work in its place.
 */
export function CaptureAbsent({
  because,
  instead,
}: {
  /** why this account does not stand at a market with a phone */
  because: React.ReactNode;
  /** what does the work in its place — the cards, as chips */
  instead: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale700,
        borderRadius: theme.borders.radius300,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
      }}
    >
      <p style={{ margin: 0, ...theme.typography.ParagraphMedium }}>{because}</p>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Where the work happens
        </span>
        {instead}
      </div>
    </section>
  );
}
