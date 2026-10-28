import { useStyletron } from 'baseui';
import { Figure as KitFigure, type FigureProps } from '../../rocoto/figure';
import { CURRENCY_SYMBOL, MONEY_LOCALE, syntheticAmountForCountry, workspaceCurrency } from './currency';
import { workspaceCapabilitiesNow } from './workspace-capabilities';

/** Keep Cedar's currency and its rate unit on the same unbroken line, in the currency's own
 * grammar: soles lead the number («S/ 61.62/kg», en-PE), euros follow it («16,74 €/kg», es-ES),
 * the same shapes `formatMoney` and `soles()` write, so every figure in the app reads one way. */
export function Figure({ locale = MONEY_LOCALE, ...props }: FigureProps) {
  const [, theme] = useStyletron();
  if (!props.unit?.startsWith(CURRENCY_SYMBOL)) return <KitFigure {...props} locale={locale} />;
  const country = workspaceCapabilitiesNow().country;
  const currency = workspaceCurrency();
  const rate = props.unit.slice(CURRENCY_SYMBOL.length).trim().replace(/^per\s+/, '/');
  const value = syntheticAmountForCountry(props.value, country);
  if (currency === 'EUR') {
    return <span data-currency={currency} style={{ display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      <KitFigure {...props} value={value} locale="es-ES" unit={`€${rate}`} />
    </span>;
  }
  return <span data-currency={currency} style={{ display: 'inline-flex', alignItems: 'baseline', gap: theme.sizing.scale100, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
    <span style={theme.typography.LabelSmall}>{CURRENCY_SYMBOL}</span>
    <KitFigure {...props} value={value} locale={locale} unit={rate || undefined} />
  </span>;
}
