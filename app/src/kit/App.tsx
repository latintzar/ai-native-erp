/* The Rocoto design system — the canonical reference.
 *
 * Uber's docs shape, literally: the sidebar lists COMPONENTS by name under quiet family headers,
 * one page per component. Family files hold the content; the SectionFilter context carves one
 * component's Section out of its family file per route, so authors write one file per family and
 * the reference still reads one page per component.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { dots, DOT_TILE } from '../rocoto-theme';
import { SectionFilter, slug } from './chrome';
import { Table } from 'baseui/table-semantic';
import propsData from './props.json';

/** specs are generated from the component's own types.ts — never hand-written, never drifting */
const PROPS: Record<string, { type: string; props: Array<{ name: string; optional: boolean; type: string; doc: string }> }> = {};
for (const [k, v] of Object.entries(propsData as Record<string, any>)) PROPS[slug(k)] = v;

/** Uber's OWN docs taxonomy, verbatim (bw-docs/routes.jsx) — UI names, zero themes.
 *  Each entry: [display title (Uber's), slug (matches Section t=), which family file holds it]. */
const MAP: Array<{ cat: string; items: Array<[string, string, string]> }> = [
  /* Writing comes first because the strings come first: every component below renders copy, and
   * the copy has a canon (notes/THE-CONTENT-CANON.md, FEED-IA §75.8). Uber's own docs keep the
   * content pages next to the components for the same reason. */
  { cat: 'Writing', items: [
    ['Voice & tone','voicetone','writing'], ['Writing for users','writingforusers','writing'],
    ['Spanish mechanics','mechanics','writing'], ['Overflow register','overflow','writing'],
    ['The four lenses','lenses','writing'],
  ]},
  { cat: 'Inputs', items: [
    ['Button','button','buttons'], ['Button Dock','buttondock','buttons'], ['Button Group','buttongroup','buttons'],
    ['Button Timed','buttontimed','buttons'], ['Checkbox','checkbox','fields'], ['Combobox','combobox','pickers'],
    ['Fields','fields','app-primitives'],
    ['Form Control','formcontrol','fields'], ['Input','input','fields'], ['Payment Card','paymentcard','pickers'],
    ['Phone Input','phoneinput','pickers'], ['Pin Code','pincode','pickers'], ['Segmented Control','segmentedcontrol','buttons'],
    ['Radio','radio','fields'], ['Slider','slider','fields'], ['Sliding Button','slidingbutton','buttons'],
    ['Signature Pad','signaturepad','signature-pad'],
    ['Stock Announcement','stockannouncement','stock-announcement'], ['Weight Entry','weightentry','weight-entry'],
    ['Tiers Editor','tierseditor','app-primitives'],
    ['Stepper','stepper','fields'], ['Switch','switch','fields'], ['Textarea','textarea','fields'],
  ]},
  { cat: 'Pickers', items: [
    ['File Uploader','fileuploader','files-map'], ['File Uploader Basic','fileuploaderbasic','files-map'],
    ['Menu','menu','pickers'], ['Rating','rating','pickers'], ['Select','select','pickers'],
  ]},
  { cat: 'Date & Time', items: [
    ['Datepicker','datepicker','time'], ['Time Picker','timepicker','time'], ['Timezone Picker','timezonepicker','time'],
  ]},
  { cat: 'Navigation', items: [
    ['Bottom Navigation','bottomnavigation','navigation'], ['Breadcrumbs','breadcrumbs','navigation'],
    ['Navigation Bar','applicationnavigationbar','navigation'], ['Header Navigation','headernavigation','navigation'],
    ['Link','link','navigation'], ['Mobile Header','mobileheader','navigation'], ['Page Control','pagecontrol','layout'],
    ['Profile Seat','profileseat','app-primitives'],
    ['Pagination','pagination','tables'], ['Side Navigation','sidenavigation','navigation'],
    ['Tabs','tabs','content'], ['Tabs (Motion)','tabsmotion','content'],
  ]},
  { cat: 'Conversation', items: [
    ['Message','message','message'], ['Composer','composer','composer'],
    ['Voice Button','voicebutton','voice-button-kit'], ['Waveform','waveform','waveform'],
    ['Transcript','transcript','transcript'], ['Chat Embeds','chatembeds','app-primitives'],
  ]},
  { cat: 'Content', items: [
    ['Accordion','accordion','content'], ['Avatar','avatar','content'], ['Badge','badge','content'],
    ['Notification Circle','notificationcircle','feedback'], ['Hint Dot','hintdot','feedback'],
    ['Drag and Drop List','dndlist','tables'], ['Layout Grid','layoutgrid','layout'], ['Heading','heading','navigation'],
    ['Icon','icon','navigation'], ['List','list','layout'], ['Message Card','messagecard','feedback'],
    ['Tag','tag','content'], ['Tag Group','taggroup','content'], ['Tile','tile','layout'],
    ['Tree View','treeview','tables'], ['Typography','typography','navigation'],
    ['Figure','figure','figure'], ['Gallery','gallery','gallery'], ['Memory Log','memorylog','memory-log'],
    ['Produce Icons','produceicons','produce-icons'],
    ['Price Accordion','priceaccordion','price-accordion'],
    ['Product Card','productcard','app-primitives'], ['Painted Tile','paintedtile','app-primitives'],
    ['Object Door','objectdoor','app-primitives'],
  ]},
  { cat: 'Tables', items: [
    ['Table','table','tables'], ['Data Table','datatable','tables'],
    ['Grid Table','tablegrid','tables'], ['Semantic Table','tablesemantic','tables'],
  ]},
  { cat: 'Progress & Validation', items: [
    ['Banner','banner','feedback'], ['System Banner','systembanner','feedback'], ['Empty State','emptystate','feedback'],
    ['Notification','notification','feedback'], ['Progress Bar','progressbar','feedback'],
    ['Progress Steps','progresssteps','feedback'], ['Skeleton','skeleton','feedback'],
    ['Snackbar','snackbar','feedback'], ['Spinner','spinner','feedback'], ['Toast','toast','feedback'],
  ]},
  { cat: 'Surfaces', items: [
    ['Card','card','content'], ['Dialog','dialog','overlays'], ['Drawer','drawer','overlays'],
    ['Modal','modal','overlays'], ['Overlay Card','overlaycard','overlay-card'],
    ['Popover','popover','overlays'], ['Tooltip','tooltip','overlays'],
  ]},
  { cat: 'Map marker', items: [
    ['Fixed Marker','fixedmarker','files-map'], ['Floating Marker','floatingmarker','files-map'],
    ['Floating Route Marker','floatingroutemarker','files-map'], ['Location Puck','locationpuck','files-map'],
  ]},
  { cat: 'Charts', items: [
    ['Line Chart','linechart','charts'], ['Bar Chart','barchart','charts'], ['Area Chart','areachart','charts'],
  ]},
  { cat: 'Utility', items: [
    ['Aspect Ratio Box','aspectratiobox','layout'], ['Block','block','navigation'], ['Divider','divider','navigation'],
    ['Flex Grid','flexgrid','layout'], ['Ghost','ghost','ghost'], ['Keycap','keycap','app-primitives'],
    ['Layer','layer','layout'],
  ]},
];

const LOADERS = import.meta.glob('./sections/*.tsx') as Record<string, () => Promise<{ default: React.ComponentType }>>;
const keyOf = (p: string) => p.replace('./sections/', '').replace('.tsx', '');
const AVAILABLE = new Set(Object.keys(LOADERS).map(keyOf));
const LAZY: Record<string, React.LazyExoticComponent<React.ComponentType>> = {};
for (const [p, load] of Object.entries(LOADERS)) LAZY[keyOf(p)] = React.lazy(load);

/** route: #/<slug> — one page per component, Uber-style */
const FLAT: Array<{ title: string; slug: string; file: string; cat: string }> = MAP.flatMap((g) =>
  g.items.map(([title, slug, file]) => ({ title, slug, file, cat: g.cat }))
);
const useRoute = (): [string, (slug: string) => void] => {
  const parse = () => window.location.hash.replace(/^#\//, '') || 'button';
  const [r, set] = React.useState(parse);
  React.useEffect(() => {
    const on = () => set(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [r, (slug) => { window.location.hash = `#/${slug}`; }];
};

export default function App() {
  const [css, theme] = useStyletron();
  const [route, go] = useRoute();
  const entry = FLAT.find((e) => e.slug === route) ?? FLAT[0];
  const here = AVAILABLE.has(entry.file);
  // `as`-cast rather than annotation: tsc treats the annotated form as always-defined (TS2774)
  const Current = LAZY[entry.file] as React.LazyExoticComponent<React.ComponentType> | undefined;

  return (
    <div className={css({ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', '@media (max-width: 767px)': { display: 'block' } })} style={{
      backgroundImage: dots(theme.colors.mono400),
      backgroundSize: (theme as unknown as { brand?: { dotTile: string } }).brand?.dotTile ?? DOT_TILE,
      backgroundColor: theme.colors.mono100,
      minHeight: '100vh',
      fontFamily: theme.typography.ParagraphMedium.fontFamily,

    }}>
      <div className={css({ display: 'none', '@media (max-width: 767px)': { display: 'block', padding: theme.sizing.scale600, backgroundColor: theme.colors.backgroundPrimary } })}>
        <label htmlFor="kit-component" style={theme.typography.LabelMedium}>Rocoto design system</label>
        <select id="kit-component" aria-label="Component" value={entry.slug} onChange={(event) => go(event.target.value)}
          style={{ width: '100%', marginTop: theme.sizing.scale400, padding: theme.sizing.scale400, color: theme.colors.contentPrimary, background: theme.colors.backgroundPrimary, font: 'inherit' }}>
          {MAP.map((group) => <optgroup key={group.cat} label={group.cat}>{group.items.filter(([, , file]) => AVAILABLE.has(file)).map(([title, key]) => <option key={key} value={key}>{title}</option>)}</optgroup>)}
        </select>
      </div>
      <aside className={css({ '@media (max-width: 767px)': { display: 'none' } })} style={{
        borderRight: `1px solid ${theme.colors.borderTransparent}`,
        background: theme.colors.backgroundPrimary,
        padding: `${theme.sizing.scale700} ${theme.sizing.scale600}`,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* the home link names a real slug: it used to say `#/buttons`, which matched nothing and
            landed on FLAT[0] by accident — and FLAT[0] moved the day Writing joined the map */}
        <a href="#/button" style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, marginBottom: theme.sizing.scale800, textDecoration: 'none', color: 'inherit' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: theme.colors.accent, color: theme.colors.backgroundPrimary, display: 'grid', placeItems: 'center', ...theme.typography.LabelXSmall }}>R</span>
          <span style={theme.typography.LabelMedium}>Rocoto design system</span>
        </a>

        {MAP.map((g) => (
          <div key={g.cat} style={{ marginBottom: theme.sizing.scale600 }}>
            <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '6px 8px 2px' }}>
              {g.cat}
            </div>
            {g.items.map(([title, slug, file]) => {
              const ok = AVAILABLE.has(file);
              const active = entry.slug === slug;
              return (
                <a key={slug} href={`#/${slug}`}
                  onClick={(e) => { e.preventDefault(); if (ok) go(slug); }}
                  style={{ display: 'block', padding: '3px 8px', borderRadius: theme.borders.radius100, textDecoration: 'none',
                    ...theme.typography.ParagraphSmall,
                    color: ok ? (active ? theme.colors.backgroundPrimary : theme.colors.contentPrimary) : theme.colors.contentTertiary,
                    background: active ? theme.colors.contentPrimary : 'transparent', cursor: ok ? 'pointer' : 'default' }}>
                  {title}
                </a>
              );
            })}
          </div>
        ))}
      </aside>

      <main className={css({ padding: `${theme.sizing.scale400} ${theme.sizing.scale1000} ${theme.sizing.scale1600}`, minWidth: 0, '@media (max-width: 767px)': { padding: theme.sizing.scale600 } })}>
        {Current && here ? (
          <React.Suspense fallback={<div style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentTertiary, paddingTop: theme.sizing.scale1600 }}>Cargando…</div>}>
            <SectionFilter.Provider value={entry.slug}>
              <Current />
            </SectionFilter.Provider>
            {PROPS[entry.slug] && (
              <section style={{ borderTop: `2px solid ${theme.colors.contentPrimary}`, paddingTop: theme.sizing.scale600, marginTop: theme.sizing.scale1600 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale550, marginBottom: theme.sizing.scale700 }}>
                  <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Props</h3>
                  <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                    read from the component's own <code>types.ts</code> — the spec is the source
                  </span>
                </div>
                <div style={{ background: theme.colors.backgroundPrimary, border: `1px solid ${theme.colors.borderTransparent}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
                  <Table
                    columns={['Prop', 'Type', 'Description']}
                    data={PROPS[entry.slug].props.map((r) => [
                      r.name + (r.optional ? '' : ' *'),
                      r.type,
                      r.doc,
                    ])}
                    overrides={{ TableBodyCell: { style: { verticalAlign: 'top', fontFamily: 'inherit' } } }}
                  />
                </div>
              </section>
            )}
          </React.Suspense>
        ) : (
          <div style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentTertiary, paddingTop: theme.sizing.scale1600 }}>
            Esta familia llega con la siguiente tanda.
          </div>
        )}
      </main>
    </div>
  );
}
