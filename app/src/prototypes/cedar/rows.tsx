/* THE ROWS — the one section grammar every seat in the app is written in.
 *
 * ═══ WHY THIS FILE EXISTS (FEED-IA §51.24 · THE-ADMIN-CANON §2.1) ═══════════════════════════
 * «Across the entire thing you don't even have the same thing. When I see a preview I can barely
 * see where to go fast.» The wireframe law's remedy is ONE section grammar reused across the app,
 * and a grammar that lives inside one area's file is a grammar exactly one area can keep.
 *
 * These four atoms were `areas/settings.tsx`'s private components. Administration is TEN seats
 * written by the same hand against the same anatomy, so they come out of that file and become the
 * shared vocabulary they were always describing. Settings drew them for seven sections; the world
 * draws them for forty, and every one of those forty is the same object:
 *
 *   ┌─ SECTION ────────────────────────────────────────────────────────────────┐
 *   │  HEADING  the thing the group is (a label, never an observation)          │
 *   │  ┌─ LIST ──────────────────────────────────────────────────────────────┐  │
 *   │  │ [TILE]  LABEL                                   value            ›  │  │  ← ROW
 *   │  │         one line of what it is                                      │  │
 *   │  ├─────────────────────────────────────────────────────────────────────┤  │
 *   │  │ [TILE]  LABEL                                   [switch]            │  │  ← ROW, control
 *   │  └─────────────────────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 * ONE FACT PER ROW, AND THE ROW IS THE DOOR. A row whose value is a switch carries the switch
 * INSTEAD of the chevron, because a row with two ways in is a row you have to aim at. THE CHEVRON
 * MEANS DRILL-IN AND NOTHING ELSE (§51's chevron law) — a row that changes nothing when pressed
 * does not wear one.
 *
 * A GRANT ROW is the same anatomy with the value promoted to its own line, because on a grant the
 * SENTENCE is the fact and an ellipsis through the middle of it would be a setting nobody can read
 * on a phone (THE-INTELLIGENCE §11: «every grant is a SENTENCE the person can read»).
 *
 * ═══ WHAT THE GRANT ROW LEARNED ON THE WAY OUT (THE-ADMIN-CANON §6) ═════════════════════════
 * The stage plays a setting against a SANDBOX copy of the grants — touching the control changes
 * what the little conversation does without changing what the house actually granted. So the row
 * takes an optional `grants`: given one, it reads that instead of the live store. It is one prop
 * and it is the difference between lifting the real control onto the stage and drawing a second
 * one that merely looks like it (the liftout law: never redraw).
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Glyph, STEP } from './glyphs';
import { ConnectTile } from './connect';
import { RocotoMark } from './capability';
import { useGrants, type CapabilityQuestion, type GrantMark, type Grants } from './grants';
import { checkForGrant } from './net';

/** what a row shows a mark for. Every one of these is a `GlyphId` out of the app's one vocabulary
 *  — this type names MEANINGS the administration uses, and never an artwork. */
export type MarkId =
  | 'crate' | 'email' | 'at' | 'clock' | 'brand' | 'sign' | 'archive' | 'print' | 'erp' | 'file'
  | 'price' | 'doc' | 'who' | 'team' | 'map' | 'ops' | 'plan' | 'data' | 'connect' | 'sliders'
  | 'van' | 'send' | 'export' | 'log' | 'chat' | 'search' | 'eye' | 'check' | 'flag' | 'camera'
  | 'call'
  | GrantMark;

/** THE SEAT: a stated square, the mark at a stated step, centred with room around it. */
export const TILE = 36;

/**
 * THE TILE, AND THE ONE THAT IS ALLOWED TO GLOW (FEED-IA §51.20).
 *
 * Every row wears the same grey square, which is what makes thirty rows read as one list. The
 * INTEGRATION rows wear the plug on the brand's own wash instead, and they are the only ones that
 * do. That is the whole of §51.20 as it applies to a list: the anatomy does not change, the words
 * do not change, and the rows a person came looking for stand out without a single label moving.
 */
export function Tile({ mark, connect = false }: { mark: MarkId; connect?: boolean }) {
  const [, theme] = useStyletron();
  if (connect) return <ConnectTile size={TILE} />;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        width: TILE,
        height: TILE,
        flex: '0 0 auto',
        borderRadius: theme.borders.radius200,
        background: theme.colors.backgroundSecondary,
        color: theme.colors.contentPrimary,
      }}
    >
      <Glyph id={mark} size={STEP.medium} />
    </span>
  );
}

/* ── THE ROW ──────────────────────────────────────────────────────────────────────────────── */

/* ── THE VALUE COLUMN'S OWN MEASURE (FEED-IA §132.2) ──────────────────────────────────────────
 * «All the fields in business settings and other settings are so tucked to the right also.» They
 * were, and it was structural rather than a taste. The label column is `flex: 1` from a ZERO
 * basis, so it grows into every free pixel the row has; the value column is whatever is left, and
 * a column that is only ever a remainder is sized by its own content and never by the room the row
 * actually has. Measured on the business card at 1600: the row was 774px wide, «Carrer de
 * Sepúlveda 148, 3r 2a · 08011 Barcelona» was given 331 of them and broke, leaving «Barcelona»
 * alone on a second line with three hundred pixels of white beside it. That is not a wrap. That is
 * a starved column, and it is what «tucked to the right» looks like when you measure it.
 *
 * SO A VALUE MAY CLAIM A MEASURE — 360px, which is an address, a registry entry or a five-word
 * clause on one line — BUT ONLY OUT OF ROOM THE ROW CAN SPARE. `max(0px, 100% - 360px)` is the
 * whole of that rule: a row must be twice the measure wide before the floor bites at all, so a
 * desk gives the value its line and a 390px handset is left EXACTLY as it was, with the label
 * keeping every pixel it had. One expression, no breakpoint, no second grammar for phones.
 *
 * AND THE CAP IS THE LABEL'S NEED RATHER THAN A FRACTION. `LABEL_KEEP` is the 36px tile, the two
 * `scale500` gaps around it and 68px of label — «Domicilio fiscal» in the two lines it has always
 * taken at 390. A clause may have everything else. The old 58% starved a clause by the same
 * proportion on a 1,600px desk as on a handset, which is the same mistake one level up.
 *
 * A SHORT VALUE STILL DRAWS SHORT and still stands at the right edge — the price-right law is
 * about which edge a figure is read from, not how much room it was given.
 */
const VALUE_MEASURE = 360;
const LABEL_KEEP = 132;

export type RowProps = {
  mark: MarkId;
  /** THE CONNECT ZONE (§51.20). A row that plugs something in wears the plug. */
  connect?: boolean;
  label: React.ReactNode;
  /** ── THE SUB LINE, AND ITS DECLARED OVERFLOW (FEED-IA §77.2 · THE-CONTENT-CANON §8) ────────
   *  «The WORST is when we have lines changing height and the whole content jaggeding.» This slot
   *  takes the canon's river-reason behaviour — TWO LINES, then an end ellipsis — because that is
   *  what it is: one sentence explaining the row above it, and the canon declares that shape once
   *  for the whole app rather than per surface. See `SUB` below for the mechanics. */
  sub?: React.ReactNode;
  /** what the row currently holds, on the right */
  value?: React.ReactNode;
  /** THE VALUE IS A SENTENCE, NOT A WORD (§33). The trailing column clips to one line, which is
   *  right for «Fish» and wrong for «With today's file» — at 390 it printed «With today's f». A
   *  row whose value is a clause says so, and the clause wraps instead of losing its end. */
  wrapValue?: boolean;
  /** ── THE VALUE IS ONE FACT AND IT MAY NEVER BREAK (§77.2 · §75.8 · §132.2, AUDIT-2 C21) ────
   *  A CIF split across two lines is the fiscal analogue of the price-unit mis-sale: «B-65 428 /
   *  901» is not a number a person can read back, and an IBAN broken after its fifth group is
   *  worse. Three of these came apart in a 120px gutter on a 1290px card — the trailing column
   *  takes only what the greedy label column leaves it, and `wrapValue` then spent that width on
   *  line breaks rather than asking for more.
   *  A TOKEN ROW INVERTS THE PRIORITY: the value takes the width it needs and never shrinks, and
   *  the LABEL is the side that yields, because «Razón social» is a word a reader completes from
   *  four letters and «ES91 2100 0418 4502 0005 1332» is not.
   *
   *  ═══ AND SPACES DO NOT MAKE A FACT INTO A CLAUSE (FEED-IA §132.2) ══════════════════════════
   *  Peter's screenshot, off Business settings: «+34 932 62 18» on one line and «40» on the next.
   *  That row was declared `wrapValue`, because a phone number LOOKS like several words — and CSS
   *  believed it, and broke a phone number in half. It is one fact whose parts are written apart.
   *
   *  SO THE TEST IS NOT «does it contain spaces», IT IS «can a reader read it back». A phone, an
   *  email, an hour range («06:00 – 20:00»), an IBAN, a CIF, a minted address: ONE fact, so
   *  `token`. An address, a registry entry, a sentence: a CLAUSE, so `wrapValue` — those wrap
   *  between their words and lose nothing, and now they may never break INSIDE one either. */
  token?: boolean;
  /** the row opens something. THIS AND ONLY THIS DRAWS THE CHEVRON. */
  onOpen?: () => void;
  /** ── AND A ROW THAT LEAVES THE APP WEARS THE OUTWARD MARK INSTEAD (FEED-IA §85) ─────────────
   *  §85's grammar allows a row a trailing ANNOTATION «where true», and names the external-link
   *  mark as one. The chevron law is why it replaces the chevron rather than joining it: «THE
   *  CHEVRON MEANS DRILL-IN AND NOTHING ELSE», and a press that hands the reader to another
   *  company's screen has not drilled into anything of ours. So one seat, two possible marks, and
   *  the row states which promise it is making before it is pressed.
   *
   *  IT IS TRUE ON EXACTLY ONE ROW TODAY — Plan's “Manage subscription”, which is the Stripe
   *  customer portal. `rail.tsx`'s foot menu deliberately draws none, and says so: «nothing in
   *  this menu leaves the app… either one would be decoration wearing the costume of
   *  information.» That is the same law from the other side. */
  outward?: boolean;
  /** a switch or an action that takes the trailing seat instead of the chevron */
  control?: React.ReactNode;
  id?: string;
  testid?: string;
};

/* ── THE SUB LINE'S OVERFLOW, BUILT (FEED-IA §77.2 · THE-CONTENT-CANON §8, §9) ────────────────
 * The canon DECLARED this slot's behaviour and the row never built it: a sub is dynamic content —
 * a house's own words, a zone's name, a count that grew a digit — so at 390 a long one ran to
 * three and four lines and pushed every row under it down the screen. That is the jag §77.2 is
 * about, and it is the same failure the value column already answered on its own line.
 *
 * TWO LINES, THEN AN END ELLIPSIS. It is the canon's river-reason behaviour, taken here because it
 * is the same kind of slot: one sentence explaining the thing above it. Two lines is what a real
 * explanation needs at 390 and a hard ceiling on what any of them may take.
 *
 * THE CEILING IS THE POINT, NOT UNIFORMITY. A one-line sub still draws one line — a row is not
 * padded out to two for the sake of a grid — so the heights in a list vary by AT MOST one line,
 * and no row can ever be taller than that whatever arrives in it. That is the checkable law, and
 * the drive holds the list to it rather than to a single number.
 *
 * `-webkit-line-clamp` IS THE ONLY THING THAT CLAMPS AND ELLIPSISES TOGETHER, and Blink and WebKit
 * both ship it (this build's Chromium is the one that paints it). `overflowWrap: anywhere` is the
 * other half: a single 60-character token has no space to break at, and without it the clamp holds
 * the height while the word runs out of the row sideways.
 */
function SUB(theme: ReturnType<typeof useStyletron>[1]): React.CSSProperties {
  return {
    ...theme.typography.ParagraphXSmall,
    color: theme.colors.contentSecondary,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    minWidth: 0,
  } as React.CSSProperties;
}

/* ── A FACT INSIDE A SENTENCE (FEED-IA §132.2) ────────────────────────────────────────────────
 * The value column is not the only slot a phone number lands in: a row's SUB says «Calls answered
 * on +34 932 621 840, transcript kept with the order», and that line wraps between words like any
 * other sentence — which puts «+34 932 62» at the end of one line and «18 40» at the start of the
 * next. Same mis-sale, one slot over.
 *
 * So a fact that happens to be standing inside prose says so, and stops being wrappable. It is one
 * span and it is deliberately tiny: the alternative is every caller remembering a CSS property.
 */
export function Atom({ children }: { children: React.ReactNode }) {
  return <span style={{ whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Row({
  mark,
  connect,
  label,
  sub,
  value,
  wrapValue,
  token,
  onOpen,
  outward,
  control,
  id,
  testid,
}: RowProps) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);

  const body = (
    <>
      <Tile mark={mark} connect={connect} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        <span data-row-label="yes" style={theme.typography.LabelMedium}>{label}</span>
        {sub !== undefined && (
          <span data-row-sub="yes" style={SUB(theme)}>{sub}</span>
        )}
      </span>
      {value !== undefined && (
        <span
          data-value={testid}
          data-value-kind={token ? 'token' : wrapValue ? 'clause' : 'line'}
          style={{
            ...theme.typography.LabelSmall,
            color: theme.colors.contentSecondary,
            textAlign: 'right',
            minWidth: token ? 0 : `min(${VALUE_MEASURE}px, max(0px, 100% - ${VALUE_MEASURE}px))`,
            overflow: 'hidden',
            textOverflow: wrapValue && !token ? 'clip' : 'ellipsis',
            whiteSpace: token ? 'nowrap' : wrapValue ? 'normal' : 'nowrap',
            /* AND A CLAUSE BREAKS BETWEEN ITS WORDS, NEVER INSIDE ONE (§132.2). `break-word` /
               `anywhere` would hyphenlessly guillotine «B-65428901» the moment the column got
               tight, which is the exact failure this section exists to end. A clause that
               genuinely cannot fit overflows visibly instead of lying quietly. */
            ...(wrapValue && !token ? { overflowWrap: 'normal' as const, wordBreak: 'keep-all' as const } : null),
            /* ── AND A WRAPPING VALUE MAY NOT STARVE THE LABEL (§77.2, found in the 390 sweep) ──
               The label column is `flex: 1` — basis 0 — so it claims none of the row on its own and
               lives on whatever the value leaves. A value that is a long CLAUSE leaves nothing: at
               390 «Tomo 44.207 · folio 112 · hoja B-451.883 · inscripción 1ª» took 246px of a 356px
               row, the label's box measured ZERO, and «Registro mercantil» painted straight over
               the value it names. A clause is the one kind of value that can afford to give width
               back, because giving it back costs a line rather than a fact — which is exactly what
               `wrapValue` already declares about it. A token gives nothing (it cannot wrap), and a
               one-line value never asks for more than it needs. */
            /* ── AND THE CAP IS THE LABEL'S NEED, NOT A FRACTION OF THE ROW (FEED-IA §132.2) ──
               «All the fields in business settings and other settings are so tucked to the right
               also.» A flat 58% is a fraction of whatever the row happens to be, which means a
               clause is starved by the same amount on a 1,600px desk as on a handset: measured on
               the business card at 1600, «Carrer de Sepúlveda 148, 3r 2a · 08011 Barcelona» had
               448px of a 738px row and broke, leaving «Barcelona» alone on a second line with
               three hundred pixels of white beside it. That is not a wrap, it is a starved column.
               SO THE ROW RESERVES WHAT THE LABEL NEEDS AND THE VALUE TAKES THE REST. `LABEL_KEEP`
               is the tile, the two gaps and a readable label — the same at every width, which is
               what makes it honest: the desk gives the clause its whole line and 390 gives it the
               same room it had before. A token still overrides both (C21). */
            ...(wrapValue && !token ? { maxWidth: `calc(100% - ${LABEL_KEEP}px)` } : null),
            /* A TOKEN TAKES ITS ROOM AND KEEPS IT (C21). `flex: 0 0 auto` stops the column
               shrinking under the label's `flex: 1`, and `overflow: visible` stops an identifier
               that is somehow still too wide from being clipped into a rumour — at which point the
               row is honestly too narrow and it shows, rather than quietly handing back a number
               that is not the number. */
            ...(token ? { flex: '0 0 auto', overflow: 'visible' } : null),
          }}
        >
          {value}
        </span>
      )}
    </>
  );

  const shell: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.sizing.scale500,
    width: '100%',
    /* THE BOX IS THE BOX (§13). Without this, 100% + padding overflows every List by
       32px and the trailing value column loses its right edge at 390 — measured. */
    boxSizing: 'border-box',
    textAlign: 'left',
    padding: `${theme.sizing.scale600} ${theme.sizing.scale600}`,
    borderTop: `1px solid ${theme.colors.borderOpaque}`,
    /* HOVER PAINTS; HOVER MOVES NOTHING (§37.3). The ground steps one rung and the geometry is
       untouched — no lift, no border swap, no padding change, because a row that resizes under the
       pointer is a row you chase. */
    background: over && onOpen ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
    color: theme.colors.contentPrimary,
    minWidth: 0,
  };

  if (!onOpen) {
    return (
      <div id={id} data-row={testid} style={shell}>
        {body}
        {control}
      </div>
    );
  }

  return (
    <div id={id} data-row={testid} style={{ ...shell, padding: 0, borderTop: shell.borderTop }}>
      <button
        type="button"
        data-testid={`row-${testid}`}
        onClick={onOpen}
        onMouseEnter={() => setOver(true)}
        onMouseLeave={() => setOver(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale500,
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          padding: `${theme.sizing.scale600} ${theme.sizing.scale600}`,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'default',
          fontFamily: 'inherit',
        }}
      >
        {body}
        {/* ONE SEAT, TWO PROMISES (§85 · the chevron law). Drill-in, or out of the product. */}
        {outward ? (
          <span
            data-chevron="outward"
            aria-hidden="true"
            style={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', color: theme.colors.contentTertiary }}
          >
            <Glyph id="outward" size={STEP.small} />
          </span>
        ) : (
          <span data-chevron="drill" aria-hidden="true" style={{ display: 'inline-flex', color: theme.colors.contentTertiary, transform: 'rotate(-90deg)' }}>
            <Glyph id="caret" size={STEP.small} />
          </span>
        )}
      </button>
      {control}
    </div>
  );
}

/** THE LIST — the box a run of rows stands in. The first row's own top hairline is the box's, so a
 *  list of one and a list of nine are the same object with the same edges. */
export function List({ children, testid }: { children: React.ReactNode; testid: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/** THE SECTION — a heading that NAMES what is under it, stacked directly on the group it names.
 *
 *  `lead` survives for the two places a section's own proposition is genuinely content rather than
 *  narration; §51.7 banned the rest («no part of the app should have these»), so a seat that finds
 *  itself explaining its own rows should delete the sentence instead of writing a better one. */
export function Section({
  title,
  lead,
  actions,
  children,
  testid,
}: {
  title: string;
  lead?: React.ReactNode;
  /** a control that belongs to the whole group — «Add a person», never a row's own act */
  actions?: React.ReactNode;
  children: React.ReactNode;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <section
      data-section={testid ?? title}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: theme.sizing.scale500, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h2>
          {lead && (
            <p style={{ margin: `${theme.sizing.scale200} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {lead}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/* ── THE GRANT ROW (THE-INTELLIGENCE §11 · THE-ADMIN-CANON §5) ────────────────────────────────
 * «Every grant is a SENTENCE the person can read.» So the value is promoted out of the trailing
 * column and given its own line under the label, at full ink, with the saffron mark where the
 * sentence is about something ROCOTO does. Read the middle line of every row in a grants section
 * and you have read the division of labour between the house and the software.
 *
 * The trailing column is where the other rows put a value, and a value there is clipped to one
 * line — right for «Fish» and wrong for «Rocoto puts them on as one-offs», which is the whole
 * fact. This row wraps instead, at every width.
 */
export function GrantRow({
  q,
  onOpen,
  grants,
  testid,
  chevron = true,
}: {
  q: CapabilityQuestion;
  onOpen: () => void;
  /** THE CHEVRON MEANS DRILL-IN AND NOTHING ELSE (§51's chevron law). The stage's own copy of this
   *  row CYCLES a value rather than opening anything, so it says `chevron={false}` — a chevron on a
   *  control that changes a value where it stands is the app promising a screen it does not have. */
  chevron?: boolean;
  /** THE SANDBOX (THE-ADMIN-CANON §6). Given a grants object, the row reads THAT instead of the
   *  live store — which is how the stage puts the real control on stage without letting a
   *  demonstration change what the house actually granted. */
  grants?: Grants;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const live = useGrants();
  const g = grants ?? live;
  const [over, setOver] = React.useState(false);
  const rocoto = q.rocoto(g);
  const check = checkForGrant(q.id);

  return (
    <button
      type="button"
      data-row={`grant-${q.id}`}
      data-testid={testid ?? `row-grant-${q.id}`}
      data-sandbox={grants ? 'yes' : 'no'}
      onClick={onOpen}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.sizing.scale500,
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'left',
        padding: theme.sizing.scale600,
        border: 'none',
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        background: over ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        cursor: 'default',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <Tile mark={q.row.mark} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          {q.row.label}
        </span>
        <span
          data-value={`grant-${q.id}`}
          style={{ ...theme.typography.LabelMedium, color: theme.colors.contentPrimary, minWidth: 0 }}
        >
          {rocoto && <RocotoMark inline />}
          {q.value(g)}
        </span>
        {/* THE SAME SLOT, SO THE SAME DECLARED OVERFLOW (§77.2). A sub drawn one way in the list
            and another way on the grant card is two answers to one question. AND A ROW WITHOUT ONE
            DRAWS NOTHING (§51.7, AUDIT-2 C19/C20) — the slot is where a sentence goes, never a
            slot that must be filled. */}
        {q.row.sub !== undefined && (
          <span data-row-sub="yes" style={SUB(theme)}>
            {q.row.sub}
          </span>
        )}
        {/* ── WHICH OF THE SIX THIS DIAL SETS (FEED-IA §32.B, §33.2 item 3) ────────────────────
            «Trust is not a vibe about 200 orders; it is trust in THE NET… the grants screen is the
            DIAL.» A dial you cannot see the machine behind is a switch, so every grant that a check
            reads names the check by the word the band uses for it — and the two lists cannot drift,
            because both read `net.ts`. One quiet line, at the facts' step, under the sentence it
            qualifies. */}
        {check && (
          <span
            data-check-for={q.id}
            data-check={check.id}
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}
          >
            {/* AND IT IS THE NAME, NOT A SENTENCE ABOUT THE NAME (AUDIT-2 C19). Six dial rows in
                one list each ended «The quantity check reads this.» · «The money check reads
                this.» · «The amount check reads this.» — one phrase printed six times with one
                word changing inside it, which is a column of names wearing a sentence. The name
                alone says the whole thing: this row's line, under this row's value, in the word
                the band uses. */}
            {check.name}
          </span>
        )}
      </span>
      {chevron && (
        <span data-chevron="drill" aria-hidden="true" style={{ display: 'inline-flex', color: theme.colors.contentTertiary, transform: 'rotate(-90deg)' }}>
            <Glyph id="caret" size={STEP.small} />
          </span>
      )}
    </button>
  );
}

/* ── THE EDITABLE VALUE — THE ONE GRAMMAR (FEED-IA §51.14) ────────────────────────────────────
 * «If things are constantly editable — little borders around editable items, or not? Decide ONE
 * grammar and apply it.» The decision, settled on the albarán sheet and now the product's:
 *
 *   AT REST        a hairline UNDERLINE under the value, and nothing else. It is the app's one mark
 *                  for «this is yours to change», and it is quiet enough to live under thirty values
 *                  on one card without the card reading as a form.
 *   UNDER THE HAND a full RING and a step of ground. The affordance arrives on approach.
 *   OPEN           the ring in full ink, and the ground held — the value states that it is the one
 *                  being changed while its card is up.
 *
 * ═══ HOVER MAY NEVER MOVE GEOMETRY (FEED-IA §37.3) ══════════════════════════════════════════
 * The ring is a 1px SOLID TRANSPARENT border at rest that is only PAINTED under a pointer, and the
 * padding it takes back with a negative margin never changes — so a value gaining its ring costs
 * nothing and moves nothing. Turning a value editable is drawn INTO the air the type already has.
 *
 * ═══ WHERE IT LIVES — ONE HOME, AND THE COLLAPSE IS DONE ════════════════════════════════════
 * `detail.tsx` grew this component first, for the albarán's own values, and kept it private.
 * Administration is ten seats made almost entirely of editable values, so the grammar took its
 * home HERE, beside the rows it decorates, drawn to `detail.tsx`'s construction exactly: same
 * steps, same negative margin, same transparent-at-rest ring, same underline, same transitions,
 * same focus ring. The collapse was named as OWED because that file was under another session's
 * hand at the time.
 *
 * IT IS COLLAPSED NOW (FEED-IA §75 rider · THE-ADMIN-BUILD §2.3, §9): `detail.tsx` imports this one
 * and its private copy is gone — one import, one deletion, no pixels. The full §51.14 doctrine —
 * why an underline and not a box, why it stands at rest, why a hover may never move geometry — is
 * stated at the import site in `detail.tsx`, where the affordance was decided. The sibling debt
 * `embeds.tsx` records about `QuotedPaper` and `ChatPaper` is untouched and still owed.
 */
export function Editable({
  children,
  label,
  open,
  onOpen,
  testid,
  minimumTarget = 0,
  fluid = false,
  terminal = false,
}: {
  children: React.ReactNode;
  /** what the value is, said as a noun — the accessible name */
  label: string;
  open: boolean;
  onOpen: () => void;
  testid: string;
  /** A dense settings value keeps the legacy text-height target. Working rows can opt into the
   *  44px floor a thumb and a rapid desk pointer need without changing every Editable in the app. */
  minimumTarget?: number;
  /** Names may wrap and yield to terminal figures. Numeric facts keep their intrinsic width. */
  fluid?: boolean;
  /** §193.1: a value at the line's END hugs its right edge, so the 44px floor's slack falls
   *  OUTSIDE the lockup — «21 kg» closes up instead of holding dead air between its halves. */
  terminal?: boolean;
}) {
  const [css, theme] = useStyletron();
  return (
    <button
      type="button"
      data-testid={testid}
      data-editable="yes"
      data-editing={open ? 'yes' : 'no'}
      data-target-floor={minimumTarget || undefined}
      aria-label={label}
      aria-expanded={open}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className={css({
        display: 'inline-flex',
        alignItems: minimumTarget ? 'center' : 'baseline',
        justifyContent: terminal ? 'flex-end' : undefined,
        gap: theme.sizing.scale100,
        maxWidth: '100%',
        /* NO `minWidth: 0`. It let the box shrink under a value that will not wrap — a money
           figure — so at 390px the «€» hung outside its own ring. The value sets the width; the
           name beside it is the one that gives ground, because a name can wrap and a price cannot. */
        minWidth: minimumTarget ? `${minimumTarget}px` : fluid ? 0 : undefined,
        flex: fluid ? '1 1 auto' : '0 0 auto',
        overflowWrap: fluid ? 'anywhere' : undefined,
        whiteSpace: fluid ? 'normal' : undefined,
        minHeight: minimumTarget ? `${minimumTarget}px` : undefined,
        boxSizing: 'border-box',
        marginLeft: minimumTarget ? '0' : `-${theme.sizing.scale100}`,
        marginRight: minimumTarget ? '0' : `-${theme.sizing.scale100}`,
        paddingTop: minimumTarget ? theme.sizing.scale200 : '0',
        paddingBottom: minimumTarget ? theme.sizing.scale200 : '0',
        paddingLeft: theme.sizing.scale100,
        paddingRight: theme.sizing.scale100,
        borderRadius: theme.borders.radius100,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderTopColor: 'transparent',
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        /* THE ONE MARK, AT REST, ON EVERY SURFACE (§51.14) */
        borderBottomColor: open ? theme.colors.contentPrimary : minimumTarget ? 'transparent' : theme.colors.mono400,
        backgroundColor: open ? theme.colors.backgroundSecondary : 'transparent',
        ...(open ? { borderColor: theme.colors.contentPrimary } : null),
        color: 'inherit',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        lineHeight: 'inherit',
        letterSpacing: 'inherit',
        textAlign: 'left',
        cursor: 'default',
        transitionProperty: 'background-color, border-color',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
        ':hover': {
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.mono400,
        },
        ':focus-visible': {
          outlineWidth: '2px',
          outlineStyle: 'solid',
          outlineColor: theme.colors.borderSelected,
          outlineOffset: '1px',
        },
      })}
    >
      {children}
    </button>
  );
}

/* ── THE FACT (FEED-IA §51.24: «THE NUMBERS AS FACTS, not sentences») ─────────────────────────
 * A LABEL OVER A FIGURE, and the label comes FIRST because a number a reader has to guess the
 * subject of is a number they read twice. It is `shell/printing.tsx`'s atom — the export centre
 * settled this control and the administration's cards take it rather than a second one that merely
 * looks similar. This is the RE-EXPORT and not a copy, so there is one Fact in the product.
 */
export { Fact, Facts, RailRow } from './shell/printing';
