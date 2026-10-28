/* ═══ THE LIVE FIELD (FEED-IA §196.1) ═════════════════════════════════════════════════════════
 *
 * Peter, 2026-09-04, on the served E192 product sheet:
 *
 *   «the product sheet looks weird and hardcoded for half the stuff, they dont look optional and
 *    have weird structure, like it's a blend of hard non editable looking stuff and then like
 *    fucking collapsable sections which is dumb, it doesnt look like live dropdowns. in general
 *    any time its a field that is sort of cms related like a form field for a product there should
 *    be a dropdown with suggestions appear which filters as people type... shit like this. same
 *    for units, same for like other shit.»
 *
 * So every CMS-like field on a product is ONE component: a text field that carries the tenant's
 * own values as a filtering list, accepts the typed word when nothing matches, and commits where
 * it stands. There is no read-only card that opens a modal to change one word, and nothing folds
 * behind a disclosure (§196.1).
 *
 * ── NEVER REDRAW — LIFT THE REAL THING ───────────────────────────────────────────────────────
 * The typeahead itself is Base Web's own `Combobox`, exactly as `detail.tsx`'s LotField and
 * UnitField already use it on the albarán line (§138.4 / §142): one input that owns its focus,
 * its keyboard and the ARIA combobox contract (`role=combobox`, `aria-expanded`, `role=listbox`,
 * `role=option`). This file adds only what Base leaves to the caller — the field's LABEL, its
 * optional/set reading, the ranked filter, the «new word» row and the commit contract — and it
 * adds no second dropdown engine.
 *
 * ── THE GRAMMAR THIS FILE OWNS ───────────────────────────────────────────────────────────────
 *   · A SET field reads set: white ground, the value at label weight, the noun above it.
 *   · An OPTIONAL EMPTY field reads invited: a quiet ground, the placeholder saying what to write,
 *     and the word «Optional» once, on the label's row.
 *   · Typing FILTERS: values that begin with what was typed lead, values that contain it follow.
 *   · The typed word is accepted as new — the list's last row offers it, and Enter takes it.
 *   · A press on the value IS the editor (§192.2 generalised from the albarán's numbers): there
 *     is no second press, no popover door and no dialog between the hand and the word.
 *   · 44 px floors on the input and on every option row.
 *
 * ── WHAT A DRIVE READS ───────────────────────────────────────────────────────────────────────
 *   [data-live-field=<id>]          the field's own seat
 *   [data-live-state]               set | empty
 *   [data-live-optional]            yes | no
 *   [data-live-suggestions]         how many of the tenant's own values stand behind it
 *   [data-live-new]                 yes when the typed word is not one of them
 *   [data-live-input=<id>]          the input itself (also carries any legacy testid)
 *   [data-live-list=<id>]           the open listbox
 *   [data-live-option]              known | new
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Combobox } from 'baseui/combobox';
import { SIZE as INPUT_SIZE } from 'baseui/input';
import { Input } from 'baseui/input';
import type { Product } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';
import { productUnitEquivalences, tenantUnitDefinitions } from './units';

/** One offered value. `id` travels with it for the fields whose value names a record. */
export type LiveSuggestion = { value: string; id?: string; note?: string };
/** What a commit hands back. `isNew` is true for a word the tenant has never used. */
export type LiveCommit = { value: string; id?: string; isNew: boolean };
/** A commit returns a sentence when it refuses, and nothing when it takes. */
export type LiveCommitResult = string | void;

type Row = { value: string; note?: string; id?: string; fresh: boolean };

const normal = (value: string) => value.trim().toLocaleLowerCase();

/** The tenant's own values, deduplicated case-insensitively, in the order they were offered. */
export function liveSuggestions(...groups: Array<Array<string | LiveSuggestion | undefined | null>>): LiveSuggestion[] {
  const seen = new Set<string>();
  const rows: LiveSuggestion[] = [];
  for (const group of groups)
    for (const entry of group) {
      if (!entry) continue;
      const row = typeof entry === 'string' ? { value: entry } : entry;
      const key = normal(row.value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  return rows;
}

/** Units the tenant already uses: this product's own, its conversions', the tenant vocabulary and
 * every unit standing on the catalogue. A house that has typed «manojo» once is offered it. */
export function unitSuggestions(
  sector: SectorId | string,
  catalogue: Array<{ unit?: string }> = [],
  product?: Product,
): LiveSuggestion[] {
  return liveSuggestions(
    [product?.unit],
    product ? productUnitEquivalences(sector, product).flatMap((row) => [row.unit, row.baseUnit]) : [],
    tenantUnitDefinitions(sector).map((definition) => definition.label),
    catalogue.map((row) => row.unit ?? ''),
  );
}

/** startsWith leads, contains follows — a person typing «man» meets «manojo» first. */
function filterRows(suggestions: LiveSuggestion[], typed: string, allowNew: boolean, limit: number): Row[] {
  const wanted = normal(typed);
  const known = suggestions.map((row) => ({ ...row, fresh: false }));
  const matched = !wanted
    ? known
    : [
        ...known.filter((row) => normal(row.value).startsWith(wanted)),
        ...known.filter((row) => !normal(row.value).startsWith(wanted) && normal(row.value).includes(wanted)),
      ];
  const exact = suggestions.some((row) => normal(row.value) === wanted);
  const rows = matched.slice(0, limit);
  if (allowNew && wanted && !exact) rows.push({ value: typed.trim(), fresh: true });
  return rows;
}

export type LiveFieldProps = {
  /** testid stem, e.g. «product-unit» → [data-live-field=product-unit] */
  id: string;
  /** the noun above the field — a label names the thing (house law) */
  label: string;
  /** the standing value */
  value: string;
  /** the tenant's own values */
  suggestions: Array<string | LiveSuggestion>;
  /** the invitation an empty field wears */
  placeholder: string;
  /** takes the word, or returns the sentence that refuses it */
  onCommit: (commit: LiveCommit) => LiveCommitResult;
  /** every keystroke, for a seat that holds a draft rather than a saved fact */
  onType?: (value: string) => void;
  /** an optional field says so once, on the label's row */
  optional?: boolean;
  /** the seat already prints the noun (a Fact's label, a Row's label), so the field spends no
   *  second line repeating it and keeps the name for the screen reader alone */
  hideLabel?: boolean;
  /** false where the value must name an existing record (a relation, never a new SKU) */
  allowNew?: boolean;
  /** one line under the field: what the value means, or what the house knows about it */
  hint?: React.ReactNode;
  /** held: the value stands, the field states why, and the way on rides beside it */
  disabled?: boolean;
  because?: React.ReactNode;
  /** a door that rides the label's row */
  aside?: React.ReactNode;
  /** clears the field back to empty after a commit — the relation picker's posture */
  clearAfterCommit?: boolean;
  autoFocus?: boolean;
  size?: 'compact' | 'default';
  /** THE SENTENCE A CLOSED REGISTER REFUSES A WORD WITH, in the seat's own grammar. Built from
   *  the label it reads «Choose zone from the list.» — a sentence with no article, said about
   *  every closed field in the app. A seat that knows its own noun says it here, once, and the
   *  seats that used to write the same sentence again inside `onCommit` stop repeating it. */
  declineSays?: string;
  /** a testid an existing drive already names this seat by */
  inputTestid?: string;
  listLabel?: string;
  maxRows?: number;
};

export function LiveField({
  id,
  label,
  value,
  suggestions,
  placeholder,
  onCommit,
  onType,
  optional = false,
  hideLabel = false,
  allowNew = true,
  hint,
  disabled = false,
  because,
  aside,
  clearAfterCommit = false,
  autoFocus = false,
  size = 'default',
  declineSays,
  inputTestid,
  listLabel,
  maxRows = 10,
}: LiveFieldProps) {
  const [, theme] = useStyletron();
  const rows = React.useMemo(
    () => liveSuggestions(suggestions as Array<string | LiveSuggestion>),
    [suggestions],
  );
  const [typed, setTyped] = React.useState(value);
  /* ── THE LIST OPENS FOR A HAND, NOT FOR A FOCUS TRAP ────────────────────────────────────────
   * Base's Combobox opens on FOCUS, which is right when a person taps the field and wrong when a
   * dialog's focus trap lands on it — the list then covers the controls under it (drive-189 met
   * exactly that on the conversion editor: an option row intercepting the scope buttons). So the
   * field is «engaged» by a pointer, a key or a typed character, and offers nothing until then.
   * Base opens only `if (options.length)`, so an empty list IS the closed state. */
  const [engaged, setEngaged] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  /* Base's Combobox keeps its own temp string after an option is clicked. A seat that clears
     itself on commit (the relation picker) therefore takes a fresh instance — one line, and the
     input is genuinely empty again rather than showing the word it just consumed. */
  const [generation, setGeneration] = React.useState(0);
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const savedTimer = React.useRef<number | undefined>(undefined);
  /* the standing value is the truth; a value changed underneath the hand replaces the draft */
  React.useEffect(() => { setTyped(value); setError(''); }, [value]);
  React.useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  const set = value.trim().length > 0;
  /* A field the person has not typed into YET offers everything the house has — the standing
     value is not a filter (the albarán's own lot field reads it the same way). The first character
     typed narrows the list. It is the TYPING that is the signal, never the text's equality with
     the saved value: a seat that mirrors its draft back as `value` (New product's Unit) would
     otherwise never filter at all. */
  const offered = React.useMemo(
    () => (engaged ? filterRows(rows, dirty ? typed : '', allowNew, maxRows) : []),
    [engaged, dirty, rows, typed, allowNew, maxRows],
  );
  const fresh = allowNew && typed.trim().length > 0 && !rows.some((row) => normal(row.value) === normal(typed));

  const put = (next: string, chosen?: Row) => {
    const word = next.trim();
    if (word === value.trim() && !chosen?.id) { setError(''); return; }
    if (!allowNew && !chosen?.id && !rows.some((row) => normal(row.value) === normal(word))) {
      setError(declineSays ?? `Choose ${label.toLocaleLowerCase()} from the list.`);
      return;
    }
    const problem = onCommit({ value: word, id: chosen?.id, isNew: chosen ? chosen.fresh : fresh });
    if (typeof problem === 'string' && problem) { setError(problem); return; }
    setError('');
    setDirty(false);
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1800);
    if (clearAfterCommit) { setTyped(''); setGeneration((count) => count + 1); }
  };

  const inputId = `live-input-${id}`;
  /* THE GROUND SAYS THE STATE. A set field is white — it holds something. An empty one, and a
     held one, take the quiet fill, so a sheet full of them reads at a glance as what is written
     and what is still open. Both stand on the card's own white, so the fill is what draws the
     field's box (Base's `borderOpaque` is that same grey, and a grey line on grey is no line). */
  const ground = set && !disabled ? theme.colors.backgroundPrimary : theme.colors.backgroundSecondary;
  return (
    <div
      data-live-field={id}
      data-live-state={set ? 'set' : 'empty'}
      data-live-optional={optional ? 'yes' : 'no'}
      data-live-suggestions={rows.length}
      data-live-new={fresh ? 'yes' : 'no'}
      data-live-held={disabled ? 'yes' : 'no'}
      onPointerDownCapture={() => setEngaged(true)}
      onKeyDownCapture={(event) => { if (!['Tab', 'Escape', 'Shift'].includes(event.key)) setEngaged(true); }}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}
    >
      {/* THE LABEL'S ROW. A seat that already prints the noun above the field (a customer Fact, a
          team LiveFact, an admin Row) hands `hideLabel` and the row is drawn only for what is left
          to say — the optional mark and any door — so one field never wears two names. */}
      {/* ⚠ AND A HIDDEN LABEL SPENDS NO ROW ON THE MARK. With `hideLabel` the empty spacer took
          the label's slot and pushed «Optional» onto a line of its own, so the team card drew
          «Run» and «Optional» on two rows — INTX-17.3 says an optional field says Optional ONCE,
          on the label's row, and with the label hidden that row is the SEAT's (LiveFact, Fact,
          Row), which prints the mark itself. */}
      {(!hideLabel || aside) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
          {hideLabel ? (
            <span style={{ flex: 1, minWidth: 0 }} />
          ) : (
            <label
              htmlFor={inputId}
              style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
            >
              {label}
            </label>
          )}
          {optional && !set && !hideLabel && (
            <span data-live-optional-mark={id} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
              Optional
            </span>
          )}
          {aside}
        </div>
      )}
      <Combobox<Row>
        key={generation}
        value={typed}
        options={offered}
        disabled={disabled}
        size={size === 'compact' ? INPUT_SIZE.compact : INPUT_SIZE.default}
        listBoxLabel={listLabel ?? `${label} the house already uses`}
        mapOptionToString={(row: Row) => row.value}
        mapOptionToNode={({ option }: { option: Row; isSelected: boolean }) => (
          <span
            data-live-option={option.fresh ? 'new' : 'known'}
            style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, width: '100%', minWidth: 0 }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{option.value}</span>
              {option.note && (
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>
                  {option.note}
                </span>
              )}
            </span>
            {option.fresh && (
              <span
                style={{
                  ...theme.typography.LabelXSmall,
                  color: theme.colors.contentSecondary,
                  border: `1px solid ${theme.colors.borderOpaque}`,
                  borderRadius: theme.borders.radius200,
                  padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
                  flexShrink: 0,
                }}
              >
                New
              </span>
            )}
          </span>
        )}
        onChange={(next: string, option: Row | null) => {
          setTyped(next);
          setError('');
          setEngaged(true);
          setDirty(true);
          if (onType) onType(next);
          if (option) put(option.value, option);
        }}
        onSubmit={({ value: current, closeListbox }: { value: string; closeListbox: () => void }) => {
          closeListbox();
          put(current);
        }}
        /* ⚠ AN EMPTY DRAFT NEVER LEAVES A SET FIELD READING EMPTY. A closed register refuses a
           word it does not hold, and '' is such a word — so clearing the field and tabbing away
           left the seat blank with a refusal under it while its own state still said «set». The
           standing value comes back; an OPTIONAL field keeps its own door («Take them off it»,
           «Use the house's run»), so that path is untouched. */
        onBlur={() => {
          setEngaged(false);
          setDirty(false);
          if (typed.trim() === '' && !allowNew && !optional && set) { setTyped(value); setError(''); return; }
          put(typed);
        }}
        overrides={{
          Root: { style: { minWidth: 0 } },
          /* the offered list is a raised surface, not a page of text: it has to read as lifted
             off whatever it lands on (§195's checkout-grade bar) */
          ListBox: {
            props: { 'data-live-list': id },
            style: {
              backgroundColor: theme.colors.backgroundPrimary,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius300,
              boxShadow: theme.lighting.shadow600,
            },
          },
          ListItem: { style: { minHeight: '44px', display: 'flex', alignItems: 'center' } },
          Input: {
            props: {
              autoFocus,
              placeholder,
              overrides: {
                Root: {
                  style: {
                    backgroundColor: ground,
                    borderTopColor: theme.colors.borderOpaque,
                    borderRightColor: theme.colors.borderOpaque,
                    borderBottomColor: theme.colors.borderOpaque,
                    borderLeftColor: theme.colors.borderOpaque,
                  },
                },
                InputContainer: { style: { backgroundColor: ground } },
                Input: {
                  props: {
                    id: inputId,
                    'data-live-input': id,
                    'data-testid': inputTestid ?? `live-input-${id}`,
                    'aria-label': label,
                  },
                  style: {
                    backgroundColor: ground,
                    minHeight: '44px',
                    /* a held value still has to be READ — Base greys disabled text to the edge of
                       legibility, and the reason underneath is what carries the hold */
                    ...(disabled ? { color: theme.colors.contentPrimary, WebkitTextFillColor: theme.colors.contentPrimary } : {}),
                    ...(set ? theme.typography.LabelMedium : theme.typography.ParagraphMedium),
                  },
                },
              },
            },
          },
        }}
      />
      {because && (
        <span data-live-because={id} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
          {because}
        </span>
      )}
      {!because && (hint || saved) && (
        <span data-live-hint={id} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
          {saved ? 'Saved' : hint}
        </span>
      )}
      {error && (
        <span role="alert" data-live-error={id} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative, overflowWrap: 'anywhere' }}>
          {error}
        </span>
      )}
    </div>
  );
}

/* ── THE UNIT, WHEREVER IT IS CHOSEN (§196.1 «same for units») ────────────────────────────────
 * One component for the product sheet, New product, the conversion rule and any other seat that
 * asks for a unit. It carries the tenant's own vocabulary, accepts a word the house has never
 * used, and never invents a conversion by being chosen (UNT-00).
 */
export function LiveUnitField({
  id,
  sector,
  value,
  catalogue = [],
  product,
  onCommit,
  onType,
  label = 'Unit',
  placeholder = 'kg, caja, manojo…',
  hint,
  disabled,
  because,
  aside,
  autoFocus,
  size,
  inputTestid,
  extra = [],
}: {
  id: string;
  sector: SectorId | string;
  value: string;
  /** the tenant's catalogue — every unit it already sells in */
  catalogue?: Array<{ unit?: string }>;
  product?: Product;
  onCommit: (commit: LiveCommit) => LiveCommitResult;
  onType?: (value: string) => void;
  label?: string;
  placeholder?: string;
  hint?: React.ReactNode;
  disabled?: boolean;
  because?: React.ReactNode;
  aside?: React.ReactNode;
  autoFocus?: boolean;
  size?: 'compact' | 'default';
  inputTestid?: string;
  /** units this seat knows about that the tenant store has yet to hear of */
  extra?: Array<string | LiveSuggestion>;
}) {
  const suggestions = React.useMemo(
    () => liveSuggestions(extra, unitSuggestions(sector, catalogue, product)),
    [extra, sector, catalogue, product],
  );
  return (
    <LiveField
      id={id}
      label={label}
      value={value}
      suggestions={suggestions}
      placeholder={placeholder}
      onCommit={onCommit}
      onType={onType}
      hint={hint}
      disabled={disabled}
      because={because}
      aside={aside}
      autoFocus={autoFocus}
      size={size}
      inputTestid={inputTestid}
      listLabel="Units the house already uses"
    />
  );
}

/* ── THE NAME IS EDITED WHERE IT IS READ (§192.2, generalised) ────────────────────────────────
 * «Any row is ALWAYS ready to edit — click into any value and type.» The sheet's title is the
 * product's name, so a press on it puts the caret in it. At rest it is the heading it always was,
 * which is what a reader — and a screen reader — meets first.
 */
export function LiveHeading({
  id,
  value,
  onCommit,
  label,
  placeholder,
  disabled = false,
}: {
  id: string;
  value: string;
  onCommit: (next: string) => LiveCommitResult;
  label: string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [, theme] = useStyletron();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState('');
  React.useEffect(() => { setDraft(value); setOpen(false); setError(''); }, [value]);
  const put = () => {
    const word = draft.trim();
    if (!word) { setError(`Give this product a ${label.toLocaleLowerCase()}.`); return; }
    if (word === value.trim()) { setOpen(false); setError(''); return; }
    const problem = onCommit(word);
    if (typeof problem === 'string' && problem) { setError(problem); return; }
    setOpen(false);
    setError('');
  };
  const heading = { ...theme.typography.HeadingMedium };
  if (disabled)
    return (
      <h2 data-live-heading={id} data-live-state="held" style={{ margin: 0, ...heading, overflowWrap: 'anywhere' }}>
        {value}
      </h2>
    );
  return (
    <div data-live-heading={id} data-live-state={open ? 'open' : 'rest'} style={{ minWidth: 0 }}>
      {open ? (
        <Input
          value={draft}
          autoFocus
          aria-label={label}
          placeholder={placeholder}
          error={Boolean(error)}
          onChange={(event) => { setDraft(event.currentTarget.value); setError(''); }}
          onBlur={put}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); put(); }
            if (event.key === 'Escape') { setDraft(value); setOpen(false); setError(''); }
          }}
          overrides={{
            Input: {
              props: { 'data-testid': `live-heading-write-${id}` },
              style: { ...heading, minHeight: '44px' },
            },
          }}
        />
      ) : (
        <h2 style={{ margin: 0, minWidth: 0 }}>
          <button
            type="button"
            data-testid={`live-heading-${id}`}
            aria-label={`${label} · ${value}`}
            onClick={() => { setDraft(value); setOpen(true); }}
            style={{
              ...heading,
              display: 'block',
              width: '100%',
              minHeight: '44px',
              textAlign: 'left',
              padding: 0,
              margin: 0,
              border: 0,
              background: 'transparent',
              color: theme.colors.contentPrimary,
              cursor: 'default',
              overflowWrap: 'anywhere',
            }}
          >
            {value || placeholder}
          </button>
        </h2>
      )}
      {error && (
        <span role="alert" data-live-error={id} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>
          {error}
        </span>
      )}
    </div>
  );
}
