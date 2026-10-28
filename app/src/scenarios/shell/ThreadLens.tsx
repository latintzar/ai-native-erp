/* THE LENS — one rail, three orderings. BUILD-PLAN §8.1.
 *
 * THE CARD SET NEVER CHANGES; only its ordering and its grouping do. That is the point: the
 * catalogue is one set of situations, and the three lenses are three questions asked of it.
 *
 *   1 GROUPS  (default) — brief §7's eleven headings, each with its count and what it decides.
 *   2 FLOWS   — FLOWS' four threads. A card sits at its step; a card on two threads appears on
 *               both. Each step states what it receives and what it hands on, so the rail reads
 *               as the chain rather than as a list.
 *   3 SCREENS — grouped by canonical screen, so the reduction is NAVIGABLE before it is
 *               tabulated. This is the view the puzzle phase works in.
 *
 * Every heading carries a live count, computed from the metas the build actually found. A step
 * with nothing drawn yet shows as empty rather than as a promise.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import type { CatalogueEntry } from './context';
import { GROUPS } from '../data/dimensions';
import { THREADS } from '../data/threads';

export type Lens = 'groups' | 'flows' | 'screens';
export const LENSES: Lens[] = ['groups', 'flows', 'screens'];

export type ThreadLensProps = {
  lens: Lens;
  setLens: (l: Lens) => void;
  metas: CatalogueEntry[];
  /** the card on screen */
  route: string;
};

export default function ThreadLens({ lens, setLens, metas, route }: ThreadLensProps) {
  const [, theme] = useStyletron();
  return (
    <>
      <SegmentedControl
        activeKey={LENSES.indexOf(lens)}
        onChange={({ activeKey }) => setLens(LENSES[Number(activeKey)])}
        overrides={{
          Root: { style: { width: '100%', marginBottom: theme.sizing.scale600 } },
          SegmentList: { style: { width: '100%' } },
        }}
      >
        <Segment label="Groups" />
        <Segment label="Flows" />
        <Segment label="Screens" />
      </SegmentedControl>

      {lens === 'groups' && <ByGroup metas={metas} route={route} />}
      {lens === 'flows' && <ByThread metas={metas} route={route} />}
      {lens === 'screens' && <ByScreen metas={metas} route={route} />}
    </>
  );
}

/* ── the rail's own furniture ─────────────────────────────────────────────────────────────── */

function Heading({ text, note, count }: { text: string; note?: string; count?: number }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ padding: `${theme.sizing.scale600} ${theme.sizing.scale300} ${theme.sizing.scale200}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300 }}>
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}>{text}</span>
        {count !== undefined && (
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{count}</span>
        )}
      </div>
      {note && (
        <p style={{ margin: '2px 0 0', ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
          {note}
        </p>
      )}
    </div>
  );
}

function Entry({ meta, route }: { meta: CatalogueEntry; route: string }) {
  const [, theme] = useStyletron();
  const on = route === meta.id;
  return (
    <a
      href={`#/${meta.id}`}
      style={{
        display: 'block',
        padding: `2px ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius100,
        textDecoration: 'none',
        ...theme.typography.ParagraphSmall,
        color: on ? theme.colors.backgroundPrimary : theme.colors.contentPrimary,
        background: on ? theme.colors.contentPrimary : 'transparent',
      }}
    >
      <span style={theme.typography.LabelSmall}>{meta.id}</span>{' '}
      <span style={{ color: on ? theme.colors.backgroundPrimary : theme.colors.contentSecondary }}>{meta.title}</span>
    </a>
  );
}

function Empty({ text }: { text: string }) {
  const [, theme] = useStyletron();
  return (
    <p style={{ margin: `0 0 0 ${theme.sizing.scale300}`, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
      {text}
    </p>
  );
}

/* ── 1 · groups ───────────────────────────────────────────────────────────────────────────── */

function ByGroup({ metas, route }: { metas: CatalogueEntry[]; route: string }) {
  return (
    <>
      {GROUPS.map((g) => {
        const mine = metas.filter((m) => m.group === g.id);
        return (
          <div key={g.id}>
            <Heading text={`${g.id} · ${g.heading}`} note={g.decides} count={mine.length} />
            {mine.map((m) => <Entry key={m.id} meta={m} route={route} />)}
            {mine.length === 0 && <Empty text="drawn in a later wave" />}
          </div>
        );
      })}
    </>
  );
}

/* ── 2 · flows ────────────────────────────────────────────────────────────────────────────── */

function ByThread({ metas, route }: { metas: CatalogueEntry[]; route: string }) {
  const [, theme] = useStyletron();
  return (
    <>
      {THREADS.map((t) => (
        <div key={t.id}>
          <Heading
            text={`T${t.id} · ${t.name}`}
            note={t.note}
            count={metas.filter((m) => m.thread.includes(t.id)).length}
          />
          {t.steps.map((s) => {
            const mine = metas.filter((m) => m.thread.includes(t.id) && m.step === s.n);
            return (
              <div key={s.n} style={{ marginBottom: theme.sizing.scale200 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: theme.sizing.scale300,
                    padding: `0 ${theme.sizing.scale300}`,
                    ...theme.typography.LabelXSmall,
                    color: theme.colors.contentTertiary,
                  }}
                >
                  <span>{s.n}</span>
                  <span>{s.name}</span>
                </div>
                <div style={{ padding: `0 ${theme.sizing.scale300}`, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                  {s.receives} → {s.hands}
                </div>
                {mine.map((m) => <Entry key={m.id} meta={m} route={route} />)}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ── 3 · screens ──────────────────────────────────────────────────────────────────────────── */

function ByScreen({ metas, route }: { metas: CatalogueEntry[]; route: string }) {
  const screens = [...new Set(metas.map((m) => m.canonical))].sort();
  return (
    <>
      {screens.map((s) => {
        const mine = metas.filter((m) => m.canonical === s);
        return (
          <div key={s}>
            <Heading text={s} count={mine.length} note={mine.length === 1 ? 'one card, one screen' : `${mine.length} cards on one screen`} />
            {mine.map((m) => <Entry key={m.id} meta={m} route={route} />)}
          </div>
        );
      })}
      {screens.length === 0 && <Empty text="the screens arrive with the build waves" />}
    </>
  );
}
