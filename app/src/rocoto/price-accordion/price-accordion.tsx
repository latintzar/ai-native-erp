/* THE PRICE ACCORDION — one component for the whole pricing fractal.
 *
 * «Everything is technically in pricing… everything is a tier. Tariffs are a tier.» The complexity
 * is finite and it has two axes: HORIZONTAL is tiers, VERTICAL is chronology. Four levels come out
 * of that, and an item sits at exactly ONE of them:
 *
 *   1  one price, fixed forever                        a value
 *   2  tiers, fixed                                    a row — it expands horizontally
 *   3  tiers that change daily holding a fixed         an anchor and its offsets
 *      relationship: «a centre or one, and everything
 *      is minus certain percentages and plus certain
 *      percentages»
 *   4  tiers that change daily and are all             a grid — it expands vertically, into time,
 *      discretionary                                   and therefore into a log and a chart
 *
 * THE LEVEL IS A PROPERTY OF THE ITEM. Two items in the same house sit at different levels — the
 * blend law — so this is one row that knows which level it is at, never four components and never
 * a per-account mode. Collapsed, all four look alike: mark · name · level line · figure · chevron.
 * Open one and it shows only what its own level actually has.
 *
 * GROWN on Base Web's own component anatomy: the accordion's Header / ToggleIcon / Content /
 * ContentAnimationContainer, the slider's handle geometry, the `overrides` contract, `getOverrides`,
 * `$`-prefixed shared style props and the `data-baseweb` stamp. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. Base ships nothing that edits a price STRUCTURE, so the component itself
 * is Rocoto's.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import { Figure } from '../figure';
import DailyGrid from './daily-grid';
import PriceInput from './price-input';
import Ramp from './ramp';
import { PRICE_ID } from './constants';
import {
  Body as StyledBody,
  CardCount as StyledCardCount,
  CardHeader as StyledCardHeader,
  CellButton as StyledCellButton,
  Chip as StyledChip,
  ChipName as StyledChipName,
  Chips as StyledChips,
  Content as StyledContent,
  ContentAnimationContainer as StyledContentAnimationContainer,
  Editor as StyledEditor,
  Empty as StyledEmpty,
  Header as StyledHeader,
  HeaderText as StyledHeaderText,
  LevelMark as StyledLevelMark,
  Name as StyledName,
  Note as StyledNote,
  Quiet as StyledQuiet,
  Root as StyledRoot,
  Span as StyledSpan,
  ToggleIcon as StyledToggleIcon,
  Trailing as StyledTrailing,
} from './styled-components';
import type { Level, PriceAccordionProps, PriceModel, SharedStyleProps, View } from './types';
import { headline, isFullyPinned, rampBounds, spreadOf } from './utils';

/* ── THE LEVEL GLYPH ──────────────────────────────────────────────────────────────────────────
 * Each level drawn as its own shape, which is the fractal in 20 pixels: one mark · a row of marks
 * · a row of marks on a ramp · a field of marks with time running down it. It never carries the
 * meaning alone — the level line beside it says the same thing in words.
 */
const GLYPH: Record<Level, React.ReactNode> = {
  1: <circle cx="10" cy="10" r="2" fill="currentColor" />,
  2: (
    <>
      {[4, 10, 16].map((x) => (
        <circle key={x} cx={x} cy="10" r="1.8" fill="currentColor" />
      ))}
    </>
  ),
  3: (
    <>
      <path d="M3 14L17 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      {[
        [4, 13.4],
        [10, 10],
        [16, 6.6],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="1.8" fill="currentColor" />
      ))}
    </>
  ),
  4: (
    <>
      {[4, 10, 16].map((x) =>
        [4.5, 10, 15.5].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />)
      )}
    </>
  ),
};

const LevelGlyph = ({ level }: { level: Level }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    {GLYPH[level]}
  </svg>
);

/* ── STATE THAT MAY BE OWNED OR LENT ─────────────────────────────────────────────────────────
 * Base's idiom: a prop takes over when it is passed, and the component keeps its own when it is
 * not. It is what lets the kit show a drag standing still while the same component still drags.
 */
function useMaybeControlled<T>(
  controlled: T | undefined,
  initial: T,
  onChange?: (next: T) => void
): [T, (next: T) => void] {
  const [own, setOwn] = React.useState<T>(initial);
  const value = controlled === undefined ? own : controlled;
  const set = (next: T) => {
    if (controlled === undefined) setOwn(next);
    if (onChange) onChange(next);
  };
  return [value, set];
}

/** what the row says its price IS, with the panel shut. A label, not a remark. */
function levelLine(price: PriceModel): string {
  switch (price.level) {
    case 1:
      return price.price == null ? 'One price · to be set' : 'One price · fixed';
    case 2:
      return `${price.tiers.length} tiers · fixed`;
    case 3:
      return `${price.stops.length} tiers · ${price.anchorName ?? 'anchor'} and offsets`;
    case 4:
      return `${price.tiers.length} tiers · set daily`;
  }
}

/** «4 People · Overall balances» — the count and the view, then out of the way. */
function cardHeading(price: PriceModel): string {
  switch (price.level) {
    case 1:
      return 'One price · Every customer';
    case 2:
      return `${price.tiers.length} tiers · Fixed`;
    case 3:
      return `${price.stops.length} tiers · Anchor and offsets`;
    case 4:
      return `${price.tiers.length} tiers · Set daily`;
  }
}

const PriceAccordion = (props: PriceAccordionProps) => {
  const {
    name,
    note,
    price,
    onPriceChange,
    expanded: expandedProp,
    onExpandedChange,
    activeStopId: activeProp,
    onActiveStopChange,
    editingTierId: editingProp,
    onEditingTierIdChange,
    view: viewProp,
    onViewChange,
    readOnly = false,
    disabled = false,
    unit,
    decimals = 2,
    locale = 'es-ES',
    overrides = {},
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Header, headerProps] = getOverrides(overrides.Header, StyledHeader);
  const [LevelMark, levelMarkProps] = getOverrides(overrides.LevelMark, StyledLevelMark);
  const [HeaderText, headerTextProps] = getOverrides(overrides.HeaderText, StyledHeaderText);
  const [Name, nameProps] = getOverrides(overrides.Name, StyledName);
  const [Note, noteProps] = getOverrides(overrides.Note, StyledNote);
  const [Trailing, trailingProps] = getOverrides(overrides.Trailing, StyledTrailing);
  const [ToggleIcon, toggleIconProps] = getOverrides(overrides.ToggleIcon, StyledToggleIcon);
  const [AnimationContainer, animationProps] = getOverrides(
    overrides.ContentAnimationContainer,
    StyledContentAnimationContainer
  );
  const [Content, contentProps] = getOverrides(overrides.Content, StyledContent);
  const [CardHeader, cardHeaderProps] = getOverrides(overrides.CardHeader, StyledCardHeader);
  const [Chips, chipsProps] = getOverrides(overrides.Chips, StyledChips);
  const [Chip, chipProps] = getOverrides(overrides.Chip, StyledChip);

  const [expanded, setExpanded] = useMaybeControlled(expandedProp, false, onExpandedChange);
  const [activeId, setActiveId] = useMaybeControlled<string | null>(activeProp, null, onActiveStopChange);
  const [editingId, setEditingId] = useMaybeControlled<string | null>(
    editingProp,
    null,
    onEditingTierIdChange
  );
  const [view, setView] = useMaybeControlled<View>(viewProp, 'grid', onViewChange);

  const uid = React.useId();
  const headerId = `${uid}-header`;
  const contentId = `${uid}-content`;

  const editable = !readOnly && !disabled && !!onPriceChange;
  const shared: SharedStyleProps = {
    $level: price.level,
    $expanded: expanded,
    $disabled: disabled,
    $readOnly: readOnly,
  };

  /* THE RAMP'S ENDS ARE HELD STILL. Derived once from the anchor and then kept, because a ramp
   * whose ends chase the anchor never appears to move — and the anchor moving the whole set along
   * a fixed ramp is the entire point of level 3. */
  const derivedBounds = React.useRef<{ min: number; max: number } | null>(null);
  if (price.level === 3 && !derivedBounds.current) derivedBounds.current = rampBounds(price);
  const bounds =
    price.level === 3
      ? {
          min: price.min ?? derivedBounds.current!.min,
          max: price.max ?? derivedBounds.current!.max,
        }
      : { min: 0, max: 1 };

  const percent = (value: number) =>
    value.toLocaleString(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    });
  const money = (value: number) =>
    `${value.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${unit ? ` ${unit}` : ''}`;

  const head = headline(price);

  /* ── THE COLLAPSED ROW ─────────────────────────────────────────────────────────────────── */

  const trailing =
    head.value == null ? (
      /* the figure's place, held open. The level line beside it already says the price is coming,
         so this stays a mark and never a button the row cannot honour. */
      <StyledQuiet {...shared} aria-hidden="true">
        —
      </StyledQuiet>
    ) : head.high != null ? (
      <>
        <Figure value={head.value} decimals={decimals} locale={locale} size="default" />
        <StyledSpan {...shared}>–</StyledSpan>
        <Figure value={head.high} unit={unit} decimals={decimals} locale={locale} size="default" />
      </>
    ) : (
      <Figure
        value={head.value}
        was={head.was}
        unit={unit}
        decimals={decimals}
        locale={locale}
        size="default"
      />
    );

  /* ── LEVEL 1 ───────────────────────────────────────────────────────────────────────────── */

  const writeSingle = (next: number) => {
    if (!onPriceChange || price.level !== 1) return;
    onPriceChange({
      ...price,
      price: next,
      was: price.price != null && price.price !== next ? price.price : price.was,
    });
    setEditingId(null);
  };

  const fixedBody = price.level === 1 && (
    <>
      <CardHeader {...shared} {...cardHeaderProps}>
        <StyledCardCount {...shared}>{cardHeading(price)}</StyledCardCount>
        {price.since && <StyledQuiet {...shared}>Set {price.since}</StyledQuiet>}
      </CardHeader>

      {editingId === PRICE_ID ? (
        <StyledEditor {...shared}>
          <PriceInput
            value={price.price}
            unit={unit}
            decimals={decimals}
            locale={locale}
            label={`${name} price`}
            onCommit={writeSingle}
            onCancel={() => setEditingId(null)}
          />
        </StyledEditor>
      ) : price.price == null ? (
        <StyledEmpty {...shared}>
          {editable ? (
            <StyledCellButton
              type="button"
              onClick={() => setEditingId(PRICE_ID)}
              aria-label={`Set the first price for ${name}`}
            >
              Set the first price
            </StyledCellButton>
          ) : (
            <span>A price will stand here.</span>
          )}
        </StyledEmpty>
      ) : editable ? (
        <StyledCellButton
          type="button"
          onClick={() => setEditingId(PRICE_ID)}
          aria-label={`${name}, ${money(price.price)}. Write a new price.`}
        >
          <Figure
            value={price.price}
            was={price.was}
            unit={unit}
            decimals={decimals}
            locale={locale}
            size="large"
          />
        </StyledCellButton>
      ) : (
        <Figure
          value={price.price}
          was={price.was}
          unit={unit}
          decimals={decimals}
          locale={locale}
          size="large"
        />
      )}
      <StyledQuiet {...shared}>
        One number carries this item. It moves when somebody moves it, and the number it replaces
        stays beside it.
      </StyledQuiet>
    </>
  );

  /* ── LEVEL 2 ───────────────────────────────────────────────────────────────────────────── */

  const writeTier = (tierId: string, next: number) => {
    if (!onPriceChange || price.level !== 2) return;
    onPriceChange({
      ...price,
      tiers: price.tiers.map((tier) =>
        tier.id === tierId
          ? { ...tier, price: next, was: tier.price !== next ? tier.price : tier.was }
          : tier
      ),
    });
    setEditingId(null);
  };

  const tieredBody = price.level === 2 && (
    <>
      <CardHeader {...shared} {...cardHeaderProps}>
        <StyledCardCount {...shared}>{cardHeading(price)}</StyledCardCount>
        <StyledQuiet {...shared}>Every tier holds until somebody changes it</StyledQuiet>
      </CardHeader>

      {/* Monzo's entity chips: they scroll horizontally, each with its figure beneath its name.
          This is the horizontal axis of the fractal, drawn as itself. */}
      <Chips {...shared} {...chipsProps}>
        {price.tiers.map((tier) =>
          editingId === tier.id ? (
            <StyledEditor key={tier.id} {...shared}>
              <PriceInput
                value={tier.price}
                unit={unit}
                decimals={decimals}
                locale={locale}
                label={`${tier.name} price`}
                onCommit={(next) => writeTier(tier.id, next)}
                onCancel={() => setEditingId(null)}
              />
            </StyledEditor>
          ) : (
            <Chip
              key={tier.id}
              type="button"
              $disabled={!editable}
              disabled={!editable}
              onClick={() => editable && setEditingId(tier.id)}
              aria-label={`${tier.name}, ${money(tier.price)}${editable ? '. Write a new price.' : ''}`}
              {...chipProps}
            >
              <StyledChipName {...shared}>{tier.name}</StyledChipName>
              <Figure
                value={tier.price}
                was={tier.was}
                unit={unit}
                decimals={decimals}
                locale={locale}
                size="compact"
              />
            </Chip>
          )
        )}
      </Chips>
    </>
  );

  /* ── LEVEL 3 ───────────────────────────────────────────────────────────────────────────── */

  const anchoredBody = price.level === 3 && (
    <>
      <CardHeader {...shared} {...cardHeaderProps}>
        <StyledCardCount {...shared}>{cardHeading(price)}</StyledCardCount>
        {/* THE INVARIANT, PRINTED WHERE IT CAN BE CHECKED. Drag the anchor and this pair holds
            still — that is the whole claim of level 3, and it is claimed in public. */}
        <StyledQuiet {...shared}>
          Spread {percent(spreadOf(price).low)} % to {percent(spreadOf(price).high)} %
        </StyledQuiet>
      </CardHeader>

      <Ramp
        price={price}
        bounds={bounds}
        onChange={editable ? (next) => onPriceChange && onPriceChange(next) : undefined}
        activeId={activeId}
        onActiveIdChange={setActiveId}
        disabled={disabled}
        editable={editable}
        unit={unit}
        decimals={decimals}
        locale={locale}
        overrides={overrides}
      />

      <StyledQuiet {...shared}>
        {isFullyPinned(price)
          ? 'Every stop is pinned: each tier holds its own price now, and this item is behaving as a level 4.'
          : editable
            ? `Drag a tier to change what it is worth beside ${
                price.anchorName ?? 'the anchor'
              }. Drag ${price.anchorName ?? 'the anchor'} and the whole set travels with it. Pin a tier to hold a price of its own.`
            : `Each tier keeps its own distance from ${price.anchorName ?? 'the anchor'}, and moves when ${
                price.anchorName ?? 'the anchor'
              } moves.`}
      </StyledQuiet>
    </>
  );

  /* ── LEVEL 4 ───────────────────────────────────────────────────────────────────────────── */

  const discretionaryBody = price.level === 4 && (
    <>
      <CardHeader {...shared} {...cardHeaderProps}>
        <StyledCardCount {...shared}>{cardHeading(price)}</StyledCardCount>
        <StyledQuiet {...shared}>
          {editable ? `${price.days[0]} is open for writing` : `${price.days[0]} stands at the top`}
        </StyledQuiet>
      </CardHeader>

      <DailyGrid
        price={price}
        onChange={editable ? (next) => onPriceChange && onPriceChange(next) : undefined}
        editingTierId={editingId}
        onEditingTierIdChange={setEditingId}
        view={view}
        onViewChange={setView}
        name={name}
        disabled={disabled}
        editable={editable}
        unit={unit}
        decimals={decimals}
        locale={locale}
        overrides={overrides}
      />
    </>
  );

  return (
    <Root data-baseweb="price-accordion" {...shared} {...rootProps}>
      <Header
        type="button"
        id={headerId}
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && setExpanded(!expanded)}
        {...shared}
        {...headerProps}
      >
        <LevelMark {...shared} {...levelMarkProps}>
          <LevelGlyph level={price.level} />
        </LevelMark>

        <HeaderText {...headerTextProps}>
          <Name {...shared} {...nameProps}>
            {name}
          </Name>
          <Note {...shared} {...noteProps}>
            {levelLine(price)}
            {note ? ` · ${note}` : ''}
          </Note>
        </HeaderText>

        <Trailing {...shared} {...trailingProps}>
          {trailing}
        </Trailing>

        <ToggleIcon
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
          {...shared}
          {...toggleIconProps}
        >
          <path
            d="M4 6.5L8 10.5L12 6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </ToggleIcon>
      </Header>

      <AnimationContainer {...shared} {...animationProps}>
        <Content id={contentId} role="region" aria-labelledby={headerId} {...shared} {...contentProps}>
          <StyledBody {...shared}>
            {fixedBody}
            {tieredBody}
            {anchoredBody}
            {discretionaryBody}
          </StyledBody>
        </Content>
      </AnimationContainer>
    </Root>
  );
};

export default PriceAccordion;
