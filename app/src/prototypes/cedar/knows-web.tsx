/* THE WEB — «What Rocoto knows», brought to life. THE-INTELLIGENCE §4.1, §4.2 and §10.8.
 *
 * ═══ TWO SURFACES, ONE PLACE ═══════════════════════════════════════════════════════════════
 * §4 names one place and two doors into it, and both live in this file because they are one
 * subject: the history goes IN through «Bring your history», and what it taught comes OUT as the
 * web. Settings carries the door; neither of them is a tab.
 *
 *   1 · BRING YOUR HISTORY (§4.1) — «Upload the ERP dump: orders, albaranes, invoices, customers;
 *       a year of them. The import renders as an event — what arrived, what was read, what it
 *       taught.» Since §10.2 the first thing it taught is the GROUNDING: «Grounded 214 items onto
 *       the produce tree», and the learning is built on top of that.
 *
 *   2 · THE WEB (§4.2, §10.8) — «The web's middle layer IS the tree: customers ↔ nodes ↔ the
 *       house's products.» So this is not a customers × products graph, which would be «generic
 *       and salty». It is the ROUTER, drawn: a customer's words land on a NODE, and the node
 *       resolves to the sort this house actually ships. Two columns of edges, two hops, each one
 *       separately learnable and each one a sentence when you open it.
 *
 * ═══ WHY THE PHONE GETS A LIST AND THE DESK GETS A GRAPH ═══════════════════════════════════
 * A node-and-edge drawing needs room for the edges to mean anything; at 390px they cross into a
 * scribble and the structure they were drawn to show is the first casualty. So the phone gets the
 * SAME graph as three vertical lists — the customers, the tree, and what you sell — with every
 * edge said out loud in the panel. Honest structure beats a forced drawing, and neither surface
 * holds a fact the other one lacks.
 *
 * ═══ WHAT THE NUMBERS ARE ALLOWED TO DO ════════════════════════════════════════════════════
 * `seen` draws a line's THICKNESS and nothing else. It is never printed as a percentage and never
 * printed as a score: where the count matters it is said in words, in the evidence under the
 * sentence («18 orders of theirs landed on this branch»). That is the whole difference between
 * this and a dashboard.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { ProgressBar } from 'baseui/progress-bar';
import { OverlayCard, SCRIM } from '../../rocoto/overlay-card';
import type { Cast, Customer } from '../../scenarios/data/cast';
import { customerOf, productOf } from '../../scenarios/data/cast';
import Name from '../../scenarios/shell/Name';
import { plural, useDay } from './day';
import { usePhone } from './shell';
import { Block, GoogleMark, Noticed, NoticedMark } from './customer-profile';
import { CustomerSheetOverlay } from './customer-sheet-overlay';
import { Fact } from './shell/printing';
import { ChatEmbed } from './shell/embeds';
import { Produce } from './product-face';
import { readingMs, useStillness, useWalk } from './stage';
import { coverage } from './insights';
import { buildSales, RANK, type Sale } from './sale';
import {
  aboutCustomer, aboutNode, aboutProduct, amount, count, dumpOf, forgetImports, importHistory,
  nodeById, readback, useImport, useKnows,
  type KnowLink, type Knows, type Observation, type TreeNode,
} from './knows';

/* ── THE NODE GEOMETRY ────────────────────────────────────────────────────────────────────────
 * Every node is a row of the SAME height, so an edge's two ends can be computed rather than
 * measured: y = i · STEP + ROW/2. A drawing that has to wait for the DOM to settle is a drawing
 * that paints in the wrong place once, and once is enough for a person to stop trusting it.
 */
const ROW = 56;
const GAP = 8;
const STEP = ROW + GAP;
/** the width of each of the two columns the edges are drawn in */
const LINKS = 104;

/* ── ONE NODE ─────────────────────────────────────────────────────────────────────────────── */

function Node({
  name,
  sub,
  lit,
  testid,
  onClick,
}: {
  name: React.ReactNode;
  sub: string;
  lit: boolean;
  testid: string;
  onClick: () => void;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      data-selected={lit ? 'yes' : 'no'}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: theme.sizing.scale100,
        height: ROW,
        width: '100%',
        textAlign: 'left',
        padding: `0 ${theme.sizing.scale500}`,
        borderRadius: theme.borders.radius200,
        border: `1px solid ${lit ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
        background: over || lit ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        /* ELEVATION IS THE NODE'S PRESENCE, the same ramp the feed's cards read (§6.2). */
        boxShadow: lit ? theme.lighting.shadow600 : theme.lighting.shadow400,
        transitionProperty: 'box-shadow',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
        overflow: 'hidden',
      }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
    >
      <span style={{ ...theme.typography.LabelSmall, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </span>
      <span
        style={{
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentSecondary,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {sub}
      </span>
    </button>
  );
}

/* ── ONE COLUMN OF EDGES ──────────────────────────────────────────────────────────────────────
 * One curve per link, thickness by how often the pattern has been seen. A link touching the thing
 * a person is reading takes the ACCENT, because that link is Rocoto's own finding being pointed
 * at; every other link is ink, quiet, and holds the structure together.
 */
type Pick = { kind: 'customer' | 'node' | 'product'; id: string };

function Edges({
  links,
  left,
  right,
  pick,
  height,
  testid,
}: {
  links: KnowLink[];
  /** the ids of the left column, in the order they are drawn */
  left: string[];
  right: string[];
  pick: Pick | null;
  height: number;
  testid: string;
}) {
  const [, theme] = useStyletron();
  const most = Math.max(1, ...links.map((l) => l.seen));
  const yOf = (i: number) => i * STEP + ROW / 2;

  return (
    <svg
      data-testid={testid}
      width={LINKS}
      height={height}
      viewBox={`0 0 ${LINKS} ${height}`}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {links.map((l) => {
        const a = left.indexOf(l.from);
        const b = right.indexOf(l.to);
        if (a < 0 || b < 0) return null;
        const y1 = yOf(a);
        const y2 = yOf(b);
        const on = pick !== null && (pick.id === l.from || pick.id === l.to);
        return (
          <path
            key={l.id}
            data-edge={l.id}
            data-on={on ? 'yes' : 'no'}
            d={`M0 ${y1} C ${LINKS * 0.5} ${y1}, ${LINKS * 0.5} ${y2}, ${LINKS} ${y2}`}
            stroke={on ? theme.colors.accent : theme.colors.contentPrimary}
            strokeWidth={1 + Math.round((l.seen / most) * 4)}
            strokeOpacity={on ? 0.9 : pick ? 0.1 : 0.26}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/* ── WHAT A NODE SAYS ABOUT ITSELF ────────────────────────────────────────────────────────── */

const routesInto = (knows: Knows, node: string): KnowLink[] =>
  knows.links.filter((l) => l.kind === 'route' && l.to === node);

const priorsOf = (knows: Knows, node: string): KnowLink[] =>
  knows.links.filter((l) => l.kind === 'prior' && l.from === node);

/* WHAT A NODE'S OWN ROW SAYS. It has ONE LINE at a node's width, so it says the one fact that
 * belongs to this column and stops — the fuller sentence is in the panel, one tap away. A sub-line
 * that ends in «· …» has told the reader nothing and cost them a line to find that out. */

const customerSub = (knows: Knows, id: string): string => {
  const patterns = aboutCustomer(knows, id).length;
  return `${patterns} ${plural(patterns, 'pattern')} recorded`;
};

const nodeSub = (knows: Knows, node: TreeNode): string => {
  const into = routesInto(knows, node.id).length;
  return into === 1 ? '1 customer lands here' : `${into} customers land here`;
};

const productSub = (knows: Knows, id: string): string => {
  const from = knows.links.filter((l) => l.kind === 'prior' && l.to === id).length;
  return from === 1 ? '1 branch resolves to it' : `${from} branches resolve to it`;
};

/** The name at the other end of a hop, whichever end the panel is standing on. */
function otherEnd(knows: Knows, cast: Cast, link: KnowLink, pick: Pick): { name: string; kind: Pick['kind'] } {
  const far = link.from === pick.id ? link.to : link.from;
  if (link.kind === 'prior') {
    return far === link.to
      ? { name: cast.products.find((p) => p.id === far)?.name ?? far, kind: 'product' }
      : { name: nodeById(knows.tree, far)?.name ?? far, kind: 'node' };
  }
  return far === link.to
    ? { name: nodeById(knows.tree, far)?.name ?? far, kind: 'node' }
    : { name: cast.customers.find((c) => c.id === far)?.name ?? far, kind: 'customer' };
}

/** What the group of hops on this side of the thing is called. Every one of them passes the
 *  stranger test on its own: cover the rows and the label still says what is under it. */
const HOP_LABEL: Record<string, string> = {
  'customer-route': 'Where their words land',
  'node-route': 'Whose words land here',
  'node-prior': 'What you fill it with',
  'product-prior': 'Which branches resolve to it',
};

/* ── THE PANEL A NODE OPENS ───────────────────────────────────────────────────────────────────
 * «Tap a node → its observations.» So the panel is the thing's own sentences, with the hops it
 * stands on named above them — never a chart of it, and never a number without a sentence.
 */
function NodePanel({
  knows,
  cast,
  pick,
  tall,
  onOpenCustomer,
}: {
  knows: Knows;
  cast: Cast;
  pick: Pick | null;
  /** how tall the graph beside it stands, so the panel can scroll rather than stretch the row */
  tall: number | null;
  onOpenCustomer: (customer: Customer) => void;
}) {
  const [, theme] = useStyletron();

  /* A PANEL THAT GROWS PAST ITS GRAPH LEAVES A HOLE UNDER THE GRAPH. The row is as tall as its
     tallest cell, so a long list of observations pushed the card open and left the drawing sitting
     in half a screen of nothing. The panel takes the graph's own height and scrolls inside it. */
  const shell: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.sizing.scale500,
    padding: theme.sizing.scale600,
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    background: theme.colors.backgroundPrimary,
    boxShadow: theme.lighting.shadow400,
    minWidth: 0,
    maxHeight: tall === null ? undefined : tall,
    overflowY: tall === null ? undefined : 'auto',
  };

  if (!pick) {
    return (
      <div data-testid="web-panel" style={{ ...shell, gap: theme.sizing.scale300 }}>
        <span style={theme.typography.LabelSmall}>Open a name</span>
        {/* THE DIAGRAM IS NOT NARRATED (THE-CONTENT-CANON §3). Three sentences used to walk the
            reader across a picture they were already looking at. One sentence gives the key the
            picture cannot give itself — how to read thickness — and the diagram carries the rest. */}
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          The thicker the line, the more often it happened.
        </span>
      </div>
    );
  }

  const customer = pick.kind === 'customer' ? customerOf(cast, pick.id) : undefined;
  const product = pick.kind === 'product' ? productOf(cast, pick.id) : undefined;
  const node = pick.kind === 'node' ? nodeById(knows.tree, pick.id) : undefined;

  const observations: Observation[] =
    pick.kind === 'customer'
      ? aboutCustomer(knows, pick.id)
      : pick.kind === 'node'
        ? aboutNode(knows, pick.id)
        : aboutProduct(knows, pick.id);

  const links = knows.links.filter((l) => l.from === pick.id || l.to === pick.id);
  const menu = observations.find((o) => o.kind === 'menu');

  return (
    <div data-testid="web-panel" data-pick={pick.id} data-kind={pick.kind} style={shell}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, flex: 1, minWidth: 0 }}>
          {customer ? <Name of={customer} /> : product ? <Name of={product} /> : node ? node.name : null}
        </h3>
        {menu?.attribution && <GoogleMark found={menu.attribution.found} />}
      </div>

      {node && (
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
          {node.facet
            ? `A ${node.facetWord ?? 'sort'} under this catalogue category.`
            : 'Catalogue category.'}
        </span>
      )}

      {/* THE HOPS IT STANDS ON — the NAMES at the other ends, grouped by direction, with how often
          each has been watched. The SENTENCES are below, on the observations: an edge that repeated
          a sentence two inches above the sentence itself said one thing twice, and the reader had
          to work out that it was the same thing. */}
      {(['route', 'prior'] as const).map((kind) => {
        const own = links.filter((l) => l.kind === kind);
        const label = HOP_LABEL[`${pick.kind}-${kind}`];
        if (own.length === 0 || !label) return null;
        return (
          <div key={kind} style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </span>
            {own.map((l) => {
              const far = otherEnd(knows, cast, l, pick);
              return (
                <div
                  key={l.id}
                  data-testid={`web-link-${l.id}`}
                  data-link-kind={l.kind}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: theme.sizing.scale400,
                    alignItems: 'baseline',
                    paddingTop: theme.sizing.scale200,
                    borderTop: `1px solid ${theme.colors.borderOpaque}`,
                    minWidth: 0,
                  }}
                >
                  <span style={{ ...theme.typography.LabelSmall, minWidth: 0 }}>{far.name}</span>
                  <span
                    style={{
                      ...theme.typography.ParagraphXSmall,
                      color: theme.colors.contentTertiary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    seen {count(l.seen)} times
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Recorded patterns
        </span>
        {observations.map((o) => (
          <Noticed key={o.id} observation={o} />
        ))}
      </div>

      {customer && (
        <div>
          <Button
            kind={KIND.secondary}
            size={SIZE.mini}
            data-testid="web-open-profile"
            onClick={() => onOpenCustomer(customer)}
          >
            Open their profile
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── THE WEB ──────────────────────────────────────────────────────────────────────────────── */

export function KnowsWeb({ isOpen, onClose, cast }: { isOpen: boolean; onClose: () => void; cast: Cast }) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const knows = useKnows(cast);
  const [pick, setPick] = React.useState<Pick | null>(null);
  const [profile, setProfile] = React.useState<Customer | null>(null);

  const customers = cast.customers;
  const products = cast.products;
  const tree = knows.tree;
  const height = Math.max(customers.length, tree.length, products.length) * STEP;

  const label: React.CSSProperties = {
    ...theme.typography.LabelXSmall,
    color: theme.colors.contentTertiary,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };

  const Column = ({ head, testid, children }: { head: string; testid: string; children: React.ReactNode }) => (
    <div data-testid={testid} style={{ display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 }}>
      <span style={label}>{head}</span>
      {children}
    </div>
  );

  /* THE EDGE COLUMNS MIRROR A NODE COLUMN EXACTLY — a label of the same typography, the same gap,
     then the drawing. Aligning by a computed offset is how a graph ends up one row out. */
  const EdgeColumn = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 }}>
      <span style={label} aria-hidden="true">
        &nbsp;
      </span>
      {children}
    </div>
  );

  const customerNodes = customers.map((c) => (
    <Node
      key={c.id}
      testid={`web-customer-${c.id}`}
      name={<Name of={c} />}
      sub={customerSub(knows, c.id)}
      lit={pick?.kind === 'customer' && pick.id === c.id}
      onClick={() => setPick({ kind: 'customer', id: c.id })}
    />
  ));

  const treeNodes = tree.map((n) => (
    <Node
      key={n.id}
      testid={`web-node-${n.id}`}
      name={n.name}
      sub={nodeSub(knows, n)}
      lit={pick?.kind === 'node' && pick.id === n.id}
      onClick={() => setPick({ kind: 'node', id: n.id })}
    />
  ));

  const productNodes = products.map((p) => (
    <Node
      key={p.id}
      testid={`web-product-${p.id}`}
      name={<Name of={p} />}
      sub={productSub(knows, p.id)}
      lit={pick?.kind === 'product' && pick.id === p.id}
      onClick={() => setPick({ kind: 'product', id: p.id })}
    />
  ));

  const routes = knows.links.filter((l) => l.kind === 'route');
  const priors = knows.links.filter((l) => l.kind === 'prior');

  return (
    <OverlayCard
      isOpen={isOpen}
      onClose={onClose}
      scrim={SCRIM.dim}
      size={phone ? 'full' : 1160}
      ariaLabel="Business insights"
    >
      <div
        data-testid="knows-web"
        data-phone={phone ? 'yes' : 'no'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale600,
          maxHeight: phone ? '78vh' : '80vh',
          overflowY: 'auto',
          overflowX: 'clip',  // one-axis scrollport: overflow-y:auto computes overflow-x:auto (FEED-IA §13)
          minWidth: 0,
        }}
      >
        {/* THE HEADER IS STICKY (THE-APP-V2 §6.1) — what this place is never scrolls away. */}
        <header
          data-testid="web-header"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            gap: theme.sizing.scale500,
            paddingBottom: theme.sizing.scale400,
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            background: theme.colors.backgroundPrimary,
            minWidth: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
            <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Business insights</h2>
            <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: theme.sizing.scale300, ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              <NoticedMark label="Based on your records" />
              {count(knows.observations.length)} {plural(knows.observations.length, 'pattern')} on{' '}
              {tree.length} {plural(tree.length, 'catalogue category', 'catalogue categories')}.
            </span>
          </div>
          <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="close-web" onClick={onClose}>
            Close
          </Button>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 340px)',
            gap: theme.sizing.scale600,
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          {/* THE GRAPH — three columns and two hops on the desk; the same three columns stacked on
              the phone, with every edge said out loud in the panel. The ground keeps the dotted
              paper, tinted off the accent (§6.3), so the web stands ON something. */}
          <div
            data-testid="web-canvas"
            style={{
              display: 'grid',
              gridTemplateColumns: phone
                ? 'minmax(0, 1fr)'
                : `minmax(0, 1fr) ${LINKS}px minmax(0, 1fr) ${LINKS}px minmax(0, 1fr)`,
              gap: phone ? theme.sizing.scale600 : 0,
              alignItems: 'start',
              padding: theme.sizing.scale500,
              borderRadius: theme.borders.radius300,
              border: `1px solid ${theme.colors.borderOpaque}`,
              backgroundColor: theme.colors.mono100,
              minWidth: 0,
            }}
          >
            <Column head="Your customers" testid="web-customers">
              {customerNodes}
            </Column>

            {!phone && (
              <EdgeColumn>
                <Edges
                  testid="web-edges-routes"
                  links={routes}
                  left={customers.map((c) => c.id)}
                  right={tree.map((n) => n.id)}
                  pick={pick}
                  height={height}
                />
              </EdgeColumn>
            )}

            <Column head="Catalogue categories" testid="web-tree">
              {treeNodes}
            </Column>

            {!phone && (
              <EdgeColumn>
                <Edges
                  testid="web-edges-priors"
                  links={priors}
                  left={tree.map((n) => n.id)}
                  right={products.map((p) => p.id)}
                  pick={pick}
                  height={height}
                />
              </EdgeColumn>
            )}

            <Column head="What you sell" testid="web-products">
              {productNodes}
            </Column>
          </div>

          {/* THE PANEL NEVER SCROLLS AWAY FROM THE GRAPH IT IS ABOUT (§6.1). */}
          <div style={{ position: phone ? 'static' : 'sticky', top: theme.sizing.scale1000, minWidth: 0 }}>
            <NodePanel
              knows={knows}
              cast={cast}
              pick={pick}
              tall={phone ? null : height + 56}
              onOpenCustomer={setProfile}
            />
          </div>
        </div>
      </div>

      {profile && (
        <CustomerSheetOverlay isOpen onClose={() => setProfile(null)} cast={cast} customer={profile} />
      )}
    </OverlayCard>
  );
}

/* ── THE DROP DOOR (§4.1) ─────────────────────────────────────────────────────────────────────
 * The whole gesture is choosing a file. A real input, a real drop target, and the moment a file
 * lands the import EVENT is written — which is what the readback then reads.
 */

/** ONE STRING, ONE HOME (THE-CONTENT-CANON §4 substance, §9 item 3). This sentence used to be
 *  written out twice — here as the door's fallback and again at the data seat's call site — so a
 *  rewrite of one left the other standing. It lives here now, and the seat takes the default. */
export const WHAT_A_YEAR_TEACHES = 'Upload a delivery-note export to review imported records.';

function DropDoor({
  onFile,
  testid = 'drop-door',
  lead,
}: {
  onFile: (name: string) => void;
  /** the door is the ONE intake organ with TWO doors (§64) — each names itself so a drive can tell
   *  the data seat's from Stock's, and so the two can never be mistaken for one on a page */
  testid?: string;
  /** what the house GETS, in the words of the place the door is standing in */
  lead?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  return (
    <div
      data-testid={testid}
      data-over={over ? 'yes' : 'no'}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) onFile(file.name);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.sizing.scale500,
        padding: theme.sizing.scale700,
        borderRadius: theme.borders.radius300,
        border: `2px dashed ${over ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
        background: over ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <span style={theme.typography.LabelMedium}>Add ERP export</span>
      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
        {lead ?? WHAT_A_YEAR_TEACHES}
      </span>
      <input
        ref={input}
        type="file"
        data-testid={`${testid}-file`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file.name);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
      <Button
        kind={KIND.primary}
        size={SIZE.compact}
        data-testid={`${testid}-choose`}
        onClick={() => input.current?.click()}
      >
        Choose file
      </Button>
    </div>
  );
}

/* ═══ THE HYDRATION MOMENT (FEED-IA §60 · THE-DATA-CANON §4) ══════════════════════════════════
 *
 * «There will be a moment in which they do accept data and then, if that affects the app, it like
 * HYDRATES the app, it FEEDS the app.»
 *
 * ═══ THE WIREFRAME (§51.24 — regions, contents, type steps, states) ═════════════════════════
 *
 *   ┌─ THE INTAKE ORGAN · one card, four states ───────────────────────────────────────────────┐
 *   │ BEFORE     the DropDoor leads, and its copy leads with what the HOUSE GETS               │
 *   │ ACCEPTING  the card, with the progress bar on its TOP EDGE — indeterminate first          │
 *   │            («Reading your albaranes…»), determinate the moment the estimate exists        │
 *   │ FILLING    three beats, in the app's own components, one caption line under each          │
 *   │ FED        the readback card = the standing EVENT · «Bring more history» · forgetImports  │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   TYPE STEPS  LabelSmall (the bar's label, §4.2's rule) · HeadingXSmall (a beat's counting
 *               figure, through the app's own `Fact`) · ParagraphSmall (the ONE caption) ·
 *               LabelXSmall (a beat's own label). The organ types nothing of its own.
 *   STATES      before · accepting · filling · fed — declared on `data-hydration`, so a drive can
 *               read the state rather than infer it from what happens to be painted.
 *
 * ═══ WHY IT IS ONE ORGAN AND NOT A MOMENT PER SURFACE (§4.1, §64) ═══════════════════════════
 * Acceptance happens on four unrelated surfaces — the ERP dump, the connect surfaces, catalog
 * intake, onboarding's walk. THE MOMENT IS DESIGNED ONCE and the same grammar replays wherever
 * data lands. §64 makes that structural: «one intake organ, two doors» — the data seat and Stock,
 * where the catalogue lives. Both mount THIS, and neither owns a copy of it.
 *
 * ═══ WHAT IT IS MADE OF ═════════════════════════════════════════════════════════════════════
 * Nothing here is drawn for the occasion. The counting figure is `Fact` (the app's one stat tile,
 * off the printing rail); the catalogue rows wear `Produce`, the goods' own faces; the order is
 * `ChatEmbed`'s albarán — the same card the customer's thread carries and the same card the agent
 * stage performs on. The WALK is `stage.tsx`'s own `useWalk`, so this performance and the stage's
 * cannot drift about how fast a sentence goes by. The licences stay where they are: the connect
 * wash stays on its three connect surfaces and the dots stay with conversation. Hydration needs
 * neither — its identity is made entirely of things already licensed.
 */

/** THE STATE, NAMED (§4.2). `idle` is «whatever the store says» — it is not a screen, it is the
 *  absence of a claim, and it is what a reload and a `forgetImports` both fall back to. */
type Phase = 'idle' | 'before' | 'accepting' | 'filling' | 'fed';

/* ── THE MOTION NUMBERS (§4.5), AND THE BUDGET THEY ADD UP TO ─────────────────────────────────
 * «Total ≤ 10s. Runs ONCE — it is an event.» So the numbers are stated here rather than sprinkled
 * through the JSX, and the budget below is the arithmetic that keeps the promise checkable.
 */
/** indeterminate until the estimate exists — Base's progress rule, verbatim */
const ESTIMATE_MS = 700;
/** the determinate fill, once there is something to be determinate about */
const ACCEPTING_MS = 1100;
/** count-ups: 900ms Quintic EaseOut */
const COUNT_MS = 900;
/** row materialization: 40–60ms a row, capped at ~8 rows a beat */
const ROW_MS = 50;
const ROWS_CAP = 8;
/** the last beat's rest before the readback card stands as the record */
const SETTLE_MS = 1200;

/** THE THREE BEATS (§4.3), in the order the app fills in. Each caption is ONE line, and the walk
 *  times it on the app's own reading clock. */
const BEATS = ['customers', 'stock', 'sales'] as const;

/** the ceiling this performance is held to — asserted by the drive, stated here so the assertion
 *  and the build read the same number */
export const HYDRATION_BUDGET_MS =
  ESTIMATE_MS + ACCEPTING_MS + 3 * 1600 /* the reading clock's own MAX_TURN_MS, three beats */ + SETTLE_MS;

/** Quintic EaseOut — the app's own count-up curve (§4.5). */
const quintic = (t: number): number => 1 - (1 - t) ** 5;

/**
 * A FIGURE ARRIVING AT ITSELF.
 *
 * Counting up is the one thing on this surface that is theatre, and it earns its place because the
 * number it lands on is the reading: you watch Rocoto arrive at «the rhythm of 214 customers»
 * rather than being handed it. Reduced motion is handed it — same information, no walk, which is
 * the test a reduced-motion path has to pass to be a real one.
 */
function useCountUp(to: number, on: boolean, still: boolean): number {
  const [n, setN] = React.useState(still || !on ? to : 0);
  React.useEffect(() => {
    if (still || !on) {
      setN(to);
      return;
    }
    let raf = 0;
    const from = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - from) / COUNT_MS);
      setN(Math.round(quintic(t) * to));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, on, still]);
  return n;
}

/** HOW MANY ROWS HAVE LANDED. The same shape as the count-up and for the same reason: the beat is
 *  the app filling, and a list that is simply THERE has not filled in front of anybody. */
function useStagger(of: number, on: boolean, still: boolean): number {
  const [n, setN] = React.useState(still || !on ? of : 0);
  React.useEffect(() => {
    if (still || !on) {
      setN(of);
      return;
    }
    setN(0);
    let at = 0;
    const tick = window.setInterval(() => {
      at += 1;
      setN(at);
      if (at >= of) window.clearInterval(tick);
    }, ROW_MS);
    return () => window.clearInterval(tick);
  }, [of, on, still]);
  return n;
}

/** THE ENTRANCE EVERY MATERIALIZED ROW MAKES — Quintic EaseOut 500, opacity and a hair of lift.
 *  Geometry never moves on hover in this app; it moves ONCE, here, because a thing arriving is
 *  exactly what this beat is about. */
function Landing({ on, children }: { on: boolean; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'none' : 'translateY(6px)',
        transitionProperty: 'opacity, transform',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutQuinticCurve,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/** ONE BEAT'S FRAME — a label, whatever the beat is made of, and the ONE caption line under it. */
function Beat({
  id,
  label,
  caption,
  children,
}: {
  id: string;
  label: string;
  caption: string;
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-beat={id}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}
    >
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      {children}
      <p
        data-beat-caption={id}
        style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}
      >
        {caption}
      </p>
    </div>
  );
}

/* ── THE THREE BEATS, EACH IN THE APP'S OWN COMPONENTS ────────────────────────────────────── */

function CustomersBeat({ cast, on, still }: { cast: Cast; on: boolean; still: boolean }) {
  const [, theme] = useStyletron();
  const cover = React.useMemo(() => coverage(cast), [cast]);
  const rhythms = cover.find((c) => c.id === 'rhythms');
  const held = rhythms?.held ?? 0;
  const now = useCountUp(held, on, still);
  const rows = cast.customers.slice(0, ROWS_CAP);
  const landed = useStagger(rows.length, on, still);

  return (
    <Beat
      id="customers"
      label="Customer histories"
      caption={`${count(held)} customer histories imported.`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <Fact label="Customer histories" value={count(now)} testid="hydrate-rhythms" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
          {rows.map((c, i) => (
            <Landing key={c.id} on={i < landed}>
              <span
                data-hydrated-row={c.id}
                style={{
                  ...theme.typography.ParagraphXSmall,
                  color: theme.colors.contentSecondary,
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                <Name of={c} />
              </span>
            </Landing>
          ))}
        </div>
      </div>
    </Beat>
  );
}

function StockBeat({ cast, on, still }: { cast: Cast; on: boolean; still: boolean }) {
  const [, theme] = useStyletron();
  const grounded = dumpOf(cast).grounded;
  const now = useCountUp(grounded, on, still);
  const rows = cast.products.slice(0, ROWS_CAP);
  const landed = useStagger(rows.length, on, still);

  return (
    <Beat
      id="stock"
      label="Products matched"
      caption={`${count(grounded)} products matched to catalogue.`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <Fact label="Products matched" value={count(now)} testid="hydrate-grounded" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
          {rows.map((p, i) => (
            <Landing key={p.id} on={i < landed}>
              <span
                data-hydrated-row={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}
              >
                <Produce of={p} size="mini" />
                <span
                  style={{
                    ...theme.typography.ParagraphXSmall,
                    color: theme.colors.contentSecondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  <Name of={p} />
                </span>
              </span>
            </Landing>
          ))}
        </div>
      </div>
    </Beat>
  );
}

/** THE SAFFRON MOMENT, AND THE ONLY ONE. Rocoto's own act is the suggestion that rides the order —
 *  «this is what they usually take» — so the accent appears here and nowhere else in the whole
 *  performance (§51: accent marks Rocoto's OWN acts only). */
function SalesBeat({ cast, sale, on, still }: { cast: Cast; sale: Sale | null; on: boolean; still: boolean }) {
  const [, theme] = useStyletron();
  const landed = useStagger(2, on, still);

  return (
    <Beat
      id="sales"
      label="Order patterns"
      caption="Order patterns from imported records."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        {sale && (
          <Landing on={landed >= 1}>
            <ChatEmbed embed={{ kind: 'albaran', sale }} cast={cast} />
          </Landing>
        )}
        <Landing on={landed >= 2}>
          <span
            data-hydrate-suggestion="usual"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale300,
              padding: `${theme.sizing.scale200} ${theme.sizing.scale400}`,
              borderRadius: theme.borders.radius400,
              border: `1px solid ${theme.colors.accent}`,
              minWidth: 0,
            }}
          >
            <NoticedMark label="Customer history" />
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentPrimary }}>
              {sale ? `Their usual · ${amount(sale.lines.length)} ${plural(sale.lines.length, 'line')}` : 'Their usual'}
            </span>
          </span>
        </Landing>
      </div>
    </Beat>
  );
}

/**
 * THE ORGAN ITSELF.
 *
 * `forgetImports` on the FED card is what makes the whole loop honest — gave → learned → shows →
 * take back — and it puts every region built on the import back to BEFORE in one press, because
 * the observations were never stored: they are DERIVED, and hydration is a flag flip. The entire
 * job was the design of the flip.
 */
export function Hydration({
  cast,
  testid = 'hydration',
  lead,
  onOpenWeb,
}: {
  cast: Cast;
  /** each door names itself (§64: one organ, two doors) */
  testid?: string;
  /** what the house GETS, said in the words of the place this door stands in */
  lead?: React.ReactNode;
  /** the way into what it learned, where the surface has one to offer */
  onOpenWeb?: () => void;
}) {
  const [, theme] = useStyletron();
  const still = useStillness();
  const imported = useImport(cast.sector);
  const edits = useDay(cast.sector);
  const said = imported ? readback(imported) : null;

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [file, setFile] = React.useState('');
  const [estimate, setEstimate] = React.useState(false);

  /* THE STATE IS THE STORE'S, EXCEPT WHILE SOMETHING IS HAPPENING. Deriving FED from the import
     event rather than from local state is what makes `forgetImports` — and a reload — land the
     right screen without either of them having to know this component exists. And FILLING is
     conditioned on the event still existing, so forgetting mid-performance drops straight to
     BEFORE rather than finishing a film about data that is no longer there. */
  const live: Phase =
    phase === 'accepting' ? 'accepting'
      : phase === 'filling' ? (imported ? 'filling' : 'before')
        : phase === 'before' ? 'before'
          : imported ? 'fed' : 'before';

  /** the real order the last beat performs on — off the cast's own river, never a drawing of one */
  const sale = React.useMemo(() => {
    const all = buildSales(cast, edits);
    return all.find((s) => RANK[s.state] >= RANK.made && s.lines.length > 0) ?? all[0] ?? null;
  }, [cast, edits]);

  /* ── ACCEPTING ────────────────────────────────────────────────────────────────────────────
   * Base's progress rule, verbatim: indeterminate first, switching to determinate THE MOMENT THE
   * ESTIMATE EXISTS. A bar that is determinate from the first frame is claiming to know how long
   * a file takes to read before it has looked at it.
   */
  React.useEffect(() => {
    if (phase !== 'accepting') return;
    const est = window.setTimeout(() => setEstimate(true), ESTIMATE_MS);
    const done = window.setTimeout(() => {
      importHistory({ cast, file: file || 'erp-export.csv' });
      setPhase(still ? 'fed' : 'filling');
    }, ESTIMATE_MS + ACCEPTING_MS);
    return () => {
      window.clearTimeout(est);
      window.clearTimeout(done);
    };
  }, [phase, cast, file, still]);

  /* ── FILLING — the three beats, on the stage's own clock ─────────────────────────────────── */
  const captionMs = React.useCallback(
    (i: number) => readingMs(BEATS[Math.min(i, BEATS.length - 1)]),
    [],
  );
  const { shown, land, done } = useWalk({
    steps: BEATS.length,
    msOf: captionMs,
    still,
    loop: false,
    from: 1,
  });

  React.useEffect(() => {
    if (live !== 'filling' || !done) return;
    const rest = window.setTimeout(() => setPhase('fed'), SETTLE_MS);
    return () => window.clearTimeout(rest);
  }, [live, done]);

  /** ANY INPUT LANDS IT (§4.5). A press, a scroll or a key ends the performance immediately — the
   *  person came for their data, not for a film about it. */
  const skip = React.useCallback(() => {
    if (phase === 'accepting') {
      importHistory({ cast, file: file || 'erp-export.csv' });
      setPhase('fed');
      return;
    }
    if (phase === 'filling') {
      land();
      setPhase('fed');
    }
  }, [phase, cast, file, land]);

  const start = (name: string) => {
    setFile(name);
    setEstimate(false);
    /* REDUCED MOTION LANDS FED DIRECTLY (§4.5) — no bar to watch, no beats, the same information. */
    if (still) {
      importHistory({ cast, file: name });
      setPhase('fed');
      return;
    }
    setPhase('accepting');
  };

  /** the card the ACCEPTING bar rides the top edge of, and the FED event stands on */
  const card: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.sizing.scale400,
    border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300,
    background: theme.colors.backgroundPrimary,
    overflow: 'hidden',
    minWidth: 0,
  };

  return (
    <div
      data-testid={testid}
      data-hydration={live}
      onPointerDown={live === 'accepting' || live === 'filling' ? skip : undefined}
      onKeyDown={live === 'accepting' || live === 'filling' ? skip : undefined}
      onWheel={live === 'accepting' || live === 'filling' ? skip : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
    >
      {live === 'before' && <DropDoor testid={`${testid}-door`} lead={lead} onFile={start} />}

      {live === 'accepting' && (
        <div data-testid={`${testid}-accepting`} style={card}>
          {/* ── THE BAR IS ON THE CARD'S TOP EDGE, AND THAT IS THE POINT ────────────────────
              «Placement declares scope» (§4.2). A bar floating in the middle of a seat is reading
              something unnamed; a bar welded to the top edge of THIS card is reading THIS file.
              Base's own component, with its margins taken off so it can sit on the edge — the
              overrides change where it is, never what it is. */}
          <ProgressBar
            value={estimate ? 100 : 0}
            infinite={!estimate}
            successValue={100}
            showLabel={false}
            ariaLabel="Reading your delivery notes"
            overrides={{
              Root: { style: { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 } },
              BarContainer: { style: { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 } },
              Bar: {
                props: { 'data-testid': `${testid}-bar`, 'data-determinate': estimate ? 'yes' : 'no' },
                style: {
                  marginTop: 0,
                  marginBottom: 0,
                  marginLeft: 0,
                  marginRight: 0,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                },
              },
              BarProgress: {
                style: {
                  /* the determinate fill takes the whole accepting window, so the bar arrives at
                     full exactly as the reading finishes */
                  transitionProperty: 'width',
                  transitionDuration: theme.animation.timing400,
                  transitionTimingFunction: theme.animation.linearCurve,
                },
              },
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, padding: theme.sizing.scale600, paddingTop: theme.sizing.scale500 }}>
            <span data-testid={`${testid}-bar-label`} style={theme.typography.LabelSmall}>
              Reading your delivery notes…
            </span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {file || 'erp-export.csv'} · {count(dumpOf(cast).months)} months
            </span>
          </div>
        </div>
      )}

      {live === 'filling' && (
        <div
          data-testid={`${testid}-filling`}
          data-beats={shown}
          style={{ ...card, gap: theme.sizing.scale700, padding: theme.sizing.scale700 }}
        >
          {shown >= 1 && <CustomersBeat cast={cast} on={shown >= 1} still={still} />}
          {shown >= 2 && <StockBeat cast={cast} on={shown >= 2} still={still} />}
          {shown >= 3 && <SalesBeat cast={cast} sale={sale} on={shown >= 3} still={still} />}
        </div>
      )}

      {/* ── THE READY RETURN IS NOT DRAWN HERE, AND THAT IS THE RULING ─────────────────────────
          THE-JOURNEY-CANON §6.4: «THE RETURN · its own surface». It was stacked over this card for
          one build and the cost was immediate — Your data already draws the best customers, the most
          profitable, what sells most and the accounts needing attention, so the reveal repeated four
          of its own six screens forty pixels above the seat's own. The record below stays what it
          always was: what arrived, and the round trip back out. The RETURN opens from the journey
          card, as its own surface, and recomputes on the year that exists when it is opened. */}
      {live === 'fed' && said && (
        <div data-testid={`${testid}-fed`} style={{ ...card, padding: theme.sizing.scale600 }}>
          <span style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'flex-start', minWidth: 0 }}>
            <NoticedMark label="Import complete" />
            <span data-testid={`${testid}-headline`} style={{ ...theme.typography.LabelMedium, minWidth: 0 }}>
              {said.headline}
            </span>
          </span>
          {said.lines.map((l) => (
            <span key={l} style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {l}
            </span>
          ))}
          {/* THE ROUND TRIP STAYS ON ONE CARD: what came in can leave, and every region built on it
              empties with it. A «forget» three screens from the «import» is a promise nobody can
              find. */}
          <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', paddingTop: theme.sizing.scale200 }}>
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              shape={SHAPE.pill}
              data-testid={`${testid}-again`}
              onClick={() => setPhase('before')}
            >
              Import another file
            </Button>
            {onOpenWeb && (
              <Button kind={KIND.tertiary} size={SIZE.mini} shape={SHAPE.pill} data-testid={`${testid}-web`} onClick={onOpenWeb}>
                Review patterns
              </Button>
            )}
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              shape={SHAPE.pill}
              data-testid={`${testid}-forget`}
              onClick={() => {
                forgetImports(cast.sector);
                setPhase('idle');
              }}
            >
              Remove imported data
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── THE IMPORT MOMENT ────────────────────────────────────────────────────────────────────── */

const stamp = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function BringYourHistory({
  isOpen,
  onClose,
  cast,
}: {
  isOpen: boolean;
  onClose: () => void;
  cast: Cast;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const knows = useKnows(cast);
  const [web, setWeb] = React.useState(false);
  const [profile, setProfile] = React.useState<Customer | null>(null);
  const imported = knows.imported;
  const dump = dumpOf(cast);
  const said = imported ? readback(imported) : null;

  return (
    <>
      <OverlayCard
        isOpen={isOpen && !web}
        onClose={onClose}
        scrim={SCRIM.dim}
        size={phone ? 'full' : 720}
        ariaLabel="Import history"
      >
        <div
          data-testid="bring-your-history"
          data-imported={imported ? 'yes' : 'no'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.sizing.scale600,
            maxHeight: '78vh',
            overflowY: 'auto',
            overflowX: 'clip',  // one-axis scrollport: overflow-y:auto computes overflow-x:auto (FEED-IA §13)
            minWidth: 0,
          }}
        >
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              display: 'flex',
              alignItems: 'flex-start',
              gap: theme.sizing.scale500,
              paddingBottom: theme.sizing.scale400,
              borderBottom: `1px solid ${theme.colors.borderOpaque}`,
              background: theme.colors.backgroundPrimary,
              minWidth: 0,
            }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
              <h2 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Import history</h2>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                {imported
                  ? `Imported ${stamp(imported.at)} · ${imported.file}`
                  : 'Choose a delivery-note export to import.'}
              </span>
            </div>
            <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="close-history" onClick={onClose}>
              Close
            </Button>
          </header>

          {imported && said ? (
            <>
              {/* ── THE READBACK, IN SENTENCES (§4.1, §10.2) ─────────────────────────────────
                  What was read and what it taught, in one line a person can repeat out loud —
                  and, under it, the grounding everything else was built on. */}
              <div
                data-testid="import-readback"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.sizing.scale400,
                  padding: theme.sizing.scale600,
                  border: `1px solid ${theme.colors.borderOpaque}`,
                  borderRadius: theme.borders.radius300,
                  background: theme.colors.backgroundPrimary,
                  boxShadow: theme.lighting.shadow400,
                  minWidth: 0,
                }}
              >
                <span style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'flex-start', minWidth: 0 }}>
                  <NoticedMark label="Import complete" />
                  <span data-testid="readback-headline" style={{ ...theme.typography.HeadingXSmall, minWidth: 0 }}>
                    {said.headline}
                  </span>
                </span>
                {said.lines.map((line, i) => (
                  <span
                    key={line}
                    data-testid={`readback-line-${i}`}
                    style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}
                  >
                    {line}
                  </span>
                ))}
              </div>

              {/* ── THE DOORS INTO THE WEB ─────────────────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button kind={KIND.primary} size={SIZE.compact} data-testid="open-web" onClick={() => setWeb(true)}>
                  Review patterns
                </Button>
                <Button
                  kind={KIND.secondary}
                  size={SIZE.compact}
                  data-testid="open-first-profile"
                  onClick={() => setProfile(customerOf(cast, cast.order.customer))}
                >
                  Open {customerOf(cast, cast.order.customer).name}
                </Button>
                <Button
                  kind={KIND.tertiary}
                  size={SIZE.compact}
                  data-testid="forget-history"
                  onClick={() => forgetImports(cast.sector)}
                >
                  Remove imported data
                </Button>
              </div>

              {/* ── A TASTE OF WHAT IT TAUGHT, on the same card the import lives on. The two hops
                  first, because they are the ones the whole architecture rests on. ──────────── */}
              <Block
                testid="import-samples"
                title="Imported patterns"
                lead="Patterns from imported delivery notes."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
                  {[
                    ...knows.observations.filter((o) => o.source === 'import' && o.kind === 'routing').slice(0, 1),
                    ...knows.observations.filter((o) => o.source === 'import' && o.kind === 'prior').slice(0, 1),
                    ...knows.observations.filter((o) => o.source === 'import' && o.kind === 'fulfilment').slice(0, 1),
                  ].map((o) => (
                    <Noticed key={o.id} observation={o} />
                  ))}
                </div>
              </Block>
            </>
          ) : (
            <>
              <DropDoor onFile={(file) => importHistory({ cast, file })} />
              <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '60ch' }}>
                We’ll check customers, products and delivery notes before adding anything.
              </p>
              <div>
                <Button kind={KIND.secondary} size={SIZE.compact} data-testid="open-web" onClick={() => setWeb(true)}>
                  Review patterns
                </Button>
              </div>
            </>
          )}
        </div>
      </OverlayCard>

      <KnowsWeb isOpen={isOpen && web} onClose={() => setWeb(false)} cast={cast} />

      {profile && (
        <CustomerSheetOverlay isOpen onClose={() => setProfile(null)} cast={cast} customer={profile} />
      )}
    </>
  );
}

/** The words the Settings row carries on its right — what the house has brought in, or the act it
 *  is waiting for. Stated here so the row and this card can never say different things. */
export const historyValue = (knows: Knows): string =>
  knows.imported
    ? `${count(knows.imported.albaranes)} delivery notes · ${count(knows.imported.learned)} patterns`
    : 'Bring it in';
