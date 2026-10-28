/** The lender's document, drawn on fixed A4 pages from the same model as the workspace. */
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import regularUrl from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import boldUrl from '@fontsource/inter/files/inter-latin-700-normal.woff?url';
import { DOSSIER_CONSENT_WORDS, dayWords, dossierSourceWords, dossierWindowWords, preparedWords, shareWords,
  sharedWords, type Dossier, type DossierSectionId } from './dossier';

export type DossierPdfPalette = { ink: string; muted: string; line: string; paper: string; faint?: string };
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 44;
const WIDTH = A4[0] - MARGIN * 2;

type Row = { label: string; value: string; note?: string };

/** PDF colours are supplied by the active theme's semantic tokens. */
function colour(value: string) {
  const hex = value.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map(part => part + part).join('') : hex;
    return rgb(parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255); // theme-gate-allow: convert the supplied semantic theme token to PDF channels
  }
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (channels && channels.length >= 3) return rgb(channels[0] / 255, channels[1] / 255, channels[2] / 255); // theme-gate-allow: preserve the supplied semantic theme token in PDF colour space
  throw new Error('Choose a theme colour for the document.');
}

/** The fonts come from the same checked-in Inter dependency as the app's typography. */
async function fontBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Load the document font, then try again.');
  return response.arrayBuffer();
}

export async function createDossierPdf(dossier: Dossier, money: (minor: number) => string, palette: DossierPdfPalette, signal?: AbortSignal): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([fontBytes(regularUrl, signal), fontBytes(boldUrl, signal)]);
  const regular = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const ink = colour(palette.ink), muted = colour(palette.muted), line = colour(palette.line), paper = colour(palette.paper), faint = colour(palette.faint ?? palette.muted);
  document.setTitle(`Lender dossier · ${dossier.identity.legalName}`);
  document.setAuthor(dossier.identity.legalName);
  document.setCreator('Rocoto');
  const prepared = new Date(dossier.preparedAt);
  document.setCreationDate(prepared);
  document.setModificationDate(prepared);
  let page!: PDFPage; // newPage initializes the page before any content is drawn.
  let y = 0;

  const lines = (value: string, font: PDFFont, size: number, width: number): string[] => {
    const result: string[] = [];
    for (const paragraph of String(value).split(/\r?\n/)) {
      let current = '';
      for (const word of paragraph.split(/[ \t]+/).filter(Boolean)) {
        const joined = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(joined, size) <= width) { current = joined; continue; }
        if (current) { result.push(current); current = ''; }
        // Long business names retain every character when they wrap across the fixed measure.
        for (const part of word) {
          if (current && font.widthOfTextAtSize(current + part, size) > width) { result.push(current); current = part; }
          else current += part;
        }
      }
      result.push(current);
    }
    return result;
  };
  const text = (value: string, x: number, top: number, size = 10, strong = false, tone = ink, width = WIDTH): number => {
    const font = strong ? bold : regular;
    const wrapped = lines(value, font, size, width);
    wrapped.forEach((row, index) => page.drawText(row, { x, y: top - index * (size + 4), size, font, color: tone }));
    return wrapped.length * (size + 4);
  };
  const newPage = () => {
    page = document.addPage(A4);
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: paper });
    const headerHeight = text(dossier.identity.legalName, MARGIN, A4[1] - 35, 9, true, ink, WIDTH * 0.6);
    const stamp = preparedWords(dossier.preparedDay);
    text(stamp, A4[0] - MARGIN - regular.widthOfTextAtSize(stamp, 8), A4[1] - 35, 8, false, muted);
    const ruleY = A4[1] - 35 - headerHeight;
    page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: A4[0] - MARGIN, y: ruleY }, thickness: 0.6, color: line });
    y = ruleY - 30;
  };
  const room = (height: number) => { if (y - height < 57) newPage(); };
  const paragraph = (value: string, strong = false, size = 10, tone = ink) => {
    const height = lines(value, strong ? bold : regular, size, WIDTH).length * (size + 4);
    room(height + 8 + Math.max(0, size - 10)); y -= Math.max(0, size - 10);
    y -= text(value, MARGIN, y, size, strong, tone); y -= 8;
  };
  const row = ({ label, value, note }: Row) => {
    const labelWidth = WIDTH * 0.49, valueWidth = WIDTH - labelWidth - 12;
    const height = Math.max(lines(label, regular, 9, labelWidth).length * 13,
      lines(value, bold, 10, valueWidth).length * 14) + (note ? lines(note, regular, 8, WIDTH).length * 12 + 3 : 0) + 12;
    room(height);
    const used = Math.max(text(label, MARGIN, y, 9, false, muted, labelWidth),
      text(value, MARGIN + labelWidth + 12, y, 10, true, ink, valueWidth));
    y -= used + 4;
    if (note) y -= text(note, MARGIN, y, 8, false, muted) + 3;
    y -= 8;
  };
  const section = (id: DossierSectionId, title: string, values: Row[]) => {
    room(92);
    y -= 8;
    const number = String(['identity', 'movements', 'collections', 'order-book', 'risk', 'consents'].indexOf(id) + 1).padStart(2, '0');
    page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: A4[0] - MARGIN, y: y + 12 }, thickness: 0.7, color: line });
    y -= text(`${number}   ${title}`, MARGIN, y, 15, true) + 3;
    y -= text(dossierSourceWords(dossier.evidence[id]), MARGIN, y, 8, false, muted) + 12;
    for (const value of values) row(value);
    y -= 5;
  };
  const { identity, movements, collections, orderBook, risk, capacity, operating } = dossier;
  const summaryGrid = (items: { label: string; value: string }[]) => {
    const column = WIDTH / items.length;
    room(62);
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: A4[0] - MARGIN, y: y + 4 }, thickness: 1, color: ink });
    items.forEach((item, index) => {
      text(item.value, MARGIN + index * column, y - 20, 19, true, ink, column - 12);
      text(item.label, MARGIN + index * column, y - 40, 8, false, muted, column - 12);
    });
    y -= 65;
  };
  newPage();
  paragraph('Lender dossier', true, 10, muted);
  paragraph(identity.legalName, true, 30);
  paragraph(`RUC ${identity.ruc} · ${identity.address}`, false, 10, muted);
  paragraph(`Operational and financial record · ${dossierWindowWords(movements.window.from, movements.window.to)}`, false, 9, muted);
  summaryGrid([
    { label: 'Recorded orders', value: orderBook.orders.toLocaleString('en-GB') },
    { label: 'Order lines', value: operating.orderLines.toLocaleString('en-GB') },
    { label: 'Customers served', value: String(operating.customers) },
    { label: 'Matched receipts', value: operating.matchedReceipts.toLocaleString('en-GB') },
  ]);
  paragraph('Business overview', true, 14);
  paragraph(`From ${dossierWindowWords(orderBook.window.from, orderBook.window.to)}, ${operating.customers} customers placed ${orderBook.orders.toLocaleString('en-GB')} orders worth ${money(orderBook.valueMinor)}. ${operating.repeatCustomers} customers ordered repeatedly, accounting for ${shareWords(operating.repeatOrderBasisPoints)} of orders.`, false, 10);
  section('identity', 'Identity', [
    { label: 'Legal name', value: identity.legalName }, { label: 'RUC', value: identity.ruc },
    { label: 'Owner', value: identity.owner }, { label: 'Receiving account', value: identity.receivingAccount },
  ]);
  section('movements', 'Movements', [
    { label: 'Money in', value: money(movements.inflowMinor), note: `${movements.inflowCount} bank receipts` },
    { label: 'Invoiced', value: money(movements.issuedMinor), note: `${movements.issuedCount} invoices` },
    { label: 'Average daily balance', value: money(movements.averageDailyBalanceMinor),
      note: dossierWindowWords(movements.balanceWindow.from, movements.balanceWindow.to) },
    { label: 'Balance today', value: money(movements.closingBalanceMinor) },
  ]);
  newPage();
  section('collections', 'Collections', [
    { label: 'Requests sent', value: String(collections.requestsSent) },
    { label: 'Paid', value: `${collections.paid} · ${money(collections.paidMinor)}` },
    { label: 'Success rate', value: shareWords(collections.successBasisPoints) },
    { label: 'Average time to pay', value: dayWords(collections.averageDaysToPay) },
  ]);
  paragraph('Payment behaviour', true, 13);
  paragraph(`Matched receipts and recorded reminders · ${dossierWindowWords(movements.window.from, movements.window.to)}`, false, 8, muted);
  row({ label: 'Split payments', value: `${operating.splitPaymentInvoices} invoices`, note: 'Two or more matched receipts on the same invoice' });
  row({ label: 'Part-paid invoices', value: String(operating.partPaidInvoices), note: `${money(operating.partPaidOutstandingMinor)} still due` });
  row({ label: 'Reminders recorded', value: String(operating.reminders), note: `${operating.remindedInvoices} invoices contacted` });
  row({ label: 'Paid after a reminder', value: `${operating.paidAfterReminder} invoices`, note: money(operating.paidAfterReminderMinor) });
  y -= 12;
  paragraph('Repayment capacity', true, 13);
  paragraph(`From this workspace's receipts, ${dossierWindowWords(capacity.window.from, capacity.window.to)}`, false, 9, muted);
  row({ label: 'Received last month', value: money(capacity.takingsMinor) });
  if (capacity.requestedMinor > 0) {
    row({ label: 'Requested advance', value: money(capacity.requestedMinor) });
    if (capacity.ratioBasisPoints !== null) paragraph(
      `${shareWords(capacity.ratioBasisPoints)} of the previous month's takings`, false, 10, muted);
  }
  newPage();
  section('order-book', 'Order book', [
    { label: 'Orders per week', value: String(orderBook.ordersPerWeek), note: `${orderBook.orders} orders in this window` },
    { label: 'Average ticket', value: money(orderBook.averageTicketMinor) },
    { label: 'Repeat customers', value: `${operating.repeatCustomers} of ${operating.customers}` },
    { label: 'Orders from repeat customers', value: shareWords(operating.repeatOrderBasisPoints), note: `${operating.repeatOrders} orders` },
    { label: 'Delivered orders', value: String(operating.deliveredOrders), note: `${operating.deliveryDays} delivery days` },
    { label: 'Products traded', value: String(operating.products), note: `${operating.orderLines.toLocaleString('en-GB')} order lines` },
  ]);
  paragraph('Delivered orders by week', true, 11);
  paragraph(`Delivered and settled orders · current week through ${dossierWindowWords(dossier.preparedDay, dossier.preparedDay)}`, false, 8, muted);
  room(115);
  const maxOrders = Math.max(1, ...orderBook.weeks.map(week => week.delivered));
  const column = WIDTH / Math.max(1, orderBook.weeks.length);
  orderBook.weeks.forEach((week, index) => {
    const height = week.delivered / maxOrders * 68;
    page.drawRectangle({ x: MARGIN + column * index, y: y - 70, width: Math.max(1, column - 5), height, color: ink });
  });
  y -= 84;
  text(dossierWindowWords(orderBook.window.from, orderBook.window.from), MARGIN, y, 8, false, muted);
  text(dossierWindowWords(orderBook.window.to, orderBook.window.to), MARGIN + WIDTH - 58, y, 8, false, muted, 58);
  y -= 24;
  paragraph('Where the takings come from', true, 11);
  if (orderBook.topCustomers.length) {
    const first = orderBook.topCustomers[0], next = orderBook.topCustomers.slice(1);
    const nextMinor = next.reduce((sum, customer) => sum + customer.valueMinor, 0);
    const nextShare = next.reduce((sum, customer) => sum + customer.shareBasisPoints, 0);
    const parts = [
      { name: first.name, minor: first.valueMinor, share: first.shareBasisPoints, colour: ink },
      { name: `Next ${next.length} customers`, minor: nextMinor, share: nextShare, colour: muted },
      { name: 'Every other customer', minor: orderBook.valueMinor - first.valueMinor - nextMinor,
        share: 10_000 - first.shareBasisPoints - nextShare, colour: faint },
    ];
    room(125);
    let x = MARGIN;
    for (const part of parts) {
      const width = WIDTH * Math.max(0, part.share) / 10_000;
      page.drawRectangle({ x, y: y - 5, width, height: 8, color: part.colour }); x += width;
    }
    y -= 24;
    for (const part of parts) row({ label: part.name, value: `${money(part.minor)} · ${shareWords(part.share)}` });
  }
  for (const customer of orderBook.topCustomers) row({ label: `${customer.name} · ${customer.orders} orders`,
    value: `${money(customer.valueMinor)} · ${shareWords(customer.shareBasisPoints)}` });
  newPage();
  section('risk', 'Risk signals', [
    { label: 'Overdue invoices', value: `${risk.overdue.count} · ${money(risk.overdue.amountMinor)}` },
    { label: 'Average days late', value: dayWords(risk.overdue.averageDaysLate) },
    { label: 'Disputed orders', value: `${risk.disputed.count} · ${shareWords(risk.disputed.shareBasisPoints)}` },
  ]);
  paragraph('Orders by weekday', true, 11);
  for (const weekday of risk.weekdays) {
    room(29);
    const width = WIDTH * 0.48 * weekday.shareBasisPoints / 10000;
    text(weekday.name, MARGIN, y, 9, false, muted, 100);
    page.drawRectangle({ x: MARGIN + 100, y: y - 1, width, height: 5, color: ink });
    text(`${weekday.orders} · ${shareWords(weekday.shareBasisPoints)}`, MARGIN + WIDTH - 90, y, 9, true, ink, 90);
    y -= 23;
  }
  y -= 12;
  paragraph('Unit price range', true, 11);
  for (const price of risk.prices) row({ label: price.product,
    value: price.steady ? money(price.averageMinor) : `${money(price.minMinor)} – ${money(price.maxMinor)}`,
    note: `${price.lines} lines · average ${money(price.averageMinor)}` });
  section('consents', 'Consents', dossier.consents.map(consent => ({ label: DOSSIER_CONSENT_WORDS[consent.kind],
    value: sharedWords(consent.at).replace('PDF prepared ', '') })));
  if (!dossier.consents.length) paragraph('Bank access, repayment and document preparation records appear here with their dates.', false, 9, muted);
  const pages = document.getPages();
  pages.forEach((item, index) => {
    page = item;
    text('Rocoto · Lender dossier', MARGIN, 28, 8, false, muted);
    text(`${index + 1} / ${pages.length}`, A4[0] - MARGIN - 25, 28, 8, false, muted, 40);
  });
  return document.save();
}
