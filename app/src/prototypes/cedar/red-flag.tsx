/* THE RED-FLAG VOCABULARY — ONE HUE, FIVE MARKS, ONE FILE (FEED-IA §196.3).
 *
 * ═══ PETER'S ASK, VERBATIM (2026-09-04) ═════════════════════════════════════════════════════
 * «any fuciking alert or message for "flagged" orders have to have red identifiers and not dots,
 *  like red outline ont he message etc like come on be top down!!!»
 *
 * The heat is in the last three words, and they are the design instruction. The app had a red
 * claim in ONE place (`attention-dot.tsx`'s 6px disc) and a NEUTRAL pill for the same fact one
 * line away, a grey concern sentence inside a red boundary on the albarán, and a plain row in the
 * river for an order the whole surface calls «to review». Four drawings of one fact is not a
 * vocabulary; it is four decisions taken separately. So the marks are decided ONCE, here, and
 * every flag surface in the house reads this file.
 *
 * ═══ THE FIVE MARKS ═════════════════════════════════════════════════════════════════════════
 *
 *   1 · THE OUTLINE   `flagOutline(theme)`  2px of the brand red AROUND THE OBJECT that is
 *                     flagged — the row in the river, the card in a list, the line on the
 *                     albarán, the message in the thread. This is «red outline on the message»,
 *                     and it is the mark that carries the claim; everything below states it.
 *   2 · THE TAB       `flagTint` / `flagEdge`  the tinted strip INSIDE that outline, holding the
 *                     sentence and Dismiss (§192.4's own recipe, lifted here rather than
 *                     re-typed at each site).
 *   3 · THE WORD      `<FlagPill>`  the concern's own words — «Needs response» · «Double-check» ·
 *                     «Flagged» — in red ink inside a red-edged pill with a red line-mark. It
 *                     REPLACES the neutral `backgroundSecondary` pill E185 shipped.
 *   4 · THE MARK      `<FlagMark>`  the flag line-icon in red, standing in a reserved seat where
 *                     a row has no room for words. It REPLACES the dot.
 *   5 · THE COUNT     `flagInk(theme)`  a figure that counts flagged things is written in the red
 *                     (the river's «To review» tally), so the number and the rows agree.
 *
 * ═══ ⚠ THE DOT IS REPEALED FOR FLAGS, AND THE REPEAL IS THE RECORD ══════════════════════════
 * §185.7 made «pale brand-red dots… the only red chat background treatment» and `attention-dot.tsx`
 * drew a 6px disc for §127.3's «a human being is waiting on you». §196.3 repeals the DOT as the
 * flag's identifier — «red identifiers and NOT DOTS» — and keeps everything else those sections
 * settled: the claim is still decided by ONE fold, it still carries a sentence a person can read
 * aloud, it still never decorates resolved history, and it still clears on an act or a
 * dismissal-with-why. What changed is the artwork: a disc that says nothing becomes a MARK and an
 * OUTLINE that say what they are. Dots survive in this product only where they were never about a
 * flag — `ActDot` (Rocoto acted, in neutral ink) and a real unread count.
 *
 * ═══ AND THE HUE IS THE THEME'S, NOT A COLOUR ═══════════════════════════════════════════════
 * Every recipe below is a function of `theme.colors.accent` and nothing else, so `?theme=proof`
 * moves the whole vocabulary with the brand and `tools/theme-gate.mjs` stays green with no escape
 * hatch. `rocoto-theme.ts` reserves the accent for «the AI's own act»; §127.3 widened that by one
 * claim («a person is waiting») and §196.3 widens it by one more, stated here so the next reader
 * finds the canon rather than a habit: THE ACCENT ALSO MARKS A FLAGGED ORDER. Nothing else moves —
 * no warning colour, no positive colour, no second red, no traffic light.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { dismissedNow, useDismissals } from './dismissals';
import { Glyph, STEP, type GlyphId } from './glyphs';
import { standingConcernsOf, type Sale } from './sale';

/* ═══ THE FOLD ═══════════════════════════════════════════════════════════════════════════════
 * One function decides whether a thing is flagged, so no surface can invent a second condition.
 * It is deliberately pure: a route can COUNT and FILTER the same set the rows DRAW, after
 * subscribing to the dismissal store with `useDismissals`.
 */

/** The exact live projection every attention surface uses (moved here from `attention-labels.tsx`
 *  by §196.3 so the fold and the marks live together; that file re-exports it unchanged). */
export const activeAttentionConcernsOf = (sale: Sale) =>
  standingConcernsOf(sale).filter((concern) => !dismissedNow(sale.id, concern.id));

/** WHAT «FLAGGED» MEANS, IN ONE PLACE. Three independent facts, and any one of them is a flag:
 *  Rocoto owes the customer words, Rocoto wants a figure checked, or the OPERATOR pressed Flag.
 *  The third is the one Peter's word literally names — `sale.flagged` is the durable Flag/Unflag
 *  ledger event on the document head — and before §196.3 it was the only flag in the product that
 *  wore no red anywhere. */
export type FlagStanding = {
  response: boolean;
  check: boolean;
  /** the operator's own Flag, from the head's Flag/Unflag ledger event */
  marked: boolean;
  /** whether anything at all is standing */
  any: boolean;
};

export const flagStandingOf = (sale: Sale): FlagStanding => {
  const concerns = activeAttentionConcernsOf(sale);
  const response = concerns.some((concern) => concern.kind === 'response');
  const check = concerns.some((concern) => concern.kind === 'check');
  const marked = Boolean(sale.flagged);
  return { response, check, marked, any: response || check || marked };
};

/** the one predicate a list filters and counts by */
export const isFlagged = (sale: Sale): boolean => flagStandingOf(sale).any;

/** the same fold, subscribed — a dismissal must clear the mark on every surface at once */
export function useFlagStanding(sale: Sale): FlagStanding {
  useDismissals();
  return flagStandingOf(sale);
}

/** ⚠ the pre-§196.3 name, kept because three surfaces import it; it answers the two CONCERN
 *  facts only, and `useFlagStanding` is what a new caller wants. */
export function useAttention(sale: Sale) {
  const standing = useFlagStanding(sale);
  return { response: standing.response, check: standing.check };
}

/* ═══ THE RECIPES ════════════════════════════════════════════════════════════════════════════
 * Written as functions of the theme so there is exactly one string per mark in the whole product
 * and `?theme=proof` moves all of them. The numbers are §192.4's, measured on the albarán's own
 * flagged line and lifted rather than re-chosen — that outline is the drawing Peter approved when
 * he asked for the concern tab, and «be top down» means the rest of the house adopts it.
 */

/** the ink: the brand's red at full strength, for a word, a mark or a count */
export const flagInk = (theme: { colors: { accent: string } }): string => theme.colors.accent;

/** how thick the boundary is, stated once (§192.4 drew 2px on `line-card`) */
export const FLAG_EDGE = '2px';

/** THE OUTLINE — the object that is flagged wears it. `outline` rather than `border` on purpose:
 *  it takes no layout, so a row that starts being flagged does not move the rows around it
 *  (§37.3 · §77.2), and it draws OUTSIDE a card that already owns a hover border. */
export const flagOutline = (theme: { colors: { accent: string } }): string =>
  `${FLAG_EDGE} solid ${theme.colors.accent}`;

/** the ground of the tab and of a pill: the red thinned to a wash, never a fill */
export const flagTint = (theme: { colors: { accent: string } }): string =>
  `color-mix(in srgb, ${theme.colors.accent} 6%, transparent)`;

/** the hairline under a tab and around a pill: the red thinned to an edge */
export const flagEdge = (theme: { colors: { accent: string } }): string =>
  `color-mix(in srgb, ${theme.colors.accent} 25%, transparent)`;

/** THE BOX A FLAGGED OBJECT DRAWS, as a style fragment a caller spreads. `on === false` returns
 *  the same keys with no paint, so the two states are one declaration and neither can drift. */
export const flagBox = (theme: { colors: { accent: string } }, on: boolean) => ({
  outline: on ? flagOutline(theme) : 'none',
  outlineOffset: '-1px',
});

/* ═══ THE MARKS ══════════════════════════════════════════════════════════════════════════════ */

/** what each kind of flag is called, in the app's own words — one map, so the pill, the count and
 *  the accessible name can never say three different things about one fact */
export const FLAG_WORD = {
  response: 'Needs response',
  check: 'Double-check',
  marked: 'Flagged',
} as const;

export type FlagKind = keyof typeof FLAG_WORD;

const FLAG_GLYPH: Record<FlagKind, GlyphId> = {
  response: 'chat',
  check: 'eye',
  marked: 'flag',
};

/**
 * THE WORD — a red-edged pill carrying the flag's own name and its line-mark, both in the red.
 *
 * ⚠ IT REPLACES E185's NEUTRAL PILL. That pill sat on `backgroundSecondary` with accent TEXT: at a
 * glance a row that needed a person and a row that did not were the same shape in the same grey,
 * and the only thing carrying the claim was a 12px word. The pill now states the claim in its own
 * edge, so the fact survives the glance that is all a person gives a river of forty rows.
 */
export function FlagPill({ kind, word, testid }: { kind: FlagKind; word?: string; testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-testid={testid}
      data-attention={kind}
      data-attention-label={kind}
      data-flag-pill={kind}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale100,
        ...theme.typography.LabelXSmall,
        whiteSpace: 'nowrap',
        borderRadius: theme.borders.radius200,
        border: `1px solid ${flagEdge(theme)}`,
        background: flagTint(theme),
        padding: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
        color: flagInk(theme),
      }}
    >
      <Glyph id={FLAG_GLYPH[kind]} size={12} />
      <span data-attention-text>{word ?? FLAG_WORD[kind]}</span>
    </span>
  );
}

/**
 * THE MARK — the flag, drawn, where a row has no room for the word.
 *
 * ⚠ THIS IS WHAT THE DOT BECAME (§196.3). Everything the dot's own file argued for survives: the
 * seat is reserved whether or not anything stands in it, so a document that starts blocking a
 * person does not move the two things beside it; and the claim is a SENTENCE, not a colour, so a
 * person reading with their ears hears «Hotel Rec is waiting on you» rather than nothing at all.
 * What changed is that the artwork now says what it is — a flag — instead of asking the reader to
 * already know what a red circle means.
 */
export function FlagMark({
  claim,
  testid,
  size = STEP.small,
  kind = 'marked',
}: {
  /** `null` draws the reserved seat and nothing in it */
  claim: { why: string; kind?: string } | null;
  testid: string;
  size?: number;
  /** which mark to draw where the claim does not name one */
  kind?: FlagKind;
}) {
  const [, theme] = useStyletron();
  const drawn = claim?.kind && claim.kind in FLAG_GLYPH ? (claim.kind as FlagKind) : kind;
  return (
    <span
      data-testid={testid}
      data-waiting={claim ? claim.kind ?? drawn : 'no'}
      data-flag-mark={claim ? drawn : 'no'}
      /* THE CLAIM IS AUDIBLE OR IT IS NOT MADE. A mark with no name is a picture, and this one is
         a sentence about a person. */
      role={claim ? 'img' : undefined}
      aria-label={claim ? claim.why : undefined}
      title={claim ? claim.why : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        width: size,
        height: size,
        color: flagInk(theme),
      }}
    >
      {claim && <Glyph id={FLAG_GLYPH[drawn]} size={size} />}
    </span>
  );
}

/**
 * THE SENTENCE, IN THE RED — a flag's own name where it stands beside its explanation rather than
 * inside a pill (the concern note's head, the head's «Flagged by…» record).
 */
export function FlagWord({ kind = 'marked', word, testid }: { kind?: FlagKind; word?: string; testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <span
      data-testid={testid}
      data-flag-word={kind}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale100,
        ...theme.typography.LabelXSmall,
        color: flagInk(theme),
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      }}
    >
      <Glyph id={FLAG_GLYPH[kind]} size={12} />
      <span>{word ?? FLAG_WORD[kind]}</span>
    </span>
  );
}
