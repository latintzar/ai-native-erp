import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } });
if (!values['output-dir']) throw new Error('Usage: extract-i18n.mjs --output-dir /tmp/rocoto-i18n');
const outputDir = path.resolve(values['output-dir']);
const sourceRoots = ['src/prototypes/cedar', 'src/scenarios', 'src/rocoto'];
const files = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(file);
  else if (/\.(?:ts|tsx)$/.test(file) && !file.includes('/_parked/')) files.push(file);
});
sourceRoots.map((source) => path.join(root, source)).forEach(walk);

const hiddenKey = /^(?:id|key|testid|data-|className|href|to|path|route|hash|name|sku|unit|kind|type|size|color|font|role)$/i;
const styleKey = /^(?:display|position|top|right|bottom|left|width|height|minWidth|maxWidth|minHeight|maxHeight|margin|padding|gap|flex|grid|alignItems|justifyContent|overflow|whiteSpace|textOverflow|border|borderTop|borderBottom|borderRadius|background|boxShadow|cursor|opacity|transform|transition|zIndex|lineHeight|fontWeight|fontFamily|letterSpacing|textTransform)$/;
const looksVisible = (text) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(text) && text.length > 1 && !/^(?:https?:|\/|#|[\w.-]+\.(?:tsx?|svg|png|webp)|[\w:-]+)$/.test(text);
const contextOf = (node, parent) => `${parent?.type ?? 'Program'} > ${node.type}`;
const partitionOf = (source) => source.includes('src/scenarios/') || source.includes('src/rocoto/')
  ? 'scenarios' : source.includes('src/prototypes/cedar/areas/admin/') || source.includes('src/prototypes/cedar/shell/') || /(?:printing|config|connect|catalogue-export)/.test(source)
    ? 'settings' : 'core';
const output = { core: [], settings: [], scenarios: [] };

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: true });
  const source = path.relative(root, file);
  const add = (node, parent, kind, english) => {
    const text = english.trim();
    if (!looksVisible(text)) return;
    const attribute = parent?.type === 'JSXAttribute' ? parent.name?.name : undefined;
    const objectKey = parent?.type === 'ObjectProperty' && (parent.key?.name ?? parent.key?.value);
    if (parent?.type === 'ImportDeclaration' || parent?.type === 'ExportNamedDeclaration' || parent?.type === 'TSLiteralType' || (attribute && hiddenKey.test(attribute)) || (objectKey && (hiddenKey.test(objectKey) || styleKey.test(objectKey)))) return;
    output[partitionOf(source)].push({ source, context: attribute ? `${contextOf(node, parent)}:${attribute}` : contextOf(node, parent), kind, english: text, spanish: '' });
  };
  const visit = (node, parent = null) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXText') add(node, parent, 'jsx-text', node.value);
    if (node.type === 'StringLiteral') add(node, parent, 'literal', node.value);
    if (node.type === 'TemplateLiteral') {
      const english = node.quasis.map((part, index) => `${part.value.raw}${index < node.expressions.length ? `\${${code.slice(node.expressions[index].start, node.expressions[index].end)}}` : ''}`).join('');
      add(node, parent, 'template', english);
      return;
    }
    Object.entries(node).forEach(([key, value]) => {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') return;
      if (Array.isArray(value)) value.forEach((child) => visit(child, node));
      else visit(value, node);
    });
  };
  visit(ast.program);
}
fs.mkdirSync(outputDir, { recursive: true });
for (const [partition, entries] of Object.entries(output)) {
  const deduped = entries.filter((entry, index, all) => index === all.findIndex((candidate) => candidate.source === entry.source && candidate.context === entry.context && candidate.english === entry.english));
  fs.writeFileSync(path.join(outputDir, `${partition}.json`), `${JSON.stringify({ generatedFrom: 'Babel AST', entries: deduped }, null, 2)}\n`);
  console.log(`${partition}: ${deduped.length}`);
}
