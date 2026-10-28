/* Stock Announcement — one typed number, two meanings, and the row where the papers and the
 * person disagree in public. Grown from Base's template-component scaffold
 * (see src/rocoto/stock-announcement/); this page demonstrates it like any other component.
 *
 * The demo document is DRAWN from the theme rather than pasted in as a picture, so the sample
 * albarán re-themes with everything else under `?theme=proof`. A baked image would be paint the
 * gate cannot see.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { Theme } from 'baseui';
import { Section, Tile, Grid } from '../chrome';
import { StockAnnouncement, StockLevel, MODE, SOURCE, PHOTO_STATUS } from '../../rocoto/stock-announcement';
import type { Mode, Source, StockPhoto } from '../../rocoto/stock-announcement';

/* ── the demo document ─────────────────────────────────────────────────────────────────────── */

/** A stand-in for a photographed document: ruled lines, a stamped reference, and one quantity
 *  large enough to be the thing a reader would pick out. Every colour is the theme's. */
function documentSrc(theme: Theme): string {
  const paper = theme.colors.backgroundPrimary;
  const ink = theme.colors.contentPrimary;
  const faint = theme.colors.borderOpaque;
  const quiet = theme.colors.contentTertiary;
  const face = theme.typography.LabelMedium.fontFamily;
  const rules = [0, 1, 2, 3, 4]
    .map((i) => `<rect x="26" y="${132 + i * 26}" width="${168 - i * 22}" height="7" rx="3" fill="${quiet}" opacity="0.5"/>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400">` +
    `<rect width="320" height="400" fill="${paper}"/>` +
    `<rect x="10" y="10" width="300" height="380" rx="6" fill="none" stroke="${faint}" stroke-width="2"/>` +
    `<rect x="26" y="34" width="120" height="10" rx="5" fill="${ink}"/>` +
    `<rect x="26" y="54" width="82" height="8" rx="4" fill="${quiet}" opacity="0.6"/>` +
    `<line x1="26" y1="82" x2="294" y2="82" stroke="${faint}" stroke-width="2"/>` +
    `<text x="26" y="118" font-family='${face}' font-size="15" fill="${quiet}">DELIVERY NOTE 4471</text>` +
    rules +
    `<line x1="26" y1="288" x2="294" y2="288" stroke="${faint}" stroke-width="2"/>` +
    `<text x="26" y="330" font-family='${face}' font-size="15" fill="${quiet}">TOTAL</text>` +
    `<text x="294" y="336" text-anchor="end" font-family='${face}' font-size="46" font-weight="700" fill="${ink}">40</text>` +
    `<text x="294" y="364" text-anchor="end" font-family='${face}' font-size="14" fill="${quiet}">units</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function useDemoPhoto(proposed?: number): StockPhoto {
  const [, theme] = useStyletron();
  return React.useMemo(
    () => ({
      src: documentSrc(theme),
      name: 'Delivery note 4471',
      alt: 'A delivery note stating a total of 40 units.',
      proposed,
      at: new Date(),
    }),
    [theme, proposed]
  );
}

/** A tile needs somewhere for the preview to open that is not the whole screen, so the demos hand
 *  the component their own box. That is the component's own `previewContainer` doing its own job —
 *  a reference page cannot compare an open preview with anything if it swallows the page. */
function Stage({ children }: { children: (node: HTMLElement | undefined) => React.ReactNode }) {
  const [node, setNode] = React.useState<HTMLElement | undefined>(undefined);
  return (
    <div ref={(el) => setNode(el ?? undefined)} style={{ position: 'relative', width: '100%' }}>
      {children(node)}
    </div>
  );
}

/** The machine reading the picture: a real await, so the chip really does hold its reading state
 *  and the proposal really does arrive afterwards. */
const readsFortyUnits = () => new Promise<number>((resolve) => setTimeout(() => resolve(40), 900));

/* ── the tiles ─────────────────────────────────────────────────────────────────────────────── */

/** THE FLIP, instrumented. The readout below is not decoration: it is the evidence that the typed
 *  string is one state ABOVE the tabs, so flipping cannot touch it. */
function TheFlip() {
  const [, theme] = useStyletron();
  const [mode, setMode] = React.useState<Mode>(MODE.now);
  const [value, setValue] = React.useState('40');
  const [submitted, setSubmitted] = React.useState('');
  const amount = Number(value.replace(',', '.')) || 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, width: '100%' }}>
      <StockAnnouncement
        onHand={72}
        unit="units"
        aria-label="Announce stock"
        mode={mode}
        onModeChange={({ mode: next }) => setMode(next)}
        value={value}
        source={SOURCE.hand}
        onChange={({ value: next }) => setValue(next)}
        onSubmit={({ mode: m, amount: a, result }) => setSubmitted(`${m} ${a} → ${result}`)}
      />
      <dl
        data-testid="flip-readout"
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: theme.sizing.scale500,
          rowGap: theme.sizing.scale100,
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentSecondary,
        }}
      >
        <dt>Typed</dt>
        <dd data-testid="flip-typed" style={{ margin: 0, color: theme.colors.contentPrimary }}>{value || '—'}</dd>
        <dt>Tab</dt>
        <dd data-testid="flip-mode" style={{ margin: 0, color: theme.colors.contentPrimary }}>{mode}</dd>
        <dt>Submit means</dt>
        <dd data-testid="flip-meaning" style={{ margin: 0, color: theme.colors.contentPrimary }}>
          {mode === MODE.now ? `stock becomes ${amount}` : `stock becomes ${72 + amount}`}
        </dd>
        <dt>Submitted</dt>
        <dd data-testid="last-submit" style={{ margin: 0, color: theme.colors.contentPrimary }}>
          {submitted || 'press the button and it lands here'}
        </dd>
      </dl>
    </div>
  );
}

/** THE DOCUMENT PROPOSES, and a hand overrides it. One instrument, both attributions, and a
 *  button that puts the document's own number back. */
function ProposalAndOverride({ overridden }: { overridden: boolean }) {
  const photo = useDemoPhoto(40);
  const [value, setValue] = React.useState(overridden ? '45' : '40');
  const [source, setSource] = React.useState<Source>(overridden ? SOURCE.hand : SOURCE.document);
  return (
    <Stage>
      {(node) => (
        <StockAnnouncement
          onHand={72}
          unit="units"
          aria-label="Announce stock"
          initialMode={MODE.add}
          value={value}
          source={source}
          onChange={({ value: next, source: nextSource }) => {
            setValue(next);
            setSource(nextSource);
          }}
          photo={photo}
          photoStatus={PHOTO_STATUS.attached}
          previewContainer={node}
        />
      )}
    </Stage>
  );
}

export default function StockAnnouncementSection() {
  const [, theme] = useStyletron();
  const attachedPhoto = useDemoPhoto(40);
  const [openPreview, setOpenPreview] = React.useState(true);
  const feedAt = React.useMemo(() => new Date(Date.now() - 1000 * 60 * 214), []);
  const declaredAt = React.useMemo(() => new Date(), []);

  return (
    <Section
      t="Stock Announcement"
      n="Declare a stock level, or an arrival. Two tabs carry the two claims, the typed number survives the flip between them, and only the meaning of submit changes. The row underneath shows what the documents say and what the person says at the same time."
    >
      <Grid>
        {/* ── the two modes ────────────────────────────────────────────────────────────────── */}
        <Tile
          span={4}
          name="Telling us how much we have now"
          rule="The number IS the stock. The consequence line reads it straight through: type 40 against 72 on hand and stock becomes 40. This tab carries no camera."
        >
          <StockAnnouncement
            onHand={72}
            unit="units"
            onHandNote="from the feed"
            aria-label="Announce stock"
            initialMode={MODE.now}
            initialValue="40"
          />
        </Tile>

        <Tile
          span={4}
          name="Telling us how much we just added"
          rule="The same number, read as an arrival: 40 against 72 on hand and stock becomes 112. The camera sits under the entry, because a photo is evidence of an arrival and an arrival is an addition."
        >
          <StockAnnouncement
            onHand={72}
            unit="units"
            onHandNote="from the feed"
            aria-label="Announce stock"
            initialMode={MODE.add}
            initialValue="40"
            propose={readsFortyUnits}
          />
        </Tile>

        <Tile
          span={4}
          name="The number survives the flip"
          rule="Flip the tabs and watch the entry: what was typed never moves, and the sentence under it is rewritten. The typed string lives one state above the tabs, which is the whole instrument."
        >
          <TheFlip />
        </Tile>

        {/* ── the document ─────────────────────────────────────────────────────────────────── */}
        <Tile
          span={4}
          name="The photo attaching"
          rule="The chip holds its place while the picture is read, and the trash is live throughout, so a wrong photograph can be abandoned before it lands."
        >
          <StockAnnouncement
            onHand={72}
            unit="units"
            aria-label="Announce stock"
            initialMode={MODE.add}
            initialValue="40"
            photo={null}
            photoStatus={PHOTO_STATUS.attaching}
          />
        </Tile>

        <Tile
          span={4}
          name="The photo attached"
          rule="One shape, two hit areas: the body opens the document at full size, the trash throws it away and readies the camera again."
        >
          <Stage>
            {(node) => (
              <StockAnnouncement
                onHand={72}
                unit="units"
                aria-label="Announce stock"
                initialMode={MODE.add}
                initialValue="40"
                initialPhoto={attachedPhoto}
                previewContainer={node}
              />
            )}
          </Stage>
        </Tile>

        <Tile
          span={4}
          name="The preview"
          rule="Rocoto's own chromeless Overlay Card, opened into the tile's own box rather than over the page. It carries the document, what it is called, and the way to take it again."
        >
          <Stage>
            {(node) => (
              <StockAnnouncement
                onHand={72}
                unit="units"
                aria-label="Announce stock"
                initialMode={MODE.add}
                initialValue="40"
                initialPhoto={attachedPhoto}
                previewOpen={openPreview}
                onPreviewOpenChange={({ isOpen }) => setOpenPreview(isOpen)}
                previewContainer={node}
              />
            )}
          </Stage>
        </Tile>

        {/* ── the proposal ─────────────────────────────────────────────────────────────────── */}
        <Tile
          span={6}
          name="The document proposes the quantity"
          rule="Attaching a document changes the entry: the quantity it states arrives in the field, attributed to the document in the accent — the one act on this panel the machine performed by itself."
        >
          <ProposalAndOverride overridden={false} />
        </Tile>

        <Tile
          span={6}
          name="Overridden by hand"
          rule="A proposal is an offer. Type over it and the attribution moves to the hand while the document's own number stays on the line, one press from coming back."
        >
          <ProposalAndOverride overridden={true} />
        </Tile>

        {/* ── the trail and the reality ────────────────────────────────────────────────────── */}
        <Tile
          span={6}
          name="The paper trail"
          rule="The documented stock: what the incoming albaranes add up to, when they landed, and the way to the document itself."
        >
          <StockLevel
            name="Item A"
            trail={128}
            unit="units"
            evidence={{ kind: 'feed', label: 'From the feed', at: feedAt }}
            onOpenEvidence={() => undefined}
          />
        </Tile>

        <Tile
          span={6}
          name="Working reality over the trail"
          rule="The declaration wins and the trail survives: struck through beside the number that stands, still named on the line, still reachable through the chevron. The mark inverts and a rule runs down the edge — ink does the work, there is no second colour."
        >
          <StockLevel
            name="Item A"
            trail={128}
            declared={96}
            declaredAt={declaredAt}
            unit="units"
            evidence={{ kind: 'feed', label: 'from the feed', at: feedAt }}
            onOpenEvidence={() => undefined}
          />
        </Tile>

        <Tile
          span={12}
          name="Feed connected, and standing on photographs"
          rule="Connected, documents reach the trail on their own and the mark is the envelope. Off, the trail rests on what was photographed, and a row with nothing documented shows the declaration alone."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, width: '100%' }}>
            <StockLevel
              name="Item A"
              trail={128}
              unit="units"
              evidence={{ kind: 'feed', label: 'From the feed', at: feedAt }}
              onOpenEvidence={() => undefined}
            />
            <StockLevel
              name="Item B"
              trail={54}
              unit="units"
              feed="off"
              evidence={{ kind: 'document', label: 'From a photographed document', at: feedAt }}
              onOpenEvidence={() => undefined}
            />
            <StockLevel name="Item C" declared={12} declaredAt={declaredAt} unit="units" feed="off" />
          </div>
        </Tile>

        {/* ── disabled ─────────────────────────────────────────────────────────────────────── */}
        <Tile
          span={12}
          name="Disabled"
          rule="The panel and the row stand and read, and move nothing: the tabs, the entry, the camera, the chip, the chevron and the submit are all inert, and the preview stays shut."
        >
          <div style={{ display: 'flex', gap: theme.sizing.scale600, width: '100%', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', minWidth: 260 }}>
              <StockAnnouncement
                onHand={72}
                unit="units"
                aria-label="Announce stock"
                initialMode={MODE.add}
                initialValue="40"
                initialPhoto={attachedPhoto}
                disabled
              />
            </div>
            <div style={{ flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
              <StockLevel
                name="Item A"
                trail={128}
                unit="units"
                evidence={{ kind: 'feed', label: 'From the feed', at: feedAt }}
                onOpenEvidence={() => undefined}
                disabled
              />
              <StockLevel
                name="Item A"
                trail={128}
                declared={96}
                declaredAt={declaredAt}
                unit="units"
                evidence={{ kind: 'feed', label: 'from the feed', at: feedAt }}
                onOpenEvidence={() => undefined}
                disabled
              />
              <StockLevel name="Item C" declared={12} declaredAt={declaredAt} unit="units" feed="off" disabled />
            </div>
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
