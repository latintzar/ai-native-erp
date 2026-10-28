/* THE AREA PAGE — one anatomy, so seven surfaces written by four packages read as one app.
 *
 * One line under the header saying what the surface is for, the controls that belong to the whole
 * surface beside it, and then the surface. Areas never draw their own title block; they pass it,
 * exactly as a scenario passes its meta and never draws its card.
 *
 * ═══ THE BIG NAME LEFT THIS FILE (FEED-IA §35.2) ════════════════════════════════════════════
 * «THE ACTIVE AREA'S NAME MOVES TO THE HEADER, centred above the content — never inside the
 * content area.» It was an `h1` right here, and it cost every surface the first eighty pixels of
 * its own column to say a word that had not changed since the person opened the app — and it
 * scrolled away the moment they started working, which is the one time knowing where you are is
 * worth anything. The frame draws it now, centred over this column and standing still.
 *
 * `title` STAYS, AND IT HAS A JOB. It is the section's accessible name: the heading is chrome, so
 * the landmark under it has to say what it is, and the word is the same word — passed by the area,
 * drawn by the frame, spoken here — which is why there is still exactly one of it in the app.
 *
 * ═══ AND IT SETS THE RHYTHM BETWEEN SECTIONS (FEED-IA §33 — the air pass) ═══════════════════
 * «Think about what people expect in terms of space, breathing space.» Every area's top-level
 * children are separated HERE, in one place, so Sales, Stock, Chats and Settings breathe at one
 * tempo rather than at four. It was 20px, which is a paragraph gap: a stratum's last card sat
 * almost against the next stratum's heading and the page read as one long list of boxes. A full
 * step of air is what makes a heading read as the start of something.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';

export default function Page({
  title,
  lead,
  actions,
  fill = false,
  children,
}: {
  /** the surface's own word for itself. The FRAME draws it, centred in the header (§35.2); here it
   *  names the landmark, so nothing on screen says it twice. */
  title: React.ReactNode;
  /* §36: the explainer-subtitle class is DEAD («AI slop UX components») — a heading names the
     thing and the surface shows what it is; the prop survives only so call sites need no sweep. */
  lead?: React.ReactNode;
  /** controls that belong to the whole surface, on the lead's own row */
  actions?: React.ReactNode;
  /** THE SURFACE IS PANES AND TAKES THE WHOLE BOX (FEED-IA §38). A landmark that wrapped its panes
   *  in an auto-height column would put them back in a box; asked to fill, it becomes the box. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <section
      aria-label={typeof title === 'string' ? title : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: fill ? 0 : theme.sizing.scale900,
        minWidth: 0,
        ...(fill ? { flex: '1 1 auto', minHeight: 0 } : null),
      }}
    >
      {(lead || actions) && (
        <header style={{ display: 'flex', alignItems: 'flex-end', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
