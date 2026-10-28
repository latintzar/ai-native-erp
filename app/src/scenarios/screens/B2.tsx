/* B2 · Check the supplier's document against what was read.
 * `D7.doc-digital` · desk · canonical `doc-check` — ORIGIN.
 *
 * THE AGREEMENT CHECK. Extracted rows on one side, the sheet on the other, the matching text lit
 * from either end, and the single row that disagrees carrying the only hand on the screen. Every
 * other row is inert, and that is the design: a screen that asks a person to confirm four rows
 * they have no reason to doubt has taught them to confirm the fifth without looking.
 *
 * THE REFUSAL IS ON THE CARD (FLOWS §3a). Rocoto holds no purchase order, so there is nothing
 * upstream to reconcile against and the three-way match a purchasing system runs is refused. A
 * supplier's albarán has exactly two checks — its own arithmetic, and the count of what was
 * physically received — and both are drawn.
 *
 * SECTOR. Meat is the home: a row per lot, a weight per piece. Fruit's Mercabarna albarán carries
 * calibre and categoría columns, which is the same table with a different sub-line. FISH IS THE
 * HOLE: fish's document is usually not an albarán at all but a *nota de venta* from the lonja,
 * which is simultaneously the cost record and the origin of the traceability chain. The brief
 * models those as two dimensions (D7, D12); in fish they arrive on one sheet. `OPEN-9`, and the
 * card says so under the sheet's own title.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import DocCheck, { type DocCheckRow } from '../canonical/doc-check';
import { GBatchbook, GRegion } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { productOf, familyOf, supplierOf } from '../data/cast';
import Name from '../shell/Name';
import OpenChip from '../shell/OpenChip';

export const meta: ScenarioMeta = {
  id: 'B2',
  title: "Check the supplier's document against what was read",
  group: 'B',
  frame: 'desk',
  ifText: "cost is taken from a supplier's albarán that arrives by email",
  dims: ['D7.doc-digital'],
  job: "Agree that the reading and the supplier's sheet say the same thing.",
  decides:
    'that the sheet and the reading stand beside each other, that pointing at either end lights the other, and that the one row that disagrees carries the only hand on the screen',
  inherits: [
    { region: 'the rail', ref: 'K' },
    { region: 'what this cost becomes', ref: 'C3' },
    { region: 'the batch these rows create', ref: 'E3' },
  ],
  open: [
    { region: 'the document inbox and the batch ledger', ref: 'OPEN-5' },
    { region: "fish's nota de venta, which is cost and origin on one sheet", ref: 'OPEN-9' },
  ],
  primitives: ['U07'],
  kit: ['Paper', 'Figure', 'Button', 'Tag', 'Ghost'],
  canonical: 'doc-check',
  delta: 'origin',
  deltaText: 'the card that IS the document check; B3 is this screen reached through a camera door',
  sector: { fish: 'Δ', meat: '=', fruit: 'Δ' },
  drawnWith: 'meat',
  thread: [2, 3],
  step: 2,
  fills: ['cost', 'lot'],
  reads: [],
  live:
    "point at a row and the line lights on the sheet beside it; point at the sheet and the row lights; settle the one row that disagrees and the struck total leaves the reading's own figure",
};

/** How far the sheet stands from the reading on the row that disagrees. One row, one figure — a
 *  screen where two rows disagree is a screen about a broken parser, not about an agreement. */
const DISAGREEMENT = 0.42;

export default function B2() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const supplier = supplierOf(cast, cast.batches[0].supplier);

  const build = React.useCallback((): DocCheckRow[] => {
    return cast.batches.map((b, i) => {
      const product = productOf(cast, b.product);
      const family = familyOf(cast, product);
      /* the packages that came off the lorry — the count check adds these up. The quantity
         itself stays in the unit the cost is denominated in, so a line's amount is qty × cost. */
      const packs = product.pack
        ? { count: Math.max(1, Math.round(b.qty / product.pack.factor)), unit: product.pack.unit }
        : undefined;
      return {
        id: b.id,
        name: <Name of={product} />,
        /* the family's own field set, with the LOTE taken from the batch this sheet created.
           A family that already carries `lote` gets it filled rather than repeated. */
        sub: (family.lineFields.includes('lote')
          ? family.lineFields
          : ['lote', ...family.lineFields]
        ).map((label) => ({ label, value: label === 'lote' ? b.id : product.trace[label] ?? '' })),
        qty: b.qty,
        unit: product.unit,
        packs,
        cost: b.cost,
        per: `€/${product.unit}`,
        /* the last row is the one that disagrees */
        docCost:
          i === cast.batches.length - 1
            ? Math.round((b.cost + DISAGREEMENT) * 100) / 100
            : undefined,
      };
    });
  }, [cast]);

  /* THE SHEET AS IT ARRIVED. The sector switch hands this screen a different account, and a
     different account's supplier sent a different sheet — so the paper is rebuilt with it. */
  const sheet = React.useMemo(build, [build]);
  const [rows, setRows] = React.useState<DocCheckRow[]>(sheet);
  React.useEffect(() => setRows(sheet), [sheet]);

  /* THE SHEET'S OWN PRINTED TOTAL, read off the paper and then held: correcting the reading moves
     the reading and never the paper. A supplier's albarán almost always adds up, and the check
     exists for the morning one does not. */
  const statedTotal = React.useMemo(
    () => Math.round(sheet.reduce((s, r) => s + r.qty * (r.docCost ?? r.cost), 0) * 100) / 100,
    [sheet],
  );

  const settle = (id: string, take: 'sheet' | 'reading') =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, cost: take === 'sheet' ? r.docCost ?? r.cost : r.cost, docCost: undefined }
          : r,
      ),
    );

  /* the count at the bay is per LINE (see `doc-check`): every line the sheet lists was found */
  const found = rows.length;

  return (
    /* the day's list is the document inbox here, and nobody has decided what that looks like */
    <DeskChassis
      daybar={false}
      daylist={{ open: 5, label: 'the documents that arrived' }}
      selected={1}
      rows={11}
      height={880}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
        <DocCheck
          rows={rows}
          documentTitle={
            cast.sector === 'fish' ? <>The lonja’s nota de venta</> : <>The supplier’s albarán</>
          }
          photographed={
            cast.sector === 'fish' ? (
              <>
                In fish this one sheet is the cost record and the origin of the traceability chain
                at the same time. The brief holds those as two dimensions, D7 and D12, and the
                lonja sends them on one page — <OpenChip n={9} />
              </>
            ) : undefined
          }
          masthead={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong>
                <Name of={supplier} />
              </strong>
              <span>Albarán {cast.batches[0].id} · {cast.batches[0].day}</span>
            </div>
          }
          statedTotal={statedTotal}
          found={found}
          listed={sheet.length}
          renderResolve={(r) =>
            r.docCost !== undefined ? (
              <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, flex: 1, minWidth: '18ch' }}>
                  The sheet prints {r.docCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} {r.per}.
                </span>
                <Button kind={KIND.primary} size={SIZE.mini} onClick={() => settle(r.id, 'sheet')}>
                  Take the sheet’s
                </Button>
                <Button kind={KIND.tertiary} size={SIZE.mini} onClick={() => settle(r.id, 'reading')}>
                  Keep ours
                </Button>
              </div>
            ) : null
          }
        />

        {/* where the sheet and its rows go to rest, and what the cost becomes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: theme.sizing.scale600 }}>
          <GBatchbook rows={5} label="the batches this makes" />
          <GRegion to="C3" height={120} label="the price it feeds" />
        </div>
      </div>
    </DeskChassis>
  );
}
