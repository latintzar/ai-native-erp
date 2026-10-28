import { parse } from '@babel/parser';
import { SPANISH_SNAPSHOT_DICTIONARY } from './spanish-dictionary';

export type SnapshotEntry = { source: string; context: string; kind: string; english: string; spanish: string };
export type SnapshotLookup = (source: string, context: string, kind: string, english: string) => string | undefined;

const visible = (value: string) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value) && value.length > 1;
const hiddenAttribute = /^(?:id|key|data-.*|className|href|to|path|route|hash|name|sku|unit|kind|type|size|color|font|role)$/i;
const ignoredParent = (node: any, parent: any) => parent?.type === 'ImportDeclaration' || parent?.type === 'ExportNamedDeclaration'
  || (parent?.type === 'JSXAttribute' && hiddenAttribute.test(parent.name?.name ?? ''));
const contextOf = (node: any, parent: any) => {
  const attribute = parent?.type === 'JSXAttribute' ? parent.name?.name : undefined;
  return `${parent?.type ?? 'Program'} > ${node.type}${attribute ? `:${attribute}` : ''}`;
};
const escapeTemplate = (value: string) => value.replace(/`/g, '\\`');
const placeholders = (value: string) => value.match(/\$\{[^}]+\}/g) ?? [];

/** Babel AST transform: JSX text, static visible literals and placeholder-preserving templates. */
export function translateSpanishSnapshotSource(sourceText: string, source: string, lookup?: SnapshotLookup): string | null {
  const ast = parse(sourceText, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: true });
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const find = (node: any, parent: any, kind: string, english: string) => {
    let reviewed = lookup?.(source, contextOf(node, parent), kind, english);
    if (!reviewed && english.trim() !== english) {
      const inner = lookup?.(source, contextOf(node, parent), kind, english.trim());
      if (inner) reviewed = (english.match(/^\s*/)?.[0] ?? '') + inner + (english.match(/\s*$/)?.[0] ?? '');
    }
    if (reviewed && reviewed !== english) return reviewed;
    /* The seed dictionary is deliberately limited to literal display seats. A string in a branch,
       state model or object data must have a reviewed source entry before it can change. */
    return node.type === 'JSXText' || parent?.type === 'JSXAttribute' || (node.type === 'StringLiteral' && !['BinaryExpression', 'TSLiteralType', 'SwitchCase'].includes(parent?.type) && !(parent?.type === 'ObjectProperty' && parent.key === node)) ? SPANISH_SNAPSHOT_DICTIONARY[english] : undefined;
  };
  const add = (node: any, parent: any, kind: string, english: string, text: string) => {
    if (!visible(english) || ignoredParent(node, parent)) return;
    const spanish = find(node, parent, kind, english);
    if (spanish && spanish !== english) edits.push({ start: node.start, end: node.end, text });
  };
  const visit = (node: any, parent: any = null): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXAttribute' && hiddenAttribute.test(node.name?.name ?? '')) return;
    if (['ImportDeclaration','ExportAllDeclaration','TSLiteralType'].includes(node.type)) return;
    if (node.type === 'ObjectProperty' && /^(?:id|key|kind|type|code|sku|sector|cast|family|unit|role|area|route|path|hash|testid|testId|className|data-.*|color|background|display|position|overflow|gridTemplate.*|font.*|align.*|justify.*|border.*|padding.*|margin.*|width|height|minWidth|maxWidth|flex.*|gap|selector)$/.test(node.key?.name ?? node.key?.value ?? '')) return;
    if (parent?.type === 'ObjectProperty' && parent.key === node) return;
    if ((parent?.type === 'SwitchCase' || (parent?.type === 'BinaryExpression' && parent.operator !== '+')) && node.type === 'StringLiteral') return;
    if (node.type === 'JSXText') {
      const lead = node.value.match(/^\s*/)?.[0] ?? '', tail = node.value.match(/\s*$/)?.[0] ?? '', english = node.value.trim();
      add(node, parent, 'jsx-text', english, `${lead}${find(node, parent, 'jsx-text', english)}${tail}`);
      return;
    }
    if (node.type === 'StringLiteral') {
      const english = node.value;
      const displaySeat = parent?.type === 'JSXAttribute' || parent?.type === 'JSXExpressionContainer'
        || parent?.type === 'ConditionalExpression'
        || (parent?.type === 'ObjectProperty' && /^(?:label|text|sentence|word|name|description|title|sub|lead|hint|placeholder)$/.test(parent.key?.name ?? parent.key?.value ?? ''))
        || (parent?.type === 'CallExpression' && parent.callee?.name === 'plural');
      if (/^[a-z][a-z0-9_-]*$/.test(english) && !displaySeat) return;
      const spanish = find(node, parent, 'literal', english);
      if (visible(english) && !ignoredParent(node, parent) && spanish && spanish !== english) {
        const text = parent?.type === 'JSXAttribute' ? `{${JSON.stringify(spanish)}}` : JSON.stringify(spanish);
        edits.push({ start: node.start, end: node.end, text });
      }
      return;
    }
    if (node.type === 'TemplateLiteral') {
      const english = node.quasis.map((q: any, i: number) => `${q.value.raw}${i < node.expressions.length ? `\${${sourceText.slice(node.expressions[i].start, node.expressions[i].end)}}` : ''}`).join('');
      const literalText = node.quasis.map((q: any) => q.value.raw).join('');
      const humanText = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(literalText) && /\s/.test(literalText)
        && !/\b(?:px|rem|vh|vw|ms)\b|(?:solid|rgba|translate|calc|minmax|data-testid|querySelector)\b|^(?:admin|desk|https?):?\//.test(literalText.trim());
      const displayTemplate = parent?.type === 'JSXAttribute' || parent?.type === 'JSXExpressionContainer';
      const spanish = humanText || displayTemplate ? find(node, parent, 'template', english) : undefined;
      if (visible(english) && spanish && spanish !== english) {
        const expressions = node.expressions.map((e: any) => sourceText.slice(e.start, e.end));
        const tokens = expressions.map((e: string) => '${' + e + '}');
        const unique = [...new Set(tokens)] as string[];
        const needed = new Map(unique.map((token) => [token, tokens.filter((v: string) => v === token).length]));
        const used = new Map<string, number>();
        let rest = spanish, body = '';
        while (rest) {
          const matches = unique.map((token) => ({ token, at: rest.indexOf(token) })).filter((m) => m.at >= 0).sort((a, b) => a.at - b.at);
          if (!matches.length) { body += rest.replace(/`/g, '\\`'); break; }
          const { token, at } = matches[0];
          const expr = token.slice(2, -1);
          const prefix = 'const __snapshotExpression = (';
          const wrapped = prefix + expr + ');';
          const translatedExpr = translateSpanishSnapshotSource(wrapped, source, lookup);
          const code = translatedExpr ? translatedExpr.slice(prefix.length, -2) : expr;
          body += rest.slice(0, at).replace(/`/g, '\\`') + '${' + code + '}';
          rest = rest.slice(at + token.length);
          used.set(token, (used.get(token) ?? 0) + 1);
        }
        if (unique.every((token) => needed.get(token) === used.get(token))) {
          edits.push({ start: node.start, end: node.end, text: '`' + body + '`' });
          return;
        }
      }
      node.expressions.forEach((expression: any) => visit(expression, node));
      return;
    }
    Object.entries(node).forEach(([key, value]) => {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') return;
      if (Array.isArray(value)) value.forEach((child) => visit(child, node));
      else visit(value, node);
    });
  };
  visit(ast.program);
  return edits.length ? edits.sort((a, b) => b.start - a.start).reduce((out, edit) => out.slice(0, edit.start) + edit.text + out.slice(edit.end), sourceText) : null;
}

export function lookupFromEntries(inputEntries: SnapshotEntry[]): SnapshotLookup {
  // Early fixture reviews used semantic kinds; resolve them to syntax kinds at this seam.
  const entries = inputEntries.flatMap((entry) => ['literal', 'template', 'jsx-text'].includes(entry.kind)
    ? [entry] : (entry.english.includes('${') ? ['template'] : ['literal', 'jsx-text'])
      .map((kind) => ({ ...entry, kind })));
  const exact = new Map(entries.filter((entry) => entry.spanish).map((entry) => [`${entry.source}\u0000${entry.context}\u0000${entry.kind}\u0000${entry.english}`, entry.spanish]));
  const bySourceAndEnglish = new Map(entries.filter((entry) => entry.spanish).map((entry) => [`${entry.source}\u0000${entry.kind}\u0000${entry.english}`, entry.spanish]));
  return (source, context, kind, english) => bySourceAndEnglish.get(`${source}\u0000${kind}\u0000${english}`) ?? exact.get(`${source}\u0000${context}\u0000${kind}\u0000${english}`);
}
