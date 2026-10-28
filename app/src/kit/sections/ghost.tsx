/* Ghost — the structured-skeleton vocabulary of the scenarios' negative space.
 *
 * Grown from Base's `skeleton` anatomy (see src/rocoto/ghost/); this page demonstrates it like any
 * other component. The demo content is neutral throughout — the whispers name UI regions
 * («Detail», «Summary»), the references are bare scenario ids («B3»), and nothing here says what
 * the product is about. A themed ghost would decide the very region the ghost exists to leave
 * open, which is the same law as the kit's neutral copy, one level up.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button } from 'baseui/button';
import { Section, Tile, Grid, Row } from '../chrome';
import {
  GhostBlock,
  GhostAvatar,
  GhostFigure,
  GhostRow,
  GhostList,
  GhostCard,
  GhostTabs,
  GhostHeader,
  GhostNav,
} from '../../rocoto/ghost';

/** the kit's own caption for a variant inside a Tile — the same quiet step the whisper uses */
const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        width: 72,
        flex: 'none',
      }}
    >
      {children}
    </span>
  );
};

const Full: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: '100%' }}>{children}</div>
);

export default function GhostSection() {
  const [, theme] = useStyletron();
  const stack = (gap: string): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap,
    width: '100%',
  });

  return (
    <Section
      t="Ghost"
      n="The grammar of a scenario's negative space. Everything a screen is not deciding is drawn as grey wireframe shapes: the architecture is kept, the detail is dropped, and the region stays honestly open until the scenario that owns it says otherwise."
    >
      <Grid>
        {/* ── the primitive ─────────────────────────────────────────────────────────────────── */}
        <Tile
          span={4}
          name="Shape"
          rule="Five shapes are the whole vocabulary: a region, a line of text, an icon, a person, a control. A ghost says what KIND of thing stands there and stops."
        >
          <div style={stack(theme.sizing.scale500)}>
            {(['block', 'line', 'square', 'circle', 'pill'] as const).map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500 }}>
                <Note>{s}</Note>
                <GhostBlock shape={s} height={s === 'block' ? theme.sizing.scale900 : undefined} />
              </div>
            ))}
          </div>
        </Tile>

        <Tile
          span={4}
          name="Tone"
          rule="Three steps, and three is the whole ramp: a region, a shape standing in it, and a shape that carries weight. Base's mono ramp for the value, the brand's ink for the cast — so the skeleton re-themes with everything else."
        >
          <div style={stack(theme.sizing.scale500)}>
            {(['faint', 'default', 'strong'] as const).map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500 }}>
                <Note>{t}</Note>
                <GhostBlock tone={t} height={theme.sizing.scale800} />
              </div>
            ))}
          </div>
        </Tile>

        <Tile
          span={4}
          name="Whisper"
          rule="One or two words naming what stands there — a name, never a sentence. A sentence would decide the region."
        >
          <div style={stack(theme.sizing.scale500)}>
            <GhostBlock label="Summary" height={theme.sizing.scale1600} />
            <GhostBlock label="Filters" tone="faint" height={theme.sizing.scale1600} />
          </div>
        </Tile>

        <Tile
          span={4}
          name="Reference"
          rule="The scenario that owns this region, on a chip with a leading arrow. Every grey area either points at its owner or is openly open — ink, never the accent, which marks the AI's own act."
        >
          <div style={stack(theme.sizing.scale500)}>
            <GhostBlock reference="B3" height={theme.sizing.scale1600} />
            <GhostBlock label="Detail" reference="C7" height={theme.sizing.scale1600} />
          </div>
        </Tile>

        <Tile
          span={4}
          name="Avatar"
          rule="A person, unnamed. Three sizes on Base's own steps, so a ghosted row and a real one line up on the same baseline."
        >
          <Row>
            {(['compact', 'default', 'large'] as const).map((s) => (
              <GhostAvatar key={s} size={s} />
            ))}
            <GhostAvatar tone="strong" />
            <GhostAvatar tone="faint" />
          </Row>
        </Tile>

        <Tile
          span={4}
          name="Figure"
          rule="A number-shaped blank, sized on Figure's own ramp so it is exactly as tall as the number that replaces it. The unit stub shares its line, because that is where a unit lives."
        >
          <div style={stack(theme.sizing.scale500)}>
            {(['compact', 'default', 'large'] as const).map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500 }}>
                <Note>{s}</Note>
                <GhostFigure size={s} digits={4} unit />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500 }}>
              <Note>2 digits</Note>
              <GhostFigure digits={2} />
            </div>
          </div>
        </Tile>

        {/* ── the row ───────────────────────────────────────────────────────────────────────── */}
        <Tile
          span={6}
          name="Row"
          rule="Base's own List Item anatomy, emptied: head, middle, tail. The first line reads heavier than the ones under it, because that is what a title does — the ghost keeps the hierarchy after dropping the words."
        >
          <Full>
            <div style={stack(theme.sizing.scale300)}>
              <GhostRow index={0} leading="avatar" lines={2} trailing="figure" />
              <GhostRow index={1} leading="square" lines={2} trailing="control" />
              <GhostRow index={2} leading="none" lines={1} trailing="none" />
              <GhostRow index={3} leading="square" lines={3} trailing="figure" />
            </div>
          </Full>
        </Tile>

        <Tile
          span={6}
          name="Row — density and selection"
          rule="Three density steps, and the row the surface is on: the faintest wash, so «this one» reads with no hue at all."
        >
          <Full>
            <div style={stack(theme.sizing.scale300)}>
              {(['compact', 'default', 'large'] as const).map((s, i) => (
                <GhostRow key={s} index={i} size={s} leading="avatar" lines={2} trailing="control" />
              ))}
              <GhostRow index={3} leading="avatar" lines={2} trailing="control" selected />
            </div>
          </Full>
        </Tile>

        <Tile
          span={6}
          name="List"
          rule="The count is the honest part: a region that will hold about five things renders about five things. A ghost showing three where the screen holds thirty has quietly decided the density."
        >
          <Full>
            <GhostList rows={5} leading="avatar" lines={2} trailing="figure" selected={1} />
          </Full>
        </Tile>

        <Tile
          span={6}
          name="List — one line, no rules"
          rule="Same list, at its plainest: one line a row and the hairlines dropped. Rows, lines, leading and trailing all pass straight through to every row."
        >
          <Full>
            <GhostList rows={6} lines={1} size="compact" divider={false} />
          </Full>
        </Tile>

        {/* ── the surfaces ──────────────────────────────────────────────────────────────────── */}
        <Tile
          span={6}
          name="Tabs"
          rule="How many ways this surface divides, and which one it is on. The selected tab carries Base's own highlight in the strong wash."
        >
          <Full>
            <div style={stack(theme.sizing.scale800)}>
              <GhostTabs tabs={4} selected={1} />
              <GhostTabs tabs={2} selected={0} />
            </div>
          </Full>
        </Tile>

        <Tile
          span={6}
          name="Header"
          rule="Where the screen came from, what it is called, what can be done to it. The controls take three different widths on purpose — a header whose controls are all one width reads as a diagram of a header."
        >
          <Full>
            <div style={stack(theme.sizing.scale600)}>
              <GhostHeader back subtitle actions={3} />
              <GhostHeader actions={1} divider={false} />
            </div>
          </Full>
        </Tile>

        <Tile
          span={4}
          name="Nav — side"
          rule="The desk frame: a rail down the left, one destination a row, and the one the surface is on carried by the wash."
        >
          <Full>
            <GhostNav variant="side" items={5} selected={1} brand width="100%" />
          </Full>
        </Tile>

        <Tile
          span={4}
          name="Nav — bottom"
          rule="The phone frame: same vocabulary, same greys, one variant apart. Which is the reduction the puzzle looks for, showing up early in the skeleton."
        >
          <Full>
            <GhostNav variant="bottom" items={4} selected={2} />
          </Full>
        </Tile>

        <Tile
          span={4}
          name="Card"
          rule="The shape a card takes before anyone decides what is on it: a picture region, a title, some lines, a control. Paper ground and Base's hairline, so a wall of these still reads as cards."
        >
          <Full>
            <div style={stack(theme.sizing.scale500)}>
              <GhostCard media lines={2} action />
              <GhostCard lines={1} />
            </div>
          </Full>
        </Tile>

        {/* ── the two states that are about time and about nesting ──────────────────────────── */}
        <Tile
          span={6}
          name="Loading"
          rule="The narrow exception. The skeleton here means undecided, so it holds still by default; set loading only where a surface is genuinely waiting on data, and Base's own shimmer runs with Base's own duration and curve."
        >
          <Full>
            <div style={stack(theme.sizing.scale500)}>
              <GhostBlock loading height={theme.sizing.scale900} aria-label="Loading" />
              <GhostRow loading leading="avatar" lines={2} trailing="figure" />
              <GhostCard loading media lines={2} />
            </div>
          </Full>
        </Tile>

        <Tile
          span={6}
          name="Decided inside undecided"
          rule="The nesting slot. Give a ghost children and it yields its ground to them: the geometry stays, the fill drops, and pointer events come back — so a decided moment can be seen standing exactly where it lives in a page nobody has decided yet."
        >
          <Full>
            <div style={stack(theme.sizing.scale500)}>
              <GhostList rows={2} lines={1} size="compact" divider={false} />
              <GhostRow index={2} leading="avatar" trailing="control">
                <Button size="compact">Hello</Button>
              </GhostRow>
              <GhostList rows={2} lines={1} size="compact" divider={false} />
            </div>
          </Full>
        </Tile>

        {/* ── the whole point ───────────────────────────────────────────────────────────────── */}
        <Tile
          span={12}
          name="A page in Ghost"
          rule="A believable screen sketched entirely in this vocabulary — rail, header, tabs, a grid of cards, a panel — carrying one whisper and one reference. This is what a scenario's negative space looks like around whatever that scenario draws in full."
        >
          <Full>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 260px',
                gap: theme.sizing.scale700,
                // the rail runs the full height of the screen it frames, the way a rail does
                alignItems: 'stretch',
                border: `1px solid ${theme.colors.borderTransparent}`,
                borderRadius: theme.borders.radius300,
                padding: theme.sizing.scale600,
                background: theme.colors.backgroundPrimary,
              }}
            >
              <GhostNav variant="side" items={6} selected={2} brand width="100%" />

              <div style={stack(theme.sizing.scale700)}>
                <GhostHeader back subtitle actions={3} />
                <GhostTabs tabs={4} selected={1} />
                <GhostBlock reference="B3">
                  <div style={{ paddingTop: theme.sizing.scale800 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: theme.sizing.scale600,
                      }}
                    >
                      <GhostCard media lines={2} action />
                      <GhostCard media lines={2} action />
                      <GhostCard media lines={1} action />
                      <GhostCard media lines={3} action />
                    </div>
                  </div>
                </GhostBlock>
              </div>

              <div style={stack(theme.sizing.scale600)}>
                <GhostBlock label="Detail" height={theme.sizing.scale4800} />
                <GhostList rows={3} lines={1} size="compact" />
                <Row>
                  <GhostFigure size="large" digits={4} unit />
                </Row>
              </div>
            </div>
          </Full>
        </Tile>
      </Grid>
    </Section>
  );
}
