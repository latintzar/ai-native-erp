/* SEARCH — one grammar, three homes (FEED-IA §35.1).
 *
 * «SEARCH, elastic-grade: filter-as-you-type in Sales (filters the river), in customers, and in
 * products. Three homes, one grammar.»
 *
 * ═══ THE SEAT MOVED, AND THIS FILE'S MATCH DID NOT (FEED-IA §91.2, 2026-08-29) ══════════════
 * «I think all search should be like this in fact. Makes search VERY simple, or rather very
 * consistent.» There is ONE search surface in the app now — `shell/search-modal.tsx` — summoned
 * from every mark, from the rail's Find row and from «/» or ⌘K. What it did NOT change is the
 * half of this file that matters most: `termsOf` · `wordsOf` · `matches` · `Mark` are still THE
 * matcher, still elastic, and still what every surface narrows itself with. A surface hands the
 * box its word through `useSearchSeat` and keeps filtering exactly as it did.
 *
 * `SearchSeat` — the expanding field below — is the OLD housing. It is kept because three
 * surfaces still stand in it, and each one is HELD by another package as this lands:
 *
 *   · `areas/sales.tsx` → `sales-search` (the river's magnifier). SEAM: replace the `SearchSeat`
 *     with `<SearchSummon intent="everything" …>` and declare `useSearchSeat({ intent, query,
 *     onQuery: search, fieldTestid: 'sales-search-field', label })`. The river searches customers,
 *     products and figures at once, which is the `everything` list; if it wants a list of its own
 *     («Orders»), that is one register added to `groupsFor` and a new intent beside it.
 *   · `areas/sales.tsx` → `scope-search` (the comercial picker's field, INSIDE a Base menu). SEAM,
 *     and the one to think about rather than copy: a field inside an open menu is not the app's
 *     search, it is that menu's own narrow. Either it stays a `SearchSeat` — which is honest, and
 *     is why this housing is not deleted — or the picker becomes an intent of its own («Holders»)
 *     and the menu gives up its field.
 *   · `test-chat.tsx` → `test-search` (the roleplay's customer picker, §91.4). SEAM: its rows are
 *     doors to a ROLE — the customer you are about to speak as — and never to that account's
 *     sheet, so it wants an intent of its own with its own `open`. It landed while this package
 *     was in flight and belongs to whoever owns the test chat.
 *
 * Each of those is one summon plus one `useSearchSeat` call; nothing in the surface's own filter
 * changes, and the box is already mounted for them by the frame.
 *
 * ═══ WHAT THIS FILE IS ══════════════════════════════════════════════════════════════════════
 * Two things, and deliberately both in one file: the MATCH (pure functions, no React) and the SEAT
 * (the control a person types into). They live together because the whole point of §35.1 is that
 * the three surfaces search the SAME way — a shared field with a private matcher beside it would be
 * one grammar in the pixels and three in the behaviour, which is the version a person notices.
 *
 * Each surface still owns its own WORDS. Sales knows a sale carries a customer, a state word, a
 * round and a figure; Stock knows a card carries a name, a shelf and a sort. That knowledge belongs
 * to the surface, so a surface hands this file a list of strings and gets an answer back. What is
 * shared is the folding, the claiming and the seat.
 *
 * ═══ ELASTIC MEANS THREE THINGS, AND NO NEW DEPENDENCY ══════════════════════════════════════
 * `catalogue.ts` already had to solve «did this person mean that word» for the router, at trade
 * scale, over Spanish — so this file READS that solution rather than growing a second one:
 *
 *   1 · FOLDED — `foldWord` drops case, accents and punctuation, so «Mahón» is found by «mahon»
 *       and «1.234,50 €» by «1234».
 *   2 · INFIX — a term found anywhere inside a word counts. «luza» finds Merluza, which is what
 *       people do when they can only remember the middle of a name.
 *   3 · FUZZY AND PREFIX — `claims` carries the router's own tolerance: four letters of a word is
 *       the word, and a comercial's real typo (one edit under six letters, two over) still lands.
 *
 * TERMS ARE AND, FIELDS ARE OR. «pulpo toni» is the row that is both, which is how a person
 * narrows: they add a word, and the list gets shorter. A term that matches nothing anywhere
 * removes the row, and that is the whole filter.
 *
 * ═══ THE SEAT IS QUIET UNTIL IT IS USED (§35.1's own condition) ═════════════════════════════
 * «Zero mental overhead: search is quiet until used — an icon and a ghost field, expanding on
 * focus, never a toolbar.» So the resting state is ONE MARK out of the app's own vocabulary
 * (§30: an icon used always is language), and the field is what that mark opens. It expands in
 * place, it holds no ground of its own beyond a hairline, and it closes itself the moment it is
 * empty and left. The phone gets the identical seat, at the identical size, where the thumb is
 * already resting — a search a phone has to ask for is a search a phone does without.
 *
 * ESC IS THE FIELD'S OWN, FIRST. A person typing has the innermost thing open, so Escape in the
 * field clears the query, and Escape on an already-empty field puts the seat away. The surface's
 * own Escape chain picks up from there.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { claims, foldWord } from './catalogue';
import { Glyph, STEP } from './glyphs';
import { usePhone } from './shell/viewport';

/* ── THE MATCH ────────────────────────────────────────────────────────────────────────────── */

/** What a person typed, as the words they typed. An empty query is no terms, which is the
 *  resting state every caller tests for. */
export const termsOf = (query: string): string[] =>
  foldWord(query).split(' ').filter((w) => w.length > 0);

/** The searchable words of one thing, folded once. Callers build this ONCE per item and keep it —
 *  folding three hundred sales on every keystroke is work nobody asked for. */
export const wordsOf = (fields: Array<string | number | null | undefined>): string[] => {
  const out: string[] = [];
  for (const field of fields) {
    if (field === null || field === undefined || field === '') continue;
    for (const word of foldWord(String(field)).split(' ')) {
      if (word.length > 0) out.push(word);
    }
  }
  return out;
};

/** Does this one term claim any of those words? Infix first because it is the cheap one and the
 *  one a person means; the router's own tolerance after it. */
const hits = (term: string, words: string[]): boolean =>
  words.some((w) => w.includes(term) || claims(term, w));

/** THE FILTER. Every term has to land somewhere; where it lands is the item's own business. */
export const matches = (terms: string[], words: string[]): boolean =>
  terms.every((t) => hits(t, words));

/* ── THE HIGHLIGHT ────────────────────────────────────────────────────────────────────────── */

/* «Matches highlight, misses vanish» (§35.1). The vanishing is the filter; the highlight is this,
 * and it has one hard problem: the match is computed on FOLDED text and drawn on the real one.
 * «Mahón» folds to «mahon» — five characters against five, but «é» decomposes into two before one
 * of them is dropped, so the two strings walk out of step the moment an accent appears. So the fold
 * is done CHARACTER BY CHARACTER here, keeping the original index of every folded character, and a
 * hit in the folded string maps back to the exact letters on screen.
 *
 * IT MARKS WHAT LITERALLY MATCHED. The fuzzy pass finds «merluza» for «meruza», and there is no
 * honest way to underline the typo the person made — so a fuzzy hit filters the row in and marks
 * nothing. A highlight that guessed would be the software claiming to have read something it did
 * not. */
function foldIndexed(text: string): { folded: string; at: number[] } {
  let folded = '';
  const at: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const ch of c) {
      folded += ch;
      at.push(i);
    }
  }
  return { folded, at };
}

type Span = { from: number; to: number };

/** the character ranges of `text` the terms literally landed on, merged and in reading order */
export function spansOf(text: string, terms: string[]): Span[] {
  if (terms.length === 0 || text.length === 0) return [];
  const { folded, at } = foldIndexed(text);
  const raw: Span[] = [];
  for (const term of terms) {
    if (term.length === 0) continue;
    let from = folded.indexOf(term);
    while (from !== -1) {
      raw.push({ from: at[from], to: at[from + term.length - 1] + 1 });
      from = folded.indexOf(term, from + 1);
    }
  }
  raw.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: Span[] = [];
  for (const span of raw) {
    const last = merged[merged.length - 1];
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * One string, with what matched standing out of it.
 *
 * THE HIGHLIGHT HOLDS NO COLOUR. «Colour is not a status system» is the design system's own law and
 * a browser's `<mark>` is a yellow one, so the emphasis is a step of the app's own grey under full
 * ink — which reads at a glance, survives a re-theme, and leaves saffron spent on Rocoto's own acts.
 */
export function Mark({ text, terms }: { text: string; terms: string[] }) {
  const [, theme] = useStyletron();
  const spans = React.useMemo(() => spansOf(text, terms), [text, terms]);
  if (spans.length === 0) return <>{text}</>;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.from > cursor) out.push(text.slice(cursor, span.from));
    out.push(
      <mark
        key={`${span.from}-${i}`}
        data-search-hit="yes"
        style={{
          padding: '0 1px',
          borderRadius: theme.borders.radius100,
          background: theme.colors.mono300,
          color: theme.colors.contentPrimary,
        }}
      >
        {text.slice(span.from, span.to)}
      </mark>,
    );
    cursor = span.to;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

/* ── THE SEAT ─────────────────────────────────────────────────────────────────────────────── */

/** how wide the field opens on a desk. Long enough for «pulpo toni», short enough that it never
 *  reads as the row's subject. */
const FIELD = 240;

/** Stop a key here, and stop it in the DOM as well. React hangs its listeners on the app's root
 *  element and Base's layer manager hangs its own on the DOCUMENT above it, so a synthetic
 *  `stopPropagation` leaves the native event still travelling — which is a key consumed by this
 *  seat and acted on again by whatever layer is standing over it. */
const stopHard = (e: React.SyntheticEvent): void => {
  e.stopPropagation();
  e.nativeEvent.stopPropagation();
};

export function SearchSeat({
  value,
  onChange,
  label,
  testid,
  fill = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** what this seat searches, said as a sentence a stranger can act on. It is the placeholder,
   *  the hover label and the accessible name — one string, so the three can never disagree. */
  label: string;
  testid: string;
  /** the field takes the whole row when it opens — the phone, and any list whose head it heads */
  fill?: boolean;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const [open, setOpen] = React.useState(false);
  const field = React.useRef<HTMLInputElement | null>(null);
  /** this seat took an Escape's press, so it owes nothing above it the release */
  const swallowed = React.useRef(false);

  /* a query keeps the field open however it got there — a surface can seed one, and a person who
     tabs away from something they typed still has to be able to see what they typed */
  const shown = open || value.length > 0;

  React.useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  if (!shown) {
    /* ── THE LABEL IS THE MARK'S OWN, AND NOT A LAYER (§30, and a drive's own finding) ──────────
     * §30 asks for hover labels on a mark that stands alone, and the first version of this used
     * Base's tooltip for it. A drive caught what that costs: Escape is a STACK in Base
     * (`layers-manager`), the top layer takes it, and a tooltip opens on FOCUS as well as on hover
     * — so the moment this seat was tabbed to, or auto-focused inside a menu, an invisible layer
     * was sitting on top of the app's Escape chain. Pressing Escape closed a hover label instead of
     * releasing the narrow, and inside the comercial picker it closed the label instead of the
     * menu. A hover label may not take a key away from the work. So the word rides the element
     * itself, where it costs no layer and still reaches both a pointer and a screen reader. */
    return (
      <span style={{ display: 'inline-flex', flex: '0 0 auto' }} title={label}>
        <Button
          kind={KIND.tertiary}
          size={SIZE.compact}
          shape={SHAPE.circle}
          data-testid={testid}
          aria-label={label}
          onClick={() => setOpen(true)}
        >
          <Glyph id="search" size={STEP.small} />
        </Button>
      </span>
    );
  }

  return (
    <span
      data-testid={`${testid}-open`}
      data-search={value}
      style={{
        display: 'inline-flex',
        flex: fill || phone ? '1 1 100%' : '0 1 auto',
        minWidth: 0,
        width: fill || phone ? '100%' : FIELD,
        maxWidth: '100%',
      }}
    >
      <Input
        inputRef={field}
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        size={INPUT_SIZE.compact}
        clearable
        clearOnEscape={false}
        placeholder={label}
        aria-label={label}
        startEnhancer={<Glyph id="search" size={STEP.small} />}
        onBlur={() => {
          if (value.length === 0) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          /* ─── ESC RELEASES THE INNERMOST THING FIRST, AND THEN GETS OUT OF THE WAY ────────────
           * While a person is typing, the innermost thing is what they typed — so a query is what
           * the first Escape takes, and this seat swallows that press so nothing outside it also
           * acts on the same key.
           *
           * AN EMPTY FIELD SWALLOWS NOTHING. The seat puts itself away and lets the press CARRY:
           * whatever this seat is standing inside — the comercial picker's menu, and after it the
           * surface's own narrows — is next in the chain and has to be able to hear it. An earlier
           * version stopped propagation on both presses, which made an empty field a wall: inside
           * the picker the menu could not be closed with the keyboard at all, and it is exactly
           * that wall a re-open then walked into. One rule: this seat only takes the key while it
           * has something of its own to give up. */
          if (value.length > 0) {
            swallowed.current = true;
            stopHard(e);
            onChange('');
            return;
          }
          setOpen(false);
        }}
        /* ─── AND THE RELEASE HAS TO BE SWALLOWED WITH THE PRESS ────────────────────────────────
         * Base closes a layer on `keyup`, from a listener on the DOCUMENT (`layers-manager`), so
         * consuming the keydown alone is half a decision: the query cleared AND the menu around it
         * closed, on one press. A key is one act; whoever takes the press takes the release with
         * it. The flag is set only where the press was consumed and cleared on every release, so a
         * keyup this seat never earned always carries on to whatever is above it. */
        onKeyUp={(e) => {
          if (e.key !== 'Escape') return;
          const ours = swallowed.current;
          swallowed.current = false;
          if (ours) stopHard(e);
        }}
        overrides={{
          /* A GHOST FIELD, NOT A FILLED ONE. Base's Input rests on `backgroundSecondary`, which is
             a box; §35.1 asks for a field that is barely there until it holds something. Paper and
             a hairline, both out of the theme, so it re-themes with everything else. */
          Root: {
            style: {
              backgroundColor: theme.colors.backgroundPrimary,
              borderTopWidth: '1px',
              borderRightWidth: '1px',
              borderBottomWidth: '1px',
              borderLeftWidth: '1px',
              minWidth: 0,
            },
          },
          Input: {
            props: { 'data-testid': `${testid}-field` },
            style: { backgroundColor: 'transparent' },
          },
          StartEnhancer: {
            style: {
              backgroundColor: 'transparent',
              paddingRight: theme.sizing.scale200,
              color: theme.colors.contentTertiary,
            },
          },
        }}
      />
    </span>
  );
}

export default SearchSeat;
