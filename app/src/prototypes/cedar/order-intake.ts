/** Real-model order reading for provider messages, with a conservative local review fallback. */
import type { Customer } from '../../scenarios/data/cast';
import { channelApi } from './cedar-channel-api';
import { todayId, type SourceArrivalLine } from './sale';
import { sourceReferenceDay } from './scenario-clock';
import { readTestMessage, type TestWorld } from './test-chat';

export type SourceOrderReading = {
  isOrder: boolean;
  needsReply: boolean;
  deliveryDay: string | null;
  lines: SourceArrivalLine[];
  intelligence: { mode: 'model' | 'heuristic'; model?: string };
};

type RuntimeReading = {
  isOrder: boolean;
  needsReply?: boolean;
  deliveryDay: string | null;
  mode: 'model';
  lines: Array<{
    rawText: string; item: string; qty: number | null; unit: string;
    productId: string | null; confidence: 'low' | 'medium' | 'high';
  }>;
  evidence: { model: string; ms: number; tokens: number };
};

const localReading = (text: string, sourceEvent: string, at: string, customer: Customer, world: TestWorld): SourceOrderReading => {
  const reading = readTestMessage(world, { kind: 'existing', customer }, text, sourceEvent, at);
  // The fallback admits a product only when its amount was written. Everything it admits remains
  // in review; broad classification belongs to the configured model above this seam.
  const proposals = reading.proposed.filter(proposal => proposal.product && proposal.qty !== undefined);
  return {
    isOrder: proposals.length > 0,
    needsReply: proposals.length > 0 || Boolean(reading.sale.needsReply),
    deliveryDay: null,
    lines: proposals.map(proposal => ({
      product: proposal.product!.id,
      word: proposal.said,
      qty: proposal.qty,
      unit: proposal.unit,
      confidence: 'low',
    })),
    intelligence: { mode: 'heuristic' },
  };
};

export async function readSourceOrder(a: {
  text: string; sourceEvent: string; at: string; customer: Customer; world: TestWorld;
  occurredAt?: string; signal?: AbortSignal;
}): Promise<SourceOrderReading> {
  let result: RuntimeReading;
  try {
    result = await channelApi<RuntimeReading>('/orders/parse', { body: {
      text: a.text,
      sourceEvent: a.sourceEvent,
      customerId: a.customer.id,
      referenceDay: sourceReferenceDay(a.occurredAt, todayId(a.world.cast)),
      products: a.world.cast.products.map(product => ({
        id: product.id, name: product.name, unit: product.unit,
      })),
    }, timeoutMs: 65000, signal: a.signal });
  } catch (error) {
    if (a.signal?.aborted) throw error;
    return localReading(a.text, a.sourceEvent, a.at, a.customer, a.world);
  }
  return {
    isOrder: result.isOrder,
    needsReply: result.needsReply ?? result.isOrder,
    deliveryDay: result.deliveryDay,
    lines: result.lines.map(line => ({
      ...(line.productId ? { product: line.productId } : {}),
      word: line.item,
      ...(line.qty === null ? {} : { qty: line.qty }),
      unit: line.unit || a.world.cast.products.find(product => product.id === line.productId)?.unit || 'kg',
      confidence: line.confidence,
      evidence: line.rawText,
    })),
    intelligence: { mode: 'model', model: result.evidence.model },
  };
}
