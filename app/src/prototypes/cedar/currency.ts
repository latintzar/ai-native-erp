import { workspaceCapabilitiesNow, type WorkspaceCountry } from './workspace-capabilities';

/** Synthetic commerce values are stored canonically in PEN. Presentation converts that value;
 * provider and fiscal records use their own explicit currency instead of this adapter. */
export const CEDAR_CURRENCY = 'PEN' as const;
export const CURRENCY_SYMBOL = 'S/';
export const MONEY_LOCALE = 'en-PE';
export type WorkspaceCurrency = 'PEN' | 'EUR';
/** Fixed scenario migration rate, inherited from Cedar's original Peru fixtures. */
export const LEGACY_EUR_TO_PEN = 3.9;
export const seedSoles = (value: number): number => Math.round((value * LEGACY_EUR_TO_PEN + Number.EPSILON) * 100) / 100;

export const countryCurrency = (country: WorkspaceCountry): WorkspaceCurrency => country === 'spain' ? 'EUR' : 'PEN';
export const workspaceCurrency = (scope?: string): WorkspaceCurrency => countryCurrency(workspaceCapabilitiesNow(scope).country);
export const syntheticAmountForCountry = (pen: number, country: WorkspaceCountry): number =>
  country === 'spain' ? Math.round((pen / LEGACY_EUR_TO_PEN + Number.EPSILON) * 100) / 100 : pen;
export const canonicalSyntheticAmount = (value: number, country: WorkspaceCountry = workspaceCapabilitiesNow().country): number =>
  country === 'spain' ? Math.round((value * LEGACY_EUR_TO_PEN + Number.EPSILON) * 100) / 100 : value;

const amounts = new Map<string, Intl.NumberFormat>();
export function soles(value: number, decimals = 2): string {
  const country = workspaceCapabilitiesNow().country;
  if (country === 'peru') {
    const key = `${MONEY_LOCALE}:plain:${decimals}`;
    if (!amounts.has(key)) amounts.set(key, new Intl.NumberFormat(MONEY_LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    return `${CURRENCY_SYMBOL} ${amounts.get(key)!.format(value)}`;
  }
  const currency = countryCurrency(country);
  const locale = country === 'spain' ? 'es-ES' : MONEY_LOCALE;
  const key = `${locale}:${currency}:${decimals}`;
  if (!amounts.has(key)) amounts.set(key, new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  return amounts.get(key)!.format(syntheticAmountForCountry(value, country));
}
export const solesRate = (value: number, unit: string): string => `${soles(value)}/${unit}`;
