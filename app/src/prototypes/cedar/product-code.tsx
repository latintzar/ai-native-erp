/** THE CODE STANDS ALONE (FEED-IA §200.1).
 *
 * Peter, 2026-09-04: «in products, you don't need to say SKU and then put the SKU. Just put the
 * code. That's all.»
 *
 * A product's code is PRINTED as the code — «PV-1001» — and the word that names the register is
 * not printed beside it. «SKU PV-1001» spends the row's second line saying what kind of string is
 * about to follow, and a reader who can see PV-1001 already knows. So one seat, one fact:
 *
 *   Merluza                    ← the name, at the row's own step
 *   PV-1001                    ← the code, tabular, secondary, one step down
 *
 * TABULAR, because a column of codes is read down and proportional digits make every row start in
 * a different place. The colour and the type step are the SEAT's, never this component's: it emits
 * one span that inherits both, so the same code reads correctly in a list row, on a sheet, on a
 * line, on a chip and in an export's on-screen label.
 *
 * A code that has not arrived yet says so in one grammar, everywhere: «Code pending». It states
 * what IS — the code is on its way — where «No SKU» / «SKU needs review» / «SKU not supplied»
 * spent three different sentences on the same absence.
 *
 * The register keeps its name where a FIELD or a COLUMN is being named: «Code». The word SKU
 * survives only in identifiers, testids and file column contracts, which no reader sees.
 */
import * as React from 'react';

/** The one sentence for a code that has not arrived yet. */
export const CODE_PENDING = 'Code pending';

/** The code as plain text, where the seat composes one string (option labels, chips, cells). */
export const codeText = (code?: string | null): string => code?.trim() || CODE_PENDING;

/** The code as it is printed: the code alone, in tabular figures, at the seat's own step. */
export function ProductCode({ code }: { code?: string | null }) {
  const value = code?.trim();
  if (!value) return <>{CODE_PENDING}</>;
  return <span data-product-code={value} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>;
}
