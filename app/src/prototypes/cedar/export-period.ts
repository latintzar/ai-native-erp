import type { ManualDocument, ManualSheet } from './manual-exports';

/** Optional metadata added by manual exports. A key identifies the source record for a row. */
type KeyedSheet = ManualSheet & { recordKeys?: string[] };

/** Stable, collision-safe namespace for a source record within one worksheet. */
export const recordCoverageKey = (sheetName: string, recordKey: string): string =>
  JSON.stringify([sheetName, recordKey]);

const isAligned = (sheet: KeyedSheet): sheet is KeyedSheet & { recordKeys: string[] } =>
  Array.isArray(sheet.recordKeys) && sheet.recordKeys.length === sheet.rows.length;

/**
 * Computes export coverage from the complete source document and, when requested, projects only
 * records not represented by the prior coverage. The source document is never mutated.
 *
 * A record's signature includes its worksheet name, its complete header and every one of that
 * record's rows. This deliberately keeps all lines of a changed sales order together.
 */
export function prepareExport(
  doc: ManualDocument,
  previous: Record<string, string>,
  remaining: boolean,
): { document: ManualDocument; coverage: Record<string, string>; updated: number } {
  const coverage: Record<string, string> = {};
  const recordsBySheet = new Map<KeyedSheet, Map<string, { indexes: number[]; signature: string }>>();
  let updated = 0;

  for (const original of doc.sheets) {
    const sheet = original as KeyedSheet;
    if (!isAligned(sheet)) continue;
    const indexesByRecord = new Map<string, number[]>();
    sheet.recordKeys.forEach((recordKey, index) => {
      if (!recordKey) return;
      const indexes = indexesByRecord.get(recordKey) ?? [];
      indexes.push(index);
      indexesByRecord.set(recordKey, indexes);
    });
    const records = new Map<string, { indexes: number[]; signature: string }>();
    for (const [recordKey, indexes] of indexesByRecord) {
      const key = recordCoverageKey(sheet.name, recordKey);
      const signature = JSON.stringify({ sheet: sheet.name, head: sheet.head, rows: indexes.map(index => sheet.rows[index]) });
      coverage[key] = signature;
      if (previous[key] !== undefined && previous[key] !== signature) updated += 1;
      records.set(recordKey, { indexes, signature });
    }
    recordsBySheet.set(sheet, records);
  }

  const sheets = doc.sheets.map(original => {
    const sheet = original as KeyedSheet;
    const records = recordsBySheet.get(sheet);
    if (!remaining || !records || !isAligned(sheet)) return {
      ...sheet,
      head: [...sheet.head],
      rows: sheet.rows.map(row => [...row]),
      ...(sheet.groups ? { groups: sheet.groups.map(group => ({ ...group })) } : {}),
      ...(sheet.recordKeys ? { recordKeys: [...sheet.recordKeys] } : {}),
    } as ManualSheet;

    const keep = new Set<number>();
    for (const [recordKey, record] of records) {
      const key = recordCoverageKey(sheet.name, recordKey);
      if (previous[key] !== record.signature) record.indexes.forEach(index => keep.add(index));
    }
    // Rows without a usable source key cannot be marked exported, so retain them rather than hide
    // them behind a coverage claim we cannot substantiate.
    sheet.recordKeys.forEach((recordKey, index) => { if (!recordKey) keep.add(index); });
    const keptOriginalIndexes = sheet.rows.map((_, index) => index).filter(index => keep.has(index));
    const newIndexOf = new Map(keptOriginalIndexes.map((index, projected) => [index, projected]));
    const groups = sheet.groups?.flatMap(group => {
      const members = keptOriginalIndexes.filter(index => index >= group.start && index <= group.end);
      if (!members.length) return [];
      return [{ start: newIndexOf.get(members[0])!, end: newIndexOf.get(members[members.length - 1])! }];
    });
    return {
      ...sheet,
      head: [...sheet.head],
      rows: keptOriginalIndexes.map(index => [...sheet.rows[index]]),
      recordKeys: keptOriginalIndexes.map(index => sheet.recordKeys[index]),
      ...(groups ? { groups } : {}),
    } as ManualSheet;
  });

  return { document: { ...doc, sheets, rows: sheets.reduce((total, sheet) => total + sheet.rows.length, 0) }, coverage, updated };
}
