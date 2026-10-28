import * as React from 'react';
import { useConfig } from './config';
import { collectionGuard, collectionOrigin } from './money-api';
import { commitMoneyImport, importCollection, moneyStateNow, useMoney } from './money-store';
import { readCollectionUpdates } from './money-live-api';
import { startLivePoll } from './live-sync';

/** One workspace subscription keeps Sales, invoice detail and Money on the same receipt ledger. */
export default function CollectionSync() {
  const { config } = useConfig();
  const money = useMoney(config.cast);
  const targets = [...new Set(money.state.requests.flatMap(item => item.remoteId ? [item.remoteId] : []))].sort().join('|');
  React.useEffect(() => {
    if (!targets || !collectionOrigin()) return;
    let cursor = '';
    const imported = new Map<string, string>();
    const poll = startLivePoll(async signal => {
      const current = collectionGuard(config.cast);
      const page = await readCollectionUpdates(config.cast, cursor);
      current();
      if (signal.aborted) return;
      let next = moneyStateNow(config.cast);
      const links = new Map(next.requests.filter(row => row.remoteId).map(row => [row.remoteId, row.invoiceId]));
      const saved: [string, string][] = [];
      for (const remote of page.requests) {
        const invoiceId = links.get(remote.id);
        if (!invoiceId) continue;
        const identity = JSON.stringify(remote);
        if (imported.get(remote.id) === identity) continue;
        const result = importCollection(config.cast, invoiceId, remote, next, false);
        if (!result.ok) throw new Error(result.error);
        next = result.state; saved.push([remote.id, identity]);
      }
      current();
      if (signal.aborted) return;
      if (saved.length) {
        const committed = commitMoneyImport(config.cast, next);
        if (!committed.ok) throw new Error(committed.error);
      }
      for (const [id, identity] of saved) imported.set(id, identity);
      cursor = page.cursor;
    });
    return poll.stop;
  }, [config.cast, targets]);
  return null;
}
