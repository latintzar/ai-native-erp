import { grownProducts, useCatalogue } from './catalogue';
import { projectSKU, useSKURecords } from './sku-record';
import { ProductCode } from './product-code';
import { OFF_LIST } from '../../scenarios/data/cast';
/* THE CUSTOMER PROFILE — reachable from a sale, still not a tab. THE-INTELLIGENCE §5.
 *
 * ═══ HIS LIST, IN HIS ORDER ════════════════════════════════════════════════════════════════
 * «Order history · what they ordered vs what was actually given — the pairing is the important
 * thing · complaints · things noticed · menu changes we found on Google Maps, which maybe has the
 * Google logo on it somewhere… it just feels live.»
 *
 * So the profile is his list, and nothing else:
 *
 *   1 · THEIR ALBARANES         every sale of theirs, the live ones first, then the year behind
 *   2 · THE NUMBERS             what one of theirs comes to this month, against their own usual,
 *                               and their months as a 32px spark (THE-DATA-CANON §2.3)
 *   3 · WHAT THEY ASKED FOR,    the fulfilment fingerprint — per line, asked beside given, over
 *       AND WHAT YOU SENT       time, with §1's provenance note read retrospectively
 *   4 · THEIR COMPLAINTS        their disputes, each tied to the albarán it was raised on
 *   5 · ROCOTO HAS NOTICED      the observations, as sentences, saffron-marked
 *   6 · THEIR MENU CHANGED      somebody else's document, carrying somebody else's mark
 *
 * ═══ WHY IT IS AN OVERLAY AND NOT A PAGE ═══════════════════════════════════════════════════
 * «Customers: reachable from a sale, not a tab» (THE-APP-V2 §1.1). A person opens this in the
 * middle of reading an albarán, answers the question they had, and goes back to the albarán. That
 * is a card you leave, not a place you stay — which is exactly the Overlay Card's own doctrine.
 * Fullscreen on the phone, a wide panel on the desk; the same component, one size prop apart.
 *
 * ═══ WHAT SAFFRON MARKS, HERE AS EVERYWHERE ════════════════════════════════════════════════
 * Rocoto's own act. The observations are Rocoto's, so they carry the mark; the albaranes, the
 * pairs and the complaints are the house's own record and are ink. The Google mark is neither —
 * it is an ATTRIBUTION, drawn in the row's own ink, because it says whose document a fact came
 * off rather than who noticed it (§8.6).
 *
 * ═══ THE SHAPE OF EVERY ROW (THE-APP-V2 §6) ════════════════════════════════════════════════
 * Sticky header, so the name of the customer never scrolls away from the facts about them. Every
 * block a card with a shadow — elevation is the card's presence. Every label passes the stranger
 * test: cover the block and its heading still says what is under it. Every row is a sentence.
 *
 * ═══ §111.6 · WHAT ROUND 1 CHANGED HERE ═════════════════════════════════════════════════════
 * «Why doesn't it show a line chart maybe… usual order as a leaderboard… why would their card be
 * text and not hyperlinked. This isn't 2010 SAP. Tarifa doesn't look selectable.»
 *
 *   THE ORDER IS RANKED    `TheirUsualOrder` — what carries the account, as a leaderboard.
 *   EVERY NAME IS A DOOR   §43, applied through the sheet: the goods on a pair line, the goods on
 *                          the leaderboard and today's albaranes all open the object they name.
 *   THE TARIFA IS A CHOICE `TheirTarifa` — the house's bands as chips, the one they buy on
 *                          selected, `setCustomerTier` behind it. It read as a word before.
 *   THE HISTORY IS THEIRS  §111.9 — the block says whose it is, groups under month dividers, and
 *                          ghosts the rows above and below the one being read.
 *   THE TEXT GREW          V26 · V29 («super small text» · «this is better but tiny text»): rows'
 *                          labels, sub-lines and every method line step up one place on Base's own
 *                          scale. The evidence under an observation stays where it was, because a
 *                          ramp with no steps left is not a hierarchy.
 *
 * ═══ §115.4 · WHAT ROUND 2 CORRECTED ════════════════════════════════════════════════════════
 * «The line chart isn't about their order days, but about their HISTORICAL ORDERING VOLUME (last
 * month, last year, or something). The bar chart of their usual order is silly to have when the
 * leaderboard already shows the different progress or the different standing. There should be a
 * "Show more" button with a chevron, and the order history is a different thing.»
 *
 *   THE CHART IS VOLUME    `TheirVolume` replaces round 1's `TheirDays`. What they order, over
 *                          THIS MONTH or THE YEAR — one series, one window chip pair, each window
 *                          carrying its own method line. The weekday shape is gone: it answered a
 *                          question about rhythm on a block whose subject is how much.
 *   THE BARS ARE GONE      the leaderboard's magnitude bar drew a second time what the RANK and
 *                          the count already say. Rank, face, name, «4 of 5», the quantity right.
 *   «SHOW MORE» + CHEVRON  one control, on the leaderboard and on the history, and it draws
 *                          nothing where everything already fits its seat.
 *   HISTORY STANDS ALONE   `OrderHistory` was already its own block (§111.9) and stays one.
 *
 * ═══ THE FILM (§115.6 — the beats, before the layout) ═══════════════════════════════════════
 *   BEAT 0 · BEFORE   a name was pressed somewhere — an albarán, a river row, the book.
 *   BEAT 1 · WHO      the sticky header: their name, how they buy, and their tarifa as a CHOICE.
 *                     It never scrolls away from the facts about them.
 *   BEAT 2 · WHAT     the record first — their order history, months divided, one row lit.
 *            HAPPENED
 *   BEAT 3 · WHAT IT  then the arithmetic off it: what one of theirs comes to, how much they
 *            MEANS    order over a month or a year, and what carries the account.
 *   BEAT 4 · WHAT     the fulfilment pairs, their complaints, their menu, and last what Rocoto
 *            WE KNOW  has noticed — the readings, after the record they were read from.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { ButtonGroup, MODE as GROUP_MODE } from 'baseui/button-group';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
/* E200.07 · the tariff seat is the product sheet's own live field (§196.1 carried outward). */
import { LiveField } from './live-field';
import { Figure } from './figure';
import { WorkflowDialog } from './workflow-dialog';
/* THE CHART KIT, not a chart (§5.1). `SIZE` is already the button's here, so the chart's own steps
   come in under their own name — one import, no shadowed constant. */
import { LineChart, CURVE, SIZE as CHART_SIZE } from '../../rocoto/charts';
import type { Cast, Customer, Product } from '../../scenarios/data/cast';
import Name from '../../scenarios/shell/Name';
/* THE OBJECT DOORS (§43). A name on this sheet opens the thing it names — the goods on a line, the
   goods on the leaderboard, the albarán a row stands for. */
import { Door, openOrder, openProduct, openTierRegistry } from './anchors';
import { nowOf, useDay, plural } from './day';
import { useGrants } from './grants';
import { ProductFace } from './product-face';
import { Glyph, STEP } from './glyphs';
/* §132.2's own span — a fact that may not break, wherever it is standing. */
import { Atom } from './rows';
import { buildSales, dayFromId, policyOf, RANK, todayId, type PolicyId, type Sale } from './sale';
/* ── §127.3 · THE ANXIETY, IN ITS TWO TENSES ─────────────────────────────────────────────────
   The RED DOT makes exactly one claim — «a human being is waiting on you» — and only
   `waitingOnAPerson` may raise it. The REASONING DOOR is the same anxiety AGED: on history it only
   explains, and it opens the §106 derivation card `areas/admin/data.tsx` grew and this file now
   imports rather than redraws. */
import { AttentionDot, waitingOnAPerson, waitingOnHistory, type Waiting } from './attention-dot';
/* §196.3 · the red-flag vocabulary. A card in a person's own list that says somebody is waiting
   wears the same outline the river's row does — one drawing of one fact, at every altitude. */
import { flagBox } from './red-flag';
import { DerivationCard, ReasoningDoor } from './reasoning-door';
import { usePhone, usePhoneFloorHeight } from './shell';
import {
  bandOf,
  discountHistoryOf,
  discountOn,
  ownPriceOf,
  priceFor,
  priceOn,
  priceUnitOf,
  releaseCustomerDiscount,
  scheduleCustomerDiscount,
  setCustomerPrice,
  setCustomerTier,
  tierNameOf,
  tiersOfHouse,
  usePriceSaveError,
  useTiers,
  type CustomerDiscount,
} from './tiers';
import {
  aboutCustomer, amount, basketOf, complaintsOf, historyOf, menuChangeOf, menuOf,
  monthKeyOf, monthLabelOf, monthOf, readMenu, units, useImport, useKnows, useMenusRead,
  type Evidence, type Observation, type PairLine,
} from './knows';
/* THE ONE READ-SIDE MODULE (§5.1). The seat's twelve readings and this sheet's one projection are
   folded in the same place, so a customer's months here and the house's months there can never be
   two different readings of one record. */
import { wholeSoles, frequentOf, monthsFor } from './insights';
import { capabilityAvailable } from './release-profile';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { CustomerCredit } from './money-credit';
import { countryCurrency, syntheticAmountForCountry } from './currency';

/* ── A PERSON WHO ASKED FOR LESS MOTION GETS NONE ─────────────────────────────────────────────
 * Read once, at mount, exactly as the app's other transitions read it (`shell/frame.tsx`,
 * `areas/stock.tsx`): a query that flips mid-scroll would leave a row half-faded. The ghosting
 * itself STAYS — it is hierarchy, not motion — and only the travel between states goes.
 */
const useStill = (): boolean => {
  const [still] = React.useState(
    () =>
      typeof window !== 'undefined'
      && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  return still;
};

/* ── THE MARK ROCOTO'S OWN ACT CARRIES ────────────────────────────────────────────────────────
 * One ring, line art, `stroke` off the theme — so it re-brands with everything else and no
 * observation owns a colour. Identical in kind to the feed's flag mark: the mark says «this is
 * Rocoto talking», and the words say the rest.
 *
 * ⚠ AND THE RING IS INK (FEED-IA §127.3 · THE-CHECKPOINT-AUDIT finding 1). It was the accent, and
 * the audit read it as a red bullet in front of «Ordering well under their rhythm» on the
 * Customers book and in front of «Read 77.363 albaranes…» on «Your data» — a reading is Rocoto
 * talking, never a person waiting, and §127.3 gives red to exactly one sentence. What made the
 * observations trustworthy was that a mark said whose they were; that survives at ink weight.
 */
export function NoticedMark({ label }: { label?: string }) {
  const [, theme] = useStyletron();
  return (
    <svg
      data-testid="noticed-mark"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke={theme.colors.contentTertiary}
      strokeWidth="1.4"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flex: '0 0 auto', marginTop: '0.35em' }}
    >
      <circle cx="5" cy="5" r="3.2" />
    </svg>
  );
}

/* ── THE GOOGLE MARK (§5, §8.6) ───────────────────────────────────────────────────────────────
 * «Menu changes we found on Google Maps — which maybe has the Google logo on it somewhere… it just
 * feels live.»
 *
 * SOURCE ATTRIBUTION, NOT DECORATION. The card states a fact this house did not observe, so it
 * says whose document it came off and when it was read. The mark is the G, drawn as LINE ART in
 * `currentColor` — one stroke weight, no fill — for two reasons that agree: the standing linework
 * law, and the re-theme law, which no four-colour raster could keep. The words «Google Maps» ride
 * beside it, because a glyph nobody recognises attributes nothing.
 */
export function GoogleMark({ found }: { found?: string }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-testid="google-mark"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius200,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        color: theme.colors.contentSecondary,
        ...theme.typography.LabelXSmall,
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {/* the G: an open ring cut at the right, and the bar that closes into the counter */}
        <path d="M16.4 6.6A7 7 0 1 0 17 10h-6.6" />
      </svg>
      Google Maps{found ? ` · read ${found}` : ''}
    </span>
  );
}

/* ── ONE OBSERVATION ──────────────────────────────────────────────────────────────────────────
 * The sentence, then the facts it was read off. THE SENTENCE IS THE WHOLE OF WHAT IT SAYS: no
 * score, no bar, no «87% confident». The evidence sits under it in a quiet list, each fact naming
 * where it can be checked — which is the difference between a claim and a reading.
 */
export function Noticed({ observation, testid }: { observation: Observation; testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid ?? `noticed-${observation.id}`}
      data-kind={observation.kind}
      data-source={observation.source}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}
    >
      <span style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'flex-start', minWidth: 0 }}>
        <NoticedMark label="Detected" />
        <span style={{ ...theme.typography.ParagraphSmall, minWidth: 0 }}>{observation.sentence}</span>
      </span>
      {/* WHERE ON THE TREE IT HANGS (THE-INTELLIGENCE §10.3). A pattern about a thing is a pattern
          about the node that thing grounds onto, so the node is named in ink beside the sentence
          rather than left implicit — it is the thing the next order will be routed through. */}
      {observation.nodeName && (
        <span
          data-testid={`noticed-node-${observation.id}`}
          style={{
            ...theme.typography.LabelXSmall,
            color: theme.colors.contentTertiary,
            marginLeft: theme.sizing.scale600,
          }}
        >
          Category · {observation.nodeName}
        </span>
      )}
      <EvidenceList evidence={observation.evidence} />
    </div>
  );
}

/** The facts underneath, indented behind a hairline — §1's provenance grammar, one level down. */
export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const [, theme] = useStyletron();
  const shown = evidence.filter((e) => e.fact);
  if (shown.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale100,
        marginLeft: theme.sizing.scale600,
        paddingLeft: theme.sizing.scale400,
        borderLeft: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      {shown.map((e, i) => (
        <span
          key={`${e.fact}-${i}`}
          style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
        >
          {e.fact}
          {e.where ? ` · ${e.where}` : ''}
        </span>
      ))}
    </div>
  );
}

/* ── THE ACCOUNT'S OWN NUMBER (FEED-IA §134.2) ────────────────────────────────────────────────
 * «The account's PHONE NUMBER goes on the sheet.»
 *
 * A CUSTOMER HAS NO STORED NUMBER YET, and inventing a field on the cast to hold one would be
 * this build claiming a fact the runtime has not handed it. So the number is DERIVED from the
 * account's own id, exactly the way `cast.ts` derives every person's: «nothing in this file is a
 * number somebody could mistake for a real one and every row still shows the shape of one». Same
 * construction, same promise — a stable, unique, obviously-Spanish, obviously-not-real number, and
 * the same account shows the same one on every surface and after every reload.
 *
 * ⚠ WIRING SEAM: the real number is the customer record's, and it arrives with the account (see
 * §135.1's new-customer modal, whose FIRST two fields are the name and the number). When that
 * lands, this reader takes the stored value and nothing else on the sheet changes.
 */
export function accountNumber(customer: Customer): string {
  let n = 0;
  for (let i = 0; i < customer.id.length; i += 1) n = (n * 31 + customer.id.charCodeAt(i)) % 100000;
  /* TWO DIGITS, NEVER STARTING AT ZERO — so the shape is the one the rest of the app prints
     («+34 932 62 18 40»): a 9, then three pairs, and the groups a Spanish reader expects. */
  const pair = (k: number) => String((k % 90) + 10);
  return `+34 9${pair(n)} ${pair(n >> 3)} ${pair(n >> 7)} ${pair(n >> 11)}`;
}

/* ── ONE BLOCK ────────────────────────────────────────────────────────────────────────────────
 * A card with a heading that NAMES the thing, one line saying what is in it, and the rows. The
 * shadow is the card's presence (§6.2); the border keeps it a card when the shadow is subtle.
 */
export function Block({
  title,
  lead,
  aside,
  testid,
  children,
}: {
  /** the heading. A ReactNode because §111.9 puts the customer's own name in it. */
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** what rides the heading's own row — a mark, a count */
  aside?: React.ReactNode;
  testid: string;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <section
      data-testid={testid}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale400,
        padding: theme.sizing.scale600,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        boxShadow: theme.lighting.shadow400,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, flex: 1, minWidth: 0 }}>{title}</h3>
        {aside}
      </div>
      {lead && (
        /* THE METHOD LINE IS READ, SO IT IS SET AT READING SIZE (V29: «this is better but tiny
           text. the text below the title is.. what is it...»). It was 12px grey under a 20px
           heading, which is the size a legal footer is set at — and §63 asks this line to carry
           the window and the basis of every figure under it. One step up Base's own scale. */
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {lead}
        </p>
      )}
      {children}
    </section>
  );
}

/* ── A ROW ────────────────────────────────────────────────────────────────────────────────── */

function Row({
  label,
  sub,
  value,
  testid,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'baseline',
        gap: theme.sizing.scale400,
        paddingTop: theme.sizing.scale300,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      {/* THE ROW IS READ AT READING SIZE (V26 · V29). A 12px label over a 12px sub is a row with
          no hierarchy in it AND a row nobody wants to read; both halves step up one place, and
          the ramp of the sheet becomes heading 20 · row 14 · evidence 12. */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <span style={theme.typography.LabelMedium}>{label}</span>
        {sub && (
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{sub}</span>
        )}
      </span>
      {value}
    </div>
  );
}

/** One order is one destination. The transparent list owns spacing; this inset shape alone owns
 * hover, keyboard focus and the current-reading state. Evidence controls sit outside the hit area
 * so a person cannot open the wrong object while aiming for the albarán. */
function OrderListCard({
  testid,
  dotTestid,
  label,
  sub,
  current = false,
  waiting = null,
  value,
  onOpen,
  onRead,
}: {
  testid: string;
  dotTestid?: string;
  label: React.ReactNode;
  sub: React.ReactNode;
  current?: boolean;
  waiting?: Waiting | null;
  value?: React.ReactNode;
  onOpen: () => void;
  onRead?: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    <Button
      kind={KIND.tertiary}
      size={SIZE.compact}
      data-testid={testid}
      data-list-card="inset"
      data-reading={current ? 'yes' : 'no'}
      data-selected={current ? 'yes' : 'no'}
      /* §196.3: the card states the flag as well as drawing it, so the audit drive can hold every
         list in the product to the same claim without measuring pixels. */
      data-flagged={waiting ? 'yes' : 'no'}
      aria-current={current ? 'true' : undefined}
      aria-label={typeof label === 'string' ? `Open ${label}` : 'Open delivery note'}
      onClick={onOpen}
      onMouseEnter={onRead}
      onFocus={onRead}
      overrides={{
        BaseButton: {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            justifyContent: 'stretch',
            gap: theme.sizing.scale400,
            width: `calc(100% - ${theme.sizing.scale400})`,
            minHeight: '64px',
            height: 'auto',
            boxSizing: 'border-box',
            margin: `${theme.sizing.scale200} ${theme.sizing.scale200}`,
            padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
            border: `1px solid ${current ? theme.colors.borderOpaque : 'transparent'}`,
            /* ── THE RED OUTLINE, ON THE OBJECT (FEED-IA §196.3) ──────────────────────────
               «red outline on the message etc… be top down». This card is the same order the
               river draws, one altitude in, so it wears the same mark. An outline takes no
               layout, so a list whose rows start and stop being flagged never reflows. */
            ...flagBox(theme, Boolean(waiting)),
            borderRadius: theme.borders.radius400,
            backgroundColor: current ? theme.colors.backgroundSecondary : 'transparent',
            boxShadow: current
              ? `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)`
              : 'none',
            color: theme.colors.contentPrimary,
            textAlign: 'left',
            cursor: 'default',
            transitionProperty: 'background-color, border-color, box-shadow',
            transitionDuration: theme.animation.timing400,
            transitionTimingFunction: theme.animation.easeOutCurve,
            ':hover': {
              backgroundColor: theme.colors.backgroundSecondary,
              borderColor: theme.colors.borderOpaque,
              boxShadow: `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)`,
            },
            ':focus-visible': {
              backgroundColor: theme.colors.backgroundSecondary,
              borderColor: theme.colors.borderOpaque,
              boxShadow: `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)`,
              outline: `2px solid ${theme.colors.contentPrimary}`,
              outlineOffset: '-2px',
            },
          },
        },
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0, ...theme.typography.LabelMedium }}>
          <AttentionDot waiting={waiting} testid={dotTestid ?? `${testid}-dot`} />
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
        </span>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0, overflowWrap: 'anywhere' }}>{sub}</span>
      </span>
      {value && <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{value}</span>}
    </Button>
  );
}

/* ── THE PAIRS (§5, §1 read backwards) ────────────────────────────────────────────────────────
 * «The ordered-vs-given pairs use §1's grammar retrospectively: asked / given, side by side, per
 * line, over time — the customer's fulfilment fingerprint.»
 *
 * So the two numbers are ON ONE ROW, side by side, and neither is hidden behind the other. Where
 * they differ the line carries the note that says WHY — the pack, the scale, the shelf — indented
 * and quiet, exactly as a filled line carries its provenance on the albarán itself. Where they
 * agree the line says nothing extra, because silence is the default.
 */

type Pass = { id: string; number: string; day: string; lines: PairLine[] };

function Pairs({ pass }: { pass: Pass }) {
  const [, theme] = useStyletron();
  return (
    <div data-testid={`pass-${pass.id}`} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      {/* THE PASS HEADER IS A GROUP LABEL, NOT A ROW. Set in the same size and weight as the lines
          under it, it read as one more line of the group above — so the two groups ran together
          and the «over time» of the fingerprint stopped being legible. */}
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingTop: theme.sizing.scale400,
        }}
      >
        Delivery Note {pass.number} · {pass.day}
      </span>
      {pass.lines.map((l, i) => (
        <div
          key={`${pass.id}-${l.product.id}-${i}`}
          data-pair={`${pass.id}-${l.product.id}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale100,
            paddingTop: theme.sizing.scale300,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto auto',
              alignItems: 'baseline',
              gap: theme.sizing.scale400,
              minWidth: 0,
            }}
          >
            {/* THE GOODS ARE AN OBJECT, SO THE NAME IS A DOOR (§43). «Why would their card be
                text and not hyperlinked. This isn't 2010 SAP.» Every product named on this sheet
                opens the product. */}
            <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>
              <Door
                onOpen={() => openProduct(l.product.id)}
                label={`Open ${l.product.name}`}
                testid={`pair-open-${pass.id}-${l.product.id}`}
              >
                <Name of={l.product} />
              </Door>
            </span>
            {/* THE TWO NUMBERS, SIDE BY SIDE. Each unit shares its own number's line, always. */}
            <span
              style={{
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentSecondary,
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}
            >
              asked {amount(l.asked)}&nbsp;{units(l.asked, l.askedUnit)}
            </span>
            <span
              style={{
                ...theme.typography.LabelMedium,
                whiteSpace: 'nowrap',
                textAlign: 'right',
                minWidth: theme.sizing.scale1600,
              }}
            >
              sent {amount(l.given)}&nbsp;{units(l.given, l.unit)}
            </span>
          </div>
          {l.note && (
            <span
              style={{
                display: 'flex',
                gap: theme.sizing.scale300,
                alignItems: 'flex-start',
                marginLeft: theme.sizing.scale600,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentSecondary,
                minWidth: 0,
              }}
            >
              <NoticedMark label="Suggested automatically" />
              {l.note}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── THE LIVE SALES, AS THE SAME KIND OF FACT ─────────────────────────────────────────────────
 * A sale on today's feed is an albarán of theirs like any other, so it belongs at the top of the
 * history and its lines belong in the fingerprint. `SaleLine` already carries `ordered` beside
 * `given` — the pairing is in the object, which is why this profile could be written at all.
 */
const passOfSale = (sale: Sale): Pass => ({
  id: sale.id,
  number: sale.number,
  day: sale.deliveryDay,
  lines: sale.lines.map((l) => ({
    product: l.product,
    asked: l.ordered,
    askedUnit: l.unit,
    given: l.given,
    unit: l.unit,
    note:
      l.given !== l.ordered
        ? `they asked for ${amount(l.ordered)} ${l.unit} · the delivery note carries ${amount(l.given)}`
        : undefined,
  })),
});

/* ── THE NUMBERS, AS A BLOCK ANY SURFACE CAN STAND (THE-DATA-CANON §2.3, §5.1) ────────────────
 * «The customer SHEET's «The numbers» embed gains the ink delta chip vs their own typical
 * (`basketOf().typical`) and a 32px sparkline of their months (`monthOf`). Their number on their
 * sheet; the house's number in the seat.» §2.3's projection, and the whole of it.
 *
 * ═══ THE WIREFRAME, BEFORE THE PIXELS (§51.24) ═════════════════════════════════════════════
 *
 * ┌─ THE NUMBERS ────────────────────────────────────────────────────────────────┐
 * │ HEAD   «The numbers» HeadingXSmall · METHOD LINE under it, ParagraphXSmall   │
 * │        secondary (§1.5): the window (their last N albaranes), the basis      │
 * │        (what is on today's feed for them) and the spark's own span, said     │
 * │        where the number is                                                   │
 * │                                                                             │
 * │ LEAD   LabelXSmall tertiary label                                           │
 * │        ┌──────────────────────┬────────────────────────────────────┐        │
 * │        │ Figure `large`       │ ▲/▼ 38 € vs. average       │        │
 * │        │ HeadingSmall,        │ LabelXSmall · contentSecondary ·   │        │
 * │        │ tabular, the unit    │ tabular · nowrap · INK, never a    │        │
 * │        │ INSIDE the number's  │ colour (§2.0.d — the glyph and the │        │
 * │        │ own line box         │ words carry the direction)         │        │
 * │        └──────────────────────┴────────────────────────────────────┘        │
 * │ SPARK  SIZE.sparkline (32px tall) LineChart, CURVE.linear, of their months  │
 * │        — no axis, because a spark is a shape; the method line above says    │
 * │        which months the shape runs over                                     │
 * │ BASE   one Row — «A usual albarán» + the figure the chip is measured        │
 * │        against, so the comparison is checkable where it is made             │
 * │                                                                             │
 * │ States: · MONTHS KNOWN — the spark stands                                   │
 * │         · A YEAR STILL TO ARRIVE — one affirmative sentence stands in its   │
 * │           place; a gap ships as a gap (§2.0.f), and a spark of one point is │
 * │           a dot pretending to be a trend                                    │
 * │         · A LEVEL MONTH — the chip stands down under a whole euro, because  │
 * │           «▲ 0 €» is a chip about nothing                                   │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * TWO LAWS THIS BLOCK IS HELD TO, both of them about restraint:
 *
 *   · COLOUR IS NOT A STATUS SYSTEM. The direction is a ▲ or a ▼ and the words beside it; the
 *     ink is the sheet's own `contentSecondary` at every step. A green number would be a second
 *     colour language running under the one the app already has.
 *   · THIS IS ARITHMETIC, SO IT IS PLAIN INK (§1.3). The saffron mark says «Rocoto read something
 *     into the record»; a mean of their own albaranes is counting, and marking it would dilute the
 *     accent that makes the readings next door trustworthy. No `NoticedMark` stands here.
 */
export function TheirNumbers({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const imported = useImport(cast.sector);

  /* THEIR MORNING, off the same fold every other surface reads (§0 — one record, one arithmetic). */
  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const live = React.useMemo(
    () => sales
      .filter((s) => s.customer.id === customer.id)
      .map((s) => ({ day: s.day, figure: s.figure })),
    [sales, customer.id],
  );

  const basket = React.useMemo(() => basketOf(cast, customer), [cast, customer]);
  const month = React.useMemo(
    () => monthOf(cast, customer, monthKeyOf(todayId(cast)), live),
    [cast, customer, live],
  );
  const months = React.useMemo(
    () => monthsFor(cast, customer, live, imported),
    [cast, customer, live, imported],
  );

  /* THE FIGURE IS §2.3'S OWN: the mean of what one of theirs came to, over the month that is open.
     The baseline is their own usual albarán across the record behind them — their number measured
     against their number, which is the only comparison that means anything on one account. */
  const average = month.albaranes > 0 ? month.figure / month.albaranes : 0;
  const move = Math.abs(average - basket.typical);
  const up = average >= basket.typical;
  /* THE CHIP SPEAKS IN WHOLE EUROS, the analysis layer's own money words — so it stands only where
     there is a whole euro to state. «▲ 0 €» is a chip about nothing, and a month that landed on
     their usual is a month whose reading is the figure itself. */
  const chip = basket.typical > 0 && month.albaranes > 0 && move >= 1;

  return (
    <Block
      testid="profile-numbers"
      title="Order summary"
      /* THE METHOD LINE (§1.5): the window and the basis, in words a stranger can check, standing
         where the number stands. The spark's own span is said here too, because a sparkline is a
         shape rather than a reading and carries no axis to say it — one sentence about provenance
         beats two labels pinned to a 96px shape. */
      lead={
        `${basket.albaranes} ${plural(basket.albaranes, 'delivery note', 'delivery notes')}`
        + (months.length > 1 ? ` · ${months[0].label}–${months[months.length - 1].label}` : '')
      }
    >
      <div
        data-lead="their-average"
        data-value={Math.round(average * 100) / 100}
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}
      >
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          Average order · this month
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: theme.sizing.scale300,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          {/* THE UNIT LIVES IN THE NUMBER'S OWN LINE BOX. `Figure` holds the lockup — nowrap and
              tabular on the root — and the wrapper carries both again so the law is readable off
              the element the drive measures, at 1600 and at 320. */}
          <span
            data-figure="their-average"
            style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', minWidth: 0 }}
          >
            <Figure value={average} unit="S/" size="large" />
          </span>
          {chip && (
            <span
              data-delta="their-typical"
              data-direction={up ? 'up' : 'down'}
              style={{
                ...theme.typography.LabelXSmall,
                color: theme.colors.contentSecondary,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {up ? '▲' : '▼'} {wholeSoles(move)} vs. average
            </span>
          )}
        </span>

        {/* THEIR MONTHS, AT 32px. `SIZE.sparkline` IS a size — 32 tall on Base's own scale, three
            times that wide — so it takes the width the kit gives it rather than stretching to the
            card. A spark is a shape, and a shape that resizes with its container is a different
            shape on every surface. */}
        {months.length > 1 ? (
          <div data-testid="their-months" style={{ position: 'relative', width: 'fit-content', minWidth: 0 }}>
            <LineChart
              size={CHART_SIZE.sparkline}
              title=""
              decimals={0}
              locale="es-ES"
              series={[{ name: 'Their months', data: months.map((m, x) => ({ x, y: m.value })) }]}
              curve={CURVE.linear}
            />
          </div>
        ) : (
          /* A GAP SHIPS AS A GAP (§2.0.f), and it is said affirmatively: what makes the shape
             appear, rather than what is missing. */
          <span
            data-testid="their-months-waiting"
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}
          >
            A trend shows once there is more history.
          </span>
        )}
      </div>

      {/* ── WHAT THE MONTH CAME TO, WHOLE (FEED-IA §137.1) ──────────────────────────────────
          THE ACCOUNT'S MONTH IS THE FIGURE THE BOOK PRINTS BESIDE THEIR NAME, and until §137
          folded the two customer surfaces into one it lived only on the Customers area's own
          «The numbers» block. The average above answers «how big is one of theirs»; this answers
          «how much have they taken», which is the question the row 200px away is already
          answering — and the two have to be one reading or the app has two opinions about one
          record (C2 · §60.3). Same `monthOf` fold, said once more where it now belongs. */}
      <Row
        testid="numbers-month"
        label="This month"
        sub={`${month.albaranes} ${plural(month.albaranes, 'delivery note', 'delivery notes')}`}
        value={<Figure value={month.figure} unit="S/" size="default" />}
      />

      {/* THE BASELINE, WHERE THE COMPARISON IS MADE — the chip says «vs. average», so the
          usual stands under it as a figure somebody can check. */}
      <Row
        testid="their-typical"
        label="Average order"
        sub={`${basket.albaranes} ${plural(basket.albaranes, 'delivery note', 'delivery notes')}`}
        value={<Figure value={basket.typical} unit="S/" size="compact" />}
      />
    </Block>
  );
}

/* ── CUSTOMER PRICING ──────────────────────────────────────────────────────────────────────────
 * A tariff is the default commercial agreement. A customer price is a later fact for one exact SKU
 * and one account. The controls below deliberately write through `tiers.ts`; there is no customer
 * price store, family price, or invisible percentage rule here.
 */
export function TheirTarifa({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  useTiers();
  const tiers = tiersOfHouse(cast);
  const [tierError, setTierError] = React.useState('');
  React.useEffect(() => setTierError(''), [customer.id]);
  const on = bandOf(cast, customer);
  const current = tiers.find((tier) => tier.id === on) ?? tiers[0];
  /* One tariff is not a customer choice. The surrounding block already says Pricing; only a
     multi-tariff house needs an assignment control here. */
  if (!current || tiers.length === 1) return null;

  return (
    <div
      data-testid="profile-tarifa"
      data-tier={on}
      style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}
    >
      <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}>
        Tariff
      </span>
      {/* ── E200.07 · THE BAND IS A LIVE FIELD (§196.1 «same for like other shit») ────────────
          A tariff is the house's own material and there can be many of them, so the seat is the
          same filtering combobox the product sheet's fields are, never a chip rail that a house
          with eight bands scrolls sideways. The register is closed — a tariff has prices behind
          it — so a word the house has not banded is declined rather than invented. */}
      <span style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 260 }}>
        <LiveField
          id="profile-tarifa"
          declineSays="Choose a tariff from the list."
          label="Tariff"
          hideLabel
          value={current.name}
          suggestions={tiers.map((tier) => ({ value: tier.name, id: tier.id }))}
          placeholder="Choose their tariff"
          allowNew={false}
          size="compact"
          inputTestid="profile-tarifa-current"
          listLabel="Tariffs this house keeps"
          onCommit={({ value, id }) => {
            const chosen = tiers.find((tier) => tier.id === id) ?? tiers.find((tier) => tier.name === value);
            if (!chosen) return 'Choose a tariff from the list.';
            if (chosen.id === on) return;
            if (!setCustomerTier(customer.id, chosen.id)) return 'Saving this tariff stalled. Keep this customer open and try again.';
            setTierError('');
          }}
        />
      </span>
      {tierError && <span role="alert" data-testid="customer-tariff-save-error" style={{ flexBasis: '100%', ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{tierError}</span>}
    </div>
  );
}

const money = (value: number): string =>
  value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A customer price is only ever selected from products, never from a family/category label. */
function CustomerPricePicker({
  isOpen,
  products,
  customer,
  onChoose,
  onClose,
}: {
  isOpen: boolean;
  products: Product[];
  customer: Customer;
  onChoose: (product: Product) => void;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const [query, setQuery] = React.useState('');
  React.useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);
  const shown = React.useMemo(() => {
    const words = query.trim().toLocaleLowerCase();
    return products
      .filter((product) => !words || `${product.name} ${product.code ?? ''}`.toLocaleLowerCase().includes(words))
      .slice(0, 12);
  }, [products, query]);

  return (
    <WorkflowDialog isOpen={isOpen} onClose={onClose} title="Set a product price" step={customer.name} ariaLabel={`Choose a product price for ${customer.name}`} actions={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose}>Cancel</Button>}>
      <div data-testid="customer-price-picker" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <Input
          value={query}
          onChange={(event) => setQuery((event.target as HTMLInputElement).value)}
          placeholder="Find a product or code"
          aria-label="Find a product or code"
          autoFocus
          overrides={{ Input: { props: { 'data-testid': 'customer-price-search', autoComplete: 'off' } } }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
          {shown.map((product) => (
            <Button
              key={product.id}
              kind={KIND.tertiary}
              size={SIZE.compact}
              data-testid={`customer-price-choose-${product.id}`}
              onClick={() => {
                onChoose(product);
                onClose();
              }}
              overrides={{ BaseButton: { style: { justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' } } }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: theme.sizing.scale100, minWidth: 0 }}>
                <span style={{ ...theme.typography.LabelSmall }}>{product.name}</span>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  {product.code ? `${product.code} · ` : ''}Unit {product.unit}
                </span>
              </span>
            </Button>
          ))}
          {shown.length === 0 && (
            <p data-testid="customer-price-no-match" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              Try another name or code.
            </p>
          )}
        </div>
      </div>
    </WorkflowDialog>
  );
}

function CustomerPriceEditor({
  cast,
  customer,
  product,
  day,
  at,
  onClose,
}: {
  cast: Cast;
  customer: Customer;
  product: Product | null;
  day: string;
  at: string;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const saveError = usePriceSaveError();
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    setValue('');
  }, [customer.id, product?.id]);
  if (!product) return null;

  const tariff = bandOf(cast, customer);
  const own = ownPriceOf(product, customer, day);
  /* This editor writes the underlying SKU agreement. A temporary account discount is resolved
     after it and must not be baked into the placeholder, or it would be applied twice on Save. */
  const standing = own?.price ?? priceOn(cast, product, tariff, day);
  const typed = Number(value.trim().replace(',', '.'));
  const ready = value.trim().length > 0 && Number.isFinite(typed) && typed > 0;
  const unit = priceUnitOf(product);

  return (
    <WorkflowDialog onClose={onClose} title="Customer price" step={customer.name} ariaLabel={`Set a price for ${product.name}`} actions={        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
          <Button
            kind={KIND.primary}
            size={SIZE.large}
            disabled={!ready}
            data-testid="customer-price-save"
            onClick={() => {
              if (setCustomerPrice({ product, customer, day, price: typed, at }).length) onClose();
            }}
            overrides={{ BaseButton: { style: { flex: '1 1 auto', whiteSpace: 'nowrap' } } }}
          >
            Save price
          </Button>
          <Button kind={KIND.tertiary} size={SIZE.large} data-testid="customer-price-cancel" onClick={onClose}>
            Cancel
          </Button>
        </div>}>
      <div data-testid="customer-price-editor" data-product={product.id} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0, maxWidth: 520, margin: '0 auto' }}>
        <div>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{product.name}</h2>
          <p style={{ margin: `${theme.sizing.scale200} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {product.code ? <><ProductCode code={product.code} /> · </> : ''}{tierNameOf(cast, tariff)}
          </p>
        </div>
        <label style={{ ...theme.typography.LabelSmall, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
          Unit price
        <Input
          size={INPUT_SIZE.large}
          value={value}
          autoFocus
          onChange={(event) => setValue((event.target as HTMLInputElement).value)}
          placeholder={money(standing)}
          aria-label={`Price for ${product.name}`}
          endEnhancer={<span style={{ ...theme.typography.LabelMedium, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{unit}</span>}
          overrides={{
            Input: {
              props: { 'data-testid': 'customer-price-input', inputMode: 'decimal', autoComplete: 'off' },
              style: { ...theme.typography.HeadingLarge, fontVariantNumeric: 'tabular-nums' },
            },
            EndEnhancer: { style: { whiteSpace: 'nowrap' } },
          }}
        />
        </label>
        <span data-testid="customer-price-context" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          Current {money(standing)} {unit} · {own ? `their price, set ${own.at}` : tierNameOf(cast, tariff)}
        </span>
        {saveError && (
          <p data-testid="customer-price-save-error" role="alert" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>
            {saveError}
          </p>
        )}

      </div>
    </WorkflowDialog>
  );
}

const addDays = (day: string, amount: number): string => {
  const date = dayFromId(day);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const discountState = (discount: CustomerDiscount, day: string): string => {
  if (discount.releasedOn && discount.releasedOn <= day) return `Released ${discount.releasedOn}`;
  if (discount.endsOn < day) return `Ended ${discount.endsOn}`;
  if (discount.startsOn > day) return `Starts ${discount.startsOn}`;
  return `Active until ${discount.endsOn}`;
};

/** A temporary discount is a scheduled agreement on the account. It is kept separate from the
 * tariff and SKU price so releasing it reveals the exact price that was there before. */
function CustomerDiscounts({ customer, day, at }: { customer: Customer; day: string; at: string }) {
  const [, theme] = useStyletron();
  useTiers();
  const history = discountHistoryOf(customer);
  const current = discountOn(customer, day);
  const upcoming = history.find((discount) => !discount.releasedOn && discount.startsOn > day && discount.endsOn >= day) ?? null;
  const agreement = current ?? upcoming;
  const [editing, setEditing] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [percent, setPercent] = React.useState('10');
  const [startsOn, setStartsOn] = React.useState(day);
  const [endsOn, setEndsOn] = React.useState(addDays(day, 30));
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setEditing(false);
    setShowHistory(false);
    setError('');
  }, [customer.id]);

  const parsed = Number(percent.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed < 100 && !!startsOn && !!endsOn && startsOn <= endsOn;
  const schedule = () => {
    if (!valid) {
      setError('Enter a percentage and a valid date range.');
      return;
    }
    const saved = scheduleCustomerDiscount({ customer, percent: parsed, startsOn, endsOn, createdOn: day, createdAt: at });
    if (!saved) {
      setError('Saving this discount stalled.');
      return;
    }
    setError('');
    setEditing(false);
  };

  return (
    <section data-testid="customer-discounts" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <span style={theme.typography.LabelSmall}>Temporary discount</span>
        <span style={{ display: 'inline-flex', gap: theme.sizing.scale200 }}>
          {history.length > 0 && (
            <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="customer-discount-history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>
              History
            </Button>
          )}
          {!editing && (
            <Button kind={KIND.secondary} size={SIZE.mini} data-testid="customer-discount-add" onClick={() => setEditing(true)}>
              {agreement ? 'Schedule another' : 'Add discount'}
            </Button>
          )}
        </span>
      </div>

      {agreement && !editing && (
        <div data-testid="customer-discount-current" data-discount={agreement.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale400, padding: theme.sizing.scale400, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, background: theme.colors.backgroundSecondary, minWidth: 0 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
            <span style={{ ...theme.typography.HeadingXSmall, fontVariantNumeric: 'tabular-nums' }}>{money(agreement.percent)}% off</span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{discountState(agreement, day)}</span>
          </span>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="customer-discount-release" onClick={() => { if (releaseCustomerDiscount(agreement.id, day, at)) setError(''); else setError('Releasing this discount stalled. Keep this customer open and try again.'); }}>
            Release
          </Button>
        </div>
      )}

      {error && !editing && <span role="alert" data-testid="customer-discount-release-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{error}</span>}

      {editing && (
        <div data-testid="customer-discount-editor" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, padding: theme.sizing.scale400, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 144px), 1fr))', gap: theme.sizing.scale300, minWidth: 0 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, ...theme.typography.LabelXSmall }}>
              Discount
              <Input value={percent} onChange={(event) => { setPercent((event.target as HTMLInputElement).value); setError(''); }} endEnhancer="%" aria-label="Discount percentage" overrides={{ Input: { props: { 'data-testid': 'customer-discount-percent', inputMode: 'decimal', autoComplete: 'off' } } }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, ...theme.typography.LabelXSmall }}>
              Starts
              <Input value={startsOn} onChange={(event) => { setStartsOn((event.target as HTMLInputElement).value); setError(''); }} aria-label="Discount start date" overrides={{ Input: { props: { 'data-testid': 'customer-discount-start', type: 'date' } } }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, ...theme.typography.LabelXSmall }}>
              Releases
              <Input value={endsOn} onChange={(event) => { setEndsOn((event.target as HTMLInputElement).value); setError(''); }} aria-label="Discount release date" overrides={{ Input: { props: { 'data-testid': 'customer-discount-end', type: 'date' } } }} />
            </label>
          </div>
          {error && <span role="alert" data-testid="customer-discount-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{error}</span>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="customer-discount-cancel" onClick={() => { setEditing(false); setError(''); }}>Cancel</Button>
            <Button kind={KIND.primary} size={SIZE.compact} disabled={!valid} data-testid="customer-discount-save" onClick={schedule}>Apply discount</Button>
          </div>
        </div>
      )}

      {showHistory && (
        <div data-testid="customer-discount-history" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {history.slice(0, 6).map((discount) => (
            <div key={discount.id} data-testid={`customer-discount-history-${discount.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: theme.sizing.scale300, padding: `${theme.sizing.scale300} 0`, borderTop: `1px solid ${theme.colors.borderOpaque}`, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, fontVariantNumeric: 'tabular-nums' }}>{money(discount.percent)}% off</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, textAlign: 'right' }}>{discountState(discount, day)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CustomerPricing({ cast, customer, sales }: { cast: Cast; customer: Customer; sales: Sale[] }) {
  const [, theme] = useStyletron();
  const tierState = useTiers();
  const catalogue = useCatalogue();
  const records = useSKURecords();
  const catalogueProducts = React.useMemo(() => [...cast.products, ...grownProducts(cast, OFF_LIST[cast.sector] ?? [], catalogue.state)].map(product => projectSKU(cast.sector, product, records)), [cast, catalogue.state, records]);
  const [allPrices, setAllPrices] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  React.useEffect(() => {
    setPicking(false);
    setEditing(null);
  }, [customer.id]);

  const day = todayId(cast);
  const products = React.useMemo(() => {
    const unique = new Map<string, Product>();
    for (const sale of sales) {
      for (const line of sale.lines) {
        if (!unique.has(line.product.id)) unique.set(line.product.id, line.product);
      }
    }
    /* A saved exception must remain reachable even if the SKU is not on today's live orders. */
    for (const product of catalogueProducts) {
      if (ownPriceOf(product, customer, day)) unique.set(product.id, product);
    }
    return [...unique.values()].filter(product => !!ownPriceOf(product, customer, day)).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogueProducts, customer, day, sales, tierState]);
  const choices = React.useMemo(() => {
    const unique = new Map<string, Product>(catalogueProducts.map((product): [string, Product] => [product.id, product]));
    for (const sale of sales) for (const line of sale.lines) unique.set(line.product.id, line.product);
    for (const product of products) unique.set(product.id, product);
    return [...unique.values()];
  }, [catalogueProducts, products, sales]);
  const tariff = bandOf(cast, customer);
  const accountDiscount = discountOn(customer, day);
  const at = nowOf(cast);

  return (
    <Block
      testid="customer-pricing"
      title="Pricing"
      aside={<Button kind={KIND.tertiary} size={SIZE.mini} data-testid="customer-tariffs" onClick={openTierRegistry}>Manage tariffs</Button>}
    >
      <TheirTarifa cast={cast} customer={customer} />
      <CustomerDiscounts customer={customer} day={day} at={at} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
        <span style={theme.typography.LabelSmall}>Price overrides</span>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          An override replaces this customer’s tariff for that product.
        </span>
        {products.length > 0 ? (
          <div data-testid="customer-price-list" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
            {(allPrices ? products : products.slice(0, 4)).map((product) => {
              const own = ownPriceOf(product, customer, day);
              const price = priceFor(cast, product, customer, day);
              return (
                <div key={product.id} data-testid={`customer-price-${product.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: theme.sizing.scale100, minWidth: 0 }}>
                    <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => openProduct(product.id)} overrides={{ BaseButton: { style: { paddingLeft: 0, paddingRight: 0, minHeight: 0, justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal' } } }}>
                      {product.name}
                    </Button>
                    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                      {money(price)} {priceUnitOf(product)} · {accountDiscount ? `${money(accountDiscount.percent)}% temporary discount` : own ? 'Their price' : tierNameOf(cast, tariff)}
                    </span>
                  </span>
                  <Button kind={KIND.secondary} size={SIZE.mini} data-testid={`customer-price-edit-${product.id}`} onClick={() => setEditing(product)}>
                    {own ? 'Edit price' : 'Set price'}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p data-testid="customer-price-empty" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            Tariff prices.
          </p>
        )}
        {products.length > 4 && <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="customer-price-show-all" aria-expanded={allPrices} onClick={() => setAllPrices(!allPrices)}>{allPrices ? 'Show fewer' : `Show all ${products.length} prices`}</Button>}
        <span>
          <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="customer-price-another" onClick={() => setPicking(true)}>
            {products.length > 0 ? 'Set another product price' : 'Set a product price'}
          </Button>
        </span>
      </div>
      <CustomerPricePicker
        isOpen={picking}
        products={choices}
        customer={customer}
        onChoose={setEditing}
        onClose={() => setPicking(false)}
      />
      <CustomerPriceEditor
        cast={cast}
        customer={customer}
        product={editing}
        day={day}
        at={at}
        onClose={() => setEditing(null)}
      />
    </Block>
  );
}

/* ── A DAY, IN BOTH OF THE APP'S FORMS ────────────────────────────────────────────────────────
 * World B writes `dd.mm` (the trade's own, and what `historyOf` hands back) and World A writes
 * `2025-08-22`. `monthKeyOf` in `knows.ts` is the precedent: ONE READER, BOTH FORMS, because a
 * fold that understands only one of them silently counts half the record. A history date belongs
 * to the cast's calendar, not the browser clock: the same rule `knows.ts` uses for its history
 * reader. That keeps a current live ISO date and an older `dd.mm` record on one actual timeline.
 */
const dateOfDay = (day: string, cast: Cast): Date => {
  if (day.includes('-')) return dayFromId(day);
  const [dd, mm] = day.split('.').map(Number);
  return new Date(dayFromId(todayId(cast)).getFullYear(), (mm || 1) - 1, dd || 1);
};

/** «22.08» — the trade's own way of writing a day, and the only one an axis on this sheet prints. */
const shortOfDay = (day: string, cast: Cast): string => {
  const d = dateOfDay(day, cast);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* ── HOW MUCH THEY ORDER (§115.4) ─────────────────────────────────────────────────────────────
 * «The line chart isn't about their order days, but about their HISTORICAL ORDERING VOLUME (last
 * month, last year, or something).»
 *
 * Round 1 drew the WEEK their albaranes land on — a true fact, and the answer to a question about
 * rhythm on a block whose subject is HOW MUCH. This draws the volume, and it takes his two windows
 * as the two windows: THIS MONTH, albarán by albarán, and THE YEAR, month by month.
 *
 * TWO WINDOWS, TWO METHOD LINES (§63). A window is the whole of what a figure means, so switching
 * it rewrites the sentence under the title rather than leaving one caption to cover both.
 *
 * THE YEAR IS OFFERED ONLY WHERE THERE IS ONE. `monthsFor` is empty until a year is imported, and
 * a chip that switches to an empty chart is a control that lies about what pressing it does.
 *
 * IT IS THE KIT'S OWN CHART (§5.1), lifted rather than redrawn: one series, no palette, the
 * `compact` step of the chart kit's own paper scale, `es-ES` like every other figure here.
 */
type Span = 'month' | 'year';

export function TheirVolume({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const imported = useImport(cast.sector);
  const [span, setSpan] = React.useState<Span>('month');

  /* THE SAME RECORD EVERY OTHER BLOCK ON THIS SHEET READS: the year behind them, plus what is on
     today's feed for them — a morning's albarán is an albarán of theirs like any other. */
  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const live = React.useMemo(
    () => sales
      .filter((s) => s.customer.id === customer.id)
      .map((s) => ({ day: s.day, figure: s.figure })),
    [sales, customer.id],
  );

  /** THIS MONTH, ALBARÁN BY ALBARÁN, oldest first — what each one they took this month came to. */
  const month = React.useMemo(() => {
    const key = monthKeyOf(todayId(cast));
    return [
      ...historyOf(cast, customer).map((a) => ({ day: a.day, figure: a.figure })),
      ...live,
    ]
      .filter((a) => monthKeyOf(a.day) === key)
      .sort((a, b) => dateOfDay(a.day, cast).getTime() - dateOfDay(b.day, cast).getTime());
  }, [cast, customer, live]);

  /** THE YEAR, MONTH BY MONTH — §2.3's own projection, the fold `TheirNumbers` reads too. */
  const months = React.useMemo(
    () => monthsFor(cast, customer, live, imported),
    [cast, customer, live, imported],
  );

  const hasYear = months.length > 1;
  const on: Span = hasYear ? span : 'month';
  const points = on === 'year'
    ? months.map((m, x) => ({ x, y: m.value }))
    : month.map((a, x) => ({ x, y: a.figure }));
  const labels = on === 'year' ? months.map((m) => m.label) : month.map((a) => shortOfDay(a.day, cast));

  return (
    <Block
      testid="profile-volume"
      title="Order value"
      /* THE METHOD, WHERE THE SHAPE IS (§63) — and it changes with the window, because the window
         is the whole of what the shape means. */
      lead={
        on === 'year'
          ? `Monthly · ${months[0]?.label}–${months[months.length - 1]?.label}`
          : `This month · ${month.length} ${plural(month.length, 'delivery note', 'delivery notes')}`
      }
      aside={hasYear ? (
        <span data-testid="volume-window" data-span={on} style={{ flex: '0 0 auto' }}>
          <ButtonGroup
            mode={GROUP_MODE.radio}
            size={SIZE.mini}
            kind={KIND.secondary}
            selected={on === 'year' ? 1 : 0}
            onClick={(_e, i) => setSpan(i === 1 ? 'year' : 'month')}
            aria-label="How far back the shape runs"
          >
            <Button data-testid="volume-window-month" overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}>
              This month
            </Button>
            <Button data-testid="volume-window-year" overrides={{ BaseButton: { style: { whiteSpace: 'nowrap' } } }}>
              The year
            </Button>
          </ButtonGroup>
        </span>
      ) : undefined}
    >
      {points.length > 1 ? (
        <div data-testid="volume-chart" data-span={on} data-points={points.length} style={{ minWidth: 0 }}>
          <LineChart
            size={CHART_SIZE.compact}
            title=""
            decimals={2}
            locale="es-ES"
            unit="S/"
            series={[{ name: on === 'year' ? 'Their months' : 'This month', data: points }]}
            curve={CURVE.linear}
            formatX={(value) => labels[Math.round(value)] ?? ''}
          />
        </div>
      ) : (
        /* A GAP SHIPS AS A GAP (§2.0.f), said affirmatively: what makes the shape appear. */
        <p
          data-testid="volume-waiting"
          style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}
        >
          A second delivery note this month draws the shape.
        </p>
      )}
    </Block>
  );
}

/* ── «SHOW MORE», WITH ITS CHEVRON (§115.4) ───────────────────────────────────────────────────
 * «There should be a "Show more" button with a chevron.»
 *
 * ONE CONTROL, wherever a list on this sheet is longer than the seat its block gives it. It draws
 * NOTHING when everything already fits: a control that would expand nothing is a control that lies
 * about what pressing it does, and an always-present «Show 0 more» is furniture.
 *
 * THE WORDS SAY WHAT IS THERE, never what is hidden (the no-negatives law): «Show 3 more», then
 * «Show less». The chevron is line work in `currentColor` and it turns on the app's own timing;
 * a person who asked for less motion gets it already turned.
 */
function ShowMore({
  open,
  more,
  onToggle,
  testid,
}: {
  open: boolean;
  more: number;
  onToggle: () => void;
  testid: string;
}) {
  const [, theme] = useStyletron();
  const still = useStill();
  /* the foot of a list is a press, and on a phone a press is 44px tall (INTX-12 · E193.14) */
  const floor = usePhoneFloorHeight();
  if (more <= 0) return null;
  return (
    <button
      type="button"
      data-testid={testid}
      data-open={open ? 'yes' : 'no'}
      data-more={more}
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        ...floor,
        /* ── CENTERED, APP-WIDE (§127.4a: «as it is in top companies») ────────────────────────
           It was left-aligned, which put it in the LABEL column — so it read as one more row of
           the list it ends, and a person scanning names hit a control. Centered, it stops being a
           row and becomes what it is: the foot of the list, the one thing under it, on the axis
           the list itself is symmetric about. This is the app's ONE «Show more», so centering it
           here centers every one of them. */
        justifyContent: 'center',
        gap: theme.sizing.scale300,
        padding: `${theme.sizing.scale400} 0 ${theme.sizing.scale200}`,
        border: 'none',
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        background: 'transparent',
        color: theme.colors.contentSecondary,
        ...theme.typography.LabelMedium,
        cursor: 'pointer',
        minWidth: 0,
        width: '100%',
        textAlign: 'center',
      }}
    >
      {open ? 'Show less' : `Show ${more} more`}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          transform: open ? 'rotate(180deg)' : 'none',
          transitionProperty: still ? undefined : 'transform',
          transitionDuration: still ? undefined : theme.animation.timing400,
          transitionTimingFunction: still ? undefined : theme.animation.easeOutCurve,
        }}
      >
        <path d="m7 10 5 5 5-5" />
      </svg>
    </button>
  );
}

/** HOW MANY ROWS A BLOCK SEATS BEFORE THE CHEVRON EARNS ITS PLACE. Four is a list a person reads
 *  in one pass and still short enough that the block under it is on the same screen. */
const SEAT = 4;

/* ── THE USUAL ORDER, AS A LEADERBOARD (§111.6 · §115.4) ──────────────────────────────────────
 * «Usual order as a leaderboard or some shit» — and then, in round 2: «the bar chart of their
 * usual order is silly to have when the leaderboard ALREADY SHOWS the different progress or the
 * different standing.»
 *
 * He is right and the bar was the round-1 mistake: a leaderboard's magnitude is its ORDER. The
 * rank number says which is biggest, the count says by how much, and a bar under every row drew
 * the same fact a third time in a shape that made three near-equal accounts look dramatic. So the
 * row is rank · face · name · «4 of 5» · the quantity one of theirs carries, on the right where a
 * product-level row's figure belongs (§84).
 *
 * TWO FOLDS, ONE RECORD. `frequentOf` owns the ORDER and the count (it is the fold the composer's
 * own favourites list reads, so the sheet and the picker rank one account identically); `basketOf`
 * owns the quantity behind each line. Both read `historyOf` on the same customer, so nothing here
 * is a second arithmetic — the join is by product id and the numbers are the ones already folded.
 */
export function TheirUsualOrder({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  /* Four is a memory jog, not a second catalogue. The complete product record stays one press
     away through every tile's product door. */
  const frequent = React.useMemo(() => frequentOf(cast, customer, 4), [cast, customer]);
  const basket = React.useMemo(() => basketOf(cast, customer), [cast, customer]);
  const lines = React.useMemo(() => new Map(basket.lines.map((line) => [line.product.id, line])), [basket]);

  const window = frequent.rows[0]?.of ?? 0;
  return <section data-testid="profile-usual" aria-label="Frequent products" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400, minWidth: 0 }}>
      <span style={theme.typography.LabelMedium}>Frequent products</span>
      {frequent.rows.length > 0 && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>Last {window} {plural(window, 'delivery note', 'delivery notes')}</span>}
    </div>
    {frequent.rows.length === 0 ? <p data-testid="usual-waiting" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Frequent products show here</p> :
      <div data-testid="profile-usual-grid" style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: theme.sizing.scale300, minWidth: 0 }}>
        {frequent.rows.map((row, index) => {
          const line = lines.get(row.id);
          const per = line && line.albaranes > 0 ? Math.round((line.qty / line.albaranes) * 10) / 10 : 0;
          return <Button key={row.id} kind={KIND.secondary} size={SIZE.compact} data-testid={`usual-${row.id}`} data-rank={index + 1} data-carried={row.count}
            aria-label={`Open ${row.phrase}`} onClick={() => openProduct(row.id)}
            overrides={{ BaseButton: { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: theme.sizing.scale300, minWidth: 0, height: 'auto', padding: theme.sizing.scale400, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200, background: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, textAlign: 'left' } } }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0, width: '100%' }}>
              {line ? <ProductFace of={line.product} size={32} /> : <span style={{ width: 32, height: 32 }} />}
              <span style={{ ...theme.typography.LabelSmall, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{row.phrase}</span>
            </span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>{per ? `${per} ${line?.unit}` : 'Quantity pending'} · {row.count}/{row.of}</span>
          </Button>;
        })}
      </div>}
  </section>;
}

/* ── WHAT ROCOTO KNOWS, AS A PAIR OF BLOCKS ANY SURFACE CAN STAND (FEED-IA §37.6) ─────────────
 * «CUSTOMERS get the same: their own surface… the customer's main sheet as the preview.» That
 * sheet owes the same two blocks this overlay owes — the observations, and the menu read off
 * somebody else's page — and a second drawing of them would be the fastest way to make one
 * customer look like two customers depending on which door you came through.
 *
 * So the blocks are a component and the overlay is one of its callers. The TESTIDS ARE THE SAME
 * ON BOTH, deliberately: `profile-noticed` is «the observations about this customer», not «the
 * observations inside the overlay», and the two surfaces never stand at once.
 */
export function WhatRocotoKnows({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const knows = useKnows(cast);
  const noticed = React.useMemo(
    () => aboutCustomer(knows, customer.id).filter((o) => o.kind !== 'menu'),
    [knows, customer.id],
  );

  return (
    <Block
      testid="profile-noticed"
      title="Patterns"
      /* NO LEAD (THE-CONTENT-CANON §4 — kill the slot). The title names the block, the aside
         counts the patterns, and every pattern below states itself. The sentence narrated them. */
      aside={
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          {noticed.length} {plural(noticed.length, 'pattern')}
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        {noticed.map((o) => (
          <Noticed key={o.id} observation={o} />
        ))}
      </div>
    </Block>
  );
}

/* ── THEIR MENU, AS AN OBJECT (FEED-IA §42.3) ─────────────────────────────────────────────────
 * «THEIR MENU is a top-level OBJECT — that's what it is — and a menu CHANGE is an event that goes
 * INTO it.»
 *
 * That sentence is a correction of what stood here: a loose «Their menu changed» card in a list of
 * observations, which made the EVENT the subject and left the thing it was an event about
 * unrepresented. A restaurant's carte is a real object about a real customer — it is the reason
 * they buy what they buy — so the sheet holds the menu, and the change sits inside it under its own
 * heading, with the same Google attribution it always carried.
 *
 * AND A MENU NOBODY HAS READ IS A THING TO DO, NEVER A BLANK. «Getting their menu is a standard
 * feature Rocoto runs once.» So the unread state states the capability and offers the act; pressing
 * it reads the menu and the object appears (`readMenu` in `knows.ts`). Nothing here renders a
 * control that does nothing, and nothing here says what is missing — it says what Rocoto does.
 */
export function TheirMenu({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const knows = useKnows(cast);
  const alsoRead = useMenusRead(cast.sector);
  const menu = menuOf(cast, customer, alsoRead);
  const change = menuChangeOf(knows, customer.id);

  if (!menu) {
    return (
      <Block
        testid="profile-menu"
        title="Menu"
        lead="Public menu"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale500,
            flexWrap: 'wrap',
            paddingTop: theme.sizing.scale300,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            minWidth: 0,
          }}
        >
          <span
            data-testid="menu-fetchable"
            style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, flex: 1, minWidth: 0 }}
          >
            Their menu, read from their website.
          </span>
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            data-testid="read-menu"
            onClick={() => readMenu(cast.sector, customer.id)}
          >
            View menu
          </Button>
        </div>
      </Block>
    );
  }

  return (
    <Block
      testid="profile-menu"
      title="Menu"
      aside={<GoogleMark found={menu.read} />}
      /* ── THE LEAD IS GONE (AUDIT-2 C31 · content canon §8 · §3) ────────────────────────────
         It read «The 6 dishes on their carte, and what has changed on it.» — a lead narrating its
         own rows, over a list of six dishes with the changed ones marked. §8's rule is exact: a
         lead that narrates its rows is deleted. The block's title says what it is; the rows say
         what is on it; the Google mark beside them says where it was read and when. */
    >
      <ul
        data-testid="menu-dishes"
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {menu.dishes.map((d) => (
          <li
            key={d.name}
            data-dish={d.name}
            style={{
              paddingTop: theme.sizing.scale300,
              paddingBottom: theme.sizing.scale300,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              ...theme.typography.LabelMedium,
              minWidth: 0,
            }}
          >
            {d.name}
          </li>
        ))}
      </ul>

      {/* THE CHANGE IS AN EVENT INSIDE THE OBJECT, and it says so by standing under the carte
          rather than beside it — same observation, same evidence, same saffron mark. */}
      {change && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span
            style={{
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              paddingTop: theme.sizing.scale500,
            }}
          >
            What changed
          </span>
          <Noticed observation={change} testid="menu-observation" />
        </div>
      )}
    </Block>
  );
}

/* ── THEIR ORDER HISTORY (§111.9) ─────────────────────────────────────────────────────────────
 * «Should show the faded ghosted things below and above mainly?? Why doesn't it show the name of
 * the customer and the date divider? I ONLY JUST FIGURED OUT THAT IT'S ABOUT ONE CUSTOMER. Why
 * don't you put the name of the customer and then you put order history?»
 *
 * Three things, and the last sentence is the construction:
 *
 *   THE NAME LEADS      the block's own heading says WHOSE record this is and then what it is —
 *                       «Can Solé · Order history» — so the block carries its own subject wherever
 *                       it is mounted, instead of borrowing it from whatever stands above.
 *   A DATE DIVIDER      the rows group under the month they fall in, in the same left-aligned
 *                       uppercase grammar the fulfilment fingerprint's own group label uses, with
 *                       a hairline running out to the edge so it reads as a divider and not a row.
 *   GHOSTED ABOVE AND   one row is being read and the rest step back — full ink on it, then 0.6,
 *   BELOW               then a 0.42 floor. Pointing at or tabbing to a row makes it the one being
 *                       read, so the eye lands where the hand is.
 *
 * THE GHOSTING IS HIERARCHY, NOT MOTION, so `prefers-reduced-motion` keeps it and drops only the
 * travel between states — a fade is what the eye follows; a jump is what it survives.
 *
 * AND THE ALBARÁN'S NUMBER IS A DOOR (§43), for the ones there is an order to open: today's are
 * live sales and `openOrder` lands on them. THE YEAR BEHIND THEM IS NOT YET AN OBJECT — `historyOf`
 * mints a `PastAlbaran` whose id is `${customer.id}-${k}` and no area registers a landing for it —
 * so those numbers stay ink rather than becoming doors that knock on nothing.
 */
/* ── THE RULE A DECISION WAS MADE BY (§106's derivation grammar) ──────────────────────────────
 * The card's second region is the METHOD LINE: the rule, stated where a stranger can hold the
 * record to it. These are the four the machine actually decides by (`policyOf`), written as the
 * sentences a person can check rather than as the machine's own four words — no reader of this
 * app ever sees ACT · CLARIFY · HOLD · HANDOFF (§10.10 · §72.3).
 *
 * THEY ARE THE RULE, NOT A RESTATEMENT OF THE OUTCOME. «Rocoto held it» is what happened, and it
 * is already on the row; what belongs here is WHY THAT IS THE RULE — the clause in canon §2.4 that
 * this document met. A method line that repeats the outcome explains nothing and is the exact slot
 * THE-CONTENT-CANON deletes.
 */
/* ── THE RULE A DECISION WAS MADE BY (§106's derivation grammar) ──────────────────────────────
 * The card's second region is the METHOD LINE: the rule, stated where a stranger can hold the
 * record to it. These are the four the machine actually decides by (`policyOf`), written as the
 * sentences a person can check rather than as the machine's own four words — no reader of this
 * app ever sees ACT · CLARIFY · HOLD · HANDOFF (§10.10 · §72.3).
 *
 * THEY ARE THE RULE, NOT A RESTATEMENT OF THE OUTCOME. «Rocoto held it» is what happened, and it
 * is already on the row; what belongs here is WHY THAT IS THE RULE — the clause in canon §2.4 that
 * this document met. A method line that repeats the outcome explains nothing and is the exact slot
 * THE-CONTENT-CANON deletes.
 */
/** THE DOCUMENT'S OWN NUMBER, for the card's title. A live sale carries one once it is made; a
 *  past albarán always has one. Absent on a sale still being formed — which is honest: it has no
 *  number yet, and inventing one for a heading would be the app naming a document that does not
 *  exist. */
const numberOf = (
  id: string,
  live: Array<{ id: string; number: string; state: string }>,
  past: Array<{ id: string; number: string }>,
): string | undefined =>
  past.find((a) => a.id === id)?.number
  ?? (() => { const s = live.find((x) => x.id === id); return s && RANK[s.state as never] >= RANK.made ? s.number : undefined; })();

const RULE_OF: Record<PolicyId, string> = {
  act: 'Can send automatically when every line and price is ready.',
  clarify: 'Ask the customer when one missing fact would resolve the order.',
  hold: 'Held for an unreadable line, missing price, or change after printing.',
  handoff: 'Needs a person: a complaint, credit decision, or missing price.',
};

function UpcomingOrders({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const upcoming = sales.filter((s) => s.customer.id === customer.id && !s.archived && s.day >= todayId(cast) && s.state !== 'sent').sort((a, b) => a.day.localeCompare(b.day));
  return <section data-testid="customer-upcoming" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
    <h3 style={{ margin: 0, ...theme.typography.LabelLarge }}>Upcoming</h3>
    {upcoming.length ? <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {upcoming.map((sale) => <OrderListCard
        key={sale.id}
        testid={`customer-upcoming-order-${sale.id}`}
        label={sale.number ? `Delivery Note ${sale.number}` : `Order for ${sale.deliveryDay}`}
        sub={`${sale.deliveryDay} · ${sale.lines.length} ${plural(sale.lines.length, 'line')}`}
        waiting={waitingOnAPerson(sale)}
        onOpen={() => openOrder(sale.id)}
      />)}
    </div> : <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Upcoming delivery notes show here</span>}
  </section>;
}

export function OrderHistory({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const still = useStill();
  const { pricing, country } = useWorkspaceCapabilities();
  const valued = capabilityAvailable('albaranValues') && pricing;
  const edits = useDay(cast.sector);
  const grants = useGrants();

  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const theirs = React.useMemo(
    () => sales.filter((s) => s.customer.id === customer.id),
    [sales, customer.id],
  );
  const past = React.useMemo(() => historyOf(cast, customer), [cast, customer]);

  /* THE ROW BEING READ. Null means «the newest one», so the block lands with the top of the list
     in full ink rather than with nothing chosen and everything flat. */
  const [reading, setReading] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    const live = theirs.map((s) => {
      const made = RANK[s.state] >= RANK.made;
      const policy = policyOf(s);
      return {
        id: s.id,
        /* ── THE TWO TENSES ON ONE LIST (§127.3) ──────────────────────────────────────────────
           «It is the anxiety card AGED: on live work the anxiety asks for an act; on history it
           only explains. Same object, two tenses.» This block holds both — today's feed at the
           top, the year behind it below — so it is the one surface where the difference has to be
           drawn rather than assumed.
           WAITING is the red claim, and only §127.3's two blocks raise it (`waitingOnAPerson`).
           WHY is the reasoning door, and it stands wherever Rocoto DECIDED something — which on a
           live row is «here is what I am anxious about» and on a settled one is «here is what I
           did, and the rule I did it by». */
        /* THE ROW'S NAME IN PLAIN WORDS. `label` is a NODE — a door, on the live rows — so it
           cannot be read into a sentence, and the reasoning door's own question came out as
           «…did that with this one». A question that cannot name its subject is the app asking
           the reader to guess which row they are about to open (the self-comprehension test,
           applied to an aria-label). */
        name: made ? `delivery note ${s.number}` : `their order for ${s.deliveryDay}`,
        /* WHICH TENSE THIS ROW IS IN, said out loud. §127.3's whole claim is that the two tenses
           differ — the anxiety asks on live work and only explains on the record — so which one a
           row is in is a fact ABOUT the row and not an implementation detail of the list. It is
           declared here so a reader outside the component can hold the claim to it: red never
           decorates resolved history, and that is checkable only where the record says it is the
           record. */
        tense: 'live' as const,
        waiting: waitingOnAPerson(s),
        why: policy.id === 'act' && !policy.withheld ? null : {
          says: policy.says,
          rule: RULE_OF[policy.id],
          withheld: policy.withheld,
          /* THE RECORD THE RULE WAS APPLIED TO, which is this document's own lines (§106). It is
             taken as LINES rather than as the sale, so the record's rows below can hand over their
             own lines in the same shape and the card never has to know which tense it is in. */
          lines: s.lines.map((l) => ({
            id: l.id,
            product: l.product.id,
            label: l.product.name,
            /* ⚠ THE GRADE RODE THIS SUB-LINE UNTIL FEED-IA §197.2 «Remove class everywhere». */
            sub: `${amount(l.given)} ${units(l.given, l.unit)}`,
          })),
        },
        month: monthKeyOf(s.day),
        /* A ROW NEVER SAYS ONE FACT TWICE. A sale with no document yet is named by what it is
           made of, so the line count belongs in the label and the sub-line carries the hour and
           the state instead of repeating it. */
        label: made
          ? `Delivery Note ${s.number}`
          : `${s.lines.length} ${plural(s.lines.length, 'line')} for ${s.deliveryDay}`,
        sub: made
          ? `${s.deliveryDay} · ${s.lines.length} ${plural(s.lines.length, 'line')} · ${s.state}`
          : `${s.state} · ${s.at} · ${s.customer.channel}`,
        figure: s.figure,
      };
    });
    const behind = past.map((a) => ({
      id: a.id,
      month: monthKeyOf(a.day),
      label: `Delivery Note ${a.number}` as React.ReactNode,
      sub: `${a.day} · ${a.lines.length} ${plural(a.lines.length, 'line')}${a.dispute ? ' · they queried this one' : ''}`,
      figure: a.figure,
      /* THE RECORD IS RESOLVED BY CONSTRUCTION — it is in the history because it happened — so it
         never carries the red claim (§127.3: «never decorates resolved history»). The function is
         called rather than a `null` written, so the law is readable at the call site. */
      name: `delivery note ${a.number}`,
      tense: 'record' as const,
      waiting: waitingOnHistory(),
      /* AND IT STILL EXPLAINS. A queried albarán is the clearest case of «understand why you did
         that»: it went out, the customer came back on it, and the reasoning is what a person wants
         months later. A quiet document has nothing to explain and carries no door. */
      why: a.dispute ? {
        /* THE MESSAGE IS THEIRS, NOT A SENTENCE ABOUT IT (§127.1's first beat). It read «They
           queried albarán 2208-114.» — the app telling the reader what is written on the row they
           just pressed, while the words the customer actually used sat one fold away. The card
           leads with what was said, and the number is already in the title. */
        says: a.dispute.because,
        rule: RULE_OF.hold,
        withheld: undefined,
        /* ⚠ AND THE HOUSE'S OWN RECORD IS WALKED THROUGH IT. This handed the card `sale:
           undefined` — there is no `Sale` behind a past albarán — so the derivation card on a
           disputed record opened with a rule line and NOTHING under it: «here is the rule I
           decided by» and not one row of the document it was decided on, which is the half §106's
           grammar exists for. The past albarán HAS its lines; they are what went out, and where
           what went out differed from what was asked, §1's own note says so. That is the walk. */
        lines: a.lines.map((l) => ({
          id: `${a.id}-${l.product.id}`,
          product: l.product.id,
          label: l.product.name,
          sub: `${amount(l.given)} ${units(l.given, l.unit)}${l.note ? ` · ${l.note}` : ''}`,
        })),
      } : null,
    }));
    return [...live, ...behind];
  }, [theirs, past]);

  /** WHICH ROW'S REASONING IS OPEN. One at a time, named by the row's own id (§63 · C18). */
  const [why, setWhy] = React.useState<string | null>(null);

  /* THE SEAT, AND THE CHEVRON UNDER IT (§115.4). The block shows a readable window of the record
     and says how much more there is; everything is still in the history. */
  const [open, setOpen] = React.useState(false);
  const seen = open ? rows : rows.slice(0, SEAT);

  /* HOW FAR THE INK FALLS AWAY FROM THE ROW BEING READ. Three steps and a floor: the neighbours
     stay legible, so the ghosting is a focus and never a hiding. It is measured against WHAT IS
     ON SCREEN, so collapsing the list cannot leave the lit row outside the seat. */
  /** THE ROW THE DIVE IS ABOUT, resolved once — the card reads it rather than being handed a
   *  copy, so a row that leaves the list cannot leave a card standing over nothing. */
  const openWhy = React.useMemo(() => {
    const row = rows.find((r) => r.id === why);
    return row && row.why ? { id: row.id, why: row.why, name: row.name } : null;
  }, [rows, why]);

  const GHOST = [1, 0.9, 0.8];
  const at = Math.max(0, seen.findIndex((r) => r.id === (reading ?? seen[0]?.id)));
  const inkOf = (i: number) => GHOST[Math.min(GHOST.length - 1, Math.abs(i - at))];

  let month = '';

  return (
    <Block
      testid="profile-history"
      /* HIS OWN CONSTRUCTION: the name, and then order history. */
      title={`${customer.name} · History`}
      aside={
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
          {rows.length} {plural(rows.length, 'delivery note', 'delivery notes')}
        </span>
      }
    >
      <div
        onMouseLeave={() => setReading(null)}
        style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}
      >
        {seen.length === 0 ? (
          <p data-testid="history-empty" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            Past delivery notes show here
          </p>
        ) : seen.map((row, i) => {
          const opens = row.month !== month;
          month = row.month;
          return (
            <React.Fragment key={row.id}>
              {opens && (
                <div
                  data-testid={`history-month-${row.month}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.sizing.scale400,
                    paddingTop: i === 0 ? 0 : theme.sizing.scale600,
                    paddingBottom: theme.sizing.scale200,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      ...theme.typography.LabelXSmall,
                      color: theme.colors.contentTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      flex: '0 0 auto',
                    }}
                  >
                    {monthLabelOf(row.month)}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'block',
                      flex: '1 1 auto',
                      minWidth: 0,
                      height: '1px',
                      background: theme.colors.borderOpaque,
                    }}
                  />
                </div>
              )}
              <div
                data-testid={`history-${row.id}`}
                data-tense={row.tense}
                data-reading={i === at ? 'yes' : 'no'}
                onMouseEnter={() => setReading(row.id)}
                onFocus={() => setReading(row.id)}
                style={{
                  paddingBottom: theme.sizing.scale300,
                  opacity: inkOf(i),
                  transitionProperty: still ? undefined : 'opacity',
                  transitionDuration: still ? undefined : theme.animation.timing400,
                  transitionTimingFunction: still ? undefined : theme.animation.easeOutCurve,
                  minWidth: 0,
                }}
              >
                <OrderListCard
                  testid={`history-open-${row.id}`}
                  dotTestid={`history-dot-${row.id}`}
                  label={row.label}
                  sub={row.sub}
                  current={i === at}
                  waiting={row.waiting}
                  value={valued ? <Figure value={row.figure} unit="S/" size="compact" /> : undefined}
                  onOpen={() => openOrder(row.id)}
                  onRead={() => setReading(row.id)}
                />
                {row.why && (
                  <span style={{ display: 'flex', padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale200}` }}>
                    <ReasoningDoor
                      testid={`history-why-${row.id}`}
                      label={`Review evidence for ${row.name}`}
                      onOpen={() => setWhy(row.id)}
                    />
                  </span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <ShowMore
        testid="history-more"
        open={open}
        more={rows.length - SEAT}
        onToggle={() => setOpen((was) => !was)}
      />

      {/* ── THE DIVE (§127.3 · §106) ────────────────────────────────────────────────────────
          «It opens the same dive: the rule line, then the house's own record walked through it.»
          Same card Your data opens on an accuracy count — lifted, not redrawn. The WALK is this
          document's own lines, which is the record the rule was applied to; where Rocoto prepared
          a reply and withheld it, that stands as the first step, because it is the part of the
          reasoning a person cannot see anywhere else. */}
      {openWhy && (
        <DerivationCard
          isOpen
          onClose={() => setWhy(null)}
          title={`Evidence · ${openWhy.name}`}
          says={openWhy.why.says}
          rule={openWhy.why.rule}
          testid="history-reasoning"
          ruleTestid={`history-rule-${openWhy.id}`}
          walk={[
            ...(openWhy.why.withheld
              ? [{
                id: `${openWhy.id}-withheld`,
                label: 'Draft reply',
                sub: openWhy.why.withheld,
              }]
              : []),
            /* ONE WALK, BOTH TENSES. The rows hand their own lines over in one shape, so a live
               order and a queried albarán are read through the same rule the same way — and every
               name on it is still a door (§43). */
            ...openWhy.why.lines.map((l) => ({
              id: l.id,
              label: l.label,
              sub: l.sub,
              onOpen: () => { setWhy(null); openProduct(l.product); },
            })),
          ]}
        />
      )}
    </Block>
  );
}

/** How many past albaranes the fingerprint draws at once. Everything is in the history; the block
 *  reads the recent window and says how far back the whole thing goes. */
const PAIRS_SHOWN = 3;

/* ── THE RECORD — ONE SHEET, EVERY DOOR (FEED-IA §137.1) ──────────────────────────────────────
 * «Oh right, the customer sheet is ONE.» — Peter, 2026-08-30.
 *
 * WHAT WAS TRUE BEFORE THIS COMPONENT EXISTED, and why it could not stay. The app drew a customer
 * TWICE. The product sheet's buyer door opened this file's overlay — §127.3's two-tense history,
 * the red dots, the «Why?» doors. The albarán head's name and the Customers book's row opened the
 * Customers AREA's own sheet, which drew its own record (`sheet-record`, the river's cards) and its
 * own arithmetic (`sheet-numbers`). One account, two rooms, two answers to «what happened here» —
 * measured on the bundle and reported as an OWED finding in `drive-122.py` for a week.
 *
 * SO THE BODY IS A COMPONENT AND BOTH SURFACES MOUNT IT. The overlay is this plus a header; the
 * area's sheet is this plus the book's own chrome (the name, the flip, the map square, the account
 * band, the sticky bar). Every door in the house now lands on the same organs in the same order.
 *
 * ═══ §42.2'S RIVER CARDS, AND WHY THE REPEAL IS THE SMALLER TRUE CHANGE ═════════════════════
 * §42.2 ruled: «ORDER HISTORY as the SAME order cards Sales uses — the order is ONE object
 * everywhere; their history is those cards, not a summary table.» That law was aimed at a SUMMARY
 * TABLE — label-and-figure lines that named documents nobody could open.
 *
 * The two-tense list `OrderHistory` is not that table, and it is a strict superset of what the
 * cards carried on this surface: every live albarán of theirs, by day, with its state, its money
 * and its own door onto the same document in Sales (§43) — plus three facts the card cannot carry
 * here. It holds the YEAR BEHIND THEM as well as today (the cards held only the live ones), it
 * carries §127.3's one red claim on the row that is blocking a person, and it carries the reasoning
 * door on every document Rocoto decided something about. Mounting both would have printed the same
 * albaranes twice under two grammars, which is the double history §137.1 forbids.
 *
 * So the cards are REPEALED ON THIS SURFACE and nowhere else: the river still draws every one of
 * its own rows with `RiverRow`, and the object is still one object — pressing a row here lands on
 * the same albarán, at the same address, that the card landed on.
 */
/** §161–162: a visual memory jog after operational history; the dossier opens on demand. */
function CustomerInsights({ cast, customer }: { cast: Cast; customer: Customer }) {
  const [, theme] = useStyletron();
  const { pricing, country } = useWorkspaceCapabilities();
  const pricingAvailable = capabilityAvailable('albaranValues') && pricing;
  const [expanded, setExpanded] = React.useState(false);
  const day = useDay(cast.sector);
  const imported = useImport(cast.sector);
  const knows = useKnows(cast);
  const sales = React.useMemo(() => buildSales(cast, day).filter((sale) => sale.customer.id === customer.id), [cast, day, customer.id]);
  const months = React.useMemo(() => monthsFor(cast, customer, sales.map((sale) => ({ day: sale.day, figure: sale.figure })), imported), [cast, customer, sales, imported]);
  const year = todayId(cast).slice(0, 4);
  const historyKey = (day: string) => day.includes('-') ? day : `${year}-${day.split('.')[1]}-${day.split('.')[0]}`;
  const history = historyOf(cast, customer);
  const recent = [
    ...history.map((order) => ({ day: historyKey(order.day), value: pricingAvailable ? order.figure : order.lines.length })),
    ...sales.map((order) => ({ day: order.day, value: pricingAvailable ? order.figure : order.lines.length })),
  ]
    .sort((a, b) => a.day.localeCompare(b.day)).slice(-12).map((order) => ({ label: shortOfDay(order.day, cast), value: order.value }));
  const monthly = pricingAvailable && months.length > 1;
  const picture = (monthly ? months : recent).map(point => ({ ...point,
    value: pricingAvailable ? syntheticAmountForCountry(point.value, country) : point.value }));
  const reading = pricingAvailable ? aboutCustomer(knows, customer.id).find((observation) => observation.kind !== 'menu') : undefined;
  const orderCount = history.length + sales.length;
  const lineCount = history.reduce((sum, order) => sum + order.lines.length, 0)
    + sales.reduce((sum, order) => sum + order.lines.length, 0);
  return <section data-testid="customer-insights" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
    <Block testid="customer-insights-preview" title="Insights">
      {picture.length > 1 ? <div data-testid="customer-insights-chart" data-values={picture.map((point) => point.value).join(',')}>
        <LineChart title={pricingAvailable ? (monthly ? 'Monthly order value' : 'Order value') : 'Lines per delivery note'} size={CHART_SIZE.compact} height={144} unit={pricingAvailable ? (countryCurrency(country) === 'EUR' ? '€' : 'S/') : 'lines'} decimals={0} locale="es-ES"
          series={[{ name: pricingAvailable ? (monthly ? 'Monthly order value' : 'Order value') : 'Lines per delivery note', data: picture.map((point, x) => ({ x, y: point.value })) }]}
          curve={CURVE.linear} formatX={(value) => picture[Math.round(value)]?.label ?? ''} />
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
          {pricingAvailable && monthly ? 'Monthly orders' : 'Recent orders'} · {picture.length} {pricingAvailable && monthly ? 'months' : 'delivery notes'}
        </span>
      </div> : <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Insights show here</span>}
      {reading && <p data-testid="customer-insights-reading" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{reading.sentence}</p>}
      <span><Button
        kind={KIND.tertiary}
        size={SIZE.compact}
        data-testid="customer-insights-toggle"
        aria-expanded={expanded}
        aria-controls={`customer-insights-${customer.id}`}
        aria-label={expanded ? 'Hide customer insights' : 'Show customer insights'}
        onClick={() => setExpanded(!expanded)}
        endEnhancer={<span aria-hidden="true" style={{ display: 'inline-flex', transform: expanded ? 'rotate(180deg)' : 'none', transition: `transform ${theme.animation.timing400} ${theme.animation.easeOutCurve}` }}><Glyph id="caret" size={STEP.small} /></span>}
        overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
      >
        {expanded ? 'Hide insights' : 'Show insights'}
      </Button></span>
    </Block>
    {expanded && <div id={`customer-insights-${customer.id}`} data-testid="customer-insights-details" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {pricingAvailable ? (
        <>
          <TheirVolume cast={cast} customer={customer} />
          <TheirNumbers cast={cast} customer={customer} />
          <WhatRocotoKnows cast={cast} customer={customer} />
        </>
      ) : (
        <Block testid="customer-order-activity" title="Order activity" lead="Completed and current delivery notes">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale400 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
              <span style={{ ...theme.typography.HeadingSmall }}>{orderCount}</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Delivery Notes</span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
              <span style={{ ...theme.typography.HeadingSmall }}>{lineCount}</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Product lines</span>
            </span>
          </div>
        </Block>
      )}
    </div>}
  </section>;
}

export function CustomerRecord({ cast, customer, accountDetails }: { cast: Cast; customer: Customer; accountDetails?: React.ReactNode }) {
  const [, theme] = useStyletron();
  const edits = useDay(cast.sector);
  const grants = useGrants();
  const { pricing: pricingAvailable, money: moneyEnabled } = useWorkspaceCapabilities();

  const sales = React.useMemo(() => buildSales(cast, edits), [cast, edits, grants]);
  const theirs = React.useMemo(
    () => sales.filter((s) => s.customer.id === customer.id),
    [sales, customer.id],
  );
  const past = React.useMemo(() => historyOf(cast, customer), [cast, customer]);
  const complaints = React.useMemo(() => complaintsOf(cast, customer), [cast, customer]);

  /* the live complaints are the same kind of fact as the year's, so they stand in the same block */
  const live = theirs.filter((s) => s.dispute);

  const passes: Pass[] = [
    ...theirs.filter((s) => RANK[s.state] >= RANK.made).map(passOfSale),
    ...past.map((a) => ({ id: a.id, number: a.number, day: a.day, lines: a.lines })),
  ].slice(0, PAIRS_SHOWN + 1);

  /* WHAT THE FINGERPRINT ACTUALLY SAYS, counted rather than claimed. The first pass on screen may
     well be a set of lines that went out exactly as asked — that is a true morning — so the block's
     own lead states how many of the lines on it were filled differently, and the reader knows what
     they are looking for before they start reading rows. */
  const lines = passes.reduce((sum, p) => sum + p.lines.length, 0);
  const filled = passes.reduce((sum, p) => sum + p.lines.filter((l) => l.note).length, 0);

  return (
    <div
      data-testid="customer-record"
      data-customer={customer.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        /* ONE MEASURE FOR THE WHOLE SHEET (§134.2). The blocks are spaced by the same number the
           overlay insets its content by, so a gap between two cards is never smaller than the gap
           between a card and the edge — and the area's sheet inherits that rhythm rather than
           keeping a second one of its own. */
        gap: theme.sizing.scale800,
        minWidth: 0,
      }}
    >
      {/* §161–162 supersede the earlier chart-first reference: working controls, operational
          history, then one visual Insights preview with the full evidence available on demand. */}

      {/* Commercial settings remain implemented but are deliberately absent from the order-review
          profile. The working sheet starts with what this account buys and what is in review. */}
      {pricingAvailable && <CustomerPricing cast={cast} customer={customer} sales={theirs} />}

      {/* Work memory is read before a chronological record: the few products this customer
          repeatedly buys, then the actual documents follow. */}
      <TheirUsualOrder cast={cast} customer={customer} />

      <UpcomingOrders cast={cast} customer={customer} />
      <OrderHistory cast={cast} customer={customer} />

      {moneyEnabled && <CustomerCredit customerId={customer.id} scope={cast.sector} />}

      <CustomerInsights cast={cast} customer={customer} />

      <div data-testid="customer-fulfilment-history" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
        {accountDetails}
        <Block
          testid="profile-pairs"
          title="Delivery changes"
          lead={`${filled} of ${lines} ${plural(lines, 'line')} changed`}
        >
          {passes.map((pass) => (
            <Pairs key={pass.id} pass={pass} />
          ))}
        </Block>

        <Block testid="profile-complaints" title="Concerns">
          {live.map((sale) => (
            <Row
              key={sale.id}
              testid={`complaint-${sale.id}`}
              label={
                <>
                  <Door
                    onOpen={() => openOrder(sale.id)}
                    label={`Open delivery note ${sale.number}`}
                    testid={`complaint-open-${sale.id}`}
                  >
                    Delivery Note {sale.number}
                  </Door>
                  {` · ${sale.dispute?.at ?? sale.at}`}
                </>
              }
              sub={sale.dispute?.because}
              value={
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
                  {sale.state === 'settled' ? 'settled' : 'open'}
                </span>
              }
            />
          ))}
          {complaints.map((albaran) => (
            <Row
              key={albaran.id}
              testid={`complaint-${albaran.id}`}
              label={`Delivery Note ${albaran.number} · ${albaran.day}`}
              sub={
                <>
                  {albaran.dispute?.because}
                  <br />
                  {albaran.dispute?.outcome}
                </>
              }
              value={
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
                  settled
                </span>
              }
            />
          ))}
          {live.length + complaints.length === 0 && (
            <p data-testid="complaints-clear" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              All clear
            </p>
          )}
        </Block>
      </div>

      <TheirMenu cast={cast} customer={customer} />
    </div>
  );
}
