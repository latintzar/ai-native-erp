/** The header: on a desk the current area and its immediate actions — identity belongs to the rail,
 *  which carries the product's one mark (FEED-IA §253). On a phone, where the rail is away, the
 *  mark and the word lead this bar as the way home. Dates belong to Sales and Prep. */
import { useStyletron } from 'baseui';
import { useConfig } from '../config';
import ExportCentre from './printing';
import SupportWidget from '../support-widget';
import { Button, KIND, SIZE } from 'baseui/button';
import { Sparkles } from 'lucide-react';
import { openAssistant } from '../assistant';

import { OnboardingCard } from '../setup-progress';
import { railWidth, useRailOpen, RocotoMark } from './rail';
import { DAY_BAR_WORDED, usePhoneFloorHeight, useRoom } from './viewport';

export default function DayBar({ phone, title }: { phone: boolean; title?: string | null }) {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const { cast } = derived;

  const room = useRoom();
  const railOpen = useRailOpen();
  /* THE MARK IS A TOUCH CONTROL, SO ON A PHONE IT STANDS AT THE FLOOR (INTX-12 · §188.2).
     `workspace-brand` is an `<a href="#/sales">` — a door a thumb lands on — and it was drawn
     40px tall on every width, which `drives/drive-202-phone-targets.py` measured at 117×40 on
     thirteen routes at 393, 390 and 360. `usePhoneFloorHeight` is the house's own way to say it:
     44px on a phone, nothing on a desk. NO GEOMETRY MOVES. The phone bar's content row already
     stands at 44 (its actions carry the same floor), so the bar keeps its 65px; a desk row stays
     at 40 beside its 40px acts, and the bar keeps its 65px there too. */
  const floor = usePhoneFloorHeight();
  const bar = room - (phone ? 0 : railWidth(railOpen));
  const wordy = !phone && bar >= DAY_BAR_WORDED;
  /* `DAY_BAR_NAMED` measured the room the mark, the name and the way out needed together; the
     mark now stands in the rail (FEED-IA §253) and the name leads at every desk width. */

  return (
    <div
      data-testid="day-bar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        flexWrap: 'nowrap',
        padding: phone
          ? `${theme.sizing.scale400} ${theme.sizing.scale500}`
          : `${theme.sizing.scale500} ${theme.sizing.scale800}`,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
      }}
    >

      {/* ── ONE MARK IN THE WINDOW (FEED-IA §253) ──────────────────────────────────────────────
          Peter, 14 September: «there's two loco things in the app btw!! int he sidebar and outside.
          should only be in sidebar.» On a desk the rail carries the product's face at its head, so
          this bar carried it a second time, 28px away from the first. The rail owns identity; this
          bar owns WHERE YOU ARE and WHAT YOU CAN DO. So on a desk the area's own name leads the
          line, and on a phone — where the rail is away and this bar is the only chrome — the mark
          and the word stand as the way home they have always been. */}
      {phone && (
        <a href="#/sales" data-testid="workspace-brand" aria-label="Rocoto — Sales" style={{
          display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flex: '1 1 0',
          minWidth: 'max-content', color: theme.colors.contentPrimary, textDecoration: 'none',
          minHeight: '40px', ...floor, ...theme.typography.LabelLarge,
        }}>
          <RocotoMark size={28} testId="header-logo" /><span>Rocoto</span>
        </a>
      )}

      {/* THE NAME LEADS THE LINE AT EVERY DESK WIDTH. `DAY_BAR_NAMED` bought room for the mark, the
          name and the way out together; with the mark in the rail the name costs a fraction of
          that, so the bar states where a person is from its narrowest desk posture up. */}
      {!phone && title && (
        <h1
          data-testid="area-title"
          data-area-title={title}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            margin: 0,
            textAlign: 'left',
            ...theme.typography.LabelLarge,
            color: theme.colors.contentPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
      )}
      {!phone && !title && <span style={{ flex: '1 1 0' }} />}

      {phone && <OnboardingCard cast={cast} open={false} />}

      <div
        data-testid="day-bar-actions"
        style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: theme.sizing.scale500 }}
      >
        <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="assistant-launcher" aria-label="Copilot" title="Copilot" onClick={() => openAssistant({ kind: 'general', context: { source: 'navigation' } })} overrides={{ BaseButton: { style: { minWidth: '40px', height: '40px', flexShrink: 0, gap: theme.sizing.scale200 } } }}>

          <Sparkles size={20} aria-hidden />{wordy && <span>Copilot</span>}
        </Button>
        <ExportCentre />
        <SupportWidget />
      </div>
    </div>
  );
}
