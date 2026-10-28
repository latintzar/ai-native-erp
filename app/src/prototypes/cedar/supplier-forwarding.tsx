/* SUPPLIER EMAILS — the surface of the fourth export rail (FEED-IA §35.7, §35.8, §35.6, §111.11).
 *
 * ═══ A SUPPLIER IS NOT AN ENTITY HERE (V32 · V33, Peter, 2026-08-29) ════════════════════════
 * «What is this. We never said we have supplier cards as an entity at all.» · «Call is Supplier
 * emails.»
 *
 * He was right, and the card was the evidence: two paintings in an avatar's seat, a company name,
 * a named human under it, and an address — a CRM contact record, drawn by an app that holds no
 * such record. WHAT THE PRODUCT ACTUALLY HOLDS about a supplier is three things:
 *
 *   AN ADDRESS       where the list goes. It is the whole of the addressing.
 *   WHAT THEY CARRY  the categories whose orders route to them — a fact of the CATALOGUE, said in
 *                    the trade's own words on the «What goes» seat.
 *   WHAT WENT        the run log: one row per date, the hour, the lines. It is a record of EMAILS,
 *                    not a history of a relationship.
 *
 * SO THREE CLAIMS CAME OFF THE CARD. The paintings in the identity seat (they read as the
 * supplier's own face, and a face is the strongest entity claim a card can make — they keep their
 * real job in the picker, where they prove what a category routes). The named contact and its
 * person-or-team typology (a CRM field, asked for in a step of the walk and stored for nothing).
 * And the word «partner» as an entity noun, everywhere it stood in this surface's own copy.
 *
 * WHAT IS LEFT IS AN ARRANGEMENT: an address, what goes to it, when it closes, and what has gone.
 *
 * ═══ THE THING THIS SCREEN HAS TO SHOW IS A TIMER, NOT A BUTTON ═════════════════════════════
 * «The send is AUTOMATIC — no person presses it at 01:30» (§35.7). A surface whose centre of
 * gravity is a Send control would be a surface that contradicts its own feature, so the centre of
 * gravity here is the TIMER'S OWN LIFE: when the next run goes, what the last one carried, and how
 * much has come in since. The one act a person has — «send what's waiting now» — is the timer's
 * own act asked for early, so it is quiet, it stands to one side, and it exists only while there
 * is something to send.
 *
 * ═══ THE LOG IS THE FEATURE'S PROOF (§35.7: «tracked by date and sent-or-not») ══════════════
 * A daily automatic email is a thing a house has to be able to audit at a glance, so every partner
 * carries its own quiet timeline: one row per date, the hour, what it carried, and whether it has
 * gone. The open run is the top row and it holds the roll — the lines that came in after the
 * cutoff and go on the next list. Nothing here is stored: `suppliers.ts` derives the rows off the
 * same day the river draws, so the log and the orders can never disagree.
 *
 * ═══ THE FACES (§35.8) ═════════════════════════════════════════════════════════════════════
 * «The category face is a painting of the animal/plant itself… better still, custom illustrations
 * for CATEGORY COMBINATIONS.» Neither exists yet, and this surface is honest about which is which:
 *
 *   · A PARTNER'S CARD shows the painted faces of the GOODS that route to it. Those paintings do
 *     exist, they are the truth of what goes on the list, and they are the raw material of the
 *     commissioned combination image the tracker now asks for.
 *   · THE PICKER shows each category's OWN face: the painting where the library has one, and the
 *     family's drawn mark where it has none. Every fallback in the fish house is an ask recorded
 *     in notes/PAINTINGS-TRACKER.md — the surface asks for art by falling back, never by drawing a
 *     placeholder.
 *
 * ═══ THE CONNECT FEEL (§35.6) ══════════════════════════════════════════════════════════════
 * «It must FEEL professionally engineered — the Google-setup feeling: transparent, nothing will go
 * wrong.» So the empty state states exactly what connecting one will do, the last card of the walk
 * states what will happen before anything is saved, and the row keeps THE SAME THING afterwards.
 * Saying it identically in both places is what makes a person believe the machine.
 *
 * ⚠ AND WHAT IS SAID IS FACTS, NOT A SENTENCE (THE-CONTENT-CANON §3, §4 · the 2026-08-28 sweep).
 * Both places used to carry twenty-nine words of prose — «Orders for Marisco and Cefalópodos
 * arriving before 01:30 go to Mariscos Vidal as one list, every day…» — printed whole on every
 * card, under a section lead that already says it. The transparency was never in the grammar; it
 * is in the facts being STATED, in one shape, in both places, before and after. `forwardingFacts`
 * is that shape, and `ForwardingFacts` draws it: what goes · when it closes · what it sends.
 *
 * THE ADD FLOW IS THE QUESTIONNAIRE'S OWN GRAMMAR (`capability.tsx`): a hairline progress strip,
 * one question filling the card, Base's own pill chips, and the answer's meaning in a line under
 * them. It is a different store and the same walk, because a person setting their house up should
 * meet one way of being asked.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Input } from 'baseui/input';
import { Select, SIZE as SELECT_SIZE } from 'baseui/select';
import { validate as validateEmail } from 'email-validator';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import type { Cast, Product } from '../../scenarios/data/cast';
import { RocotoMark } from './capability';
import { nodeOf } from './catalogue';
import { nowOf } from './day';
import { Face, ProductFace, type IconFamily } from './product-face';
import {
  dayFromId, dayLabelFromId, dayShortOf, feedDays, nearWordOf, todayId, type Sale,
} from './sale';
import { usePhone } from './shell/viewport';
import {
  addPartner, CUTOFF_TIMES, forwardingFacts, forwardingOf, houseLadder,
  nextRunWords, openRunWords, removePartner, runWords, seedPartners,
  useHandRuns, usePartners,
  type LadderPick, type Partner, type PartnerDraft, type Run,
} from './suppliers';

/* ── THE CATEGORY'S FACE ──────────────────────────────────────────────────────────────────────
 * A shelf is drawn by the painting the library has for its own word, and by its family's mark
 * where the library has none — `Face` is the component that already makes exactly that choice for
 * the writing line, so the shelf and the goods wear one seat and one rule.
 *
 * THE FAMILY MARK IS PICKED PER SHELF, not per house. A marisco shelf falling back to a fish
 * silhouette would say the wrong thing about the only face it has, so the two shelves that have
 * their own mark get it and everything else takes its family's.
 */
const SHELF_MARK: Record<string, IconFamily> = {
  'n-shellfish': 'shellfish',
  'n-cephalopod': 'shellfish',
  'n-poultry': 'poultry',
  'n-vegetable': 'vegetable',
  'n-herb': 'vegetable',
  'n-fruit': 'fruit',
};

const ROOT_MARK: Record<string, IconFamily> = {
  'n-fish': 'fish',
  'n-meat': 'meat',
  'n-produce': 'fruit',
  'n-ambient': 'dry',
};

function markOf(node: string): IconFamily {
  const own = SHELF_MARK[node];
  if (own) return own;
  let at = nodeOf(node);
  while (at?.parent) at = nodeOf(at.parent);
  return ROOT_MARK[at?.id ?? ''] ?? 'dry';
}

function ShelfFace({ pick, size = 32 }: { pick: LadderPick; size?: number }) {
  return <Face name={pick.name} family={markOf(pick.node)} size={size} />;
}

/* ── THE GOODS THAT GO ON THE LIST ────────────────────────────────────────────────────────────
 * What routes through one CATEGORY, wearing the library's own paintings — the picker's evidence
 * that a shelf name really is a set of goods.
 *
 * ⚠ IT IS NOT A SUPPLIER'S FACE (V33 · §111.11). This used to stand in the identity seat of every
 * supplier card, beside the name, which is where a product draws an avatar — and an avatar is a
 * claim to an entity we do not hold. It belongs to the shelf, on the row where the shelf is chosen.
 */
function Goods({ of, size = 30 }: { of: Product[]; size?: number }) {
  const [, theme] = useStyletron();
  if (of.length === 0) return null;
  return (
    <span
      data-testid="partner-goods"
      style={{ display: 'flex', gap: theme.sizing.scale100, flex: '0 0 auto' }}
    >
      {of.slice(0, 4).map((p) => (
        <ProductFace key={p.id} of={p} size={size} />
      ))}
    </span>
  );
}

/* ── THE ARRANGEMENT, AS A FACT ROW ───────────────────────────────────────────────────────────
 * The seats and their words are `forwardingFacts`, beside the arithmetic that makes them true;
 * this is only how they are drawn. Label over value, no colon — the app's own fact anatomy, the
 * one `printing.tsx` and the customer sheet already use, so a fact reads the same wherever it is.
 *
 * ONE MEASURE ACROSS CARDS (§77.2 — «the WORST is when we have lines changing height and the whole
 * content jaggeding»). Every value takes ONE line and ends in an ellipsis — the declared behaviour
 * for a row's facts line — so a house with a four-shelf partner and a house with a one-shelf
 * partner draw two cards of exactly the same height. The columns are the grid's, not the content's:
 * the shelves get the double seat because they are the only fact that can run long, and the phone
 * takes the same three seats stacked, in the same order.
 */
function ForwardingFacts({ of, testid }: { of: Partner; testid: string }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: phone
          ? 'minmax(0, 1fr)'
          : 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
        gap: phone ? theme.sizing.scale400 : theme.sizing.scale600,
        minWidth: 0,
      }}
    >
      {forwardingFacts(of).map((f) => (
        <span
          key={f.label}
          data-fact={f.label}
          data-value={f.value}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
        >
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
            {f.label}
          </span>
          <span
            style={{
              ...theme.typography.LabelSmall,
              color: theme.colors.contentPrimary,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {f.act && <RocotoMark inline label="This list is scheduled; it sends once delivery is verified" />}
            {f.value}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ── ONE ROW OF THE LOG ───────────────────────────────────────────────────────────────────────
 * The date leads, because §35.7 tracks by date. The mark seat says whose act it was: saffron on a
 * run that has GONE, because the automatic send is Rocoto's own act and the standing colour law
 * gives it the accent; an empty seat on the run that has yet to close, because it is not an act
 * yet. The seat keeps its width either way so the dates stay a column.
 */
const MARK_SEAT = 16;

function LogRow({ day, words, scheduled }: { day: string; words: string; scheduled: boolean }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-run={day}
      data-delivery={scheduled ? 'unverified' : 'pending'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        padding: `${theme.sizing.scale200} 0`,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentSecondary,
          flex: '0 0 auto',
          width: '5ch',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {dayShortOf(dayFromId(day))}
      </span>
      <span style={{ display: 'flex', width: MARK_SEAT, flex: '0 0 auto', justifyContent: 'center' }}>
        {scheduled && <RocotoMark label="Scheduled list · delivery awaiting verification" />}
      </span>
      <span
        style={{
          ...theme.typography.ParagraphXSmall,
          color: scheduled ? theme.colors.contentPrimary : theme.colors.contentSecondary,
          flex: 1,
          minWidth: 0,
        }}
      >
        {words}
      </span>
    </div>
  );
}

/* ── ONE PARTNER ──────────────────────────────────────────────────────────────────────────────
 * Sentence first: who it goes to, then what will happen, then the timer, then the record. Read the
 * card top to bottom and you have read the whole arrangement without opening anything.
 */

/** How much of the record one card carries. A timeline is what is happening lately; the whole
 *  history of a daily email belongs to the day it went out and not to a settings row. */
const LOG_DEPTH = 4;

function PartnerCard({
  cast,
  partner,
  sales,
  days,
}: {
  cast: Cast;
  partner: Partner;
  sales: Sale[];
  days: string[];
}) {
  const [, theme] = useStyletron();
  const runs = useHandRuns();
  const today = todayId(cast);
  const now = nowOf(cast);
  const forwarding = React.useMemo(
    () => forwardingOf({ sales, partner, runs, days, today, now }),
    [sales, partner, runs, days, today, now],
  );

  /* DAYS SPEAK THEIR NEARNESS FIRST (§18), and the river owns that word — «tomorrow» rather than
     «Saturday 23.08» wherever the day is one of the three a person thinks of by name. */
  const say = (day: string): string => nearWordOf(day, today)?.toLowerCase() ?? dayLabelFromId(day);
  const when = forwarding.next ? say(forwarding.next.day) : '';
  const rolledFrom = forwarding.next ? say(forwarding.next.from) : '';

  return (
    <div
      data-partner={partner.id}
      data-testid={`partner-${partner.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale600,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      {/* WHERE THE LIST GOES (V33 · §111.11). The name at the head of it, and the address it is
          sent to — the two facts the product actually holds. The paintings and the named human
          that used to stand here made a contact record out of an email arrangement.
          THE ADDRESS KEEPS ITS OWN LINE at every width: at 390 a «name · address» line broke
          inside the domain and left the separator hanging at the end of the line above it. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.sizing.scale500, minWidth: 0 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
          <span style={theme.typography.LabelMedium}>{partner.company}</span>
          <span
            data-testid={`partner-email-${partner.id}`}
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentTertiary,
              overflowWrap: 'anywhere',
            }}
          >
            {partner.email}
          </span>
        </span>
        <span style={{ flex: '0 0 auto' }}>
          <Button
            kind={KIND.tertiary}
            size={SIZE.mini}
            shape={SHAPE.pill}
            onClick={() => removePartner(partner.id)}
            data-testid={`partner-remove-${partner.id}`}
          >
            Remove
          </Button>
        </span>
      </div>

      {/* THE ARRANGEMENT (§35.6) — the same facts the add flow showed before anything was saved */}
      <ForwardingFacts of={partner} testid={`partner-facts-${partner.id}`} />

      {/* THE TIMER'S OWN LIFE, and the quiet act beside it */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        <span
          data-testid={`partner-next-${partner.id}`}
          style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, flex: 1, minWidth: '18ch' }}
        >
          <RocotoMark inline label="This list is scheduled; it sends once delivery is verified" />
          {nextRunWords(forwarding, when)}
        </span>
        {forwarding.waiting > 0 && forwarding.next && (
          <span data-testid={`partner-send-unavailable-${partner.id}`} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            This list is ready and waiting; email delivery is ready to connect.
          </span>
        )}
      </div>

      {/* THE RECORD (§35.7: tracked by date and sent-or-not) */}
      <div data-testid={`partner-log-${partner.id}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {forwarding.next && (
          <LogRow day={forwarding.next.day} words={openRunWords(forwarding, rolledFrom)} scheduled={false} />
        )}
        {forwarding.log.slice(0, LOG_DEPTH).map((r: Run) => (
          <LogRow key={`${r.day}-${r.at}-${r.byHand ? 'hand' : 'timer'}`} day={r.day} words={runWords(r)} scheduled />
        ))}
      </div>
    </div>
  );
}

/* ── ADDING ONE ───────────────────────────────────────────────────────────────────────────────
 * Four answers and the arrangement they come to. Every card is the questionnaire's own shape, and
 * the last one is the whole point of the flow: before anything is saved, the machine says exactly
 * what it is about to start doing, every day, for good.
 *
 * ⚠ THE CONTACT STEP IS GONE (V33 · §111.11). It asked for a person's name and whether that name
 * was a person or a desk — two CRM fields on a walk that sets up an EMAIL. The address is the
 * addressing; a name inside it is somebody's business and not this app's record. The draft still
 * carries the two keys because `suppliers.ts` owns that shape, and they go in empty.
 */

type Step = 'company' | 'email' | 'categories' | 'cutoff' | 'done';

const STEPS: Step[] = ['company', 'email', 'categories', 'cutoff', 'done'];

const EMPTY = (cutoff: string): Omit<PartnerDraft, 'sector'> => ({
  company: '',
  contact: '',
  contactKind: 'person',
  email: '',
  categories: [],
  cutoff,
});

function Progress({ step, total }: { step: number; total: number }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300 }}>
      <div style={{ display: 'flex', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              height: 2,
              flex: 1,
              borderRadius: theme.borders.radius100,
              background: i <= step ? theme.colors.contentPrimary : theme.colors.mono300,
            }}
          />
        ))}
      </div>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
        {step + 1} of {total}
      </span>
    </div>
  );
}

function Ask({
  prompt,
  aside,
  hint,
  children,
}: {
  prompt: string;
  aside: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <div>
        <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>{prompt}</h2>
        <p
          style={{
            margin: `${theme.sizing.scale300} 0 0`,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
          }}
        >
          {aside}
        </p>
      </div>
      {children}
      {hint && (
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** THE PICKER — the ladder, with its faces (§35.8). A row states the category and the goods that
 *  would route through it, because the shelf name is the routing and the goods are the proof. */
function ShelfRow({
  pick,
  on,
  onToggle,
}: {
  pick: LadderPick;
  on: boolean;
  onToggle: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={`shelf-${pick.node}`}
      data-level={pick.level}
      data-selected={on ? 'yes' : 'no'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: `${theme.sizing.scale400} 0`,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <Checkbox
        checked={on}
        onChange={onToggle}
        overrides={{
          /* THE ROW IS THE TARGET, AND THE TRAILING COLUMN IS A COLUMN. Base's control and its
             label both take their content's width, so a trailing element landed wherever the names
             happened to end — on the row whose names wrapped it was orphaned above the second line.
             Both grow, and the paintings pin to the right on every row. */
          Root: { style: { flex: 1, minWidth: 0 } },
          Label: { style: { flex: 1, minWidth: 0 } },
          Input: { props: { 'data-testid': `pick-${pick.node}` } },
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
          {/* THE CATEGORY'S OWN FACE — the painting where the library has one, the family's mark
              where it has none. Every mark in a fish house today is an ask in the tracker (§35.8). */}
          <ShelfFace pick={pick} />
          <span
            style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}
          >
            <span style={theme.typography.LabelSmall}>{pick.name}</span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {pick.goods.map((g) => g.name).join(' · ')}
            </span>
          </span>
          {/* WHAT ROUTES THROUGH IT, in the library's own paintings — the trailing column, so the
              category's one mark and the goods' pictures are two zones and not one mixed row. */}
          <Goods of={pick.goods} size={22} />
        </span>
      </Checkbox>
    </div>
  );
}

function AddPartner({ isOpen, onClose, cast }: { isOpen: boolean; onClose: () => void; cast: Cast }) {
  const [, theme] = useStyletron();
  const ladder = React.useMemo(() => houseLadder(cast), [cast]);
  const [at, setAt] = React.useState(0);
  const [draft, setDraft] = React.useState(() => EMPTY(CUTOFF_TIMES[3]));

  React.useEffect(() => {
    if (!isOpen) return;
    setAt(0);
    setDraft(EMPTY(CUTOFF_TIMES[3]));
  }, [isOpen]);

  const step = STEPS[at];
  const patch = (p: Partial<Omit<PartnerDraft, 'sector'>>) => setDraft((d) => ({ ...d, ...p }));

  const ready =
    step === 'company'
      ? draft.company.trim().length > 1
      : step === 'email'
        ? validateEmail(draft.email.trim())
        : step === 'categories'
          ? draft.categories.length > 0
          : true;

  /* THE FINISHED SENTENCE, BEFORE ANYTHING IS SAVED. It is composed off the same function the row
     will keep, so what the flow promised and what the row says are one string. */
  const preview: Partner = {
    ...draft,
    company: draft.company.trim() || 'them',
    id: 'preview',
    sector: cast.sector,
  };

  const toggle = (node: string) =>
    patch({
      categories: draft.categories.includes(node)
        ? draft.categories.filter((n) => n !== node)
        : [...draft.categories, node],
    });

  const save = () => {
    addPartner({
      ...draft,
      company: draft.company.trim(),
      contact: draft.contact.trim(),
      email: draft.email.trim(),
      sector: cast.sector,
    });
    onClose();
  };

  return (
    <OverlayCard isOpen={isOpen} onClose={onClose} scrim={SCRIM.dim} size={560} ariaLabel="A supplier">
      <div
        data-testid="partner-ask"
        data-step={step}
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}
      >
        <Progress step={at} total={STEPS.length} />

        {step === 'company' && (
          <Ask
            prompt="Which supplier"
            aside="The name at the head of their list."
          >
            <Input
              value={draft.company}
              onChange={(e) => patch({ company: (e.target as HTMLInputElement).value })}
              placeholder="Mariscos Vidal"
              aria-label="The supplier’s name"
              overrides={{ Input: { props: { 'data-testid': 'partner-company' } } }}
            />
          </Ask>
        )}

        {step === 'email' && (
          <Ask
            prompt="Where it lands"
            aside="The address the list goes to, every day."
          >
            <Input
              value={draft.email}
              onChange={(e) => patch({ email: (e.target as HTMLInputElement).value })}
              placeholder="pedidos@mariscosvidal.es"
              aria-label="Their address"
              overrides={{ Input: { props: { 'data-testid': 'partner-email' } } }}
            />
          </Ask>
        )}

        {step === 'categories' && (
          <Ask
            prompt="What they handle"
            aside="The categories whose orders go on their list."
            hint={draft.categories.length > 0 ? `Their list carries ${preview.categories.length === 1 ? 'one category' : `${preview.categories.length} categories`}.` : undefined}
          >
            <div data-testid="shelf-picker" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {ladder.map((pick) => (
                <ShelfRow
                  key={pick.node}
                  pick={pick}
                  on={draft.categories.includes(pick.node)}
                  onToggle={() => toggle(pick.node)}
                />
              ))}
            </div>
          </Ask>
        )}

        {step === 'cutoff' && (
          <Ask
            prompt="When the list closes"
            aside="Rocoto prepares it for this hour every day. It is sent only after a connected delivery service accepts it. Orders that come in after it go on the next day’s list."
            hint={`A list that closes at ${draft.cutoff} gives them everything since ${draft.cutoff} the day before.`}
          >
            <div style={{ maxWidth: '14rem' }}>
              <Select
                size={SELECT_SIZE.compact}
                clearable={false}
                searchable={false}
                options={CUTOFF_TIMES.map((t) => ({ id: t, label: t }))}
                value={[{ id: draft.cutoff, label: draft.cutoff }]}
                onChange={(params) => patch({ cutoff: String(params.value[0]?.id ?? draft.cutoff) })}
                aria-label="The hour the list closes"
                overrides={{ Root: { props: { 'data-testid': 'partner-cutoff' } } }}
              />
            </div>
          </Ask>
        )}

        {step === 'done' && (
          <Ask prompt="This is what will happen" aside="From the moment you add them, and every day after.">
            {/* THE PREVIEW IS THE CARD, IN MINIATURE. Who it goes to at the head — the one place
                the destination is named, exactly as the row will name it — and under it the very
                fact row the row will keep. What the walk promises and what lands are one shape. */}
            <div
              data-testid="partner-preview"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.sizing.scale400,
                padding: theme.sizing.scale600,
                borderRadius: theme.borders.radius300,
                background: theme.colors.backgroundSecondary,
                minWidth: 0,
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
                <span style={theme.typography.LabelMedium}>{preview.company}</span>
                <span
                  style={{
                    ...theme.typography.ParagraphXSmall,
                    color: theme.colors.contentTertiary,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {preview.email}
                </span>
              </span>
              <ForwardingFacts of={preview} testid="partner-preview-facts" />
            </div>
          </Ask>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}>
          {step === 'done' ? (
            <Button kind={KIND.primary} size={SIZE.compact} onClick={save} data-testid="partner-save">
              Add {preview.company}
            </Button>
          ) : (
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              disabled={!ready}
              onClick={() => setAt(at + 1)}
              data-testid="partner-next"
            >
              Next
            </Button>
          )}
          <span style={{ flex: 1, minWidth: 0 }} />
          {at > 0 && (
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setAt(at - 1)} data-testid="partner-back">
              Back
            </Button>
          )}
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose} data-testid="partner-close">
            Close
          </Button>
        </div>
      </div>
    </OverlayCard>
  );
}

/* ── THE SECTION ──────────────────────────────────────────────────────────────────────────── */

/**
 * WHAT THE HOUSE SENDS ITS SUPPLIERS — the forwarding arrangements (V32 · §111.11 · §132.3).
 *
 * It owns everything in it: its own head, the house's arrangements, the timer each one runs on,
 * the record each one keeps, and the walk that adds another.
 *
 * ═══ WHERE IT STANDS, AND WHY IT MOVED (FEED-IA §132.3) ═════════════════════════════════════
 * «Partner suppliers was never meant to be a section. I never specified that in my checkpoint did
 * i??» It had a REGION of its own on the Connections seat — a claim that forwarding is one of the
 * four subjects that seat is about — and nothing in the checkpoint ever ordered one. What the
 * canon orders is the BEHAVIOUR: a day's lines for one partner house, emailed to them as a list.
 *
 * SO THE SEAM IS CLOSED FROM THE OTHER END. The old note here read «the section's own title still
 * says Partner suppliers, in a held file — Peter named it Supplier emails». That title is gone
 * with the region, and this surface now stands INSIDE «Supplier emails» — Stock's own seat
 * (§132.4) — under the mail its suppliers send in. One subject, two directions, one place.
 */
export function PartnerSuppliers({ cast, sales }: { cast: Cast; sales: Sale[] }) {
  const [, theme] = useStyletron();
  const partners = usePartners();
  const [adding, setAdding] = React.useState(false);

  /* THE HOUSE'S OWN PARTNERS, PLANTED ONCE (the `seedRules` law). A surface with nothing on it
     teaches nothing; a demonstration that grows back after you remove it teaches the wrong thing. */
  React.useEffect(() => {
    seedPartners(cast.sector);
  }, [cast.sector]);

  /* THE SAME DAY THE RIVER DRAWS, handed down by the page rather than folded again here: the log
     is a read of THESE orders, so a run can never claim a line the feed does not have. */
  const days = React.useMemo(() => feedDays(cast).map((d) => d.id), [cast]);

  const mine = partners.filter((p) => p.sector === cast.sector);

  return (
    <div
      data-testid="partner-suppliers"
      data-partners={mine.length}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
    >
      {/* ── THE SECTION CARRIES ITS OWN HEAD NOW (FEED-IA §132.3, §132.4) ─────────────────────
          It used to borrow one from the `<Section>` that Connections wrapped it in — the region
          that §132.3 repealed. Standing in Stock's «Supplier emails» seat it is a peer of the mail
          above it and the log below it, so it is drawn the way they are: a sticky head at
          HeadingXSmall, the count beside it at the facts' step, an ink rule under both.
          AND THE HEADING SAYS ITS DIRECTION. The mail above is what suppliers send the house; this
          is what the house sends them. Two halves of one subject, each named for its own half. */}
      <header
        data-testid="partners-head"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale500,
          flexWrap: 'wrap',
          paddingTop: theme.sizing.scale500,
          paddingBottom: theme.sizing.scale400,
          borderBottom: `1px solid ${theme.colors.contentPrimary}`,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}>
          Lists you send your suppliers
        </h3>
        {mine.length > 0 && (
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
            {mine.length} {mine.length === 1 ? 'supplier' : 'suppliers'}
          </span>
        )}
      </header>

      {mine.length === 0 ? (
        <div
          data-testid="partners-empty"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale500,
            padding: theme.sizing.scale600,
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            background: theme.colors.backgroundPrimary,
            boxShadow: theme.lighting.shadow400,
            minWidth: 0,
          }}
        >
          <div>
            {/* THE HEADING NAMES THE THING (§111's heading law). «One list a day, at the hour you
                set» was an imperative-free slogan cadence — a phrase plus a benefit clause — and it
                left a stranger to work out what the section held. */}
            <h3 style={{ margin: 0, ...theme.typography.LabelLarge }}>A daily list to each supplier</h3>
            <p
              style={{
                margin: `${theme.sizing.scale200} 0 0`,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentSecondary,
                maxWidth: '62ch',
              }}
            >
              Choose what a supplier handles and the hour their list closes. The day’s orders for
              those goods are prepared at that hour. They are sent only after email delivery is connected; later ones go on the next day’s list.
            </p>
          </div>
          <div>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setAdding(true)} data-testid="add-partner">
              Add a supplier
            </Button>
          </div>
        </div>
      ) : (
        <>
          {mine.map((p) => (
            <PartnerCard key={p.id} cast={cast} partner={p} sales={sales} days={days} />
          ))}
          <div>
            <Button
              kind={KIND.secondary}
              size={SIZE.compact}
              onClick={() => setAdding(true)}
              data-testid="add-partner"
            >
              Add a supplier
            </Button>
          </div>
        </>
      )}

      {/* ── THE OTHER SCHEDULED OUTPUT (THE-CHECKPOINT §23: «relevant operational surfaces can
          deep-link into this setting») ─────────────────────────────────────────────────────────
          §23 names two scheduled outputs and this surface is one of them. The other — the paper
          that goes to the house's OWN people at an hour — lives on App settings, and a person
          standing here setting up a daily send is exactly the person who wants it. So the door is
          quiet, it is at the foot, and it names its destination rather than describing it.

          IT IS A DEEP LINK AND NOT A COPY OF THE SETTING. `#/admin/app-settings/briefings` opens
          that seat with the briefing's own card already up — the same tail scheme every «from your
          setup» door in this app uses — so there is one place the briefing is set. */}
      <div style={{ paddingTop: theme.sizing.scale300 }}>
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          data-testid="briefing-deep-link"
          onClick={() => { window.location.hash = '#/admin/app-settings/briefings'; }}
        >
          Scheduled briefings to your team
        </Button>
      </div>

      <AddPartner isOpen={adding} onClose={() => setAdding(false)} cast={cast} />
    </div>
  );
}

export default PartnerSuppliers;
