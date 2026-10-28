/* WRITING — the content canon, rendered as kit pages.
 *
 * Provenance: FEED-IA §75.8. Peter pasted Uber Base's content pages whole (Writing for users ·
 * Product voice · Product tone · Content heuristics · capitalization · contractions · emojis ·
 * punctuation); they live verbatim-faithful at `docs/design/base-uber-extract/content/`. The
 * ADAPTATION — Rocoto's register, on Rocoto's surface, checked against Rocoto's own strings — is
 * `notes/THE-CONTENT-CANON.md`. These five pages RENDER that canon. They do not restate it in
 * other words: the Spanish specimens are the canon's own strings, verbatim, and the file:line
 * beside each one is where the string lives in this app.
 *
 * THE PAGE OBEYS THE CANON IT TEACHES. Headings are noun labels. The Do column carries the ink
 * and the Don't column is struck and dimmed, because the most important message is the most
 * noticeable. Every figure keeps its unit on its own line. No slot on these pages clamps a
 * heading, and nothing here is set as a paragraph where a label does the job.
 *
 * WHY IT IS FIVE PAGES AND NOT ONE. The canon runs long, and one page carrying all of it would
 * be the exact wall §4's balance gate exists to catch. So: the voice and its rank · the ten
 * laws lifted off real screens · the Spanish mechanics · the overflow register · the four lenses.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Section, Tile, Grid } from '../chrome';
import { Table } from 'baseui/table-semantic';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import { Tag, SIZE as TAG_SIZE } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';

/* ── THE PAGES' OWN FURNITURE ────────────────────────────────────────────────────────────────
 * Small, shared, and none of it owns a colour: every value below is Base's own scale read off
 * the theme, so a re-theme moves these pages with everything else. */

/** the mono line naming where a string lives in this app — the provenance, never decoration */
const Where: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <div style={{ ...theme.typography.MonoLabelXSmall, color: theme.colors.contentTertiary }}>{children}</div>
  );
};

/** a column head or a row label inside a tile */
const Head: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <div style={{
      ...theme.typography.LabelXSmall,
      color: theme.colors.contentTertiary,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      marginBottom: theme.sizing.scale300,
    }}>
      {children}
    </div>
  );
};

/** a specimen: one string, set the way the app sets it */
const S: React.FC<{ dim?: boolean; struck?: boolean; children: React.ReactNode }> = ({ dim, struck, children }) => {
  const [, theme] = useStyletron();
  return (
    <p style={{
      margin: 0,
      ...theme.typography.ParagraphSmall,
      color: dim || struck ? theme.colors.contentTertiary : theme.colors.contentPrimary,
      textDecoration: struck ? 'line-through' : 'none',
    }}>
      {children}
    </p>
  );
};

/** the stack a tile's demo area holds */
const Stack: React.FC<{ gap?: string; children: React.ReactNode }> = ({ gap, children }) => {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: gap ?? theme.sizing.scale500, width: '100%', minWidth: 0 }}>
      {children}
    </div>
  );
};

/** THE PAIR — what the screen says, beside what it said. Do carries the ink; Don't is struck
 *  and dimmed. `strike={false}` where the Don't is a shape rather than a string. */
const Pair: React.FC<{
  where?: string;
  ok: React.ReactNode;
  no: React.ReactNode;
  strike?: boolean;
}> = ({ where, ok, no, strike = true }) => {
  const [, theme] = useStyletron();
  return (
    <Stack gap={theme.sizing.scale550}>
      {where && <Where>{where}</Where>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <Head>Do</Head>
          <S>{ok}</S>
        </div>
        <div style={{
          minWidth: 0,
          borderLeft: `1px solid ${theme.colors.borderTransparent}`,
          paddingLeft: theme.sizing.scale600,
        }}>
          <Head>Don't</Head>
          <S dim struck={strike}>{no}</S>
        </div>
      </div>
    </Stack>
  );
};

/** a label-and-value run — the shape a mapping takes when it is short enough to read at a glance */
const Rows: React.FC<{ items: Array<[React.ReactNode, React.ReactNode]>; w?: number }> = ({ items, w = 132 }) => {
  const [, theme] = useStyletron();
  return (
    <Stack gap={theme.sizing.scale400}>
      {items.map(([k, v], i) => (
        <div key={i} style={{ display: 'flex', gap: theme.sizing.scale550, alignItems: 'baseline', minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, width: w, flex: 'none' }}>{k}</span>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>{v}</span>
        </div>
      ))}
    </Stack>
  );
};

/** a table under its own label — App.tsx's Props block, generalised. The registers are long and
 *  a long register is a table; the tiles above each one carry the parts you have to SEE. */
const Register: React.FC<{ t: string; n: string; columns: string[]; data: string[][] }> = ({ t, n, columns, data }) => {
  const [, theme] = useStyletron();
  return (
    <div style={{ marginTop: theme.sizing.scale1000 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale550, marginBottom: theme.sizing.scale600, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, ...theme.typography.LabelLarge }}>{t}</h4>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '80ch' }}>{n}</span>
      </div>
      <div style={{
        background: theme.colors.backgroundPrimary,
        border: `1px solid ${theme.colors.borderTransparent}`,
        borderRadius: theme.borders.radius300,
        overflow: 'hidden',
      }}>
        <Table
          columns={columns}
          data={data}
          overrides={{ TableBodyCell: { style: { verticalAlign: 'top', fontFamily: 'inherit' } } }}
        />
      </div>
    </div>
  );
};

/** the clamp, as a style — declared once here so the demos below cannot drift from each other */
const clamp = (lines: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
  overflow: 'hidden',
});

const ELLIPSIS: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/* ══ VOICE & TONE ═════════════════════════════════════════════════════════════════════════════ */

/** THE RANK, drawn. Four rungs, each narrower and lighter than the one above it — the hierarchy
 *  is the geometry, so it survives without a legend. */
function Rank() {
  const [, theme] = useStyletron();
  const rungs: Array<[string, string, number]> = [
    ["Peter's lines", 'verbatim', 100],
    ['The house laws', 'over Uber, where they clash', 86],
    ['This canon', 'everything else', 72],
    ['Taste', 'last', 58],
  ];
  return (
    <Stack gap={theme.sizing.scale300}>
      {rungs.map(([name, note, w], i) => (
        <div
          key={name}
          style={{
            width: `${w}%`,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: theme.sizing.scale400,
            padding: `${theme.sizing.scale300} ${theme.sizing.scale550}`,
            borderRadius: theme.borders.radius200,
            background: i === 0 ? theme.colors.contentPrimary : i === 1 ? theme.colors.backgroundTertiary : theme.colors.backgroundPrimary,
            border: `1px ${i === 3 ? 'dashed' : 'solid'} ${i < 2 ? 'transparent' : theme.colors.borderOpaque}`,
          }}
        >
          <span style={{ ...theme.typography.LabelSmall, color: i === 0 ? theme.colors.contentInversePrimary : theme.colors.contentPrimary }}>
            {name}
          </span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: i === 0 ? theme.colors.contentInverseSecondary : theme.colors.contentTertiary }}>
            {note}
          </span>
        </div>
      ))}
    </Stack>
  );
}

const HOUSE_OVER_UBER: string[][] = [
  ["Peter's lines ship verbatim", 'Outranks every rule on this page, tone included. A line he wrote goes in as he wrote it, at full size, in the slot it was written for.'],
  ['No negatives', 'Uber reframes a negative; the house bans the construction. Say what IS — «se guarda en tu cuenta». A fact that exists only as a denial is cut.'],
  ['Headings name the thing', 'Uber allows conversational headers. Here they are scoped to prompts and ghost text; every section heading stays a blatant noun label that passes the self-comprehension test.'],
  ['No slogan cadence', '«Imperative — benefit clause» dies wherever it appears. It is why the raya is banned in H1 and CTA.'],
  ['Orphan sentences die', 'Uber breaks long text up. Here the explanatory sentence dies instead of getting paragraph-broken (§51.24).'],
  ["The trade's nouns are terms", 'Albarán, lote, tarifa, género, trazabilidad, comercial. Locked glossary nouns ship untranslated and unexplained.'],
  ["Price unit on the number's line", '«199 €/mes» in one line box, nowrap, verified at 320px. A unit on its own line quotes a one-off for something that recurs.'],
];

function VoiceAndTone() {
  const [, theme] = useStyletron();
  return (
    <Section
      t="Voice & tone"
      n="Four attributes hold on every surface. Tone is the lever that moves: level on money, errors and the river; lighter on the messaging rail; up only at the Connect and a first confirmed day."
    >
      <Grid>
        <Tile
          span={3}
          name="Direct, never harsh"
          rule="The sentence you would say on the phone. The fact, then stop."
        >
          <Stack>
            <S>«Los albaranes de proveedor entran en Stock. Los tuyos salen a la hora de cada cliente.»</S>
            <div>
              <Head>Never</Head>
              <S dim>Slogan cadence. Billboard lines. Clever reference.</S>
            </div>
          </Stack>
        </Tile>

        <Tile
          span={3}
          name="Confident, never arrogant"
          rule="Rocoto states what it did and shows the evidence beside it."
        >
          <Stack>
            <S>«Guardado»</S>
            <div>
              <Head>Never</Head>
              <S dim>Hedging its own acts. Boasting. «siempre», «por supuesto».</S>
            </div>
          </Stack>
        </Tile>

        <Tile
          span={3}
          name="Approachable, never overly familiar"
          rule="The trade's own words — albarán, lote, tarifa, género — and spoken syntax. They are terms, not jargon."
        >
          <Stack>
            <S>«Sale cuando lo apruebas — uno a uno, o el día entero.»</S>
            <div>
              <Head>Never</Head>
              <S dim>Startup cuteness. A private lexicon the reader must decode.</S>
            </div>
          </Stack>
        </Tile>

        <Tile
          span={3}
          name="Optimistic, never unrealistic"
          rule="Say what IS. The positive fact carries the reassurance on its own."
        >
          <Stack>
            <S>«se guarda en tu cuenta»</S>
            <div>
              <Head>Never</Head>
              <S dim>Negation as reassurance. Hype. Effusiveness.</S>
            </div>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="The rank"
          rule="A line Peter wrote ships as he wrote it, whatever register it is in. The house laws win where Uber's guidance clashes with them. This canon takes everything else, and taste comes last."
        >
          <Rank />
        </Tile>

        <Tile
          span={4}
          name="Tone by surface"
          rule="Voice is constant; tone flexes matter-of-fact ↔ light. Peak-end: pitch-perfect at the highs and the lows, level everywhere between."
        >
          <Rows
            w={148}
            items={[
              ['The river, sheets, admin, money, errors', 'Matter-of-fact. Level.'],
              ['WhatsApp rail, push, templates', 'Slightly lighter. One terminal emoji allowed.'],
              ['The Connect, a first confirmed day', 'The sanctioned delight zone. May lean up.'],
            ]}
          />
        </Tile>

        <Tile
          span={4}
          name="«Por favor» and «Lo sentimos»"
          rule="«Gracias» belongs where the action benefits us or costs them. Effusiveness reads as insincere, so bad news is delivered plainly."
        >
          <Stack>
            <Rows
              w={112}
              items={[
                ['«Por favor»', 'Genuine hardship only.'],
                ['«Lo sentimos»', 'When our system failed. Plain, sincere.'],
                ['«Gracias»', 'When the action benefits us or costs them.'],
              ]}
            />
            <div style={{ borderTop: `1px solid ${theme.colors.borderTransparent}`, paddingTop: theme.sizing.scale400 }}>
              <Head>Never</Head>
              <S dim struck>«Lo sentimos, pero…»</S>
            </div>
          </Stack>
        </Tile>
      </Grid>

      <Register
        t="Where the house outranks Uber"
        n="Seven clashes, each resolved in the house's favour. Everything Uber says that is not on this list is adopted as written."
        columns={['House law', 'The clash, resolved']}
        data={HOUSE_OVER_UBER}
      />
    </Section>
  );
}

/* ══ WRITING FOR USERS ════════════════════════════════════════════════════════════════════════ */

function WritingForUsers() {
  const [, theme] = useStyletron();
  return (
    <Section
      t="Writing for users"
      n="Ten laws, each one lifted off a screen in this app. The strings are the shipped Spanish; the design build drafts them in English first and ships them in Spanish."
    >
      <Grid>
        <Tile
          span={12}
          name="The diagram is not narrated"
          rule="The drawing carries the rest. A picture that needs its own narration beside it is a picture that has not been drawn yet."
        >
          <Pair
            where="knows-web.tsx:285 · 45 words"
            ok="«Cuanto más gruesa la línea, más veces ha pasado.»"
            no="«Un cliente a la izquierda, una rama del árbol en el centro, lo que vendes a la derecha. Las palabras caen en una rama; la rama…»"
          />
        </Tile>

        <Tile
          span={6}
          name="Lead with what they get"
          rule="The method is the second sentence, or no sentence at all. Start with the user's goal, never with the machinery that serves it."
        >
          <Pair
            where="areas/admin/data.tsx:440"
            ok="«Un año de tu ERP le enseña a Rocoto qué significa la palabra de cada cliente.»"
            no="«Un año de pedidos, albaranes, facturas y clientes, directo de tu ERP. Rocoto pone cada nombre en el árbol, luego aprende…»"
          />
        </Tile>

        <Tile
          span={6}
          name="One idea per line"
          rule="Two facts joined by «y» are two sentences. Splitting them also removes the comma that Spanish would have refused anyway."
        >
          <Pair
            where="areas/admin/connections.tsx:120"
            ok="«Los albaranes de proveedor entran en Stock. Los tuyos salen a la hora de cada cliente.»"
            no="«Los albaranes de proveedor entran en Stock con el archivo adjunto, y los tuyos llegan a los clientes a la hora que pidieron.»"
          />
        </Tile>

        <Tile
          span={6}
          name="Copy never points at the screen"
          rule="The control's position is the layout's job. Directional words break under translation and under a screen reader, and they go stale the first time the layout moves."
        >
          <Pair
            where="app-settings.tsx:223 · team.tsx:385 · operations.tsx:156"
            ok="«Las reglas se escriben en Stock, en la ficha del producto.»"
            no="«Las que escribes aparecen aquí.» · «…y este interruptor se abre.»"
          />
        </Tile>

        <Tile
          span={6}
          name="Simple words"
          rule="Albarán, lote, tarifa, género, trazabilidad and comercial stay: they are the trade's own nouns and the only jargon allowed. An invented lexicon hands the reader work that the writer skipped."
        >
          <Pair
            where="areas/admin/agent.tsx:133 · :148"
            ok="«Sale cuando lo apruebas — uno a uno, o el día entero.»"
            no="«la prensa» · «el muelle» · «espera tu mano» · «la salida»"
          />
        </Tile>

        <Tile
          span={6}
          name="The helper never repeats the surface"
          rule="If the list already says it, the sentence dies (§51.7, §51.24). Counting on the reader's behalf is the surface's job, and it already did it."
        >
          <Pair
            where="customer-profile.tsx:836 · data.tsx:449"
            ok="«Todo lo enviado, lo más nuevo primero.»"
            no="«Todo lo que les ha salido, lo más nuevo primero — los N de hoy y los M anteriores.»"
          />
        </Tile>

        <Tile
          span={6}
          name="No editorializing"
          rule="State what happens. «Siempre», «simplemente», «fácil» and «solo» tell the reader how to feel about a fact instead of giving them the fact."
        >
          <Pair
            where="areas/admin/agent.tsx:616"
            ok="«Una edición reinicia el margen; viaja el corregido.»"
            no="«…así lo que viaja es siempre el corregido.»"
          />
        </Tile>

        <Tile
          span={4}
          name="No idioms"
          rule="Localization breaks them, and a Spanish surface drafted in English inherits every one that survives the draft."
        >
          <Pair where="shell/printing.tsx:958" ok="«Pídelo y lo dejamos conectado.»" no="«say the word»" />
        </Tile>

        <Tile
          span={4}
          name="«Por favor» is rare"
          rule="It softens genuine hardship. Everywhere else it is padding, and padding in an imperative reads as an apology for asking."
        >
          <Pair where="detail.tsx:5282" ok="«Míralo.»" no="«Please look at it.»" />
        </Tile>

        <Tile
          span={4}
          name="A label where a label does"
          rule="Nouns beat verbs at the top of an area. The heading names what is underneath it, and the paragraph below says how."
        >
          <Pair
            where="the admin meta.lead pattern · operations.tsx:52"
            ok="«Horario, días de reparto y las llamadas de Rocoto.»"
            no="a 16–19-word «X, Y and Z» sentence heading every area"
            strike={false}
          />
        </Tile>

        <Tile
          span={6}
          name="Present, active, second person"
          rule="Uber's standing rules, held as written. First person singular appears on consent alone, where the user is the one speaking."
        >
          <Rows
            w={116}
            items={[
              ['Present tense', '«Ya está guardado» — pro-drop carries the register Spanish has no contractions for'],
              ['Active voice', '«Las reglas se escriben en Stock»'],
              ['Second person', '«Míralo.» — tú, settled; see Mechanics'],
              ['First person', '«Acepto» — consent, and nowhere else'],
            ]}
          />
        </Tile>

        <Tile
          span={6}
          name="Dynamic content survives its extremes"
          rule="A 40-character customer name, a 3-digit count. Every slot declares its overflow once, app-wide — the register is the Overflow page."
        >
          <Stack>
            <div style={{
              width: 300,
              maxWidth: '100%',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: theme.sizing.scale400,
              flexWrap: 'nowrap',
            }}>
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, ...ELLIPSIS }}>
                Distribuciones Hortofrutícolas del Baix Llobregat
              </span>
              <Figure value={347} size="compact" decimals={0} unit="pedidos" />
            </div>
            <Where>1 line, end ellipsis · the full name opens on the sheet</Where>
          </Stack>
        </Tile>
      </Grid>
    </Section>
  );
}

/* ══ MECHANICS ════════════════════════════════════════════════════════════════════════════════ */

const MECHANICS: string[][] = [
  ['Sentence case', 'Native to Spanish; stricter — days, months and languages stay lowercase (lunes, agosto, español). Watch EN-first drafts leaking Title Case.'],
  ['Feature capitalization', 'albarán, tarifa, lote, pedido, género lowercase mid-sentence. Formally named things keep caps: Rocoto, Radar, «Oferta del día» (first word only).'],
  ['Use contractions', 'No lever — al/del are grammar. The job maps to pro-drop («Ya está guardado»), spoken syntax («¿Para quién?»), hacer not realizar, usar not utilizar, simple tenses.'],
  ['No contractions in legal', 'Formal register in the contract and the DPA — current practice in company/legal.'],
  ['Oxford comma', 'INVERTS. A comma before y/o is an error, except to break real ambiguity.'],
  ['Avoid !, ≤1 per screen', 'Rarer still: ¡…! opens too and doubles the weight. ¿…? is never dropped for style.'],
  ['Em dash, spaced', 'RAE raya: closed pair, body text only, sparingly. Banned in H1 and CTA — that is where it makes slogan cadence.'],
  ['En dash ranges', '«lun–mié» · «7:00–13:00» (24-hour; AM/PM never ships in Spain) · «5–7 pedidos».'],
  ['Slash = per', '«199 €/mes». The unit shares the number’s line, nowrap, checked at 320px.'],
  ['Apostrophe possessive', '«de» — «el nombre del cliente». Spanish has no possessive apostrophe.'],
  ['& when tight', 'Always «y». «+» stays banned.'],
  ['No colon after labels', '«Nombre» · «CIF» — never «Nombre:».'],
  ['Standalone strings unpunctuated', 'Toasts, chips, list items: labelled facts, no period. A string that needs a period is probably an orphan sentence, and it dies (§51.24).'],
  ['Semicolon', 'Two sentences.'],
  ['Ellipsis', 'In-process only, at the string’s end: «Enviando…». Never in buttons or headers.'],
  ['Multi-phrase headline punctuation', 'The mechanic survives; the multi-phrase headline itself is slogan cadence and fails first.'],
  ['Conversational headers', 'Action prompts and ghost text only: «¿Para quién?», the composer’s first act. Section headings stay noun labels.'],
  ['Emojis', 'Messaging rail only — WhatsApp, push, templates. One, terminal, after the punctuation. The message reads complete with it stripped, which is also what Meta review wants. 👌 is banned (Uber’s own ES-market list).'],
];

function Mechanics() {
  const [, theme] = useStyletron();
  return (
    <Section
      t="Mechanics"
      n="The Spanish register. Uber's mechanics adapt rather than travel across — several of them invert, and the house laws take the rest. The tiles carry the parts you have to see; the register underneath carries all of them."
    >
      <Grid>
        <Tile
          span={12}
          name="The second person — tú"
          rule="Settled by Peter, 2026-08-28: tú, app-wide. The trade talks tú on the phone and the app speaks like the phone. Drafts carry tú from here, and the neutral form is no longer the safe default."
        >
          <div style={{ display: 'flex', gap: theme.sizing.scale800, alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' }}>
            <div style={{
              ...theme.typography.LabelXSmall,
              background: theme.colors.contentPrimary,
              color: theme.colors.contentInversePrimary,
              padding: `${theme.sizing.scale200} ${theme.sizing.scale550}`,
              borderRadius: theme.borders.radius100,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}>
              Settled · Peter · 2026-08-28
            </div>
            <div style={{ minWidth: 240, flex: 1 }}>
              <Head>Shipped, and now canon</Head>
              <Stack gap={theme.sizing.scale300}>
                <S>«Prueba Rocoto con tu género»</S>
                <S>«tu cuenta» · «tus precios» · «tu género»</S>
              </Stack>
            </div>
            <div style={{ minWidth: 240, flex: 1 }}>
              <Head>What it settles</Head>
              <Stack gap={theme.sizing.scale300}>
                <S dim>
                  Spanish forces the second-person fork that English «you» hid. The app speaks like a colleague,
                  and a colleague says tú.
                </S>
                <S dim>
                  Legal surfaces keep usted — the contract, the DPA, the formal register in company/legal. The
                  boundary is the document, and the agent's own «Tú or usted» dial is a different fact: that one
                  is how Rocoto addresses a CUSTOMER, set per house.
                </S>
              </Stack>
            </div>
          </div>
        </Tile>

        <Tile
          span={4}
          name="The price unit shares the number's line"
          rule="A rate unit on a line of its own quotes a one-off for something that recurs. nowrap, always, and checked at 320px rather than on a laptop."
        >
          <Stack>
            <Figure value={199} unit="€/mes" size="display" decimals={0} />
            <div style={{
              width: 320,
              maxWidth: '100%',
              border: `1px dashed ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius200,
              padding: theme.sizing.scale400,
            }}>
              <Figure value={1998} unit="€/mes" size="default" decimals={0} />
              <div style={{ marginTop: theme.sizing.scale200 }}>
                <Where>320px · the unit still shares the line</Where>
              </div>
            </div>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Ranges take the en dash"
          rule="No spaces around it. Spain reads 24-hour, so AM/PM never ships; a range written with a hyphen reads as a compound instead of a span."
        >
          <Rows
            w={112}
            items={[
              ['«lun–mié»', 'days'],
              ['«7:00–13:00»', 'hours, 24-hour'],
              ['«5–7 pedidos»', 'counts'],
            ]}
          />
        </Tile>

        <Tile
          span={4}
          name="Sentence case, stricter"
          rule="Spanish orthography is sentence case; Title Case does not exist in it. Days, months and languages stay lowercase, and an English-first draft is where Title Case leaks in."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.sizing.scale600 }}>
            <div>
              <Head>Do</Head>
              <Stack gap={theme.sizing.scale300}>
                <S>«Oferta del día»</S>
                <S>«lunes» · «agosto» · «español»</S>
              </Stack>
            </div>
            <div style={{ borderLeft: `1px solid ${theme.colors.borderTransparent}`, paddingLeft: theme.sizing.scale600 }}>
              <Head>Don't</Head>
              <Stack gap={theme.sizing.scale300}>
                <S dim struck>«Oferta del Día»</S>
                <S dim struck>«Lunes» · «Agosto»</S>
              </Stack>
            </div>
          </div>
        </Tile>

        <Tile
          span={4}
          name="Labels take no colon"
          rule="The label and the value are already two things; a colon states a separation the layout has made. This is Uber's rule landing on Spanish forms unchanged."
        >
          <Stack gap={theme.sizing.scale400}>
            {([['Nombre', 'Can Solé'], ['CIF', 'B-6xxxxxxx'], ['Dirección de reparto', 'Barcelona · litoral']] as const).map(([k, v]) => (
              <div key={k}>
                <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>{k}</div>
                <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary }}>{v}</div>
              </div>
            ))}
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Terminal punctuation"
          rule="A toast, a chip and a list item are labelled facts, so they carry no period. The ellipsis marks a process at the string's end and appears nowhere else."
        >
          <Rows
            w={112}
            items={[
              ['«Guardado»', 'toast — a labelled fact, no period'],
              ['«Enviando…»', 'in process, at the string’s end'],
              ['«Tus datos»', 'heading — no period, ever'],
            ]}
          />
        </Tile>

        <Tile
          span={4}
          name="The raya"
          rule="RAE, not Uber: a closed pair hugging the aside, with no surrounding spaces. Body text only, sparingly, and banned in H1 and CTA because that is where it builds slogan cadence."
        >
          <Stack>
            <S>
              Un inciso va entre rayas
              {' '}
              <span style={{ color: theme.colors.contentPrimary, ...theme.typography.MonoLabelSmall }}>—así—</span>
              {' '}
              y la frase sigue.
            </S>
            <div>
              <Head>Banned in</Head>
              <S dim>H1 · CTA · any «imperative — benefit clause» construction</S>
            </div>
          </Stack>
        </Tile>

        <Tile
          span={6}
          name="The comma before «y» is an error"
          rule="The Oxford comma inverts on the way into Spanish. A comma before y/o survives only where it breaks a real ambiguity, and then the sentence is usually the thing to fix."
        >
          <Pair ok="«albarán, factura y lote»" no="«albarán, factura, y lote»" />
        </Tile>

        <Tile
          span={6}
          name="Emojis live on the messaging rail"
          rule="One per message, at the end, after the punctuation, and the message reads complete with it stripped — which is also the Meta-review-safe form. The app is core product content and carries none."
        >
          <Stack>
            <Rows
              w={112}
              items={[
                ['Allowed', 'WhatsApp · push · templates. One, terminal, after the punctuation.'],
                ['The app', 'River, sheets, kit, empty states, errors — zero.'],
              ]}
            />
            <div style={{ borderTop: `1px solid ${theme.colors.borderTransparent}`, paddingTop: theme.sizing.scale400 }}>
              <Head>Banned outright</Head>
              <S dim>
                <span style={{ textDecoration: 'line-through' }}>👌</span>
                {' — a racist symbol in some Spanish-speaking markets, on Uber’s own list. 👍 carries the same job.'}
              </S>
            </div>
          </Stack>
        </Tile>
      </Grid>

      <Register
        t="The Spanish register"
        n="Eighteen rules, adapted rather than copied: Uber's mechanic on the left, what it becomes in Spanish on the right. Where a row says INVERTS, the Spanish rule is the opposite of the English one."
        columns={['Uber rule', 'Rocoto (es)']}
        data={MECHANICS}
      />
    </Section>
  );
}

/* ══ OVERFLOW ═════════════════════════════════════════════════════════════════════════════════ */

const OVERFLOW_REGISTER: string[][] = [
  ['River row reason line', '2-line clamp, ellipsis — the RiverRow ceiling, built'],
  ['Row facts line', '1 line, end ellipsis'],
  ['Figure + unit', 'nowrap, always — the price law'],
  ['Chips', 'Never wrap internally; the chip row wraps or scrolls, declared per surface'],
  ['Names in rows', '1 line, end ellipsis; the full name opens on the sheet'],
  ['Section headings', 'Wrap, no clamp — a heading long enough to clamp is rewritten'],
  ['Toasts / snackbars', '1 line, end ellipsis'],
  ["The customer's words (threads, asked)", 'Wrap free — content, never chrome'],
  ['Row sub line (rows.tsx Row.sub)', '2-line clamp, end ellipsis — declared 2026-08-28 by the copy sweep. DECLARED, NOT YET BUILT: Row still renders sub as a free-wrapping span, so a long or dynamic sub makes one row taller than its neighbours. The admin subs were levelled in the copy; the clamp belongs to whoever owns rows.tsx.'],
  ['Section lead (rows.tsx Section.lead)', 'Wrap, no clamp — and the slot of last resort. A section narrating its own rows deletes the lead rather than shortening it (§4).'],
  ['Method footnote (data.tsx Method)', 'Wrap, no clamp, 68ch measure. A footnote under a block, never inside a row, so it cannot jag a neighbour. Never optional (§63).'],
  ['Sibling subs in one List', 'Written to ONE measure. Three rows whose subs run 8 / 10 / 14 words are three heights before a single character of dynamic content arrives. Level them in the copy, not in CSS.'],
];

/** ORDINARY vs EXTREME, on the same three rows. The row height is the assertion: it is set by
 *  the declared clamp, not by whatever content happens to arrive, so nothing below ever moves. */
const CONTENT = {
  ordinary: [
    { name: 'Can Solé', reason: 'Pidió el martes.', value: 96.2 },
    { name: 'Hotel Rec', reason: 'Entra por el ERP.', value: 184.6 },
    { name: 'Bar Manolo', reason: 'Cambió la hora.', value: 7.85 },
  ],
  extreme: [
    {
      name: 'Distribuciones Hortofrutícolas del Baix Llobregat',
      reason: 'Los albaranes de proveedor entran en Stock con el archivo adjunto, y los tuyos llegan a los clientes a la hora que pidieron cuando el reparto sale completo.',
      value: 23904.5,
    },
    { name: 'Restaurant Nou', reason: 'Cambió la hora del reparto y pidió media caja más de género para el turno de la noche.', value: 1412.05 },
    { name: 'Gamba roja de Palamós — pedido del sábado', reason: 'Entra por el ERP.', value: 7.85 },
  ],
};

function OverflowRows() {
  const [, theme] = useStyletron();
  const [mode, setMode] = React.useState<'ordinary' | 'extreme'>('ordinary');
  const rows = CONTENT[mode];
  return (
    <Stack gap={theme.sizing.scale600}>
      <SegmentedControl activeKey={mode} onChange={({ activeKey }) => setMode(activeKey as 'ordinary' | 'extreme')}>
        <Segment key="ordinary" label="Ordinary content" />
        <Segment key="extreme" label="The extremes" />
      </SegmentedControl>
      {/* the rows run at a river-pane width, because a law about overflow proved on a 1300px band
          is a law nobody proved: the extremes have to actually reach the edge */}
      <div style={{
        width: 380,
        maxWidth: '100%',
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        overflow: 'hidden',
        background: theme.colors.backgroundPrimary,
      }}>
        {rows.map((r, i) => (
          <div
            key={i}
            data-testid="overflow-row"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: theme.sizing.scale700,
              padding: theme.sizing.scale600,
              borderTop: i ? `1px solid ${theme.colors.borderTransparent}` : 'none',
              minWidth: 0,
            }}
          >
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, ...ELLIPSIS }}>{r.name}</div>
              <p style={{
                margin: `${theme.sizing.scale200} 0 0`,
                ...theme.typography.ParagraphSmall,
                color: theme.colors.contentSecondary,
                ...clamp(2),
                minHeight: `calc(${theme.typography.ParagraphSmall.lineHeight} * 2)`,
              }}>
                {r.reason}
              </p>
            </div>
            <div style={{ flex: 'none' }}>
              <Figure value={r.value} unit="€" size="compact" />
            </div>
          </div>
        ))}
      </div>
    </Stack>
  );
}

function Overflow() {
  const [, theme] = useStyletron();
  return (
    <Section
      t="Overflow"
      n="Every text slot declares its overflow once, app-wide: the clamp, the ellipsis, the wrap. Rows keep their height, so a long name never moves its neighbour. A slot not yet in the register gets declared the session it is touched — random jag is a defect."
    >
      <Grid>
        <Tile
          span={6}
          name="Rows keep their height"
          rule="The same three rows under ordinary content and under the extremes: a 48-character name, a reason that runs past two lines, a five-figure amount. The name ellipsizes, the reason clamps, the figure holds its unit — and the row is the same height either way, so nothing below it moves."
        >
          <OverflowRows />
        </Tile>

        <Tile
          span={6}
          name="Declaring a new slot"
          rule="A slot reaches the register the session it is touched, and the declaration is one line: the clamp, the ellipsis, the wrap. Random jag traces back to a slot that skipped this."
        >
          <Stack gap={theme.sizing.scale600}>
            <Rows
              w={132}
              items={[
                ['Declared', 'The clamp, the ellipsis, the wrap — one line in the register'],
                ['Reserved', 'The clamped slot holds its lines whether it fills them or not'],
                ['Checked', 'At 320px, with the extremes, not with the demo content'],
              ]}
            />
            <div style={{
              borderTop: `1px solid ${theme.colors.borderTransparent}`,
              paddingTop: theme.sizing.scale550,
              width: '100%',
            }}>
              <Head>A declaration, worked</Head>
              <Rows
                w={132}
                items={[
                  ['The slot', 'The comercial’s name on a river row'],
                  ['Its behaviour', '1 line, end ellipsis'],
                  ['Its reason', 'It sits in a row, and rows keep their height'],
                ]}
              />
            </div>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="River row reason line"
          rule="2-line clamp with an ellipsis — the RiverRow ceiling, already built. Two lines is the ceiling because the third is where a reason turns into an explanation, and explanations die (§51.24)."
        >
          <Stack>
            <p style={{
              margin: 0,
              ...theme.typography.ParagraphSmall,
              color: theme.colors.contentSecondary,
              ...clamp(2),
            }}>
              Los albaranes de proveedor entran en Stock con el archivo adjunto, y los tuyos llegan a los clientes a la hora que pidieron cuando el reparto sale completo.
            </p>
            <Where>2 lines, then the ellipsis</Where>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Names in rows"
          rule="One line with an end ellipsis. The full name is one tap away on the sheet, so the row never trades its height for a name."
        >
          <Stack>
            <div style={{ width: 240, maxWidth: '100%' }}>
              <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary, ...ELLIPSIS }}>
                Distribuciones Hortofrutícolas del Baix Llobregat
              </div>
              <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, ...ELLIPSIS }}>
                Mercabarna · pavelló del peix · reparto de la mañana
              </div>
            </div>
            <Where>1 line each · name and facts</Where>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="The figure and its unit"
          rule="nowrap, always — the same law the price rule states. A unit that shares the line at 1440px and wraps at 360px is the same mis-sale on the device most people read on."
        >
          <Stack>
            <div style={{
              width: 320,
              maxWidth: '100%',
              border: `1px dashed ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius200,
              padding: theme.sizing.scale400,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: theme.sizing.scale400,
              flexWrap: 'nowrap',
            }}>
              <span style={{ ...theme.typography.LabelSmall, ...ELLIPSIS }}>Pedidos incluidos</span>
              <Figure value={23904.5} unit="€/mes" size="compact" />
            </div>
            <Where>320px · nowrap holds</Where>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Chips"
          rule="A chip never wraps inside itself — a two-line chip stops reading as one token. The ROW is what wraps or scrolls, and which of the two is declared per surface."
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
            {['fruta y verdura', 'lote 24-A', 'lun–mié', 'tarifa 2', 'Mercabarna'].map((c) => (
              <Tag key={c} closeable={false} size={TAG_SIZE.small} kind="neutral">
                <span style={{ whiteSpace: 'nowrap' }}>{c}</span>
              </Tag>
            ))}
          </div>
        </Tile>

        <Tile
          span={4}
          name="Section headings"
          rule="Wrap, no clamp. A heading long enough to need a clamp is a heading that failed the self-comprehension test, and the fix is to rewrite it as a noun label."
        >
          <Stack>
            <h5 style={{ margin: 0, ...theme.typography.HeadingXSmall, color: theme.colors.contentPrimary }}>
              Horario, días de reparto y las llamadas de Rocoto
            </h5>
            <Where>wraps freely · never clamped</Where>
          </Stack>
        </Tile>

        <Tile
          span={4}
          name="Toasts and snackbars"
          rule="One line with an end ellipsis. A toast that grows to two lines has become a message, and a message belongs on a surface that stays."
        >
          <Stack>
            <div style={{
              background: theme.colors.backgroundInversePrimary,
              color: theme.colors.contentInversePrimary,
              padding: `${theme.sizing.scale400} ${theme.sizing.scale600}`,
              borderRadius: theme.borders.radius200,
              maxWidth: 280,
              ...theme.typography.LabelSmall,
              ...ELLIPSIS,
            }}>
              Guardado en Distribuciones Hortofrutícolas del Baix Llobregat
            </div>
            <Where>1 line, end ellipsis</Where>
          </Stack>
        </Tile>

        <Tile
          span={12}
          name="The customer's words"
          rule="Threads and anything the customer asked wrap free and clamp at nothing. This is content, never chrome: truncating what somebody said is the one truncation that loses a fact."
        >
          <div style={{
            background: theme.colors.backgroundSecondary,
            borderRadius: theme.borders.radius300,
            padding: theme.sizing.scale600,
            maxWidth: 560,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentPrimary,
          }}>
            Buenos días, para mañana ponme dos cajas de gamba roja y una de merluza, y si te queda pulpo del bueno
            añade medio kilo. Lo recojo yo a las siete, que el chico libra.
          </div>
        </Tile>
      </Grid>

      <Register
        t="The register"
        n="Twelve slots, declared app-wide (§77.2). Everything the app renders as text lands in one of these rows or gets a row of its own. A row that says DECLARED, NOT YET BUILT is a promise the code has still to keep."
        columns={['Slot', 'Declared behaviour']}
        data={OVERFLOW_REGISTER}
      />
    </Section>
  );
}

/* ══ LENSES ═══════════════════════════════════════════════════════════════════════════════════ */

const LENSES: Array<{ name: string; asks: string; words: string[]; rule: string }> = [
  {
    name: 'Task',
    asks: 'Does the string do a job? A string with no job dies.',
    words: ['Actionable', 'Relevant', 'Complete', 'Helpful'],
    rule: 'Performance. The first lens kills more strings than the other three together, because most surplus copy fails here before anyone argues about its wording.',
  },
  {
    name: 'Voice',
    asks: 'Would you say it on the phone?',
    words: ['Simple', 'Clear', 'Empathetic', 'Conversational'],
    rule: 'Expressiveness. Read it aloud: if it wants to be on a billboard, rewrite it as the sentence you would say to somebody who called.',
  },
  {
    name: 'Substance',
    asks: 'Is it accurate, and the same string everywhere it appears? One string, one home.',
    words: ['Organized', 'Consistent', 'Accurate', 'Differentiated'],
    rule: 'Essence in context. Two copies of one sentence in two files is one sentence and one bug — the sweep found the same string at data.tsx:440 and knows-web.tsx:661.',
  },
  {
    name: 'Presentation',
    asks: 'Is the most important message the most noticeable?',
    words: ['Scannable', 'Targeted', 'Equitable', 'Localizable'],
    rule: 'Transmission. Placement, size and style are part of the copy: a load-bearing line in a small coloured kicker has been cut, whatever the words say.',
  },
];

/** THE BALANCE GATE, drawn against one axis. Two measured bands and the third that marks the
 *  wall — the numbers are the 2026-08-28 sweep's, and the ranges are ranges because that is
 *  what the sweep measured. */
function BalanceGate() {
  const [, theme] = useStyletron();
  /** the label sits ABOVE its band, left-aligned to the track: a label hung off the band's right
   *  end is a label that gets clipped the moment the band reaches far enough to matter. */
  const band = (from: number, to: number, label: string, wall: boolean) => (
    <div>
      <div style={{ ...theme.typography.LabelXSmall, color: wall ? theme.colors.contentTertiary : theme.colors.contentPrimary, marginBottom: theme.sizing.scale200 }}>
        {label}
      </div>
      <div style={{ position: 'relative', height: 18 }}>
        <div style={{
          position: 'absolute',
          left: `${from}%`,
          width: `${to - from}%`,
          top: 0,
          height: 18,
          borderRadius: theme.borders.radius100,
          background: wall ? theme.colors.backgroundTertiary : theme.colors.contentPrimary,
          border: wall ? `1px dashed ${theme.colors.borderOpaque}` : 'none',
        }} />
      </div>
    </div>
  );
  return (
    <Stack gap={theme.sizing.scale400}>
      <div style={{ position: 'relative', width: '100%' }}>
        {/* the third — where a surface starts reading as a wall */}
        <div style={{
          position: 'absolute',
          left: '33%',
          top: 0,
          bottom: 22,
          borderLeft: `1px dashed ${theme.colors.borderOpaque}`,
        }} />
        <Stack gap={theme.sizing.scale550}>
          {band(9, 20, 'the river · 9–20% body', false)}
          {band(46, 80, 'the admin wing, before the sweep · 46–80%', true)}
        </Stack>
        <div style={{ position: 'relative', height: 22, borderTop: `1px solid ${theme.colors.borderOpaque}`, marginTop: theme.sizing.scale400 }}>
          {([[0, '0%'], [33, 'a third — the wall starts'], [100, '100%']] as Array<[number, string]>).map(([at, label]) => (
            <span key={at} style={{
              position: 'absolute',
              left: `${at}%`,
              top: theme.sizing.scale200,
              transform: at === 100 ? 'translateX(-100%)' : at === 0 ? 'none' : 'translateX(-50%)',
              whiteSpace: 'nowrap',
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentTertiary,
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <Where>share of a surface's strings that are body sentences · measured 2026-08-28</Where>
    </Stack>
  );
}

function Lenses() {
  const [, theme] = useStyletron();
  return (
    <Section
      t="Lenses"
      n="Four heuristics lenses, Uber's, adopted whole. Each asks one question and carries four words to check the string against. Run every surface through all four before it ships."
    >
      <Grid>
        {LENSES.map((l) => (
          <Tile key={l.name} span={3} name={l.name} rule={l.rule}>
            <Stack>
              <S>{l.asks}</S>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
                {l.words.map((w) => (
                  <Tag key={w} closeable={false} size={TAG_SIZE.small} kind="neutral">
                    <span style={{ whiteSpace: 'nowrap' }}>{w}</span>
                  </Tag>
                ))}
              </div>
            </Stack>
          </Tile>
        ))}

        <Tile
          span={8}
          name="The balance gate"
          rule="A surface reads as a wall when body sentences pass about a third of its strings. The river surfaces run 9–20% body and read clean; the admin wing ran 46–80% and knows-web stacked 45-, 36- and 33-word paragraphs on one screen."
        >
          <BalanceGate />
        </Tile>

        <Tile
          span={4}
          name="The wall is a machine"
          rule="The fix is structural: kill the slot. Shorter prose in the same four slots rebuilds the wall next session, one sentence smaller."
        >
          <Stack gap={theme.sizing.scale300}>
            {['Section lead', 'Row sub', 'Tile lead', 'Method footnote'].map((slot) => (
              <div key={slot} style={{
                padding: `${theme.sizing.scale300} ${theme.sizing.scale550}`,
                border: `1px solid ${theme.colors.borderOpaque}`,
                borderRadius: theme.borders.radius200,
                ...theme.typography.LabelSmall,
                color: theme.colors.contentPrimary,
              }}>
                {slot}
              </div>
            ))}
            <Where>× the rows on screen = ten prose units</Where>
          </Stack>
        </Tile>
      </Grid>
    </Section>
  );
}

export default function WritingSection() {
  return (
    <>
      <VoiceAndTone />
      <WritingForUsers />
      <Mechanics />
      <Overflow />
      <Lenses />
    </>
  );
}
