/*
 * Catalogue exports keep the reviewed mapping and product provenance, never the imported file or
 * its complete parsed cells. The active browser session may hold the selected source long enough to
 * re-download it or preserve its full layout. Reloading requires selecting the source again.
 * Older IndexedDB originals remain inaccessible until an explicit privacy cleanup is invoked.
 */
import * as React from 'react';
import { Button, KIND, SIZE } from 'baseui/button';
import { useStyletron } from 'baseui';
import {
  createOpaqueSourceRef,
  discardSessionSource,
  isOpaqueSourceRef,
  keepSessionSource,
  legacyOpaqueSourceRef,
  sessionSource,
  sessionSourceDetails,
} from './source-retention';

/** Category and family are distinct source facts. A legacy import has `family: -1`. */
export type CatalogueImportMapping = { name: number; unit: number; price: number; category: number; family: number; sku: number };
export type CatalogueImportSourceRow = { id?: string; cells: string[]; sourceRow: number };
export type CatalogueImportRow = CatalogueImportSourceRow & {
  id: string;
  /** Literal house SKU from the mapped source column; identity is separate from display/provenance. */
  code?: string;
  name: string;
  /** Current Product Unit: a known synonym is normalised, another supplied word stays literal. Empty needs review. */
  unit: string;
  /** Untouched source cell, retained only while this reviewed import is being accepted. */
  sourceUnit?: string;
  price?: number;
  /** Legacy single grouping value; carried through acceptance as evidence, never discarded. */
  said?: string;
  category?: string;
  family?: string;
};

export type CatalogueImportSheet = {
  columns: string[];
  mapped: CatalogueImportMapping;
  rows: CatalogueImportRow[];
  /** Every parsed source record, including duplicate product rows that must survive a house export. */
  sourceRows: CatalogueImportSourceRow[];
  lines: number;
  file: string;
  delimiter: ',' | ';';
  original?: File;
};

export type CatalogueExportProduct = {
  id: string;
  name: string;
  unit: string;
  code?: string;
  price: number;
  categoryId?: string;
  categoryName?: string;
  familyId: string;
  familyName: string;
  parentId?: string;
  relationship: string;
  trace: Record<string, string>;
  illustration?: string;
};

/** The durable, reviewed projection: enough to trace an import without preserving source cells. */
type RetainedSourceRow = { id?: string; sourceRow: number; originalSku?: string };
type RetainedImport = {
  version: 3;
  sector: string;
  importedAt: string;
  /** Opaque durable association; the original filename and column labels live only in memory. */
  sourceRef: string;
  mapped: CatalogueImportMapping;
  rows: RetainedSourceRow[];
  lines: number;
  delimiter: ',' | ';';
};

type JoinedProduct = CatalogueExportProduct & {
  sourceRow?: number;
  imported?: boolean;
  originalSku?: string;
};

const STORAGE_KEY = 'rocoto-app-catalogue-import-v1';
/** Only used by the explicit legacy-cleanup export; no reader or writer opens this database. */
const LEGACY_DB_NAME = 'rocoto-catalogue-imports';
const sessionSheets = new Map<string, CatalogueImportSheet>();
const listeners = new Set<() => void>();

const canStore = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const integer = (value: unknown): number => Number.isInteger(value) ? Number(value) : -1;
const mappedOf = (value: unknown): CatalogueImportMapping | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  return { name: integer(row.name), unit: integer(row.unit), price: integer(row.price), category: integer(row.category), family: integer(row.family), sku: integer(row.sku) };
};
/**
 * New records persist an opaque source ref. Older records may still contain a source filename,
 * column labels, or filename-derived key in localStorage; read only their reviewed mapping/row
 * identity and turn any old locator into an in-memory opaque alias. Do not rewrite or expose the
 * old source fields until the operator explicitly replaces the import or uses a privacy cleanup.
 */
function normalizeRecord(value: unknown, sector: string): RetainedImport | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const mapped = mappedOf(row.mapped);
  if (!mapped) return null;
  const rawRows = Array.isArray(row.rows) ? row.rows : [];
  const retainedRows: RetainedSourceRow[] = rawRows.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const sourceRow = integer(source.sourceRow);
    if (sourceRow < 0) return [];
    /* Do not reopen legacy parsed cells. A v1 source row can still contribute only its already
       reviewed identity/SKU; original columns remain unavailable until an operator reselects it. */
    const originalSku = typeof source.originalSku === 'string'
      ? source.originalSku
      : typeof source.code === 'string' ? source.code : undefined;
    return [{
      ...(typeof source.id === 'string' ? { id: source.id } : {}),
      sourceRow,
      ...(originalSku ? { originalSku } : {}),
    }];
  });
  const legacySeed = typeof row.sessionKey === 'string' ? row.sessionKey
    : typeof row.file === 'string' ? row.file
      : `${sector}:${typeof row.importedAt === 'string' ? row.importedAt : ''}`;
  const sourceRef = isOpaqueSourceRef(row.sourceRef) ? row.sourceRef : legacyOpaqueSourceRef(`catalogue:${legacySeed}`);
  return {
    version: 3,
    sector,
    importedAt: typeof row.importedAt === 'string' ? row.importedAt : '',
    sourceRef,
    mapped,
    rows: retainedRows,
    lines: Number.isFinite(row.lines) ? Number(row.lines) : retainedRows.length,
    delimiter: row.delimiter === ';' ? ';' : ',',
  };
}

function readRecord(sector: string): RetainedImport | null {
  if (!canStore()) return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    return normalizeRecord(stored[sector], sector);
  } catch {
    return null;
  }
}

function writeRecord(record: RetainedImport): boolean {
  if (!canStore()) return false;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    stored[record.sector] = record;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    listeners.forEach((notify) => notify());
    return true;
  } catch {
    return false;
  }
}

/** Explicit migration cleanup. It is never called on boot or import. */
export async function clearLegacyCatalogueImportFiles(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(LEGACY_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Rocoto tabs before clearing old catalogue files.'));
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Keep the original only in memory for this session. The stored projection supports traceability
 * and Rocoto-format exports after reload, but preserving a house spreadsheet layout requires the
 * operator to select the source again.
 */
export async function rememberCatalogueImport(sector: string, sheet: CatalogueImportSheet): Promise<boolean> {
  const previous = readRecord(sector);
  const importedAt = new Date().toISOString();
  const sourceRef = createOpaqueSourceRef();
  /* Sheet layout and its filename stay in this session; the durable record receives neither. */
  sessionSheets.set(sourceRef, sheet);
  if (sheet.original) keepSessionSource(sourceRef, sheet.original, { label: sheet.file });
  const rows: RetainedSourceRow[] = sheet.rows.map((row) => ({
    id: row.id,
    sourceRow: row.sourceRow,
    ...(row.code ? { originalSku: row.code } : {}),
  }));
  const remembered = writeRecord({
    version: 3,
    sector,
    importedAt,
    sourceRef,
    mapped: { ...sheet.mapped },
    rows,
    lines: sheet.lines,
    delimiter: sheet.delimiter,
  });
  if (!remembered) {
    sessionSheets.delete(sourceRef);
    discardSessionSource(sourceRef);
    return false;
  }
  /* A replacement source supersedes the old session-only cells and file immediately. */
  if (previous?.sourceRef && previous.sourceRef !== sourceRef) {
    sessionSheets.delete(previous.sourceRef);
    discardSessionSource(previous.sourceRef);
  }
  return true;
}

function useRetainedImport(sector: string): RetainedImport | null {
  const [record, setRecord] = React.useState(() => readRecord(sector));
  React.useEffect(() => {
    const refresh = () => setRecord(readRecord(sector));
    listeners.add(refresh);
    refresh();
    return () => { listeners.delete(refresh); };
  }, [sector]);
  return record;
}

const spreadsheetSafe = (value: unknown): string => {
  if (typeof value === 'number') return String(value);
  const text = value === undefined || value === null ? '' : String(value);
  const first = text.replace(/^[\s\u0000-\u001F\u007F\u200B-\u200D\uFEFF]+/, '').charAt(0);
  return /^[=+\-@]/.test(first) ? `'${text}` : text;
};

const csv = (rows: Array<Array<unknown>>): string => rows
  .map((row) => row.map((value) => `"${spreadsheetSafe(value).replace(/"/g, '""')}"`).join(','))
  .join('\r\n');

function download(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function joinedProducts(products: CatalogueExportProduct[], record: RetainedImport | null): JoinedProduct[] {
  const pairs: Array<[string, RetainedSourceRow]> = (record?.rows ?? [])
    .filter((row): row is RetainedSourceRow & { id: string } => Boolean(row.id))
    .map((row) => [row.id, row]);
  const source = new Map<string, RetainedSourceRow>(pairs);
  return products.map((product) => {
    const row = source.get(product.id);
    return {
      ...product,
      sourceRow: row?.sourceRow,
      imported: Boolean(row && record),
      originalSku: row?.originalSku,
    };
  });
}

const displayPrice = (price: number): string => Number.isFinite(price) ? price.toFixed(2) : '';

function houseRows(products: CatalogueExportProduct[], sheet: CatalogueImportSheet): string[][] {
  const current = new Map(products.map((product) => [product.id, product]));
  const used = new Set<string>();
  const retained = sheet.sourceRows.map((row) => {
    const product = row.id ? current.get(row.id) : undefined;
    if (row.id) used.add(row.id);
    const cells = [...row.cells];
    if (product) {
      if (sheet.mapped.sku >= 0 && product.code) cells[sheet.mapped.sku] = product.code;
      if (sheet.mapped.name >= 0) cells[sheet.mapped.name] = product.name;
      if (sheet.mapped.unit >= 0) cells[sheet.mapped.unit] = product.unit;
      if (sheet.mapped.price >= 0) cells[sheet.mapped.price] = displayPrice(product.price);
      if (sheet.mapped.category >= 0) cells[sheet.mapped.category] = product.categoryName ?? product.familyName;
      if (sheet.mapped.family >= 0) cells[sheet.mapped.family] = product.familyName;
    }
    return cells;
  });
  const newRows = products.filter((product) => !used.has(product.id)).map((product) => {
    const cells = Array.from({ length: Math.max(sheet.columns.length, 1) }, () => '');
    if (sheet.mapped.sku >= 0 && product.code) cells[sheet.mapped.sku] = product.code;
    if (sheet.mapped.name >= 0) cells[sheet.mapped.name] = product.name;
    else cells[0] = product.name;
    if (sheet.mapped.unit >= 0) cells[sheet.mapped.unit] = product.unit;
    if (sheet.mapped.price >= 0) cells[sheet.mapped.price] = displayPrice(product.price);
    if (sheet.mapped.category >= 0) cells[sheet.mapped.category] = product.categoryName ?? product.familyName;
    if (sheet.mapped.family >= 0) cells[sheet.mapped.family] = product.familyName;
    return cells;
  });
  return [...retained, ...newRows];
}

function houseSheet(products: CatalogueExportProduct[], sheet: CatalogueImportSheet): string[][] {
  if (sheet.columns.length > 0) return [sheet.columns, ...houseRows(products, sheet)];
  return [['Product', 'Unit', 'Current price'], ...products.map((product) => [product.name, product.unit, displayPrice(product.price)])];
}

function standardRows(products: CatalogueExportProduct[]): Array<Array<string | number>> {
  return [
    ['SKU', 'Product', 'Unit', 'Current price'],
    ...products.map((product) => [product.code ?? product.id, product.name, product.unit, product.price]),
  ];
}

function augmentedRows(products: CatalogueExportProduct[], record: RetainedImport | null): Array<Array<string | number>> {
  return [
    ['Rocoto SKU', 'Product', 'Unit', 'Current price', 'Original SKU', 'Category', 'Family', 'Family ID', 'Parent SKU', 'Relationship', 'Trace', 'Illustration reference', 'Import source', 'Imported row', 'Import recorded at', 'Provenance'],
    ...joinedProducts(products, record).map((product) => [
      product.id, product.name, product.unit, product.price, product.originalSku ?? '', product.categoryName ?? '', product.familyName,
      product.familyId, product.parentId ?? '', product.relationship,
      Object.entries(product.trace).map(([key, value]) => `${key}: ${value}`).join(' · '), product.illustration ?? '',
      product.imported ? 'Reviewed import' : '', product.sourceRow ?? '', product.imported ? record?.importedAt ?? '' : '',
      product.imported ? 'Reviewed import projection; the reviewed facts are what Rocoto keeps' : 'Current Rocoto catalogue; this row is Rocoto’s own',
    ]),
  ];
}

export function CatalogueExport({ sector, products }: { sector: string; products: CatalogueExportProduct[] }) {
  const [, theme] = useStyletron();
  const record = useRetainedImport(sector);
  const sessionSheet = record ? sessionSheets.get(record.sourceRef) : undefined;
  const sourceDetails = record ? sessionSourceDetails(record.sourceRef) : undefined;
  const original = record ? sessionSource(record.sourceRef) : undefined;
  const sourceLabel = sourceDetails?.label ?? sessionSheet?.file;
  const rows = products.length;
  const sourceRows = record?.lines ?? 0;

  const originalDownload = () => {
    if (!record || !original) return;
    const url = URL.createObjectURL(original);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = sourceLabel || 'catalogue-source.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const option = (title: string, detail: string, action: () => void, disabled = false, id?: string) => (
    <div key={title} style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${theme.colors.borderOpaque}`, padding: `${theme.sizing.scale400} 0`, minWidth: 0 }}>
      <div style={{ minWidth: 0 }}>
        <div style={theme.typography.LabelSmall}>{title}</div>
        <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{detail}</div>
      </div>
      <Button kind={KIND.secondary} size={SIZE.compact} disabled={disabled} onClick={action} data-testid={id}>Download</Button>
    </div>
  );

  return (
    <div data-testid="catalogue-export" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      <div>
        <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {rows} current {rows === 1 ? 'product' : 'products'} · {record ? `${sourceRows} reviewed source rows${sourceLabel ? ` from ${sourceLabel}` : ''}` : 'Upload a catalogue to record its mapping'}
        </div>
      </div>
      {option('Original file', original ? 'Available for this browser session only.' : record ? 'Select the source file again to download it.' : 'Upload a catalogue to make its source available for this browser session.', originalDownload, !original, 'catalogue-export-original')}
      {option('Your spreadsheet layout', sessionSheet ? 'Your current source columns and extra notes, with current catalogue details.' : record ? 'Select the source file again to rebuild its original layout.' : 'Import a CSV first to create a reviewed mapping.', () => { if (sessionSheet) download(`rocoto-${sector}-catalogue-house.csv`, csv(houseSheet(products, sessionSheet))); }, !sessionSheet, 'catalogue-export-house')}
      {option('Standard CSV', `${rows} current products with code, unit and current price.`, () => download(`rocoto-${sector}-catalogue.csv`, csv(standardRows(products))), false, 'catalogue-export-standard')}
      {option('Rocoto CSV', 'Current catalogue details, product relationships and reviewed source provenance.', () => download(`rocoto-${sector}-catalogue-rocoto.csv`, csv(augmentedRows(products, record))), false, 'catalogue-export-augmented')}
      <div data-testid="catalogue-export-preview" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary, paddingTop: theme.sizing.scale200 }}>
        Rocoto stores the reviewed mapping and catalogue facts. Select the source again after a reload.
      </div>
    </div>
  );
}
