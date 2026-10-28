/** Exact English keys retired while Peter keeps the Spanish snapshots frozen.
 * Every record is reviewed with its source change; active, duplicate and unknown records fail.
 * Unlisted dead entries still fail the ordinary coverage gate. */
export const retirementKey = (entry) => JSON.stringify([
  entry.file, entry.source, entry.context, entry.kind, entry.english,
]);

export function frozenRetirementKeys(manifest, entries, alive) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.entries)) throw new Error('Use retirement manifest version 1.');
  const available = new Map(entries.map(entry => [retirementKey(entry), entry]));
  const retired = new Set();
  const fields = ['file', 'source', 'context', 'kind', 'english', 'sourceRevision', 'reason'];
  for (const row of manifest.entries) {
    if (!row || typeof row !== 'object' || Object.keys(row).some(key => !fields.includes(key))
      || fields.some(key => typeof row[key] !== 'string' || !row[key].trim())
      || !/^[a-f0-9]{40}$/.test(row.sourceRevision) || row.reason.trim().length < 10) {
      throw new Error('Each retirement needs an exact English key, source revision and reason.');
    }
    const key = retirementKey(row);
    const entry = available.get(key);
    if (!entry) throw new Error(`Unknown frozen English key: ${row.source} · ${row.english}`);
    if (retired.has(key)) throw new Error(`Duplicate retirement: ${row.source} · ${row.english}`);
    if (alive(entry)) throw new Error(`Active English key cannot be retired: ${row.source} · ${row.english}`);
    retired.add(key);
  }
  return retired;
}
