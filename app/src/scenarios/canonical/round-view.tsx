/* THE ROUND VIEW — the distributor's desk while the van is out.
 *
 * P6 owns this file, and **I5** is its only card. It is one screen because it decides one thing,
 * and the thing it decides is a RULE OF EMPHASIS rather than a control:
 *
 *   ONLY LATENESS IS VISUALLY DISTINCT. Everything on time reads the same.
 *
 * A round view that marks every state — out, arriving, delivered, signed — is a screen the person
 * has to read all morning. A round view that marks one thing is a screen they glance at. So a
 * delivered stop and a stop still comfortably out are drawn identically, and a stop still out past
 * the hour gains weight, a rule, and its own words.
 *
 * THE HOUR IS CONFIGURATION, and the sector moves it: a fish round finishes before a fruit round
 * starts. The card's one control moves the hour and the rows change in front of you, which is a
 * disclosure of the rule rather than a new act (§3.4).
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import Name from '../shell/Name';
import type { Stop } from './drop-list';

export type RoundStop = Stop & {
  /** the time it was swept, where it has been */
  delivered?: string;
};

export type RoundViewProps = {
  stops: RoundStop[];
  /** the hour after which a stop still out becomes distinct */
  hour: string;
  /** the clock the round is being read at */
  now: string;
  /** the control that moves the hour */
  control?: React.ReactNode;
  /** what stands beside the round */
  aside?: React.ReactNode;
};

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return h * 60 + m;
};

/** The one rule this card decides, written once so the drawing cannot disagree with the words. */
export const isLate = (stop: RoundStop, hour: string, now: string): boolean =>
  !stop.delivered && minutes(now) > minutes(hour);

export default function RoundView({ stops, hour, now, control, aside }: RoundViewProps) {
  const [, theme] = useStyletron();
  const out = stops.filter((s) => !s.delivered);
  const late = stops.filter((s) => isLate(s, hour, now));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
        <div>
          <div style={theme.typography.HeadingSmall}>The round</div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {now} · {out.length} of {stops.length} still out
          </div>
        </div>
        {control}
      </header>

      <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
        {stops.map((stop, i) => {
          const distinct = isLate(stop, hour, now);
          return (
            <div
              key={stop.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 88px minmax(0, 200px)',
                gap: theme.sizing.scale500,
                alignItems: 'baseline',
                padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                /* THE ONLY DIFFERENCE ON THE SCREEN. A rule at the head of the row and the row's
                   own weight — ink, never a hue, because this product has no traffic light. */
                boxShadow: distinct ? `inset 3px 0 0 0 ${theme.colors.contentPrimary}` : 'none',
                background: distinct ? theme.colors.backgroundSecondary : 'transparent',
              }}
            >
              <span style={distinct ? theme.typography.LabelMedium : theme.typography.ParagraphMedium}>
                <Name of={stop.customer} />
              </span>
              <span
                style={{
                  ...theme.typography.ParagraphSmall,
                  color: theme.colors.contentSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stop.slot}
              </span>
              <span
                style={{
                  ...(distinct ? theme.typography.LabelSmall : theme.typography.ParagraphSmall),
                  color: distinct ? theme.colors.contentPrimary : theme.colors.contentSecondary,
                }}
              >
                {stop.delivered ? `delivered ${stop.delivered}` : distinct ? `out since ${stop.slot}` : 'on the van'}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
        {late.length === 0
          ? `Every stop is inside ${hour}.`
          : `${late.length} ${late.length === 1 ? 'stop is' : 'stops are'} past ${hour}.`}
      </div>

      {aside}
    </div>
  );
}
