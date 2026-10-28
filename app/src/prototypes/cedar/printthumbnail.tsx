/* THE REAL PAPER, SMALL — FEED-IA §175 · E193.20.
 *
 * Peter, on the export centre: «the print previews aren't correct, they're all the same right
 * now». They were: «Delivery notes» and «Packing sheets» both drew `OutputPreviewTile`'s generic
 * print block — the same seven grey rules in the same seven places — so the one thing the two
 * cards were there to tell apart was the one thing they did not.
 *
 * SO THE THUMBNAIL IS THE DOCUMENT. It renders `print-view.tsx`'s own papers — the albarán, the
 * packing list, the day's sheet — through the same run builders the press calls (`albaranRun`,
 * `packingRun`, `daySheetOrder`), at `chrome="print"`, which is the paper with no preview stage
 * around it. Nothing here draws a rule, a column or a masthead of its own; a mock would be a
 * picture that could quietly stop being true, which is the failure §175 named. («never redraw —
 * lift the real thing».)
 *
 * THE FORMAT IS HONEST (§37.7's law, one level down). One scale serves both formats — it is read
 * off A4 — so an A5 sheet occupies 70% of the width AND 70% of the height of the A4 footprint and
 * reads as the smaller object it is. A preview that filled the same box either way would be a
 * preview of the format, quietly hiding the format.
 *
 * IT IS A PICTURE, NOT A DOOR. The paper is `inert` and `aria-hidden`; the frame carries one
 * `role="img"` with a label naming the document it is showing, and the card's own eye is the only
 * way to the full preview. The QR the packing sheet carries is `print-view.tsx`'s (E193.05, W9's
 * territory) and is drawn, never redrawn: the packing miniature is handed the FIRST packing
 * document's own sales, so the locator it issues is the locator that document prints.
 */
import * as React from 'react';
import { BaseProvider, LightTheme, useStyletron } from 'baseui';
import { SHEET, type Format as PaperFormat } from '../../rocoto/paper';
import { useConfig } from './config';
import { nowOf } from './day';
import PrintView from './print-view';
import { albaranRun, daySheetOrder, packingRun, usePrintSetup, type PrintSubject } from './print-queue';
import type { Sale } from './sale';

const noop = () => undefined;

/** The three papers this house prints, in the words the export centre already uses for them. */
export type PaperKind = 'albaranes' | 'packing' | 'sheet';

const PAPER_WORDS: Record<PaperKind, string> = {
  albaranes: 'Delivery note',
  packing: 'Packing list',
  sheet: 'Day sheet',
};

/** A day sheet lists the whole morning, and the whole morning is not what a 180px picture shows.
 *  The sample is the orders whose lines reach the foot of page one — enough to draw a full first
 *  page and nothing beyond it. The albarán and the packing list take no sample at all: each is
 *  ONE document, and the packing one must be the real one because its mark is issued. */
const DAY_SHEET_PAGE_LINES = 24;

function sampleForDaySheet(sales: Sale[]): Sale[] {
  const taken: Sale[] = [];
  let lines = 0;
  for (const sale of sales) {
    if (lines >= DAY_SHEET_PAGE_LINES) break;
    taken.push(sale);
    lines += sale.lines.length;
  }
  return taken;
}

/** THE PAPER'S OWN FOOTPRINT at the height the tile gives it, and the scale that fills it. */
export function paperBox(kind: PaperKind, format: PaperFormat, height: number) {
  const scale = height / SHEET.a4.height;
  return {
    kind,
    scale,
    width: Math.round(SHEET[format].width * scale),
    height: Math.round(SHEET[format].height * scale),
  };
}

export function PaperMiniature({ kind, day, sales, height, paper }: {
  kind: PaperKind;
  day: string;
  sales: Sale[];
  /** the room the tile gives the A4 footprint; A5 takes its own smaller share of it */
  height: number;
  /* THE PICTURE IS OF A TEMPLATE'S OWN SHEET (THE-OUTPUTS-SPEC OUT-01.3). Paper belongs to the
     template now, so a card hands its template's paper in. Where a caller stands next to no
     template — the seed gallery — the house's default is the honest answer and stays. */
  paper?: 'A4' | 'A5';
}) {
  const [, theme] = useStyletron();
  const { config, derived } = useConfig();
  const cast = derived.cast;
  const setup = usePrintSetup();
  const now = nowOf(cast);
  const content = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    // Paper may contain links. The card's own eye is the only interactive door onto a document.
    if (content.current) content.current.inert = true;
  }, []);

  const format: PaperFormat = (paper ?? setup.paper) === 'A5' ? 'a5' : 'a4';
  const box = paperBox(kind, format, height);

  /* THE SUBJECT COMES FROM THE RUN, never from a hand-built object: whatever the press would put
     on the first sheet of this run is what the picture shows. */
  const { subject, scoped, names } = React.useMemo(() => {
    if (kind === 'albaranes') {
      const found = albaranRun(sales, now, config.emailFeed).map((order) => order.subject).find((item) => item.kind === 'albaran');
      const sale = found?.kind === 'albaran' ? sales.find((item) => item.id === found.sale) : undefined;
      return { subject: found, scoped: sales, names: sale ? `${sale.customer.name} · ${sale.number}` : '' };
    }
    if (kind === 'packing') {
      const found = packingRun(day, sales, now, undefined, cast.sector).map((order) => order.subject).find((item) => item.kind === 'packing');
      const ids = found?.kind === 'packing' ? found.salesIds ?? [] : [];
      return { subject: found, scoped: sales, names: `${ids.length} ${ids.length === 1 ? 'order' : 'orders'}` };
    }
    const own = sampleForDaySheet(sales.filter((sale) => sale.day === day));
    const order = own.length ? daySheetOrder(day, own, now) : undefined;
    return { subject: order?.subject, scoped: own, names: `${own.length} ${own.length === 1 ? 'order' : 'orders'}` };
  }, [kind, sales, day, now, config.emailFeed, cast.sector]);

  /* PAPER IS WHITE UNDER EVERY BRAND. A re-brand changes the ink on the page, never the page —
     so the sheet is drawn in Base's own light ground while the app around it keeps its theme. */
  const paperTheme = React.useMemo(() => ({ ...theme, colors: {
    ...theme.colors,
    backgroundPrimary: LightTheme.colors.backgroundPrimary,
    backgroundSecondary: LightTheme.colors.backgroundSecondary,
    contentPrimary: LightTheme.colors.contentPrimary,
    contentSecondary: LightTheme.colors.contentSecondary,
    contentTertiary: LightTheme.colors.contentTertiary,
    borderOpaque: LightTheme.colors.borderOpaque,
  } }), [theme]);

  return <div
    data-testid={`export-paper-${kind}`}
    data-paper-kind={kind}
    data-paper-format={format}
    data-paper-drawn={subject ? 'document' : 'blank'}
    role="img"
    aria-label={`${PAPER_WORDS[kind]} · ${format.toUpperCase()}${names ? ` · ${names}` : ''}`}
    style={{
      boxSizing: 'border-box', width: box.width, height: box.height, flexShrink: 0, alignSelf: 'center', justifySelf: 'center',
      overflow: 'hidden', backgroundColor: LightTheme.colors.backgroundPrimary,
      border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius100,
      boxShadow: theme.lighting.shadow400,
    }}
  >
    <div ref={content} aria-hidden="true" style={{
      width: SHEET[format].width, transform: `scale(${box.scale})`, transformOrigin: 'top left',
      pointerEvents: 'none', userSelect: 'none',
    }}>
      {subject && <BaseProvider theme={paperTheme}>
        <PrintView
          cast={cast} derived={derived} subject={subject as PrintSubject} sales={scoped}
          chrome="print" paper={format} onClose={noop}
        />
      </BaseProvider>}
    </div>
  </div>;
}
