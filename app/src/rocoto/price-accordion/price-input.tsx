/* THE NUMBER BEING WRITTEN — Base's own Input, at mini, with the unit in its end enhancer so the
 * unit shares the number's line while it is being typed exactly as it does once it is set.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * One editor serves every level: the single price at level 1, a tier chip at level 2, a cell in
 * the grid at level 4. They are the same act — a person putting a number in — so they are the
 * same control, and the keyboard contract is written once: Enter writes it, Escape leaves it,
 * leaving the field writes it.
 */
import * as React from 'react';
import { Input } from 'baseui/input';

export type PriceInputProps = {
  /** what the field opens on */
  value: number | null;
  unit?: string;
  decimals: number;
  locale: string;
  /** what a screen reader is told it is writing */
  label: string;
  onCommit: (next: number) => void;
  onCancel: () => void;
};

/** «4,20» → 4.2, in any locale that writes its decimals with a comma. A number typed with the
 *  keyboard's own point works too, because people type what their keyboard has. */
export const parsePrice = (text: string): number | null => {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

const PriceInput = ({ value, unit, decimals, locale, label, onCommit, onCancel }: PriceInputProps) => {
  const [text, setText] = React.useState(() =>
    value == null
      ? ''
      : value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  );
  /* one commit only: Enter writes, and the blur that Enter causes must not write a second time */
  const done = React.useRef(false);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    const next = parsePrice(text);
    if (next == null) onCancel();
    else onCommit(next);
  };

  return (
    <Input
      size="mini"
      autoFocus
      value={text}
      inputMode="decimal"
      aria-label={label}
      endEnhancer={unit}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          done.current = true;
          onCancel();
        }
      }}
      overrides={{ Root: { style: { width: '100%' } } }}
    />
  );
};

export default PriceInput;
