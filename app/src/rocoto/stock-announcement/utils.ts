/* GROWN from Base Web's own `src/template-component/` scaffold.
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 */
import * as React from 'react';

/** Base's controlled/uncontrolled pair, in one hook: a prop when the consumer supplies one,
 *  the component's own state when it does not. `undefined` means "uncontrolled"; `null` is a
 *  value like any other, which is what lets `photo={null}` mean "there is no document". */
export function useControlled<T>(controlled: T | undefined, initial: T): [T, (next: T) => void] {
  const [own, setOwn] = React.useState<T>(initial);
  return [controlled === undefined ? own : controlled, setOwn];
}

/** What a person may type into a quantity: digits, at most one decimal separator, and — LEADING
 *  the whole thing — the mark that says the number is an ABOUT.
 *
 *  «WE HAVE ABOUT 60 BOXES» IS A CLAIM, NOT A ROUNDING (§17.4 · §17.8). Real stock is counted by
 *  eye across a cold room and the honest entry for it is `~60`; a field that silently dropped the
 *  tilde would store 60 as though somebody had counted it, which is the fake precision the whole
 *  section exists to refuse. So the mark is a character of the entry, kept only in first position
 *  (a tilde in the middle of a number means nothing), and every reader below knows about it.
 *
 *  ONE MARK, TWO KEYBOARDS. `~` is what a Spanish keyboard reaches with AltGr and what a paste
 *  from a spreadsheet carries; `≈` is what an autocorrect leaves behind. Both are taken, `~` is
 *  kept, and the surface draws whichever it draws. */
export function sanitise(raw: string): string {
  let out = '';
  let separated = false;
  let about = false;
  for (const ch of raw) {
    if ((ch === '~' || ch === '≈') && !about && out.length === 0) about = true;
    else if (ch >= '0' && ch <= '9') out += ch;
    else if ((ch === ',' || ch === '.') && !separated && out.length > 0) {
      out += ',';
      separated = true;
    }
  }
  return about ? `~${out}` : out;
}

/** Is this entry an about? The one reader of the mark, so no surface tests for a character. */
export const isApprox = (value: string): boolean => value.startsWith('~');

/** The typed string as a number. An entry with no digit in it is worth nothing, and `hasNumber`
 *  is what the submit reads — so this never has to return a lie for an empty field. The about
 *  mark is not part of the arithmetic: `~60` IS sixty, held approximately. */
export function toNumber(value: string): number {
  const n = Number(value.replace('~', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export const hasNumber = (value: string): boolean => /\d/.test(value);

/** The number as it would be typed — the inverse of `toNumber`, used when a document's proposal
 *  arrives in the field and when a hand-set number is put back to the document's. */
export function toEntry(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',').replace(/,0+$/, '');
}

/** A file the camera or the picker handed over, as a source the preview can paint. */
export function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** «As of 14:32, 22 Aug» — an announcement is a statement about a moment, so the moment is on
 *  the panel. Given the surface's own locale, because the stamp is read, not parsed. */
export function formatStamp(at: Date, locale: string): string {
  return at.toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(at: Date, locale: string): string {
  return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
