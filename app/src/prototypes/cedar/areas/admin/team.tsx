/* EQUIPO — the house's own people, and who may edit the business (FEED-IA §53 · CANON §4).
 *
 * «Their team should appear in a nice way, and they can add more people and give them different
 * rights, whether they have the right as admin to edit the business shit or not.»
 *
 * ═══ THE SUB-OBJECT (§53's own sentence) ════════════════════════════════════════════════════
 * «Another MAIN object is our company… its sub-objects are THEIR USERS.» So a person here is an
 * OBJECT, with everything §43 makes that mean: a card, a home, an address (`#/admin/team/<id>`), a
 * landing, and doors both ways. A customer's sheet naming their comercial opens this card; this
 * card's book opens those customers. Neither direction is a special case.
 *
 * ═══ THE WIREFRAME (§51.24, and §39's sheet grammar — panes: true) ══════════════════════════
 *
 *   ┌─ EQUIPO ─────────────────────────────────┬───────────────────────────────────────────────┐
 *   │ LIST (one scrollport, full height)        │ CARD (one scrollport, full height)            │
 *   │  ┌ HEAD  «13 people · 1 invited»          │  HEAD    initial · name · role · admin mark   │
 *   │  │                    [Invite somebody]   │  WAITING where the invite went · what is      │
 *   │  ├ ROW   (A) Name           LabelMedium   │          theirs to fill in · send it again ·  │
 *   │  │       Comercial · Litoral  ParagraphS  │          take it back      (only while asked) │
 *   │  │                    [admin] [Invited]   │  RIGHTS  the role bundle (a selection list)   │
 *   │  └ …                                       │          + THE ADMIN SWITCH, its own row      │
 *   │                                            │  BOOK    «38 accounts» → a door to each        │
 *   │                                            │  RUN     zone · truck — a door to Geography   │
 *   │                                            │  REACH   phone · email                        │
 *   └───────────────────────────────────────────┴───────────────────────────────────────────────┘
 *
 * ═══ THE INVITE (THE CHECKPOINT §3 · FEED-IA §90.2) ═════════════════════════════════════════
 * «Invite by email; the invited user completes their own profile; no administrator filling
 * pointless fields for another person; friendly invitation state; team list; add/remove people.»
 * So: ONE address and ONE role are asked; `company.ts`'s `invite()` writes the member and the
 * pending mark in one publish; the roster's trailing cell carries «Invited» in the same grammar
 * the admin right already uses; and the card's first section is WHAT IS WAITING — never a coloured
 * badge, never a status word on a ground of its own.
 *
 *   TYPE STEPS   HeadingSmall (the person's name on the card) · HeadingXSmall (a section) ·
 *                LabelMedium (a row's label, a list row's name) · LabelXSmall (a fact's label) ·
 *                ParagraphSmall / ParagraphXSmall (the quiet line).
 *   STATES       THE ADMIN RIGHT IS A SWITCH — an immediate binary, which is the only thing Base's
 *                switch law allows a switch to be. THE ROLE IS A SELECTION LIST, because five named
 *                bundles are a choice and not a toggle. The last admin cannot be switched off
 *                (`company.ts`'s normalise), because a control that can lock you out of your own
 *                business is a control that will.
 *   PHONE        the list, and a card pushed over it — §38's law: a pane inside a 390px column is
 *                the desk's answer to a question the phone does not have.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Checkbox, STYLE_TYPE } from 'baseui/checkbox';
import { Input } from 'baseui/input';
import { validate as validateEmail } from 'email-validator';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { useConfig } from '../../config';
import { bookOf, type RoleId } from '../../../../scenarios/data/cast';
import { Door, openCustomer, openUser, useLanding } from '../../anchors';
import { Fact, Facts, List, Row, Section } from '../../rows';
/* ── §122 · EDITABLE FROM THE GET-GO ──────────────────────────────────────────────────────────
   «EVERYTHING SHOULD ALWAYS BE EDITABLE FROM THE GET-GO… everything should be clickable, we're
   not in 2002 SaaS territory.» A person's card is the densest set of authored facts in the
   administration — a name, a phone, an address, a van, a run — and every one of them stood as
   text. `setMember` already took all five; what was missing was a way to say them. */
import { LiveValue } from '../../live-value';
/* E200.07 · the admin card's decided facts use the product sheet's own live field (§196.1). */
import { LiveField } from '../../live-field';
import { BOTTOM_NAV_HEIGHT, usePanes, usePhone, useStacked, Page } from '../../shell';
import { ADMIN, type AreaMeta } from '../../shell/area';
import { zoneNameOf } from '../../round-map';
import {
  ROLE_DOES, ROLE_LABEL, ROLES_IN_ORDER, acceptInvite, adminCount, invite, invitedCount,
  removeMember, revokeInvite, setMember, useCompany, type Member,
} from '../../company';
import { Glyph, STEP } from '../../glyphs';

export const meta: AreaMeta = {
  id: 'team',
  title: 'Team',
  owner: 'V2-ADMIN',
  /* MASTER-DETAIL (§38, §39): the roster and one person's card. */
  panes: true,
  /* NO LANE — this card carries no sticky action bar, so the frame's floating conversation has
     nothing to step clear of and reserving one would push it over the roster (§39.3). */
};

/** THE ROSTER'S OWN MEASURE. Thirteen rows do not earn the width a three-hundred-name book does —
 *  the first screenshot had a 960px column of initials beside a squeezed card — so the LIST is the
 *  narrow pane here and the card takes the remainder. */
const LIST_PANE = 380;
const GUTTER = 'scale600';

/** HOW MUCH OF A BOOK A CARD SHOWS BEFORE IT IS ASKED FOR THE REST. Six is a glance — enough to
 *  recognise the kind of accounts somebody holds — and the count above it opens the other thirty. */
const BOOK_PREVIEW = 6;

/* ── ONE ROW OF THE ROSTER ────────────────────────────────────────────────────────────────── */

function MemberRow({
  member,
  zone,
  holds,
  selected,
  onPick,
}: {
  member: Member;
  zone?: string;
  /** HOW MANY ACCOUNTS THEY HOLD (FEED-IA §67.1). «I hope this whole comercial routing attribution
   *  etc is clear in admin too!!!!» — so the roster answers who-holds-whom without opening a card:
   *  the run is on the row's own line and the size of the book is beside it. */
  holds: number;
  selected: boolean;
  onPick: () => void;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  /* THE RUN, WHOLE. A zone and a truck are two facts (`cast.ts`: the coast is one promise carried
     by two vans), and a row that gave only the zone made a reader open the card to learn which
     vehicle it is.
     A PERSON WHO HAS NOT ANSWERED YET HOLDS NONE OF IT (§3.3). They have a ROLE, because that is
     the one thing the house decided; the zone and the van arrive with them. So the line says the
     role and stops, rather than trailing two facts that are true of nobody. */
  const where = member.invited
    ? ROLE_LABEL[member.role]
    : [ROLE_LABEL[member.role], zone, member.truck !== undefined ? `truck ${member.truck}` : undefined]
      .filter(Boolean)
      .join(' · ');

  return (
    <button
      type="button"
      data-member-row={member.id}
      data-testid={`member-${member.id}`}
      data-selected={selected ? 'yes' : 'no'}
      onClick={onPick}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale500,
        width: '100%',
        textAlign: 'left',
        padding: `${theme.sizing.scale500} ${theme.sizing[GUTTER]}`,
        /* ONE LEFT EDGE (§33): the selection bar is 3px of real border at rest, transparent when
           the row is not the one standing — so nothing moves when a selection changes. */
        borderLeft: `3px solid ${selected ? theme.colors.contentPrimary : 'transparent'}`,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        borderRight: 'none',
        borderBottom: 'none',
        background: selected
          ? theme.colors.backgroundSecondary
          : over ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        data-avatar="person"
        style={{
          width: 32,
          height: 32,
          flex: '0 0 auto',
          borderRadius: '50%',
          background: theme.colors.backgroundSecondary,
          color: theme.colors.contentPrimary,
          display: 'grid',
          placeItems: 'center',
          ...theme.typography.LabelSmall,
        }}
      >
        {member.name.trim().slice(0, 1).toUpperCase()}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelMedium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.name}
        </span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {where}
        </span>
      </span>
      {/* THE TRAILING CELL — the size of their book, and the admin right where it is held. Both
          are facts ABOUT THE PERSON, so they stack in one right-hand column at the quiet step, and
          a row that has neither simply has no cell (§51.24: state is visual, and an empty fact
          draws nothing rather than drawing a dash). */}
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: theme.sizing.scale100,
          flex: '0 0 auto',
        }}
      >
        {holds > 0 && (
          <span
            data-holds={holds}
            style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}
          >
            {holds} accounts
          </span>
        )}
        {/* WAITING ON THEM (§3.4). It takes the SAME cell and the SAME chip the admin right takes —
            a word, never a colour, because colour carries identity and structure carries state
            (§51). «Invited» is a fact about the person, which is what this column holds. */}
        {member.invited && (
          <span
            data-invited-mark={member.id}
            style={{
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius100,
              padding: `0 ${theme.sizing.scale200}`,
              whiteSpace: 'nowrap',
            }}
          >
            Invited
          </span>
        )}
        {/* THE ADMIN RIGHT, MARKED WHERE IT IS HELD. A word and not a colour — colour carries
            identity, structure carries state (§51), and «who can change the business» is a fact
            about the person rather than a status about their row. */}
        {member.admin && (
          <span
            data-admin-mark={member.id}
            style={{
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius100,
              padding: `0 ${theme.sizing.scale200}`,
              whiteSpace: 'nowrap',
            }}
          >
            admin
          </span>
        )}
      </span>
    </button>
  );
}

/* ── THE PERSON, WHOLE (FEED-IA §67.1) ────────────────────────────────────────────────────────
 * «The ownership dropdown shows the person whole: name · their PHONE · their email where it exists
 * — as another column in the drop-down etc etc — you see where I'm going.» And: «I hope this whole
 * comercial routing attribution etc is clear in admin too!!!!»
 *
 * So a comercial named anywhere in Administration is drawn as an OBJECT and never as a string: the
 * initial, the name AS A DOOR into their card, where they stand, and how they are reached. It lives
 * in Team because Team is the person's home (`anchors.tsx`'s HOME_OF), and Geography imports it —
 * one drawing of a person, so a zone card and a roster can never disagree about what one looks like.
 *
 * THE REACH IS THE PART THAT WAS MISSING. A name alone answers «whose is this»; a name with a phone
 * on it answers «and how do I get them», which is the question actually being asked at 07:00 when a
 * crate is wrong. The address rides beside it WHERE IT EXISTS — half the house has one, and the
 * chip simply says what is there.
 */
export function PersonChip({
  member,
  holds,
  where,
  testid,
}: {
  member: Member;
  /** the size of their book, where they hold one */
  holds?: number;
  /** where they stand — «Comercial · Centre · truck 1» */
  where?: string;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const reach = [member.phone, member.email].filter(Boolean).join(' · ');

  return (
    <span
      data-person={member.id}
      data-testid={testid ?? `person-${member.id}`}
      style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, minWidth: 0 }}
    >
      <span
        aria-hidden="true"
        data-avatar="person"
        style={{
          width: 32,
          height: 32,
          flex: '0 0 auto',
          borderRadius: '50%',
          background: theme.colors.backgroundSecondary,
          color: theme.colors.contentPrimary,
          display: 'grid',
          placeItems: 'center',
          ...theme.typography.LabelSmall,
        }}
      >
        {member.name.trim().slice(0, 1).toUpperCase()}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>
          <Door onOpen={() => openUser(member.id)} label={`Open ${member.name}`} testid={`person-door-${member.id}`}>
            {member.name}
          </Door>
        </span>
        {/* ── THE COMPOSITE DOORS; IT DOES NOT GROW FIELDS (§122) ────────────────────────────
            The standing line and the reach line are both AUTHORED — a role, a run, a van, a
            phone, an address — and both stood dead. They are not made editable HERE, for two
            reasons that agree. First, §122 counts «opens its one obvious surface» as compliance,
            and the obvious surface exists and is one press away: the person's own card, where
            every one of these five values already edits in place through `setMember`. Second,
            this chip is drawn inside rows that are themselves doors on four seats — a field
            nested in a button is a mis-tap generator and invalid markup besides.
            So the WHOLE chip is one door, said three times over: the name, the standing, the
            reach. A reader who presses any part of a person gets the person. */}
        {(where || holds !== undefined) && (
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
            <Door
              onOpen={() => openUser(member.id)}
              label={`Open ${member.name} — their role, their run and their van`}
              testid={`person-standing-${member.id}`}
            >
              {[where, holds !== undefined ? `${holds} accounts` : undefined].filter(Boolean).join(' · ')}
            </Door>
          </span>
        )}
        {reach && (
          <span
            data-reach
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentTertiary,
              minWidth: 0,
              /* an address has no space to fold at, and a phone number cut mid-digit is a phone
                 number the app got wrong rather than one it drew small */
              overflowWrap: 'anywhere',
            }}
          >
            <Door
              onOpen={() => openUser(member.id)}
              label={`Open ${member.name} — their phone and their address`}
              testid={`person-reach-${member.id}`}
            >
              {reach}
            </Door>
          </span>
        )}
      </span>
    </span>
  );
}

/* ── A LABELLED FACT WHOSE FIGURE IS LIVE (§122) ──────────────────────────────────────────────
 * `Fact` takes `value: number | string`, which is right for the counted figures it was drawn for
 * and is exactly why an authored one could not be made live inside it. This is `Fact`'s anatomy —
 * the small tracked label, the value under it, at the `quiet` step — with the value slot open to a
 * control. It is `business.tsx`'s `EditableFact` one seat over, and it is deliberately NOT a change
 * to `Fact` itself: a counted figure must stay a figure, and widening the primitive is how the
 * distinction the law rests on gets lost.
 */
/** THE VANS THIS HOUSE ALREADY DRIVES (E200.07). A van is a number the house decided, and its
 *  register is the trucks standing on the runs plus the ones colleagues already drive, so a card
 *  offers what the house has and still takes the number of a van it has just bought. */
function vansOfHouse(company: { zones: Array<{ trucks: number[] }>; members: Array<{ truck?: number }> }): string[] {
  const vans = new Set<number>();
  for (const zone of company.zones) for (const truck of zone.trucks) vans.add(truck);
  for (const person of company.members) if (person.truck !== undefined) vans.add(person.truck);
  return [...vans].sort((a, b) => a - b).map(String);
}

function LiveFact({ label, testid, optional = false, children }: { label: string; testid: string; optional?: boolean; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-fact={testid}
      data-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}
    >
      {/* INTX-17.3 · AN OPTIONAL FIELD SAYS «Optional» ONCE, ON THE LABEL'S ROW — and this seat
          prints the label, so this seat prints the mark. A `LiveField` handed `hideLabel` draws
          neither, which is what kept «Run» and «Optional» on two rows of their own. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: 1, minWidth: 0 }}>{label}</span>
        {optional && <span data-live-optional-mark={testid} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Optional</span>}
      </span>
      <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>{children}</span>
    </span>
  );
}

/* ── THE NAME AN ADDRESS ALREADY CARRIES ──────────────────────────────────────────────────────
 * Law 10 — NO NAME IS TYPED INTO A SCREEN — is why this function exists rather than a literal. The
 * demo's acceptance below has to show the far side of the invite, and the only thing anybody has
 * said about that person is the address the house typed. So the name is READ OUT OF IT — the local
 * part, its dots and underscores spent as spaces, each word capitalised — and the affordance states
 * the name it is about to use BEFORE it is pressed, so nothing is invented behind the reader's back.
 *
 * In the built product this function does not exist: the person types their own name on their own
 * device, which is the whole of §3's «the invited user completes their own profile».
 */
export function nameFromAddress(address: string): string {
  const local = address.split('@')[0] ?? address;
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return address;
  return words.map((w) => w.slice(0, 1).toUpperCase() + w.slice(1)).join(' ');
}

/* ── WHAT IS WAITING ON SOMEBODY (§3.4: «a friendly invitation state») ────────────────────────
 * FRIENDLY MEANS IT SAYS WHAT IS TRUE AND WHAT IS NEXT, and it never spends a line on the half that
 * has not happened. So: where the invite went, that the rest of the profile is theirs to give — and
 * the two acts a house actually wants at that moment, which are «send it again» and «take it back».
 * No status colour, no badge, no «pending» as a state word on a coloured ground: the roster's
 * trailing cell already says «Invited» in the app's one grammar for a fact about a person.
 */
function Waiting({
  member,
  onRevoke,
  onAccept,
}: {
  member: Member;
  onRevoke: () => void;
  onAccept: () => void;
}) {
  const [, theme] = useStyletron();
  /** WHERE IT WENT. `invite()` puts an address with an `@` in it on `email` and anything else on
   *  `phone`, so the card reads whichever one the house actually used. */
  const address = member.email || member.phone;
  const showTheatre = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('theatre') === '1';

  /* ── SENDING IT AGAIN SAYS SO, IMMEDIATELY (§76: «immediate feedback after saving») ──────────
     There is nothing to write: an invite that has gone out twice is the same invite. So the act's
     whole result is the sentence it puts on the card, and the sentence is scoped to the press —
     it says «Sent again», which is exactly and only what happened. A control that changes nothing
     visible is a control a person presses four times wondering whether it worked. */
  const [sentAgain, setSentAgain] = React.useState(false);
  React.useEffect(() => setSentAgain(false), [member.id]);

  return (
    <Section title="Waiting on them" testid="waiting">
      <List testid="waiting-rows">
        <Row
          testid="invite-address"
          mark="at"
          label={<span style={{ overflowWrap: 'anywhere' }}>{address}</span>}
          sub="Where the invite went."
        />
        <Row
          testid="invite-profile"
          mark="who"
          /* A ROW LABEL NAMES THE THING (THE-CONTENT-CANON). «They fill in the rest» is a remark
             about the row; «Their profile» is what the row is about, and the sentence under it
             says what that means. Same rule the section headings keep, one level down. */
          label="Their profile"
          sub="Their name, their number and their photo are theirs to give."
        />
      </List>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <Button
          kind={KIND.secondary}
          size={SIZE.compact}
          shape={SHAPE.pill}
          data-testid="invite-resend"
          onClick={() => setSentAgain(true)}
        >
          Send it again
        </Button>
        <Button kind={KIND.tertiary} size={SIZE.compact} shape={SHAPE.pill} data-testid="invite-revoke" onClick={onRevoke}>
          Take the invite back
        </Button>
        {sentAgain && (
          <span
            data-testid="invite-resent"
            style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}
          >
            Sent again to {address}.
          </span>
        )}
      </div>
      {showTheatre && <div
        data-testid="demo-accept-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
          Profile setup
        </span>
        <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} data-testid="demo-accept" onClick={onAccept}>
          Record profile completed
        </Button>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
          Record this after {member.name.includes('@') ? 'they' : member.name} complete their profile.
        </span>
      </div>}
    </Section>
  );
}

/* ── THE CARD ─────────────────────────────────────────────────────────────────────────────── */

function MemberCard({
  member,
  book,
  onBack,
  onRemove,
  onCleared,
}: {
  member: Member;
  /** the accounts this person holds, off the same book the customers area draws */
  book: Array<{ id: string; name: string }>;
  onBack?: () => void;
  /** absent for the last person in the house */
  onRemove?: () => void;
  /** the seat's own «nobody is standing here any more» — the card calls it when the person it is
   *  drawn over stops existing, so a revoke and a removal leave the pane the same way */
  onCleared?: () => void;
}) {
  const [, theme] = useStyletron();
  const company = useCompany();
  /** the book, opened. It shuts again when the card moves to another person, because «all of them»
   *  is a thing asked of one book and never a preference about books. */
  const [wholeBook, setWholeBook] = React.useState(false);
  React.useEffect(() => setWholeBook(false), [member.id]);
  const zone = member.zone ? zoneNameOf(member.zone) ?? member.zone : undefined;
  /** the last admin holds the right, whatever the switch is asked to do — so the switch says so
   *  rather than failing silently under the hand */
  const onlyAdmin = Boolean(member.admin) && adminCount(company) <= 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale800, minWidth: 0 }}>
      {onBack && (
        <div>
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onBack} data-testid="member-back" aria-label="Back to Team" title="Back to Team" overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', paddingLeft: 0, paddingRight: 0 } } }}>
            <Glyph id="back" size={STEP.medium} />
          </Button>
        </div>
      )}

      {/* HEAD — the person, and the two facts that are their standing in the house */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale600, minWidth: 0 }}>
        {/* THE INK IS STATED, NOT INHERITED (THE-CHECKPOINT-AUDIT finding 6). One avatar grammar
            means one BACKGROUND and one FOREGROUND: this seat took its colour from whatever it
            was nested in, so the same person's initial was a different ink here than in the rail —
            the same drift, one property along, and a drive comparing the grammar across seats
            found it. */}
        <span
          aria-hidden="true"
          data-avatar="person"
          style={{
            width: 48,
            height: 48,
            flex: '0 0 auto',
            borderRadius: '50%',
            background: theme.colors.backgroundSecondary,
            color: theme.colors.contentPrimary,
            display: 'grid',
            placeItems: 'center',
            ...theme.typography.HeadingXSmall,
          }}
        >
          {member.name.trim().slice(0, 1).toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          {/* ── AND THE HEAD DECLARES ITS OVERFLOW TOO (§77.2, found in the 390 sweep) ─────────
              This slot had only ever held a NAME, and a name has spaces to fold at. An invite
              puts an ADDRESS here until the person answers, and «marc.rovira@peixvilalta.cat»
              has none — at 390 it ran straight off the right edge of the card, unreadable and
              unclipped. `anywhere` is the same answer the reach rows already give for the same
              reason, stated in this file: an address has no space to fold at, so it folds where
              it must rather than leaving the card. */}
          {/* AND THE NAME IS LIVE (§122). A house corrects a colleague's name on the card that
              names them, not in a settings page — one press, type, Enter. `setMember` already
              took it. An INVITE is the one case that stays read-only: the address is what was
              sent to, the name is READ OUT of it (Law 10 · §3), and typing a name over somebody
              who has not answered yet is the administrator filling in another person's profile —
              which is the exact thing §3 forbids. */}
          <h2
            data-testid="member-name"
            style={{ margin: 0, ...theme.typography.HeadingSmall, minWidth: 0, overflowWrap: 'anywhere' }}
          >
            {member.invited ? member.name : (
              <LiveValue
                value={member.name}
                label="What they are called"
                placeholder="Their name"
                testid="member-name-value"
                size="default"
                width={280}
                onWrite={(name) => setMember(member.id, { name })}
              />
            )}
          </h2>
          {/* THE ROLE IS A BUNDLE, AND THE SENTENCE UNDER THE NAME IS WHAT IT MEANS (§4 · §122).
              ⚠ E200.07 SUPERSEDES the door: the bundle's card is spent, and the one place the role
              is changed is the live field on the «Role» row below, which prints these same
              sentences under each name it offers. A sentence stating a fact is a sentence, and a
              second door to the field a few pixels under it is the app asking twice. */}
          <p data-testid="member-role-does" style={{ margin: `${theme.sizing.scale100} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {ROLE_DOES[member.role]}
          </p>
        </div>
      </div>

      {/* WHAT IS WAITING, FIRST (§3.4). It leads the card because it is the only question the card
          can answer about somebody who has not answered yet. */}
      {member.invited && (
        <Waiting
          member={member}
          /* BOTH ACTS ARE THE STORE'S (`company.ts`, beside `invite` itself) — one vocabulary for
             one lifecycle. Revoking ALSO leaves through the seat's own removal door, which is what
             keeps the card from standing over somebody who is no longer on the roster. */
          onRevoke={() => { revokeInvite(member.id); onCleared?.(); }}
          onAccept={() => acceptInvite(member.id, nameFromAddress(member.email || member.phone))}
        />
      )}

      {/* RIGHTS — the bundle, and the one right that is explicitly its own switch (§4) */}
      <Section title="What they may do" testid="rights">
        <List testid="rights-rows">
          {/* ── E200.07 · THE ROLE IS A FIELD, NOT A DIALOG (§196.1 · §0.0.6) ─────────────────
              «Nothing else opens a dialog to change one word.» The role's five bundles each carry
              a sentence, and the live field's own option row prints that sentence under the name —
              so the card that used to explain them is spent and the register is read, filtered and
              written in one place. NO SUB (THE-CONTENT-CANON §4): `ROLE_DOES` already stands under
              the person's name at the head of this card. */}
          <Row
            testid="role"
            mark="who"
            label="Role"
            token
            control={
              <span style={{ display: 'block', width: 'min(240px, 100%)', minWidth: 0 }}>
                <LiveField
                  id="role"
                  declineSays="Choose a role from the list."
                  label="Role"
                  hideLabel
                  value={ROLE_LABEL[member.role]}
                  suggestions={ROLES_IN_ORDER.map((r) => ({ value: ROLE_LABEL[r], id: r, note: ROLE_DOES[r] }))}
                  placeholder="Choose what they do"
                  allowNew={false}
                  size="compact"
                  inputTestid="role-value"
                  listLabel="What this house's people do"
                  onCommit={({ value, id }) => {
                    const chosen = (id as RoleId | undefined) ?? ROLES_IN_ORDER.find((r) => ROLE_LABEL[r] === value);
                    if (!chosen) return 'Choose a role from the list.';
                    setMember(member.id, { role: chosen });
                  }}
                />
              </span>
            }
          />
          <Row
            testid="admin-right"
            mark="brand"
            label="Can edit the business"
            sub="The business, the tarifas and the agent’s dials."
            control={
              <span style={{ paddingRight: theme.sizing.scale500, flex: '0 0 auto' }}>
                <Checkbox
                  checked={Boolean(member.admin)}
                  disabled={onlyAdmin}
                  checkmarkType={STYLE_TYPE.toggle_round}
                  onChange={(e) => setMember(member.id, { admin: (e.target as HTMLInputElement).checked })}
                  overrides={{ Input: { props: { 'data-testid': `admin-toggle-${member.id}` } } }}
                  aria-label={`${member.name} can edit the business`}
                />
              </span>
            }
          />
        </List>
        {/* THE ONE HONEST SENTENCE ON THIS SEAT, and it is a REASON rather than an explanation
            (§51.24 lets a sentence exist as a reason). It appears only where it is true. */}
        {onlyAdmin && (
          <p
            data-testid="only-admin"
            style={{ margin: 0, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, maxWidth: '52ch' }}
          >
            {member.name} holds the only edit right. Give it to somebody else first.
          </p>
        )}
      </Section>

      {/* THEIR BOOK — the summary, and the door (clauses two and three of the card style).
          THE COUNT IS THE DOOR (§67.1). «Accounts held · 38» used to be a figure a person could
          read and not reach: the card listed five of the thirty-eight and the other thirty-three
          were behind nothing at all. The number opens the book it counts — right here, on the card
          it belongs to, which is the only honest target it has (the Customers area narrows by a
          typed term and has no address for «Núria's accounts»). Every name in it is a door of its
          own, so one press reaches the book and the next reaches a customer. */}
      {/* ── THEIR BOOK AND THEIR REACH BELONG TO SOMEBODY WHO IS HERE ────────────────────────
          A person who has not answered yet holds no accounts, drives no van and stands on no zone,
          so drawing «Accounts held 0 · Run — · Zone —» would be three dashes claiming to be a
          summary. The card's answer to «what about them» while an invite is standing is WAITING ON
          THEM, above; these two sections arrive with the person. */}
      {!member.invited && (
        <>
      <Section title="Their book" testid="book">
        <Facts testid="member-facts" fold>
          {/* ACCOUNTS HELD IS COUNTED, so it stays a fact — §122 is about AUTHORED values, and a
              field over a count is the app inviting somebody to argue with a sum. The two beside
              it are things a house DECIDED, so they are live. */}
          <Fact label="Accounts held" value={book.length} testid="book-count" />
          {/* ── E200.07 · THE TWO DECIDED FACTS ARE LIVE FIELDS (§196.1 «same for like other
              shit») ────────────────────────────────────────────────────────────────────────────
              A van and a run are the house's own material, so both are the product sheet's own
              organ: the list opens on a touch, filters as the person types, and the register says
              whether a new word is taken. The attached menu the zone used showed everything and
              narrowed nothing; the van's plain field offered nothing at all. */}
          <LiveFact label="Run" testid="truck" optional={member.truck === undefined}>
            <LiveField
              id="truck"
              label="Run"
              hideLabel
              value={member.truck !== undefined ? String(member.truck) : ''}
              /* THE VANS THIS HOUSE ALREADY DRIVES, in the order its runs stand. */
              suggestions={vansOfHouse(company)}
              placeholder="Choose a van"
              optional
              size="compact"
              inputTestid="truck-value"
              listLabel="Vans this house drives"
              /* A VAN IS A NUMBER. An empty field takes them off a van rather than storing a
                 blank, and a word typed where a number goes changes nothing — the run is what
                 the map and the paper both read, and it may not become a string. */
              onCommit={({ value: said }) => {
                /* ⚠ A WORD IS REFUSED OUT LOUD, NEVER TAKEN AND DROPPED. Typing «blue» marked the
                   row New, Enter took it, the field said «Saved» — and `truck: undefined` went to
                   the store, so the field reported a save that changed nothing. The refusal is a
                   sentence now, and the register keeps the one road it has: a number, or empty,
                   which is «Take them off it». */
                const word = said.trim();
                if (word === '') { setMember(member.id, { truck: undefined }); return; }
                const n = Number(word.replace(/[^\d]/g, ''));
                if (!/\d/.test(word) || !Number.isFinite(n) || n <= 0) return 'Type the van’s number.';
                setMember(member.id, { truck: n });
              }}
            />
          </LiveFact>
          <LiveFact label="Zone" testid="zone" optional={!zone}>
            <LiveField
              id="zone"
              declineSays="Choose a run from the list."
              label="Zone"
              hideLabel
              value={zone ?? ''}
              /* THE HOUSE'S OWN RUNS, and never a typed one: a zone this house does not cover is
                 a promise the agent would go on to make (`ZoneBand`). The register is closed. */
              suggestions={company.zones.map((z) => zoneNameOf(z.id) ?? z.id)}
              placeholder="Choose a run"
              optional
              allowNew={false}
              size="compact"
              inputTestid="zone-value"
              listLabel="Runs this house drives"
              aside={zone ? (
                <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="zone-value-clear" onClick={() => setMember(member.id, { zone: undefined })}>
                  Take them off it
                </Button>
              ) : undefined}
              onCommit={({ value: name }) => {
                const found = company.zones.find((z) => (zoneNameOf(z.id) ?? z.id) === name);
                if (!found) return 'Choose a run from the list.';
                setMember(member.id, { zone: found.id });
              }}
            />
          </LiveFact>
        </Facts>
        {book.length > 0 && (
          <List testid="book-rows">
            {(wholeBook ? book : book.slice(0, BOOK_PREVIEW)).map((c) => (
              <Row
                key={c.id}
                testid={`book-${c.id}`}
                mark="who"
                label={<Door onOpen={() => openCustomer(c.id)} label={`Open ${c.name}`} testid={`open-${c.id}`}>{c.name}</Door>}
                sub="Theirs to answer."
              />
            ))}
            {book.length > BOOK_PREVIEW && (
              <Row
                testid="book-all"
                mark="team"
                label={wholeBook ? `The first ${BOOK_PREVIEW} of them` : `All ${book.length} of them`}
                sub={`Every account ${member.name.split(/\s+/)[0]} answers for.`}
                onOpen={() => setWholeBook((on) => !on)}
              />
            )}
          </List>
        )}
        {member.zone && (
          <div>
            <Button
              kind={KIND.tertiary}
              size={SIZE.compact}
              shape={SHAPE.pill}
              data-testid="to-geography"
              onClick={() => { window.location.hash = `#/${ADMIN}/geography/${member.zone}`; }}
            >
              Their zone’s band
            </Button>
          </div>
        )}
      </Section>

      {/* HOW THEY ARE REACHED — the phone, because an invite lands by phone (§4), and the address
          BESIDE it (§67.1: «their email where it exists»). Two rows and not one: a house reaches
          its comerciales on WhatsApp and sends them paperwork by mail, and half of them have only
          the first — which is why the address row says what it is for when it is empty rather than
          drawing a dash. */}
      <Section title="How they are reached" testid="reach">
        <List testid="reach-rows">
          {/* ── THE REACH IS THE ROW'S OWN LINE, AND THAT IS A 390 FINDING ────────────────────
              Drawn in the trailing column these two came out as «+34 631 10 23» and
              «nuria@peixvilalta.c» — a phone number and an address CLIPPED MID-TOKEN, which is
              the app showing a contact detail wrong rather than showing it small. Measured: the
              row's box came to 388px inside a 358px list, so the list's own `overflow: hidden`
              took the last thirty pixels, and an address has no space in it to fold at.

              So the fact takes the LABEL's seat, which is the column that flexes and shrinks, and
              the sentence under it says what the channel is for. It reads better besides: a phone
              number under a bubble and an address under an envelope need no word «Phone» over
              them — the mark names the channel and the section head asks the question. */}
          {/* ── AND BOTH OF THEM ARE THE FIELD (§122) ────────────────────────────────────────
              These two rows said «Add a number» and «Add an address» — an invitation to act, on a
              control that did nothing. That is the sharpest form of the disease Peter named: the
              app asked and then refused. Now the words ARE the field: press, type, Enter. Both
              write through `setMember`, the same fold the roster, the zone card and the routing
              all read a person out of. */}
          <Row
            testid="phone"
            mark="chat"
            label={
              <span style={{ overflowWrap: 'anywhere' }}>
                <LiveValue
                  value={member.phone}
                  label="The number the day reaches them on"
                  placeholder="Add a number"
                  testid="phone-value"
                  width={220}
                  onWrite={(phone) => setMember(member.id, { phone })}
                />
              </span>
            }
            sub="Where the invite goes, and where the day reaches them."
          />
          <Row
            testid="email"
            mark="email"
            label={
              <span style={{ overflowWrap: 'anywhere' }}>
                <LiveValue
                  value={member.email ?? ''}
                  label="The address paperwork reaches them at"
                  placeholder="Add an address"
                  testid="email-value"
                  width={260}
                  onWrite={(email) => setMember(member.id, { email: email || undefined })}
                />
              </span>
            }
            sub="Where paperwork reaches them."
          />
        </List>
        {/* TAKING SOMEBODY OFF THE ROSTER. It stands where the rest of their standing does, at the
            quietest weight the kit has, and it is absent for the last person in the house — a
            control that can empty a company is a control nobody should be able to press twice. */}
        {onRemove && (
          <div>
            <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} data-testid="remove-member" onClick={onRemove}>
              Take {member.name.split(/\s+/)[0]} off the team
            </Button>
          </div>
        )}
      </Section>
        </>
      )}

    </div>
  );
}

/* ── ASKING SOMEBODY IN (clause four: made WITHIN the part) ───────────────────────────────────
 *
 * ═══ TWO FIELDS, AND THE SECOND ONE IS THE HOUSE'S DECISION, NOT THE PERSON'S (§3.1, §3.3) ═══
 * «Invite by email; the invited user completes their own profile; NO ADMINISTRATOR FILLING
 * POINTLESS FIELDS FOR ANOTHER PERSON.» The card used to ask an administrator for somebody else's
 * name and somebody else's phone number — two facts they may not have, typed on behalf of a person
 * sitting one desk away who is about to type them properly. So the card asks the two things the
 * HOUSE actually knows and actually decides: where to send it, and what they are being asked in as.
 * Everything else arrives with them.
 *
 * ═══ ONE ADDRESS FIELD, AND IT TAKES BOTH (map 3.2, the fork recorded rather than closed) ═════
 * FEED-IA §90.2 ruled it: EMAIL LEADS, and THE-ADMIN-CANON §4's phone-first note yields. So the
 * placeholder, the label and the validation all speak email first. The field still ACCEPTS a
 * number, because a house that reaches its repartidores only on WhatsApp is the case the canon's
 * old note was written for, and closing that door is Peter's call and not this file's. Whichever
 * arrives, it is ONE field and one act.
 *
 * ═══ WHAT THE ROSTER KNOWS THEM BY UNTIL THEY ANSWER ═════════════════════════════════════════
 * The address. It is written into the member's `name` deliberately: a roster row has to say
 * SOMETHING, the address is the only true thing anybody has said about that person, and every
 * roster in the trade shows exactly that for a pending invite. The moment they accept, their own
 * name replaces it.
 */

/** an address is one this act can send to when it is an email, or a number with enough digits in
 *  it to be a phone. Same validator `supplier-forwarding.tsx` already uses, so the app has one
 *  answer to «is that an address» rather than two. */
const reachable = (v: string): boolean => validateEmail(v.trim()) || (v.replace(/\D/g, '').length >= 9);

function AddPerson({ isOpen, onClose, onAdded }: { isOpen: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const [, theme] = useStyletron();
  const [address, setAddress] = React.useState('');
  const [role, setRole] = React.useState<RoleId>('comercial');

  React.useEffect(() => { if (isOpen) { setAddress(''); setRole('comercial'); } }, [isOpen]);

  const ready = reachable(address);

  return (
    <OverlayCard isOpen={isOpen} onClose={onClose} scrim={SCRIM.dim} size={520} ariaLabel="Invite somebody">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Invite somebody</h2>
          <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
            They fill in their own name, number and photo when they accept.
          </p>
        </div>
        <Input
          value={address}
          onChange={(e) => setAddress((e.target as HTMLInputElement).value)}
          placeholder="nombre@tucasa.es"
          aria-label="Their email"
          overrides={{ Input: { props: { 'data-testid': 'add-address', type: 'email', autoComplete: 'off' } } }}
        />
        <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          {ROLES_IN_ORDER.map((r) => (
            <span key={r} data-selected={role === r ? 'yes' : 'no'}>
              <Button
                kind={role === r ? KIND.primary : KIND.secondary}
                shape={SHAPE.pill}
                size={SIZE.compact}
                data-testid={`add-role-${r}`}
                onClick={() => setRole(r)}
              >
                {ROLE_LABEL[r]}
              </Button>
            </span>
          ))}
        </div>
        <div>
          <Button
            kind={KIND.primary}
            size={SIZE.compact}
            disabled={!ready}
            data-testid="add-save"
            onClick={() => {
              const clean = address.trim();
              /* ONE PRESS, TWO HALVES OF ONE FACT: the roster gains the person (the company store's
                 store's own act writes the person AND the pending mark in one publish, so a
                 roster can never hold a member whose invite went missing. */
              const id = invite(clean, role);
              onAdded(id);
              onClose();
            }}
          >
            Send the invite
          </Button>
        </div>
      </div>
    </OverlayCard>
  );
}

/* ── THE SEAT ─────────────────────────────────────────────────────────────────────────────── */

export default function Team() {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const company = useCompany();
  const { derived } = useConfig();
  const cast = derived.cast;
  const [picked, setPicked] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  usePanes(!phone);
  /* ONE PANE AT A TIME BELOW THE CONTINUUM'S STACKED RUNG (FEED-IA §103) */
  const stacked = useStacked();

  /* THE CARD IS ALWAYS THERE ON A DESK (§38: a pane with nothing in it is a hole in the layout).
     It opens on the person whose account this is — the owner — because that is who is reading. */
  React.useEffect(() => {
    /* AND A STACKED DESK LANDS ON THE LIST (FEED-IA §103). Opening a card by default is right
       where the card stands BESIDE the roster; where it stands INSTEAD of it, the app would be
       choosing a person nobody asked for and hiding the way to the others. */
    if (phone || stacked || picked !== null || company.members.length === 0) return;
    setPicked(company.members[0].id);
  }, [phone, stacked, picked, company.members]);

  /* ── THE PERSON'S OWN LANDING (§43, the scheme in `anchors.tsx`) ─────────────────────────
     `openUser(id)` from a customer's sheet, a zone's band or the agent's routing lands HERE, on
     that person's card. It is the same act as pressing their row. */
  useLanding('user', (id) => {
    if (company.members.some((m) => m.id === id)) setPicked(id);
  });

  const member = company.members.find((m) => m.id === picked) ?? null;
  const book = member ? bookOf(cast, member.id).map((c) => ({ id: c.id, name: c.name })) : [];
  /** how many of the roster have been asked and have not answered — counted off the roster the head
   *  is counting, so the two halves of that sentence can never disagree */
  const waiting = invitedCount(company);

  /* HOW MANY ACCOUNTS EACH OF THEM HOLDS, counted ONCE for the whole roster (§31.1: scale is what
     turns a per-row scan into a frame drop). Thirteen rows walking three hundred customers each is
     four thousand comparisons per render; one pass over the book is three hundred. It is counted
     off the SAME book the customers area draws, so a headcount here and the book there can never
     disagree — which is the split-brain `bookOf` exists to prevent. */
  const holdsOf = React.useMemo(() => {
    const tally = new Map<string, number>();
    cast.customers.forEach((c) => {
      if (!c.comercial) return;
      tally.set(c.comercial, (tally.get(c.comercial) ?? 0) + 1);
    });
    return (id: string): number => tally.get(id) ?? 0;
  }, [cast]);

  const list = (
    <div
      data-testid="roster"
      data-count={company.members.length}
      style={{
        boxSizing: 'border-box',
        minHeight: 0,
        overflowY: phone ? 'visible' : 'auto',
        overflowX: phone ? 'visible' : 'clip',
        minWidth: 0,
      }}
    >
      <div
        data-testid="roster-head"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          padding: `${theme.sizing.scale300} ${theme.sizing[GUTTER]} ${theme.sizing.scale400}`,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        {/* THE HEAD COUNTS THE ROSTER, AND SAYS HOW MUCH OF IT IS STILL WAITING. A house that has
            just sent three invites wants that fact at the top of the list rather than found by
            scrolling for chips — and it is one clause, added only where it is true. */}
        <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: 0 }} data-testid="roster-count">
          {company.members.length} people{waiting > 0 ? ` · ${waiting} invited` : ''}
        </span>
        <Button kind={KIND.secondary} size={SIZE.mini} shape={SHAPE.pill} data-testid="add-person" onClick={() => setAdding(true)}>
          Invite somebody
        </Button>
      </div>

      {company.members.map((m) => (
        <MemberRow
          key={m.id}
          member={m}
          zone={m.zone ? zoneNameOf(m.zone) ?? m.zone : undefined}
          holds={holdsOf(m.id)}
          selected={m.id === picked}
          onPick={() => setPicked(m.id)}
        />
      ))}
    </div>
  );

  const card = member && (
    <div
      data-testid="member-card"
      data-member={member.id}
      style={{
        boxSizing: 'border-box',
        minHeight: 0,
        overflowY: phone ? 'visible' : 'auto',
        overflowX: phone ? 'visible' : 'clip',
        borderLeft: phone || stacked ? undefined : `1px solid ${theme.colors.borderOpaque}`,
        paddingLeft: phone ? 0 : theme.sizing.scale700,
        paddingRight: phone ? 0 : theme.sizing.scale700,
        paddingTop: theme.sizing.scale500,
        paddingBottom: theme.sizing.scale900,
        minWidth: 0,
      }}
    >
      <MemberCard
        member={member}
        book={book}
        /* THE WAY BACK STANDS WHEREVER THE LIST IS BEHIND THE CARD (§103), never only on a phone */
        onBack={phone || stacked ? () => setPicked(null) : undefined}
        /* THE LAST PERSON STAYS, AND SO DOES THE LAST ADMIN. `company.ts` normalises both, and the
           control simply does not offer the move — a switch that can lock you out of your own
           business is a switch that will, and so is a button. */
        onRemove={company.members.length > 1 && !(member.admin && adminCount(company) <= 1)
          ? () => { removeMember(member.id); setPicked(null); }
          : undefined}
        onCleared={() => setPicked(null)}
      />
      {phone && <div style={{ height: BOTTOM_NAV_HEIGHT }} />}
    </div>
  );

  return (
    <Page title={meta.title} fill={!phone}>
      {phone ? (
        member ? card : list
      ) : (
        <div
          data-testid="team-panes"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'grid',
            /* THE ROSTER HAS A FLOOR. `1fr` beside a fixed card is «whatever is left», and whatever
               is left at 1024px is a column of initials — so the CARD is what yields. */
            /* AND UNDER THE STACKED RUNG THERE IS ROOM FOR ONE (FEED-IA §103). The desk keeps
               its rail and its box; the two panes stand one at a time and the card's own head is
               the way back — the push model, at the widths that cannot hold two honest panes. */
            gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : `minmax(260px, ${LIST_PANE}px) minmax(0, 1fr)`,
            minWidth: 0,
          }}
        >
          {(!stacked || !member) && list}
          {(!stacked || member) && card}
        </div>
      )}
      <AddPerson isOpen={adding} onClose={() => setAdding(false)} onAdded={(id) => setPicked(id)} />
    </Page>
  );
}
