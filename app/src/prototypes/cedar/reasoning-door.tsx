/* THE REASONING DOOR — THE ANXIETY CARD, AGED (FEED-IA §127.3).
 *
 * S12 asked what kind of chip «Actually, understand why you did that?» is, and §127.3 answers:
 *
 *   «The chip is neither a captured fact (§113's chips) nor an offered choice (dropdowns) — it is
 *   a REASONING DOOR: Rocoto offering its own past reasoning for inspection. It is the anxiety
 *   card AGED: on live work the anxiety asks for an act; on history it only explains. Same object,
 *   two tenses. It opens the same dive: the rule line, then the house's own record walked through
 *   it (§106's derivation grammar). Offered, never imposed; it never blocks anything.»
 *
 * ═══ SO IT IS ITS OWN QUIET SHAPE, AND DELIBERATELY NOT THE OTHER TWO ═══════════════════════
 * A §113 chip is a FACT the parse captured — it states something that is true of the document, and
 * it is filled. A dropdown is a CHOICE the app is offering — it has a caret, and pressing it puts
 * answers on the screen. This is neither: it makes no claim about the document and it offers
 * nothing to pick. It is a hairline outline with no fill, at the quietest step the kit has,
 * carrying a question rather than a label — because a question is what it is, and because a
 * reader has to be able to ignore it completely. «Offered, never imposed» is a geometry
 * instruction as much as a copy one: it takes the row's own leftover width, it never takes a seat
 * from a fact, and nothing waits on it.
 *
 * ═══ THE CARD IT OPENS IS NOT A NEW ONE ═════════════════════════════════════════════════════
 * `areas/admin/data.tsx` already grew the §106 derivation card — the head, then a METHOD LINE
 * naming the rule, then the house's own record WALKED through it as real rows, each one a door
 * onto the document it is about. That is exactly what §127.3 asks this to open, so the organ is
 * LIFTED here rather than drawn a second time, and Your data imports it back. Two derivation
 * cards would be two answers to «why did you do that», which is the one question this product
 * cannot afford to answer twice.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import { List, Row } from './rows';

/* ── THE METHOD LINE (§63) ────────────────────────────────────────────────────────────────────
 * «It has a bunch of explanations, and then you go and read the way they do it.» The quietest type
 * on any surface, because it is a footnote and not a claim — and never optional, because it is
 * where the honesty lives: a stranger can hold the figure to it.
 *
 * It was private to `areas/admin/data.tsx` and to `activation-web.tsx`, one copy each. This is the
 * third caller and the point at which a private copy stops being defensible, so it publishes here
 * beside the card it belongs to.
 */
export function Method({ children, testid }: { children: React.ReactNode; testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <p
      data-method={testid ?? 'yes'}
      style={{
        margin: 0,
        ...theme.typography.ParagraphXSmall,
        color: theme.colors.contentTertiary,
        maxWidth: '68ch',
        minWidth: 0,
      }}
    >
      {children}
    </p>
  );
}

/** ONE STEP OF THE WALK — a real record row, and a door onto the thing it is about. The card
 *  never summarises the walk: §106's whole point is that the derivation is the DOCUMENTS, read. */
export type WalkStep = {
  id: string;
  /** whose document, or what the row is — the greedy column */
  label: string;
  /** what it says, in the app's own words. Never a sentence written for this card. */
  sub?: string;
  /** where the row goes. A step with nowhere to go is a step, not a door (§43's honest half). */
  onOpen?: () => void;
  /** the machine's verdict, for the drives and on no pixel */
  verdict?: string;
};

/* ── THE DERIVATION CARD (§106) ───────────────────────────────────────────────────────────────
 * head → the rule line → the record walked through it → out. It is the same card on both tenses:
 * asked of an accuracy count on Your data, asked of one order's own past here.
 */
export function DerivationCard({
  isOpen,
  onClose,
  title,
  says,
  rule,
  walk,
  testid,
  ruleTestid,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** what this is a derivation OF */
  title: string;
  /** the one line under the title: what happened, in the grammar the app already speaks */
  says?: string;
  /** THE RULE THE DECISION WAS MADE BY, stated where a stranger can hold the record to it */
  rule: string;
  walk: WalkStep[];
  testid: string;
  ruleTestid: string;
}) {
  const [, theme] = useStyletron();
  return (
    <OverlayCard isOpen={isOpen} onClose={onClose} scrim={SCRIM.dim} size={560} ariaLabel={title}>
      <div
        data-testid={testid}
        data-walked={walk.length}
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h2>
          {says && (
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
              {says}
            </span>
          )}
        </div>
        <Method testid={ruleTestid}>{rule}</Method>
        <List testid={`${testid}-walk`}>
          {walk.map((step) => (
            <Row
              key={step.id}
              /* THE VERDICT IS IN THE TESTID AND ON NO PIXEL. A house reads its own documents in
                 its own words; the machine's four are for the machine (§10.10 · §72.3). */
              testid={step.verdict ? `walk-${step.verdict}-${step.id}` : `walk-${step.id}`}
              mark="doc"
              label={step.label}
              sub={step.sub}
              onOpen={step.onOpen}
            />
          ))}
        </List>
        <div>
          <Button kind={KIND.primary} size={SIZE.compact} onClick={onClose} data-testid={`${testid}-done`}>
            Done
          </Button>
        </div>
      </div>
    </OverlayCard>
  );
}

/* ── THE DOOR ITSELF ──────────────────────────────────────────────────────────────────────────
 * A hairline, no fill, a question. It is sized to disappear next to the row's own facts — which is
 * what «offered, never imposed» has to mean in pixels — and it is the ONE affordance in this app
 * that carries a question mark, because it is the only one asking the reader whether they want
 * something rather than telling them what a thing is.
 */
export function ReasoningDoor({
  onOpen,
  testid,
  children = 'Why?',
  label,
}: {
  onOpen: () => void;
  testid: string;
  children?: React.ReactNode;
  /** the whole question, for the hover and for a reader using their ears */
  label: string;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      data-door="reasoning"
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flex: '0 0 auto',
        ...theme.typography.LabelXSmall,
        color: over ? theme.colors.contentPrimary : theme.colors.contentTertiary,
        /* NO FILL, EVER. A filled pill is §113's captured-fact chip, and this makes no claim about
           the document — mistaking the two is exactly the confusion S12 asked about. */
        background: 'transparent',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: over ? theme.colors.mono400 : theme.colors.borderOpaque,
        borderRadius: theme.borders.radius400,
        paddingTop: theme.sizing.scale0,
        paddingBottom: theme.sizing.scale0,
        paddingLeft: theme.sizing.scale300,
        paddingRight: theme.sizing.scale300,
        /* HOVER PAINTS AND MOVES NOTHING (§37.3): the border stands at rest and only changes
           colour, so a row gaining a pointer costs it no pixels. */
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        transitionProperty: 'color, border-color',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
      }}
    >
      {children}
    </button>
  );
}
