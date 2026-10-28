/* G3 · The same screen with a file.
 *
 * IDENTICAL TO G2, and the arrangement stated as what it is: «The file downloads and you upload
 * it.» That is the sentence, and it is a description of a working arrangement rather than a
 * description of something absent — most houses run this way for months and it is fine.
 *
 * THE CONTROL DELTA IS ONE PROP. `arrival-record` carries a control slot on every row; G2 leaves
 * it empty and G3 puts a download in it. There is no second table, no branch and no variant.
 *
 * THE CHECK THIS CARD ASKS OUT LOUD. A house that sells in cajas and bills in kilos has two
 * quantities per line, and an accounting system usually has one quantity column. Which unit the
 * file carries is decided once, at setup, and it is the single most likely place a first file
 * lands wrong — so the card asks it on its face instead of taking a default (SECTORS §10). The two
 * chips are read off the cast's own pack, so every sector asks the question in its own units.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import ArrivalRecord, { ArrivalHead, type ArrivalRow } from '../canonical/arrival-record';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'G3',
  title: 'The same screen with a file',
  group: 'G',
  frame: 'desk',
  ifText: 'the accounting system takes a file rather than a direct write',
  dims: ['D14.erp'],
  job: 'Take the day out as a file, and know which unit it carries.',
  decides:
    'that a file is an ordinary arrangement with its own record, and which of a line’s two quantities the file carries',
  inherits: [
    { region: 'the same record with a direct write', ref: 'G2' },
    { region: 'the albaranes this file covers', ref: 'G1' },
    { region: 'the rail', ref: 'K' },
  ],
  open: [
    { region: "the day's file, and where it waits", ref: 'OPEN-5' },
    { region: "the day's bar and the day's list", ref: 'OPEN-1' },
  ],
  primitives: [],
  kit: ['Button', 'Tag', 'Ghost'],
  canonical: 'arrival-record',
  delta: 'control',
  deltaText: 'a download stands in the row’s control slot where G2 has a write',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fruit',
  thread: [1],
  step: 11,
  fills: [],
  reads: ['albarán'],
  live:
    'press the download on today’s row and the row states the file it produced; the two chips settle which unit the file carries, and the sector switch changes the pair of units they offer',
};

const DAYS = [
  { day: '22.08', at: '07:22', took: '07:25', docs: 14, lines: 168 },
  { day: '21.08', at: '07:19', took: '07:24', docs: 12, lines: 141 },
  { day: '20.08', at: '07:31', took: '07:48', docs: 15, lines: 187 },
  { day: '19.08', at: '07:14', took: '07:20', docs: 11, lines: 129 },
  { day: '18.08', at: '07:26', took: '07:39', docs: 13, lines: 152 },
];

export default function G3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [taken, setTaken] = React.useState<string | null>(null);

  /* THE TWO UNITS THE CHECK IS ABOUT, read off the cast: the pack the market buys in, and the unit
     the customer is billed in. A house whose pack and unit are the same word never sees this. */
  const packed = cast.products.find((p) => p.pack && p.pack.unit !== p.unit) ?? cast.products[0];
  const units = [packed.pack ? packed.pack.unit : packed.unit, packed.unit];
  const [unit, setUnit] = React.useState(units[1]);

  React.useEffect(() => {
    setTaken(null);
    setUnit(units[1]);
    // the cast changes the pair of units, so the answer starts again with it
  }, [cast.sector]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: ArrivalRow[] = DAYS.map((d, i) => ({
    id: d.day,
    what: `File ${d.day}`,
    sub: `${d.docs} albaranes · ${d.lines} lines · quantities in ${unit}`,
    where: 'your downloads',
    left: d.at,
    back:
      i === 0
        ? taken
          ? [{ label: 'downloaded', value: taken }]
          : undefined
        : [{ label: 'downloaded', value: d.took }],
    pending: i === 0 && !taken ? 'Ready for you' : undefined,
    control:
      i === 0 && !taken ? (
        <Button kind={KIND.secondary} size={SIZE.compact} onClick={() => setTaken(DAYS[0].took)}>
          Download {d.day}
        </Button>
      ) : undefined,
  }));

  return (
    <DeskChassis selected={0} rows={9} height={900} daybar={false} daylist={{ open: 5, label: "the day's files" }}>
      <ArrivalRecord
        columns={{ what: 'What went', where: 'Where', left: 'Left', back: 'What came back' }}
        rows={rows}
        head={<ArrivalHead>The file downloads and you upload it. That is the whole arrangement.</ArrivalHead>}
        aside={
          <section
            style={{
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius300,
              padding: theme.sizing.scale600,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale400,
            }}
          >
            <h2 style={{ margin: 0, ...theme.typography.LabelMedium }}>
              Which quantity does the file carry?
            </h2>
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              A line of {packed.name} leaves as {packed.pack?.factor ?? 1}{' '}
              {packed.unit} in one {packed.pack?.unit ?? packed.unit}. Your accounting system keeps
              one quantity column, so it takes one of them.
            </p>
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
              {units.map((u) =>
                u === unit ? (
                  <Tag key={u} closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                    {u}
                  </Tag>
                ) : (
                  <Button key={u} kind={KIND.tertiary} size={SIZE.compact} onClick={() => setUnit(u)}>
                    {u}
                  </Button>
                ),
              )}
            </div>
            <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              Settled once, at setup. Every file after this one carries {unit}.
            </p>
          </section>
        }
      />
    </DeskChassis>
  );
}
