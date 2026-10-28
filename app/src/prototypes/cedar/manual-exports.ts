/** Manual-entry files. See THE-EXPORT-CANON §18: a file never certifies an ERP import. */
import type { Cast } from '../../scenarios/data/cast';
import type { Sale } from './sale';
import { recordedStock, lotBook, rowsOf, type IncomingEvent } from './incoming';
import type { Sheet } from './export-files';
import { capabilityAvailable } from './release-profile';
import { workspaceCapabilitiesNow, workspaceCapabilityEnabled, type WorkspaceCapabilities } from './workspace-capabilities';
import { isExactEquivalence, productUnitEquivalences } from './units';
import { CODE_PENDING } from './product-code';
import { countryCurrency, syntheticAmountForCountry } from './currency';

export type TemplateId = 'sales-customers' | 'stock-lots' | 'purchase-receipts' | 'daily-pack' | 'customers' | 'products' | 'tariff-prices';
export const MANUAL_TEMPLATES = [
  { id: 'sales-customers', family: 'Sales', name: 'Sales by customer', purpose: 'Enter each customer’s orders, one document at a time.', shape: 'Customer sections · article codes · quantities · lots on each line', sample: '02-ventas-por-cliente.xlsx' },
  { id: 'stock-lots', family: 'Stock', name: 'Stock by product and lot', purpose: 'Enter the stock you have recorded at a specific time.', shape: 'One product per row · all lot / quantity pairs', sample: '01-existencias-por-lote.xlsx' },
  { id: 'purchase-receipts', family: 'Stock', name: 'Incoming purchases by lot', purpose: 'Enter goods received, using their supplier documents.', shape: 'Supplier · receipt reference · article code · lot · quantity received', sample: '04-entradas-de-compra.xlsx' },
  { id: 'daily-pack', family: 'Stock + Sales', name: 'Daily entry pack', purpose: 'Stock and customer sales together for your daily entry job.', shape: 'Two separate registers in one workbook · choose the stock timing before entry', sample: '03-entrada-diaria-stock-y-ventas.xlsx' },
  { id: 'customers', family: 'Customers', name: 'Customer list', purpose: 'Match existing accounts before entering new customers.', shape: 'Rocoto ID · ERP code to map · name · assigned tariff', sample: '05-clientes.xlsx' },
  { id: 'products', family: 'Products', name: 'Product list', purpose: 'Copy your own codes and units when the catalogue changes.', shape: 'Article code · independent variants · one Unit · explicit conversions', sample: '06-productos.xlsx' },
  { id: 'tariff-prices', family: 'Prices', name: 'Prices by tariff', purpose: 'Enter today’s prices and any later corrections.', shape: 'One product and tariff per row · price · currency · unit', sample: '07-precios-por-tarifa.xlsx' },
] as const;

/** The full template library stays designed; the active profile exposes only truthful sources. */
export const activeManualTemplates = (
  capabilities: WorkspaceCapabilities = workspaceCapabilitiesNow(),
) => MANUAL_TEMPLATES.filter((template) => {
  if (template.id === 'stock-lots' || template.id === 'purchase-receipts' || template.id === 'daily-pack') return capabilities.inventory;
  if (template.id === 'tariff-prices') return capabilities.pricing;
  return true;
});

export type ManualContext = { cast: Cast; sales: Sale[]; ledger: IncomingEvent[]; day: string; stockAsOf: string; period?: { from: string; to: string }; stockProducts?: Cast['products']; tiers?: Array<{ id: string; name: string }>; priceOn?: (product: Cast['products'][number], tier: string) => number; priceSource?: (product: Cast['products'][number], tier: string) => string };
export type ManualSheet = Sheet & { recordKeys?: string[]; groups?: Array<{ start: number; end: number }>; note?: string };
export type ManualDocument = { sheets: ManualSheet[]; warnings: string[]; rows: number };
const n = (value: number | undefined): number | string => Number.isFinite(value) ? value! : '';
const date = (at: Date) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
const explicitConversions = (cast: Cast, product: Cast['products'][number]): string =>
  productUnitEquivalences(cast.sector, product)
    .filter((row) => row.source !== 'legacy-pack' && isExactEquivalence(row))
    .map((row) => `1 ${row.unit} = ${n(row.quantity)} ${row.baseUnit} · ${row.scope === 'tenant' ? 'Global conversion' : 'This product'}`)
    .join('\n');

export function manualDocument(id: TemplateId, context: ManualContext): ManualDocument {
  const { cast, sales, ledger, day, stockAsOf } = context;
  const country = workspaceCapabilitiesNow(cast.sector).country;
  const currency = countryCurrency(country);
  const sheets: ManualSheet[] = [];
  const warnings = new Set<string>();
  if (id === 'customers') {
    const pricing = workspaceCapabilityEnabled('pricing');
    const erp = capabilityAvailable('erpAutomation');
    const head = ['Rocoto customer ID', ...(erp ? ['ERP customer code'] : []), 'Customer', ...(pricing ? ['Tariff'] : []), 'Main channel', 'Area', 'Review'];
    const rows = cast.customers.map(c => [c.id, ...(erp ? [''] : []), c.name, ...(pricing ? [context.tiers?.find(t => t.id === c.tier)?.name ?? c.tier] : []), c.channel, c.zone ?? '', '']);
    sheets.push({ name: 'Customers', recordKeys: cast.customers.map(c => `customer:${c.id}`), head, rows });
    if (erp) warnings.add('ERP customer codes stay blank until each account mapping is confirmed.');
  }
  if (id === 'products') {
    sheets.push({
      name: 'Products',
      recordKeys: cast.products.map(p => `product:${p.id}`),
      head: ['Rocoto item ID', 'Code', 'Product', 'Internal category', 'Unit', 'Explicit conversions', 'Variable weight', 'Review'],
      rows: cast.products.map(p => [
        p.id, p.code ?? '', p.name, cast.families.find(f => f.id === p.family)?.name ?? 'Needs review',
        p.unit, explicitConversions(cast, p),
        p.variableWeight ? 'Yes' : 'No', !p.code ? CODE_PENDING : '',
      ]),
    });
  }
  if (id === 'tariff-prices') {
    sheets.push({ name: 'Precios por tarifa', recordKeys: cast.products.flatMap(p => (context.tiers ?? []).map(t => `price:${day}:${p.id}:${t.id}`)), head: ['Fecha consultada', 'ID Rocoto', 'Código artículo', 'Producto', 'ID tarifa Rocoto', 'Tarifa', 'Precio registrado', 'Moneda', 'Unidad de precio', 'Origen'], rows: cast.products.flatMap(p => (context.tiers ?? []).map(t => [day, p.id, p.code ?? '', p.name, t.id, t.name, n(syntheticAmountForCountry(context.priceOn?.(p, t.id) ?? Number.NaN, country)), currency, p.unit, context.priceSource?.(p, t.id) ?? 'Revisar origen'])) });
    warnings.add('Precios consultados en Rocoto; la descarga es una lectura y el ERP mantiene los suyos. Las excepciones por cliente requieren un perfil aparte.');
  }
  if (id === 'sales-customers' || id === 'daily-pack') {
    const inventory = workspaceCapabilityEnabled('inventory');
    const valued = capabilityAvailable('albaranValues') && workspaceCapabilityEnabled('pricing');
    const erp = capabilityAvailable('erpAutomation');
    const active = sales.filter(s => !s.archived).sort((a, b) => a.customer.name.localeCompare(b.customer.name) || a.customer.id.localeCompare(b.customer.id) || a.number.localeCompare(b.number));
    const human: ManualSheet = {
      name: 'Sales by customer',
      head: ['Customer', 'Delivery Note', 'Code', 'Product', 'Quantity', 'Unit', ...(inventory ? ['Lot allocations'] : []), ...(valued ? ['Unit price', 'Line total', 'Currency'] : []), 'Final weight (kg)', ...(erp ? ['ERP customer code'] : []), 'Notes / review', 'Delivery date'],
      rows: [], recordKeys: [], groups: [],
      note: valued ? 'One row per Delivery Note line. Values use the accepted document revision.' : 'One row per Delivery Note line. This order-review profile exports quantities and units only.',
    };
    let group: { start: number; end: number } | undefined;
    let customer = '';
    for (const sale of active) {
      if (sale.customer.id !== customer) { group = { start: human.rows.length, end: human.rows.length }; human.groups!.push(group); customer = sale.customer.id; }
      for (const line of sale.lines.filter(l => !l.off)) {
        const checks: string[] = [];
        if (!line.product.code) checks.push(CODE_PENDING);
        if (line.product.variableWeight && !Number.isFinite(line.finalWeight)) checks.push('Confirm final weight');
        if (line.unreadable || line.nonSku) checks.push('Review line');
        const lotDetail = inventory ? (line.allocations?.length
          ? line.allocations.map(allocation => `${allocation.batch}: ${Number.isFinite(allocation.qty) ? String(allocation.qty).replace('.', ',') : 'quantity pending'} ${line.product.unit}`).join('\n')
          : `${line.lot || 'Lot pending'}: quantity unassigned (${line.product.unit})`) : undefined;
        if (inventory && !line.allocations?.length) warnings.add('Some lines leave their lot quantity unassigned. The figures stand as recorded.');
        const unitPrice = valued && Number.isFinite(line.price) ? syntheticAmountForCountry(line.price, country) : '';
        const lineTotal = valued && Number.isFinite(line.price) ? syntheticAmountForCountry(line.given * line.price, country) : '';
        human.rows.push([
          sale.customer.name, sale.number, line.product.code ?? '', line.product.name, n(line.given), line.unit,
          ...(inventory ? [lotDetail ?? ''] : []), ...(valued ? [unitPrice, lineTotal, currency] : []), n(line.finalWeight),
          ...(erp ? [''] : []), checks.join(' · '), sale.day,
        ]);
        human.recordKeys!.push(`sale:${sale.day}:${sale.id}`);
        if (group) group.end = human.rows.length - 1;
      }
    }
    if (erp) warnings.add('ERP customer codes stay blank until each account mapping is confirmed.');
    if (human.rows.some(r => r[2] === '')) warnings.add('Some order lines have a code pending.');
    sheets.push(human);
  }
  if (id === 'stock-lots' || id === 'daily-pack') {
    const summary: ManualSheet = { name: 'Stock por producto', head: ['Código artículo', 'Producto', 'Unidad', 'Stock registrado', 'Momento del stock', 'Revisión'], rows: [], recordKeys: [], note: 'Existencias registradas en Rocoto, tal y como las tiene la casa.' };
    const products = (context.stockProducts ?? cast.products).map(original => {
      const current = cast.products.find(p => p.id === original.id);
      const product = { ...original, name: current?.name ?? original.name, code: current?.code ?? original.code };
      const events = rowsOf(ledger, product.id).filter(event => event.kind !== 'rule');
      const units = [...new Set(events.filter(e => e.effect !== 'record').map(e => e.unit))];
      const mixed = units.length > 1;
      const recorded = { ...product, unit: units[0] ?? product.unit };
      return { product: recorded, events, mixed, standing: mixed ? undefined : recordedStock(events), lots: mixed ? [] : lotBook(cast, recorded, events) };
    }).filter(p => p.events.length);
    const maxLots = Math.max(1, ...products.map(p => p.lots.length));
    for (let i = 1; i <= maxLots; i++) summary.head.push(`Lote ${i}`, `Cantidad lote ${i}`);
    const hasMixed = products.some(p => p.mixed);
    if (hasMixed) summary.head.push('Movimientos originales a revisar');
    for (const { product, events, standing, lots, mixed } of products) {
      const totalLots = lots.reduce((sum, lot) => sum + lot.left, 0);
      const mismatch = standing !== undefined && Math.abs(totalLots - standing.standing) > 0.005;
      const review = [mixed ? 'Unidades mezcladas: revisar movimientos' : '', standing?.approx ? 'Aproximado' : '', lots.some(lot => lot.approx) ? `Lotes aproximados: ${lots.filter(lot => lot.approx).map(lot => lot.code).join(', ')}` : '', mismatch ? 'Stock y lotes difieren' : '', !product.code ? 'Falta código artículo' : ''].filter(Boolean).join(' · ');
      if (mismatch) warnings.add('Algunos totales de stock difieren de sus lotes. Se muestran ambos, tal y como están registrados.');
      const row: Array<string | number> = [product.code ?? '', product.name, mixed ? 'Ver movimientos' : product.unit, n(standing?.standing), stockAsOf, review];
      for (const lot of lots) {
        row.push(lot.code, n(lot.left));
      }
      while (row.length < 6 + maxLots * 2) row.push('');
      if (hasMixed) row.push(mixed ? events.map(event => `${event.id} · ${event.at.toISOString()} · ${event.effect} · ${event.lot || 'sin lote'} · ${n(event.qty)} ${event.unit}`).join('\n') : '');
      summary.rows.push(row);
      summary.recordKeys!.push(`stock:${stockAsOf.slice(0, 10)}:${product.id}`);
    }
    warnings.add('Stock según el registro de Rocoto; revisar su conciliación con las ventas y el ERP antes de teclearlo.');
    if (id === 'daily-pack') warnings.add('Antes de entrar el pack, confirmar si este stock es anterior o posterior a las ventas. Entrar stock de cierre y después descontar las mismas ventas duplicaría la salida.');
    sheets.unshift(summary);
    if (hasMixed) warnings.add('Hay productos con movimientos en distintas unidades. Sus totales quedan vacíos hasta conciliar la conversión; los movimientos originales aparecen en su misma fila.');
  }
  if (id === 'purchase-receipts') {
    const receipts: ManualSheet = { name: 'Entradas de compra', head: ['ID entrada Rocoto', 'Proveedor', 'Nº albarán proveedor', 'Referencia del documento', 'Fecha', 'Código artículo', 'Producto', 'Lote', 'Cantidad recibida', 'Unidad', 'Revisión'], rows: [], recordKeys: [], note: 'Entradas positivas; proveedor desconocido queda vacío. Abonos, recuentos y reglas de stock se excluyen; el stock actual va en su propia hoja.' };
    for (const event of ledger.filter(e => e.effect === 'delta' && e.qty > 0 && e.paper !== 'abono' && (context.period ? date(e.at) >= context.period.from && date(e.at) <= context.period.to : date(e.at) === day))) {
      const product = cast.products.find(p => p.id === event.product) ?? context.stockProducts?.find(p => p.id === event.product);
      receipts.rows.push([event.id, cast.suppliers.find(s => s.id === event.supplier)?.name ?? event.supplier ?? '', '', event.file?.name ?? event.subject ?? '', date(event.at), product?.code ?? '', product?.name ?? event.product, event.lot ?? '', n(event.qty), event.unit, [!event.supplier ? 'Falta proveedor' : '', !event.lot ? 'Falta lote' : '', !product?.code ? 'Falta código artículo' : '', event.approx ? 'Aproximado' : ''].filter(Boolean).join(' · ')]);
    }
    receipts.recordKeys = ledger.filter(e => e.effect === 'delta' && e.qty > 0 && e.paper !== 'abono' && (context.period ? date(e.at) >= context.period.from && date(e.at) <= context.period.to : date(e.at) === day)).map(e => `receipt:${e.id}`);
    warnings.add('El número de albarán del proveedor se verifica en el documento; el lote y el nombre de archivo quedan aparte.');
    sheets.push(receipts);
  }
  return { sheets, warnings: [...warnings], rows: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0) };
}

export async function workbookBytes(doc: ManualDocument, context: Pick<ManualContext, 'day' | 'stockAsOf'>, palette: { ink: string; paper: string; muted: string }): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'Rocoto';
  book.created = new Date();
  const color = (value: string) => { const hex = value.replace('#', '').toUpperCase(); return hex.length === 6 ? `FF${hex}` : hex; };
  book.title = 'Rocoto · Archivo de trabajo';
  book.subject = `Archivo de trabajo · ${context.day}`;
  book.keywords = 'Rocoto, exportación';
  for (const sheet of doc.sheets) {
    const ws = book.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 3 }], pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.addRow([`${sheet.name} · ${context.day}`]);
    ws.mergeCells(1, 1, 1, sheet.head.length);
    ws.addRow([sheet.name === 'Stock por producto' ? `Stock a ${context.stockAsOf}` : `Periodo: ${context.day}`]);
    ws.mergeCells(2, 1, 2, sheet.head.length);
    ws.addRow(sheet.head);
    sheet.rows.forEach(row => ws.addRow(row));
    ws.columns.forEach((column, i) => { column.width = /Lotes y|Movimientos originales/.test(sheet.head[i]) ? 42 : /Producto|Cliente|Revisi|Referencia/.test(sheet.head[i]) ? 27 : 18; });
    if (!sheet.groups) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, ws.rowCount), column: sheet.head.length } };
    for (const group of sheet.groups ?? []) if (group.end > group.start) ws.mergeCells(group.start + 4, 1, group.end + 4, 1);
    ws.eachRow((row, index) => {
      const source = index > 3 ? sheet.rows[index - 4] : [];
      const lines = Math.max(1, ...source.map(value => typeof value === 'string' ? value.split('\n').length : 1));
      row.height = index === 1 ? 28 : index === 2 ? 36 : index === 3 ? 32 : Math.max(34, lines * 16 + 8);
      row.eachCell(cell => {
        cell.font = { name: 'Calibri', size: index === 1 ? 14 : index === 2 ? 10 : 11, color: { argb: color(palette.ink) }, bold: index === 1 || index === 3 };
        cell.alignment = { vertical: 'top', wrapText: true };
        if (index === 1 || index === 3) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color(palette.muted) } };
        if (typeof cell.value === 'number') cell.numFmt = '0.###';
        else if (typeof cell.value === 'string' && index > 3) cell.numFmt = '@';
      });
    });
    ws.pageSetup.printTitlesRow = '1:3';
    ws.headerFooter.oddFooter = '&LRocoto&R&P / &N';
  }
  return await book.xlsx.writeBuffer() as ArrayBuffer;
}

export async function downloadManual(id: TemplateId, context: ManualContext, palette: { ink: string; paper: string; muted: string }): Promise<number> {
  return downloadDocument(manualDocument(id, context), `rocoto-${id}-${context.day}`, context, palette);
}

export async function downloadDocument(doc: ManualDocument, name: string, context: Pick<ManualContext, 'day' | 'stockAsOf'>, palette: { ink: string; paper: string; muted: string }): Promise<number> {
  const bytes = await workbookBytes(doc, context, palette);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name.replace(/[^a-zA-Z0-9À-ÿ._-]+/g, '-')}.xlsx`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return doc.rows;
}
