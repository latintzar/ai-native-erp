/* B3 · Capture a paper document at the loading bay.
 * `D7.doc-paper` · phone · canonical `doc-check` — CONTROL DELTA: reached through a camera door,
 * and the repairs are spoken.
 *
 * B3 IS B2 REACHED THROUGH A CAMERA DOOR (C-13). Everything below the door is the same screen —
 * the sheet, the reading beside it, the two checks, the one row that carries a hand. What changes
 * is the two ends: the document arrives through a lens instead of an inbox, and the values the
 * photograph could not read are asked for BY VOICE, because the person holding the phone is at a
 * loading bay with a lorry running and one hand free.
 *
 * THE PHOTOGRAPH IS KEPT. Not as a receipt for the software but as the evidence behind E3: when
 * an inspector asks where a lote came from, the answer is the supplier's own sheet, and it is
 * attached to the batch rather than filed somewhere a person has to go and look.
 *
 * OWNS THE FORK `la captura` (src/rocoto/captura, forked from Base's `file-uploader`). Base's
 * uploader has one door because a web form has one. The trade has three, and the third — the
 * albarán that simply ARRIVED, where nobody chose the file — is the commonest and the one no
 * uploader models. All three are on this card, live, because the fork is this card's subject.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { AspectRatioBox, AspectRatioBoxBody } from 'baseui/aspect-ratio-box';
import type { ScenarioMeta } from '../meta';
import PhoneChassis from '../chassis/phone';
import DocCheck, { type DocCheckRow } from '../canonical/doc-check';
import { Paper } from '../../rocoto/paper';
import { Captura, DOOR, type Door, type FileRow } from '../../rocoto/captura';
import { StatefulVoiceButton } from '../../rocoto/voice-button-kit';
import { GBatchbook } from '../ghosts/regions';
import { useSector } from '../shell/context';
import { productOf, familyOf, supplierOf } from '../data/cast';
import Name from '../shell/Name';

export const meta: ScenarioMeta = {
  id: 'B3',
  title: 'Capture a paper document at the loading bay',
  group: 'B',
  frame: 'phone',
  ifText: "cost is taken from a supplier's albarán that arrives on paper with the goods",
  dims: ['D7.doc-paper'],
  job: "Photograph the supplier's sheet and speak in what the photograph could not read.",
  decides:
    'that a document enters through one of three doors, that the camera door is one shot with the edges found, that the values a photograph missed are asked for by voice, and that the photograph stays with the batch',
  inherits: [
    { region: 'the parsed rows beside the photograph', ref: 'B2' },
    { region: 'the batch the photograph travels to', ref: 'E3' },
    { region: 'what this cost becomes', ref: 'C3' },
  ],
  open: [{ region: 'the document inbox and the batch ledger', ref: 'OPEN-5' }],
  primitives: ['U06', 'U02'],
  kit: ['Captura', 'Voice Button', 'Paper', 'Aspect Ratio Box', 'Figure', 'Tag', 'Ghost'],
  canonical: 'doc-check',
  delta: 'control',
  deltaText: 'the same check, reached through a camera door, with the unread values spoken in',
  sector: { fish: 'Δ', meat: '=', fruit: 'Δ' },
  drawnWith: 'meat',
  thread: [2, 3],
  step: 1,
  fills: ['cost', 'lot'],
  reads: [],
  live:
    'press the shutter and the sheet appears with its edges found; two values came off unread, so hold the voice button and speak each one into place; the photograph stays attached and travels to the batch',
};

/** What the photograph could not read: the last two rows' costs. A camera at a loading bay reads
 *  most of a sheet and misses the corner it could not hold flat, which is why the repair is part
 *  of the capture rather than a second screen. */
const UNREAD_ROWS = 2;

export default function B3() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const [door, setDoor] = React.useState<Door>(DOOR.camera);
  const [shot, setShot] = React.useState(false);
  const [fileRows, setFileRows] = React.useState<FileRow[]>([]);
  const supplier = supplierOf(cast, cast.batches[0].supplier);

  const build = React.useCallback(
    (): DocCheckRow[] =>
      cast.batches.map((b, i) => {
        const product = productOf(cast, b.product);
        const family = familyOf(cast, product);
        return {
          id: b.id,
          name: <Name of={product} />,
          sub: (family.lineFields.includes('lote')
            ? family.lineFields
            : ['lote', ...family.lineFields]
          ).map((label) => ({ label, value: label === 'lote' ? b.id : product.trace[label] ?? '' })),
          qty: b.qty,
          unit: product.unit,
          packs: product.pack
            ? { count: Math.max(1, Math.round(b.qty / product.pack.factor)), unit: product.pack.unit }
            : undefined,
          cost: b.cost,
          per: `€/${product.unit}`,
          unread: i >= cast.batches.length - UNREAD_ROWS,
        };
      }),
    [cast],
  );

  const sheet = React.useMemo(build, [build]);
  const [rows, setRows] = React.useState<DocCheckRow[]>(sheet);

  /* the sector switch hands this screen a different account, whose supplier sent a different
     sheet — so the lorry has not been photographed yet either */
  React.useEffect(() => {
    setRows(sheet);
    setShot(false);
    setFileRows([]);
    setDoor(DOOR.camera);
  }, [sheet]);

  const statedTotal = React.useMemo(
    () => Math.round(sheet.reduce((s, r) => s + r.qty * r.cost, 0) * 100) / 100,
    [sheet],
  );
  const found = rows.length;

  /* THE SHUTTER. One shot; the edges are found; the file itself lands in Base's own file row,
     with Base's own progress and Base's own delete control, because that machinery is inherited
     and not rebuilt. */
  const capture = () => {
    if (shot) return;
    setShot(true);
    const file = new File([new Blob()], `albaran-${cast.batches[0].id}.jpg`, { type: 'image/jpeg' });
    setFileRows([
      { errorMessage: null, file, id: cast.batches[0].id, progressAmount: 100, status: 'processed' },
    ]);
  };

  /* THE SPOKEN REPAIR (U06 → U02). A value the lens missed is asked for out loud, one row at a
     time, and it lands on the row that asked. */
  const speak = (id: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, unread: false } : r)));

  const stillUnread = rows.filter((r) => r.unread).length;

  const photograph = (
    <AspectRatioBox aspectRatio={210 / 297} width="100%">
      <AspectRatioBoxBody
        display="flex"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        backgroundColor={theme.colors.backgroundSecondary}
      >
        <div style={{ transform: 'scale(0.94)' }}>
          <MiniSheet
            masthead={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong>
                  <Name of={supplier} />
                </strong>
                <span>
                  Albarán {cast.batches[0].id} · {cast.batches[0].day}
                </span>
              </div>
            }
            rows={sheet}
          />
        </div>
      </AspectRatioBoxBody>
    </AspectRatioBox>
  );

  return (
    <PhoneChassis
      header={{ open: 5 }}
      behind={{ open: 5, label: 'the documents captured today' }}
      rows={6}
      placement="bottom"
      height={880}
      width={392}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0, maxHeight: 800, overflowY: 'auto' }}>
        <header>
          <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
            <Name of={supplier} />
          </h2>
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {cast.hour} · the bay
          </p>
        </header>

        {/* ── LA CAPTURA. Three doors, one uploader. ── */}
        <Captura
          door={door}
          doors={[DOOR.camera, DOOR.drop, DOOR.arrived]}
          onDoorChange={setDoor}
          onCapture={capture}
          framed={shot}
          viewfinder={shot ? photograph : undefined}
          labels={{ shutter: 'Take the photo', framed: 'Keep it' }}
          arrived={{
            from: <Name of={supplier} />,
            subject: `Albarán ${cast.batches[0].id}`,
            at: `arrived ${cast.batches[0].day} · nobody chose this file`,
          }}
          fileRows={fileRows}
          setFileRows={setFileRows}
          hint="The photograph stays with the batch."
        />

        {/* ── THE CHECK, once the sheet exists. Same screen as B2, stacked for one hand. ── */}
        {shot && door === DOOR.camera && (
          <DocCheck
            rows={rows}
            layout="stacked"
            /* the sheet is already on screen, in the viewfinder above — drawing it twice would
               push the rows that need answering below the fold */
            showDocument={false}
            documentTitle={<>The sheet, as photographed</>}
            photographed={
              stillUnread > 0 ? (
                <>
                  The edges were found. {stillUnread} {stillUnread === 1 ? 'value' : 'values'} came
                  off the corner unread — hold the button on the row and say {stillUnread === 1 ? 'it' : 'them'}.
                </>
              ) : (
                <>The edges were found, and the sheet reads whole.</>
              )
            }
            masthead={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong>
                  <Name of={supplier} />
                </strong>
                <span>
                  Albarán {cast.batches[0].id} · {cast.batches[0].day}
                </span>
              </div>
            }
            statedTotal={statedTotal}
            found={found}
            listed={sheet.length}
            renderResolve={(r) =>
              r.unread ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                    Say the price for this line.
                  </span>
                  <StatefulVoiceButton
                    simulate
                    seed={r.id}
                    size="compact"
                    onRecord={() => speak(r.id)}
                  />
                </div>
              ) : null
            }
          />
        )}

        {/* where the sheet and its photograph go to rest */}
        <GBatchbook rows={4} label="the batches, with their photographs" />
      </div>
    </PhoneChassis>
  );
}

/* ── THE PHOTOGRAPH'S CONTENT ─────────────────────────────────────────────────────────────────
 * A photograph of a sheet is a sheet. Rather than stand in a picture of one, the retained capture
 * draws the real thing at a thumbnail's scale through `el papel`, so what is kept against the
 * batch is legible when it is opened and honest about its own proportion. */
function MiniSheet({ masthead, rows }: { masthead: React.ReactNode; rows: DocCheckRow[] }) {
  return (
    <Paper
      format="a4"
      scale={0.26}
      masthead={masthead}
      columns={[
        { key: 'product', label: 'Producto', width: 'minmax(0, 1.6fr)' },
        { key: 'qty', label: 'Cantidad', width: '90px', align: 'end' },
        { key: 'cost', label: 'Precio', width: '96px', align: 'end' },
      ]}
      rows={rows.map((r) => ({
        id: r.id,
        cells: {
          product: r.name,
          qty: `${r.qty} ${r.unit}`,
          cost: `${r.cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${r.per}`,
        },
        sub: r.sub,
      }))}
    />
  );
}
