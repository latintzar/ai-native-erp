/* OVERLAY CARD — the chromeless overlay, and the doctrine it settles.
 *
 * The question this page answers is "how do overlays work with chrome and without", so the first
 * two tiles are the two answers side by side: Base's own Modal, with its header bar, its body and
 * its footer bar, running unmodified under the Rocoto theme; and the Overlay Card, which is the
 * same layer with all of that taken off. Everything after them is the card's state matrix —
 * docked as a sheet inside a phone, stacked on top of a chromed modal, the three motion phases
 * slowed until they are legible, the card that refuses dismissal, the sizes, the placements, the
 * focus behaviour and the three scrims.
 *
 * The demo copy is Uber's own, verbatim, out of bw-docs/examples/modal — «Hello world», the lorem
 * paragraph, «Confirm closing all.», «No», «Yes». The kit is grammar, so an example decides
 * nothing about which moment of the product this control serves.
 *
 * Several tiles mount the card into a stage of their own rather than the viewport, using the
 * component's `mountNode`: on a reference page a card that swallows the whole screen hides the
 * very thing you came to compare it with. That is the component's own prop doing its own job —
 * the phone housing tile needs it for real.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalButton } from 'baseui/modal';
import { Section, Tile, Grid, Row } from '../chrome';
import { OverlayCard, PLACEMENT, SCRIM, SIZE } from '../../rocoto/overlay-card';
import type { Phase, Placement, Scrim, Size } from '../../rocoto/overlay-card';

/* ── the shared demo furniture ─────────────────────────────────────────────────────────────── */

const LOREM =
  'Proin ut dui sed metus pharetra hend rerit vel non mi. Nulla ornare faucibus ex, non facilisis nisl. Maecenas aliquet mauris ut tempus.';

/** The decision itself: a title line, a line of detail, and the two answers. This is everything a
 *  chromeless card holds — the same content a Modal would spread across three bars. */
function Decision({ onNo, onYes }: { onNo: () => void; onYes: () => void }) {
  const [, theme] = useStyletron();
  return (
    <React.Fragment>
      <div style={theme.typography.LabelLarge}>Confirm closing all.</div>
      <p
        style={{
          margin: `${theme.sizing.scale300} 0 ${theme.sizing.scale600}`,
          ...theme.typography.ParagraphSmall,
          color: theme.colors.contentSecondary,
        }}
      >
        {LOREM}
      </p>
      <Row>
        <Button kind={KIND.tertiary} size={BUTTON_SIZE.compact} onClick={onNo}>
          No
        </Button>
        <Button size={BUTTON_SIZE.compact} onClick={onYes}>
          Yes
        </Button>
      </Row>
    </React.Fragment>
  );
}

/** A stage: a bordered box that stands in for a page, and takes the card as its mount node. The
 *  card positions itself against whatever it is mounted into, so the stage only has to give it a
 *  positioning context. */
function Stage({
  height = 176,
  children,
  onNode,
}: {
  height?: number;
  children?: React.ReactNode;
  onNode: (el: HTMLDivElement | null) => void;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      ref={onNode}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height,
        width: '100%',
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        padding: theme.sizing.scale600,
      }}
    >
      {children}
    </div>
  );
}

/** Holds a DOM node in state so the card renders only once there is something to mount into. */
function useStage() {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  return [node, setNode] as const;
}

/* ── 1. the chromed overlay ────────────────────────────────────────────────────────────────── */

function ChromedModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);
  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal onClose={close} isOpen={isOpen}>
        <ModalHeader>Hello world</ModalHeader>
        <ModalBody>{LOREM}</ModalBody>
        <ModalFooter>
          <ModalButton kind={KIND.tertiary} onClick={close}>
            Cancel
          </ModalButton>
          <ModalButton onClick={close}>Okay</ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}

/* ── 2. the chromeless overlay ─────────────────────────────────────────────────────────────── */

function Chromeless() {
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);
  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open</Button>
      <OverlayCard isOpen={isOpen} onClose={close} ariaLabel="Confirm closing all.">
        <Decision onNo={close} onYes={close} />
      </OverlayCard>
    </React.Fragment>
  );
}

/* ── 3. the same card, docked, inside a phone ──────────────────────────────────────────────── */

function DockedInPhone() {
  const [, theme] = useStyletron();
  const [node, setNode] = useStage();
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);
  return (
    <div
      ref={setNode}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '375px',
        maxWidth: '100%',
        height: '420px',
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        background: theme.colors.backgroundPrimary,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: theme.sizing.scale600,
      }}
    >
      <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
        {LOREM}
      </p>
      <Button onClick={() => setIsOpen(true)}>Open</Button>
      {node && (
        <OverlayCard
          isOpen={isOpen}
          onClose={close}
          mountNode={node}
          placement={PLACEMENT.bottom}
          size={SIZE.full}
          ariaLabel="Confirm closing all."
        >
          <Decision onNo={close} onYes={close} />
        </OverlayCard>
      )}
    </div>
  );
}

/* ── 4. a card opened from inside a chromed modal ──────────────────────────────────────────── */

function StackedOnModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isConfirmOpen, setConfirmOpen] = React.useState(false);
  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal onClose={() => setIsOpen(false)} isOpen={isOpen}>
        <ModalHeader>Hello world</ModalHeader>
        <ModalBody>{LOREM}</ModalBody>
        <ModalFooter>
          <ModalButton kind={KIND.tertiary} onClick={() => setIsOpen(false)}>
            Cancel
          </ModalButton>
          <ModalButton onClick={() => setConfirmOpen(true)}>Okay</ModalButton>
        </ModalFooter>
      </Modal>
      <OverlayCard
        isOpen={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        size={SIZE.compact}
        ariaLabel="Confirm closing all."
      >
        <Decision
          onNo={() => setConfirmOpen(false)}
          onYes={() => {
            setConfirmOpen(false);
            setIsOpen(false);
          }}
        />
      </OverlayCard>
    </React.Fragment>
  );
}

/* ── 5. the three motion phases, slowed until they are readable ────────────────────────────── */

const PHASES: Phase[] = ['closed', 'opening', 'open', 'closing'];

function PhaseStrip({ phase }: { phase: Phase }) {
  const [, theme] = useStyletron();
  return (
    <Row>
      {PHASES.map((p) => {
        const on = p === phase;
        return (
          <span
            key={p}
            style={{
              ...theme.typography.LabelXSmall,
              padding: `2px ${theme.sizing.scale300}`,
              borderRadius: theme.borders.radius100,
              border: `1px solid ${on ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
              background: on ? theme.colors.contentPrimary : 'transparent',
              color: on ? theme.colors.backgroundPrimary : theme.colors.contentTertiary,
            }}
          >
            {p}
          </span>
        );
      })}
    </Row>
  );
}

function Phases() {
  const [, theme] = useStyletron();
  const [node, setNode] = useStage();
  const [isOpen, setIsOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('closed');
  // the path the last cycle took, kept because `opening` lasts one frame and the eye misses it
  const [trace, setTrace] = React.useState<Phase[]>([]);
  const record = (p: Phase) => {
    setPhase(p);
    setTrace((t) => (p === 'opening' ? ['closed', p] : [...t, p]));
  };
  const close = () => setIsOpen(false);
  // the same transition Base's Modal runs, held on `timing1000` so each phase is legible
  const slow = { style: { transitionDuration: theme.animation.timing1000 } };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.sizing.scale600,
        width: '100%',
      }}
    >
      <Stage onNode={setNode} height={176}>
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {LOREM}
        </p>
        {node && (
          <OverlayCard
            isOpen={isOpen}
            onClose={close}
            onPhaseChange={record}
            mountNode={node}
            size={SIZE.compact}
            ariaLabel="Confirm closing all."
            overrides={{ Scrim: slow, Card: slow }}
          >
            <div style={theme.typography.LabelMedium}>Confirm closing all.</div>
            <Row>
              <Button kind={KIND.tertiary} size={BUTTON_SIZE.compact} onClick={close}>
                No
              </Button>
              <Button size={BUTTON_SIZE.compact} onClick={close}>
                Yes
              </Button>
            </Row>
          </OverlayCard>
        )}
      </Stage>
      <PhaseStrip phase={phase} />
      <div
        style={{
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentTertiary,
          minHeight: '1.4em',
        }}
      >
        {trace.join(' → ')}
      </div>
      <Button size={BUTTON_SIZE.compact} onClick={() => setIsOpen(true)}>
        Open
      </Button>
    </div>
  );
}

/* ── 6. the card that stays until the decision is made ─────────────────────────────────────── */

function MustDecide() {
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);
  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open</Button>
      <OverlayCard
        isOpen={isOpen}
        onClose={close}
        dismissable={false}
        role="alertdialog"
        ariaLabel="Confirm closing all."
      >
        <Decision onNo={close} onYes={close} />
      </OverlayCard>
    </React.Fragment>
  );
}

/* ── 7. sizes ──────────────────────────────────────────────────────────────────────────────── */

const SIZES: Size[] = ['compact', 'default', 'full'];

function Sizes() {
  const [size, setSize] = React.useState<Size | null>(null);
  return (
    <React.Fragment>
      <Row>
        {SIZES.map((s) => (
          <Button key={s} size={BUTTON_SIZE.compact} kind={KIND.secondary} onClick={() => setSize(s)}>
            {s}
          </Button>
        ))}
      </Row>
      <OverlayCard
        isOpen={size !== null}
        onClose={() => setSize(null)}
        size={size || SIZE.default}
        ariaLabel="Confirm closing all."
      >
        <Decision onNo={() => setSize(null)} onYes={() => setSize(null)} />
      </OverlayCard>
    </React.Fragment>
  );
}

/* ── 8. placement ──────────────────────────────────────────────────────────────────────────── */

const PLACEMENTS: Placement[] = ['center', 'bottom'];

function Placements() {
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  return (
    <React.Fragment>
      <Row>
        {PLACEMENTS.map((p) => (
          <Button
            key={p}
            size={BUTTON_SIZE.compact}
            kind={KIND.secondary}
            onClick={() => setPlacement(p)}
          >
            {p}
          </Button>
        ))}
      </Row>
      <OverlayCard
        isOpen={placement !== null}
        onClose={() => setPlacement(null)}
        placement={placement || PLACEMENT.center}
        size={placement === PLACEMENT.bottom ? SIZE.full : SIZE.default}
        ariaLabel="Confirm closing all."
      >
        <Decision onNo={() => setPlacement(null)} onYes={() => setPlacement(null)} />
      </OverlayCard>
    </React.Fragment>
  );
}

/* ── 9. focus ──────────────────────────────────────────────────────────────────────────────── */

function Focus() {
  const [isOpen, setIsOpen] = React.useState(false);
  const close = () => setIsOpen(false);
  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open</Button>
      <OverlayCard isOpen={isOpen} onClose={close} size={SIZE.compact} ariaLabel="Confirm closing all.">
        <div style={{ marginBottom: 12 }}>Confirm closing all.</div>
        <Row>
          <Button kind={KIND.tertiary} size={BUTTON_SIZE.compact} onClick={close}>
            No
          </Button>
          <Button size={BUTTON_SIZE.compact} onClick={close}>
            Yes
          </Button>
        </Row>
      </OverlayCard>
    </React.Fragment>
  );
}

/* ── 10–12. the three scrims, each over a live surface ─────────────────────────────────────── */

function ScrimStage({ scrim }: { scrim: Scrim }) {
  const [, theme] = useStyletron();
  const [node, setNode] = useStage();
  return (
    <Stage onNode={setNode} height={180}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
        <p style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {LOREM}
        </p>
        <Button size={BUTTON_SIZE.mini} kind={KIND.secondary}>
          Okay
        </Button>
      </div>
      {node && (
        <OverlayCard
          isOpen
          mountNode={node}
          scrim={scrim}
          size={SIZE.compact}
          animate={false}
          autoFocus={false}
          focusLock={false}
          dismissable={false}
          ariaLabel="Confirm closing all."
        >
          <div style={theme.typography.LabelSmall}>Confirm closing all.</div>
        </OverlayCard>
      )}
    </Stage>
  );
}

/* ── the page ──────────────────────────────────────────────────────────────────────────────── */

export default function OverlayCardSection() {
  return (
    <Section
      t="Overlay Card"
      n="One decision, floating on its own layer. The scrim or Escape dismisses it, the keyboard stays inside it, and it comes and goes on Base's Modal motion — with the header bar, the footer bar and the close button taken off, because chrome is what an overlay grows when you are going to stay a while."
    >
      <Grid>
        <Tile
          span={6}
          name="With chrome — Base's Modal"
          rule="A task you work in. The header names the place, the footer bar carries the exits, and a close button sits in the corner. That anatomy earns its space when the person is going to be in there long enough to lose the thread."
        >
          <ChromedModal />
        </Tile>

        <Tile
          span={6}
          name="Without chrome — Overlay Card"
          rule="One decision you make and it closes. The header would repeat the question, the footer bar would rule a line under two buttons that need none, and the close button would offer a third way out of a two-way choice. So the card carries the decision and nothing else."
        >
          <Chromeless />
        </Tile>

        <Tile
          span={6}
          name="Docked as a sheet"
          rule="placement=bottom, mounted into the phone rather than the window: the same component, the same motion tokens, the top corners rounded and the bottom two meeting the edge they sit on. A decision crosses form factor without being rebuilt."
        >
          <DockedInPhone />
        </Tile>

        <Tile
          span={6}
          name="Stacked on a chromed modal"
          rule="A card opened from inside a Modal takes the topmost layer, and its own scrim dims the modal the way the modal dimmed the page. Escape and the scrim unwind one layer at a time — the card first, the modal after."
        >
          <StackedOnModal />
        </Tile>

        <Tile
          span={6}
          name="Opening · open · closing"
          rule="The card's own phases, live, with the transition held on the theme's slowest step so the travel is legible. `opening` is the single frame at the motion's origin, so `open` is the phase the card travels in and the trace underneath is where you read it. A centred card rises the last 20px into place and fades out where it stands — Base's Modal motion exactly."
        >
          <Phases />
        </Tile>

        <Tile
          span={6}
          name="A decision that must be made"
          rule="dismissable=false: the scrim and Escape are inert, and the card's own two answers are the way out. Where a Modal would still offer a close button, a bare card offers exactly the choices the decision has."
        >
          <MustDecide />
        </Tile>

        <Tile
          span={4}
          name="Sizes"
          rule="compact 320px, default 400px, full fills the layer's width. A card is one decision, so full means wide, never tall."
        >
          <Sizes />
        </Tile>

        <Tile
          span={4}
          name="Placement"
          rule="Centred on the layer, or docked to its bottom edge. Centred rises 20px into place; docked comes up from below and goes back down the same way."
        >
          <Placements />
        </Tile>

        <Tile
          span={4}
          name="Focus"
          rule="Focus moves into the card as it opens, Tab cycles inside it, and it returns to the control that opened it. Arriving by keyboard draws the ring; arriving by pointer draws nothing."
        >
          <Focus />
        </Tile>

        <Tile
          span={4}
          name="Scrim: dim"
          rule="The layer's own ground, dimmed. The surface underneath recedes and stops taking the pointer, so the card carries no shadow — the scrim is already doing that work."
        >
          <ScrimStage scrim={SCRIM.dim} />
        </Tile>

        <Tile
          span={4}
          name="Scrim: clear"
          rule="Paints nothing and still takes the pointer, for a card over something the person has to keep seeing. The card picks up an elevation, because the separating is now its own job."
        >
          <ScrimStage scrim={SCRIM.clear} />
        </Tile>

        <Tile
          span={4}
          name="Scrim: none"
          rule="Paints nothing and passes the pointer through: the button underneath answers the hand, and the page keeps its scroll. Escape and a click away from the card still dismiss it."
        >
          <ScrimStage scrim={SCRIM.none} />
        </Tile>
      </Grid>
    </Section>
  );
}
