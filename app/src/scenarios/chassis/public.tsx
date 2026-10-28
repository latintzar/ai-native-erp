/* THE PUBLIC CHASSIS — NO CHROME, AND THAT IS THE SUBJECT.
 *
 * BUILD-PLAN §5.3. This is the customer's own browser: a stranger's, with no account, no rail, no
 * day's list, nothing of Rocoto's around the document. H3 says it plainly — this is the only
 * Rocoto screen a restaurant ever opens, so what stands around the document is the product's
 * public face, and the answer is: nothing does.
 *
 * The chassis therefore draws a ground and a slot. The one piece of furniture is the browser's
 * own address bar, ghosted, because the customer arrived here by opening a link and the card
 * should not pretend otherwise. It points at H3, the card that decides what a stranger sees.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { GRegion } from '../ghosts/regions';

export type PublicChassisProps = {
  /** the document, and nothing else */
  children: React.ReactNode;
  /** the browser's own bar. Off for a card that is deciding the page inside a phone. */
  addressBar?: boolean;
  /** what stands IN that bar. Additive: left off, the bar is the ghosted pointer it has always
   *  been. The app passes the real link, because inside the app the link is a thing that exists —
   *  a pointer at a card would be a pointer at a catalogue the app has no page for. */
  bar?: React.ReactNode;
  /** who decides the page this frame holds */
  decidedIn?: string;
  height?: number;
};

export default function PublicChassis({
  children,
  addressBar = true,
  bar,
  decidedIn = 'H3',
  height = 660,
}: PublicChassisProps) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        height,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.backgroundSecondary,
      }}
    >
      {addressBar && (
        <div style={{ padding: theme.sizing.scale400, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
          {bar ?? (
            <GRegion to={decidedIn} shape="pill" height={theme.sizing.scale800} label="the link they opened" />
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: theme.sizing.scale800,
        }}
      >
        <div style={{ width: '100%', maxWidth: 720 }}>{children}</div>
      </div>
    </div>
  );
}
