/* THE PAPER STAGE — C-15: `paper` is a STAGE TREATMENT, not a fourth frame.
 *
 * The method names three frames — desk · phone · public — and two of the catalogue's cards are
 * printed artefacts (F0's picking sheet, H1's albarán). A fourth frame would say that print is a
 * separate world; it is not. A printed sheet is something a desk surface produces and something a
 * phone shows in a cold room, so `PaperStage` is a STAGE that stands inside either.
 *
 * What it draws: the print preview's ground, the sheet or sheets at true proportion on it, and the
 * page count — which is the number H1 watches move while the column set stays put.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Paper, SHEET } from '../../rocoto/paper';
import type { PaperProps } from '../../rocoto/paper';

export type PaperStageProps = Omit<PaperProps, 'scale' | 'onPaginate'> & {
  /** the width the stage has to work with; the sheet scales to fit it */
  stageWidth?: number;
  /** the ground's own height inside the surface holding it */
  height?: number;
  /** Uses full physical paper geometry without the scrollable preview stage. */
  printMode?: boolean;
};

export default function PaperStage({ stageWidth = 520, height = 620, printMode = false, ...paper }: PaperStageProps) {
  const [, theme] = useStyletron();
  const [pages, setPages] = React.useState(1);
  const format = paper.format ?? 'a4';
  const scale = Math.min(1, (stageWidth - 48) / SHEET[format].width);
  if (printMode) return <Paper {...paper} scale={1} onPaginate={setPages} />;

  return (
    <div
      style={{
        background: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        height,
        overflowY: 'auto',
        padding: theme.sizing.scale600,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: theme.sizing.scale500,
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <span>{format.toUpperCase()}</span>
        <span>{pages === 1 ? '1 page' : `${pages} pages`}</span>
      </div>
      <Paper {...paper} scale={scale} onPaginate={setPages} />
    </div>
  );
}
