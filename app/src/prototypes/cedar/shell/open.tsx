/* THE OPEN POINTER — law 4, carried into the app.
 *
 * NO ANONYMOUS GREY ANYWHERE. Every ghosted surface in `src/prototypes/cedar/areas/` says which package lands
 * it, so the prototype renders complete from day one and nobody has to guess whether a grey region
 * is unfinished or undecided. When APP-A, APP-B and APP-C land their files, these go with them.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';

export default function Open({ owner, what }: { owner: string; what: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-open={owner}
      style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, flexWrap: 'wrap' }}
    >
      {/* neutral, not accent: saffron marks the AI's own act and nothing else, and a build
          pointer is ours, not Rocoto's */}
      <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>OPEN · {owner}</Tag>
      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{what}</span>
    </div>
  );
}
