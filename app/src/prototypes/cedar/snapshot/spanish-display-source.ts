/** WHOSE BROWSER STATE THE SPANISH ENTRY WRITES INTO.
 *
 *  `separate` (the default, and what `npm run build:app-es` publishes): the standalone snapshot is a
 *  disposable demo, so its `rocoto-app-` keys become `rocoto-spanish-app-` and trying it leaves the
 *  English design data alone.
 *
 *  `shared`: the Spanish entry published INSIDE the development artifact at `/cedar/es/` is the same
 *  workspace in the other language. A person switching language mid-demo keeps their day, their
 *  orders and their setup, so the prefix stays as the English entry wrote it. `build-english-app.mjs`
 *  selects this for its own sub-build; the standalone command keeps its own namespace.
 */
export type SpanishDisplayOptions = { sharedState?: boolean };


/* ── THE FOUR SHIPPED OUTPUT NAMES, SHOWN IN SPANISH WHERE THEY ARE RENDERED ──────────────────
 * A SHIPPED OUTPUT'S NAME IS COPY; A RENAMED ONE IS THE PERSON'S OWN WORDS. The day header, the
 * print screen and the library rows read the name off the template RECORD, and inside the
 * development artifact the two entries share one unprefixed store key (`rocoto:outputs:templates`).
 * So a seed-dictionary entry translated the name where it was SEEDED — `output-templates.ts` —
 * and whichever entry ran first wrote its language into the record both of them read back: open
 * `/cedar/es/` in a fresh profile and the English Sales day header then said «Albaranes · 32 left»
 * (FEED-IA §246 review). The record stays one language-neutral set of English shipped names, and
 * the four are mapped HERE, at the render sites, by source and snapshot only. Anything typed
 * passes through untouched, the way `__snapshotStatus` treats a state value.
 *
 * `{template.name}` covers both seats it occupies — a JSX expression and, with the `$` in front of
 * it, a template-literal hole — while `name: template.name`, `useState(template.name)` and
 * `value={template.name}` keep the record's own English, because those WRITE it. */
const OUTPUT_NAMES = "{ 'Delivery notes':'Albaranes', 'Packing list':'Lista de preparación', 'Packing sheets':'Listas de preparación', 'Day sheet':'Hoja del día' }";
const OUTPUT_NAME_ADAPTER = `const __snapshotOutputName = (value: string) => (${OUTPUT_NAMES} as Record<string,string>)[value] ?? value;\n`;

const OUTPUT_NAME_SOURCES: ReadonlyArray<string> = [
  'src/prototypes/cedar/areas/sales.tsx',
  'src/prototypes/cedar/print-screen.tsx',
  'src/prototypes/cedar/shell/printing.tsx',
  'src/prototypes/cedar/print-view.tsx',
];

function withOutputNames(source: string, code: string): string {
  let out = code;
  if (source === 'src/prototypes/cedar/areas/sales.tsx') {
    /* Every seat, including the day's packing seat, now prints the record's own name (OUT-03), so
       the one regex covers them all; the literal «Packing list» the seat once printed is gone. */
    out = out.replace(/((?:[A-Za-z_$][\w$]*\.)*template\.name)\b/g, '__snapshotOutputName($1)');
  }
  if (source === 'src/prototypes/cedar/print-screen.tsx') {
    out = out.replace(/(?<!value=)\{template\.name\}/g, '{__snapshotOutputName(template.name)}');
    out = out.split(': [template.name];').join(': [__snapshotOutputName(template.name)];');
    out = out.split(': template.name;').join(': __snapshotOutputName(template.name);');
  }
  if (source === 'src/prototypes/cedar/shell/printing.tsx') {
    out = out.split('{template.name}').join('{__snapshotOutputName(template.name)}');
  }
  if (source === 'src/prototypes/cedar/print-view.tsx') {
    out = out.split('document="Packing list"').join('document="Lista de preparación"');
  }
  return out.includes('__snapshotOutputName') ? OUTPUT_NAME_ADAPTER + out : out;
}

/** Snapshot-only presentation adapters; model keys and the English source stay unchanged. */
export function prepareSpanishDisplaySource(code: string, source: string, options: SpanishDisplayOptions = {}): string {
  let out = code;
  if (!options.sharedState) out = out.replace(/(['"])rocoto-app-/g, '$1rocoto-spanish-app-');
  if (source === 'src/prototypes/cedar/areas/sales.tsx') {
    // The list filter is plural; the per-document archive status remains singular.
    out = out.replace(/(id: 'archived', label: )"Archivado"/, '$1"Archivados"');
  }
  if (source === 'src/prototypes/cedar/customer-profile.tsx') {
    out = out.split('${s.state}').join('${__snapshotStatus(s.state)}');
    out = `const __snapshotStatus = (value: string) => ({ arrived:'Recibido', read:'Leído', parsed:'Interpretado', proposed:'Propuesto', draft:'Borrador', ready:'Listo', made:'Albarán creado', committed:'Confirmado', picked:'Preparado', printed:'Impreso', sent:'Enviado', delivered:'Entregado', disputed:'En revisión', settled:'Resuelto', archived:'Archivado' } as Record<string,string>)[value] ?? value;\n` + out;
  }
  if (source === 'src/prototypes/cedar/areas/stock.tsx') {
    out = out.split('${m.amendment.facet}').join('${__snapshotFacet(m.amendment.facet)}');
    out = `const __snapshotFacet = (value: string) => ({state:'conservación', preparation:'preparación', origin:'origen', size:'calibre', grade:'clase', format:'formato', cut:'corte', packing:'presentación', variety:'variedad', condition:'conservación'} as Record<string,string>)[value] ?? value;\n` + out;
  }
  if (source === 'src/prototypes/cedar/product-card.tsx') {
    out = out.replace("family: 'Family'", "family: 'Familia'").replace("type: 'Kind'", "type: 'Tipo de producto'").replace("l.level === 'Family'", "l.level === 'Familia'");
  }
  if (OUTPUT_NAME_SOURCES.includes(source)) out = withOutputNames(source, out);
  if (source === 'src/prototypes/cedar/areas/admin/connections.tsx') {
    /* THE ONE ATTRIBUTE THE TRANSFORM WILL NEVER TOUCH. `name` is on the hidden list, because a
       customer's name, a product's name and a supplier's name all ride on it and none of them is
       ours to translate. Connections uses the same prop for its GROUP and CARD headings, so those
       nine reviewed words are made here, by source, rather than by loosening that rule for
       everybody. Provider brands keep their own spelling. */
    for (const [english, spanish] of [
      ['Banking', 'Banca'], ['Bank account', 'Cuenta bancaria'], ['Payments', 'Cobros'],
      ['Electronic invoices', 'Facturas electrónicas'], ['Communications', 'Comunicaciones'],
      ['Email', 'Correo'], ['Phone', 'Teléfono'],
    ] as Array<[string, string]>) out = out.split(`name="${english}"`).join(`name="${spanish}"`);
  }
  if (source === 'src/prototypes/cedar/areas/admin/plan.tsx') {
    out = out.split("'/mo'").join("'/mes'").split('unit="an order"').join('unit="por pedido"').split('unit="for the month"').join('unit="por mes"');
  }
  return out;
}
