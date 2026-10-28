/* CHATS — the tab. PARKED (FEED-IA §42, decided).
 *
 * ═══ WHY IT IS HERE AND NOT ON THE RAIL ════════════════════════════════════════════════════
 * «Chats should only live in the widget… a button to Expand… search and filtering in that widget.»
 * The tab and the widget were two doors onto one store, and the founder closed one of them: the
 * conversation is the widget, on the desk AND on the phone, and this surface is what it replaced.
 *
 * It is PARKED rather than deleted, which in this app means three things: it is out of the glob's
 * reach (`areas/*.tsx` cannot cross a slash), nothing imports it, and it still TYPE-CHECKS — so the
 * composition it proved stays readable and stays honest about the components it stands on. Bringing
 * it back is moving the file; nothing here is a fork of the widget's code.
 *
 * ═══ WHAT THIS SURFACE WAS ═════════════════════════════════════════════════════════════════
 * Every conversation the day is carrying, newest turn first, with the thread open beside it. It
 * is the same store the desk's right-hand column reads and the same store an albarán's embedded
 * message reads — «so they can see the comms and see all the shit they're managing» — so opening
 * a thread here marks it read everywhere, and a reply sent here is in the sale's own thread.
 *
 * TWO HOUSINGS, ONE COMPOSITION. On the desk this page is the inbox: the list on the left, the
 * thread on the right, and the frame stands the sidebar down while you are here rather than
 * drawing the same list twice. On the phone the list is the screen and the thread takes it over,
 * which is the housing every phone messaging app has settled on for the same reason — a composer
 * whose gesture machine needs 90px of travel needs the width.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { useConfig } from '../../config';
import Page from '../../shell/page';
import type { AreaMeta } from '../../shell/area';
import { usePhone } from '../../shell/viewport';
import { BOTTOM_NAV_HEIGHT } from '../../shell/bottom-nav';
import { ThreadList, ThreadView } from '../../shell/chats';
import { useThreads, useThreadFocus } from '../../shell/threads';

export const meta: AreaMeta = {
  id: 'chats',
  title: 'Chats',
  owner: 'V2-CORE',
};

export default function Chats() {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const { derived } = useConfig();
  const cast = derived.cast;

  const threads = useThreads(cast);
  const focus = useThreadFocus(cast, threads);
  const thread = threads.find((t) => t.id === focus.id) ?? null;

  /* ONE DESIGN, TWO HOUSINGS (FEED-IA §40.7). Every spacing decision the widget made — the header
     that carries the count and the seat, the rows at their three steps, the bubbles' padding, the
     whispers between groups, the composer's pill — is inside `ThreadList` and `ThreadView`, so the
     tab inherits all of it by rendering the same two components. What this file owns is the FRAME
     around them, and it takes the widget's own corner so the two read as the same object. */
  const list = (pane: boolean) => (
    <div
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius500,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
        /* ON THE DESK IT IS A PANE, NOT A CARD THAT RUNS OFF THE PAGE (FEED-IA §38, §39). The
           conversations are the list pane and the thread is the sheet pane, so they stand the same
           height and each scrolls inside itself — 295 rows running down past a floating 70vh box
           is exactly the «box within» the founder is looking at when he says the scrolling is
           horrible. The phone has one screen and one scroll, so there it stays a plain card. */
        ...(pane
          ? { height: '70vh', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'clip' }
          : { overflow: 'hidden' }),
      }}
    >
      <ThreadList
        cast={cast}
        threads={threads}
        currentId={focus.id}
        onOpen={focus.show}
        /* the page's own title already says «Chats», so the list's header spends its label slot
           on the one thing the page has not said: how much of this is still owed */
        meta={focus.unread > 0 ? `${focus.unread} unread` : `${threads.length} open`}
      />
    </div>
  );

  /* THE PHONE: the thread IS the screen. It stands over the list rather than inside it, because
     a conversation in a box with the page showing under it is a conversation with half a screen —
     and the composer's gesture machine needs the width and the height it is given. */
  if (phone) {
    return (
      <Page title="Chats">
        {list(false)}
        {thread && (
          <div
            data-testid="chats-full"
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              top: 0,
              bottom: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              background: theme.colors.backgroundPrimary,
            }}
          >
            <ThreadView cast={cast} thread={thread} threads={threads} onBack={() => focus.show(null)} backLabel="Chats" />
          </div>
        )}
      </Page>
    );
  }

  /* THE DESK: the inbox. The list keeps its place while the thread changes beside it. */
  return (
    <Page title="Chats">
      <div
        style={{
          display: 'grid',
          /* the list column takes the widget's own width, so a row is laid out identically in
             both housings and neither has to re-tune its truncation (§40.7) */
          gridTemplateColumns: thread ? 'minmax(0, 400px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
          gap: theme.sizing.scale700,
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        {list(true)}
        {thread && (
          <div
            data-testid="chats-thread"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '70vh',
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius500,
              background: theme.colors.backgroundPrimary,
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            <ThreadView cast={cast} thread={thread} threads={threads} onBack={() => focus.show(null)} />
          </div>
        )}
      </div>
    </Page>
  );
}
