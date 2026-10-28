/** The attention facts shared by sales rows and the document header, said in THE RED (§196.3).
 *
 * ⚠ THE PILLS ARE RED NOW, AND THE FOLD MOVED (FEED-IA §196.3). Peter: «any fucking alert or
 * message for "flagged" orders have to have red identifiers and not dots, like red outline on the
 * message etc like come on be top down!!!» The vocabulary — the outline, the tint, the pill, the
 * mark, the ink — is decided once in `red-flag.tsx` and this file is one of its users. The fold
 * (`activeAttentionConcernsOf`) moved there with it so the marks and the set they mark cannot
 * drift; it is re-exported unchanged, because three surfaces already import it from here.
 *
 * ⚠ AND THE OPERATOR'S OWN FLAG IS ONE OF THEM. `sale.flagged` — the Flag/Unflag ledger event the
 * albarán head writes — is the thing Peter's word literally names, and before §196.3 it wore no
 * red on any list: an order a person had deliberately flagged for follow-up looked identical to
 * one nobody had touched. It is a third label here, in the same red as the other two.
 */
import { useStyletron } from 'baseui';
import { type Sale } from './sale';
import { FLAG_WORD, FlagPill, useFlagStanding, type FlagKind } from './red-flag';

/* the fold's one home is `red-flag.tsx`; these two names keep working for their existing callers */
export { activeAttentionConcernsOf, useAttention } from './red-flag';

export function AttentionLabels({ sale, testid }: { sale: Sale; testid?: string }) {
  const [, theme] = useStyletron();
  const standing = useFlagStanding(sale);
  if (!standing.any) return null;
  return <span data-testid={testid ?? `attention-${sale.id}`}
    data-response={standing.response} data-check={standing.check} data-marked={standing.marked}
    style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', maxWidth: '100%', gap: theme.sizing.scale200 }}>
    {(['response', 'check', 'marked'] as const).filter((key) => standing[key]).map((key: FlagKind) =>
      <FlagPill key={key} kind={key} word={FLAG_WORD[key]} />)}
  </span>;
}
