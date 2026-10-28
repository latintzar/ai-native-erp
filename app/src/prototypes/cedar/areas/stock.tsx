import { solesRate } from '../currency';
import { useHistoryLayer } from '../navigation';
/* STOCK — THE CATALOGUE. V2-STOCK.
 *
 * ═══ WHAT THIS SURFACE IS (FEED-IA §37.5, §41.7) ═════════════════════════════════════════════
 * Stock is master-detail: the tenant’s literal product order stays intact by default; internal
 * category and A–Z are optional sorts. The product sheet on the right keeps price and
 * ITS HISTORY high on the sheet, add-a-new-price, and the whole tiered-pricing UI designed in —
 * that's key. It must feel legit» (§37.5). And, off the live screen: «The product screen should
 * obviously be just a product catalog… the images need to be on each of the products» (§41.7).
 *
 * So this is a CATALOG and a PRODUCT PAGE, in the anatomy everybody already knows from every good
 * store — because familiarity IS the design here:
 *
 *   · THE LIST (left) — image-first rows: the painting, the name, the sort where it has one, one
 *     quiet fact about the goods, and the literal Product Unit in a fixed right terminal. Price stays
 *     on the Product Sheet, where its tariff and history can be read together. The original
 *     tenant/source sequence is the normal view; category and A–Z are deliberate filters.
 *   · THE SHEET (right) — the product page: the painting at portrait size, the name, where it sits,
 *     the price and every tarifa written in place, the history under it, who takes it, what is on
 *     the floor. It is `product-card.tsx`, and it is the same sheet an albarán opens.
 *
 * ═══ ONE CATALOGUE, AND THE FOUR STRATA ARE FACTS ON ITS ROWS (THE-INTELLIGENCE §6) ═══════════
 * The inventory has four layers — the coded SKUs, the things a customer ordered that match nothing,
 * the words this house keeps adding, the sorts its albaranes keep writing — and they used to stand
 * as four stacked shelves. They are all THINGS THIS HOUSE SELLS, and a person looking for merluza
 * is looking for merluza whichever layer it arrived on. So each one is a ROW of the one catalogue,
 * filed at its own ladder position, carrying the quiet sentence that says how Rocoto knows it and
 * the ONE ACT that makes it a product on the sheet beside it. Nothing was lost: the stratum is a
 * property of a row instead of a wall between four lists.
 *
 * THE HOUSE SEES THE TREE AT ITS OWN RESOLUTION (§10.1). A shelf can hold two kinds Rocoto knows
 * apart, and when it does its header says so — which is how a person discovers that a finer shelf
 * is on offer at all. A category Rocoto chose wears the mark and re-grounds in one tap; the
 * correction is the training signal and there is no other feedback UI (§1).
 *
 * ═══ PANES, NOT BOXES (FEED-IA §38) ══════════════════════════════════════════════════════════
 * «Full-height panes with one scrollport each; the page never scrolls.» The surface asks the frame
 * for the pane posture, and then owns every pixel under the chrome: the list is one scrollport with
 * its head and its shelves sticking inside it, the sheet is the other. On a phone the sheet PUSHES
 * — the list is the screen until a row is tapped, and the way back is the sheet's own control.
 *
 * ═══ THE TWO DOORS, AND THE WORD (§5.6, §35.1) ═══════════════════════════════════════════════
 *   · NEW EVENT — the announcement moment: a stock addition WITH a lote, or simply the current
 *     reality. The typed number survives the flip; only the meaning of submit changes.
 *   · INCOMING LOG — the whole chronological trail of arrivals, each email row carrying its file
 *     as a chip that opens the real document.
 *   · THE WORD — filter-as-you-type over the whole catalogue: a shelf answers as a whole to its own
 *     name, and a product's word thins the shelf to the rows that match.
 *
 * §178 hierarchy: Catalogue is the workspace; supplier emails are its source subpage.
 * Stock update and New product are the primary actions. Upload/export are file utilities.
 * View/order/search controls belong to the catalogue list, never to the action bar.
 *
 * ═══ THE FAMILY AND ITS MEMBERS (FEED-IA §75.6) ══════════════════════════════════════════════
 * «If there are variations of a product, the main one should become a variation, get it? And
 * adding variations should be a thing too.» A parent with variations under it is a FAMILY HEAD:
 * face, name, member count, NO price of its own. The plain form it used to be is minted as its
 * first member, and every member — the base form, the words the traffic keeps adding, the sorts
 * the albaranes keep writing — carries a price. The reasoning is in `catalogue.ts`, beside the
 * data that carries it.
 *
 * ═══ AND CHANGING 80 PRICES IS A RHYTHM (FEED-IA §76) ════════════════════════════════════════
 * «Make changing 80 prices feel like triaging notifications, not editing 80 database records.»
 * The catalogue's one bottom action is «Update prices»: it opens `PriceEntry` (`stock-tiers.tsx`)
 * on the first priceable row and Save & next walks the list without the sheet ever closing.
 *
 * ═══ THE CATALOG'S DELINEATION, AS A WIREFRAME (FEED-IA §57.1, §51.24) ════════════════════════
 * «Make sure the categories, products etc are very clear and delineated appropriately, and that the
 * interactions are good.»
 *
 * THE DEFECT, MEASURED BEFORE IT WAS FIXED. The three levels were drawn at 18px / 12px / 16px:
 * the SUBCATEGORY was the smallest thing on the page and it sat further LEFT (x=76) than both its
 * own parent's words (x=138) and the product names it headed (x=152). A level outdented past its
 * parent and set smaller than its children is not a level — it is a caption, and the list reads as
 * one grey run. There was also no rule anywhere except one hairline weight repeated on every row,
 * so nothing in the column said «a new shelf starts here».
 *
 * THE LADDER, STATED ONCE — three registers, by STRUCTURE and never by colour:
 *
 *   LEVEL        TYPE                        LEFT EDGE            THE RULE ABOVE IT
 *   ─────────────────────────────────────────────────────────────────────────────────────────
 *   SHELF  (L0)  LabelLarge, ink, 32px face  the gutter           1px CONTENT PRIMARY  (ink)
 *   KIND   (L1)  LabelXSmall, tracked caps,  the product names'   1px MONO 400         (mid)
 *                semibold, secondary          own x
 *   PRODUCT(L2)  LabelMedium, ink, 44px face the gutter + face    1px BORDER OPAQUE    (hair)
 *
 * Three line weights, heaviest at the highest level: scanning the column, an ink rule means a new
 * shelf, a mid rule means a new kind, a hairline means the next of the same thing. The first row of
 * a run takes NO rule, because the head above it already opened the run — a head followed by a line
 * is two openings for one thing. And the KIND carries its own COUNT, which is what makes it read as
 * a group rather than as a word somebody left there (§51.24: facts, never captions).
 *
 * ═══ THE INTERACTIONS (§57.1, §37.3) ═════════════════════════════════════════════════════════
 *   · HOVER paints the ground and moves NOTHING. The selection bar is drawn at every state in
 *     `transparent`, so the box a row occupies is identical hovered, selected and at rest (§37.3).
 *   · SELECTION is the INK BAR down the left edge — the book's own device, to the token, so a
 *     selected row in the catalogue and a selected row in Customers are one drawing (§43). Hover
 *     and selection were the same grey before this pass, which meant a pointer erased the answer
 *     to «which one am I looking at».
 *   · THE KEYBOARD WALKS THE CATALOGUE: ↑ ↓ move the selection through the rows as drawn (through
 *     the shelves, not within one), Home and End jump to the ends, and the row that takes the
 *     selection takes the focus with it and scrolls itself into view at `nearest`. Enter and Space
 *     are the button's own, because every row IS a button.
 *   · FOCUS SAYS ITSELF: a ring, on `:focus-visible` only, so a mouse never draws it.
 *
 * NOTHING HERE IS A NEW ORGAN. `Figure`, `Paper`, `OverlayCard`, `Gallery` and
 * `BatchRecord` are as the catalogue built them, the prices come from `tiers.ts` (one store, so the
 * row, the sheet and the albarán cannot disagree about a number), and the tree, the words, the
 * amendments and the sorts are all data in `catalogue.ts` (law 10).
 *
 * ═══ THE EDITABLE GRAMMAR, AS IT APPLIES HERE (FEED-IA §51.14) ═══════════════════════════════
 * ONE grammar app-wide: UNDERLINE at rest · RING on hover · BOX when open. It is stated in full on
 * `PriceCell` (`stock-tiers.tsx`) and `Editable` (`detail.tsx`), and this surface's part in it is a
 * NEGATIVE one: nothing on the catalogue's rows is editable in place — the row is stable identity
 * and selling-unit context — so no row wears the mark. The mark appears on this surface only where
 * the sheet writes a price, which is the one place a hand can. A row that wore an underline it
 * could not honour would teach the mark to mean nothing.
 */
/* §76's price entry — the rhythmic run the catalogue's «Update prices» opens */
import { PriceEntry, type PriceTarget } from '../stock-tiers';
import { Editable } from '../rows';
/* §62's ONE ENTRY ORGAN, on its third and fourth surfaces (AUDIT-2 C6 · C26) — the New Product
   door and the catalogue's own word. Imported whole, exactly as the composer imports it; the
   registers it parses against are built by the ONE memo every consumer goes through. */
import ChipEntry, { OfferFavourites } from '../chip-entry';
/* §122's own instrument for a fact drawn from a closed register — one tap opens, one tap writes */
/* §16.5's paste reads the goods with the SAME organ the catalogue's word reads them with (§62.4:
   one shared organ, designed once, reused everywhere) — so the parse is imported, never repeated. */
import { parseChips, type Chip, type ChipLine, type ChipRegisters } from '../chip-parse';
import { useChipRegisters } from '../detail';
import { projectSKU, skuDetails, skuRecord, useSKURecords, requestInitialSKUPrice } from '../sku-record';
import { CreateSKU } from '../product-creation';
import { CODE_PENDING, ProductCode, codeText } from '../product-code';
import { StockUpdateFeed } from '../stock-update-feed';
import { StockBatchEntry } from '../stock-batch-entry';
import { ensureSKUArtworkRequest } from '../sku-artwork';
import * as React from 'react';
import { CatalogueExport, rememberCatalogueImport, type CatalogueExportProduct, type CatalogueImportSheet } from '../catalogue-export';
import { EXTRACTION_COPY, PARSE_ACCEPT, isExtractable, isTextTable, useExtraction } from '../parsing';
import type { ParseResult } from '../runtime-client';
import { DoorGrid, SourceButton, readingSentence } from '../intake-road';
import { placementFor, saveSKUPlacement, useProductOntology } from '../product-ontology';
import { seedImportedUnit } from '../units';
import { useStyletron } from 'baseui';
import { ProductFace, familyMarkOf } from '../product-face';
import { paintingFor } from '../painting-map';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input, SIZE as INPUT_SIZE } from 'baseui/input';
/* §16.5's paste takes a BLOCK, so it takes Base's own multi-line field rather than a hand-rolled one */
import { Textarea } from 'baseui/textarea';
import { Select, SIZE as SELECT_SIZE } from 'baseui/select';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../figure';
import { Gallery, CONTAINER } from '../../../rocoto/gallery';
import { Paper } from '../../../rocoto/paper';
import { OverlayCard, SCRIM } from '../../../rocoto/overlay-card';
import { WorkflowContent, WorkflowDialog, workflowCardOverrides, useWorkflowPlacement, useWorkflowViewport } from '../workflow-dialog';
import { openAssistant } from '../assistant';
import BatchRecord from '../../../scenarios/canonical/batch-record';
import BatchLine, { type Allocation } from '../../../scenarios/canonical/batch-line';
import Name from '../../../scenarios/shell/Name';
import {
  familyOf,
  productOf,
  supplierOf,
  OFF_LIST,
  type Cast,
  type OffListItem,
  type Product,
} from '../../../scenarios/data/cast';
import {
  AMENDMENTS,
  HOUSE_RESOLUTION,
  SORTS,
  amendmentBase,
  amendmentProduct,
  amendmentsOf,
  defaultMemberId,
  ground,
  groundOf,
  groupsOf,
  grownProducts,
  hangsUnder,
  housePrior,
  foldWord,
  isAdopted,
  liftTo,
  nameOfNode,
  nearbyNodes,
  nodeOf,
  ancestorsOf,
  readingWordsOf,
  sortBase,
  sortProduct,
  sortWord,
  sortsOf,
  useCatalogue,
  variedOf,
  type Amendment,
  type Group,
  type LearnedSort,
  type TreeNode,
} from '../catalogue';
import { useConfig } from '../config';
import {
  buildLedger,
  codeIt,
  recordedStock,
  lotBook,
  plan,
  rowsOf,
  synthLot,
  useDeclared,
  /* §17.7 · what a standing rule owes tomorrow · §18.3 · whose traceability a crate carries */
  expectedOf,
  traceField,
  tracedOnLot,
  type Expected,
  type IncomingEvent,
  type IncomingFile,
  type Lot,
} from '../incoming';
import {
  formatLevel,
  nearestTime,
  ruleSentence,
  seedHouseRule,
  standingRule,
  useRules,
  REPLENISH_TIMES,
  type Rule,
} from '../rules';
import Page from '../shell/page';
import { usePhone } from '../shell/viewport';
import { BOTTOM_NAV_HEIGHT, SearchSummon, usePanes, usePushed, useSearchSeat } from '../shell';
import { LAUNCHER_LANE } from '../shell/chats';
/* THE SHEET, AND THE PARTS IT IS WRITTEN IN (§37.5) — one grammar for the detail pane, so the
   floor block Stock hands in and the sheet's own blocks cannot read as two designs. */
import ProductCard, { NewcomerSheet, SheetPart, SheetRow } from '../product-card';
import {
  basePrice,
  needsPrice,
  parsePasted,
  priceOn,
  priceUnitOf,
  setPrices,
  runWords,
  tiersOfHouse,
  useTiers,
  writtenOn,
} from '../tiers';
/* §16.13's ALIASES — the words this house's own orders taught, off the knows store's tree. */
import { treeOf } from '../knows';
/* the door back to the answer that decides how the ERP is connected (§44.3) */
/* THE OBJECT DOORS (§43). This surface publishes the PRODUCT's landing and presses the CUSTOMER's:
   the buyer list on a product's sheet is the relationship read the other way round (§43's «both
   ways»), and a name on it is a door like every other name in the app. */
import { anchorFor, openCustomer, openProduct, useLanding } from '../anchors';
import { dayFromId, todayId } from '../sale';
import { nowOf } from '../day';
import { requestStockEntry, useStockUpdateReturn } from '../stock-entry-intent';
/* THE SEAT ITSELF LEFT THIS SURFACE (AUDIT-2 C26): the catalogue's word opens §62's organ now,
   drawn by `WordSeat` below. The MATCH still comes from here — one folding, one claim algorithm,
   three homes (§35.1) — and so does the highlight. */
import { Mark, matches, termsOf, wordsOf } from '../search';
import { StatefulPopover, PLACEMENT as PLACEMENT_MENU, TRIGGER_TYPE } from 'baseui/popover';
import { StatefulMenu } from 'baseui/menu';
import type { SectorId } from '../../../scenarios/meta';
import { Glyph, STEP, type GlyphId } from '../glyphs';
import type { AreaMeta } from '../shell/area';
import { mailsOf, markMailRead } from '../inbox';
import { capabilityAvailable } from '../release-profile';
import { useWorkspaceCapabilities } from '../workspace-capabilities';
import { allRelatedProductIds, useProductRelations } from '../product-relations';
import { UncodedItemSheet, useUncodedCatalogueItems } from '../uncoded-catalogue';

export const meta: AreaMeta = {
  id: 'stock',
  title: 'Products',
  owner: 'V2-STOCK',
  /* MASTER-DETAIL (§37.5, §38): the catalogue and the product's sheet. */
  panes: true,
};

/* ── ONE RHYTHM FOR THE WHOLE SURFACE (FEED-IA §33 — the air pass) ────────────────────────────
 * «Think about what people expect in terms of space, breathing space.» Stock is five sections
 * written across four packages — the strata, the tarifas, the inbox — and each of them had its own
 * opinion about a gutter, a gap and a card's padding, so the page read as four surfaces that
 * happened to be adjacent. These three values are what makes it one, and the only way for a section
 * to disagree with another is for somebody to write a number instead of using them.
 *
 * They are the RIVER'S own values, deliberately: Sales and Stock are one app.
 */

/** the gutter every card, row and header on this surface stands on */
export const GUTTER = 'scale600';

/** THE PANE'S OWN GUTTER (FEED-IA §33, §38). Everything inside a pane stands on one left edge —
 *  the head, the category, the kind, the row and the sections at the foot — and the phone takes
 *  the narrower one because the frame is already giving it a page margin outside the pane. */
const paneGutter = (phone: boolean): 'scale500' | 'scale700' => (phone ? 'scale500' : 'scale700');

/* ── HOW A QUANTITY IS READ ───────────────────────────────────────────────────────────────────
 * A Product Unit measured on a scale carries a decimal; a count Unit does not. One
 * function, so the entry, the card, the log and the lot book all round a number the same way.
 */
const decimalsOf = (product: Product): number => (product.variableWeight ? 1 : 0);

const LOCALE = 'es-ES';

/** THE HOUSE'S OWN MOMENT — its day, at the hour its morning is standing in. Every clock on this
 *  surface is read off this one, so the ledger, the lot codes and the announcement's stamp all
 *  belong to the same world the rest of the app is showing (the walk, P1-10). */
const houseNow = (cast: Cast): Date => {
  const at = dayFromId(todayId(cast));
  const [h, m] = nowOf(cast).split(':').map(Number);
  at.setHours(h || 0, m || 0, 0, 0);
  return at;
};

const timeOf = (at: Date): string => at.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

const dayLabel = (at: Date, now: Date): string => {
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (same(at, now)) return 'Today';
  if (same(at, yesterday)) return 'Yesterday';
  return at.toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: '2-digit' });
};

/* ── AN ADOPTED PRODUCT ───────────────────────────────────────────────────────────────────────
 * A line can name something the catalogue does not hold; it is simply labelled non-SKU (§2). The
 * act that ends that is adoption, and an adopted thing becomes a product like any other — with the
 * house's ambient family, which is the profile that records no lote, because that is the truth
 * about ice and parsley. The conversion lives in `catalogue.ts` now, beside the store that
 * remembers the adoption, so an adopted thing survives a reload the way a catalogue should.
 */

/* ── A MARKED SENTENCE ────────────────────────────────────────────────────────────────────────
 * The mark and the words it belongs to, on one line, wrapping like a sentence.
 *
 * THE DEFECT THIS FIXES WAS FOUND IN A 390px SCREENSHOT. A bare string beside `AccentDot` in a
 * wrapping flex row becomes ONE anonymous flex item, so the sentence cannot break inside itself:
 * the moment it is too long for the line it moves WHOLE to the next one and the dot is left
 * stranded on a line of its own, reading as a bullet nobody wrote. Given a flexible box to live
 * in, the sentence wraps inside itself and the mark stays where it belongs — on its first word.
 *
 * AND ON ITS FIRST LINE. The next screenshot showed the other half of it: centred against a
 * two-line sentence the mark floated in the gap between the lines. The dot rides a box one line
 * tall — a zero-width strut inheriting the sentence's own line-height, so no number is written
 * here and a change to the type scale moves the mark with it — and that box is centred on the
 * first line, which is where the sentence starts.
 */
function Marked({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'flex-start',
          lineHeight: 'inherit',
          flexShrink: 0,
          /* THE MARK CARRIES ITS OWN AIR (§78.4). It used to lean on a flex parent's `gap`, and
             the moment a slot stopped being a flex row — the one-line member, which clamps and
             therefore cannot be one — the dot butted straight against the sentence: «●Asked 11
             times this month». A component that needs its parent's layout to read correctly is a
             component with a hidden argument. */
          marginRight: theme.sizing.scale200,
        }}
      >
        {/* the strut is a unicode escape rather than a numeric HTML entity: an entity written with
            a hash reads as a hex colour to the theme gate, and a gate that cries wolf is a gate
            people learn to switch off */}
        <span style={{ width: 0, overflow: 'hidden' }}>{'​'}</span>
        <AccentDot />
      </span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </>
  );
}

/** The same mark at a row's size, for the ledger and the log.
 *
 *  ⚠ IT IS NEUTRAL, NOT RED (FEED-IA §127.3 · THE-CHECKPOINT-AUDIT finding 1). This disc used to
 *  take `colors.accent`, and the audit read it in front of «Next run tomorrow…» AND in front of an
 *  already-SENT «22.08 · Sent 01:30…» row on the supplier mails — a colour reserved for «a human
 *  being is waiting on you», spent on a mail that went out at half past one in the morning. The
 *  mark says what it always said; it says it in ink. `ActDot` carries the same reasoning at length.
 */
function AccentDot() {
  const [, theme] = useStyletron();
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: theme.sizing.scale300,
        height: theme.sizing.scale300,
        borderRadius: '50%',
        background: theme.colors.contentTertiary,
        flexShrink: 0,
      }}
    />
  );
}

/* ── THE SUPPLIER'S SHEET ─────────────────────────────────────────────────────────────────────
 * A photograph of a sheet IS a sheet, so the preview draws the REAL document through el papel
 * rather than standing in a picture of one. The lines are every landing that supplier sent that
 * day, with the family's own field set under each name — which is what makes a fish albarán read
 * like a biology exam and a produce one read like two words.
 */
function SupplierSheet({ cast, batchId, scale }: { cast: Cast; batchId: string; scale: number }) {
  const batch = cast.batches.find((b) => b.id === batchId) ?? cast.batches[0];
  const supplier = supplierOf(cast, batch.supplier);
  const lines = cast.batches.filter((b) => b.supplier === batch.supplier && b.day === batch.day);

  return (
    <Paper
      format="a4"
      scale={scale}
      masthead={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong>
            <Name of={supplier} />
          </strong>
          <span>
            Delivery Note {batch.id} · {batch.day}
          </span>
        </div>
      }
      columns={[
        { key: 'product', label: 'Producto', width: 'minmax(0, 1.6fr)' },
        { key: 'qty', label: 'Cantidad', width: '90px', align: 'end' },
        { key: 'cost', label: 'Precio', width: '96px', align: 'end' },
      ]}
      rows={lines.map((b) => {
        const product = productOf(cast, b.product);
        const family = familyOf(cast, product);
        const fields = family.lineFields.includes('lote') ? family.lineFields : ['lote', ...family.lineFields];
        return {
          id: b.id,
          cells: {
            product: product.name,
            qty: `${b.qty} ${product.unit}`,
            cost: solesRate(b.cost, product.unit),
          },
          /* §18.3 · THE CRATE'S OWN TRACEABILITY WINS. Two lotes of one merluza really do differ
             on zona and arte, and the supplier's sheet is the document that says so — so the
             field is read through `traceField`, which prefers the lote's value and falls back to
             the goods' standing one. */
          sub: fields.map((label) => ({
            label,
            value: label === 'lote' ? b.id : traceField(b, product, label) ?? '',
          })),
        };
      })}
    />
  );
}

/**
 * The document at full size.
 *
 * TWO KINDS OF DOCUMENT, TWO WAYS TO READ ONE. A supplier's albarán is a SHEET, so it is drawn as
 * the sheet it is, through el papel, at the real thing's proportions. A PHOTOGRAPH is a picture,
 * so it goes to the Gallery — the app's own picture-reader, with its pinch, its pager and its dots
 * — and every other photograph in this ledger goes with it, opened on the one that was tapped. A
 * person who took four pictures at the bay reads them the way pictures are read: by swiping.
 */
function FileView({
  cast,
  file,
  photos,
  phone,
}: {
  cast: Cast;
  file: IncomingFile;
  /** every photographed arrival in this ledger, so the reader can page through them */
  photos: Array<{ src: string; alt: string; caption: string }>;
  phone: boolean;
}) {
  const [, theme] = useStyletron();

  if (file.src) {
    const at = Math.max(0, photos.findIndex((p) => p.src === file.src));
    return (
      <div data-testid="photo-view" style={{ minWidth: 0, height: phone ? '58vh' : '52vh', position: 'relative' }}>
        <Gallery
          photos={photos}
          columns={1}
          container={CONTAINER.parent}
          initialActiveIndex={at}
          aria-label="The photographs taken at the bay"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0, overflowX: 'auto' }}>
        {file.batch ? <SupplierSheet cast={cast} batchId={file.batch} scale={phone ? 0.42 : 0.72} /> : null}
      </div>
    </div>
  );
}

/** The file, embedded on its row. Tapping it opens the document — and hands over the box it was
 *  tapped in, so the document can GROW OUT OF THE CHIP rather than appearing on top of it (musing
 *  12: one layer, changing shape). A caller that does not want the morph ignores the argument. */
function FileChip({ file, onOpen }: { file: IncomingFile; onOpen: (from?: Box) => void }) {
  const [, theme] = useStyletron();
  return (
    <button
      type="button"
      data-testid="file-chip"
      onClick={(e) => onOpen(boxOf(e.currentTarget))}
      aria-label={`Open ${file.name}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale200,
        maxWidth: '100%',
        padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius200,
        background: theme.colors.backgroundPrimary,
        color: theme.colors.contentSecondary,
        cursor: 'pointer',
        ...theme.typography.LabelXSmall,
        fontFamily: 'inherit',
      }}
    >
      <Glyph id="file" size={STEP.small} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
    </button>
  );
}

/* ── THE MODAL BECOMES THE FILE (musing 12) ───────────────────────────────────────────────────
 * «Clicking the file makes the modal BECOME the file — one morph, never a second modal stacked on
 * the first.» The overlay layer never changes: the same `OverlayCard` that was holding the inbox is
 * holding the document a frame later. What is staged here is the READING of that change — the
 * sheet grows out of the box the chip occupied, so the eye follows one object instead of finding a
 * new one.
 *
 * FLIP, exactly: measure where the sheet LANDS, put it back where the chip WAS with a transform,
 * then let it play to identity on Base's own decelerate curve — the curve for an entering element.
 * Transforms only; nothing here lays out twice.
 *
 * IT STANDS DOWN FOR ANYONE WHO ASKED IT TO. `prefers-reduced-motion` skips the whole thing and the
 * sheet is simply there, which is the same document either way.
 */
type Box = { left: number; top: number; width: number; height: number };

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

function Morph({ from, children }: { from?: Box; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !from) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return;
    el.style.transformOrigin = 'top left';
    el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    el.style.opacity = '0.4';
    const frame = window.requestAnimationFrame(() => {
      el.style.transition = `transform ${theme.animation.timing400} ${theme.animation.easeDecelerate}, opacity ${theme.animation.timing400} ${theme.animation.easeDecelerate}`;
      el.style.transform = 'none';
      el.style.opacity = '1';
    });
    return () => window.cancelAnimationFrame(frame);
  }, [from, theme.animation]);

  return (
    <div ref={ref} data-testid="file-morph" style={{ minWidth: 0 }}>
      {children}
    </div>
  );
}

/* ── WHAT HAPPENED, IN WORDS ──────────────────────────────────────────────────────────────────
 * One sentence per kind, drawn once and read in two places: the product's own ledger and the
 * incoming log. Every name comes out of the cast (law 10) and every number is a Figure, so a unit
 * shares its number's line here as everywhere.
 */
/** THE SEPARATOR BELONGS TO THE PART IN FRONT OF IT. A row that wraps at 390px with the middot
 *  leading the new line reads as a bullet list nobody asked for; carried on the tail of the part
 *  before it, a wrap simply ends a clause. */
function Sub({ parts }: { parts: React.ReactNode[] }) {
  const kept = parts.filter(Boolean);
  return (
    <>
      {kept.map((part, i) => (
        <span key={i}>
          {part}
          {i < kept.length - 1 ? ' ·' : ''}
        </span>
      ))}
    </>
  );
}

/* ── WHERE A ROW CAME FROM (FEED-IA §51.22) ───────────────────────────────────────────────────
 * «The incoming albarán log must SAY whether things came via the inbox.»
 *
 * It half-did: the source was a clause buried in the middle of each row's sub-line, in a different
 * position and a different shape for every kind — «in by email», «photographed at the bay»,
 * «declared by hand», «by rule · 06:00». A fact you have to read a sentence to find is a fact the
 * log does not state, which is his complaint exactly.
 *
 * So the source is a COLUMN. Every row of the log opens with the same cell — a mark and one word,
 * at one x — and the word is the door it came through. Four doors, and the sentence beside it
 * stops repeating them (`withSource={false}`), because the same fact printed twice is the §25.5
 * fault this app fixes everywhere else.
 */

type LogSource = { id: string; word: string; mark: GlyphId | null };

export function sourceOf(row: IncomingEvent): LogSource {
  if (row.kind === 'email') return { id: 'inbox', word: 'Inbox', mark: 'email' };
  if (row.kind === 'photo') return { id: 'bay', word: 'Bay photo', mark: 'camera' };
  /* Rocoto's own act wears Rocoto's own signature — the saffron dot — and never a line mark. */
  if (row.kind === 'rule') return { id: 'rocoto', word: 'Rocoto', mark: null };
  return { id: 'hand', word: 'By hand', mark: 'sign' };
}

function SourceTag({ row }: { row: IncomingEvent }) {
  const [, theme] = useStyletron();
  const source = sourceOf(row);
  return (
    <span
      data-source={source.id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale200,
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentSecondary,
        minWidth: 0,
      }}
    >
      {/* ONE STEP FOR EVERY MARK (FEED-IA §58.3, §30). This drew at 13px — a number off the
          vocabulary's own scale, which puts Lucide's stroke 2 on a 13px box and reads a shade
          heavier than the same mark anywhere else in the app. `STEP.small` is the scale. */}
      {source.mark ? <Glyph id={source.mark} size={STEP.small} /> : <AccentDot />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.word}</span>
    </span>
  );
}

function Happened({
  cast,
  row,
  withProduct,
  withSource = true,
}: {
  cast: Cast;
  row: IncomingEvent;
  withProduct: boolean;
  /** the log states the source in its own column, so the sentence there stops repeating it */
  withSource?: boolean;
}) {
  const [, theme] = useStyletron();
  const product = productOf(cast, row.product);
  const decimals = decimalsOf(product);
  const name = withProduct ? <Name of={product} /> : null;

  const figure = (value: number) => (
    <Figure value={value} unit={row.unit} decimals={decimals} locale={LOCALE} size="compact" />
  );

  const line = (main: React.ReactNode, sub: React.ReactNode, accent = false) => (
    <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelSmall, display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
        {main}
      </span>
      <span
        style={{
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentTertiary,
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale200,
          flexWrap: 'wrap',
        }}
      >
        {accent && <AccentDot />}
        {sub}
      </span>
    </span>
  );

  if (row.kind === 'email' || row.kind === 'photo') {
    const supplier = row.supplier ? supplierOf(cast, row.supplier) : undefined;
    /* ── A CREDIT NOTE IS NOT A LANDING (FEED-IA §119.3) ─────────────────────────────────────
       Its quantity is what the supplier is putting BACK, so the log has to say the verb: drawn
       with the arrival's own sentence, «Abono A-2211 · Gamba roja · 21,0 kg» reads as 21 kg that
       came in, and the ledger would be teaching the opposite of what the row means. The figure
       is the same figure; the word in front of it is the whole difference. */
    const abono = row.paper === 'abono';
    return line(
      <>
        <span>{row.subject}</span>
        {name}
        {abono ? <span>credits</span> : null}
        {figure(row.qty)}
      </>,
      <Sub
        parts={[
          supplier ? <Name of={supplier} /> : null,
          withSource ? (row.kind === 'email' ? 'in by email' : 'photographed at the bay') : null,
          timeOf(row.at),
          abono
            ? (row.lot ? `on the ${row.lot} arrival` : null)
            : (row.lot ? `lote ${row.lot}` : 'waiting for a code'),
        ]}
      />,
    );
  }

  /* THE SENTENCE STARTS WHERE THE NAME STOPS. Inside a product's own book the name is dropped —
     the panel already says which product this is — and the clause after it was left as it stood,
     so the ledger read «kept at par 40,0 kg» and «counted at 12,0 kg»: fragments beginning
     mid-sentence in lower case. The verb leads when nothing leads it. */
  if (row.kind === 'rule') {
    return line(
      <>
        {name}
        <span>{name ? 'kept at par' : 'Kept at par'}</span>
        {figure(row.qty)}
      </>,
      <Sub parts={[withSource ? `by rule · ${row.ruleAt}` : `at ${row.ruleAt}`, withSource ? 'Rocoto announced it' : null]} />,
      withSource,
    );
  }

  if (row.kind === 'added') {
    return line(
      <>
        <span>Added</span>
        {figure(row.qty)}
        {name && <>to {name}</>}
      </>,
      <Sub parts={[withSource ? 'declared by hand' : null, timeOf(row.at), row.lot ? `lote ${row.lot}` : null]} />,
    );
  }

  if (row.kind === 'counted') {
    return line(
      <>
        {name}
        <span>{name ? 'counted at' : 'Counted at'}</span>
        {figure(row.qty)}
      </>,
      <Sub parts={[withSource ? 'declared by hand' : null, timeOf(row.at)]} />,
    );
  }

  return line(
    <>
      <span>Variance</span>
      {figure(row.qty)}
      {name && <>on {name}</>}
    </>,
    <Sub
      parts={[
        withSource ? 'cause unknown, declared by hand' : 'cause unknown',
        timeOf(row.at),
        ...(row.depletions ?? []).map((d) => `${formatLevel(d.qty)} ${row.unit} off lote ${d.lot}`),
      ]}
    />,
  );
}

/* ── THE PANEL ────────────────────────────────────────────────────────────────────────────────
 * Every door on this surface opens the same shape: a heading that names what is behind it, the way
 * out, and a body that scrolls inside the card rather than pushing the page sideways.
 *
 * THE HEADING STANDS INSIDE THE SCROLL AND STICKS TO ITS TOP (§6.1: «rails and panels never scroll
 * away»). It matters most in the two long panels: forty rows into the incoming log a person has to
 * be able to read what they are in and get out of it, and a Close button that has scrolled off is
 * a panel with no exit at thumb's reach. The heading paints its own ground, because a sticky
 * element over a transparent one is a heading with the ledger sliding through it.
 */
/* THE HEAD HAS A SECOND POSTURE: THE WAY BACK (musing 12). When one panel has BECOME another —
 * the inbox becoming the document its chip opened — the head collapses to a slim bar carrying the
 * back mark and the file's own name. The control that was Close IS the way back: one exit, one
 * layer, and a person never has two things to dismiss. */
function Panel({ title, lead, onClose, back, children }: {
  title: string;
  lead?: string;
  onClose: () => void;
  back?: { label: string; onBack: () => void };
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return <WorkflowContent title={title} onClose={onClose} onBack={back?.onBack} testId="panel" closeTestId="close-panel" backTestId="panel-back-bar">
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: theme.sizing.scale600 }}>
      {lead && <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{lead}</p>}
      {children}
    </div>
  </WorkflowContent>;
}

/* ── THE PAR RULE, ON THE CARD ────────────────────────────────────────────────────────────────
 * «If they maintain a par level, it's just a rule they set — it does the announcement on a
 * scheduled basis, replenished every day, they say at what time.» Two states and no third: the
 * sentence with the way to end it, or the one act that starts it.
 *
 * STOPPING IS A DATE, NEVER A DELETION (rules.ts §2). The future stops; every announcement the
 * rule already made stays in the ledger, because it happened.
 */
function ParRule({
  cast,
  product,
  rule,
  writing,
  onWriting,
  onSet,
  onStop,
}: {
  cast: Cast;
  product: Product;
  rule?: Rule;
  writing: boolean;
  onWriting: (next: boolean) => void;
  onSet: (level: number, at: string) => void;
  onStop: () => void;
}) {
  const [, theme] = useStyletron();
  const [level, setLevel] = React.useState('');
  const [at, setAt] = React.useState(() => nearestTime(cast.hour));

  const shell: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.sizing.scale400,
    flexWrap: 'wrap',
    padding: `${theme.sizing.scale500} ${theme.sizing[GUTTER]}`,
    borderTop: `1px solid ${theme.colors.borderOpaque}`,
    minWidth: 0,
  };

  if (rule) {
    return (
      <div style={shell} data-rule="live">
        <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: '20ch' }}>{ruleSentence(rule)}</span>
        <Button
          kind={KIND.tertiary}
          size={SIZE.mini}
          shape={SHAPE.pill}
          onClick={onStop}
          data-testid={`stop-rule-${product.id}`}
        >
          Stop
        </Button>
      </div>
    );
  }

  /* A CARD WITH NO RULE HAS NO RULE ROW (§6.7, read as «say the thing or say nothing»). The band
     it used to draw carried one grey pill and no fact, and five of them down one column read as a
     form somebody left unfinished. The ACT lives in the card's foot beside the lot book; this
     component draws only when there is something to state. */
  if (!writing) return null;

  const value = Number(level.replace(',', '.'));
  const ready = Number.isFinite(value) && value > 0;

  return (
    <div style={{ ...shell, alignItems: 'flex-end' }} data-rule="writing">
      <div style={{ flex: '1 1 9rem', minWidth: '8rem' }}>
        <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, paddingBottom: theme.sizing.scale100 }}>
          Kept at
        </div>
        {/* the unit shares the number's line — inside the field, never under it */}
        <Input
          value={level}
          size={INPUT_SIZE.compact}
          inputMode="decimal"
          placeholder="40"
          endEnhancer={product.unit}
          aria-label={`The level ${product.name} is kept at`}
          onChange={(e) => setLevel((e.target as HTMLInputElement).value.replace(/[^\d.,]/g, ''))}
          overrides={{ Input: { props: { 'data-testid': 'rule-level' } } }}
        />
      </div>
      <div style={{ flex: '1 1 9rem', minWidth: '8rem' }}>
        <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, paddingBottom: theme.sizing.scale100 }}>
          Replenishes at
        </div>
        <Select
          size={SELECT_SIZE.compact}
          clearable={false}
          searchable={false}
          options={REPLENISH_TIMES.map((t) => ({ id: t, label: t }))}
          value={[{ id: at, label: at }]}
          onChange={(params) => setAt(String(params.value[0]?.id ?? at))}
          aria-label="The hour it replenishes"
          overrides={{ Root: { props: { 'data-testid': 'rule-time' } } }}
        />
      </div>
      <Button
        kind={KIND.primary}
        size={SIZE.compact}
        disabled={!ready}
        data-testid="save-rule"
        onClick={() => {
          onSet(value, at);
          onWriting(false);
          setLevel('');
        }}
      >
        Set the rule
      </Button>
      <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="cancel-rule" onClick={() => onWriting(false)}>
        Back
      </Button>
    </div>
  );
}

/* ── THE LOT BOOK, AND THE PRODUCT'S OWN LEDGER ───────────────────────────────────────────────
 * «Each lote is a little bank account of kilos that only goes down» (LOTS-EXPLAINED §3). So the
 * book states what landed, what has been drawn, and what is left — and the record behind any of
 * them is one press away, because the recall drill is the only exam that matters.
 */
function BookPanel({
  cast,
  product,
  rows,
  lots,
  now,
  onPreview,
  onClose,
}: {
  cast: Cast;
  product: Product;
  rows: IncomingEvent[];
  lots: Lot[];
  now: Date;
  onPreview: (file: IncomingFile, from?: Box) => void;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const [openRecord, setOpenRecord] = React.useState<string | null>(null);
  const decimals = decimalsOf(product);
  const waiting = rows.filter((r) => r.effect === 'delta' && !r.lot && r.file);

  /* THE DAY IS SAID ONCE PER DAY. Six rows each stamped «Today» is a column of the same word, and
     the reader is looking for what happened, not for what day it is six times over. */
  let seen = '';
  const trail = [...rows].reverse().map((row) => {
    const label = dayLabel(row.at, now);
    const first = label !== seen;
    seen = label;
    return { row, label: first ? label : '' };
  });

  /* ── THE RECALL DRILL, FORWARD (LOTS-EXPLAINED §3) ──────────────────────────────────────────
     «Each line points at one or more lotes and says how many kilos it drew from each.» The
     proposal is FIFO — oldest open lote first, the same arithmetic the variance uses — and the
     line the customer ordered stays ONE line however the parts are cut. It draws only where this
     morning's order actually asked for this product; a panel that invented a line to demonstrate
     itself would be showing a sale nobody made. */
  const orderLine = cast.order.lines.find((l) => l.product === product.id);
  const allocations: Allocation[] = orderLine
    ? plan(lots, orderLine.qty).map((d) => ({ batch: d.lot, qty: d.qty }))
    : [];

  return (
    <Panel title={product.name} onClose={onClose}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>The lotes on the floor</h3>

        {lots.length === 0 && waiting.length === 0 && (
          <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            The lotes appear here as the landings arrive.
          </p>
        )}

        {lots.map((lot) => (
          <div
            key={lot.id}
            data-lot={lot.code}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.sizing.scale400,
              padding: theme.sizing.scale400,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius200,
              minWidth: 0,
            }}
          >
            <span style={{ flex: '1 1 12ch', minWidth: 0 }}>
              <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                {lot.code}
              </Tag>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                {' · '}
                {lot.day}
                {/* WHOSE COUNT, AND WHEN (§17.9). A crate a hand put on the floor says so; one an
                    albarán brought in is evidenced by the chip already on this row. */}
                {lot.declaredAt && ` · counted ${timeOf(lot.declaredAt)}`}
              </span>
            </span>
            <span style={{ display: 'flex', gap: theme.sizing.scale600, alignItems: 'baseline' }}>
              <span>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Landed </span>
                <Figure value={lot.landed} approx={lot.approx} unit={lot.unit} decimals={decimals} locale={LOCALE} size="compact" />
              </span>
              <span>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Left </span>
                <Figure value={lot.left} approx={lot.approx} unit={lot.unit} decimals={decimals} locale={LOCALE} size="compact" />
              </span>
            </span>
            {lot.arrival?.file && <FileChip file={lot.arrival.file} onOpen={(from) => onPreview(lot.arrival!.file!, from)} />}
            {cast.batches.some((b) => b.id === lot.code) && (
              <Button
                kind={KIND.secondary}
                size={SIZE.mini}
                shape={SHAPE.pill}
                data-testid={`record-${lot.code}`}
                onClick={() => setOpenRecord(openRecord === lot.code ? null : lot.code)}
              >
                {openRecord === lot.code ? 'Hide its record' : 'Open its record'}
              </Button>
            )}
          </div>
        ))}

        {/* THE LANDING THAT CAME IN WITHOUT A CODE. The trade's own published convention answers
            it in one tap — the supplier's initials and the day it landed — and a synthesised,
            documented, consistent code is what an inspector accepts. The suggestion is Rocoto's
            act, so the offer carries the accent; attaching it is the person's. */}
        {waiting.map((row) => (
          <div
            key={row.id}
            data-waiting={row.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.sizing.scale400,
              padding: theme.sizing.scale400,
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius200,
              minWidth: 0,
            }}
          >
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, flex: '1 1 18ch', display: 'flex', alignItems: 'center', gap: theme.sizing.scale200 }}>
              <AccentDot />
              This landing carries the goods and leaves the code to us.
            </span>
            <Button
              kind={KIND.secondary}
              size={SIZE.mini}
              shape={SHAPE.pill}
              data-testid={`synthesise-${row.id}`}
              onClick={() => codeIt(row.id, synthLot(cast, product, row.at))}
            >
              Give it {synthLot(cast, product, row.at)}
            </Button>
          </div>
        ))}

        {openRecord && cast.batches.some((b) => b.id === openRecord) && (() => {
          const batch = cast.batches.find((b) => b.id === openRecord)!;
          const fields = familyOf(cast, product).recordFields;
          /* §18.3's PROVENANCE, in one clause: how many of these facts this CRATE answered for
             itself rather than inheriting from the goods. Where a landing carries none, the
             sentence is the one it always was. */
          const own = fields.filter((f) => tracedOnLot(batch, f)).length;
          return (
            <BatchRecord
              cast={cast}
              batch={batch}
              provenance={
                <>
                  {fields.length} facts arrived with the goods and were captured once, at the bay.
                  {own > 0 && ` ${own} of them are this lote’s own.`} Rocoto reads a lote; the
                  goods carry it.
                </>
              }
            />
          );
        })()}
      </section>

      {/* WHAT AN ORDER DREW FROM THEM. The one exam that matters runs both ways: an inspector
          names a lote and the lines that drew on it are listed; a customer names a day and the
          lote behind their fish is named. This is the forward half, and it is the catalogue's own
          screen — one line, one price, the lotes underneath, and no split. */}
      {allocations.length > 0 && orderLine && (
        <section data-testid="allocation" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>What today&rsquo;s order drew from them</h3>
          <BatchLine
            cast={cast}
            line={orderLine}
            allocations={allocations}
            /* THE-CONTENT-CANON §9 item 7: two clauses of method, said as one fact and one act. */
            note={<>Oldest lote first. Correct it if another crate was used.</>}
          />
        </section>
      )}

      {/* THE PRODUCT'S OWN LEDGER. Newest first, because the question a person opens this with is
          «what happened to this», and the answer starts today. */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <h3 style={{ margin: 0, ...theme.typography.LabelMedium }}>What happened to this product</h3>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {trail.map(({ row, label }) => (
            <div
              key={row.id}
              data-testid="ledger-row"
              data-kind={row.kind}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: theme.sizing.scale400,
                padding: `${theme.sizing.scale400} 0`,
                borderTop: `1px solid ${theme.colors.borderOpaque}`,
                minWidth: 0,
              }}
            >
              <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, width: '9ch', flexShrink: 0 }}>
                {label}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <Happened cast={cast} row={row} withProduct={false} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </Panel>
  );
}

/* ── THE INCOMING LOG (§5.6, §51.21, §51.22) ──────────────────────────────────────────────────
 * «A button to see the full log of incoming shit with the files embedded.» One chronological
 * trail: the emails with their albarán attached, the photographs taken at the bay, what the rules
 * announced, what a hand declared, and every variance that got filed.
 *
 * IT IS A SECTION OF THE INCOMING SEAT NOW, not a modal (§51.21). A feed read out of a card that
 * covers the surface it came from is a feed you visit; a feed on its own seat is a feed you read.
 * The doors that used to open it — the icon beside «Stock update», the mail section's own — put a
 * person on this seat instead, which is one place rather than three.
 *
 * THE ROW'S GRAMMAR, AND WHY IT HAS A FIRST COLUMN (§51.22): SOURCE · what happened · the file ·
 * the hour. The source cell is at one x on every row, so «did this come via the inbox» is answered
 * by looking down a column instead of by reading four differently-shaped sentences.
 *
 * ═══ AND THE COLUMN STACKS ON A HANDSET (§51.22 held at 390, §41.6) ══════════════════════════
 * THE DEFECT, FOUND IN A 390px SHOT: three columns — 104px of source, the sentence, and a file chip
 * at its natural width — leave the sentence about NINETY PIXELS. «Albarán L-2208 Merluza 3200,0 kg»
 * came out as five stacked fragments and its sub-line as four more: one arrival, two hundred pixels
 * tall, unreadable. «Design the fit, never truncate the goods» (§41.6) cuts both ways — a column
 * that shreds the goods has not been fitted either.
 *
 * So on a handset the row is ONE COLUMN: the source and the hour on the first line — the two facts
 * a person scans a log by — the sentence full width under them, and the document last. The source
 * still opens every row at the same x, which is what §51.22 actually asks for; what changes is that
 * the x is the row's own left edge rather than a 104px cell squeezing everything after it.
 */
function LogSection({
  cast,
  ledger,
  now,
  top,
  phone,
  onPreview,
}: {
  cast: Cast;
  ledger: IncomingEvent[];
  now: Date;
  /** what the sticky head parks under, so the seat's own head keeps its floor */
  top: number;
  /** a handset stacks the row; a desk keeps the three columns */
  phone: boolean;
  onPreview: (file: IncomingFile, from?: Box) => void;
}) {
  const [, theme] = useStyletron();

  const days: Array<{ label: string; rows: IncomingEvent[] }> = [];
  for (const row of [...ledger].reverse()) {
    const label = dayLabel(row.at, now);
    const head = days[days.length - 1];
    if (head && head.label === label) head.rows.push(row);
    else days.push({ label, rows: [row] });
  }

  return (
    <section
      data-testid="incoming-log-section"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
    >
      <header
        data-testid="log-head"
        style={{
          position: 'sticky',
          top,
          zIndex: 1,
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale400,
          paddingTop: theme.sizing.scale500,
          paddingBottom: theme.sizing.scale400,
          borderBottom: `1px solid ${theme.colors.contentPrimary}`,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}>The delivery note log</h3>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
          {ledger.length} {ledger.length === 1 ? 'entry' : 'entries'}
        </span>
      </header>

      {days.map((day) => (
        <section key={day.label} data-log-day={day.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h4 style={{ margin: 0, padding: `${theme.sizing.scale300} 0`, ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            {day.label}
          </h4>
          {day.rows.map((row) => (
            <div
              key={row.id}
              data-testid="log-row"
              data-kind={row.kind}
              data-source={sourceOf(row).id}
              style={{
                display: 'grid',
                gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 104px) minmax(0, 1fr) auto',
                alignItems: phone ? 'stretch' : 'start',
                columnGap: theme.sizing.scale500,
                rowGap: theme.sizing.scale300,
                padding: `${theme.sizing.scale400} 0`,
                borderTop: `1px solid ${theme.colors.borderOpaque}`,
                minWidth: 0,
              }}
            >
              {phone ? (
                /* THE HANDSET'S FIRST LINE: which door it came through, and when. */
                <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
                  <SourceTag row={row} />
                  <span style={{ flex: 1, minWidth: 0 }} />
                  <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}>
                    {timeOf(row.at)}
                  </span>
                </span>
              ) : (
                <SourceTag row={row} />
              )}
              <span style={{ minWidth: 0 }}>
                <Happened cast={cast} row={row} withProduct withSource={false} />
              </span>
              {row.file
                ? (
                  <span style={{ display: 'flex', minWidth: 0, justifyContent: phone ? 'flex-start' : 'flex-end' }}>
                    <FileChip file={row.file} onOpen={(from) => onPreview(row.file as IncomingFile, from)} />
                  </span>
                )
                : <span />}
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}

/* ── STOCK UPDATE CHOOSES; THE SKU SHEET WRITES ────────────────────────────────────────────────
 * The chooser asks for one SKU, then offers Receive stock or Record a stock count. It carries only
 * that intent to the selected product’s existing stock editor. Quantity, lot identity, validation,
 * confirmation and the ledger write remain in one canonical place, so this doorway cannot create a
 * second receipt or count model. */

/** WHICH GOODS THE SENTENCE LANDED ON.
 *
 *  The words are read against the row's own words — its name and its code — with the SAME reader
 *  the catalogue's search uses (`matches`/`termsOf`), so «merlu» finds the merluza in both places
 *  or in neither. And it narrows the way the catalogue narrows (§78.5): word by word, in writing
 *  order, and A WORD THAT WOULD LEAVE NOTHING IS HELD — «merluza sin cabeza» in a house whose row
 *  is «Merluza» lands on the merluza and keeps their own «sin cabeza» as the sort they wrote,
 *  instead of answering nought against three real words.
 *
 *  IT ANSWERS ONLY WHEN ONE ROW IS LEFT. Two rows still standing is not an answer, so the beat
 *  stays open and the person keeps writing — the door never picks goods nobody named. */
function NewEvent({
  cast,
  products,
  registers,
  phone,
  today,
  onClose,
  onNewProduct,
  incoming,
  viewingEmail,
}: {
  incoming?: React.ReactNode; viewingEmail?: boolean;
  cast: Cast;
  products: Product[];
  registers: ChipRegisters;
  phone: boolean;
  today: string;
  onClose: () => void;
  onNewProduct: () => void;
}) {
  const openEntry = (product: Product, mode: 'receive' | 'count') => {
    requestStockEntry({ sector: cast.sector, productId: product.id, mode, origin: 'stock-update' });
    onClose();
    openProduct(product.id);
  };

  return (
    <Panel title="Stock update" onClose={onClose}>
      {!viewingEmail && <div data-testid="stock-update-chooser">
        <StockBatchEntry
          cast={cast}
          products={products}
          registers={registers}
          phone={phone}
          today={today}
          onSingleProduct={openEntry}
          onNewProduct={onNewProduct}
        />
      </div>}
      {incoming}
    </Panel>
  );
}

/* ═══ §16.5 · PASTE PRICES ════════════════════════════════════════════════════════════════════
 * «Daily price entry needs far better UX than a giant ERP matrix: PASTE; type; dictate; bulk
 * update; resolve conflicts; publish.»
 *
 *   REGIONS   head (what this is) · the block (one field, the list as it was copied) · the
 *             reading (what the parse answered, with the rows it landed on) · the acts
 *   CONTENTS  a textarea · a count · up to a screenful of resolved rows, name and rate
 *   STATES    empty (the field carries the shape a list takes) · read (the reading stands and the
 *             primary names the size of the run it will open) · unread (the block is there and
 *             the reading has nothing in it yet — the primary waits)
 *
 * IT OPENS A RUN, IT DOES NOT WRITE. Every rate still passes through the price sheet with its
 * previous value on screen and Undo on the save. A door that wrote eighty prices on one press
 * would be the ERP matrix this whole section exists to replace.
 *
 * NO EXPLANATION LIVES HERE (§51.7 · §51.24). The field's placeholder IS the instruction, because
 * it is a real example of the thing; a sentence saying «paste two columns» would be the helper
 * slop the app banned.
 */
function PastePrices({
  text,
  onText,
  reading,
  onRun,
  onClose,
}: {
  /** the block as it was pasted; `null` when the door is shut */
  text: string | null;
  onText: (next: string) => void;
  reading: { lines: number; targets: PriceTarget[] };
  onRun: () => void;
  onClose: () => void;
}) {
  const [, theme] = useStyletron();
  const found = reading.targets.length;
  return <WorkflowDialog
    isOpen={text !== null}
    onClose={onClose}
    onBack={onClose}
    title="Paste prices"
    ariaLabel="Paste prices"
    step={reading.lines > 0 ? `${found} ${found === 1 ? 'price' : 'prices'} found` : 'Paste a list to review'}
    testId="paste-prices-dialog"
    actions={<>
      <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="paste-close" onClick={onClose}>Cancel</Button>
      <Button size={SIZE.compact} disabled={found === 0} data-testid="paste-run" onClick={onRun}>
        {found > 0 ? `Update ${found} ${found === 1 ? 'price' : 'prices'}` : 'Update prices'}
      </Button>
    </>}
  >
    <div
      data-testid="paste-sheet"
      data-lines={reading.lines}
      data-found={found}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}
    >
      <Textarea
        autoFocus
        value={text ?? ''}
        onChange={(event) => onText((event.target as HTMLTextAreaElement).value)}
        rows={6}
        aria-label="The price list, as you copied it"
        placeholder={'Merluza sin cabeza\tS/ 57.80/kg\nGamba roja\tS/ 154.05/kg'}
        overrides={{ Input: { props: { 'data-testid': 'paste-field' } } }}
      />
      {reading.lines > 0 && (
        <span data-testid="paste-reading" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>
          {found} {found === 1 ? 'price' : 'prices'} · {reading.lines} {reading.lines === 1 ? 'line' : 'lines'}
        </span>
      )}
      {reading.lines > 0 && found === 0 && (
        <p data-testid="paste-error" role="alert" style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>
          These lines are still unmatched. Check the names, then try again.
        </p>
      )}
      {found > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
          {reading.targets.map((target) => (
            <div key={target.key} data-pasted={target.product.id} style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {target.name}{target.word ? ` · ${target.word}` : ''}
              </span>
              <Figure value={target.given as number} unit={priceUnitOf(target.product)} decimals={2} locale={LOCALE} size="compact" />
            </div>
          ))}
        </div>
      )}
    </div>
  </WorkflowDialog>;
}

/* ═══ THE CATALOGUE (FEED-IA §37.5, §41.7) ════════════════════════════════════════════════════
 * «The product screen should obviously be just a product catalog… the images need to be on each of
 * the products» (§41.7), and «products sorted by category → subcategory; the product SHEET on the
 * right» (§37.5).
 *
 * SO THERE IS ONE LIST, AND IT IS SORTED BY WHAT THINGS ARE. The four strata this surface used to
 * stack as four separate shelves — the coded SKUs, the ones waiting for a code, the words customers
 * keep adding, the sorts the albaranes taught us — are all THINGS THIS HOUSE SELLS, and a person
 * looking for merluza is looking for merluza whichever stratum it came in on. So each one is a ROW
 * of the catalogue, filed under the ladder position it grounds onto, carrying its own quiet fact
 * about how Rocoto knows it and its own act on the sheet beside it. Nothing is lost: the stratum is
 * now a property of a row instead of a wall between four lists.
 *
 * THE LADDER IS THE ORDER (THE-DENSE-BRIEF §C): the shelf the house keeps (its own word where the
 * upload carried one), then the KIND under it — merluza, rape, gamba — and the sorts nest under
 * their kind. That is L0 → L1 → L2 read top to bottom.
 */

/** One thing in the catalogue, whichever stratum it arrived on.
 *
 *  `base` is the DEFAULT MEMBER (§75.6): the plain form of a family, minted so the family head can
 *  stop standing as both the family and one member of it. It carries the family's own product —
 *  the price it takes IS the product's price — and it exists only where the family has other
 *  members to be one of. */
type Subject =
  | { kind: 'product'; id: string; name: string; product: Product }
  | { kind: 'base'; id: string; name: string; product: Product; word: string }
  | { kind: 'uncoded'; id: string; name: string; item: OffListItem }
  | { kind: 'amendment'; id: string; name: string; amendment: Amendment; base: Product }
  | { kind: 'sort'; id: string; name: string; sort: LearnedSort; base: Product; word: string };

const subjectKey = (s: Subject): string => `${s.kind}:${s.id}`;

/** THE FAMILY A ROW BELONGS TO, or null where the row is not a member of one. One reading, so the
 *  head, the indent, the price and the «Add a variation» door can never disagree about whose row
 *  this is (§75.6). */
const familyRow = (s: Subject): Product | null =>
  s.kind === 'base' ? s.product : s.kind === 'amendment' || s.kind === 'sort' ? s.base : null;

/** WHAT A MEMBER ADDS TO ITS FAMILY'S NAME — the ONE thing its row says (§65.1, §75.6). */
const memberWord = (s: Subject): string | null =>
  s.kind === 'base' ? s.word : s.kind === 'amendment' ? s.amendment.word : s.kind === 'sort' ? s.word : null;

/** The kind a node belongs to — the ladder's L1. A node already above the kinds keeps its place,
 *  and a sort walks up to the kind it is a sort OF. */
const kindOf = (node: string): string => liftTo(node, 'type');

type KindRun = { node: string; name: string; rows: Subject[] };

/** A shelf of the catalogue: the house's own category, with its kinds under it. */
type Shelf = {
  shelf: string;
  name: string;
  guessed: boolean;
  said?: string;
  /** the goods whose face the shelf wears */
  face: string;
  /** the products on it, for the one act a shelf has — moving where Rocoto put them */
  members: Product[];
  kinds: KindRun[];
};

/* ═══ THE WORD IS A READING (FEED-IA §62.4 · §65.3 — AUDIT-2 C26) ═════════════════════════════
 * The catalogue's search is §62's third surface, so it takes the trade's whole sentence and reads
 * it the way the albarán's own line does. These three functions are the whole of the narrowing,
 * and they are up here beside the shelves because they only ever touch a shelf and a chip.
 *
 * ═══ WHAT A ROW CAN BE FOUND BY ══════════════════════════════════════════════════════════════
 * Their own words first — the row's name, the kind it stands under, the shelf it sits on, all of
 * them exactly as the house wrote them (§65.3: theirs stay theirs). And UNDER them, the
 * reference's own words for the node the row grounds onto: «Merluza» hangs off «Pescado blanco»,
 * which hangs off «Pescado y marisco», so a person who types the category finds the goods even
 * where the house never typed that word anywhere. Recognition is ours; the drawing stays theirs.
 *
 * ═══ AND BY ITS CODE, AND BY WHAT THE HOUSE'S OWN PEOPLE CALL IT (§16.13) ════════════════════
 * «Search by product / SKU / ALIAS.» Two more sources, and neither of them is a new list:
 *   · THE CODE — `Product.code`, the reference somebody reads off a shelf label or an ERP export.
 *     Read through `codeOf` so this file never has to care whether the field has landed yet.
 *   · THE ALIASES — the words this house's own customers use, which the app has already watched
 *     land somewhere: the knows store's tree carries each node's `category` and `phrase` beside
 *     its name, and those ARE the house's words for the goods (`knows.ts` §10.3). Nothing is
 *     authored; the alias is a reading of what the orders taught.
 */

/** THE SKU CODE, THROUGH ONE SEAM (P0 · §16.13). `Product.code` is landing in the model tick, and
 *  a surface that read `product.code` directly would either not compile before it lands or quietly
 *  disagree with the rows that do. One reader, and the day the field is on the type this narrows
 *  to a field access with nothing else to change. */
export const codeOf = (product: Product | null | undefined): string | undefined => {
  const held = (product as { code?: unknown } | null | undefined)?.code;
  return typeof held === 'string' && held.trim() ? held : undefined;
};

/** THE CODE AS ONE TOKEN (§16.13). «PV-1002» folds to «pv 1002» — two words, and the claim
 *  algorithm's slack then reads «1002» as a claim on «1001», so one code found every coded row in
 *  the house. A reference is ONE thing, so it is folded as one: «pv1002». A person still types the
 *  hyphen and still lands, because their two terms both hit inside the single token. */
const codeWord = (product: Product | null | undefined): string | undefined => {
  const held = codeOf(product);
  return held ? held.replace(/[^A-Za-z0-9]+/g, '') : undefined;
};

/** The house's own other words for a row, where the app has watched some. */
type Aliases = (row: Subject) => string[];
const NO_ALIASES: Aliases = () => [];

const rowWords = (shelf: Shelf, kind: KindRun, row: Subject, aliases: Aliases = NO_ALIASES): string[] => [
  ...wordsOf([row.name, kind.name, shelf.name, shelf.said]),
  ...wordsOf([codeWord(rowProduct(row))]),
  ...wordsOf(aliases(row)),
  ...readingWordsOf(kind.node),
  ...(row.kind === 'sort' ? readingWordsOf(row.sort.node) : []),
];

/** The product a row stands for, whichever stratum it came in on — the subject of its code, its
 *  price and its aliases. An uncoded word is not a product yet and answers null. */
const rowProduct = (row: Subject): Product | null =>
  row.kind === 'product' || row.kind === 'base'
    ? row.product
    : row.kind === 'amendment' || row.kind === 'sort'
      ? row.base
      : null;

/** An explicit Related items edge names exact sellable SKU identities. It never follows category
 * or broad grouping membership. */
const relatedItemIdOf = (row: Subject): string | null =>
  row.kind === 'product' || row.kind === 'base'
    ? row.product.id
    : row.kind === 'amendment' || row.kind === 'sort'
      ? row.id
      : null;

/**
 * DOES THIS ROW ANSWER THIS CHIP? Three ways, in the order they cost.
 *
 *   1 · THE NODE. A chip that landed on the tree carries its node, so a row grounded at or under
 *       that node answers it whatever either of them is called — the tree is the claim.
 *   2 · THEIR WORD. What the person actually typed, against the row's own words.
 *   3 · OUR READING OF IT. A closed register resolves «congelada» to «congelado» and the lexicon
 *       reads «merluza» as «Merluza»; both are tried, because the register's word is as likely to
 *       be the one written on the row as theirs is.
 */
const answers = (words: string[], node: string | undefined, chip: Chip): boolean => {
  if (chip.node && node && (chip.node === node || ancestorsOf(node).some((a) => a.id === chip.node))) return true;
  return [chip.said, chip.reads, chip.value]
    .filter((w): w is string => Boolean(w))
    .some((w) => matches(termsOf(w), words));
};

/**
 * THE NARROWING, CHIP BY CHIP — and the one rule that keeps it honest.
 *
 * Each chip is applied to what is left, in the order it was written. A chip that leaves rows
 * standing narrows; a chip that would leave NONE is HELD — the narrowing stops at the last
 * reading the register can actually answer, and the held chip is handed back so the surface can
 * say what the house does hold for it. «merluza sin cabeza congelada» in a house whose congelada
 * is a gamba lands on the merluza sin cabeza and says where congelada lives, instead of returning
 * nought against three real words.
 */
function narrow(
  shelves: Shelf[],
  chips: Chip[],
  aliases: Aliases = NO_ALIASES,
): { shown: Shelf[]; held: Chip[] } {
  let shown = shelves;
  const held: Chip[] = [];
  for (const chip of chips) {
    const next = shown
      .map((s) => ({
        ...s,
        kinds: s.kinds
          .map((k) => ({ ...k, rows: k.rows.filter((r) => answers(rowWords(s, k, r, aliases), k.node, chip)) }))
          .filter((k) => k.rows.length > 0),
      }))
      .filter((s) => s.kinds.length > 0);
    if (next.length > 0) shown = next;
    else held.push(chip);
  }
  return { shown, held };
}

/** How many rows in the WHOLE register answer one held chip — the count that lets the surface
 *  point at where that word does live rather than reporting an absence (the no-negatives law). */
const holdsFor = (shelves: Shelf[], chip: Chip, aliases: Aliases = NO_ALIASES): number =>
  shelves.reduce(
    (n, s) => n + s.kinds.reduce((m, k) => m + k.rows.filter((r) => answers(rowWords(s, k, r, aliases), k.node, chip)).length, 0),
    0,
  );

/** File one subject under its kind inside a shelf, keeping the order things arrived in. */
function file(shelf: Shelf, node: string, row: Subject, label?: string): void {
  const kind = label ? node : kindOf(node);
  const held = shelf.kinds.find((k) => k.node === kind);
  if (held) held.rows.push(row);
  else shelf.kinds.push({ node: kind, name: label ?? nameOfNode(kind), rows: [row] });
}

/* ── THE RUN, ARRANGED INTO FAMILIES (FEED-IA §75.6) ──────────────────────────────────────────
 * The four strata arrive in four passes — SKUs, then uncoded, then the words, then the sorts — so
 * a kind's rows used to read as «every product, then every variation of any of them». With one
 * product per kind that happens to look like a family; with two it is a list of names followed by
 * a list of orphaned words, and the indent points at whatever happens to be above it.
 *
 * So the rows close up here: each product, then ITS members, in one block. And a family that has
 * members gains the base form as its FIRST member — «the main one should become a variation» — so
 * the head above it can stop carrying a price.
 *
 * WHAT DOES NOT GET A BASE MEMBER: a product with no members. It is not a family, so there is
 * nothing for it to be one member of, and it keeps its whole row.
 *
 * WHAT FALLS THROUGH: a member whose family is not in this run at all — a sort filed under a
 * different kind from its base. It keeps the order it arrived in, at the end, and draws itself
 * whole (§65.4's orphan grammar), because an indent under nothing says nothing.
 */
function familied(rows: Subject[]): Subject[] {
  const heads = rows.filter((r): r is Extract<Subject, { kind: 'product' }> => r.kind === 'product');
  if (heads.length === 0) return rows;
  const mine = new Map<string, Subject[]>();
  const loose: Subject[] = [];
  for (const row of rows) {
    if (row.kind === 'product') continue;
    const family = familyRow(row);
    if (family && heads.some((h) => h.id === family.id)) {
      const held = mine.get(family.id);
      if (held) held.push(row);
      else mine.set(family.id, [row]);
    } else {
      loose.push(row);
    }
  }
  const blocks: Array<{ name: string; rows: Subject[] }> = [];
  for (const head of heads) {
    const members = mine.get(head.id);
    if (!members || members.length === 0) {
      blocks.push({ name: head.name, rows: [head] });
      continue;
    }
    const base: Extract<Subject, { kind: 'base' }> = {
      kind: 'base',
      id: defaultMemberId(head.product.id),
      name: head.product.name,
      product: head.product,
      /* §153: the base is a real tenant SKU. Its full house name is never silently replaced by
         a synthetic form word just because related items are grouped below the same family. */
      word: head.product.name,
    };
    /* §148: the family is a stable alphabetical run, including its plain form. */
    blocks.push({
      name: head.name,
      rows: [head, ...[base, ...members].sort((a, b) => (memberWord(a) ?? a.name).localeCompare(memberWord(b) ?? b.name, 'es', { sensitivity: 'base' }))],
    });
  }
  /* A filtered-out family leaves an orphaned item. It remains a full item, and it joins the same
     global alphabet rather than falling to an arrival-order tail. */
  blocks.push(...loose.map((row) => ({ name: row.name, rows: [row] })));
  return blocks
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    .flatMap((block) => block.rows);
}

/** How many members hang off a family head, read off the list AS DRAWN. */
const membersUnder = (rows: Subject[], head: Subject): number =>
  head.kind !== 'product' ? 0 : rows.filter((r) => familyRow(r)?.id === head.id).length;

/* ── WHAT A COUNT COUNTS (FEED-IA §75.6) ──────────────────────────────────────────────────────
 * Every head, shelf and kind in this pane states its size, and the size of a catalogue is THINGS
 * THIS HOUSE SELLS. A family head is not one of them — it is the name the members hang off, and
 * its base form stands underneath it as a member of its own. Counting rows would therefore say
 * «15 products» about twelve, one extra for every family, which is a number wrong in exactly the
 * way §75.6 exists to fix: the parent counted twice, once as itself and once as its plain form.
 */
const sellable = (rows: Subject[]): number =>
  rows.filter((r) => !(r.kind === 'product' && rows.some((x) => familyRow(x)?.id === r.id))).length;

/* ── WHAT THE KIND REGISTER SEPARATES (FEED-IA §78.1) ─────────────────────────────────────────
 * «MERLUZA 3» sat directly above «Merluza · 3 variations» — two rows spending themselves on one
 * word, and the reason Peter asked «is there OTHER merluza?». A register implies siblings; where
 * there is one family under it, it implies siblings that do not exist.
 *
 * SO THE REGISTER COUNTS WHAT IT WOULD SEPARATE, and draws only where that is more than one. The
 * things it separates are the rows that stand at the LIST'S OWN EDGE — a family head, a product
 * with no members, a row still waiting for a code, and a member whose head is not in this run and
 * therefore states itself whole (§65.4). Members hanging off a head are not separated by the
 * register; their head is what separates them.
 *
 * THE SHELF STAYS AS STRUCTURE, THE REDUNDANCY DIES (§78.6). The register is the forward shape for
 * the day a kind holds several families — «Merluza» and «Merluza de pincho» as two products — and
 * that day it draws itself. What the single-family case loses is a line, not a level: the kind's
 * own rule rides the first row of the run instead (§57.1's three weights, unchanged).
 */
const standing = (rows: Subject[]): number =>
  rows.filter((r) => {
    const family = familyRow(r);
    return family === null || !rows.some((h) => h.kind === 'product' && h.id === family.id);
  }).length;

/* ── THE SELECTION BAR'S LANE (FEED-IA §33, §57.1) ────────────────────────────────────────────
 * The catalogue's rows carry the book's own selection device — 3px of ink down the left edge — and
 * a bar that only exists on the selected row would move every other row's left edge by three
 * pixels the moment it appeared. So the lane is drawn at EVERY level of the list, in `transparent`
 * where nothing is selected: the head, the shelf, the kind and the row all stand on one edge, and
 * the ink simply arrives in a lane that was already there. Nothing moves, ever (§37.3).
 */
const BAR = 3;
const lane = (on: string | null): React.CSSProperties => ({
  borderLeft: `${BAR}px solid ${on ?? 'transparent'}`,
});

/* ── THE LIST'S HEAD (§33, §38) ───────────────────────────────────────────────────────────────
 * It names what the pane holds, counts it, and says what the figures down the right are — one
 * caption for three hundred rows, rather than a band's name repeated on every one of them. It
 * sticks to the top of the pane's own scrollport, which is what a pane's head is for.
 */
function ListHead({
  count,
  caption,
  gutter,
  innerRef,
  controls,
}: {
  controls: React.ReactNode;
  count: number;
  /** the compact scope summary at the fixed terminal of the list head */
  caption: string;
  gutter: string;
  /** A STICKY ELEMENT STICKS INSIDE ITS OWN PARENT, and nowhere else. Wrapped in a plain div to
   *  measure it, this head scrolled away the moment that one-line div did — and the category
   *  headers below it then parked against the top of the pane with the rows showing through the
   *  gap. Found in a shot. So the ref rides the head itself and the head is the scrollport's own
   *  child. */
  innerRef: React.RefObject<HTMLElement>;
}) {
  const [, theme] = useStyletron();
  return (
    <header
      ref={innerRef as React.RefObject<HTMLDivElement>}
      data-testid="stock-list-head"
      data-stratum-head="Catalogue"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        display: 'flex',
        alignItems: 'baseline',
        gap: theme.sizing.scale500,
        flexWrap: 'wrap',
        padding: `${theme.sizing.scale600} ${gutter} ${theme.sizing.scale500}`,
        ...lane(null),
        borderBottom: `1px solid ${theme.colors.contentPrimary}`,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.LabelSmall }}>Products</span>
      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary, flex: 1, minWidth: 0 }}>
        {count} {count === 1 ? 'product' : 'products'}
      </span>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{caption}</span>
      <div style={{ flexBasis: '100%', minWidth: 0 }}>{controls}</div>
    </header>
  );
}

type CatalogueView = 'source' | 'categories' | 'alphabetical';
type CatalogueScope = 'skus' | 'uncoded';
type CatalogueFilterValue = {
  view: CatalogueView;
  scope: CatalogueScope;
  archived: boolean;
  relatedItemId: string | null;
};
type CatalogueFilterOption = { id: string; label: string };

const DEFAULT_CATALOGUE_FILTERS: CatalogueFilterValue = {
  view: 'source',
  scope: 'skus',
  archived: false,
  relatedItemId: null,
};

function sameCatalogueFilters(left: CatalogueFilterValue, right: CatalogueFilterValue) {
  return left.view === right.view
    && left.scope === right.scope
    && left.archived === right.archived
    && left.relatedItemId === right.relatedItemId;
}

function CatalogueFilters({
  value,
  uncodedCount,
  relatedOptions,
  onApply,
}: {
  value: CatalogueFilterValue;
  uncodedCount: number;
  relatedOptions: CatalogueFilterOption[];
  onApply: (value: CatalogueFilterValue) => void;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const [open, setOpen] = React.useState(false);
  const related = relatedOptions.find((option) => option.id === value.relatedItemId);
  const active = [
    value.view === 'categories' ? 'By category' : value.view === 'alphabetical' ? 'A\u2013Z' : null,
    value.scope === 'uncoded' ? 'Uncoded' : null,
    value.archived ? 'Archived' : null,
    related ? 'Related: ' + related.label.split(' \u00b7 ')[0] : null,
  ].filter((part): part is string => Boolean(part));
  const summary = active.join(' \u00b7 ');
  const card = {
    backgroundColor: theme.colors.backgroundPrimary,
    border: '1px solid ' + theme.colors.borderOpaque,
    borderRadius: theme.borders.radius300,
    boxShadow: theme.lighting.shadow600,
  };
  const panel = (close: () => void) => (
    <CatalogueFilterPanel
      value={value}
      uncodedCount={uncodedCount}
      relatedOptions={relatedOptions}
      onApply={(next) => { onApply(next); close(); }}
    />
  );
  const trigger = (
    <Button
      kind={active.length ? KIND.secondary : KIND.tertiary}
      size={SIZE.compact}
      data-testid="catalogue-filters"
      aria-label={active.length ? 'Filters \u00b7 ' + summary : 'Filters'}
      startEnhancer={<Glyph id="sliders" size={STEP.small} />}
      endEnhancer={active.length ? (
        <span
          data-testid="catalogue-filter-count"
          aria-label={active.length + (active.length === 1 ? ' active filter' : ' active filters')}
          style={{
            minWidth: '18px',
            height: '18px',
            display: 'inline-grid',
            placeItems: 'center',
            borderRadius: '50%',
            backgroundColor: theme.colors.contentPrimary,
            color: theme.colors.backgroundPrimary,
            ...theme.typography.LabelXSmall,
          }}
        >
          {active.length}
        </span>
      ) : undefined}
      onClick={phone ? () => setOpen(true) : undefined}
      overrides={{ BaseButton: { style: { cursor: 'default', maxWidth: phone ? '210px' : '264px' } } }}
    >
      <span
        data-testid="catalogue-filter-summary"
        style={{
          display: 'block',
          maxWidth: phone ? '126px' : '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {active.length ? summary : 'Filters'}
      </span>
    </Button>
  );

  if (!phone) return (
    <StatefulPopover
      placement={PLACEMENT_MENU.bottomRight}
      triggerType={TRIGGER_TYPE.click}
      overrides={{ Body: { style: { zIndex: 12 } } }}
      content={({ close }) => (
        <div data-testid="catalogue-filters-menu" style={{ ...card, width: '328px', padding: theme.sizing.scale400 }}>
          {panel(close)}
        </div>
      )}
    >
      {trigger}
    </StatefulPopover>
  );

  return (
    <>
      {trigger}
      <OverlayCard
        isOpen={open}
        onClose={() => setOpen(false)}
        placement="bottom"
        size="full"
        ariaLabel="Product filters"
        overrides={{ Root: { style: { zIndex: 10 } }, Card: { style: { maxHeight: 'min(86dvh, 720px)', overflowY: 'auto', padding: theme.sizing.scale500 } } }}
      >
        <div data-testid="catalogue-filters-sheet">{panel(() => setOpen(false))}</div>
      </OverlayCard>
    </>
  );
}

function CatalogueFilterPanel({
  value,
  uncodedCount,
  relatedOptions,
  onApply,
}: {
  value: CatalogueFilterValue;
  uncodedCount: number;
  relatedOptions: CatalogueFilterOption[];
  onApply: (value: CatalogueFilterValue) => void;
}) {
  const [, theme] = useStyletron();
  const [draft, setDraft] = React.useState<CatalogueFilterValue>(value);
  const clear = sameCatalogueFilters(draft, DEFAULT_CATALOGUE_FILTERS);
  const choice = (selected: boolean) => ({
    width: '100%',
    minHeight: '44px',
    justifyContent: 'flex-start',
    textAlign: 'left' as const,
    paddingLeft: theme.sizing.scale300,
    paddingRight: theme.sizing.scale300,
    cursor: 'default',
    borderRadius: theme.borders.radius200,
    backgroundColor: selected ? theme.colors.backgroundSecondary : 'transparent',
    ':hover': { backgroundColor: theme.colors.backgroundSecondary },
    ':focus-visible': { outline: '2px solid ' + theme.colors.accent, outlineOffset: '2px' },
  });
  const choices = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.sizing.scale100,
    padding: theme.sizing.scale100,
    margin: '0 -' + theme.sizing.scale100,
  };

  return (
    <div data-testid="catalogue-filter-panel" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale300 }}>
        <h3 style={{ ...theme.typography.LabelMedium, margin: 0 }}>Filters</h3>
        <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="catalogue-filter-clear" disabled={clear} onClick={() => setDraft(DEFAULT_CATALOGUE_FILTERS)}>Clear</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Sort</span>
        <div data-testid="catalogue-view-toggle" role="radiogroup" aria-label="Product order" style={{ ...choices, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft.view === 'source'} data-list-card="inset" data-testid="catalogue-view-source" onClick={() => setDraft((current) => ({ ...current, view: 'source' }))} overrides={{ BaseButton: { style: choice(draft.view === 'source') } }}>Source order</Button>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft.view === 'categories'} data-list-card="inset" data-testid="catalogue-view-categories" onClick={() => setDraft((current) => ({ ...current, view: 'categories' }))} overrides={{ BaseButton: { style: choice(draft.view === 'categories') } }}>Category</Button>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft.view === 'alphabetical'} data-list-card="inset" data-testid="catalogue-view-alphabetical" onClick={() => setDraft((current) => ({ ...current, view: 'alphabetical' }))} overrides={{ BaseButton: { style: choice(draft.view === 'alphabetical') } }}>{'A\u2013Z'}</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Items</span>
        {/* ── THE SCOPE NAMES WHAT IT HOLDS (§201.1, corrected at RELEASE-195) ──────────────
            This said «Coded», and from §201 the same list carries a «Code pending» section under
            its own rule — so the word named a subset of its own contents. «Products» is the whole
            scope: everything the house sells, whether its code has arrived or not. The other
            scope is the accepted customer wordings, which are a different KIND of thing and will
            never carry a code. */}
        <div data-testid="catalogue-item-scope" role="radiogroup" aria-label="Catalogue items" style={choices}>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft.scope === 'skus'} data-list-card="inset" data-testid="catalogue-skus" onClick={() => setDraft((current) => ({ ...current, scope: 'skus' }))} overrides={{ BaseButton: { style: choice(draft.scope === 'skus') } }}>Products</Button>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft.scope === 'uncoded'} data-list-card="inset" data-testid="catalogue-uncoded-items" onClick={() => setDraft((current) => ({ ...current, scope: 'uncoded', archived: false }))} overrides={{ BaseButton: { style: choice(draft.scope === 'uncoded') } }}>Uncoded · {uncodedCount}</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Status</span>
        <div role="radiogroup" aria-label="Product status" style={choices}>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={!draft.archived} data-list-card="inset" data-testid="catalogue-current-items" onClick={() => setDraft((current) => ({ ...current, archived: false }))} overrides={{ BaseButton: { style: choice(!draft.archived) } }}>Current</Button>
          <Button kind={KIND.tertiary} size={SIZE.compact} role="radio" aria-checked={draft.archived} data-list-card="inset" data-testid="catalogue-archived" onClick={() => setDraft((current) => ({ ...current, scope: 'skus', archived: true }))} overrides={{ BaseButton: { style: choice(draft.archived) } }}>Archived</Button>
        </div>
      </div>

      <label data-testid="catalogue-related-filter" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Related products</span>
        <Select
          aria-label="Related products"
          size={SELECT_SIZE.compact}
          clearable
          searchable
          placeholder="Any product"
          options={relatedOptions}
          value={relatedOptions.filter((option) => option.id === draft.relatedItemId)}
          onChange={({ value: options }) => setDraft((current) => ({ ...current, relatedItemId: options[0] ? String(options[0].id) : null }))}
          overrides={{ Root: { style: { minWidth: 0, width: '100%' } }, ValueContainer: { style: { minHeight: '44px' } }, DropdownOption: { style: { minHeight: '44px' } } }}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: theme.sizing.scale200, borderTop: '1px solid ' + theme.colors.borderOpaque }}>
        <Button kind={KIND.primary} size={SIZE.compact} data-testid="catalogue-filter-apply" onClick={() => onApply(draft)}>Apply</Button>
      </div>
    </div>
  );
}

/* ── STRATUM 1's HEADER: THE NODE, AND ROCOTO'S GROUNDING OF IT ───────────────────────────────
 * «Every house SKU GROUNDS onto a tree node. This is the LLM labeller's real job: not flat
 * category tags — tree grounding, correctable in one tap, corrections teach» (§10.2).
 *
 * So a category Rocoto chose is a NODE WEARING THE MARK, and it is a button: tap it, and the
 * NEARBY NODES are offered — the parent above it, its siblings beside it, its children under it.
 * Tapping one re-grounds the group, writes the event, and sticks. Never a free-text box: a name
 * typed into a box is a name that grounds onto nothing, and the whole intelligence hangs off the
 * grounding.
 *
 * IT CARRIES THE SHELF'S FACE (§35.8, §41.7): the goods, painted, at a chip's size — so a person
 * scanning a catalogue reads the shelves by picture as well as by word.
 *
 * IT STICKS UNDER THE PANE'S OWN HEAD (§38). The pane is the scrollport now, so the offset is the
 * head's height and nothing else — no measuring of the chrome three floors above it.
 */
function CategoryHeader({ shelf, top, count, gutter, first, terms = [], onDiscuss }: {
  shelf: Shelf;
  top: number;
  count: number;
  gutter: string;
  first: boolean;
  terms?: string[];
  onDiscuss: () => void;
}) {
  const [, theme] = useStyletron();
  const [hovered, setHovered] = React.useState(false);
  const phone = usePhone();
  return <header onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} data-category={shelf.name} data-node={shelf.shelf} data-guessed={shelf.guessed ? 'yes' : 'no'} style={{
    position: 'sticky', top, zIndex: 1, display: 'flex', alignItems: 'center', gap: theme.sizing.scale300,
    paddingTop: first ? theme.sizing.scale500 : theme.sizing.scale700, paddingRight: gutter,
    paddingBottom: theme.sizing.scale300, paddingLeft: gutter, ...lane(null),
    borderTop: first ? 'none' : `1px solid ${theme.colors.borderOpaque}`, background: theme.colors.backgroundPrimary, minWidth: 0,
  }}>
    <h3 data-testid="category-label" style={{ margin: 0, ...theme.typography.LabelLarge, minWidth: 0, overflowWrap: 'anywhere', flex: '1 1 auto' }}><Mark text={shelf.name} terms={terms} /></h3>
    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, flexShrink: 0 }}>{count}</span>
    <Button kind={KIND.tertiary} size={SIZE.mini} overrides={{ BaseButton: { style: { opacity: hovered || phone ? 1 : 0, ':focus-visible': { opacity: 1 }, minHeight: '36px', flexShrink: 0 } } }} data-testid={`category-feedback-${shelf.shelf}`} aria-label={`Discuss categorisation of ${shelf.name}`} onClick={onDiscuss}>Discuss category</Button>
  </header>;
}

/* ── THE KIND — THE LADDER'S L1, AND THE LEVEL THAT WAS UPSIDE DOWN (§57.1) ───────────────────
 * It appears only where it says something the shelf did not already say, because a subcategory that
 * repeats its category is a line of the page spent on nothing.
 *
 * WHAT WAS WRONG WITH IT, MEASURED: it drew at x=76 — the pane's own edge — while its parent
 * shelf's words stood at x=138 and the product names it heads stood at x=152. A level outdented
 * past its own parent AND past its own children reads as a stray caption, which is «one grey list»
 * exactly. Three fixes, all structural:
 *   · IT LANDS ON THE NAMES IT HEADS. The face's seat is drawn empty in front of it, so the words
 *     sit at the product names' own x by construction — change the face's size and the kind moves
 *     with it, because nothing here is a typed number.
 *   · IT TAKES THE MIDDLE RULE. `mono400` above it: heavier than a row's hairline, lighter than the
 *     shelf's ink. Three weights, three levels, read at a glance and in one colour.
 *   · IT CARRIES ITS COUNT, so it reads as a group rather than as a word (§51.24: facts, never
 *     captions) — the same fact the shelf above it already states about itself.
 */
function KindHead({
  name,
  count,
  terms,
  gutter,
  first,
}: {
  name: string;
  count: number;
  terms: string[];
  gutter: string;
  /** the first kind under a shelf; the shelf's own header already opened the run */
  first: boolean;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-kind={name}
      data-count={count}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: theme.sizing.scale500,
        paddingTop: first ? theme.sizing.scale400 : theme.sizing.scale600,
        paddingRight: gutter,
        paddingBottom: theme.sizing.scale300,
        paddingLeft: gutter,
        ...lane(null),
        borderTop: first ? 'none' : `1px solid ${theme.colors.mono400}`,
        ...theme.typography.LabelXSmall,
        minWidth: 0,
      }}
    >
      {/* the face's empty seat — this is what lands the words on the product names' own x */}
      <span aria-hidden="true" style={{ width: 44, flex: '0 0 auto' }} />
      <span
        style={{
          color: theme.colors.contentSecondary,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          minWidth: 0,
        }}
      >
        <Mark text={name} terms={terms} />
      </span>
      <span style={{ color: theme.colors.contentTertiary, flex: '0 0 auto' }}>{count}</span>
    </div>
  );
}

/* The catalogue presents one exact SKU per selectable row. A family is a structural heading,
 * never a second presentation of its base SKU: no artwork, stock, price or Product Sheet door.
 * Each admitted member keeps its own illustration and commercial state. */
/* ── THE LADDER'S THREE WEIGHTS, NAMED (§57.1, and §78.1's collapse) ──────────────────────────
 * Read down the pane, a rule says what has just started: ink = a new shelf, the mid rule = a new
 * kind, a hairline = the next of the same thing. The kind register used to carry the mid rule on
 * its own line; where §78.1 collapses that line, the rule rides the run's first row instead, so
 * the LEVEL survives losing its caption. Nothing else changes weight.
 */
type RowRule = 'none' | 'row' | 'kind';

const CatalogueRow = React.forwardRef<HTMLButtonElement, {
  subject: Subject;
  /** the sentence under the name — what is on the floor, or how Rocoto came to know this thing */
  fact: React.ReactNode;
  /** Rocoto counted it, so the sentence wears the mark (§1) */
  observed?: boolean;
  unit: string;
  selected: boolean;
  /** what rule opens this row — the ladder's weight, decided by the caller (§57.1, §78.1) */
  rule: RowRule;
  /** §65.1/§65.4: whether this member's own family head is drawn above it in this list */
  parentShown?: boolean;
  /** §75.6: how many members hang off this row, where it is a FAMILY HEAD */
  members?: number;
  terms: string[];
  gutter: string;
  onPick: () => void;
}>(function CatalogueRow({
  subject,
  fact,
  observed,
  unit,
  selected,
  rule,
  parentShown,
  members = 0,
  terms,
  gutter,
  onPick,
}, ref) {
  const [css, theme] = useStyletron();
  const { config: catalogueConfig } = useConfig();
  /* §75.6: a MEMBER is the base form, a word the traffic keeps adding, or a sort — all three are
     sub-things of the family above them and all three carry a price.
     A MEMBER WHOSE FAMILY IS NOT ON SCREEN IS NOT A SUB-THING (§65.4). Under a word that matched
     «cabeza» the head drops out of the list, and an indented «sin cabeza» hanging under nothing is
     the opposite of «they must find their own thing INSTANTLY». So the sub-grammar is conditional
     on the head being drawn: orphaned, the row states the whole name and stands at the list's own
     edge. The image rule holds either way — its own painting, or none. */
  const family = familyRow(subject);
  const word = skuRecord(catalogueConfig.cast, subject.kind === 'base' ? subject.product.id : subject.id)?.details.name ?? memberWord(subject);
  const sub = family && word && parentShown ? { family, word } : null;
  const variation = family && word ? { family, word } : null;
  /* THE HEAD OF A FAMILY is structure, never a selectable exact-Code row or selling-unit terminal. */
  const head = subject.kind === 'product' && members > 0;
  const [over, setOver] = React.useState(false);
  const [ring, setRing] = React.useState(false);
  /* THE RING IS THE KEYBOARD'S, NEVER THE POINTER'S. `:focus-visible` cannot be written as an
     inline style, so the row asks the element itself whether the browser would have drawn one. */

  if (head) return (
    <div data-family-row={`family:${catalogueConfig.cast}:${subject.id}`} data-family-head="yes" data-members={members}
      style={{ display: 'flex', alignItems: 'center', minHeight: 44, boxSizing: 'border-box',
        padding: `${theme.sizing.scale300} ${gutter}`, ...lane(null),
        borderTop: rule === 'none' ? 'none' : `1px solid ${rule === 'kind' ? theme.colors.mono400 : theme.colors.borderOpaque}`,
        ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
      <span><Mark text={subject.name} terms={terms} /> family</span>
    </div>
  );

  return (
    <button
      type="button"
      ref={ref}
      data-product-row={subject.kind === 'base' ? subject.product.id : subject.id}
      data-catalogue-entry={subject.id}
      data-stratum={subject.kind}
      data-sub={sub ? 'yes' : 'no'}
      data-catalogue-label={sub?.word ?? subject.name}
      /* WHAT THE LIBRARY ANSWERED, AND ONLY WHERE IT DECIDES ANYTHING (§65.1, narrowed by §78.5).
         A member under its head wears no painting whatever the library holds, so the attribute
         would be reporting a test that no longer governs the row — it stands on the ORPHAN, where
         §65.1's comparison is still what draws or does not draw a face. */
      /* §75.6, checkable from outside: which rows are family heads, how many members they carry,
         and which family a member belongs to */
      data-member-of={family ? family.id : undefined}
      data-selected={selected ? 'yes' : 'no'}
      /* §78, checkable from outside: which weight opened this row */
      data-rule={rule}
      aria-current={selected ? 'true' : undefined}
      onClick={onPick}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={(e) => setRing(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setRing(false)}
      style={{
        display: 'block',
        width: '100%',
        /* the containing block for the variation mark, which is painted into the indent and
           takes no part in this row's flex flow (§78.2) */
        position: 'relative',
        /* ── HEIGHT IS THE DENSITY (FEED-IA §78.4) ─────────────────────────────────────────
           «Maybe the sub things are too tall… a member is ONE LINE.» A head is a full row —
           painting, name, fact, count. A member is a line: its word, its reading, its Product Unit,
           at the touch target's own floor and not a pixel more. Three members cost three thin
           lines instead of three cards, which is the whole of what §78 asks for.
           IT IS 48 AND NOT LESS: the Uber extract's target rule is the bar this build measures
           against, and a catalogue row is tapped on a phone all morning.
           ⚠ AND THE MINIMUM IS THE WHOLE ROW, HAIRLINE INCLUDED. Without `border-box` the ladder's
           own 1px rule sat OUTSIDE the minimum, so «48» named the content box and the row was 49 —
           a floor stated in one measure and drawn in another. `Add a variation`, the last row of
           this very block, has declared `border-box` since it was written; these are the two rows
           of one block finally agreeing about what they are measuring.
           IT IS NOT WHAT MAKES A MEMBER 49 TODAY, and the comment says so rather than claiming a
           fix: §132.5's painting is a 32px seat and the row's air is 8 above and 8 below, so the
           CONTENT is 48 on its own and the rule is the pixel over. What this buys is that the
           minimum can never again mean a different box from the one the eye measures. */
        boxSizing: 'border-box',
        minHeight: 0,
        /* THE INDENT IS THE RELATIONSHIP, AND IT IS ONE STEP (§65.1, §78.2). A member starts
           where its head's NAME starts — the face's seat plus the row's own gap, drawn from the
           face's size rather than typed. It used to add a SECOND seat of its own on top of that,
           so a member stood 40px right of the name it hangs from and the ladder compounded
           category → kind → head → member. The member's own seat went with its painting (§78.5) —
           and §132.5 gave it back, because the picture is the PRODUCT'S: the column that used to
           be the head's face is the member's face, and it is still the indent. */
        paddingTop: theme.sizing.scale100,
        paddingBottom: theme.sizing.scale100,
        paddingRight: gutter,
        /* THE INDENT IS THE FACE SEAT ITSELF NOW (§78.2 · §132.5). A member used to be pushed in
           by a padding the width of its head's painting; it draws its OWN painting in that column
           instead, so the padding is the plain gutter and every x on the ladder is unchanged —
           measured, not assumed. */
        paddingLeft: gutter,
        border: 'none',
        /* THE RULE IS THE LADDER'S, AND THE CALLER DECIDES IT (§57.1, §78.1). A head followed by a
           line is two openings for one thing, and it is what made shelf, kind and product read as
           one undifferentiated ladder of identical rules. Where §78.1 collapses a kind register
           that held one family, the mid rule rides this row instead — the level survives losing
           its caption.
           IT SAYS `none` RATHER THAN LEAVING IT OUT, and a shot proved why: React removes a style
           property whose value is `undefined`, so `border-top` came OFF an inline declaration that
           `border: none` had expanded into — and the UA's own 2px outset button border came back
           on exactly the first row of every run. Measured as 2px of black where a hairline should
           not have been at all. A shorthand and a longhand in one object must both be stated. */
        borderTop: 'none',
        /* SELECTION IS THE INK BAR — the book's own device, to the token (§43: one visual identity
           per object, one grammar for a master-detail list). It used to be the same grey as hover,
           which meant moving the pointer erased the answer to «which one is open». The lane is
           always 3px, so nothing moves when the ink arrives (§37.3). */
        background: 'transparent',
        outline: 'none',
        textAlign: 'left',
        cursor: 'default',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span
        data-testid="product-row-hit" data-list-card="inset"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale400,
          minHeight: sub ? 68 : 76,
          width: '100%',
          boxSizing: 'border-box',
          padding: theme.sizing.scale300,
          borderRadius: theme.borders.radius300,
          ...lane(selected ? theme.colors.contentPrimary : null),
          background: selected || over ? theme.colors.backgroundSecondary : 'transparent',
          outline: ring ? "2px solid " + theme.colors.contentPrimary : 'none',
          outlineOffset: '-2px',
        }}
      >
      {/* THE IMAGE IS ON EVERY PRODUCT ROW (§41.7, non-negotiable): the painting where the library
          has one, the family's own drawn mark where it does not — one seat, never a gap.
          A GROUP IS NOT A PRODUCT AND HAS NO PICTURE (§132.5) — it keeps the seat and stands empty.
          THE MEMBER DRAWS INTO THAT COLUMN, at 32px, on §65.1's own honest test: its painting where
          the library answers ITS name with a different one, nothing where it answers the parent's.
          AN ORPHANED MEMBER KEEPS §65.1's TEST AT FULL SIZE — its own painting where the library
          holds one, an empty seat where it does not, so the names on the edge land on one x. */}
      {sub ? (
        /* Every exact SKU owns its own illustration association, including the nested base. */
        <span data-member-face="sku" style={{ flex: '0 0 auto' }}><ProductFace of={{ name: subject.name, id: subject.kind === 'base' ? subject.product.id : subject.id, sector: catalogueConfig.cast }} size={56} /></span>
      ) : (
        <ProductFace of={{ name: subject.name, id: subject.id, sector: catalogueConfig.cast }} size={56} />
      )}

      {/* ── A MEMBER IS ONE LINE (FEED-IA §78.4) ────────────────────────────────────────────
          word · reading · Product Unit, laid out across the row instead of stacked down it. The head
          above keeps the two-line shape, because a head carries a name AND a fact about the goods
          and it is the row a person aims at. A member carries one word and one reading, and
          stacking those spent a whole extra line-box on each of three rows. */}
      {sub ? (
        <span style={{ display: "flex", flexDirection: "column", gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
          <span data-amendment={sub.word} style={{ ...theme.typography.LabelMedium, color: theme.colors.contentPrimary, overflowWrap: "anywhere" }}>
            {sub.word}
          </span>
          <span data-product-fact="yes" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, overflowWrap: "anywhere" }}>
            {observed ? <Marked>{fact}</Marked> : fact}
          </span>
        </span>
      ) : (
        <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, flex: 1, minWidth: 0 }}>
          <span
            style={{
              ...theme.typography.LabelMedium,
              color: theme.colors.contentPrimary,
              display: 'flex',
              alignItems: 'baseline',
              gap: theme.sizing.scale200,
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            {variation ? (
              /* ORPHANED BY A WORD (§65.4): the head is filtered out, so this row says the whole
                 thing — the family name, then what differs — and stands at the list's own edge. */
              <>
                <Mark text={variation.family.name} terms={terms} />
                <span style={{ color: theme.colors.contentTertiary }}>·</span>
                <span data-amendment={variation.word} style={{ color: theme.colors.contentPrimary }}>
                  {variation.word}
                </span>
              </>
            ) : (
              <Mark text={subject.name} terms={terms} />
            )}
            {/* THE FAMILY'S SIZE, ON THE FAMILY'S OWN ROW (§75.6). It is the same device the KIND
                head above it uses for the same job — a quiet number that says «this is a group» —
                and it tells the reader that the exact selectable SKUs follow underneath. */}
            {/* ── AND IT NOTICES ITSELF (FEED-IA §127.4c) ──────────────────────────────────
                «An animated notice — it shows no extra info; it exists to make them notice
                variations are covered.» So the count breathes ONCE when the family lands, in
                INK ONLY: the seat, the type and the box are constant, so nothing on the row
                moves (§37.3 · §59.1) and a reader who has asked for less motion gets none. It
                says exactly what it said before — the number of variations — because a notice
                that carried new information would be a second fact competing with the row. */}
            {head && (
              <span
                data-family-count={members}
                data-notice="variations"
                className={css({
                  color: theme.colors.contentTertiary,
                  flex: '0 0 auto',
                  animationName: {
                    '0%': { color: theme.colors.contentTertiary },
                    '35%': { color: theme.colors.contentPrimary },
                    '100%': { color: theme.colors.contentTertiary },
                  },
                  animationDuration: '1400ms',
                  animationIterationCount: '1',
                  animationTimingFunction: theme.animation.easeInOutCurve,
                  '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
                })}
              >
                {members} {members === 1 ? 'variation' : 'variations'}
              </span>
            )}
          </span>
          <span
            data-product-fact="yes"
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentTertiary,
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {observed ? <Marked>{fact}</Marked> : fact}
          </span>
        </span>
      )}

      {/* A catalogue row ends in the literal Product Unit. Price is maintained and read in the
          Product Sheet; putting a changing tariff here would turn this stable identity register into
          a second pricing surface. The attribute makes the fixed terminal measurable at every width. */}
      <span
        data-product-unit={unit || 'needs-review'}
        style={{
          ...theme.typography.LabelSmall,
          color: theme.colors.contentSecondary,
          flex: '0 0 auto',
          minWidth: '44px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {unit || '\u2014'}
      </span>
      </span>
    </button>
  );
});

/* ── THE AMENDMENT'S CHIP IS RETIRED IN THE CATALOGUE (FEED-IA §78.3) ─────────────────────────
 * §2 wrote it: «an amendment renders as a small chip riding the line's name: Chicken wings ·
 * frozen». That is an ALBARÁN LINE's grammar and it still holds there — a word said about one
 * delivery, riding a name it does not belong to.
 *
 * IN THE CATALOGUE THE WORD IS THE ROW'S OWN SUBJECT, not a note on somebody else's. «Weird bold»
 * was Peter reading a boxed label where the list's lead word should have stood, three of them in a
 * column under one head. So a member's word is TEXT in the row, in the list's own type ladder, and
 * the box that made it read heavy is gone. `data-amendment` rides the text, so what the word IS
 * stays checkable from outside; only its furniture went.
 */

/* ── THE DOOR THAT ADDS ONE (FEED-IA §75.6 · THE-OBJECT-MAP C6) ───────────────────────────────
 * «Adding variations should be a thing too.» It stands at the FOOT of a family's members, at the
 * members' own indent, so the run reads «here is the family, here is what it comes as, and here is
 * where another one goes». It is a row of the list rather than a control on the head, because the
 * head is a `<button>` and a button may not contain one — the same construction the river's cards
 * keep (§43's door note).
 */
function AddVariation({
  family,
  gutter,
  onAdd,
}: {
  family: Product;
  gutter: string;
  onAdd: () => void;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  const [ring, setRing] = React.useState(false);
  return (
    <button
      type="button"
      data-testid={`add-variation-${family.id}`}
      data-family={family.id}
      onClick={onAdd}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={(e) => setRing(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setRing(false)}
      style={{
        display: "block",
        width: '100%',
        boxSizing: 'border-box',
        /* THE DOOR STANDS AT THE MEMBERS' OWN HEIGHT (§78.4). It is the last line of the family's
           block and it reads as one of them — 48, the same floor every member holds. */
        minHeight: 0,
        paddingTop: theme.sizing.scale100,
        paddingBottom: theme.sizing.scale100,
        paddingRight: gutter,
        /* the members' own indent, drawn from the face's seat rather than typed (§78.2) */
        paddingLeft: gutter,
        border: 'none',
        borderTop: "none",
        background: 'transparent',
        textAlign: 'left',
        cursor: 'default',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span data-testid="add-variation-hit" data-list-card="inset" style={{ display: "flex", alignItems: "center", gap: theme.sizing.scale200, minHeight: 52, padding: theme.sizing.scale300, borderRadius: theme.borders.radius300, background: over || ring ? theme.colors.backgroundSecondary : "transparent", outline: ring ? "2px solid " + theme.colors.contentPrimary : "none", outlineOffset: "-2px" }}>
      {/* THE MARK RIDES THE WORDS (§78.2). It used to sit in a 28px seat of its own, which put this
          row's label 40px right of the members' words it stands under — the compounding indent, in
          the one row whose whole job is to belong to that block. */}
      <span aria-hidden="true" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
        <Glyph id="plus" size={STEP.small} />
      </span>
      <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
        Add a variation
      </span>
      </span>
    </button>
  );
}

/* ── WRITING ONE (FEED-IA §75.6 · C6 · §76's grammar) ─────────────────────────────────────────
 * One task, one field, one act. The card asks for the ONE thing it needs — the word this form adds
 * to the family's name — and shows what the row will read as while it is being typed, so nobody
 * has to imagine the result. Enter writes it.
 *
 *   ┌─ ADD A VARIATION ───────────────────────────────────────────────────────────────────────┐
 *   │ HEADING   Add a variation                                                                │
 *   │ FIELD     [ sin cabeza                                    ]                              │
 *   │ PREVIEW   Merluza · sin cabeza                                                           │
 *   │ ACT       [ Add it ]                                                                     │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 */
/* ═══ NEW PRODUCT (FEED-IA §44.2, §44.3) ══════════════════════════════════════════════════════
 * «New Event» said nothing about what it did. Two acts, each named after itself: STOCK UPDATE is
 * what lands on the floor, and NEW PRODUCT is what joins the catalogue. This is the second one, and
 * §44.3 gives it its depth: «inside it, drag-and-drop for a CSV import, and Connect to ERP so
 * updates stream from the ERP as they happen.»
 *
 * THREE WAYS IN, IN THE ORDER A HOUSE ACTUALLY USES THEM: the one thing somebody is holding right
 * now, the whole catalogue at once, and the connection that keeps it current. All three land in the
 * same place — `catalogue.mint` — so a product is a product whichever door it came through, and it
 * takes a price, a rule and a lot book like every other row.
 */

/** What a dropped file turned out to be. Nothing is claimed that the parse did not find. */
type Sheet = CatalogueImportSheet;

/** The words a column header uses for each part. Spanish first: the exports are Spanish. */
const COLUMN_WORDS = {
  name: ['nombre', 'producto', 'descripcion', 'articulo', 'name', 'product', 'description'],
  unit: ['unidad', 'ud', 'medida', 'formato', 'unit', 'uom', 'soldby', 'sellingunit'],
  price: ['precio', 'pvp', 'tarifa', 'price'],
  category: ['categoria', 'seccion', 'category', 'section'],
  family: ['familia', 'family'],
  sku: ['sku', 'codigo', 'código', 'referencia', 'ref', 'code'],
};

/** The units a catalogue writes, folded onto the ones this app sells by. */
const IMPORT_UNITS: Record<string, string> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg',
  ud: 'ud', uds: 'ud', unidad: 'ud', unidades: 'ud', pieza: 'ud', piezas: 'ud', u: 'ud',
  caja: 'caja', cajas: 'caja', box: 'caja',
  saco: 'saco', sacos: 'saco', manojo: 'manojo', madeja: 'madeja', l: 'l', litro: 'l',
};

const UNIT_OPTIONS = ['kg', 'ud', 'caja', 'saco', 'manojo', 'l'];

/** «Merluza de pincho» → «merluza-de-pincho». The human-readable tail of a local identity. */
const slugOf = (name: string): string => foldWord(name).replace(/\s+/g, '-').slice(0, 40);
/** A literal business SKU stays in `code`; its internal id encodes every codepoint, avoiding slug
 * collisions (`A/B` versus `A B`) while remaining safe in a hash route. */
const skuIdentity = (sku: string): string => `sku-${Array.from(sku.trim()).map((char) => char.codePointAt(0)?.toString(36)).join('-')}`;
/** A blank SKU is not permission to merge two source facts. Include row, unit and price in its
 * local identity so equal display names remain independently priced and traceable. */
const anonymousIdentity = (name: string, unit: string, price: number | undefined, sourceRow: number): string =>
  `row-${sourceRow}-${slugOf(name)}-${slugOf(unit)}-${price === undefined ? 'unpriced' : Math.round(price * 100)}`;

/**
 * A REAL PARSE OF A REAL FILE. It reads the delimiter off the first line (a Spanish export is
 * semicolons as often as commas), finds which column holds which part by the words in the header,
 * and takes the rest as rows. A file whose header names nothing takes the first column as the name,
 * because a one-column list of products is still a list of products.
 */
function parseSheet(text: string, file: string, original?: File): Sheet {
  const records = (source: string): string[] => {
    const found: string[] = [];
    let record = '';
    let quoted = false;
    for (let at = 0; at < source.length; at += 1) {
      const character = source[at];
      if (character === '"' && quoted && source[at + 1] === '"') { record += '""'; at += 1; }
      else if (character === '"') { quoted = !quoted; record += character; }
      else if ((character === '\n' || character === '\r') && !quoted) {
        if (record.trim().length > 0) found.push(record);
        record = '';
        if (character === '\r' && source[at + 1] === '\n') at += 1;
      } else record += character;
    }
    if (record.trim().length > 0) found.push(record);
    return found;
  };
  const lines = records(text);
  const empty = { name: -1, unit: -1, price: -1, category: -1, family: -1, sku: -1 };
  if (lines.length === 0) return { columns: [], mapped: empty, rows: [], sourceRows: [], lines: 0, file, delimiter: ',', original };

  const semis = (lines[0].match(/;/g) ?? []).length;
  const commas = (lines[0].match(/,/g) ?? []).length;
  const delimiter: ',' | ';' = semis > commas ? ';' : ',';
  const cells = (line: string): string[] => {
    const found: string[] = [];
    let value = '';
    let quoted = false;
    for (let at = 0; at < line.length; at += 1) {
      const character = line[at];
      if (character === '"' && quoted && line[at + 1] === '"') { value += '"'; at += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === delimiter && !quoted) { found.push(value); value = ''; }
      else value += character;
    }
    found.push(value);
    return found;
  };

  const first = cells(lines[0]);
  const where = (words: string[]): number =>
    first.findIndex((column) => words.includes(foldWord(column.trim()).replace(/\s+/g, '')));
  const mapped = {
    name: where(COLUMN_WORDS.name),
    unit: where(COLUMN_WORDS.unit),
    price: where(COLUMN_WORDS.price),
    category: where(COLUMN_WORDS.category),
    family: where(COLUMN_WORDS.family),
    sku: where(COLUMN_WORDS.sku),
  };
  const headed = mapped.name >= 0 || mapped.price >= 0 || mapped.unit >= 0 || mapped.category >= 0 || mapped.family >= 0 || mapped.sku >= 0;
  const nameAt = mapped.name >= 0 ? mapped.name : 0;
  const body = headed ? lines.slice(1) : lines;
  const seen = new Set<string>();
  const rows: Sheet['rows'] = [];
  const sourceRows: Sheet['sourceRows'] = [];
  for (let sourceRow = 0; sourceRow < body.length; sourceRow += 1) {
    const c = cells(body[sourceRow]);
    const name = (c[nameAt] ?? '').trim();
    const sourceLine = sourceRow + (headed ? 2 : 1);
    const code = mapped.sku >= 0 ? (c[mapped.sku] ?? '').trim() : '';
    const sourceUnit = mapped.unit >= 0 ? (c[mapped.unit] ?? '').trim() : '';
    const unit = IMPORT_UNITS[foldWord(sourceUnit)] ?? sourceUnit;
    const figure = mapped.price >= 0 ? Number((c[mapped.price] ?? '').replace(',', '.').replace(/[^\d.]/g, '')) : NaN;
    const price = Number.isFinite(figure) && figure > 0 ? figure : undefined;
    const baseId = name ? (code ? skuIdentity(code) : anonymousIdentity(name, unit, price, sourceLine)) : '';
    /* Repeated business SKUs stay as separate review rows. Their source-line suffix is local queue
       identity only; the duplicated literal code is what blocks acceptance until it is resolved. */
    const id = baseId && seen.has(baseId) ? `${baseId}-source-${sourceLine}` : baseId;
    sourceRows.push({ id: id || undefined, cells: c, sourceRow: sourceLine });
    if (!name || !id) continue;
    seen.add(baseId);
    rows.push({
      id,
      code: code || undefined,
      name,
      unit,
      price,
      sourceUnit: sourceUnit || undefined,
      said: (mapped.category >= 0 ? c[mapped.category]?.trim() : undefined) || (mapped.family >= 0 ? c[mapped.family]?.trim() : undefined),
      category: mapped.category >= 0 ? c[mapped.category]?.trim() || undefined : undefined,
      family: mapped.family >= 0 ? c[mapped.family]?.trim() || undefined : undefined,
      cells: c,
      sourceRow: sourceLine,
    });
  }
  return { columns: headed ? first : [], mapped, rows, sourceRows, lines: body.length, file, delimiter, original };
}

/* ── A SUPPLIER'S LIST THAT HAS NO ROWS TO READ (E200.08 · FEED-IA §196.5) ────────────────────
 * §196.5 named THREE kinds of tabular document and Parsewise reads all three; the kit reached for
 * it on one. A supplier's price list arrives as a PHOTO of a printed sheet or as a PDF at least as
 * often as it arrives as a CSV, and both of those met a dead end here: the PDF was refused with
 * «Automatic PDF review is ready to connect» and the photo was held under «Reading is pending; no
 * products have been created» — two sentences about what the software would not do, in a product
 * whose runtime had been reading catalogues since E193.
 *
 * WHICH READER READS IT is PAR-01's rule, and its principle is «an exact reading beats a
 * probabilistic one»: a CSV, a TSV, a text export and an .xlsx the browser can open are read
 * EXACTLY, here, by `parseSheet`. What is left — a photograph, a scan, a PDF — has no rows to
 * read, only layout, and goes to Parsewise as `kind=catalogue`.
 *
 * THE ANSWER LANDS IN THE REVIEW QUEUE THAT ALREADY EXISTS. A read row becomes a sheet row, so a
 * photographed list meets the same identity checks, the same editable name/code/unit, the same
 * inclusion toggles and the same readback confirmation a CSV meets. One review, three doors.
 */
function parsedSheet(result: ParseResult, file: string, original?: File): Sheet {
  const seen = new Set<string>();
  const rows: Sheet['rows'] = [];
  const sourceRows: Sheet['sourceRows'] = [];
  result.rows.forEach((row, index) => {
    const sourceLine = index + 1;
    const name = (row.name || '').trim();
    const code = (row.code || '').trim();
    const unit = IMPORT_UNITS[foldWord((row.unit || '').trim())] ?? (row.unit || '').trim();
    const price = typeof row.price === 'number' && Number.isFinite(row.price) && row.price > 0 ? row.price : undefined;
    const baseId = name ? (code ? skuIdentity(code) : anonymousIdentity(name, unit, price, sourceLine)) : '';
    const id = baseId && seen.has(baseId) ? `${baseId}-source-${sourceLine}` : baseId;
    /* The raw line Parsewise cited is the source cell here: the evidence a person compares the
       reviewed row against, exactly as a CSV's own cells are. */
    const cells = [code, name, unit, price === undefined ? '' : String(price), row.raw ?? ''];
    sourceRows.push({ id: id || undefined, cells, sourceRow: sourceLine });
    if (!name || !id) return;
    seen.add(baseId);
    rows.push({ id, code: code || undefined, name, unit, price, sourceUnit: (row.unit || '').trim() || undefined, cells, sourceRow: sourceLine });
  });
  return {
    columns: ['Code', 'Product name', 'Unit', 'Unit price', 'As printed'],
    mapped: { name: 1, unit: 2, price: 3, category: -1, family: -1, sku: 0 },
    rows,
    sourceRows,
    lines: result.rows.length,
    file,
    delimiter: ',',
    original,
  };
}

/** WHAT THE RUNTIME MADE OF THE SUPPLIER'S LIST — the four postures, and the rows they land.
 *  The read is held ONCE per source (`useExtraction`'s keyed store), and the rows reach the review
 *  queue through this seat's own effect rather than through a press: a supplier list has no
 *  quantities to correct first, so the reviewed queue below IS the proposal, with every row
 *  editable and nothing committed until «I reviewed the product names, codes and units.» */
function SupplierListReading({ source, onSheet }: {
  source: { name: string; type: string; size: number; url: string; file: File };
  onSheet: (sheet: Sheet | null) => void;
}) {
  const [, theme] = useStyletron();
  const { extraction, retry } = useExtraction(source.file, 'catalogue', source.name + ':' + String(source.size));
  const read = extraction?.state === 'read' ? extraction.result : undefined;
  React.useEffect(() => {
    if (!read) return;
    onSheet(read.rows.length ? parsedSheet(read, source.name, source.file) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the read is the event; onSheet is a setter
  }, [read, source.name, source.file]);
  if (!extraction) return null;
  const handedBack = extraction.state !== 'reading' && !read?.rows.length;
  const picture = source.type.startsWith('image/');
  return (
    <section role="status" data-testid="catalogue-photo-pending" data-state={extraction.state} data-rows={String(read?.rows.length ?? 0)} data-provider="parsewise"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, background: theme.colors.backgroundPrimary, minWidth: 0 }}>
      <span style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
        {picture
          ? <img data-testid="catalogue-photo-preview" src={source.url} alt="Supplier list selected for this review" style={{ display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary, outline: `1px solid ${theme.colors.borderOpaque}`, outlineOffset: '-1px' }} />
          : <span data-testid="catalogue-photo-preview" style={{ display: 'grid', placeItems: 'center', width: '100%', aspectRatio: '1 / 1', borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary }}><Glyph id="file" size={STEP.medium} /></span>}
        <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelSmall, display: 'block', overflowWrap: 'anywhere' }}>{source.name}</span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Kept only in this open review</span>
        </span>
      </span>
      <span data-testid="catalogue-reading-state" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
        {readingSentence(extraction, EXTRACTION_COPY.fallback, handedBack)}
      </span>
      {(extraction.state === 'unreachable' || extraction.state === 'unavailable') && (
        <span><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="catalogue-reading-retry" onClick={retry} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>{EXTRACTION_COPY.retry}</Button></span>
      )}
    </section>
  );
}

/* ── THE DROP SEAT ────────────────────────────────────────────────────────────────────────────
 * A drop zone that cannot be clicked is a dead end on a trackpad, so the seat is a BUTTON that
 * also takes a drop — one target, two hands. It reads the file in the page; nothing is uploaded,
 * and nothing is stated about the rows until the parse comes back with them.
 */
function importIssues(sheet: Sheet, row: Sheet['rows'][number]): string[] {
  const issues: string[] = [];
  if (!row.name.trim()) issues.push('Product name');
  if (!row.code?.trim()) issues.push('Code');
  if (!row.unit.trim()) issues.push('Unit');
  const code = row.code?.trim().toLocaleLowerCase();
  if (code && sheet.rows.some((other) => other.sourceRow !== row.sourceRow && other.code?.trim().toLocaleLowerCase() === code)) issues.push('Duplicate code');
  return issues;
}

const csvCell = (value: string): string => /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const normalisePastedCatalogue = (value: string): string => value
  .split(/\r?\n/)
  .map((line) => line.includes('\t') ? line.split('\t').map((cell) => csvCell(cell.trim())).join(',') : line)
  .join('\n');

async function workbookText(file: File): Promise<string> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer() as never);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return '';
  const lines: string[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let column = 1; column <= Math.max(worksheet.columnCount, row.cellCount); column += 1) cells.push(row.getCell(column).text.trim());
    lines.push(cells.map(csvCell).join(','));
  });
  return lines.join('\n');
}

/* One calm source surface. A file and a paste enter the same review queue; neither path asks the
   person to map a database before they can see what Rocoto read. */
function DropSeat({ sheet, onSheet, inclusion, onInclusion }: {
  sheet: Sheet | null; onSheet: (s: Sheet | null) => void;
  inclusion: Record<number, boolean>; onInclusion: (sourceRow: number, included: boolean) => void;
}) {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const [over, setOver] = React.useState(false);
  const [paste, setPaste] = React.useState('');
  const [reading, setReading] = React.useState(false);
  const [issue, setIssue] = React.useState('');
  const [editing, setEditing] = React.useState<number | null>(null);
  /* THE HELD SOURCE KEEPS ITS BYTES as well as its preview, because §196.5 sends the source to the
     runtime for extraction and a blob URL is not a source. Session-only, exactly as before: nothing
     here is written to storage (SRC-PRIV-01). */
  const [source, setSource] = React.useState<{ name: string; type: string; size: number; url: string; file: File } | null>(null);
  const field = React.useRef<HTMLInputElement>(null);
  const camera = React.useRef<HTMLInputElement>(null);
  const pasteField = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);
  const hold = (file: File) => {
    setSource((held) => {
      if (held) URL.revokeObjectURL(held.url);
      return { name: file.name || 'Supplier list', type: file.type || 'application/octet-stream', size: file.size, url: URL.createObjectURL(file), file };
    });
    setIssue(''); setEditing(null); onSheet(null);
  };
  const release = () => {
    setSource((held) => { if (held) URL.revokeObjectURL(held.url); return null; });
    onSheet(null); setIssue('');
  };

  /* PAR-01 · WHICH READER READS IT. A source that already HAS rows is read EXACTLY, here — a CSV,
     a TSV, a text export, and an .xlsx the browser opens with ExcelJS, because an exact reading
     beats a probabilistic one and costs nothing. A photograph, a scan or a PDF has no rows to
     read, only layout: those are HELD and go to Parsewise as `kind=catalogue` (E200.08). */
  const read = async (file?: File | null) => {
    if (!file) return;
    const lower = file.name.toLocaleLowerCase();
    const workbook = lower.endsWith('.xlsx') || lower.endsWith('.xls');
    if (!workbook && !isTextTable(file, file.name) && isExtractable(file, file.name)) { setPaste(''); hold(file); return; }
    release();
    setReading(true); setIssue(''); setEditing(null);
    try {
      const text = workbook ? await workbookText(file) : await file.text();
      const next = parseSheet(text, file.name, file);
      onSheet(next);
      if (!next.rows.length) setIssue('This file read as empty. Try another file or paste the list.');
      setPaste('');
    } catch {
      setIssue('Reading this file stalled. Try another Excel or CSV file, or paste the product list.');
    } finally { setReading(false); }
  };
  const reviewPaste = () => {
    const next = parseSheet(normalisePastedCatalogue(paste), 'Pasted product list');
    onSheet(next); setEditing(null); setIssue(next.rows.length ? '' : 'That text read as empty.');
  };
  const changeRow = (row: Sheet['rows'][number], key: 'name' | 'code' | 'unit', value: string) => {
    if (!sheet) return;
    const nextId = key === 'code' && value.trim() ? skuIdentity(value) : row.id;
    onSheet({
      ...sheet,
      rows: sheet.rows.map((current) => current.sourceRow === row.sourceRow ? { ...current, id: nextId, [key]: value } : current),
      sourceRows: sheet.sourceRows.map((current) => current.sourceRow === row.sourceRow ? { ...current, id: nextId } : current),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {/* ── «UPLOAD A SUPPLIER LIST» (E200.08 · §196.5) ────────────────────────────────────
          The heading NAMES what the three doors below are for, and the doors are the albarán
          road's own grammar — Take photo · Upload file · Paste, one shape wherever a document
          enters the house. The drop seat still takes a drop, because a desk hand drags a file
          onto a page before it hunts for a button. */}
      <div data-testid="catalogue-intake-sources" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <div
          data-testid="csv-drop"
          data-over={over ? 'yes' : 'no'}
          onDragOver={(event) => { event.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => { event.preventDefault(); setOver(false); void read(event.dataTransfer.files?.[0]); }}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, padding: theme.sizing.scale600, border: `2px dashed ${over ? theme.colors.contentPrimary : theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, background: over ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary, minWidth: 0 }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
            <span style={theme.typography.LabelMedium}>Upload a supplier list</span>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>A photo, a PDF, Excel or CSV. Every product waits in a review you walk before it joins the catalogue.</span>
          </span>
          <DoorGrid testid="catalogue-doors">
            <SourceButton icon="camera" testid="catalogue-take-photo" onClick={() => camera.current?.click()}>Take photo</SourceButton>
            <SourceButton icon="file" testid="catalogue-upload" onClick={() => field.current?.click()}>Upload file</SourceButton>
            <SourceButton icon="note" testid="catalogue-paste-door" onClick={() => pasteField.current?.focus()}>Paste</SourceButton>
          </DoorGrid>
          <input ref={field} type="file" accept={PARSE_ACCEPT} data-testid="csv-field" onChange={(event) => { void read(event.target.files?.[0]); event.target.value = ''; }} style={{ display: 'none' }} />
          <input ref={camera} hidden type="file" accept="image/*" capture="environment" data-testid="catalogue-camera-field" onChange={(event) => { void read(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
          {reading && <span role="status" data-testid="catalogue-file-reading" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{EXTRACTION_COPY.reading}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, padding: theme.sizing.scale600, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, minWidth: 0 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, ...theme.typography.LabelMedium }}>
            Paste a product list
            <Textarea inputRef={pasteField} value={paste} aria-label="Paste a product list" placeholder={'Product name    Code    Unit'} onChange={(event) => setPaste(event.currentTarget.value)} overrides={{ Input: { props: { 'data-testid': 'catalogue-paste' }, style: { minHeight: '88px', resize: 'vertical' } } }} />
          </label>
          <span><Button kind={KIND.secondary} size={SIZE.compact} data-testid="catalogue-paste-review" disabled={!paste.trim()} onClick={reviewPaste}>Review paste</Button></span>
        </div>
      </div>
      {issue && <span role="alert" data-testid="catalogue-source-issue" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{issue}</span>}
      {/* ALIGN TO THE SHARED EDGES. The read stands on the same left and right as the doors above
          it and the review queue below it; a card that shrank to its own text put a third edge on
          the column (better-layout). */}
      {source && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: theme.sizing.scale300, minWidth: 0 }}>
        <SupplierListReading source={source} onSheet={onSheet} />
        <span><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="catalogue-photo-remove" onClick={release} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Remove</Button></span>
      </div>}
      {sheet && sheet.rows.length > 0 && (
        <section data-testid="csv-read" data-rows={sheet.rows.length} data-source={sheet.file} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
            <span style={theme.typography.LabelMedium}>Processed readback</span>
            <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>{sheet.rows.length} {sheet.rows.length === 1 ? 'product' : 'products'} · {sheet.rows.filter((row) => importIssues(sheet, row).length).length} identity checks</span>
          </header>
          <span data-testid="catalogue-raw-source" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Raw source retained for this session · {sheet.file} · {sheet.sourceRows.length} source rows</span>
          {sheet.rows.some((row) => !row.unit.trim()) && <span data-testid="csv-needs-unit" style={{ display: 'none' }}>{sheet.rows.filter((row) => !row.unit.trim()).length}</span>}
          <div data-testid="catalogue-review-queue" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, padding: theme.sizing.scale100, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, background: theme.colors.backgroundPrimary, minWidth: 0 }}>
            {sheet.rows.map((row) => {
              const rowIssues = importIssues(sheet, row);
              const open = editing === row.sourceRow;
              const included = inclusion[row.sourceRow] !== false;
              return <div key={`${row.id}:${row.sourceRow}`} className={css({
                transitionProperty: 'background-color, border-color, box-shadow',
                transitionDuration: theme.animation.timing400,
                transitionTimingFunction: theme.animation.easeOutCurve,
                ':hover': { backgroundColor: theme.colors.backgroundSecondary },
                ':focus-within': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderOpaque, boxShadow: `0 6px 16px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)` },
              })} data-testid="catalogue-review-row" data-list-card="inset" data-product={row.id} data-review={included && rowIssues.length ? 'needed' : 'ready'} data-include={included ? 'yes' : 'no'} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, width: `calc(100% - ${theme.sizing.scale400})`, boxSizing: 'border-box', margin: `${theme.sizing.scale100} ${theme.sizing.scale200}`, padding: theme.sizing.scale500, border: `1px solid ${open ? theme.colors.borderOpaque : 'transparent'}`, borderRadius: theme.borders.radius300, background: open ? theme.colors.backgroundSecondary : 'transparent', minWidth: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: phone ? '32px minmax(0, 1fr)' : '32px minmax(0, 1fr) auto', gap: theme.sizing.scale300, alignItems: 'center', minWidth: 0 }}>
                  <ProductFace of={{ name: row.name || 'Product' }} size={32} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
                    <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>{row.name || 'Product name needed'}</span>
                    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}><ProductCode code={row.code} /> · {row.unit ? `Unit ${row.unit}` : 'Unit needs review'}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale100, flexWrap: 'wrap', justifyContent: phone ? 'flex-start' : 'flex-end', ...(phone ? { gridColumn: '2' } : {}) }}>
                    <Button kind={KIND.tertiary} size={SIZE.mini} aria-expanded={open} onClick={() => setEditing(open ? null : row.sourceRow)}>{open ? 'Done' : 'Edit'}</Button>
                    <Button kind={included ? KIND.secondary : KIND.tertiary} size={SIZE.mini} data-testid={`catalogue-include-${row.sourceRow}`} aria-pressed={included} onClick={() => onInclusion(row.sourceRow, true)}>Include</Button>
                    <Button kind={!included ? KIND.secondary : KIND.tertiary} size={SIZE.mini} data-testid={`catalogue-skip-${row.sourceRow}`} aria-pressed={!included} onClick={() => onInclusion(row.sourceRow, false)}>Skip</Button>
                  </span>
                </div>
                {open && <div data-testid="catalogue-review-editor" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: theme.sizing.scale400, paddingTop: theme.sizing.scale300, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
                  <label style={theme.typography.LabelSmall}>Product name<Input size={INPUT_SIZE.compact} value={row.name} aria-label={`Product name row ${row.sourceRow}`} onChange={(event) => changeRow(row, 'name', event.currentTarget.value)} /></label>
                  <label style={theme.typography.LabelSmall}>Code<Input size={INPUT_SIZE.compact} value={row.code ?? ''} aria-label={`Code row ${row.sourceRow}`} onChange={(event) => changeRow(row, 'code', event.currentTarget.value)} /></label>
                  <label style={theme.typography.LabelSmall}>Unit<Input size={INPUT_SIZE.compact} value={row.unit} aria-label={`Unit row ${row.sourceRow}`} onChange={(event) => changeRow(row, 'unit', event.currentTarget.value)} /></label>
                </div>}
              </div>;
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── THE INTAKE, ONE ORGAN (FEED-IA §64.2 · THE-DATA-CANON §4.1 — AUDIT-2 C4) ─────────────────
 * «Product upload is available FROM Stock itself, obviously — where the catalog lives — feeding
 * the same hydration moment: ACCEPTED PRODUCTS VISIBLY FILL THE REGISTER. One intake organ, two
 * doors.»
 *
 * WHAT WAS HERE, AND WHY IT WENT. The upload door mounted `Hydration` — the DATA seat's organ,
 * which reads a year of albaranes and flips an import flag. Driven with a real catalogue file it
 * reported «Read 77.363 albaranes across 2.667 customers · Grounded 214 items onto the produce
 * tree» while the register behind the scrim stayed byte-identical at «Catalogue 12 · 12 products»
 * — a claim of a fill that never happened, made behind a modal that hid the thing it was claiming
 * about. Two laws at once: §64.2's own binding clause, and the door speaking the other door's
 * script rather than the words of the place it stands in.
 *
 * SO THE ORGAN IS THIS, AND BOTH OF STOCK'S DOORS ARE IT: the drop seat that reads the file in the
 * page, the rows it actually found, and ONE act that puts them on the shelves. `Hydration` keeps
 * the door it was built for — the history, at «Tus datos» — and the two organs are now told apart
 * by what they take rather than by which button opened them.
 *
 * AND THE CLAIM IS MADE BY THE REGISTER. Pressing the act mints, closes the card, and leaves the
 * catalogue standing with the new rows in it and its own head counting them; the delta rides the
 * list itself (see `FILLED` on the page below). Nothing states a fill from on top of a scrim.
 */
export function CatalogueIntake({
  testid,
  onPut,
  initialSheet,
}: {
  testid: string;
  /** the rows the file really carried, and the file they came out of */
  onPut: (sheet: Sheet) => void | Promise<void>;
  initialSheet?: Sheet;
}) {
  const [, theme] = useStyletron();
  const [sheet, setSheet] = React.useState<Sheet | null>(initialSheet ?? null);
  const [inclusion, setInclusion] = React.useState<Record<number, boolean>>({});
  const [readbackConfirmed, setReadbackConfirmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const includedRows = sheet?.rows.filter((row) => inclusion[row.sourceRow] !== false) ?? [];
  const reviewCount = sheet ? includedRows.filter((row) => importIssues(sheet, row).length).length : 0;
  const replaceSheet = (next: Sheet | null) => { setSheet(next); setInclusion({}); setReadbackConfirmed(false); };
  const chooseInclusion = (sourceRow: number, included: boolean) => {
    setInclusion((current) => ({ ...current, [sourceRow]: included }));
    setReadbackConfirmed(false);
  };

  return (
    <div data-testid={testid} style={{ display: 'contents' }}>
      <DropSeat sheet={sheet} onSheet={replaceSheet} inclusion={inclusion} onInclusion={chooseInclusion} />
      {error && <p role="alert" data-testid="catalogue-save-error">{error}</p>}
      {sheet && sheet.rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div data-testid="catalogue-readback-confirmation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'flex-start', gap: theme.sizing.scale200, ...theme.typography.ParagraphSmall }}>
              <input type="checkbox" data-testid="catalogue-readback-confirmed" checked={readbackConfirmed} onChange={(event) => setReadbackConfirmed(event.currentTarget.checked)} />
              <span>I reviewed the product names, codes and units.</span>
            </label>
            {!readbackConfirmed && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Confirm the readback before adding products.</span>}
            {readbackConfirmed && <span data-testid="catalogue-commit-count" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Add will commit {includedRows.length} included {includedRows.length === 1 ? 'product' : 'products'}.</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            {reviewCount > 0 && <span data-testid="catalogue-review-blocked">Review {reviewCount} {reviewCount === 1 ? 'product' : 'products'} before adding them.</span>}
            {includedRows.length === 0 && <span data-testid="catalogue-include-blocked">Include at least one product before adding.</span>}
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              data-testid="csv-import"
              disabled={busy || includedRows.length === 0 || reviewCount > 0 || !readbackConfirmed}
              isLoading={busy}
              onClick={async () => {
                setBusy(true); setError('');
                try { await onPut({ ...sheet, rows: includedRows }); }
                catch (e) { setError((e as Error).message || 'The import stalled. Your file is still here; try again.'); }
                finally { setBusy(false); }
              }}
            >
              Add {includedRows.length} included {includedRows.length === 1 ? 'product' : 'products'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── THEIR SENTENCE, MINUS HOW MUCH OF IT (FEED-IA §62.2 · §41.5) ─────────────────────────────
 * «The title carries the whole phrase: class, packaging, prep style typed straight into the
 * title.» — and since §197.2 that is the WHOLE of where a grade word goes: it is one of theirs,
 * in the title, with the rest. So every part of what they wrote IS the product's name, except the amount and the
 * measure that amount is in — those say how much, not what. Read off the chips in WRITING ORDER,
 * so the house's own word order survives the trip (§65.3: their structure stays theirs).
 */
const goodsOf = (read: ChipLine | null): string =>
  (read?.chips ?? [])
    .filter((c) => c.part !== 'quantity' && c.part !== 'unit')
    .map((c) => c.said)
    .join(' ')
    .trim();


/* ── THE PAGE ─────────────────────────────────────────────────────────────────────────────── */

/** Where a door came from, so a document opened out of the lot book closes back INTO it rather
 *  than dropping the reader onto the page they were two steps away from. */
type Door =
  | { kind: 'update' }
  | { kind: 'product' }
  /** §64: the second door onto the ONE intake organ — a catalogue file, dropped where the
   *  catalogue lives */
  | { kind: 'upload' }
  | { kind: 'catalogue-export' }
  /** §75.6 / C6: add a member to a family, from the list or from the product's own sheet */
  | { kind: 'vary'; base: Product }
  | { kind: 'book'; product: string }
  /** `from` is the box the chip stood in, so the document GROWS OUT OF IT (musing 12's morph) */
  | { kind: 'file'; file: IncomingFile; back: Door; from?: Box }
  | null;

/** what the back bar calls the place a document came out of. It names the LIST, never the act, so
 *  the way back reads as the thing the reader will land in. */
const backLabel = (back: Door): string => (back?.kind === 'book' ? 'The lotes' : 'Products');

/** Supplier messages open inside Stock update; Stock itself has one catalogue seat. */
const FILE_ACTS = [
  { id: 'catalogue-export', label: 'Export catalogue' },
];

/* ═══ THE CATALOGUE'S OWN WORD, AS §62'S ORGAN (§35.1 · §62.4 — AUDIT-2 C26) ══════════════════
 * «ONE shared organ, reused everywhere — the sheet's add-a-line, the New Product modal, THE
 * CATALOG'S SEARCH.» Two of the three had it. This is the third.
 *
 * §35.1'S SEAT IS KEPT WHOLE: the word is quiet until it is used — a mark on the bar, and nothing
 * else — because a toolbar with a permanent field in it is a toolbar that has decided searching is
 * the main event. What the mark OPENS is the difference: it used to be a plain input whose every
 * term had to appear in a row's own characters, and it is now the chip organ, so the register is
 * asked the same way an albarán's line is asked.
 *
 * ═══ AND WHERE THE ORGAN OPENS MOVED (FEED-IA §91.2, 2026-08-29) ════════════════════════════
 * «I think all search should be like this in fact. Makes search VERY simple, or rather very
 * consistent.» So the organ no longer takes a line of its own under this bar; it opens in THE ONE
 * SEARCH MODAL, in the seat at the head of that box, with the catalogue's matching goods listed
 * under it as doors to their own sheets — which is a thing the inline seat never had.
 *
 * ┌─ REST ────────────────────────┐   ┌─ THE ONE BOX, CENTRED ─────────────────────────────────┐
 * │ … the bar's acts …       [🔍] │   │ [🐟] merluza · sin cabeza · congelada ▎                │
 * └───────────────────────────────┘   │ ─────────────────────────────────────────────────────  │
 *                                     │ Goods                                                  │
 *                                     │ ▣  Merluza sin cabeza            Pescado fresco        │
 *                                     └────────────────────────────────────────────────────────┘
 *
 * THE ORGAN IS THE SAME ORGAN AND THE SURFACE STILL OWNS IT. The seat declares it as its FIELD,
 * so §62's parse, its face, its chips and its suggestion shelf all cross into the box unchanged —
 * and the catalogue behind still narrows on every keystroke, because what the organ reads back is
 * still read back to this surface. What changed is where the caret is, and that it is now in the
 * same place on every surface in the app.
 *
 * ESCAPE CLOSES THE BOX, and on a written word the organ's own Escape takes the suggestions first
 * — the innermost thing first, which is §35.1's own chain, one layer further in.
 */
function WordSeat({
  registers,
  sector,
  query,
  onRead,
  phone,
}: {
  registers: ChipRegisters;
  sector: SectorId;
  /** what the organ has read back, so the control can say which word is standing */
  query: string;
  onRead: (line: ChipLine | null) => void;
  phone: boolean;
}) {
  /* THE SEAT, DECLARED (§91.2). The intent says which list the box draws — the goods — and the
     field says that this surface's own field comes with it. `commit` is the box's: ↵ inside the
     organ seals a chip when one is walked and otherwise opens the row the walk is standing on, so
     the keyboard reads the same in here as it does in the plain field. */
  useSearchSeat({
    intent: 'products',
    query,
    onQuery: (next) => {
      /* a word cleared from outside the organ clears the reading with it — the surface may never
         hold chips belonging to a sentence nobody is standing in any more */
      if (next.trim().length === 0) onRead(null);
    },
    label: 'Find a product',
    field: ({ commit }) => (
      <div data-testid="stock-search-open" data-search={query} style={{ minWidth: 0 }}>
        <ChipEntry
          registers={registers}
          family={familyMarkOf(sector)}
          autoFocus
          initial={query}
          label="Find a product"
          placeholder={phone ? 'merluza sin cabeza' : 'merluza sin cabeza congelada'}
          data-testid="stock-word"
          onChange={onRead}
          onCommit={commit}
        />
      </div>
    ),
  });

  return (
    <SearchSummon
      intent="products"
      label="Find a product"
      testid="stock-search"
      query={query}
      onRelease={() => onRead(null)}
    />
  );
}

/* ── THE PANE'S OWN HEIGHT ON A PHONE (FEED-IA §38, §51.17) ───────────────────────────────────
 * On a desk the FRAME hands this surface a box of exactly the right height and the panes simply
 * fill it. A phone keeps the push model and the frame keeps scrolling, so there the pane is as
 * tall as what is left of the screen under the chrome — measured, never typed, because the chrome
 * moves when the face lands and the bottom row stands over the page.
 *
 * ═══ AND IT MUST RE-MEASURE WHEN THE CHROME MOVES ══════════════════════════════════════════
 * «I can scroll on the entire thing» (§51.17). This hook read the pane's top ONCE and on resize,
 * and the bar above it is not a fixed height: at 390 the catalogue's seat row, its two acts and
 * the word wrap onto a second line, while the feed's bar is one line. So the pane was sized
 * against a 40px bar and then stood under an 84px one — 33px taller than what was left of the
 * screen, which is a PAGE that scrolls 33px while the pane inside it scrolls 797. Two scrolls,
 * measured, and the double is the exact thing §38 exists to forbid.
 *
 * The fix is to watch the thing that decides the answer. A ResizeObserver on the bar above (and on
 * the box this pane stands in) re-reads whenever the chrome changes shape — a seat switch, a wrap
 * after the face lands, a rotation. The pane ITSELF is never observed: this hook sets its height,
 * so observing it would be a loop.
 */

/* ── WHAT STANDS UNDER THE PANE, READ OFF THE BOXES THAT MAKE IT (§51.17 — AUDIT-2 C38) ───────
 * The chrome below is the page's own foot and the row the thumb rests on, and it has to be read
 * from THOSE — never from «the document's height less the pane's own bottom», which counts the
 * space the pane is not occupying as if it were furniture. That reading is stable exactly while
 * the pane fills the screen, and the moment the bar above it changes height — the catalogue's
 * word opening and closing, which is a thing that happens now — it absorbs the whole change and
 * hands back the height the pane already had. Measured: opening the word once cost the register
 * 109px for the rest of the session.
 *
 * So this walks up from the pane and adds what is genuinely underneath it: each ancestor's bottom
 * padding, and anything standing after it IN THE FLOW. Layers are skipped by construction — an
 * overlay is `fixed` or `absolute` and takes no room in the column it is drawn over.
 */
function chromeBelow(node: HTMLElement): number {
  let total = 0;
  let child: HTMLElement = node;
  let at: HTMLElement | null = node.parentElement;
  while (at && at !== document.documentElement) {
    const cs = window.getComputedStyle(at);
    total += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.marginBottom) || 0);
    for (let sib = child.nextElementSibling; sib; sib = sib.nextElementSibling) {
      const style = window.getComputedStyle(sib);
      if (style.position !== 'static' && style.position !== 'relative') continue;
      if (style.display === 'none') continue;
      total += sib.getBoundingClientRect().height;
    }
    child = at;
    at = at.parentElement;
  }
  return Math.round(total);
}

function usePaneHeight(phone: boolean): [React.RefObject<HTMLDivElement>, number] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!phone) return;
    const node = ref.current;
    if (!node) return;
    let alive = true;
    const read = () => {
      if (!alive || !ref.current) return;
      const top = ref.current.getBoundingClientRect().top;
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
      setHeight(Math.max(0, Math.floor(bottom - top - chromeBelow(ref.current))));
    };
    read();
    const frame = window.requestAnimationFrame(read);
    const observer = new ResizeObserver(read);
    if (node.previousElementSibling) observer.observe(node.previousElementSibling);
    window.addEventListener('resize', read);
    window.visualViewport?.addEventListener('resize', read);
    document.fonts?.ready.then(read).catch(() => {});
    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener('resize', read);
    };
  }, [phone]);
  /* Descendant overflow while a sheet mounts is not chrome. Trimming against document.scrollHeight
   * shrank this pane to 420px and never returned the unused space below it. Its viewport, actual
   * top and real footer are the complete inputs; the pane owns scrolling inside that box. */
  return [ref, height];
}

/** The height of one element, watched — what a sticky floor inside a pane parks under. */
function useOwnHeight(): [React.RefObject<HTMLElement>, number] {
  const ref = React.useRef<HTMLElement>(null);
  const [height, setHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setHeight(Math.round(el.getBoundingClientRect().height));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    document.fonts?.ready.then(read).catch(() => {});
    return () => observer.disconnect();
  }, []);
  return [ref, height];
}

export default function Stock() {
  const [css, theme] = useStyletron();
  const phone = usePhone();
  const { pricing, inventory } = useWorkspaceCapabilities();
  const pricingAvailable = capabilityAvailable('pricing') && pricing;
  const inventoryAvailable = capabilityAvailable('inventory') && inventory;
  const supplierIntakeAvailable = capabilityAvailable('supplierIntake');
  const { config, derived } = useConfig();
  const cast = derived.cast;
  const rules = useRules();
  const declared = useDeclared(cast.sector);
  const catalogue = useCatalogue();
  const skuRecords = useSKURecords();
  const [showArchived, setShowArchived] = React.useState(false);
  /* Product Sheet prices and price-entry targets share this live tariff subscription. */
  const tiersLog = useTiers().log;
  /* ── THE SURFACE IS PANES (FEED-IA §38) ────────────────────────────────────────────────────
     «Full-height panes with one scrollport each; the page never scrolls.» The frame stops being a
     scrolling page for as long as this surface is standing: no gutter of its own, no reading
     clamp, the whole width and the whole height under the chrome. The panes below carry their own
     gutters inside their own scrollports, and the frame takes the posture back on the way out. */
  /* ── AND THIS SURFACE DRAWS ITS PANES AT EVERY WIDTH (§38 · §83.3's foot) ──────────────────
     `stock-panes` and the sticky price bar stand at 390 as well as at 1600 — the register is its
     own scrollport on a handset and its own bar reserves the launcher's corner at the foot of it
     (AUDIT-2 C38). So the ask is `true`: the frame still refuses the two-column POSTURE below the
     breakpoint, and now it also stops reserving a foot this surface has already reserved. */
  usePanes(true);

  /* ── ONE PANE AT A TIME BELOW THE STACKED RUNG (FEED-IA §103) ──────────────────────────────
     `usePushed` is the phone AND the stacked desk: both stand the master and the detail one at a
     time, so both need the sheet's own way back. The desk keeps everything else it is. */
  const pushed = usePushed();

  /* THE CLOCK IS TAKEN ONCE, AND IT IS THE HOUSE'S (the acceptance walk, P1-10). Every derivation
     on this surface is a function of it — which day a row lands on, what a rule has emitted, what a
     synthesised code reads — so a fresh `new Date()` per render would make the ledger re-derive
     under the reader.
     ⚠ AND THE READER'S OWN CLOCK IS NOT THE HOUSE'S. It used to be, and the walk read the
     consequence off the Stock update card: «As of 29 ago, 13:52» inside a house whose day is
     Friday 22.08, with Rocoto suggesting the lote «L-PR2908» beside lotes that all read 22.08.
     One number on the surface belonged to nobody in the world the app was showing. The house's own
     moment is its day at the hour its morning is standing in — the same pair every other surface in
     this app reads (`todayId` · `nowOf`) — so a code minted here matches the codes already on the
     floor and «Today» means the day the rest of the app is having. */
  const [now] = React.useState(() => houseNow(cast));

  const [door, setDoor] = React.useState<Door>(null);
  const workflowHeight = useWorkflowViewport(
    door?.kind === 'upload' || door?.kind === 'catalogue-export' || (door?.kind === 'update' && inventoryAvailable),
  );
  const workflowPlacement = useWorkflowPlacement();
  useStockUpdateReturn(() => { if (inventoryAvailable) setDoor({ kind: 'update' }); });
  /* Supplier email is intake evidence inside Stock update, never a parallel Stock screen. */
  /* THE OPEN MAIL IS HELD HERE, not inside the inbox, because the document opens OVER the list it
     was opened from: the panel unmounts while the file has the layer, and a row that had to be
     found again on the way back would make the morph a round trip instead of a step. */
  const [openMail, setOpenMail] = React.useState<string | null>(null);
  const [mailOrigin, setMailOrigin] = React.useState<string | null>(null);
  const utilityKind = door?.kind === 'upload' ? 'product' : door?.kind;
  const utilityDoors = ['product', 'catalogue-export', ...(inventoryAvailable ? ['update'] : [])] as const;
  useHistoryLayer({ id: 'stock-utility', active: utilityDoors.includes(utilityKind as typeof utilityDoors[number]),
    snapshot: { kind: utilityKind ?? null }, onRestore: saved => {
      const next = String(saved?.kind);
      if (next === 'product' || next === 'catalogue-export' || (next === 'update' && inventoryAvailable)) setDoor({ kind: next as 'update' | 'product' | 'catalogue-export' });
      else { setDoor(null); setOpenMail(null); }
    } });
  useHistoryLayer({ id: 'stock-source', active: inventoryAvailable && supplierIntakeAvailable && door?.kind === 'update' && !!openMail,
    snapshot: { mail: openMail }, onRestore: saved => {
      setOpenMail(typeof saved?.mail === 'string' ? saved.mail : null);
      if (saved && inventoryAvailable && supplierIntakeAvailable) setDoor({ kind: 'update' });
    } });
  useHistoryLayer({ id: 'stock-upload', active: door?.kind === 'upload', snapshot: {},
    onRestore: saved => { if (saved) setDoor({ kind: 'upload' }); else setDoor(current => current?.kind === 'upload' ? { kind: 'product' } : current); } });

  const closeStockDoor = () => {
    setDoor(null);
    if (door?.kind === 'update' && window.location.hash.startsWith('#/stock/supplier-emails')) {
      setOpenMail(null);
      if (mailOrigin) openProduct(mailOrigin);
      else window.location.hash = '#/stock';
    }
  };

  const offList = OFF_LIST[cast.sector] ?? [];

  /* THE HOUSE'S DEMONSTRATION RULE, PLANTED BY WHOEVER ARRIVES FIRST. The register in Settings
     plants the same one; `seedRules` is guarded per catalogue so the second caller does nothing. */
  React.useEffect(() => {
    const first = cast.products[0];
    if (first) seedHouseRule({ sector: cast.sector, product: first.id, unit: first.unit, hour: cast.hour });
  }, [cast]);

  const grown = React.useMemo(
    () => grownProducts(cast, offList, catalogue.state),
    [cast, offList, catalogue.state],
  );

  const products = React.useMemo<Product[]>(() => [...cast.products, ...grown].map((p) => projectSKU(cast.sector, p, skuRecords)), [cast, grown, skuRecords]);
  /* Accepted literal one-offs are catalogue items in their own contained view. They are not
     Products, SKUs, imports or provisional requests. */
  const uncodedItems = useUncodedCatalogueItems(cast);
  const productRelations = useProductRelations();
  const [relatedItemId, setRelatedItemId] = React.useState<string | null>(null);
  const relatedItemOptions = React.useMemo(
    () => [...products, ...uncodedItems]
      .map((product) => {
        /* AN UNCODED ITEM SAYS WHAT IT IS, in the words the other two pickers already use for it
           (`uncoded-catalogue.tsx`). It is not a product with a code on its way — it is a literal
           request the house accepted, and it will never have one; «Code pending» would promise it
           a code that is not coming. */
        const label = 'code' in product ? codeText(product.code) : 'Uncoded item';
        return { id: product.id, label: `${product.name} · ${label} · ${product.unit || 'Unit needs review'}` };
      })
      .sort((left, right) => left.label.localeCompare(right.label, 'es', { sensitivity: 'base', numeric: true })),
    [products, uncodedItems],
  );
  React.useEffect(() => {
    setRelatedItemId((current) => current && [...products, ...uncodedItems].some((product) => product.id === current) ? current : null);
  }, [cast.sector, products, uncodedItems]);
  const relatedItemIds = React.useMemo(
    () => relatedItemId ? new Set([relatedItemId, ...allRelatedProductIds(cast.sector, relatedItemId, catalogue.state)]) : null,
    [cast.sector, relatedItemId, catalogue.state, productRelations],
  );
  const productOntology = useProductOntology();
  const groups = React.useMemo(() => {
    const fallback = groupsOf(cast, products, catalogue.state).map((group) => ({ ...group, members: [...group.members] }));
    const saved = products.filter((product) => placementFor(cast.sector, product).saved);
    if (!saved.length) return fallback;
    const savedIds = new Set(saved.map((product) => product.id));
    const visibleFallback = fallback.map((group) => ({ ...group, members: group.members.filter((product) => !savedIds.has(product.id)) })).filter((group) => group.members.length);
    const tenantGroups = new Map<string, Group>();
    for (const product of saved) {
      const placement = placementFor(cast.sector, product);
      const key = `tenant-category:${placement.category.id}`;
      const group: Group = tenantGroups.get(key) ?? { shelf: key, name: placement.category.name, guessed: false, collapsed: [], members: [] };
      group.members.push(product); tenantGroups.set(key, group);
    }
    return [...visibleFallback, ...tenantGroups.values()];
  }, [cast, products, catalogue.state, productOntology]);

  /* ── THE WORD, OVER THE WHOLE CATALOGUE (FEED-IA §35.1 · §62.4 — AUDIT-2 C26) ────────────────
   * «Filter-as-you-type in products», and «ONE shared organ, reused everywhere — the sheet's
   * add-a-line, the New Product modal, THE CATALOG'S SEARCH.»
   *
   * WHAT DIED HERE, AND WHY. The word was a naive substring match with every term ANDed over a
   * row's own characters, so the trade's own sentence killed it: «merluza sin cabeza congelada»
   * — a Merluza family, a «sin cabeza» member and a «congelada» member all in the register —
   * returned «0 products». Three words, each of them real, and nothing on the screen.
   *
   * SO THE WORD IS A READING NOW. The seat opens `ChipEntry`, the sentence parses into chips as
   * it is typed, and the chips narrow the list one at a time in writing order (`narrow` below).
   * A chip that would empty the list is HELD rather than applied, and the surface says what the
   * register does hold for it — which is the same sentence answered honestly instead of refused.
   */
  const [query, setQuery] = React.useState('');
  const [read, setRead] = React.useState<ChipLine | null>(null);
  /* The tenant sequence is the normal view; category and A–Z are explicit lookup sorts. */
  const [catalogueView, setCatalogueView] = React.useState<CatalogueView>('source');
  const [catalogueScope, setCatalogueScope] = React.useState<'skus' | 'uncoded'>('skus');
  const terms = React.useMemo(() => termsOf(query), [query]);
  const shownUncodedItems = React.useMemo(() => {
    const literal = query.trim().toLocaleLowerCase();
    const filtered = uncodedItems.filter((item) => {
      if (relatedItemIds && !relatedItemIds.has(item.id)) return false;
      return !literal || item.name.toLocaleLowerCase().includes(literal) || item.unit.toLocaleLowerCase().includes(literal);
    });
    return catalogueView === 'alphabetical'
      ? [...filtered].sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base', numeric: true }))
      : filtered;
  }, [uncodedItems, query, relatedItemIds, catalogueView]);
  const searching = terms.length > 0;

  /* THE ORGAN HANDS BACK ONE READING AND THE SURFACE KEEPS BOTH HALVES: the chips, which narrow,
     and the sentence, which is what the empty state and the highlight quote back. Cleared, the
     seat closes itself. */
  const onRead = React.useCallback((line: ChipLine | null) => {
    setRead(line);
    setQuery(line?.said ?? '');
  }, []);

  /* ── THE REGISTERS §62'S PARSE NEEDS (chip-parse's `ChipRegisters`) ────────────────────────
     The sector and the containers off this house's own catalogue — memoised BY VALUE through
     `useChipRegisters`, which is the one memo every consumer of the organ goes through (see its
     note in `detail.tsx`: a fresh array on every call made a consumer that stored the reading
     rebuild the registers, which re-parsed, forever).
     Both of this surface's organs — the New Product door and the catalogue's word — take these.
     ⚠ THE GRADE REGISTER LEFT THIS CALL (FEED-IA §197.2 «Remove class everywhere», §193.4). */
  const registers = useChipRegisters({
    sector: cast.sector,
    containers: [...new Set(cast.products.map((p) => p.pack?.unit).filter((u): u is string => Boolean(u)))],
  });

  /* ── WHAT A FILE PUT ON THE SHELVES (FEED-IA §64.2 — AUDIT-2 C4) ───────────────────────────
     «Accepted products visibly fill the register.» So the act records the register's OWN size at
     the moment it was pressed, and the strip over the list reads today's size against it: the
     claim is a subtraction on the thing behind it rather than a sentence about a file. */
  const [filled, setFilled] = React.useState<{ from: number; file: string } | null>(null);

  /* the sector switch is a different house, so neither the word, nor an open door, nor the seat
     a person had walked to survives it */
  React.useEffect(() => {
    setDoor(null);
    setOpenMail(null);
    setQuery('');
    setRead(null);
    setCatalogueView('source');
    setCatalogueScope('skus');
    setShowArchived(false);
    setFilled(null);
    setPasting(null);
  }, [cast]);

  const ledger = React.useMemo(
    () => buildLedger({ cast, config, declared, rules: rules.rules, now }),
    [cast, config, declared, rules.rules, now],
  );

  const rowsFor = React.useCallback((id: string) => rowsOf(ledger, id), [ledger]);
  const lotsFor = React.useCallback(
    (id: string) => {
      const product = products.find((p) => p.id === id);
      return product ? lotBook(cast, product, rowsOf(ledger, id)) : [];
    },
    [cast, ledger, products],
  );

  /* ── THE SHELVES, WITH EVERY STRATUM FILED ONTO THEM (§37.5, §41.7) ──────────────────────── */
  const shelves = React.useMemo<Shelf[]>(() => {
    const out: Shelf[] = groups.map((g: Group) => ({
      shelf: g.shelf,
      name: g.name,
      guessed: g.guessed,
      said: g.said,
      face: g.members[0]?.name ?? g.name,
      members: g.members,
      kinds: [],
    }));

    const shelfFor = (node: string, name: string): Shelf => {
      const at = liftTo(node, HOUSE_RESOLUTION[cast.sector]);
      const held = out.find((s) => s.shelf === at);
      if (held) return held;
      const made: Shelf = {
        shelf: at,
        name: nameOfNode(at),
        guessed: true,
        face: name,
        members: [],
        kinds: [],
      };
      out.push(made);
      return made;
    };

    /* 1 · the SKUs, on the shelf the house keeps them at */
    for (const g of groups) {
      const shelf = out.find((s) => s.shelf === g.shelf && s.name === g.name);
      if (!shelf) continue;
      for (const product of g.members) {
        const node = groundOf(cast, product, catalogue.state).node;
        const placement = placementFor(cast.sector, product);
        file(shelf, placement.saved ? `tenant-family:${placement.family.id}` : node, { kind: 'product', id: product.id, name: product.name, product }, placement.saved ? placement.family.name : undefined);
      }
    }

    /* Provisional off-list requests remain on their Albarán. Only explicitly accepted one-offs
       enter the separate Uncoded items view derived from recorded sale evidence. */

    /* 3 · the words this house keeps adding to a product it already sells */
    for (const amendment of amendmentsOf(cast.sector, catalogue.state)) {
      const base = amendmentBase(cast, amendment);
      const node = groundOf(cast, base, catalogue.state).node;
      const shelf = out.find((s) => s.shelf === groundOf(cast, base, catalogue.state).shelf) ?? shelfFor(node, base.name);
      file(shelf, node, {
        kind: 'amendment',
        id: amendment.id,
        name: projectSKU(cast.sector, amendmentProduct(cast, amendment), skuRecords).name,
        amendment,
        base,
      });
    }

    /* 4 · the sorts the albaranes taught us, under the kind they hang from.
       §75.6 / C7: a sort is a MEMBER of its base's family — it carries the word it adds to the
       base's name, exactly as an amendment carries the word the traffic adds. The exemption this
       loop used to rely on («a name of its own on the ladder») is retired. */
    for (const sort of sortsOf(cast.sector, catalogue.state)) {
      const base = sortBase(cast, sort);
      const shelf = out.find((s) => s.shelf === groundOf(cast, base, catalogue.state).shelf) ?? shelfFor(sort.node, sort.name);
      file(shelf, sort.node, { kind: 'sort', id: sort.id, name: sort.name, sort, base, word: sortWord(base, sort) });
    }

    /* Keep each row's category/kind while filtering, but defer the visible family closure until
       after filtering. §148 makes name order global; category remains search and grounding data,
       rather than a wall that can put Merluza above Almeja. */
    for (const shelf of out) {
      shelf.kinds.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      for (const kind of shelf.kinds) kind.rows.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }

    return out.filter((s) => s.kinds.length > 0);
  }, [groups, cast, catalogue.state, offList, skuRecords]);

  /* ── §16.13 · THE HOUSE'S OWN OTHER WORDS FOR A ROW ───────────────────────────────────────
     «Search by product / SKU / alias.» The aliases are not authored anywhere: `knows.ts` builds
     the tree this house's orders actually land on, and each node carries the word a customer
     would say for it (`category`) and the same node inside a sentence (`phrase`). So a person who
     types what their own customers say finds the goods, and nothing had to be maintained for it
     to be true. Built once per house — folding three hundred rows on a keystroke is work nobody
     asked for (`search.ts`'s own note). */
  const aliasWordsFor = React.useMemo<(productId: string) => string[]>(() => {
    const byProduct = new Map<string, string[]>();
    for (const node of treeOf(cast)) {
      for (const id of node.products) {
        const held = byProduct.get(id) ?? [];
        held.push(node.name, node.phrase, node.category);
        byProduct.set(id, held);
      }
    }
    return (productId: string) => byProduct.get(productId) ?? [];
  }, [cast]);

  const aliases = React.useCallback<Aliases>(
    (row: Subject) => {
      const own = rowProduct(row);
      return own ? [...aliasWordsFor(own.id), ...(skuRecord(cast.sector, row.id, skuRecords)?.details.aliases.map((a) => a.name) ?? [])] : [];
    },
    [aliasWordsFor, skuRecords, cast.sector],
  );

  /* THE READING, APPLIED (AUDIT-2 C26). The chips narrow in writing order and the last reading the
     register can answer is what stands; a chip it cannot answer is held and named beside the list.
     A shelf that answers a chip on its own name keeps everything on it, which is `rowWords`
     carrying the shelf's word onto every row under it. */
  const { shown, held: heldWords } = React.useMemo<{ shown: Shelf[]; held: Chip[] }>(() => {
    if (!searching) return { shown: shelves, held: [] };
    /* THE CHIPS ARE THE FILTER, and their absence is the fallback: a reading that has yet to
       arrive (the very first keystroke) still narrows on the raw words, so the list never sits
       still while the parse catches up. */
    const chips = read && read.said.trim() === query.trim() ? read.chips : [];
    if (chips.length > 0) return narrow(shelves, chips, aliases);
    return {
      shown: shelves
        .map((s) => ({
          ...s,
          kinds: s.kinds
            .map((k) => ({ ...k, rows: k.rows.filter((r) => matches(terms, rowWords(s, k, r, aliases))) }))
            .filter((k) => k.rows.length > 0),
        }))
        .filter((s) => s.kinds.length > 0),
      held: [],
    };
  }, [shelves, terms, searching, read, query, aliases]);

  /* A Related items filter is a direct SKU-link view. It is intentionally applied after text
     search and before archive/view sorting, so Categories/A–Z remain only display choices. */
  const relationShown = React.useMemo<Shelf[]>(() => {
    if (!relatedItemIds) return shown;
    return shown
      .map((shelf) => ({
        ...shelf,
        kinds: shelf.kinds
          .map((kind) => ({ ...kind, rows: kind.rows.filter((row) => {
            const id = relatedItemIdOf(row);
            return !!id && relatedItemIds.has(id);
          }) }))
          .filter((kind) => kind.rows.length > 0),
      }))
      .filter((shelf) => shelf.kinds.length > 0);
  }, [shown, relatedItemIds]);

  /* ── WHAT A ROW PRICES (FEED-IA §75.6) ────────────────────────────────────────────────────
   * Every member carries a price, and a member is a thing you can write a number on — so it needs
   * a Product to be that number's subject. The base form's is the family's own; a word and a sort
   * take the product the graduation would make of them, which is the same goods more precisely
   * named. A family HEAD and an uncoded row price nothing, and answer null.
   * IT STANDS HERE, ABOVE THE RUNS, because §201 splits the list on what a row's code is and the
   * split has to happen before `flat` — the walk, the pager and the price run all read that. */
  const subjectProduct = React.useCallback(
    (row: Subject): Product | null => {
      if (row.kind === 'product' || row.kind === 'base') return row.product;
      if (row.kind === 'amendment') return amendmentProduct(cast, row.amendment);
      if (row.kind === 'sort') return sortProduct(cast, row.sort);
      return null;
    },
    [cast],
  );

  /* ── THE CODE A ROW STANDS UNDER (FEED-IA §200.1 · §201.1) ────────────────────────────────
   * The row's OWN record first, then the product beneath it. Both, and in that order, because a
   * code is given on the sheet and written to the record — and a member's product is minted fresh
   * from its family on every read (`amendmentProduct` sets `code: undefined` by construction), so
   * a reader that asked only the product would go on saying «Code pending» about a code somebody
   * typed a second ago. One reader, so the line the list PRINTS and the section the row LANDS IN
   * are the same fact and can never disagree.
   */
  const rowCode = React.useCallback(
    (row: Subject): string | undefined => {
      const own = row.kind === 'base' ? row.product.id : row.id;
      const written = skuRecord(cast.sector, own, skuRecords)?.details.code?.trim();
      if (written) return written;
      return subjectProduct(row)?.code?.trim() || undefined;
    },
    [cast.sector, skuRecords, subjectProduct],
  );

  /* The tenant/source sequence is the default because warehouse teams build muscle memory around
     the order of their own sheet. Internal category and A–Z are explicit display sorts only. */
  const ordered = React.useMemo<Shelf[]>(() => {
    const available = relationShown.map((shelf) => ({
      ...shelf,
      kinds: shelf.kinds.map((kind) => ({
        ...kind,
        rows: kind.rows.filter((row) => {
          const exactSKU = row.kind === 'product' || row.kind === 'base'
            || (row.kind === 'amendment' && (row.amendment.hand || row.amendment.sellable));
          if (!exactSKU) return false;
          const id = row.kind === 'base' ? row.product.id : row.id;
          return Boolean(skuRecord(cast.sector, id, skuRecords)?.details.archived) === showArchived;
        }),
      })).filter((kind) => kind.rows.length),
    })).filter((shelf) => shelf.kinds.length);
    if (catalogueView === 'categories') {
      /* THE FAMILY CLOSURE HAPPENS AFTER THE SPLIT (§201.1), not here. A family is closed against
         the rows of ONE run: close it before the split and a variation whose code is pending drags
         a head down to a single member — «Gamba roja de Palamós family» over one «Gamba roja de
         Palamós», which is §78.1's «one word paid for twice» exactly. Each run closes its own. */
      return [...available]
        .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }))
        .map((shelf) => ({
          ...shelf,
          kinds: [...shelf.kinds]
            .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })),
        }));
    }
    const rows = available.flatMap((shelf) => shelf.kinds.flatMap((kind) => kind.rows));
    if (catalogueView === 'alphabetical') {
      rows.sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base', numeric: true }) || left.id.localeCompare(right.id));
    } else {
      const source = new Map(products.map((item, index) => [item.id, index]));
      const encountered = new Map(rows.map((row, index) => [subjectKey(row), index]));
      const rank = (row: Subject) => {
        const exact = relatedItemIdOf(row);
        const family = familyRow(row);
        return exact && source.has(exact) ? source.get(exact)! : family && source.has(family.id) ? source.get(family.id)! : products.length + (encountered.get(subjectKey(row)) ?? 0);
      };
      rows.sort((left, right) => rank(left) - rank(right) || (encountered.get(subjectKey(left)) ?? 0) - (encountered.get(subjectKey(right)) ?? 0));
    }
    return [{
      shelf: 'catalogue',
      name: 'Catalogue',
      guessed: false,
      face: '',
      members: [],
      kinds: [{ node: 'catalogue', name: 'Catalogue', rows }],
    }];
  }, [relationShown, catalogueView, skuRecords, showArchived, cast.sector, products]);

  /* ── §201 · THE PRODUCTS WHOSE CODE IS PENDING STAND IN A SECTION OF THEIR OWN ────────────
   * Peter, 2026-09-04: «having something that doesn't have an SKU would need to put it in a
   * separate section. There should be a little line and then a section below that, so we don't
   * mix them in.»
   *
   * A code is the thing a person reads a row BY — off a shelf label, out of an ERP export, down a
   * column. Sprinkled through the coded run, a row that has none reads as a row whose code failed
   * to load, and a reader going down the column finds a hole in it every few lines. Held together
   * under one label they are a job: these are the products still to be given a code.
   *
   * THE SPLIT IS THE LAST THING DONE TO THE RUN, after search, after the related-items filter,
   * after archive and after the display sort — so both sections are the same list under the same
   * narrowing, and a word that matches one pending product shows the rule, the label and that one
   * row. Neither section is a second query.
   *
   * ORDER IS PRESERVED ON BOTH SIDES, so «sorted like the rest» is true by construction whichever
   * of source / category / A–Z is on, and a FAMILY travels whole: a member's code is its own, so a
   * pending member leaves its head behind and states its whole name at the list's own edge, which
   * is §65.4's orphan grammar already written.
   */
  const codePending = React.useCallback((row: Subject) => rowCode(row) === undefined, [rowCode]);
  const [codedRun, pendingRun] = React.useMemo<[Shelf[], Shelf[]]>(() => {
    const close = catalogueView === 'categories' ? familied : (rows: Subject[]) => rows;
    const side = (keep: (row: Subject) => boolean): Shelf[] =>
      ordered
        .map((shelf) => ({
          ...shelf,
          kinds: shelf.kinds
            .map((kind) => ({ ...kind, rows: kind.rows.filter(keep) }))
            .filter((kind) => kind.rows.length > 0)
            .map((kind) => ({ ...kind, rows: close(kind.rows) })),
        }))
        .filter((shelf) => shelf.kinds.length > 0);
    return [side((row) => !codePending(row)), side(codePending)];
  }, [ordered, codePending, catalogueView]);

  /** How many products the pending section holds — the register's own count word (§75.6), so the
   *  label and the pane's head are counting the same kind of thing. */
  const pendingCount = React.useMemo(
    () => pendingRun.reduce((n, s) => n + s.kinds.reduce((m, k) => m + sellable(k.rows), 0), 0),
    [pendingRun],
  );

  /** THE LIST AS DRAWN, WHICH IS NOW TWO RUNS IN ONE ORDER (§57.1 · §201.1). The walk, the phone
   *  pager and the price run all read this, so writing the sections down it in the order the eye
   *  has them is what keeps ↓ and the eye agreeing across the line. */
  const flat = React.useMemo<Subject[]>(
    () => [...codedRun, ...pendingRun].flatMap((s) => s.kinds.flatMap((k) => k.rows)),
    [codedRun, pendingRun],
  );

  /** WHAT THE PANE'S HEAD COUNTS: every row the eye can reach, counted the way the section labels
   *  count (§75.6 · §201.1, corrected at RELEASE-195).
   *
   *  ⚠ IT SAID «5 products» OVER SIX ROWS. The head took `sellable(flat)` — one sweep over the two
   *  runs joined — and `sellable` drops a family's base form when any row ANYWHERE in the list it
   *  is given hangs off it. Joining the runs put a family's parent and its own variation in one
   *  list where the sections had them apart, and the parent went out of the count while its row
   *  stayed on the screen. Counting KIND BY KIND, exactly as `pendingCount` and `registerCount`
   *  already do, asks the same question of the same sets the eye is looking at, so the head, the
   *  «Code pending» label and the rows agree. */
  const listedCount = React.useMemo(
    () => [...codedRun, ...pendingRun].reduce(
      (n, s) => n + s.kinds.reduce((m, k) => m + sellable(k.rows), 0), 0),
    [codedRun, pendingRun],
  );

  /** THE REGISTER'S OWN SIZE — every sellable row this house has, whatever word is narrowing the
   *  list. It is what the fill is measured against (C4), so it may never be the filtered count. */
  const registerCount = React.useMemo(
    () => shelves.reduce((n, s) => n + s.kinds.reduce((m, k) => m + sellable(k.rows), 0), 0),
    [shelves],
  );

  /* ── WHAT IS OPEN IN THE SHEET (§37.5, §17.1) ─────────────────────────────────────────────
     On a desk something is ALWAYS open: a master-detail surface with an empty right half is a
     surface that looks broken until you click. On a phone the list is the screen and the sheet is
     a push, so nothing is open until a row is tapped. */
  const [picked, setPicked] = React.useState<string | null>(null);
  React.useEffect(() => { setPicked(null); }, [cast]);

  /* ── WHAT BOTH DOORS DO (FEED-IA §64.2 — AUDIT-2 C4) ───────────────────────────────────────
   * One handler, so a product made by hand and a catalogue dropped as a file land the same way and
   * the two doors cannot drift. Three acts, in this order and for these reasons:
   *
   *   1 · MINT — the rows join the register, which is the fill §64.2 asks for and the thing that
   *       was missing: the upload door used to report a reading while the shelves behind it stayed
   *       byte-identical.
   *   2 · REMEMBER THE SIZE IT WAS — a file's claim is a SUBTRACTION on the register, so what the
   *       strip needs is the number before, never the number the file said. Rows the house already
   *       held are skipped by `mint`, and the strip is right about that for free.
   *   3 · WALK, OR STAY — and the phone is the one that differs. A desk holds the register and
   *       the sheet side by side, so opening the first of forty shows one of them WITHOUT hiding
   *       the fill. A phone's sheet PUSHES the list off the screen, and a fill nobody can see is
   *       the defect this whole fix is about, so there a file lands you on the register.
   */
  const putOnTheShelves = React.useCallback(
    (items: Array<{ id: string; code?: string; name: string; unit: string; price?: number; sourceUnit?: string; said?: string; category?: string; family?: string }>, source: 'hand' | 'csv', file?: string) => {
      const before = registerCount;
      /* The active order-review profile may admit literal SKU identity from a file, but it never
         carries a source price into a hidden commercial store. */
      const acceptedItems = pricingAvailable ? items : items.map(({ price: _price, ...item }) => ({ ...item, price: undefined }));
      /* A retry replays every incomplete store idempotently. It never overwrites a placement,
         unit profile or accepted tariff that is already present. */
      const knownIds = new Set(products.map((product) => product.id));
      const fresh = acceptedItems.filter((item) => !knownIds.has(item.id));
      catalogue.mint(cast.sector, acceptedItems, source);
      if (source === 'csv') {
        for (const item of acceptedItems) {
          const product: Product = { id: item.id, ...(item.code ? { code: item.code } : {}), name: item.name, unit: item.unit, family: 'unclassified', variableWeight: item.unit === 'kg', trace: {} };
          const unitSeed = seedImportedUnit(cast.sector, product);
          if (!unitSeed.ok) throw new Error(unitSeed.error);
          /* Import grouping remains source evidence in the retained file. It is deliberately not
             copied into the tenant's internal category or any related-SKU relationship. */
        }
        const tier = tiersOfHouse(cast)[0]?.id;
        /* A missing unit is a sparse SKU awaiting review. Its supplied number remains the durable
           pending import fact, never a tariff with an unknowable denominator. */
        const prices = pricingAvailable && tier ? acceptedItems.flatMap((item) => {
          if (item.price === undefined || !item.unit.trim()) return [];
          const product: Product = { id: item.id, ...(item.code ? { code: item.code } : {}), name: item.name, unit: item.unit, family: 'unclassified', variableWeight: item.unit === 'kg', trace: {} };
          return writtenOn(product, tier, todayId(cast)) === null ? [{ product: item.id, tier, day: todayId(cast), price: item.price, at: cast.hour, author: 'hand' as const }] : [];
        }) : [];
        if (prices.length && setPrices(prices).length !== prices.length) throw new Error('The catalogue rows are saved; saving their prices stalled. Your file is still here. Retry to finish importing these same products.');
      }
      if (source === 'csv') setFilled({ from: before, file: file || 'your file' });
      if (source === 'csv' && phone) { setPicked(null); window.location.hash = '#/stock'; }
      else if (fresh[0]) openProduct(fresh[0].id);
    },
    [cast.sector, catalogue, registerCount, phone, products, pricingAvailable],
  );

  /* ── THE CATALOGUE'S OWN PUBLIC WALK (FEED-IA §43, the scheme in `anchors.tsx`) ───────────
   * «A product's name — on a line (read context), a suggestion, a stat, a partner category —
   * opens the product.» Those doors write `#/stock/<id>`; this is what answers them.
   *
   * THE SEAM THIS CLOSES, said plainly: the doors existed and the destination did not. A product's
   * name on a customer's sheet already wrote the product's own address, and Stock read only the
   * HEAD of the route — so every one of those doors landed a person on the front of the catalogue
   * with the product they asked for nowhere in sight, which is a door that opens onto a corridor.
   *
   * A SEARCH ON SCREEN MAY NOT HIDE THE PRODUCT A DOOR JUST ASKED FOR — the same law the book takes
   * and the river takes for its narrow (§27): a door is urgent, a filter is a convenience. The id
   * is the SUBJECT's, so the walk works for a graduated sort or an off-list word exactly as it does
   * for a catalogue row, and a name for something no longer on the shelf leaves the surface alone
   * rather than emptying it. */
  const [landed, setLanded] = React.useState<string | null>(null);
  const landOnProduct = (id: string) => {
    const uncoded = uncodedItems.find((item) => item.id === id);
    if (uncoded) {
      setCatalogueScope('uncoded');
      setQuery('');
      setRead(null);
      setShowArchived(false);
      setPicked(`uncoded:${uncoded.id}`);
      return;
    }
    setCatalogueScope('skus');
    /* THE RESERVED WORD ON THIS TAIL IS GONE (§75.4 · C8). `openTierRegistry` used to write
       `#/stock/registry` — a pseudo-product addressing a surface that is not a product — and this
       branch answered it by switching to the tarifas seat. The seat is retired and the door now
       targets the SETTING, so the catalogue's landing holds nothing but products again.
       The base SKU keeps its real product id even where a separate structural family heading
       is drawn. Each variation answers its own id and never opens a family as a sellable sheet. */
    const want = shelves.flatMap((s) => s.kinds.flatMap((k) => familied(k.rows))).find((r) => r.id === id || subjectKey(r) === id);
    if (!want) return;
    if (!flat.some((row) => row.id === want.id)) setQuery('');
    setShowArchived(!!skuRecord(cast.sector, want.kind === 'base' ? want.product.id : want.id)?.details.archived);
    setPicked(subjectKey(want));
    setLanded(subjectKey(want));
  };
  useLanding('product', landOnProduct, () => setPicked(null));
  React.useEffect(() => {
    const readSourceRoute = () => {
      const [path, search = ''] = window.location.hash.split('?');
      if (path === '#/stock/supplier-emails' && inventoryAvailable && supplierIntakeAvailable) {
        const query = new URLSearchParams(search);
        const mail = query.get('message');
        setDoor({ kind: 'update' }); setOpenMail(mail); setMailOrigin(query.get('product'));
        if (mail) markMailRead(cast.sector, mail);
      }
    };
    readSourceRoute();
    window.addEventListener('hashchange', readSourceRoute);
    return () => window.removeEventListener('hashchange', readSourceRoute);
  }, [cast.sector, inventoryAvailable, supplierIntakeAvailable]);


  React.useEffect(() => {
    if (!landed) return;
    const walk = window.requestAnimationFrame(() => {
      const row = window.document.querySelector<HTMLElement>(`[data-product-row="${landed.split(':').slice(1).join(':')}"], [data-catalogue-entry="${landed.split(':').slice(1).join(':')}"]`);
      /* `nearest` keeps a row already in sight where it is, so arriving at something visible does
         not throw the shelf under the eye (§38 — the pane is the only thing that scrolls). */
      row?.scrollIntoView({ block: 'nearest' });
      setLanded(null);
    });
    return () => window.cancelAnimationFrame(walk);
  }, [landed, flat]);

  const allSubjects = shelves.flatMap((s) => s.kinds.flatMap((k) => familied(k.rows)));
  const held = allSubjects.find((r) => subjectKey(r) === picked);
  const uncodedPicked = uncodedItems.find((item) => picked === `uncoded:${item.id}`) ?? null;
  const subject = catalogueScope === 'uncoded' ? null : held ?? (pushed ? null : flat[0] ?? null);

  /* ── THE KEYBOARD WALKS THE CATALOGUE (FEED-IA §57.1 — «the interactions are good») ────────
   * «Make sure the categories, products etc are very clear and delineated, and that the
   * interactions are good.» Three hundred rows behind a mouse is a catalogue you hunt; ↑ and ↓
   * are how a person actually goes through a list of goods.
   *
   * IT WALKS THE LIST AS DRAWN, which is `flat` — through the shelves, in the order the pane has
   * them, so the walk and the eye agree. Home and End are the ends of the same list. The row that
   * takes the selection takes the FOCUS with it (so the next arrow keeps working and a screen
   * reader is told what happened) and scrolls itself in at `nearest`, which leaves a row that was
   * already in sight exactly where it was — the same courtesy the object doors take.
   *
   * ENTER AND SPACE ARE NOT HANDLED HERE, deliberately: every row IS a `<button>`, so the platform
   * already opens it. A key handler that re-implemented that would be a second answer to one
   * question, and the two would drift.
   */
  const walkCatalogue = React.useCallback(
    (to: (at: number) => number) => {
      const selectable = flat.filter((row) => row.kind !== 'product' || membersUnder(flat, row) === 0);
      if (selectable.length === 0) return;
      const focusedId = window.document.activeElement?.getAttribute('data-catalogue-entry');
      const at = selectable.findIndex((r) => pushed ? r.id === focusedId : subjectKey(r) === picked || (r.kind === 'base' && `product:${r.product.id}` === picked));
      const next = selectable[Math.max(0, Math.min(selectable.length - 1, to(at)))];
      if (!next) return;
      const key = subjectKey(next);
      // A narrow list keeps keyboard focus in the list; Enter opens its sheet.
      // On the desktop split view, arrow selection can update the visible preview.
      if (!pushed) setPicked(key);
      window.requestAnimationFrame(() => {
        const row = window.document.querySelector<HTMLElement>(`[data-catalogue-entry="${next.id}"]`);
        row?.focus({ preventScroll: true });
        row?.scrollIntoView({ block: 'nearest' });
      });
    },
    [flat, picked, pushed],
  );

  const onListKeys = (e: React.KeyboardEvent) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    /* a word being typed into the seat owns its own arrows */
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); walkCatalogue((at) => (at < 0 ? 0 : at + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); walkCatalogue((at) => (at < 0 ? 0 : at - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); walkCatalogue(() => 0); }
    else if (e.key === 'End') { e.preventDefault(); walkCatalogue(() => flat.length - 1); }
  };

  const tiers = tiersOfHouse(cast);
  /** THE BAND THIS SURFACE PRICES IN, as an ID. `tiersOfHouse` hands back a fresh array on a house
   *  standing on its seeded bands, so anything memoised on the ARRAY recomputes every render — the
   *  id is the stable fact, and it is what every reader below actually wants. */
  const lead = tiers[0].id;
  const day = todayId(cast);
  const priceOf = React.useCallback(
    (product: Product) => priceOn(cast, product, lead, day),
    [cast, lead, day],
  );

  /* Export reads the same current product, tariff, family and painting projections as the Stock
     sheet. Hand-created and reviewed sellable variations are materialised with their stable member
     IDs and independent prices. Unreviewed observations remain catalogue candidates. */
  const exportProducts = React.useMemo<CatalogueExportProduct[]>(() => {
    const relationships = new Map<string, { parentId: string; relationship: string }>();
    const current = new Map(products.map((product) => [product.id, product]));
    for (const variation of variedOf(cast.sector, catalogue.state)) {
      relationships.set(variation.id, { parentId: variation.base, relationship: 'Hand-added variation' });
      current.set(variation.id, amendmentProduct(cast, variation));
    }
    for (const amendment of AMENDMENTS) {
      if (amendment.sector !== cast.sector || (!amendment.sellable && !catalogue.state.graduated.includes(amendment.id))) continue;
      /* A named variation is a sellable SKU, even while its tenant code is still pending.
         Its stable member ID, own current price, export name and parent relationship travel
         together; a family is presentation, never a replacement for that SKU. */
      relationships.set(amendment.id, { parentId: amendment.base, relationship: `Variation · ${amendment.facet}` });
      current.set(amendment.id, amendmentProduct(cast, amendment));
    }
    for (const sort of SORTS) {
      if (sort.sector === cast.sector) relationships.set(sort.id, { parentId: sort.under, relationship: 'Learned variation' });
    }
    return [...current.values()].map((product) => projectSKU(cast.sector, product, skuRecords))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id))
      .map((product) => {
        const referenceFamily = familyOf(cast, product);
        const placement = placementFor(cast.sector, product);
        const family = placement.saved ? placement.family : referenceFamily;
        const relation = relationships.get(product.id);
        return {
          id: product.id,
          name: product.name,
          unit: product.unit,
          code: product.code,
          // A missing price exports as blank, never a guessed family value or a free item.
          price: cast.products.some((item) => item.id === product.id)
            ? priceOf(product)
            : writtenOn(product, lead, day) ?? Number.NaN,
          ...(placement.saved ? { categoryId: placement.category.id, categoryName: placement.category.name } : {}),
          familyId: family.id,
          familyName: family.name,
          parentId: relation?.parentId,
          relationship: relation?.relationship ?? 'Base SKU',
          trace: product.trace,
          illustration: paintingFor(product.name) ?? undefined,
        };
      });
  }, [cast, catalogue.state, day, lead, products, priceOf, tiersLog, skuRecords, productOntology]);

  /* ── THE MAIL SLICE OF THE SAME LEDGER (musing 12) ──────────────────────────────────────── */
  const mails = React.useMemo(() => mailsOf(cast, ledger), [cast, ledger]);

  const photos = React.useMemo(
    () =>
      ledger
        .filter((e) => e.file?.src)
        .map((e) => ({
          src: e.file!.src as string,
          alt: `${e.file!.name} — the document behind ${productOf(cast, e.product).name}`,
          caption: `${e.file!.name} · ${productOf(cast, e.product).name} · ${timeOf(e.at)}`,
        })),
    [cast, ledger],
  );

  const bookProduct = door?.kind === 'book' ? products.find((p) => p.id === door.product) : undefined;

  const gutter = theme.sizing[paneGutter(phone)];
  const [paneRef, paneHeight] = usePaneHeight(phone);
  const [headRef, headHeight] = useOwnHeight();
  /* §201.1: the «Code pending» label is a sticky head like the shelf heads under it, so the ones
     inside its own section park under it rather than on it — measured, never typed. */
  const [pendingHeadRef, pendingHeadHeight] = useOwnHeight();
  const listRef = React.useRef<HTMLDivElement>(null);

  useHistoryLayer({
    id: 'stock-uncoded-item',
    active: Boolean(uncodedPicked),
    snapshot: { scope: catalogueScope, query, view: catalogueView, item: uncodedPicked?.id ?? null, scroll: listRef.current?.scrollTop ?? 0 },
    onRestore: (saved) => {
      if (!saved?.item) { setPicked(null); return; }
      setCatalogueScope(saved.scope === 'skus' ? 'skus' : 'uncoded');
      setCatalogueView(saved.view === 'categories' ? 'categories' : saved.view === 'alphabetical' ? 'alphabetical' : 'source');
      setQuery(typeof saved.query === 'string' ? saved.query : '');
      setRead(null); setPicked(`uncoded:${String(saved.item)}`);
      const scroll = typeof saved.scroll === 'number' ? saved.scroll : 0;
      window.requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = scroll; });
    },
  });

  /* The phone pager is the current result set in the exact order the Products pane draws it.
     Every visible row that resolves to an exact sellable record participates; duplicate identities
     are collapsed without re-sorting. Changing product keeps the active query, scope, related-items
     filter and source/category/A–Z choice intact. */
  const productSheetRun = React.useMemo<Product[]>(() => {
    const seen = new Set<string>();
    return flat.flatMap((row) => {
      const exact = subjectProduct(row);
      if (!exact || seen.has(exact.id)) return [];
      seen.add(exact.id);
      return [exact];
    });
  }, [flat, subjectProduct]);
  const openSheetProduct = subject ? subjectProduct(subject) : null;
  const productSheetAt = openSheetProduct ? productSheetRun.findIndex((item) => item.id === openSheetProduct.id) : -1;
  const previousSheetProduct = productSheetAt > 0 ? productSheetRun[productSheetAt - 1] : null;
  const nextSheetProduct = productSheetAt >= 0 && productSheetAt < productSheetRun.length - 1 ? productSheetRun[productSheetAt + 1] : null;

  /** A member has only its own saved price. Unknown is not a free item or a family fallback. */
  const memberPrice = React.useCallback(
    (member: Product, family: Product) => writtenOn(member, lead, day) ?? (member.id === family.id && cast.products.some((p) => p.id === member.id) ? priceOf(member) : undefined),
    [cast, lead, day, priceOf],
  );

  /* ── §76 · THE RUN, AND ITS ORDER IS THE LIST'S ───────────────────────────────────────────
   * «You want a user to enter 40–80 changes almost rhythmically.» So the run is `flat` — the list
   * exactly as drawn, through the shelves, in the order the eye has them — minus the two rows that
   * do not carry a price: a FAMILY HEAD (its members do) and an UNCODED row (it is not a product
   * yet, and its one act is becoming one). Save & next walks this array and nothing else. */
  const priceRun = React.useMemo<PriceTarget[]>(
    () =>
      flat.flatMap((row) => {
        if (row.kind === 'uncoded' || row.kind === 'sort' || (row.kind === 'amendment' && !row.amendment.hand && !row.amendment.sellable) || skuRecord(cast.sector, row.kind === 'base' ? row.product.id : row.id, skuRecords)?.details.archived) return [];
        if (row.kind === 'product' && membersUnder(flat, row) > 0) return [];
        const own = subjectProduct(row);
        if (!own) return [];
        const family = familyRow(row);
        return [{
          key: subjectKey(row),
          name: family ? family.name : row.name,
          word: memberWord(row) ?? undefined,
          product: own,
          waiting: needsPrice(own, lead, day),
        }];
      }),
    /* `lead` and not `tiers`: `tiersOfHouse` hands back a fresh array on a seeded house, so a
       memo keyed on it would recompute on every render and hand the sheet a new run each frame.
       AND THE LOG, because `waiting` is a reading of it: without it the bottom bar went on saying
       «10 need a price» after ten had been said, until something else happened to move the memo.
       Re-running here cannot re-order a run in flight — the sheet holds its own snapshot. */
    [flat, subjectProduct, lead, day, tiersLog, cast.sector, skuRecords],
  );

  /** HOW MANY OF THEM ARE STILL ON YESTERDAY'S RATE (§16.12) — the bottom bar's own count, and
   *  the reason the run is ordered the way it is. */
  const waitingCount = React.useMemo(() => priceRun.filter((t) => t.waiting).length, [priceRun]);

  /* ── §16.12 · NEEDS-PRICE FIRST, AND IT IS DECIDED WHEN THE RUN OPENS ──────────────────────
   * «Recent / needs-price first.» The goods whose rate has not been said today lead the queue, in
   * the list's own order; everything else follows, also in the list's own order. So the run is
   * still the list AS DRAWN (§76) — it is the list read starting from the part that is the job.
   *
   * AND THE ORDER IS A SNAPSHOT, WHICH IS THE WHOLE OF WHY IT IS CALM. A live sort would re-rank
   * the queue on every save: the product just priced stops needing a price, jumps behind the ones
   * that do, and the person's «12 of 40» means something different one keystroke later. The order
   * is therefore taken ONCE, at the moment «Update prices» is pressed, and it stands for the run.
   */
  const [running, setRunning] = React.useState<PriceTarget[] | null>(null);
  const [runAt, setRunAt] = React.useState(0);
  const openRun = React.useCallback(
    (from: PriceTarget[], startAt: string | null) => {
      const ordered = [...from.filter((t) => t.waiting), ...from.filter((t) => !t.waiting)];
      const at = startAt === null ? -1 : ordered.findIndex((t) => t.key === startAt);
      setRunning(ordered);
      setRunAt(at < 0 ? 0 : at);
    },
    [],
  );
  /* a different house is a different catalogue: a run never survives the switch */
  React.useEffect(() => { setRunning(null); setRunAt(0); }, [cast]);
  /* the run cannot stand past its own end */
  React.useEffect(() => {
    if (running && runAt >= running.length) setRunning(null);
  }, [running, runAt]);

  /* ── §16.5 · A PASTED PRICE LIST BECOMES THE RUN ───────────────────────────────────────────
   * «Paste; type; dictate; bulk update.» The block is read in two halves and neither half is new
   * code: `parsePasted` (tiers.ts) splits the rate off each line, and the GOODS half is matched
   * the way the catalogue's own word is matched — their words first, and §62's organ behind them
   * for the sentences raw matching cannot answer («merluza sin cabeza congelada»). What comes out
   * is a run of targets carrying their rates, handed to the same sheet the bar opens. BULK UPDATE
   * IS THEREFORE NOT A SECOND FEATURE: it is this run at eighty rows, in the Save-&-next rhythm.
   *
   * NOTHING IS APPLIED BY THE PASTE ITSELF. Every line still goes through the sheet, with its
   * previous value on screen and Undo on every save — a paste that wrote eighty prices on one
   * press would be the ERP matrix §16 exists to replace, wearing a different coat.
   */
  const [pasting, setPasting] = React.useState<string | null>(null);

  const pastedRun = React.useMemo<{ lines: number; targets: PriceTarget[] }>(() => {
    const lines = parsePasted(pasting ?? '');
    if (lines.length === 0) return { lines: 0, targets: [] };
    /* every target's own words, folded ONCE — the same discipline `search.ts` states */
    const words = priceRun.map((t) => ({
      target: t,
      words: [
        ...wordsOf([t.name, t.word, codeWord(t.product), t.product.name]),
        ...wordsOf(aliasWordsFor(t.product.id)),
      ],
    }));
    const taken = new Set<string>();
    const targets: PriceTarget[] = [];
    for (const line of lines) {
      const terms = termsOf(line.said);
      let hit = words.find((w) => !taken.has(w.target.key) && matches(terms, w.words));
      if (!hit) {
        /* §62's ORGAN, WHERE THEIR RAW WORDS DID NOT LAND. The reading names the goods in the
           reference's own vocabulary, and a row the house wrote differently answers to that. */
        const read = parseChips(line.said, registers);
        const said = [read.name?.name, read.sort?.name].filter((w): w is string => Boolean(w));
        if (said.length > 0) {
          const readTerms = termsOf(said.join(' '));
          hit = words.find((w) => !taken.has(w.target.key) && matches(readTerms, w.words));
        }
      }
      if (!hit) continue;
      taken.add(hit.target.key);
      targets.push({ ...hit.target, given: line.price });
    }
    return { lines: lines.length, targets };
  }, [pasting, priceRun, registers, aliasWordsFor]);

  /* ── §16.7 · WHAT A DICTATED TAKE SET DOWN ─────────────────────────────────────────────────
   * A design surface cannot hear a microphone it is simulating, so the honest question is the one
   * `chats.tsx` already answers for its own voice notes: not «what words shall we invent» but
   * «what does this app already know is being said». Here it knows the goods and it knows the
   * house's own arithmetic for the band — so the take says those two things, and the sheet reads
   * them through the PASTE's parse, which is the whole point of the seam. In production the words
   * are the transcription's; nothing else about this path changes when they are.
   */
  const dictate = React.useCallback(
    ({ target }: { target: PriceTarget }) =>
      `${target.name} ${basePrice(cast, target.product, lead).toLocaleString(LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    [cast, lead],
  );

  /* ── THE ROW'S OWN QUIET FACT ───────────────────────────────────────────────────────────── */
  /* A Products row names the tenant’s exact identity. Inventory and price calculations still
     exist behind their release gates; they are intentionally absent from this first-customer view. */
  const factOf = (row: Subject): { fact: React.ReactNode; observed?: boolean } => {
    /* §201.1: the printed code and the section this row lands in read ONE seat, so a row can never
       say «Code pending» from inside the coded run, or print a code from under the label. */
    const literal = <ProductCode code={rowCode(row)} />;
    if (row.kind === 'uncoded') return { fact: `Customer wording · ${row.item.qty} ${row.item.unit}`, observed: true };
    if (row.kind === 'amendment') {
      if (row.amendment.hand || row.amendment.sellable) return { fact: literal };
      return { fact: `Customer wording used ${row.amendment.times} times`, observed: true };
    }
    if (row.kind === 'sort') return { fact: `Customer wording on ${row.sort.albaranes} delivery notes`, observed: true };
    return { fact: literal };
  };

  /* ── THE SHEET (§37.5, §38, §39) ────────────────────────────────────────────────────────── */
  /* THE HOUSE'S TARIFAS ARE A SETTING (§75.4 · C3). A product sheet's link to the band names walks
     to the row that holds them, in admin/operations, with the rest of the house's working style —
     `anchorFor('pricing')` has been the address of that answer since §53. */
  const openRegistry = () => { window.location.hash = anchorFor('pricing'); };
  /* THE WAY BACK EXISTS WHEREVER THE LIST IS BEHIND THE SHEET RATHER THAN BESIDE IT — the phone,
     and the stacked desk (FEED-IA §103). It is `pushed` and not `phone` for exactly that reason. */
  const backToList = pushed ? () => { setPicked(null); window.location.hash = '#/stock'; } : undefined;

  /* ── THE FAMILY'S OWN BLOCK ON THE SHEET (§75.6 · C6) ──────────────────────────────────────
   * A product's sheet says what it comes as: every member of its family, each with the word it
   * adds, and the door that writes another one. A product with no members shows the door alone —
   * «adding variations should be a thing too» is true before the first one exists.
   */
  const adoptAndOpen = (id: string, name: string, adopt: () => void) => {
    adopt(); if (pricingAvailable) requestInitialSKUPrice(cast.sector, id); ensureSKUArtworkRequest(cast.sector, id, name); openProduct(id);
  };
  const openRelatedItem = (id: string) => {
    const next = uncodedItems.find((item) => item.id === id);
    if (next) { setCatalogueScope('uncoded'); setQuery(''); setRead(null); setPicked(`uncoded:${next.id}`); }
    else openProduct(id);
  };
  const relationCandidates = [
    ...products.map((item) => ({ ...item, kind: 'sku' as const })),
    ...uncodedItems.map((item) => ({ ...item, kind: 'uncoded' as const })),
  ];
  const uncodedSheet = uncodedPicked ? <UncodedItemSheet cast={cast} item={uncodedPicked} candidates={relationCandidates} onBack={backToList} onOpenItem={openRelatedItem} /> : null;
  const sheet = uncodedPicked ? uncodedSheet : subject?.kind === 'product' || subject?.kind === 'base' ? <ProductCard cast={cast} product={subject.product} layout="pane" onBack={backToList} backLabel="Products" onPrevious={previousSheetProduct ? () => openProduct(previousSheetProduct.id) : undefined} onNext={nextSheetProduct ? () => openProduct(nextSheetProduct.id) : undefined} onRegistry={openRegistry} availableRelatedItems={relationCandidates} onOpenRelated={openRelatedItem} onAddVariation={(base) => setDoor({ kind: 'vary', base })} />
    : subject?.kind === 'amendment' && (subject.amendment.hand || subject.amendment.sellable) ? <ProductCard cast={cast} product={amendmentProduct(cast, subject.amendment)} priceParent={subject.base} layout="pane" onBack={backToList} backLabel="Products" onPrevious={previousSheetProduct ? () => openProduct(previousSheetProduct.id) : undefined} onNext={nextSheetProduct ? () => openProduct(nextSheetProduct.id) : undefined} onRegistry={openRegistry} availableRelatedItems={relationCandidates} onOpenRelated={openRelatedItem} onAddVariation={(base) => setDoor({ kind: 'vary', base })} />
    : subject?.kind === 'uncoded' ? <NewcomerSheet cast={cast} name={subject.name} place="Customer wording · a catalogue product after review" how="A customer asked for this product in their own words. Review it before adding it as a sellable product." facts={[{ label: `${subject.item.qty} ${subject.item.unit}`, sub: 'Quantity and unit on the source order' }]} act={{ label: 'Add as product', onAct: () => adoptAndOpen(subject.item.id, subject.name, () => catalogue.adopt(cast.sector, subject.item)) }} onBack={backToList} backLabel="Products" layout="pane" />
    : subject?.kind === 'amendment' || subject?.kind === 'sort' ? <NewcomerSheet cast={cast} name={subject.name} place={`Customer wording in the ${subject.base.name} family`} how={subject.kind === 'amendment' ? `Customers used this wording ${subject.amendment.times} times this month.` : `Written on ${subject.sort.albaranes} delivery notes.`} facts={[{ label: subject.base.name, sub: 'Related sellable product; its own order history stays separate' }]} act={{ label: 'Add as product', onAct: () => adoptAndOpen(subject.id, subject.name, () => catalogue.graduate(cast.sector, subject.id, subject.name)) }} priced={{ product: subject.kind === 'amendment' ? amendmentProduct(cast, subject.amendment) : sortProduct(cast, subject.sort), family: subject.base, day, hour: nowOf(cast) }} onBack={backToList} backLabel="Catalogue" layout="pane" /> : null;

  /* ── THE LIST PANE ──────────────────────────────────────────────────────────────────────── */
  /* ── ONE SHELF, DRAWN — AND THE LIST DRAWS IT TWICE (FEED-IA §201.1) ──────────────────────
   * The coded run and the run whose codes are pending are the SAME list, under the same narrowing,
   * in the same order — so the row anatomy is written once here and called with each. A second
   * copy of eighty lines of JSX is how the two sections would start disagreeing about what a row
   * is the week after they were written.
   *
   * `top` IS WHERE THIS RUN'S CATEGORY HEADS PARK. In the coded run that is the pane's own head;
   * in the run below the line it is the pane's head PLUS the «Code pending» label, because two
   * sticky things landing on one pixel is one of them hidden.
   */
  const shelfSection = (s: Shelf, si: number, top: number) => (
    <section key={`${s.shelf}:${s.name}`} data-category-group={s.name} data-order={catalogueView === 'source' ? 'tenant-source' : catalogueView === 'alphabetical' ? 'global-alphabetical' : 'category'} style={{ minWidth: 0 }}>
      {catalogueView === 'categories' && s.shelf !== 'catalogue' && (
        <CategoryHeader
          shelf={s}
          top={top}
          gutter={gutter}
          first={si === 0}
          count={s.kinds.reduce((n, k) => n + sellable(k.rows), 0)}
          terms={terms}
          onDiscuss={() => openAssistant({ kind: 'catalogue', context: { categoryId: s.shelf, productIds: s.members.map((member) => member.id), source: 'catalogue' } })}
        />
      )}
      {s.kinds.map((k, ki) => {
        /* ── WHEN THE KIND REGISTER DRAWS ITSELF (§57.1, and §78.1's collapse) ──────────
           It was drawn wherever it said something the shelf did not. That is still the first
           test, and §78.1 adds the second: it must SEPARATE something. «MERLUZA 3» above
           «Merluza · 3 variations» is one word paid for twice, and the register's implied
           siblings are what made Peter ask «is there OTHER merluza?». Where the kind holds one
           family, the family head carries the kind and the line goes. */
        const names = catalogueView === 'categories' && nodeOf(k.node)?.level === 'type' && k.name !== s.name;
        const headed = names && standing(k.rows) > 1;
        return (
          <div key={k.node} style={{ minWidth: 0 }}>
            {headed && (
              <KindHead name={k.name} count={sellable(k.rows)} terms={terms} gutter={gutter} first={ki === 0} />
            )}
            {k.rows.map((row, ri) => {
              const { fact, observed } = factOf(row);
              /* §65.1's indent only means something while the family head is on screen. A word
                 that matched the member and not the product drops the head out of the run, and
                 the row goes back to stating itself whole (§65.4). */
              const family = familyRow(row);
              const parentShown =
                catalogueView === 'categories' && family !== null &&
                k.rows.slice(0, ri).some((r) => r.kind === 'product' && r.id === family.id);
              const members = membersUnder(k.rows, row);
              /* THE LAST MEMBER OF A FAMILY carries the «Add a variation» door after it, so
                 the door stands at the foot of the block it belongs to (§75.6 / C6). */
              const lastOfFamily =
                catalogueView === 'categories' && family !== null && parentShown
                && !k.rows.slice(ri + 1).some((r) => familyRow(r)?.id === family.id);
              return (
                <React.Fragment key={subjectKey(row)}>
                  <CatalogueRow
                    subject={row}
                    fact={fact}
                    observed={observed}
                    unit={subjectProduct(row)?.unit ?? ''}
                    selected={subject ? row.kind === 'base' ? subjectProduct(subject)?.id === row.product.id : subjectKey(subject) === subjectKey(row) : false}
                    parentShown={parentShown}
                    members={catalogueView === 'categories' ? members : 0}
                    /* ── THE WEIGHT THAT OPENS THIS ROW (§57.1, §78.1) ────────────────
                       NONE where something above already opened the run — the shelf's own
                       header, or the kind register where one was drawn.
                       KIND on the first row of a run whose register COLLAPSED: the level is
                       still starting, so the mid rule says so where the caption used to.
                       ROW otherwise — the next of the same thing. */
                    rule={
                      catalogueView !== 'categories'
                        ? ri === 0 ? 'none' : 'row'
                        : ri === 0
                          ? headed || ki === 0
                            ? 'none'
                            : 'kind'
                          : 'row'
                    }
                    terms={terms}
                    gutter={gutter}
                    onPick={() => openProduct(row.kind === 'base' ? row.product.id : row.id)}
                  />
                  {lastOfFamily && family && (
                    <AddVariation
                      family={family}
                      gutter={gutter}
                      onAdd={() => setDoor({ kind: 'vary', base: family })}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </section>
  );

  const list = (
    <div
      ref={listRef}
      data-testid="stock-list"
      /* THE WALK LISTENS HERE, so a row's own keydown bubbles into it and the pane answers once
         (§57.1). The pane is focusable only to the code — a person reaches it through its rows. */
      tabIndex={-1}
      onKeyDown={onListKeys}
      style={{
        display: pushed && (subject || uncodedPicked) ? 'none' : 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        /* §38: ONE SCROLLPORT PER PANE, and one axis only — `overflow-y: auto` alone computes
           `overflow-x: auto`, which is how a pane quietly becomes a sideways scroller. */
        overflowY: 'auto',
        overflowX: 'clip',
        outline: 'none',
        background: theme.colors.backgroundPrimary,
      }}
    >
      <ListHead
        innerRef={headRef}
        count={catalogueScope === 'uncoded' ? shownUncodedItems.length : listedCount}
        caption={catalogueScope === 'uncoded' ? 'Uncoded items' : ''}
        gutter={gutter}
        controls={(
          <div
            data-testid="catalogue-view-controls"
            style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, flexWrap: 'wrap' }}
          >
            <CatalogueFilters
              value={{ view: catalogueView, scope: catalogueScope, archived: showArchived, relatedItemId }}
              uncodedCount={uncodedItems.length}
              relatedOptions={relatedItemOptions}
              onApply={(next) => {
                setCatalogueView(next.view);
                setCatalogueScope(next.scope);
                setShowArchived(next.archived);
                setRelatedItemId(next.relatedItemId);
                setPicked(null);
                window.location.hash = '#/stock';
              }}
            />
            <WordSeat registers={registers} sector={cast.sector} query={query} onRead={onRead} phone={phone} />
          </div>
        )}
      />

      {/* ── THE FILL, STATED BY THE REGISTER ITSELF (FEED-IA §64.2 — AUDIT-2 C4) ────────────
          «Accepted products visibly fill the register.» The number is a subtraction on the list
          this strip is standing on — the register's size now, less its size when the act was
          pressed — so it cannot say a fill the rows behind it did not receive. It is drawn HERE,
          on the catalogue, with the card already dismissed: the evidence is the shelves, and this
          only names what arrived and where it came from. The accent is Rocoto's own act (§51) —
          grounding a file's rows onto the produce tree is the one thing on this strip that Rocoto
          did rather than the house. */}
      {filled && registerCount > filled.from && (
        <div
          data-testid="stock-filled"
          data-gained={registerCount - filled.from}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale400,
            padding: `${theme.sizing.scale400} ${gutter}`,
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            background: theme.colors.backgroundSecondary,
            minWidth: 0,
          }}
        >
          <AccentDot />
          <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: 0 }}>
            {registerCount - filled.from}{' '}
            {registerCount - filled.from === 1 ? 'product' : 'products'} arrived from {filled.file}
          </span>
          <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="stock-filled-close" onClick={() => setFilled(null)}>
            Close
          </Button>
        </div>
      )}

      {/* ── WHAT THE REGISTER HOLDS FOR THE REST OF THE SENTENCE (§62.4 · §80 — C26) ────────
          A chip the narrowing could not honour without emptying the list is held, and this says
          what the register DOES hold for that word — «congelada · 1 product». It is a FACT and not
          a control: the word is already in the field a few pixels above, where it can be edited in
          place, and a second way to change the same sentence would be a second grammar for it. The
          list above stands on the reading the register could answer, which is the honest half of
          the sentence rather than nought against three real words. */}
      {searching && heldWords.length > 0 && (
        <div
          data-testid="stock-word-held"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale300,
            flexWrap: 'wrap',
            padding: `${theme.sizing.scale400} ${gutter}`,
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            minWidth: 0,
          }}
        >
          <AccentDot />
          {heldWords.map((chip) => {
            const holds = holdsFor(shelves, chip, aliases);
            return (
              <span key={`${chip.from}-${chip.said}`} data-held={chip.said} data-holds={holds}>
                {/* THE OVERFLOW IS DECLARED, AND IT IS «DO NOT» (§77.2). Base's tag clamps its text
                    at scale3200 and «congelada · 1 product» came back as «congelada · 1 pro…» —
                    a slot too small for the only sentence it will ever hold. This one is a fact
                    about the register, never a name of unknown length, so it is given its own
                    width and the row wraps instead. */}
                <Tag
                  closeable={false}
                  kind={TAG_KIND.neutral}
                  hierarchy={HIERARCHY.secondary}
                  overrides={{ Text: { style: { maxWidth: 'none' } } }}
                >
                  {chip.said} · {holds} {holds === 1 ? 'product' : 'products'}
                </Tag>
              </span>
            );
          })}
        </div>
      )}

      {/* ── THE EMPTY STATE, ON TWO LAWS AT ONCE ────────────────────────────────────────────
          BASE'S OWN GRAMMAR (§58.2): the headline is one line that either says why the screen is
          empty OR says what to do to fill it, it takes no full stop, and the body says what will
          happen and does take one. «0 products match “x”» was the robotic label the guidance
          names by that word.
          AND THE HOUSE RULE: a line of copy never spends itself on a negative. Base offers two
          headlines and only one of them can be written without one, so the headline is the ACT —
          which is also the more useful half, because the count in the pane's head above has
          already said nought. The book's own empty state is written to the same two lines: a
          person meets both in one morning, and one grammar across the two list panes is the whole
          of §39's claim. */}
      {searching && flat.length === 0 && (
        <div
          data-testid="stock-search-empty"
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, padding: theme.sizing.scale700, ...lane(null), minWidth: 0 }}
        >
          <span style={theme.typography.LabelLarge}>Try another word for “{query.trim()}”</span>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            Search by product name, code, or another name you use.
          </span>
        </div>
      )}

      {catalogueScope === 'uncoded' && (shownUncodedItems.length ? <section data-testid="uncoded-items-list" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {shownUncodedItems.map((item) => <button key={item.id} type="button" data-testid="uncoded-catalogue-item" data-list-card="inset" data-item={item.id} data-selected={uncodedPicked?.id === item.id ? "yes" : "no"} onClick={() => setPicked("uncoded:" + item.id)} className={css({ background: uncodedPicked?.id === item.id ? theme.colors.backgroundSecondary : "transparent", ":hover": { background: theme.colors.backgroundSecondary }, ":focus-visible": { outline: "2px solid " + theme.colors.contentPrimary, outlineOffset: "-2px" } })} style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr) auto", gap: theme.sizing.scale400, alignItems: "center", alignSelf: "stretch", minHeight: 76, boxSizing: "border-box", padding: theme.sizing.scale300, marginTop: theme.sizing.scale100, marginRight: gutter, marginBottom: theme.sizing.scale100, marginLeft: gutter, border: "none", borderRadius: theme.borders.radius300, color: theme.colors.contentPrimary, textAlign: "left", cursor: "default" }}>

          <ProductFace of={{ name: item.name, id: item.id, sector: cast.sector }} size={56} />
          <span style={{ display: "grid", gap: theme.sizing.scale100, minWidth: 0 }}><span style={{ ...theme.typography.LabelMedium, overflowWrap: "anywhere" }}>{item.name}</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: "anywhere" }}>Uncoded item</span></span>
          <span data-product-unit={item.unit || "needs-review"} style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, minWidth: "44px", textAlign: "right", whiteSpace: "nowrap" }}>{item.unit || "—"}</span>
        </button>)}
      </section> : <div data-testid="uncoded-items-empty" style={{ display: 'grid', gap: theme.sizing.scale200, padding: theme.sizing.scale700 }}><span style={theme.typography.LabelLarge}>Accepted uncoded items show here</span><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>A literal request appears here only after it is accepted on a Delivery Note.</span></div>)}
      {catalogueScope === 'skus' && codedRun.map((s, si) => shelfSection(s, si, headHeight))}

      {/* ── §201 · THE PRODUCTS WHOSE CODE IS PENDING, UNDER ONE LINE AND ONE LABEL ─────────
          «There should be a little line and then a section below that, so we don't mix them in.»
          THE LINE IS A DIVIDER AND NOT A FRAME: one hairline in the border token, the pane's own
          full width, with the air above it doing most of the separating — space groups, and a rule
          is only there to say the space is deliberate.
          THE LABEL NAMES WHAT IT HOLDS, in the one grammar a pending code has anywhere in the app
          («Code pending»), and states its size the way every other head on this pane does. It is
          quiet on purpose: a section label, standing at the pane's own gutter where the category
          heads stand, never a banner announcing a problem.
          IT EXISTS ONLY WHILE IT HOLDS SOMETHING. Give the last of them a code and the line, the
          label and the section go with it, and the product is standing in the run above. */}
      {catalogueScope === 'skus' && pendingCount > 0 && (
        <section data-testid="code-pending-section" data-count={pendingCount} style={{ minWidth: 0 }}>
          <div
            data-testid="code-pending-rule"
            role="presentation"
            style={{ marginBlockStart: theme.sizing.scale700, borderBlockStart: `1px solid ${theme.colors.borderOpaque}` }}
          />
          <h3
            ref={pendingHeadRef as React.RefObject<HTMLHeadingElement>}
            data-testid="code-pending-head"
            data-count={pendingCount}
            style={{
              position: 'sticky',
              top: headHeight,
              zIndex: 1,
              margin: 0,
              paddingBlock: `${theme.sizing.scale500} ${theme.sizing.scale300}`,
              paddingInline: gutter,
              background: theme.colors.backgroundPrimary,
              ...theme.typography.LabelSmall,
              color: theme.colors.contentSecondary,
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {CODE_PENDING} · {pendingCount}
          </h3>
          {pendingRun.map((s, si) => shelfSection(s, si, headHeight + pendingHeadHeight))}
        </section>
      )}

      {/* THE FOOT IS AIR (§51.21). Supplier messages now enter through Stock update and tariff
          management belongs to settings; the catalogue keeps room to stop after its last row. */}
      <div style={{ height: theme.sizing.scale1200, flex: '0 0 auto' }} />

      {/* ── §76 · THE CATALOGUE'S ONE BOTTOM ACTION ────────────────────────────────────────
          «The high-frequency action sits LOW and LARGE… the pricing surface's main bottom action
          is "Update prices" (not "Log price").» One act, at the foot of the list it acts on, in
          the §39 bar the product sheet already keeps — same construction, same sticky edge, same
          shadow, so a person meets one bar grammar in the app and not two.
          IT STARTS WHERE THE PERSON IS STANDING. The run is the list AS DRAWN, and opening it on
          the selected row rather than on row one is the difference between «change these eighty»
          and «change this one, then the next seventy-nine». */}
      {pricingAvailable && priceRun.length > 0 && (
        <div
          data-testid="stock-price-bar"
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 2,
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale500,
            boxSizing: 'border-box',
            /* ── THE LAUNCHER'S LANE, ON BOTH HOUSINGS (§15 · §76) ───────────────────────
               The app's own chat launcher floats over the work in this corner. The product
               sheet's bar has reserved a lane for it since a shot found it, on the argument
               that «a phone has no launcher and needs no lane» — and at 390 and 320 it plainly
               does: the launcher was drawn straight over «Update prices», §76's highest-
               frequency act sitting under a control that is not it. Found by LOOKING, named as
               a red in drive-stock-75, fixed here. One lane, both widths.
               ⚠ AND THE LANE IS THE LAUNCHER'S OWN NUMBER (THE-CHECKPOINT-AUDIT finding 3).
               `scale1600` is 64 and the circle occupies 80 from the glass, so the reserve was
               16px short of the thing it was reserving for. `LAUNCHER_LANE` is 56 + 24, exported
               from `shell/chats.tsx`, so the bar and the bubble cannot drift apart again. */
            padding: `${theme.sizing.scale500} ${gutter}`,
            paddingRight: `calc(${gutter} + ${LAUNCHER_LANE}px)`,
            borderTop: `1px solid ${theme.colors.borderOpaque}`,
            background: theme.colors.backgroundPrimary,
            boxShadow: theme.lighting.shadow600,
            minWidth: 0,
          }}
        >
          {/* THE COUNT IS WHAT THE RUN IS FOR (§16.12). «10 prices» while the day is said; «3 need
              a price» the moment any of them is still on yesterday's rate. */}
          {/* §77.2 · THE SLOT DECLARES ITS OVERFLOW. «3 need a price» is longer than «10 prices»,
              and at 390 an undeclared slot WRAPPED — one extra line on the bar, 20px off the
              register, which is the measurement C38 exists to hold. One line, ellipsis. */}
          <span
            data-testid="price-bar-count"
            data-waiting={waitingCount}
            style={{
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {runWords(priceRun.length, waitingCount)}
          </span>
          {/* ── §16.5 · PASTE ──────────────────────────────────────────────────────────────
              «Paste; type; dictate.» A price list arrives as two columns in a mail and the thing
              a person does with it is ctrl-V, so the door is here — beside the act it feeds, on
              the list it acts on — and what it opens is a run, not an import wizard. */}
          {/* THE PASTE DOOR IS THE DESK'S. At 390 it lives in the acts menu (`PHONE_ACTS`), for
              C38's own reason: this bar is one row there, and «Update prices» is the row. */}
          {!phone && (
            <Button
              kind={KIND.secondary}
              size={SIZE.compact}
              data-testid="paste-prices"
              onClick={() => setPasting('')}
            >
              Paste prices
            </Button>
          )}
          <Button
            kind={KIND.primary}
            size={SIZE.compact}
            data-testid="update-prices"
            onClick={() => openRun(priceRun, picked)}
          >
            Update prices
          </Button>
        </div>
      )}
    </div>
  );

  /* ── THE SUPPLIER EMAILS SEAT (§51.21, §51.22 · FEED-IA §132.3, §132.4) ───────────────────
     One scrollport, THREE sections, ranked by what a person opens this seat to do (§98.3):

       1 · WHAT ARRIVED THIS MORNING   the mail, each message with its albarán and Rocoto's own
                                       reading of it. It is the only one of the three that is
                                       WORK, so it leads.
       2 · WHAT GOES OUT TO THEM       the forwarding arrangements — a day's lines for a partner
                                       house, emailed as one list at the hour the house sets. It
                                       stood in Connections as a section nobody ordered (§132.3);
                                       it is the same subject as the mail above it, from the other
                                       side, so it stands under it rather than in another seat.
       3 · EVERYTHING THAT ARRIVED     the ledger, every door, not only mail. The superset, and
                                       therefore last: it answers «what happened» rather than
                                       «what do I do». */
  /* THE TARIFAS SEAT IS RETIRED (§75.4 · C1/C3). What stood in this pane — the band names, their
     sizes, add and rename — is one row in admin/operations now, and the per-product prices were
     already on the product's own sheet. Nothing was lost; a rate card simply is not a seat. */

  return (
    <Page title="Products" fill={!phone}>
      {/* ── THE SURFACE IS ONE COLUMN: THE BAR, THEN THE PANES (FEED-IA §38 · §51.17 — C38) ───
          `Page` puts a full step of air between the children an area hands it, which is right for
          a stack of sections and wrong for chrome standing on a pane: at 390 those 32 pixels came
          straight off the scrollport, on top of a bar that had wrapped onto two lines. The bar and
          the panes are ONE child now, and their own gap is nothing, so every pixel Stock owns goes
          to the register. The pane's height hook reads its previous sibling — still the bar. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          ...(phone ? null : { flex: '1 1 auto', minHeight: 0 }),
        }}
      >
      <div data-testid="stock-doors" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, padding: phone ? `0 0 ${theme.sizing.scale500}` : `${theme.sizing.scale600} ${gutter}`, minWidth: 0 }}>
        <div data-testid="catalogue-heading" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
          <div data-testid="stock-primary-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-supply-issue" startEnhancer={<Glyph id="flag" size={STEP.small} />} onClick={() => openAssistant({ kind: 'supply', context: { source: 'stock' } })}>Report supply issue</Button>
            {inventoryAvailable && <Button kind={KIND.secondary} size={SIZE.compact} data-testid="stock-update" onClick={() => { setOpenMail(null); setDoor({ kind: 'update' }); }}>Stock update</Button>}
            <Button kind={KIND.primary} size={SIZE.compact} data-testid="new-product" onClick={() => setDoor({ kind: 'product' })}>New product</Button>
            <StatefulPopover placement={PLACEMENT_MENU.bottomRight} triggerType={TRIGGER_TYPE.click} overrides={{ Body: { style: { zIndex: 9 } } }} content={({ close }) => <StatefulMenu items={FILE_ACTS} onItemSelect={({ item }) => { close(); setDoor({ kind: 'catalogue-export' }); }} overrides={{ List: { props: { 'data-testid': 'stock-acts-menu' }, style: { minWidth: '200px' } } }} />}>
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="stock-acts" aria-label="More product actions" aria-haspopup="menu">•••</Button>
            </StatefulPopover>
          </div>
        </div>
      </div>

      {/* ── THE TWO PANES (§38) ─────────────────────────────────────────────────────────────
          The catalogue on the left and the product's sheet on the right, each with its own single
          scrollport and both as tall as what the screen has left. On a phone the sheet PUSHES: the
          list is the screen until a row is tapped, and the way back is the sheet's own control. */}
      <div
        ref={paneRef}
        data-testid="stock-panes"
        data-seat="catalogue"
        style={{
          display: 'grid',
          /* THE HEIGHT IS THE BOX'S, HAIRLINE INCLUDED. With the default content box the 1px rule
             above rides ON TOP of the measured height, which is one pixel of page scroll on a
             phone — and one pixel of page scroll is still two scrolls. */
          boxSizing: 'border-box',
          /* THE GEOMETRY IS THE SEAT'S (§51.21). The catalogue is master-detail because a product
             has a sheet; the feed and the rate cards have no right-hand object, so they are ONE
             full-height scrollport rather than a pane with an empty half beside it. */
          /* ── TWO COLUMNS, OR ONE (FEED-IA §38 · §103) ────────────────────────────────────
             The catalogue is the only seat with a right-hand object. Under the continuum's stacked
             rung there is no room for two honest panes, so the sheet takes the box and the list is
             one press behind it — the push the phone already does, in the desk's own chrome. */
          gridTemplateColumns:
            pushed ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 620px)',
          /* on a desk the frame's box is the height; on a phone it is what the screen has left */
          ...(phone ? { height: paneHeight || undefined } : { flex: '1 1 auto' }),
          minHeight: 0,
          background: theme.colors.backgroundPrimary,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        {list}
        {(
          <div
            data-testid="stock-sheet"
            style={{
              display: pushed && !(subject || uncodedPicked) ? 'none' : 'flex',
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              borderLeft: pushed ? undefined : `1px solid ${theme.colors.borderOpaque}`,
              background: theme.colors.backgroundPrimary,
            }}
          >
            {sheet}
          </div>
        )}
      </div>
      </div>

      {door?.kind === 'product' && <CreateSKU cast={cast} onClose={closeStockDoor} onUpload={() => setDoor({ kind: 'upload' })} />}
      {door?.kind === 'vary' && <CreateSKU cast={cast} family={door.base} onClose={closeStockDoor} />}
      <OverlayCard
        isOpen={door?.kind === 'upload' || door?.kind === 'catalogue-export' || (door?.kind === 'update' && inventoryAvailable)}
        onClose={closeStockDoor}
        scrim={SCRIM.dim}
        size={800}
        /* E193.21 · the task frame's one placement law: docked on a phone, centred on a desk. */
        placement={workflowPlacement}
        ariaLabel="Stock"
        overrides={workflowCardOverrides({ visualHeight: workflowHeight })}
      >
        {door?.kind === 'update' && inventoryAvailable ? (
          <NewEvent
            cast={cast}
            products={products}
            registers={registers}
            phone={phone}
            today={todayId(cast)}
            onClose={closeStockDoor}
            onNewProduct={() => setDoor({ kind: 'product' })}
            viewingEmail={!!openMail}
            incoming={<StockUpdateFeed cast={cast} mails={mails} selected={openMail} demo={!supplierIntakeAvailable} onOpen={id => { setOpenMail(id); if (id) markMailRead(cast.sector, id); }} renderEvent={row => <Happened cast={cast} row={row} withProduct />} />}
          />
        ) : door?.kind === 'upload' ? (
          /* §64 · THE UPLOAD DOOR — the second door onto STOCK'S OWN INTAKE (AUDIT-2 C4).
             It opens `CatalogueIntake`, the identical organ the New Product door carries, so a
             price sheet dropped here lands in the register exactly as one dropped there does. The
             lead names what THIS door gets, in the words of the place it stands in (§64.2), and
             the claim about what arrived is made afterwards, by the register itself, with this
             card already gone. */
          <Panel title="Upload products" onClose={closeStockDoor} back={{ label: 'New product', onBack: () => setDoor({ kind: 'product' }) }}>
            <CatalogueIntake testid="stock-intake" onPut={async (sheet) => {
              if (!await rememberCatalogueImport(cast.sector, sheet)) throw new Error('Saving the import record stalled. Your file is still here; try again.');
              putOnTheShelves(sheet.rows.map((r) => ({ id: r.id, code: r.code, name: r.name, unit: r.unit, sourceUnit: r.sourceUnit, ...(pricingAvailable && r.price !== undefined ? { price: r.price } : {}) })), 'csv', sheet.file);
              for (const row of sheet.rows) {
                const product: Product = { id: row.id, ...(row.code ? { code: row.code } : {}), name: row.name, unit: row.unit, family: 'unclassified', variableWeight: row.unit === 'kg', trace: {} };
                const suggestion = placementFor(cast.sector, product);
                if (/^(uncategorised|unclassified)$/i.test(suggestion.category.name.trim())) continue;
                saveSKUPlacement(cast.sector, product.id, {
                  categoryId: suggestion.category.id,
                  categoryName: suggestion.category.name,
                  familyId: suggestion.family.id,
                  familyName: suggestion.family.name,
                });
              }
              setDoor(null);
            }} />
          </Panel>
        ) : door?.kind === 'catalogue-export' ? (
          <Panel title="Export catalogue" onClose={() => setDoor(null)}>
            <CatalogueExport sector={cast.sector} products={exportProducts} />
          </Panel>
        ) : door?.kind === 'book' && bookProduct ? (
          <BookPanel
            cast={cast}
            product={bookProduct}
            rows={rowsFor(bookProduct.id)}
            lots={lotsFor(bookProduct.id)}
            now={now}
            onPreview={(file_, from) => setDoor({ kind: 'file', file: file_, back: { kind: 'book', product: bookProduct.id }, from })}
            onClose={() => setDoor(null)}
          />
        ) : door?.kind === 'file' ? (
          /* THE MODAL HAS BECOME THE FILE. Same layer, same card, a back bar where the heading was
             — and the sheet grows out of the box the chip stood in. */
          <Panel
            title={door.file.name}
            onClose={closeStockDoor}
            back={{ label: backLabel(door.back), onBack: () => setDoor(door.back) }}
          >
            <Morph from={door.from}>
              <div data-testid="file-preview">
                <FileView cast={cast} file={door.file} photos={photos} phone={phone} />
              </div>
            </Morph>
          </Panel>
        ) : (
          <span />
        )}
      </OverlayCard>

      {/* ── §76 · THE PRICE RUN ────────────────────────────────────────────────────────────
          It stands MOUNTED at every moment, open or not, for one reason: the snackbar it raises
          on the last save lives inside it, and a provider that unmounts with the card would take
          the Undo away in the same frame it was offered. The card itself is `isOpen`-driven. */}
      <PriceEntry
        cast={cast}
        targets={running ?? priceRun}
        at={runAt}
        isOpen={pricingAvailable && Boolean(running) && (running ?? []).length > 0}
        phone={phone}
        day={day}
        hour={nowOf(cast)}
        onAt={(next) => {
          setRunAt(next);
          /* THE LIST FOLLOWS THE RUN. The row behind the sheet is the one being priced, so
             closing the sheet leaves the person exactly where the rhythm left them. */
          const want = (running ?? priceRun)[next];
          if (want) setPicked(want.key);
        }}
        onClose={() => setRunning(null)}
        dictate={dictate}
      />

      {/* ── §16.5 · THE PASTE DOOR ─────────────────────────────────────────────────────────── */}
      <PastePrices
        text={pricingAvailable ? pasting : null}
        onText={setPasting}
        reading={pastedRun}
        onClose={() => setPasting(null)}
        onRun={() => {
          const run = pastedRun.targets;
          setPasting(null);
          if (run.length > 0) openRun(run, null);
        }}
      />
    </Page>
  );
}
