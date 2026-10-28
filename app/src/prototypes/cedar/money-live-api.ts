import { collectionOrigin, collectionOwnerRequest, parseRequest, type CollectionRequest } from './money-api';

export type CollectionUpdate = { cursor: string; changed: boolean; requests: CollectionRequest[] };

export async function readCollectionUpdates(scope: string, cursor = ''): Promise<CollectionUpdate> {
  const origin = collectionOrigin();
  if (!origin) throw new Error('Open payments in their connected workspace.');
  const raw = await collectionOwnerRequest<unknown>(scope, `/request-updates${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
  if (!raw || typeof raw !== 'object') throw new Error('Payment updates are reconnecting.');
  const row = raw as CollectionUpdate;
  if (typeof row.cursor !== 'string' || !/^[a-f0-9]{64}$/.test(row.cursor) || typeof row.changed !== 'boolean'
    || !Array.isArray(row.requests) || row.requests.length > 2000 || (!row.changed && (row.requests.length || row.cursor !== cursor))) {
    throw new Error('Payment updates are reconnecting.');
  }
  const requests = row.requests.map(value => parseRequest(value, origin));
  if (new Set(requests.map(value => value.id)).size !== requests.length) throw new Error('Payment updates are reconnecting.');
  return { cursor: row.cursor, changed: row.changed, requests };
}
