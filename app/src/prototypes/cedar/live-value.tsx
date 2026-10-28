/* EDITABLE FROM THE GET-GO — THE GRAMMAR (FEED-IA §122, composing §109.6 and §116).
 *
 * «The whole editing-and-having-to-confirm-to-edit: I don't like that. EVERYTHING SHOULD ALWAYS BE
 * EDITABLE FROM THE GET-GO. You shouldn't need to confirm anything — that's exactly what RAQUEL
 * complained about. Everything should be clickable, we're not in 2002 SaaS territory.»
 * — Peter, round 4, 2026-08-29.
 *
 * ═══ WHY A THIRD THING, WHEN THE APP ALREADY HAS TWO ════════════════════════════════════════
 * It has two, and they answer two different questions:
 *
 *   `Editable` (rows.tsx)   the value is a BUTTON that opens a CARD holding the field. It is the
 *                           right answer where a page is thirty facts and live inputs would turn
 *                           the administration into a form (§53), and it is left exactly as it is.
 *   `PriceCell` (stock-tiers)  the figure IS the field — click it and type over it, Enter or blur
 *                           writes, Escape restores. §31.3's immersion editing, and it is what
 *                           §109.6 graduated to the whole row: «any row is ALWAYS ready to edit —
 *                           no edit button, no edit mode.»
 *
 * The second one is the law §122 restates house-wide, and it existed in exactly ONE file, for
 * exactly one kind of value: a price. So the sheets outside Stock had no way to be live, and every
 * authored fact on them stood as dead text. This is that grammar, lifted out of the price and made
 * about ANY value — the liftout law, so the app never grows a fourth drawing of one idea.
 *
 * ═══ WHAT IT IS, AND WHAT IT IS NOT ═════════════════════════════════════════════════════════
 *   AT REST         the app's ONE editable mark (§51.14): a hairline underline, nothing else.
 *   UNDER THE HAND  the full ring and a step of ground, drawn INTO the air the type already has —
 *                   a hover may never move geometry (§37.3), so the ring is transparent at rest
 *                   and the padding it takes back never changes.
 *   PRESSED         the field, already holding the value, already selected. The first character
 *                   typed is the new one.
 *   COMMITTED       on Enter, and on blur. THERE IS NO SAVE BUTTON, on purpose: a confirm is the
 *                   thing Raquel complained about, and a value that needs one is not editable
 *                   from the get-go — it is editable after a ritual.
 *   ESCAPED         restores exactly what was there. Leaving is free, which is what makes writing
 *                   free.
 *
 * IT IS NEVER PUT ON A DERIVED FIGURE. §122 is about AUTHORED values — a name, an hour, a channel,
 * a marking somebody wrote. A total, a count, a month's average and a leaderboard are ARITHMETIC,
 * and a field over an arithmetic is the app inviting a person to argue with a sum. Derived facts
 * stay facts: that is the law's other edge, and `drives/drive-122.py` asserts both.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
import { usePhoneFloorHeight } from './shell';

/* ── THE MARK, IN ONE PLACE ───────────────────────────────────────────────────────────────────
 * §51.14's construction exactly — the same steps, the same negative margin, the same
 * transparent-at-rest ring, the same underline — so a value that is live HERE looks like a value
 * that is live on the albarán, on the price sheet and on the company card. One visual identity per
 * idea; a reader learns «underlined means mine to change» once.
 */
/* `floor` is the phone's 44px touch minimum (INTX-12 · E193.14). INTX-12's editable-cell row asks
   for it by name — «at least 36 px high on pointer layouts and 44 px on touch» — and a live value
   IS that cell wherever it stands: the customer's channel, their payment terms, their delivery
   hour. The mark keeps every one of its resting pixels; the BOX around it takes the floor, on a
   phone only, and the value stays centred in it because this style already centres. */
function markStyle(theme: ReturnType<typeof useStyletron>[1], over: boolean, cursor: string,
                   floor: { minHeight?: string } = {}): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    ...floor,
    gap: theme.sizing.scale200,
    maxWidth: '100%',
    /* NO `minWidth: 0`, AND THE VALUE SETS THE WIDTH (§77.2 · the exact line `Editable` records).
       `minWidth: 0` lets a flex item shrink under content that will not wrap, and the first build
       of this control carried it: on the Account seat the name came out «Peter Provisiona» and the
       phone «+34 600 11 22 3:» — four pixels short, clipped without even an ellipsis to say so.
       A name a person cannot read back is not a name. `flex: 0 0 auto` is the other half: the
       value takes its measure, and the label beside it is the one that gives ground, because a
       label can wrap and an identity cannot. Found by LOOKING at the 1600 shot; `drive-122.py`
       measures every live value on every swept seat so the next one that does it fails red. */
    flex: '0 0 auto',
    marginLeft: `-${theme.sizing.scale100}`,
    marginRight: `-${theme.sizing.scale100}`,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: theme.sizing.scale100,
    paddingRight: theme.sizing.scale100,
    borderRadius: theme.borders.radius100,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderTopColor: over ? theme.colors.mono400 : 'transparent',
    borderLeftColor: over ? theme.colors.mono400 : 'transparent',
    borderRightColor: over ? theme.colors.mono400 : 'transparent',
    borderBottomColor: theme.colors.mono400,
    background: over ? theme.colors.backgroundSecondary : 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    textAlign: 'left',
    cursor,
    transitionProperty: 'background-color, border-color',
    transitionDuration: theme.animation.timing400,
    transitionTimingFunction: theme.animation.easeOutCurve,
  };
}

export type LiveValueProps = {
  /** what stands there now, in the words the surface reads it in */
  value: string;
  /** what the value IS, said as a noun — the accessible name. «Their delivery hour», not «Edit». */
  label: string;
  /** what the field wants when the account has never had one. AFFIRMATIVE, always (§58.2): «The
   *  morning's run», never «no slot set». */
  placeholder: string;
  /** WRITES. Called on Enter and on blur with trimmed text; return false when persistence fails
   *  so the control keeps its local draft. It is never called on each keystroke. */
  onWrite: (next: string) => boolean | void;
  testid: string;
  /** the step the field opens at, matched to the type it is standing in */
  size?: 'compact' | 'default';
  /** how wide the field opens. A name wants the measure; an hour wants four characters of it. */
  width?: number;
  /* ── FLUSH · THE FIELD IS THE TEXT, NOT A BOX AROUND IT (§122 inside §115.3's film) ─────────
   * Base's `Input` is a CONTROL: a border, its own padding, its own 36px step. Dropped into a
   * line of 14px type it is right on a settings card and WRONG inside a stage of measured height
   * — the quick check's `STAGE_H` is 104px and every frame is laid on top of every other so a cut
   * is a cross-fade rather than a reflow (§77.2, §59.1). A control that grew the row by sixteen
   * pixels the moment somebody pressed a quantity would make the film jump under the hand at the
   * exact moment the person is deciding something.
   *
   * So: a bare input that inherits the type it replaced, no border, no padding, no ground — it
   * occupies exactly the line box the words did. The §51.14 underline stays, because the mark is
   * how a reader knows the value is theirs; what goes is the CHROME. It is the same doctrine
   * `PriceCell` states as immersion editing, carried into a place where a box will not fit.
   */
  flush?: boolean;
};

/* ── A VALUE THAT IS ITS OWN FIELD ────────────────────────────────────────────────────────────
 * One press, one edit, no confirm. `PriceCell`'s beat, for words.
 */
export function LiveValue({
  value,
  label,
  placeholder,
  onWrite,
  testid,
  size = 'compact',
  width = 200,
  flush = false,
}: LiveValueProps) {
  const [, theme] = useStyletron();
  const [writing, setWriting] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [over, setOver] = React.useState(false);
  const floor = usePhoneFloorHeight();

  /* THE FIELD ALWAYS OPENS ON WHAT IS THERE NOW. A draft left over from the last account is the
     same defect as a caret parked after the old price: the next thing typed writes the wrong
     record. */
  React.useEffect(() => { setDraft(value); }, [value]);

  const commit = React.useCallback(() => {
    const next = draft.trim();
    if (next === value.trim() || onWrite(next) !== false) setWriting(false);
  }, [draft, value, onWrite]);

  if (writing && flush) {
    /* THE FIELD OCCUPIES THE WORDS' OWN LINE BOX. Everything is inherited — family, size, weight,
       line-height, letter-spacing — so the only thing that changed on the surface is that there
       is now a caret in it. The height is the type's; the stage above it does not move. */
    return (
      <input
        autoFocus
        data-testid={`${testid}-input`}
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        onFocus={(e) => (e.target as HTMLInputElement).select()}
        onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(value); }
        }}
        onKeyUp={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setWriting(false); } }}
        style={{
          width,
          maxWidth: '100%',
          font: 'inherit',
          color: 'inherit',
          letterSpacing: 'inherit',
          lineHeight: 'inherit',
          padding: 0,
          margin: 0,
          background: 'transparent',
          borderWidth: '0 0 1px 0',
          borderStyle: 'solid',
          borderColor: theme.colors.contentPrimary,
          borderRadius: 0,
          outline: 'none',
          /* A BARE INPUT IS A BLOCK-ISH BOX BY DEFAULT AND THAT IS THE HALF-PIXEL THAT MOVES A
             FILM. Inline-block on the text's own baseline keeps it in the line it replaced. */
          display: 'inline-block',
          verticalAlign: 'baseline',
          boxSizing: 'content-box',
        }}
      />
    );
  }

  if (writing) {
    return (
      <span style={{ display: 'inline-flex', minWidth: 0, maxWidth: '100%' }}>
        <span style={{ width, maxWidth: '100%' }}>
          <Input
            autoFocus
            size={size === 'default' ? INPUT_SIZE.default : INPUT_SIZE.compact}
            value={draft}
            placeholder={placeholder}
            /* THE VALUE IS SELECTED THE MOMENT THE FIELD OPENS — the price cell's own hard-won
               line. Immersion editing means the value IS the field, so the first character typed
               is the new one rather than the tail of the old. */
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(value); }
            }}
            onKeyUp={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setWriting(false); } }}
            aria-label={label}
            overrides={{ Input: { props: { 'data-testid': `${testid}-input`, autoComplete: 'off' } } }}
          />
        </span>
      </span>
    );
  }

  const empty = value.trim().length === 0;

  return (
    <button
      type="button"
      data-testid={testid}
      data-live="value"
      data-editable="yes"
      data-empty={empty ? 'yes' : 'no'}
      aria-label={label}
      title={label}
      onClick={(e) => { e.stopPropagation(); setWriting(true); }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        ...markStyle(theme, over, 'text', flush ? {} : floor),
        /* AT REST, FLUSH KEEPS THE MARK AND SPENDS NO AIR ON IT. The negative margin and padding
           the ordinary shape uses are what give a value its ground under the pointer; inside a
           measured stage that ground is four pixels the frame has not got, so the mark is the
           underline alone.

           AND IT SPENDS NO HEIGHT EITHER (FEED-IA §77.2 · §83.1). `markStyle` draws a 1px border
           on all four sides, and `flush` made three of them transparent — TRANSPARENT, not gone.
           So the control's box was still the type's line box plus two pixels, and the composer's
           line, which is the one place `flush` is used, stood at 69px against the 67px ghost it
           replaced: every line that landed pushed the card two pixels, which is exactly the jump
           §83.1's shared `DocumentRow` exists to make impossible («the geometry of a line on this
           card is stated HERE and nowhere else… a second copy of these numbers would be the jump
           waiting to happen» — and this was a second copy, in a border).
           The horizontal axis was already solved this way, by a negative margin absorbing the
           ground; the vertical one takes the same remedy, so the underline still DRAWS on the
           baseline it belongs to and costs the row nothing. */
        ...(flush
          ? { marginLeft: 0, marginRight: 0, marginTop: '-1px', marginBottom: '-1px', paddingLeft: 0, paddingRight: 0, background: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'transparent' }
          : null),
        /* A ZERO-FACT HOLDS ITS CELL (§51.24): it goes quiet, it never disappears, and it never
           ellipsises the identity it is standing in for. */
        color: empty ? theme.colors.contentTertiary : 'inherit',
        overflowWrap: 'break-word',
      }}
    >
      {value || placeholder}
    </button>
  );
}

/* ── THE ATTACHED MENU IS SPENT (E200.07 · FEED-IA §196.1) ────────────────────────────────────
 * `LiveChoice` stood here: a value that opened Base's attached menu on one press and wrote on the
 * second. It answered §116.3's «tap it → it IMMEDIATELY shows the dropdown», and §196.1 asks for
 * the next thing — «a dropdown with suggestions appear which FILTERS as people type… same for like
 * other shit». A menu shows everything and narrows nothing, so every fact that used it (the
 * customer's channel and payment terms, a colleague's run, a zone's comercial) now mounts
 * `LiveField` from `live-field.tsx` — the same organ the product sheet's fields are, and the only
 * dropdown engine in the app.
 */
