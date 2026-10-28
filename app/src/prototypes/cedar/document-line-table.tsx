import * as React from 'react';
import { useStyletron } from 'baseui';

/** The same parser line review for provider-backed attachments and private operator uploads. */
export function DocumentLineTable({ result }: { result: { columns: string[]; rows: Record<string, unknown>[] } }) {
  const [, theme] = useStyletron();
  const numeric = (column: string) => /quantity|price|amount|total|weight|count/i.test(column);
  return <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
    <table style={{ ...theme.typography.ParagraphSmall, width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{result.columns.map(column => <th key={column} scope="col" style={{
        ...theme.typography.LabelSmall, textAlign: numeric(column) ? 'right' : 'left',
        color: theme.colors.contentSecondary, borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        padding: `${theme.sizing.scale400} ${theme.sizing.scale300}`, whiteSpace: 'nowrap',
      }}>{column.charAt(0).toUpperCase() + column.slice(1).replace(/_/g, ' ')}</th>)}</tr></thead>
      <tbody>{result.rows.map((row, index) => <tr key={index}>{result.columns.map(column => <td key={column} style={{
        padding: `${theme.sizing.scale500} ${theme.sizing.scale300}`, verticalAlign: 'top',
        borderBottom: `1px solid ${theme.colors.borderOpaque}`, textAlign: numeric(column) ? 'right' : 'left',
        fontVariantNumeric: 'tabular-nums', minWidth: numeric(column) ? '72px' : '120px',
      }}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
