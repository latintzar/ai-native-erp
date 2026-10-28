/** Deterministic sample source projection. Existing sales own customer, product and source IDs. */
import type { Sale, ThreadRow } from './sale';
import { moneyWorkspace } from './money-seed';
import type { EmailMessage } from './email-api';

export function cedarEmailExamples(scope: string, sales: Sale[]) {
  const clock = moneyWorkspace(scope).referenceAt;
  return sales.filter(sale => sale.thread.some(row => row.email)).slice(0, 5).map(sale => ({
    synthetic: true as const, mode: 'sample' as const, saleId: sale.id, customerId: sale.customer.id,
    productIds: sale.lines.map(line => line.product.id), lineIds: sale.lines.map(line => line.id), at: clock, rows: sale.thread.filter(row => row.email),
  }));
}

export function mailboxThreadRows(messages: EmailMessage[], accountLabel: string): ThreadRow[] {
  return messages.map(message => ({ id: message.source_ref, kind: 'message',
    author: message.from.some(address => address.toLowerCase() === accountLabel.toLowerCase()) ? 'sent' : 'received',
    text: message.body, time: Number.isFinite(Date.parse(message.at)) ? new Intl.DateTimeFormat('en-GB',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(message.at)) : '',
    email: { subject: message.subject, from: message.from.join(', '), to: message.to,
      source: { sourceRef: message.source_ref, provider: message.mode === 'forwarded' ? 'forwarded' : message.provider === 'google' ? 'gmail' : message.provider === 'outlook' ? 'm365' : 'forwarded' } },
  }));
}

/** A refreshed current page updates its messages while retaining previously opened history. */
export function mergeMailboxMessages(previous: EmailMessage[], incoming: EmailMessage[]): EmailMessage[] {
  const rows = new Map(previous.map(message => [message.source_ref, message]));
  for (const message of incoming) rows.set(message.source_ref, message);
  return [...rows.values()].sort((left, right) => {
    const at = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
    return at(left.at) - at(right.at) || left.source_ref.localeCompare(right.source_ref);
  });
}
