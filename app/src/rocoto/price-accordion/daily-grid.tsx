/* LEVEL 4 — THE GRID. «The person decides what that tier is for that item that day, knowing who's
 * ordered what, what kind of customers they have, what kind of availability there is.»
 *
 * No percentage expresses that, so there is no anchor here and no ramp: there is a grid. Tiers run
 * across — the horizontal axis of the fractal — and days run down, which is the vertical axis
 * arriving. «That change every day means that there's a log of the change every day», so:
 *
 *   · TODAY is the first row and the only writable one. Everything under it is the record.
 *   · Writing a price APPENDS to the log rather than overwriting it, so the number it replaced is
 *     still there and the Figure keeps it struck through beside the new one.
 *   · Because there is a log, the item's price over time is a chart — the same data, read down
 *     the other axis. The chart is the kit's own LineChart, one trace per tier.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import { ButtonGroup, MODE, SIZE, KIND } from 'baseui/button-group';
import { Button } from 'baseui/button';
import { Figure } from '../figure';
import { LineChart } from '../charts';
import type { Dash } from '../charts';
import PriceInput from './price-input';
import {
  CellButton as StyledCellButton,
  Editor as StyledEditor,
  Grid as StyledGrid,
  GridCell as StyledGridCell,
  GridDayCell as StyledGridDayCell,
  GridHeadCell as StyledGridHeadCell,
  Quiet as StyledQuiet,
} from './styled-components';
import type { DiscretionaryPrice, PriceAccordionOverrides, View } from './types';
import { cellValue, writeCell } from './utils';

/** a run is told apart by its STROKE, never by a colour — the charts' own law, applied here */
const DASHES: Dash[] = ['solid', 'dashed', 'dotted'];

export type DailyGridProps = {
  price: DiscretionaryPrice;
  onChange?: (price: DiscretionaryPrice) => void;
  editingTierId: string | null;
  onEditingTierIdChange: (id: string | null) => void;
  view: View;
  onViewChange: (view: View) => void;
  name: string;
  disabled: boolean;
  editable: boolean;
  unit?: string;
  decimals: number;
  locale: string;
  overrides: PriceAccordionOverrides;
};

const DailyGrid = ({
  price,
  onChange,
  editingTierId,
  onEditingTierIdChange,
  view,
  onViewChange,
  name,
  disabled,
  editable,
  unit,
  decimals,
  locale,
  overrides,
}: DailyGridProps) => {
  const [Grid, gridProps] = getOverrides(overrides.Grid, StyledGrid);
  const [Cell, cellProps] = getOverrides(overrides.GridCell, StyledGridCell);

  const today = price.days[0];
  const money = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  /* the chart reads the same log down the other axis: oldest reading on the left, because time
   * runs that way and a chart that argues with that is read backwards */
  const chronological = [...price.days].reverse();
  const series = price.tiers.map((tier, index) => ({
    name: tier.name,
    dash: DASHES[index % DASHES.length],
    data: chronological
      .map((day, x) => ({ x, y: cellValue(price, day, tier.id).value }))
      .filter((point): point is { x: number; y: number } => point.y != null),
  }));

  return (
    <>
      <ButtonGroup
        mode={MODE.radio}
        size={SIZE.mini}
        kind={KIND.secondary}
        disabled={disabled}
        selected={view === 'chart' ? 1 : 0}
        onClick={(_event: React.SyntheticEvent<HTMLButtonElement>, index: number) =>
          onViewChange(index === 1 ? 'chart' : 'grid')
        }
        aria-label="How to read the log"
      >
        <Button type="button">Grid</Button>
        <Button type="button">Chart</Button>
      </ButtonGroup>

      {view === 'grid' ? (
        <Grid aria-label={`${name}: price by tier and day`} {...gridProps}>
          <thead>
            <tr>
              <StyledGridHeadCell scope="col" style={{ textAlign: 'left' }}>
                Day
              </StyledGridHeadCell>
              {price.tiers.map((tier) => (
                <StyledGridHeadCell key={tier.id} scope="col">
                  {tier.name}
                </StyledGridHeadCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {price.days.map((day, row) => {
              const isToday = row === 0;
              return (
                <tr key={day}>
                  <StyledGridDayCell scope="row" $active={isToday}>
                    {day}
                  </StyledGridDayCell>
                  {price.tiers.map((tier) => {
                    const { value, was } = cellValue(price, day, tier.id);
                    const writing = isToday && editingTierId === tier.id;
                    return (
                      <Cell key={tier.id} $active={isToday} {...cellProps}>
                        {writing ? (
                          <StyledEditor>
                            <PriceInput
                              value={value}
                              unit={unit}
                              decimals={decimals}
                              locale={locale}
                              label={`${tier.name}, ${day}`}
                              onCommit={(next) => {
                                if (onChange) onChange(writeCell(price, day, tier.id, next));
                                onEditingTierIdChange(null);
                              }}
                              onCancel={() => onEditingTierIdChange(null)}
                            />
                          </StyledEditor>
                        ) : isToday && editable ? (
                          <StyledCellButton
                            type="button"
                            $disabled={disabled}
                            disabled={disabled}
                            onClick={() => onEditingTierIdChange(tier.id)}
                            aria-label={
                              value == null
                                ? `Set ${tier.name} for ${day}`
                                : `${tier.name}, ${day}, ${money(value)}${unit ? ` ${unit}` : ''}. Write a new price.`
                            }
                          >
                            {value == null ? (
                              <StyledQuiet>Set</StyledQuiet>
                            ) : (
                              <Figure
                                value={value}
                                was={was}
                                unit={unit}
                                decimals={decimals}
                                locale={locale}
                                size="compact"
                              />
                            )}
                          </StyledCellButton>
                        ) : value == null ? (
                          <StyledQuiet>—</StyledQuiet>
                        ) : (
                          <Figure
                            value={value}
                            was={was}
                            unit={unit}
                            decimals={decimals}
                            locale={locale}
                            size={isToday ? 'compact' : 'mini'}
                          />
                        )}
                      </Cell>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </Grid>
      ) : (
        <LineChart
          series={series}
          height={196}
          unit={unit}
          decimals={decimals}
          locale={locale}
          disabled={disabled}
          formatX={(value) => chronological[value] ?? ''}
          emptyText="The prices set from today will draw here."
        />
      )}

      <StyledQuiet>
        {price.log.length} entries in the log.{' '}
        {editable
          ? 'Writing a price adds one, and the number it replaced stays beside it.'
          : 'Every price this item has held is still in it.'}
      </StyledQuiet>
    </>
  );
};

export default DailyGrid;
