# The scenarios — method

**Historical phase contract, scoped 2026-09-08.** This records the original August scenario work.
The catalogue's later standing is in [SCENARIOS-STATUS](../omitted-sources.md);
current app development starts in [app/README.md](../../app/README.md). The original brief and
method remain design evidence.

The contract for drawing the 58 situations. Written 2026-08-21 from the founder's brief; this is
the document that governs the scenario phase. The kit (baseweb/) must be approved before any
scenario is drawn.

## What a scenario is

One situation the product must survive, drawn as a REAL screen out of kit vocabulary — full
interaction, in one of the three frames (desk / phone / public-no-account).

## Positive space and negative space (the core rule)

Every scenario divides its screen into:

- **POSITIVE SPACE** — the one thing THIS scenario is deciding. Drawn at full fidelity with the
  kit's real components, interactive, and where the subject is a flow, animating (or clickable)
  through it. This is the scenario's entire authority: what it decides, it decides completely.

- **NEGATIVE SPACE** — everything around it: the tabs, the surrounding cards, the nav, the rest
  of the page. Drawn as **structured skeleton**: grey wireframe shapes, no data, no labels beyond
  a whisper of what stands there. Purposefully detail-free — but structurally honest. "There will
  be some kind of cards showing orders here" renders as grey card shapes in the right region at
  the right rough count. The negative space still has a UI; it is architecture, not void.

Why: a scenario that draws its context in full detail has silently DECIDED that context — which
is some other scenario's subject, or nobody's yet. The skeleton is how scenarios stay honest
about the boundary of what they know. (Same law as the kit's neutral copy, one level up.)

### Cross-references

A negative-space region that IS another scenario's subject carries a quiet pointer: «decided in
B3». The catalogue becomes a web — every grey area either points at the scenario that owns it or
is marked OPEN. Openness is explicit, never implied.

### Nesting (sub-scenarios)

Some situations are whole screens ("the winning screen"). Others are sub-stuff — a lot-size
choice, the AI allocating lots for approval — nested inside a parent surface. A sub-scenario
renders FULL-FIDELITY INSIDE A SKELETON PARENT, so the nesting is visible: you see exactly where
in the (undecided) parent the (decided) moment lives.

## What is already known (and stays known)

- **Chat / inbox** — figured out (the app's chat is the founder-approved interaction model:
  layout, composer gesture machine, immediate screenshot, voice memo, transcript view). May
  appear as positive space or as higher-confidence context.
- **Review** — almost: the structure (isolated message + card below) is settled; the CARDS vary,
  so the card itself remains a scenario subject. Order EDITING is explicitly unsettled.
- Everything else is open until a scenario closes it.

## Rules carried over (binding)

- Kit components only; **zero hard-coded paint** — scenario screens read the theme like
  everything else, and `tools/theme-gate.mjs` runs over them. When the brand changes, the
  scenarios change with it (the founder, SUPER KEY).
- Scenario copy is **English** (the founder, 2026-08-21) — scenarios are a design-review
  surface, and English is the thinking layer. Only the trade's own nouns stay Spanish (albarán,
  lonja, lote): terms, not translations. The shipped product localises to Spanish afterwards.
  Copy never states a negative; the unit shares the number's line; saffron only for the AI's
  own act.
- The dimension/configuration/situation structure (17 dimensions, groups A–K) from the original
  brief still governs WHICH scenarios exist; this document governs HOW each is drawn.

## The skeleton vocabulary

The negative space is itself systematic: **Ghost** components (grown on Base's `skeleton`
anatomy, themed, gate-clean) — GhostCard, GhostRow, GhostList, GhostTabs, GhostNav, GhostHeader,
GhostBlock. One look everywhere; a scenario never invents its own grey.

## Delivery

1. **The scenarios page** — same shell as the kit: every scenario navigable, each showing
   condition · frame · the screen (positive full / negative skeleton) · the interaction ·
   "this decides" / "this inherits (→ refs)" / "still open".
2. **The puzzle (separate exercise, after all pieces exist)** — assemble the pieces: what is the
   landing of each area, what are the main tabs, what nests where. Fit positive spaces into each
   other's negative spaces. Objective: MAXIMUM OVERLAP — the reduction (identical / identical-
   but-a-column / identical-but-a-control) so the questionnaire's answers produce small deltas
   on canonical screens, never different apps. The app's structure falls out of the assembled
   puzzle; the questionnaire (the 17 dimensions, asked in the distributor's language) selects
   the configuration, and stays a LIVE data structure — changing an answer later re-derives the
   UI and everything keeps working.
