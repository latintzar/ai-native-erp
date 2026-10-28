/* HOUSE — the founder's own control, and the one surface in this app that is about the KIT.
 *
 * ═══ WHY THIS FILE EXISTS (FEED-IA §89.2) ═══════════════════════════════════════════════════
 * «I wanted it seeded with data for a fish company, for a meat company, and for a vegetable
 * company, which I would be able to access if I go to settings and then the founder settings tab
 * or the account settings. There I just change which seeded data it has. I would be able to reset
 * the seeded data and everything else. The reason is… I'll be able to use it for demo.»
 *
 * THREE HOUSES, ONE SWITCH, AND THE SWITCH IS TOTAL. Picking a house re-seeds the whole app —
 * catalogue, book, morning, prices, zones — so a demo to a meat company runs on a meat house and
 * every surface in it says meat without one screen knowing that a switch happened. The act itself
 * lives in `config.ts` (`switchHouse` · `resetHouse`), which is where the storage keys and the
 * boot are reasoned about; this file is the surface that calls it.
 *
 * ═══ IT IS PRODUCT, AT THE §89.1 BAR ════════════════════════════════════════════════════════
 * «This is all the actual product… This is the final, essentially, UI-type thing so I want us to
 * be super solid.» So this reads as a settings region and not as a panel of levers: the houses
 * carry their own names and their own trades off the cast, the acts are confirmed the way money is
 * confirmed, and the words on it are the words a house would read.
 *
 * ═══ WHY IT IS A REGION AND NOT A TENTH SEAT ════════════════════════════════════════════════
 * The shell globs `areas/admin/*.tsx` for a `meta` export and registers what it finds. This module
 * exports none, so the rail never grows a seat for it — and §89.2 puts it «in the account settings»
 * anyway, which is where the personal scope already lives (`account.tsx`, THE-ADMIN-CANON §7). It
 * lands at that seat's foot, under a hairline, the same way the personal scope is broken off the
 * business scope one level up.
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ HOUSE · a region at the foot of Cuenta, inside its one column (§87) ────────────────────┐
 *   │ ────────────────────────────── hairline ──────────────────────────────────────────────── │
 *   │ HEADING  House — and one line saying whose control this is and what it does               │
 *   │ HOUSES   ┌────────────┐ ┌────────────┐ ┌────────────┐   three cards, the standing one     │
 *   │          │Peix Vilalta│ │Carns Bofill│ │Fruites Amat│   ringed and marked in words        │
 *   │          │Fish        │ │Meat        │ │Fruit and v.│                                     │
 *   │          │· standing ·│ └────────────┘ └────────────┘                                     │
 *   │          └────────────┘                                                                   │
 *   │ SEED     [Reset this house]  what returns when it is pressed                              │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS   HeadingSmall (the region, and a card's house name) · HeadingXSmall (a section) ·
 *                LabelMedium (a house's name on its card) · LabelSmall (its trade) ·
 *                ParagraphSmall (a line under a heading) · LabelXSmall (the standing marker).
 *
 *   STATES       THE STANDING HOUSE IS MARKED STRUCTURALLY — a full-ink ring and a WORD, never by
 *                colour, which is `plan.tsx`'s band law and the same reason: colour carries
 *                identity in this system and structure carries state (§51). Both states hold a 2px
 *                ring, one of them transparent, so choosing a house moves nothing on the page.
 *
 *   ══ AND THE SECOND CONTROL, BESIDE IT: THE STAGE (FEED-IA §100) ═════════════════════════════
 *   «What are the different entry points, the different stages I start with, so that I can
 *   understand where I'm going.» The house says WHICH WORLD; the stage says WHICH MOMENT of that
 *   world's own journey, and the two compose — eight moments × three houses, entered in one press.
 *
 *   ┌─ STAGE · the second region, in the same column, under House ─────────────────────────────┐
 *   │ HEADING  Stage — and one line saying whose control this is and what it does               │
 *   │ STAGES   the eight moments as a LIST, in the journey's own order: mark · name · what is   │
 *   │          true at it · and the one standing marked in words                                │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   IT IS A LIST AND NOT A GRID OF CARDS, and the reason is the object: a journey is ORDERED, and
 *   eight cards reflowing across a column would say these are eight alternatives when they are one
 *   ladder. It is the same list the journey modal draws its own ten steps in, one level up.
 *
 *   WHAT PRESSING ONE DOES lives in `activation.ts` (`seedStage`), which is where the ledger is
 *   reasoned about — this file is the surface that calls it, exactly as it is for the house.
 *
 *   CONFIRMATION BOTH ACTS ARE REVIEWED BEFORE THEY RUN (§76). «Strong review/confirmation states
 *                for actions that matter»; «input feels safe, obvious and reversible»; «one clear
 *                task at a time»; «bottom sheets / popovers instead of sending users into deep edit
 *                pages»; «big tappable controls, minimal prose». So each act opens an `OverlayCard`
 *                at the size this codebase already gives a decision, the house is the value with
 *                visual priority, the prose is one line, and both ways out are named in full: the
 *                primary says the act and the secondary says what staying means.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { List, Row, Section, type MarkId } from '../../rows';
import { resetHouse, switchHouse, useConfig, type SectorKey } from '../../config';
import { CASTS, SECTORS } from '../../../../scenarios/data/cast';
import {
  STAGES, seedStage, stageNamed, useStage, type Stage, type StageId,
} from '../../activation';
import { CHAPTER, landStage, playChapter } from '../../activation-web';

/** WHAT A HOUSE IS MADE OF, SAID ONCE. Both cards below name the same five things, because they
 *  are the same five things — a switch brings them and a reset returns them, and two lists that
 *  drifted apart would describe two different products. It leads a sentence in both places, so it
 *  is written to start one. */
const BRINGS = 'Its products, customers, orders and delivery routes';

/** ONE HOUSE, AS A CARD. The name leads, its trade sits under it, and the house the app is running
 *  as says so in words. Built on `plan.tsx`'s band card, which is the same decision one level down:
 *  a small set of alternatives, one of them held, chosen in place. */
function HouseCard({
  sector,
  standing,
  onPick,
}: {
  sector: SectorKey;
  standing: boolean;
  onPick: () => void;
}) {
  const [, theme] = useStyletron();
  const cast = CASTS[sector];
  return (
    <button
      type="button"
      data-testid={`founder-house-${sector}`}
      data-standing={standing ? 'yes' : 'no'}
      /* THE CHOICE IS A RADIO AND SAYS SO. The house that is standing is the option already
         taken, so it reads as pressed and stays where it is; the review card belongs to a house
         you are MOVING to, and opening one over the house you are already on would be the app
         asking a question it has the answer to. */
      aria-pressed={standing}
      onClick={standing ? undefined : onPick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.sizing.scale200,
        padding: theme.sizing.scale600,
        border: `2px solid ${standing ? theme.colors.contentPrimary : 'transparent'}`,
        outline: `1px solid ${theme.colors.borderOpaque}`,
        outlineOffset: -1,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        textAlign: 'left',
        cursor: standing ? 'default' : 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>{cast.house.name}</span>
      <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
        {cast.trade}
      </span>
      {standing && (
        <span
          data-testid="founder-standing"
          style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentPrimary }}
        >
          The app runs on this one
        </span>
      )}
    </button>
  );
}

/** The two buttons a decision card ends on, at the step and the spacing every card in this app
 *  ends on: the act first, then the way that keeps things as they are. */
function Acts({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', minWidth: 0 }}>
      {children}
    </div>
  );
}

/* ── THE MARK A MOMENT WEARS ───────────────────────────────────────────────────────────────────
 * Out of the app's ONE vocabulary (`MarkId`), and each one is the thing that moment is about: the
 * link that went out, the person who came in, the file, the reading, the year read back, the test
 * conversation, the named accounts, the day. The words carry the meaning; the mark is what makes
 * eight rows scannable.
 */
const STAGE_MARK: Record<StageId, MarkId> = {
  invite: 'send',
  claimed: 'who',
  uploading: 'file',
  processing: 'clock',
  ready: 'eye',
  testing: 'chat',
  bounded: 'team',
  mature: 'check',
};

function StageRegion() {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;
  const here = useStage(cast);
  const standing = stageNamed(here);
  const [moving, setMoving] = React.useState<StageId | null>(null);
  const target = moving ? stageNamed(moving) : null;

  /* ── THE STAGE CHANGE IS THE ONE CINEMATIC BEAT (FEED-IA §102.1) ─────────────────────────
   * «Moving between stages is a DESIGNED MOMENT — a chapter divider with its own dreamy
   * transition.» So the review card leaves at once (the press is acknowledged, §91.1's own
   * asymmetry) and the chapter plays; the SEED AND THE LANDING HAPPEN INSIDE THE BEAT, under the
   * light, so nobody ever watches a house re-seed itself. `playChapter` is the whole seam and this
   * is one of its two callers — the other is the front door, which is this same act at the app's
   * threshold. Nothing else in the app may fire it. */
  const go = (stage: Stage) => {
    setMoving(null);
    playChapter(CHAPTER[stage.id], () => {
      seedStage(stage.id, cast);
      landStage(stage.landing);
    });
  };

  return (
    <div
      data-testid="founder-stage"
      data-stage={here}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
    >
      {/* ── THE HEADING NAMES THE THING, and the line under it says whose control this is and
             what one press does — the House region's own two sentences, one object along. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
        <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Stage</h2>
        <p
          style={{
            margin: 0,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
            maxWidth: '58ch',
          }}
        >
          Choose where this workspace opens.
        </p>
      </div>

      <List testid="founder-stages">
        {STAGES.map((s) => (
          <Row
            key={s.id}
            id={s.id}
            testid={`founder-stage-${s.id}`}
            mark={STAGE_MARK[s.id]}
            label={s.name}
            sub={s.said}
            /* THE STANDING MOMENT IS MARKED IN WORDS, on the House region's own sentence pattern —
               structure and language carry state in this system, and colour carries identity
               (§51). The value seat is where a row already says what it currently holds. */
            value={s.id === here ? (
              <span data-testid="founder-stage-standing" data-stage={s.id}>
                The app is here
              </span>
            ) : undefined}
            wrapValue
            onOpen={s.id === here ? undefined : () => setMoving(s.id)}
          />
        ))}
      </List>

      {/* ═══ THE REVIEW BEFORE THE APP MOVES (§76) ════════════════════════════════════════════
          Switching is deliberate, so the press raises a card and the card's primary is the act.
          The moment is the VALUE and leads at the heading step; THE HOUSE IS NAMED UNDER IT,
          because a stage is always a moment OF a house and the two compose — the card is where a
          person reads which world they are about to see this moment in. */}
      <OverlayCard
        isOpen={moving !== null}
        onClose={() => setMoving(null)}
        scrim={SCRIM.dim}
        size={480}
        ariaLabel={target ? `Open at ${target.name}` : 'Open a stage'}
      >
        {target && (
          <div
            data-testid="founder-stage-card"
            data-stage={target.id}
            style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
              <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>{target.name}</h2>
              <span
                data-testid="founder-stage-house"
                style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}
              >
                {cast.house.name}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentPrimary,
                maxWidth: '52ch',
              }}
            >
              {target.said}
            </p>
            <p
              style={{
                margin: 0,
                ...theme.typography.ParagraphXSmall,
                color: theme.colors.contentTertiary,
                maxWidth: '52ch',
              }}
            >
              {`Rocoto opens on ${target.lands}.`}
            </p>
            <Acts>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                data-testid="founder-stage-go"
                onClick={() => go(target)}
              >
                {`Open at ${target.name}`}
              </Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setMoving(null)}>
                {`Stay at ${standing.name}`}
              </Button>
            </Acts>
          </div>
        )}
      </OverlayCard>
    </div>
  );
}

export function Founder() {
  const [, theme] = useStyletron();
  const { config } = useConfig();
  /* the house the app is running as, off the one field that decides it (`config.cast`) */
  const here = CASTS[config.cast];
  const [moving, setMoving] = React.useState<SectorKey | null>(null);
  const [resetting, setResetting] = React.useState(false);
  /* the house under review, carried as its own sector AND its cast, so the card's act reads the
     same value the card's words came from */
  const target = moving ? { sector: moving, cast: CASTS[moving] } : null;

  return (
    <section
      data-testid="founder-region"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale700,
        paddingTop: theme.sizing.scale800,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      {/* ── THE HEADING CARRIES THE MESSAGE ────────────────────────────────────────────────
          A heading NAMES the thing under it, blatantly, and the sentence beneath says whose
          control this is and what pressing it does. §89.2's own word for the object is «house». */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
        <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>House</h2>
        <p
          style={{
            margin: 0,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
            maxWidth: '58ch',
          }}
        >
          Choose the company data used across this workspace.
        </p>
      </div>

      {/* ── THE THREE HOUSES ───────────────────────────────────────────────────────────────
          Every word on them is the cast's — the company's own name and the trade's own word for
          itself (law 10). A fourth house is a fourth cast and nothing here changes. */}
      <div
        data-testid="founder-houses"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: theme.sizing.scale400,
          minWidth: 0,
        }}
      >
        {SECTORS.map((s) => (
          <HouseCard
            key={s}
            sector={s}
            standing={s === config.cast}
            onPick={() => setMoving(s)}
          />
        ))}
      </div>

      {/* ── THE SEED ───────────────────────────────────────────────────────────────────────
          The same shape the seat's own «Signing out» section keeps: the control, and one line
          beside it saying what it does. */}
      <Section title="Seeded data" testid="founder-seed">
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, flexWrap: 'wrap', minWidth: 0 }}>
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            data-testid="founder-reset"
            onClick={() => setResetting(true)}
          >
            Reset this house
          </Button>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
            {`${here.house.name} goes back to its seed.`}
          </span>
        </div>
      </Section>

      {/* ── THE SECOND CONTROL (§100) ──────────────────────────────────────────────────────
          The house is picked first because it decides WHICH WORLD, and the stage second because it
          decides WHICH MOMENT of that world — the order a person reasons in, which is the order
          §98.3 asks every page to stand its regions in. */}
      <StageRegion />

      {/* ═══ THE REVIEW BEFORE A HOUSE CHANGES (§76) ══════════════════════════════════════
          The house you are moving to is the VALUE, so it leads at the heading step with its trade
          under it; one line says what arrives with it; the primary says the act and the secondary
          names the house you would be staying on. Minimal prose, two big controls, one task. */}
      <OverlayCard
        isOpen={moving !== null}
        onClose={() => setMoving(null)}
        scrim={SCRIM.dim}
        size={480}
        ariaLabel={target ? `Move to ${target.cast.house.name}` : 'Move house'}
      >
        {target && (
          <div
            data-testid="founder-switch-card"
            data-house={target.sector}
            style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
              <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>{target.cast.house.name}</h2>
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                {target.cast.trade}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentPrimary,
                maxWidth: '52ch',
              }}
            >
              {`${BRINGS} arrive with it.`}
            </p>
            <Acts>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                data-testid="founder-switch-go"
                onClick={() => switchHouse(target.sector)}
              >
                {`Move to ${target.cast.house.name}`}
              </Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setMoving(null)}>
                {`Stay on ${here.house.name}`}
              </Button>
            </Acts>
          </div>
        )}
      </OverlayCard>

      {/* ═══ THE STRONGER REVIEW, BECAUSE A RESET REACHES THE WORK DONE HERE (§76) ════════
          It says MORE than the switch card and it says it in the positive: the heading names the
          act on the house by name, the block states what returns, and the line under it says
          plainly what the seed takes the place of. The primary is §89.2's own sentence. */}
      <OverlayCard
        isOpen={resetting}
        onClose={() => setResetting(false)}
        scrim={SCRIM.dim}
        size={480}
        ariaLabel={`Reset ${here.house.name}`}
      >
        <div
          data-testid="founder-reset-card"
          data-house={config.cast}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
        >
          <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>{`Reset ${here.house.name}`}</h2>
          <div
            style={{
              padding: theme.sizing.scale600,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius300,
              background: theme.colors.backgroundSecondary,
              minWidth: 0,
            }}
          >
            <p
              style={{
                margin: 0,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentPrimary,
                maxWidth: '52ch',
              }}
            >
              {`${BRINGS} go back to their seeded values.`}
            </p>
          </div>
          <p
            style={{
              margin: 0,
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentTertiary,
              maxWidth: '52ch',
            }}
          >
            The seed takes the place of the work done in this house.
          </p>
          <Acts>
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              data-testid="founder-reset-go"
              onClick={() => resetHouse()}
            >
              Return it to its seed
            </Button>
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setResetting(false)}>
              Keep this house as it is
            </Button>
          </Acts>
        </div>
      </OverlayCard>
    </section>
  );
}
