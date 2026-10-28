import { soles } from '../../currency';
/* GEOGRAFÍA — the ground the house covers, and what it promises on each piece of it.
 *
 * «Maybe that would be the one about coverage, and there are different bands» (FEED-IA §53).
 *
 * ═══ WHAT A BAND IS, AND WHY IT IS LOAD-BEARING ═════════════════════════════════════════════
 * A zone is not a decoration on a customer's row. It is the set of PROMISES Rocoto makes when it
 * answers a customer on that ground: which days the van goes, the hour an order has to be in by,
 * the smallest order the run will carry, and what carriage costs. WRONG BAND, WRONG PROMISE — the
 * agent says something the house then has to break, and it will have said it in the house's name.
 * That is the whole reason this seat exists as its own place rather than as a column somewhere.
 *
 * ═══ THE ZONES ARE THE RUNS, NEVER A SECOND LIST ════════════════════════════════════════════
 * `cast.ts`'s `RUNS` already says which vans cover which ground, and `company.ts` folds them into
 * bands — two vans on one zone are ONE zone with two trucks, because the coast is one promise
 * carried by two vehicles. A seat that kept its own list of zones would be the place the map and
 * the customers' chips could quietly stop agreeing about the world.
 *
 * ═══ THE WIREFRAME (§51.24, and §39's grammar — panes: true) ════════════════════════════════
 *
 *   ┌─ GEOGRAFÍA ──────────────────────────────┬───────────────────────────────────────────────┐
 *   │ LIST                                      │ CARD                                          │
 *   │  ┌ HEAD  «6 zones»                        │  HEAD    the zone's name · trucks · accounts  │
 *   │  ├ ROW   Litoral         LabelMedium      │  MAP     the REAL map, the zone's customers   │
 *   │  │       Truck 2 · 7 · Mon–Sat  ParaXS    │          pinned (§25.4: real tiles, ink pin)  │
 *   │  └ …                                       │  BAND    days · cutoff · minimum · carriage   │
 *   │                                            │          — labelled FACTS, editable in place  │
 *   │                                            │  WHO     comercial de zona → a DOOR to Team   │
 *   └───────────────────────────────────────────┴───────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingSmall (the zone) · HeadingXSmall (a section, a fact's figure) ·
 *                LabelMedium (a row) · LabelXSmall (a fact's label) · ParagraphXSmall (the line).
 *   STATES       band facts are editable in place (§51.14's one grammar); a zone always serves at
 *                least one day (`company.ts` normalises), because a zone with no days is a promise
 *                the agent cannot keep and the honest way to stop serving ground is to drop it.
 *   PHONE        the list, and a card pushed over it (§38).
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Input } from 'baseui/input';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { useConfig } from '../../config';
import { Door, openCustomer, openUser } from '../../anchors';
import { Editable, Fact, Facts, List, Row, Section } from '../../rows';
import { BOTTOM_NAV_HEIGHT, usePanes, usePhone, useStacked, Page } from '../../shell';
import { ADMIN, type AreaMeta } from '../../shell/area';
import PinMap from '../../pin-map';
import RoundMap from '../../round-map';
import { daysWords, orderedDays } from '../../grants';
import { ROLE_LABEL, memberOf, setZone, useCompany, zoneWordOf, type ZoneBand } from '../../company';
/* §122 — a run's name, its vans and who holds it are all authored, so all three are live here. */
import { LiveValue } from '../../live-value';
/* E200.07 · the run's comercial is the product sheet's own filtering field (§196.1). */
import { LiveField } from '../../live-field';
/* ONE DRAWING OF A PERSON, IMPORTED FROM WHERE PEOPLE LIVE (§67.1). Team is the person object's
   home (`anchors.tsx`'s HOME_OF), so the chip is Team's to own and this seat's to use — a second
   copy here is the place a zone card and a roster would quietly stop agreeing. */
import { PersonChip } from './team';
import { Glyph, STEP } from '../../glyphs';

export const meta: AreaMeta = {
  id: 'geography',
  title: 'Geography',
  owner: 'V2-ADMIN',
  panes: true,
  /* NO LANE. The lane exists so the frame's floating conversation steps clear of a sheet's own
     STICKY ACTION BAR (§39.3); this card has none, so reserving a lane would push the launcher over
     the list instead of out of the way. */
};

/** the roster/zone list's own measure — wide enough for a name and its run, and no wider */
const LIST_PANE = 320;
const GUTTER = 'scale600';

/** the week, in a delivery week's own order — Monday first, because a van's week starts then */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun',
};

/* ── A BAND FACT YOU CAN CHANGE ────────────────────────────────────────────────────────────────
 * `Fact`'s anatomy — label over figure — with the figure in the editable grammar. The band is the
 * thing the agent quotes, so every one of its four numbers is one press from being right.
 */
function BandFact({
  label,
  value,
  placeholder,
  onSave,
  testid,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  testid: string;
}) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { setDraft(value); }, [value, open]);

  return (
    <span data-fact={testid} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{label}</span>
      <span style={{ ...theme.typography.HeadingXSmall, lineHeight: 1.1, minWidth: 0 }}>
        <Editable label={label} open={open} onOpen={() => setOpen(true)} testid={testid}>
          <span style={{ whiteSpace: 'nowrap' }}>{value || placeholder}</span>
        </Editable>
      </span>

      <OverlayCard isOpen={open} onClose={() => setOpen(false)} scrim={SCRIM.dim} size={480} ariaLabel={label}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{label}</h2>
          <Input
            value={draft}
            onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
            placeholder={placeholder}
            aria-label={label}
            overrides={{ Input: { props: { 'data-testid': `${testid}-input` } } }}
          />
          <div>
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              data-testid={`${testid}-save`}
              onClick={() => { onSave(draft.trim()); setOpen(false); }}
            >
              Save
            </Button>
          </div>
        </div>
      </OverlayCard>
    </span>
  );
}

/* ── THE ZONE'S CARD ──────────────────────────────────────────────────────────────────────── */

function ZoneCard({
  zone,
  customers,
  notes,
  onPick,
  onBack,
}: {
  zone: ZoneBand;
  /** the accounts standing on this ground, off the cast's own book */
  customers: Array<{ id: string; name: string; at?: { lat: number; lng: number } }>;
  /** the one line each run carries on the map — the house's own words about it */
  notes: Record<string, string>;
  /** pressing a run on the map is the same act as pressing its row in the list */
  onPick: (id: string) => void;
  onBack?: () => void;
}) {
  const [, theme] = useStyletron();
  const company = useCompany();
  const who = memberOf(company, zone.comercial);
  /* THE HOUSE'S OWN WORD FOR THE RUN, WITH THE MAP'S AS THE FALLBACK (§122 · `zoneWordOf`). */
  const name = zoneWordOf(zone.id) ?? zone.id;
  /** the account the pin stands on — the zone's own first, so the ground under it is ground the run
   *  actually drives, never a guessed centre */
  const pinned = customers.find((c) => c.at);
  const anchor = pinned?.at;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale800, minWidth: 0 }}>
      {onBack && (
        <div>
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onBack} data-testid="zone-back" aria-label="Back to Geography" title="Back to Geography" overrides={{ BaseButton: { style: { width: '48px', height: '48px', minWidth: '48px', paddingLeft: 0, paddingRight: 0 } } }}>
            <Glyph id="back" size={STEP.medium} />
          </Button>
        </div>
      )}

      <div style={{ minWidth: 0 }}>
        {/* ── THE RUN'S NAME IS THE HOUSE'S, NOT THE MAP'S (§122) ─────────────────────────────
            «Litoral» was seeded by the geography file and printed as a heading nothing could
            touch, so a house that calls its coast run «Costa Norte» read somebody else's word for
            its own territory on every chip in the app. `ZoneBand` carries the house's word now
            and `zoneWordOf` prefers it. */}
        <h2 data-testid="zone-name" style={{ margin: 0, ...theme.typography.HeadingSmall }}>
          <LiveValue
            value={name}
            label="What this house calls this run"
            placeholder="Name the run"
            testid="zone-name-value"
            size="default"
            width={260}
            onWrite={(word) => setZone(zone.id, { name: word || undefined })}
          />
        </h2>
        <p style={{ margin: `${theme.sizing.scale100} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {/* THE VANS ON IT ARE A DECISION (§122 · `cast.ts`: «the coast is one promise carried by
              two vans»), so the list is written here — comma-separated, because two vans on a long
              run is the ordinary case rather than the exception. THE ACCOUNT COUNT BESIDE IT IS
              COUNTED and stays a fact. */}
          <LiveValue
            value={zone.trucks.join(', ')}
            label="The vans that run it"
            placeholder="Choose a van"
            testid="zone-trucks-value"
            width={120}
            onWrite={(said) => {
              const vans = said.split(/[^\d]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
              setZone(zone.id, { trucks: vans.length ? vans : zone.trucks });
            }}
          />
          {' · '}
          {customers.length} accounts
        </p>
      </div>

      {/* ── THE GROUND, AND IT IS THE SELECTION DEVICE (THE CHECKPOINT §19.2, §19.3) ────────────
          «Map / choropleth-like selection; hover/direct selection; multiple zones; multiple
          trucks; overlapping zones allowed.» All six runs stand on the real coast, this one is
          ink, hovering paints and pressing selects — the same act as pressing the row in the list
          beside it, so the two devices can never disagree about which zone is open.

          IT IS THE FIRST THING ON THE CARD because it is the only one that answers «where». The
          band under it is what the house PROMISES on this ground, and a promise reads differently
          once you can see the ground it is about. */}
      <div data-testid="zone-ground" style={{ minWidth: 0 }}>
        <RoundMap
          zoneId={zone.id}
          truck={zone.trucks[0]}
          notes={notes}
          /* THE CAPTION SAYS WHAT THE CARD SAYS (§122). A run renamed above the picture used to
             keep the map's seeded word underneath it — «Costa Norte» on the heading, «Gràcia» in
             the figcaption, on one screen. Found by LOOKING at the 1600 shot. */
          nameOf={zoneWordOf}
          onPick={onPick}
          note={`${company.zones.length} runs`}
        />
      </div>

      {/* THE BAND — four facts, and every one of them a promise the agent makes */}
      <Section title="Delivery coverage" testid="band">
        <Facts testid="band-facts">
          <BandFact
            label="Cut-off"
            value={zone.cutoff}
            placeholder="20:00"
            testid="cutoff"
            onSave={(cutoff) => setZone(zone.id, { cutoff })}
          />
          <BandFact
            label="Smallest order"
            value={soles(zone.minimum, 0)}
            placeholder="S/ 80"
            testid="minimum"
            onSave={(v) => setZone(zone.id, { minimum: Number(v.replace(/[^\d]/g, '')) || zone.minimum })}
          />
          <BandFact
            label="Carriage on us from"
            value={soles(zone.carriage, 0)}
            placeholder="S/ 250"
            testid="carriage"
            onSave={(v) => setZone(zone.id, { carriage: Number(v.replace(/[^\d]/g, '')) || zone.carriage })}
          />
        </Facts>

        {/* THE DAYS ARE A ROW OF SEVEN, because a week is a shape and a sentence is not. Pressing
            one turns it on or off, immediately — Base's switch law read onto a set: the days a van
            goes out is the most immediate binary in this whole area. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>Delivery days</span>
          <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
            {WEEK.map((d) => {
              const on = zone.days.includes(d);
              return (
                <span key={d} data-day={d} data-selected={on ? 'yes' : 'no'}>
                  <Button
                    kind={on ? KIND.primary : KIND.secondary}
                    shape={SHAPE.pill}
                    size={SIZE.compact}
                    data-testid={`zone-day-${d}`}
                    onClick={() => {
                      const next = on ? zone.days.filter((x) => x !== d) : [...zone.days, d];
                      /* a zone serves at least one day; `company.ts` normalises, and the control
                         simply does not offer the move that would empty it */
                      setZone(zone.id, { days: next.length ? next : zone.days });
                    }}
                  >
                    {DAY_SHORT[d]}
                  </Button>
                </span>
              );
            })}
          </div>
          <span data-testid="zone-days-words" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            The van goes out {daysWords(orderedDays(zone.days))}.
          </span>
        </div>
      </Section>

      {/* WHO HOLDS IT — a DOOR into Team, and their card doors back to this zone (§43, both ways).
          THE SAME PERSON CHIP THE ROSTER DRAWS (§67.1). The row used to be a name and a count, and
          a name is the half of the answer a reader already has: standing on a zone at 07:00 the
          question is «who holds this and how do I get them», so the chip carries the run, the size
          of the book and the reach — one drawing of a person, imported from the seat where people
          live, so a zone card and a roster can never disagree about what a comercial looks like. */}
      <Section title="Who holds this ground" testid="holder">
        <List testid="holder-rows">
          {who && (
            /* THE CHIP SAYS WHAT THE CARD HAS YET TO SAY. The head above already carries the zone,
               its trucks and its account count, so the chip carries the PERSON: what they are in
               the house, and how the house reaches them. A fact drawn twice on one card is a card
               arguing with itself.
               AND IT STANDS WITHOUT A `Row`, deliberately. A row's tile is a generic mark, and a
               person already has one — their own initial. Drawn inside a Row this read as two
               person-marks in a line, which is the identity law («one visual identity per object»)
               broken twice in one cell. The chip's own circle IS the tile, so the box gives it the
               row's padding and its hairline and nothing else. */
            <div
              data-row="zone-comercial"
              style={{
                padding: theme.sizing.scale600,
                borderTop: `1px solid ${theme.colors.borderOpaque}`,
                minWidth: 0,
              }}
            >
              <PersonChip member={who} where={ROLE_LABEL[who.role]} testid="zone-comercial-person" />
            </div>
          )}
          {
            /* ── AND «PICK WHO HOLDS IT» NOW PICKS (§122) ────────────────────────────────
               The row said «Pick who holds it», carried an account count in its value slot, and
               had no `onOpen` and no control: the app naming an act and then refusing it. The
               register is closed — it is the house's own roster — so it picks, and one press on
               an answer writes through `setZone`, the same writer the four rows above it use.
               ⚠ E200.07 · AND IT ALWAYS STANDS. A run that already had somebody drew the chip and
               nothing else, so the one fact a house re-decides the week a comercial leaves could
               not be re-decided at all — §122's law broken on the fact that needs it most. The
               chip is the PERSON (who they are, how the house reaches them); the field is the
               DECISION, and a control that reads like the content beside it is no control.
               AND IT FILTERS (§196.1). A roster is a list a house TYPES into once it
               runs to thirty people, so the seat is the product sheet's own live field: the names
               open on a touch, narrow on every character, and each one carries what that person
               does. A word nobody on the roster answers to is declined. */
            <Row
              testid="zone-comercial"
              mark="who"
              label="Who holds it"
              sub="The comercial your customers on this run already know."
              token
              control={
                <span style={{ display: 'block', width: 'min(240px, 100%)', minWidth: 0 }}>
                  <LiveField
                    id="zone-comercial"
                    declineSays="Choose a person from the roster."
                    label="Who holds it"
                    hideLabel
                    value={who?.name ?? ''}
                    suggestions={company.members.map((m) => ({ value: m.name, id: m.id, note: ROLE_LABEL[m.role] }))}
                    placeholder="Choose a person"
                    allowNew={false}
                    size="compact"
                    inputTestid="zone-comercial-value"
                    listLabel="The people on this house's roster"
                    onCommit={({ value, id }) => {
                      const found = company.members.find((m) => m.id === id) ?? company.members.find((m) => m.name === value);
                      if (!found) return 'Choose a person from the roster.';
                      setZone(zone.id, { comercial: found.id });
                    }}
                  />
                </span>
              }
            />
          }
        </List>
      </Section>

      {/* THE ACCOUNTS ON IT — every one of them a door, because a zone is made of customers.
          AND THE PIN STANDS HERE NOW, WHICH IS WHAT §25 SAYS IT IS. «The location has to be a PIN.
          Real map» is a ruling about a DROP: one door, one coordinate. Standing at the head of the
          card, a single pin was being read as the zone — a run through seventeen towns drawn as one
          dot. The choropleth above answers «which ground»; this answers «where is this account»,
          and it says whose account it is instead of implying it is the run's centre. Same `PinMap`,
          same checked-in tiles, same attribution (§86.7). */}
      {customers.length > 0 && (
        <Section title="Accounts on this run" testid="zone-accounts">
          {anchor && pinned && (
            <div data-testid="zone-map" style={{ borderRadius: theme.borders.radius300, overflow: 'hidden', minWidth: 0 }}>
              <PinMap at={anchor} zone={name} truck={zone.trucks[0]} note={pinned.name} height={200} />
            </div>
          )}
          <List testid="zone-account-rows">
            {customers.slice(0, 6).map((c) => (
              <Row
                key={c.id}
                testid={`zone-account-${c.id}`}
                mark="who"
                label={<Door onOpen={() => openCustomer(c.id)} label={`Open ${c.name}`} testid={`open-${c.id}`}>{c.name}</Door>}
                sub="On this run."
              />
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}

/* ── THE SEAT ─────────────────────────────────────────────────────────────────────────────── */

export default function Geography() {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const company = useCompany();
  const { derived } = useConfig();
  const cast = derived.cast;
  const [picked, setPicked] = React.useState<string | null>(null);

  usePanes(!phone);
  /* ONE PANE AT A TIME BELOW THE CONTINUUM'S STACKED RUNG (FEED-IA §103) */
  const stacked = useStacked();

  /** the accounts standing on each zone's ground, folded once — a card that filtered three hundred
   *  rows on every render would be the linear scan §31.1 is about */
  const byZone = React.useMemo(() => {
    const out = new Map<string, Array<{ id: string; name: string; at?: { lat: number; lng: number } }>>();
    for (const c of cast.customers) {
      /* a cast small enough to have no runs has customers with no zone, and they belong to no
         band — the fruit and meat books are five accounts, which is not a territory */
      if (!c.zone) continue;
      const held = out.get(c.zone) ?? [];
      held.push({ id: c.id, name: c.name, at: c.at });
      out.set(c.zone, held);
    }
    return out;
  }, [cast]);

  React.useEffect(() => {
    if (phone || picked !== null || company.zones.length === 0) return;
    setPicked(company.zones[0].id);
  }, [phone, picked, company.zones]);

  /* A DOOR FROM TEAM ARRIVES WITH A ZONE (`#/admin/geography/<zone>`). The tail belongs to the
     seat, so the seat reads it — the same rule every area on the desk keeps. */
  React.useEffect(() => {
    const read = () => {
      const parts = window.location.hash.replace(/^#\/?/, '').split('/');
      const want = parts[2];
      if (parts[0] !== ADMIN || parts[1] !== 'geography' || !want) return;
      if (company.zones.some((z) => z.id === want)) setPicked(want);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [company.zones]);

  const zone = company.zones.find((z) => z.id === picked) ?? null;

  /* WHAT EACH RUN SAYS ON THE MAP — its vans and the size of its book, in the house's own words.
     The map holds geometry and paint; the words about a run are the house's, so they are handed to
     it rather than looked up inside it. §19.5's «multiple trucks» is a fact about the run, and this
     is where it lands on the picture. */
  const notes = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const z of company.zones) {
      const held = byZone.get(z.id)?.length ?? 0;
      const vans = z.trucks.length === 1 ? `Truck ${z.trucks[0]}` : `Trucks ${z.trucks.join(' and ')}`;
      out[z.id] = `${vans} · ${held} ${held === 1 ? 'account' : 'accounts'}`;
    }
    return out;
  }, [company.zones, byZone]);

  const list = (
    <div
      data-testid="zones"
      data-count={company.zones.length}
      style={{
        boxSizing: 'border-box',
        minHeight: 0,
        overflowY: phone ? 'visible' : 'auto',
        overflowX: phone ? 'visible' : 'clip',
        minWidth: 0,
      }}
    >
      <div
        data-testid="zones-head"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          padding: `${theme.sizing.scale300} ${theme.sizing[GUTTER]} ${theme.sizing.scale400}`,
          background: theme.colors.backgroundPrimary,
          ...theme.typography.LabelSmall,
          minWidth: 0,
        }}
      >
        {company.zones.length} zones
      </div>

      {company.zones.map((z) => {
        const on = z.id === picked;
        /* THE LIST SAYS WHAT THE CARD SAYS (§122). A run renamed on its card has to re-title its
           own row in the list beside it, or the seat is two opinions about one run. */
        const name = zoneWordOf(z.id) ?? z.id;
        const held = byZone.get(z.id)?.length ?? 0;
        return (
          <button
            key={z.id}
            type="button"
            data-zone-row={z.id}
            data-testid={`zone-${z.id}`}
            data-selected={on ? 'yes' : 'no'}
            onClick={() => setPicked(z.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.sizing.scale500,
              width: '100%',
              textAlign: 'left',
              padding: `${theme.sizing.scale500} ${theme.sizing[GUTTER]}`,
              borderLeft: `3px solid ${on ? theme.colors.contentPrimary : 'transparent'}`,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              borderRight: 'none',
              borderBottom: 'none',
              background: on ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
              color: theme.colors.contentPrimary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              minWidth: 0,
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelMedium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {z.trucks.length === 1 ? `Truck ${z.trucks[0]}` : `Trucks ${z.trucks.join(' · ')}`}
                {' · '}
                {daysWords(orderedDays(z.days), true)}
              </span>
            </span>
            <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}>
              {held}
            </span>
          </button>
        );
      })}
    </div>
  );

  const card = zone && (
    <div
      data-testid="zone-card"
      data-zone={zone.id}
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
      <ZoneCard
        zone={zone}
        customers={byZone.get(zone.id) ?? []}
        notes={notes}
        onPick={setPicked}
        /* THE WAY BACK STANDS WHEREVER THE LIST IS BEHIND THE CARD (§103), never only on a phone */
        onBack={phone || stacked ? () => setPicked(null) : undefined}
      />
      {phone && <div style={{ height: BOTTOM_NAV_HEIGHT }} />}
    </div>
  );

  return (
    <Page title={meta.title} fill={!phone}>
      {phone ? (
        zone ? card : list
      ) : (
        <div
          data-testid="geography-panes"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'grid',
            /* THE LIST IS THE NARROW PANE HERE, and that is the opposite of the customers area on
               purpose: a book of three hundred names earns the room, and SIX ZONES do not — the
               first screenshot had a 960px column holding six rows and a card squeezed beside it.
               The card is where the map, the band and the accounts are, so the card takes the
               remainder (§39: list left, the detail with its embeds right). */
            /* AND UNDER THE STACKED RUNG THERE IS ROOM FOR ONE (FEED-IA §103). The desk keeps
               its rail and its box; the two panes stand one at a time and the card's own head is
               the way back — the push model, at the widths that cannot hold two honest panes. */
            gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : `minmax(220px, ${LIST_PANE}px) minmax(0, 1fr)`,
            minWidth: 0,
          }}
        >
          {(!stacked || !zone) && list}
          {(!stacked || zone) && card}
        </div>
      )}
    </Page>
  );
}
