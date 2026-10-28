/*
 * The only safe bridge from an operator-approved line option to customer-facing copy.
 * This module deliberately imports no sale, configuration, UI, model, or connector code so a
 * confirmation, document renderer, and future ERP adapter can use one identical filter without a
 * runtime cycle. It never reads `prepNote`, source wording, recurrence, or a catalogue proposal.
 */
export type CustomerOption = {
  text: string;
  audience: 'customer';
  status: 'approved';
  reviewId: string;
  sourceEventIds: string[];
  approvedBy: string;
  approvedAt: string;
};

export type CustomerOptionCarrier = { customerOption?: CustomerOption };

/** Returns a normalized, explicitly approved snapshot or nothing. It is defensive because a
 * persisted browser object and an external connector payload are both untrusted at this boundary. */
export function approvedCustomerOption(value: unknown): CustomerOption | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Partial<CustomerOption>;
  if (row.audience !== 'customer' || row.status !== 'approved'
    || typeof row.text !== 'string' || typeof row.reviewId !== 'string'
    || typeof row.approvedBy !== 'string' || typeof row.approvedAt !== 'string'
    || !Array.isArray(row.sourceEventIds)) return undefined;
  const text = row.text.trim();
  const reviewId = row.reviewId.trim();
  const approvedBy = row.approvedBy.trim();
  const sourceEventIds = [...new Set(row.sourceEventIds
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim()))];
  if (!text || text.length > 500 || !reviewId || !approvedBy || sourceEventIds.length === 0
    || !Number.isFinite(Date.parse(row.approvedAt))) return undefined;
  return { text, audience: 'customer', status: 'approved', reviewId, sourceEventIds, approvedBy, approvedAt: row.approvedAt };
}

/** Shared safety filter for customer confirmation, customer paper and future ERP adapters. */
export function customerOptionText(line: CustomerOptionCarrier): string | undefined {
  return approvedCustomerOption(line.customerOption)?.text;
}
