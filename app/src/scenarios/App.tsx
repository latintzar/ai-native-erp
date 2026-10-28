/* THE SCENARIOS SHELL — BUILD-PLAN §8.
 *
 * A second entry on the SAME Vite build as the kit, sharing the theme, the providers and every
 * component, so an edit to the BRAND block or to a kit component changes every scenario in the
 * same breath. That linkage is structural, not a convention.
 *
 * A BUILDER WRITES THE SCREEN AND THE META AND NEVER THE CHROME. Screens register themselves by
 * existing — `src/scenarios/screens/<id>.tsx`, discovered by glob — and the shell wraps each in
 * its `ScenarioCard`. Fifty-eight cards drawn by seven agents therefore read as one catalogue.
 *
 * THE RAIL has a lens at its head with three positions (groups · flows · screens); the card set
 * never changes, only its ordering and its grouping do. Above it, three global controls that
 * apply to the card on screen: the sector switch, the frame filter, and `?theme=proof`.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Checkbox, LABEL_PLACEMENT } from 'baseui/checkbox';
import { dots } from '../rocoto-theme';
import type { ScenarioMeta, SectorId, Frame } from './meta';
import { SectorProvider, HighlightProvider, CatalogueProvider, type CatalogueEntry } from './shell/context';
import ScenarioCard from './shell/ScenarioCard';
import SectorSwitch from './shell/SectorSwitch';
import ThreadLens, { type Lens } from './shell/ThreadLens';
import RefChip from './shell/RefChip';
import Reduction from './reduction/Reduction';
import Foundations from './shell/Foundations';
import { OPENS, openOf } from './data/open';
import { openNumber } from './shell/OpenChip';

/* ── the screens, discovered ──────────────────────────────────────────────────────────────── */

type Mod = { default: React.ComponentType; meta: ScenarioMeta };
const MODULES = import.meta.glob('./screens/*.tsx', { eager: true }) as Record<string, Mod>;

/** A1 · A2 · A10 · A13 · A13-bis, in that order — the group letter, then the number, then the
 *  suffix. `localeCompare` alone puts A10 before A2, which reads as a defect on the rail. */
const order = (a: string, b: string) => {
  const parse = (id: string) => {
    const m = /^([A-Z]+)(\d*)(.*)$/.exec(id) ?? [];
    return { letters: m[1] ?? id, num: m[2] ? parseInt(m[2], 10) : 0, rest: m[3] ?? '' };
  };
  const x = parse(a);
  const y = parse(b);
  return x.letters.localeCompare(y.letters) || x.num - y.num || x.rest.localeCompare(y.rest);
};

const CATALOGUE: CatalogueEntry[] = Object.entries(MODULES)
  .map(([path, mod]) => ({ ...mod.meta, path }))
  .sort((a, b) => order(a.id, b.id));

const COMPONENTS: Record<string, React.ComponentType> = Object.fromEntries(
  Object.values(MODULES).map((m) => [m.meta.id, m.default]),
);

/* ── routing ──────────────────────────────────────────────────────────────────────────────── */

const useHash = (): string => {
  const [h, set] = React.useState(() => window.location.hash.replace(/^#\/?/, ''));
  React.useEffect(() => {
    const on = () => set(window.location.hash.replace(/^#\/?/, ''));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return h;
};

/* ── the pages that are not cards ─────────────────────────────────────────────────────────── */

function OpenPage({ n, metas }: { n: number; metas: ScenarioMeta[] }) {
  const [, theme] = useStyletron();
  const region = openOf(n);
  const leanedOn = metas.filter((m) => m.open.some((o) => openNumber(o.ref) === n));
  if (!region) return <Missing what={`OPEN-${n}`} />;
  return (
    <article style={{ maxWidth: '72ch' }}>
      <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary }}>OPEN-{region.n}</div>
      <h1 style={{ margin: `${theme.sizing.scale200} 0 ${theme.sizing.scale600}`, ...theme.typography.HeadingLarge }}>
        {region.title}
      </h1>
      <h2 style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Why it is open
      </h2>
      <p style={theme.typography.ParagraphMedium}>{region.why}</p>
      <h2 style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {region.closedBy ? 'How it was closed' : 'What would settle it'}
      </h2>
      <p style={theme.typography.ParagraphMedium}>{region.closedBy ?? region.settledBy}</p>
      <h2 style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Who leans on it
      </h2>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        {leanedOn.map((m) => <RefChip key={m.id} to={m.id}>{m.title}</RefChip>)}
        {leanedOn.length === 0 && (
          <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary }}>
            The cards that stand in this region arrive with a later wave.
          </p>
        )}
      </div>
    </article>
  );
}

function ChatPage({ metas }: { metas: ScenarioMeta[] }) {
  const [, theme] = useStyletron();
  const leanedOn = metas.filter((m) => m.inherits.some((i) => i.ref === 'chat'));
  return (
    <article style={{ maxWidth: '72ch' }}>
      <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary }}>the settled surface</div>
      <h1 style={{ margin: `${theme.sizing.scale200} 0 ${theme.sizing.scale600}`, ...theme.typography.HeadingLarge }}>
        Chat
      </h1>
      <p style={theme.typography.ParagraphMedium}>
        The conversation is the one surface of the product that is already figured out: the layout,
        the composer&rsquo;s gesture machine, the immediate screenshot, the voice memo and the
        transcript view are all founder-approved and shipped. A scenario may therefore draw it at
        higher confidence than an undecided region — a stronger grey, real row structure — and it
        stays a pointer rather than a subject.
      </p>
      <p style={theme.typography.ParagraphMedium}>
        Review is the surface next to it, and review is only ALMOST settled: the structure — an
        isolated message with a card below it — holds, and the CARD varies, which is why the card
        is a scenario subject and this page is not.
      </p>
      <h2 style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Who leans on it
      </h2>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        {leanedOn.map((m) => <RefChip key={m.id} to={m.id}>{m.title}</RefChip>)}
      </div>
    </article>
  );
}

function Missing({ what }: { what: string }) {
  const [, theme] = useStyletron();
  return (
    <article style={{ maxWidth: '72ch' }}>
      <h1 style={{ ...theme.typography.HeadingLarge }}>{what}</h1>
      <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary }}>
        This card arrives with a later wave. The pointer stands because the card that leans on it is
        drawn already, which is the whole reason the pointer is written down.
      </p>
    </article>
  );
}

/* ── the shell ────────────────────────────────────────────────────────────────────────────── */

const FRAMES: Frame[] = ['desk', 'phone', 'public'];

export default function App() {
  const [, theme] = useStyletron();
  const route = useHash();
  const [sector, setSector] = React.useState<SectorId>('fish');
  const [lit, light] = React.useState<string | null>(null);
  const [lens, setLens] = React.useState<Lens>('groups');
  const [frames, setFrames] = React.useState<Frame[]>(FRAMES);

  const proof = new URLSearchParams(window.location.search).get('theme') === 'proof';
  const toggleProof = () => {
    const search = proof ? '' : '?theme=proof';
    window.location.href = `${window.location.pathname}${search}${window.location.hash}`;
  };

  const visible = CATALOGUE.filter((m) => frames.includes(m.frame));
  const card = CATALOGUE.find((m) => m.id === route);
  const Current = card ? COMPONENTS[card.id] : null;

  let main: React.ReactNode;
  if (route === 'reduction') main = <Reduction metas={CATALOGUE} />;
  else if (route === 'foundations') main = <Foundations />;
  else if (route === 'chat') main = <ChatPage metas={CATALOGUE} />;
  else if (route.startsWith('open/')) main = <OpenPage n={parseInt(route.slice(5), 10)} metas={CATALOGUE} />;
  else if (card && Current) main = <ScenarioCard meta={card}><Current /></ScenarioCard>;
  else if (route) main = <Missing what={route} />;
  else main = <Reduction metas={CATALOGUE} />;

  return (
    <SectorProvider value={{ sector, setSector }}>
      <HighlightProvider value={{ lit, light }}>
        <CatalogueProvider value={CATALOGUE}>
          <div
            style={{
              backgroundImage: dots(theme.colors.mono400),
              backgroundSize: (theme as unknown as { brand?: { dotTile: string } }).brand?.dotTile ?? '14px 14px',
              backgroundColor: theme.colors.mono100,
              minHeight: '100vh',
              fontFamily: theme.typography.ParagraphMedium.fontFamily,
              display: 'grid',
              gridTemplateColumns: '280px 1fr',
            }}
          >
            {/* ── the rail ── */}
            <aside
              style={{
                borderRight: `1px solid ${theme.colors.borderOpaque}`,
                background: theme.colors.backgroundPrimary,
                padding: `${theme.sizing.scale700} ${theme.sizing.scale600}`,
                position: 'sticky',
                top: 0,
                height: '100vh',
                overflowY: 'auto',
              }}
            >
              <a
                href="#/reduction"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.sizing.scale400,
                  marginBottom: theme.sizing.scale700,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: theme.colors.accent,
                    color: theme.colors.backgroundPrimary,
                    display: 'grid',
                    placeItems: 'center',
                    ...theme.typography.LabelXSmall,
                  }}
                >
                  R
                </span>
                <span style={theme.typography.LabelMedium}>Rocoto scenarios</span>
              </a>

              <ThreadLens lens={lens} setLens={setLens} metas={visible} route={route} />

              <div style={{ marginTop: theme.sizing.scale900, borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale500 }}>
                <a href="#/reduction" style={{ display: 'block', ...theme.typography.LabelSmall, textDecoration: 'none', color: theme.colors.contentPrimary, padding: `2px ${theme.sizing.scale300}` }}>
                  The reduction
                </a>
                <a href="#/foundations" style={{ display: 'block', ...theme.typography.LabelSmall, textDecoration: 'none', color: theme.colors.contentPrimary, padding: `2px ${theme.sizing.scale300}` }}>
                  The foundations
                </a>
                <a href="#/chat" style={{ display: 'block', ...theme.typography.LabelSmall, textDecoration: 'none', color: theme.colors.contentPrimary, padding: `2px ${theme.sizing.scale300}` }}>
                  Chat, the settled surface
                </a>
                <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', padding: `${theme.sizing.scale500} ${theme.sizing.scale300} ${theme.sizing.scale200}` }}>
                  Open
                </div>
                {OPENS.map((o) => (
                  <a
                    key={o.n}
                    href={`#/open/${o.n}`}
                    style={{
                      display: 'block',
                      ...theme.typography.ParagraphXSmall,
                      textDecoration: o.closedBy ? 'line-through' : 'none',
                      color: theme.colors.contentSecondary,
                      padding: `1px ${theme.sizing.scale300}`,
                    }}
                  >
                    OPEN-{o.n} · {o.title}
                  </a>
                ))}
              </div>
            </aside>

            {/* ── the surface ── */}
            <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {/* the three global controls, above everything they apply to */}
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  display: 'flex',
                  gap: theme.sizing.scale700,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: `${theme.sizing.scale500} ${theme.sizing.scale800}`,
                  borderBottom: `1px solid ${theme.colors.borderOpaque}`,
                  background: theme.colors.backgroundPrimary,
                }}
              >
                <SectorSwitch verdicts={card?.sector} />

                <div style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'center' }}>
                  {FRAMES.map((f) => (
                    <Checkbox
                      key={f}
                      checked={frames.includes(f)}
                      labelPlacement={LABEL_PLACEMENT.right}
                      onChange={(e) =>
                        setFrames((prev) =>
                          (e.target as HTMLInputElement).checked ? [...prev, f] : prev.filter((x) => x !== f),
                        )
                      }
                    >
                      {f}
                    </Checkbox>
                  ))}
                </div>

                <Checkbox checked={proof} onChange={toggleProof} labelPlacement={LABEL_PLACEMENT.right}>
                  ?theme=proof
                </Checkbox>

                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, maxWidth: '34ch' }}>
                  Anything that stays put under the proof brand is hard-coded, and that is a bug.
                </span>
              </div>

              <div style={{ padding: `${theme.sizing.scale800} ${theme.sizing.scale800} ${theme.sizing.scale1600}`, minWidth: 0 }}>
                {main}
              </div>
            </main>
          </div>
        </CatalogueProvider>
      </HighlightProvider>
    </SectorProvider>
  );
}
