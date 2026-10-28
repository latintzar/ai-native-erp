/* THE CONSOLIDATED PAGE — `#/reduction`. BUILD-PLAN §9.
 *
 * EVERYTHING ON IT IS COMPUTED FROM THE `meta` OBJECTS. Nothing is typed by hand, so it cannot
 * drift from what was actually drawn, and it is the surface the founder reads at the end of the
 * wave. It renders with two cards in it today and with fifty-eight later, WITH ZERO EDITS.
 *
 * The six tables:
 *   1 THE REDUCTION — one row per canonical screen, with the delta of every card in the cluster.
 *   2 THE REFERENCE GRAPH — edges out and edges in, most-leaned-on first.
 *   3 THE OPEN REGISTER — sorted by inbound count, each with what would settle it.
 *   4 THE JUNCTIONS — field · filled in · read in. A field with a reader and no filler is a HOLE.
 *     A field with a filler and no reader is BUSYWORK and gets cut. The sharpest automated check
 *     in the catalogue, and the reason `fills` and `reads` are required meta.
 *   5 DIMENSION COVERAGE — D1–D17 × configuration × the cards that render it. A configuration
 *     with no card is a hole in the catalogue, and this names it.
 *   6 THE SECTOR MATRIX — every card × {fish, meat, fruit}. The count that matters is `≠` cells
 *     that are ABSENCES (correct, group K working) against `≠` cells that are BREAKAGES.
 *
 * And §9.3's primitive coverage under them: U01–U15 × the cards that exercise each.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import { SECTORS } from '../data/cast';
import { OPENS } from '../data/open';
import { JUNCTIONS, INFORME_INPUTS } from '../data/threads';
import { DIMENSIONS, PRIMITIVES } from '../data/dimensions';
import RefChip from '../shell/RefChip';
import OpenChip, { openNumber } from '../shell/OpenChip';

/* The plan's prediction, so the page can state what it PROVED or BROKE rather than only what it
 * counted. These two numbers are the brief's own ask, at the foot. */
const PREDICTED = { situations: 58, screens: 22 };

/* ── table furniture ──────────────────────────────────────────────────────────────────────── */

function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                style={{
                  ...theme.typography.LabelXSmall,
                  color: theme.colors.contentTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  textAlign: 'left',
                  padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                  borderBottom: `1px solid ${theme.colors.contentPrimary}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, nowrap }: { children?: React.ReactNode; nowrap?: boolean }) {
  const [, theme] = useStyletron();
  return (
    <td
      style={{
        ...theme.typography.ParagraphSmall,
        padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        verticalAlign: 'top',
        whiteSpace: nowrap ? 'nowrap' : 'normal',
      }}
    >
      {children}
    </td>
  );
}

function Block({ n, title, note, children }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <section style={{ marginTop: theme.sizing.scale1200 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, marginBottom: theme.sizing.scale300 }}>
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentTertiary }}>{n}</span>
        <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{title}</h2>
      </div>
      {note && (
        <p style={{ margin: `0 0 ${theme.sizing.scale500}`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '78ch' }}>
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

function Flag({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        padding: `1px ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius100,
        border: `1px solid ${theme.colors.contentPrimary}`,
        background: theme.colors.contentPrimary,
        color: theme.colors.backgroundPrimary,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const Ids: React.FC<{ ids: string[] }> = ({ ids }) => {
  const [, theme] = useStyletron();
  if (ids.length === 0) return <span style={{ color: theme.colors.contentTertiary }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: theme.sizing.scale200 }}>
      {ids.map((id) => <RefChip key={id} to={id} size="mini" />)}
    </span>
  );
};

/* ── the page ─────────────────────────────────────────────────────────────────────────────── */

export default function Reduction({ metas }: { metas: ScenarioMeta[] }) {
  const [, theme] = useStyletron();

  /* 1 · the clusters */
  const screens = [...new Set(metas.map((m) => m.canonical))].sort();
  const clusters = screens.map((name) => {
    const cards = metas.filter((m) => m.canonical === name);
    return {
      name,
      cards,
      deltas: [...new Set(cards.map((c) => c.delta))],
      frames: [...new Set(cards.map((c) => c.frame))],
      primitives: [...new Set(cards.flatMap((c) => c.primitives))].sort(),
      dims: [...new Set(cards.flatMap((c) => c.dims))].sort(),
      sector: SECTORS.map((s) => ({ s, verdicts: [...new Set(cards.map((c) => c.sector[s]))] })),
    };
  });

  /* 2 · the graph */
  const graph = metas
    .map((m) => ({
      id: m.id,
      out: [...m.inherits.map((i) => i.ref), ...m.open.map((o) => o.ref)],
      in: metas.filter((o) => o.inherits.some((i) => i.ref === m.id)).map((o) => o.id),
    }))
    .sort((a, b) => b.in.length - a.in.length || a.id.localeCompare(b.id));

  /* the settled surface is not a card and still carries edges; it belongs on the graph */
  const chatIn = metas.filter((m) => m.inherits.some((i) => i.ref === 'chat')).map((m) => m.id);

  /* 3 · the open register */
  const opens = OPENS.map((o) => ({
    ...o,
    leanedOn: metas.filter((m) => m.open.some((x) => openNumber(x.ref) === o.n)).map((m) => m.id),
  })).sort((a, b) => b.leanedOn.length - a.leanedOn.length || a.n - b.n);

  /* 4 · the junctions. Every field any card touches, with the nine seams always present. */
  const fields = [
    ...new Set([...JUNCTIONS.map((j) => j.field), ...metas.flatMap((m) => [...m.fills, ...m.reads])]),
  ].sort();
  const junction = fields.map((field) => {
    const filled = metas.filter((m) => m.fills.includes(field)).map((m) => m.id);
    const read = metas.filter((m) => m.reads.includes(field)).map((m) => m.id);
    const seam = JUNCTIONS.find((j) => j.field === field);
    return {
      field,
      seam,
      filled,
      read,
      informe: INFORME_INPUTS.includes(field),
      verdict:
        filled.length === 0 && (read.length > 0 || INFORME_INPUTS.includes(field))
          ? 'hole'
          : filled.length > 0 && read.length === 0 && !INFORME_INPUTS.includes(field)
            ? 'busywork'
            : filled.length === 0 && read.length === 0
              ? 'undrawn'
              : 'joined',
    };
  });

  /* 5 · dimension coverage */
  const coverage = DIMENSIONS.map((d) => ({
    ...d,
    configurations: d.configurations.map((c) => ({
      ...c,
      cards: metas.filter((m) => m.dims.includes(c.id)).map((m) => m.id),
    })),
  }));
  const uncovered = coverage.flatMap((d) => d.configurations.filter((c) => c.cards.length === 0));

  /* 6 · the sector matrix */
  const absences = metas.flatMap((m) => SECTORS.filter((s) => m.sector[s] === '≠').map((s) => `${m.id}/${s}`));

  return (
    <div style={{ maxWidth: 1400 }}>
      <header>
        <h1 style={{ margin: 0, ...theme.typography.HeadingLarge }}>The reduction</h1>
        <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, maxWidth: '78ch' }}>
          Every figure below is computed from the scenarios that have actually been drawn. Nothing on
          this page is typed by hand, which is why it can be read as a measurement rather than as a
          claim.
        </p>
      </header>

      {/* ── the two numbers the brief asks for ── */}
      <div
        style={{
          display: 'flex',
          gap: theme.sizing.scale1000,
          flexWrap: 'wrap',
          padding: theme.sizing.scale700,
          marginTop: theme.sizing.scale600,
          border: `1px solid ${theme.colors.contentPrimary}`,
          borderRadius: theme.borders.radius400,
        }}
      >
        {[
          { label: 'situations written', value: metas.length, of: PREDICTED.situations },
          { label: 'screens actually required', value: screens.length, of: PREDICTED.screens },
          { label: 'configurations with a card', value: `${DIMENSIONS.flatMap((d) => d.configurations).length - uncovered.length}`, of: DIMENSIONS.flatMap((d) => d.configurations).length },
          { label: 'sector absences', value: absences.length },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ ...theme.typography.DisplayXSmall }}>
              {s.value}
              {s.of !== undefined && (
                <span style={{ ...theme.typography.LabelMedium, color: theme.colors.contentTertiary }}> / {s.of}</span>
              )}
            </div>
            <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── 1 ── */}
      <Block
        n="1"
        title="The reduction table"
        note="One row per canonical screen. The category is the set of deltas the cluster actually holds; the delta column carries each card's own clause, so a card can never claim a reduction this page does not also count. A cluster spanning two frames is flagged for review."
      >
        <Table head={['Screen', 'Cards', 'n', 'Category', 'The delta, exactly', 'Frame', 'Primitives', 'Selected by', 'Sector']}>
          {clusters.map((c) => (
            <tr key={c.name}>
              <Cell nowrap><strong>{c.name}</strong></Cell>
              <Cell><Ids ids={c.cards.map((x) => x.id)} /></Cell>
              <Cell nowrap>{c.cards.length}</Cell>
              <Cell nowrap>{c.deltas.join(' · ')}</Cell>
              <Cell>
                {c.cards.map((x) => (
                  <div key={x.id}>
                    <strong>{x.id}</strong> {x.deltaText}
                  </div>
                ))}
              </Cell>
              <Cell nowrap>
                {c.frames.join(' · ')} {c.frames.length > 1 && <Flag>two frames</Flag>}
              </Cell>
              <Cell nowrap>{c.primitives.join(' · ') || '—'}</Cell>
              <Cell>{c.dims.join(' · ') || '—'}</Cell>
              <Cell nowrap>
                {c.sector.map(({ s, verdicts }) => `${s} ${verdicts.join('/')}`).join(' · ')}
              </Cell>
            </tr>
          ))}
        </Table>
      </Block>

      {/* ── 2 ── */}
      <Block
        n="2"
        title="The reference graph"
        note="Edges out are what a card leans on; edges in are who leans on it. The card at the top owes the most, which is why it is drawn first and frozen."
      >
        <Table head={['Card', 'Leans on', 'Leaned on by', 'In']}>
          {graph.map((g) => (
            <tr key={g.id}>
              <Cell nowrap><RefChip to={g.id} /></Cell>
              <Cell><Ids ids={g.out} /></Cell>
              <Cell><Ids ids={g.in} /></Cell>
              <Cell nowrap>{g.in.length}</Cell>
            </tr>
          ))}
          <tr>
            <Cell nowrap><RefChip to="chat" settled /></Cell>
            <Cell>the settled surface</Cell>
            <Cell><Ids ids={chatIn} /></Cell>
            <Cell nowrap>{chatIn.length}</Cell>
          </tr>
        </Table>
      </Block>

      {/* ── 3 ── */}
      <Block
        n="3"
        title="The open register"
        note="Sorted by how many cards lean on each. A region shown as closed carries how it was closed, so the hole and its patch stay on one row."
      >
        <Table head={['', 'Region', 'Why it is open', 'What would settle it', 'Leaned on by']}>
          {opens.map((o) => (
            <tr key={o.n}>
              <Cell nowrap><OpenChip n={o.n} /></Cell>
              <Cell nowrap>
                {o.title} {o.closedBy && <Flag>closed</Flag>}
              </Cell>
              <Cell>{o.why}</Cell>
              <Cell>{o.closedBy ?? o.settledBy}</Cell>
              <Cell><Ids ids={o.leanedOn} /></Cell>
            </tr>
          ))}
        </Table>
      </Block>

      {/* ── 4 ── */}
      <Block
        n="4"
        title="The junctions"
        note="A field with a reader and no filler is a HOLE. A field with a filler and no reader is BUSYWORK and gets cut. The informe has no card, so its input list runs through the same check: anything it wants that nobody fills is a new capture card."
      >
        <Table head={['Field', 'Seam', 'Filled in', 'Read in', 'Verdict']}>
          {junction.map((j) => (
            <tr key={j.field}>
              <Cell nowrap>
                <code style={theme.typography.LabelSmall}>{j.field}</code>
                {j.informe && <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}> · informe</span>}
              </Cell>
              <Cell>{j.seam?.object ?? '—'}</Cell>
              <Cell><Ids ids={j.filled} /></Cell>
              <Cell><Ids ids={j.read} /></Cell>
              <Cell nowrap>
                {j.verdict === 'joined' ? 'joined' : <Flag>{j.verdict}</Flag>}
              </Cell>
            </tr>
          ))}
        </Table>
      </Block>

      {/* ── 5 ── */}
      <Block
        n="5"
        title="Dimension coverage"
        note={`The seventeen dimensions crossed with the cards that render each configuration. ${uncovered.length} configurations are still waiting for a card.`}
      >
        <Table head={['Dimension', 'Configuration', 'Meaning', 'Cards']}>
          {coverage.flatMap((d) =>
            d.configurations.map((c, i) => (
              <tr key={c.id}>
                <Cell nowrap>{i === 0 ? `${d.id} · ${d.question}` : ''}</Cell>
                <Cell nowrap><code style={theme.typography.LabelSmall}>{c.id}</code></Cell>
                <Cell>{c.meaning}</Cell>
                <Cell>
                  {c.cards.length ? <Ids ids={c.cards} /> : <Flag>no card</Flag>}
                </Cell>
              </tr>
            )),
          )}
        </Table>
      </Block>

      {/* ── 6 ── */}
      <Block
        n="6"
        title="The sector matrix"
        note="The founder reads this table as the answer to «is it one product or three?». Every ≠ is either an absence the rail already shows — correct, group K working — or a breakage. The target is zero breakages."
      >
        <Table head={['Card', 'fish', 'meat', 'fruit', 'Drawn with', 'The delta']}>
          {metas.map((m) => (
            <tr key={m.id}>
              <Cell nowrap><RefChip to={m.id}>{m.title}</RefChip></Cell>
              {SECTORS.map((s) => (
                <Cell key={s} nowrap>
                  <span style={theme.typography.LabelMedium}>{m.sector[s]}</span>
                </Cell>
              ))}
              <Cell nowrap>{m.drawnWith}</Cell>
              <Cell>{m.deltaText}</Cell>
            </tr>
          ))}
        </Table>
      </Block>

      {/* ── §9.3 ── */}
      <Block
        n="7"
        title="Primitive coverage"
        note="U12 appears only on K, and that is correct. A primitive with one card is a candidate for deletion; a card with no primitive and no kit component at full fidelity has not drawn anything."
      >
        <Table head={['', 'Primitive', 'What it is', 'Cards']}>
          {PRIMITIVES.map((p) => {
            const cards = metas.filter((m) => m.primitives.includes(p.id)).map((m) => m.id);
            return (
              <tr key={p.id}>
                <Cell nowrap><code style={theme.typography.LabelSmall}>{p.id}</code></Cell>
                <Cell nowrap>{p.name}</Cell>
                <Cell>{p.note}</Cell>
                <Cell>{cards.length ? <Ids ids={cards} /> : <Flag>no card</Flag>}</Cell>
              </tr>
            );
          })}
        </Table>
      </Block>
    </div>
  );
}
