import { canonicalSyntheticAmount, syntheticAmountForCountry, workspaceCurrency } from '../currency';
import { workspaceCapabilitiesNow } from '../workspace-capabilities';
import { solesRate } from '../currency';
/* THE CHAT EMBEDS — work standing in the talk (THE-DENSE-BRIEF-DESIGN musing 5).
 *
 * ═══ THE TEXTURE LAW'S MISSING HALF (FEED-IA §11, §17.3) ════════════════════════════════════
 * The dots mean exactly one thing: A CONVERSATION. §17.3 shipped the first half of the symmetry —
 * TALK STANDING IN WORK, a dotted patch with a faint accent ring inside the albarán. This file is
 * the other half: WORK STANDING IN TALK, a plain-paper card with a hairline mono border, sitting ON
 * the dots. Texture alone sorts every pixel in the app into talk or work, and there is no third
 * texture anywhere.
 *
 * ═══ FOUR LAWS THIS FILE KEEPS ══════════════════════════════════════════════════════════════
 *
 * 1 · AN EMBED IS A DOOR, NEVER AN EDITOR (FEED-IA §25.2). «The band item IS the feed item —
 *     tapping it taps the thing in the river.» Every card here opens its sale; none of them grows
 *     an edit affordance. Editing is immersion on the document (§31.3), one tap away.
 *     THE ONE EXCEPTION IS NAMED AND BOUNDED: the reasoning embed supplies the FACT Rocoto lacked
 *     — a price, a can-you-get-it, the amount a message never carried — because that is what puts
 *     Rocoto back in a position to answer, and it is easier to give here than in a sentence
 *     somebody has to write. A person's own YES on an unusual or over-ceiling order is a
 *     JUDGEMENT rather than a fact: it stays on the document, where the whole order is in front of
 *     them, and the embed hands over through its door.
 *
 * 2 · AN EMBED IS A SNAPSHOT OF AN ACT; THE DOCUMENT IS THE LIVE TRUTH. A readback sent at 07:12
 *     said what was true at 07:12, and a message once said is said. When the order changes
 *     afterwards the embed does not rewrite itself — the change lives on the sale, reached through
 *     the embed's door.
 *
 * 3 · NOTHING EMBEDS THAT COULD NOT BE SAID AS A SENTENCE. What travels on the wire is text and a
 *     PDF; an embed is this app's rendering of a verbal act already performed. Immersive
 *     transparency: the message IS the result.
 *
 * 4 · SAFFRON MARKS ROCOTO'S OWN ACTS AND NOTHING ELSE. The readback's mark, the filled-differently
 *     note, the sentence Rocoto is offering to send. The customer's words and the person's own
 *     replies are ink everywhere in the thread.
 *
 * ═══ THE REASONING EMBED IS THE FLAG'S FOURTH REGISTER ══════════════════════════════════════
 * `sale.ts` already computes the exceptions and already says them three ways — `flagText` on the
 * line, `confirmWords` on the card, `stickyWords` in the band. This is the FOURTH: the same flag
 * rendered where the customer's message sits, with their own words as the evidence, the unresolved
 * span marked, and the one checkable fact stated in the trade's numbers. No second reasoning store,
 * no confidence score, and the word «review» never describes itself.
 *
 * ═══ WHERE THE PRIMITIVES COME FROM ═════════════════════════════════════════════════════════
 * The lines inside an embed are the DOCUMENT'S own lines — `LineName` (produce mark, the customer's
 * word, the amendment chip) and `Figure` (subordinate decimals, the unit on the number's line) —
 * imported from `detail.tsx` rather than redrawn, so zero glyphs exist only in chat. `detail.tsx`
 * reaches `./shell` for `focusThread`, so importing it back here closes a module cycle: every
 * export crossing it is a HOISTED FUNCTION DECLARATION used at render time and never at module
 * evaluation, which is what makes the cycle inert. The clean collapse is named in the report — the
 * document primitives want a home neither file owns.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Figure, format as formatFigure } from '../../../rocoto/figure';
import { dots, DOT_TILE } from '../../../rocoto-theme';
import type { Cast } from '../../../scenarios/data/cast';
import { FlagMark, LineName, Produce } from '../detail';
import { Glyph } from '../glyphs';
import { nowOf } from '../day';
import { openItem } from './open-items';
import { openOrder } from '../anchors';
import {
  amountWords,
  answerSale,
  answerWords,
  askedWords,
  editLine,
  fillWords,
  flagsOf,
  /* §15.1 KILLED THE WALL: `isClosed` answered «has it ever printed, unchanged» and the NAME was
     teaching it. What this card wants is the LIVE READING — a reading, never a state, free to go
     backwards the moment the crate moves — and it is computed once in `sale.ts` so every surface
     that draws it draws the same word. */
  liveReadingOf,
  openNonSku,
  priceAnswer,
  qtyWords,
  saleReplyHour,
  stickyWords,
  supplyAnswer,
  todayId,
  type Flag,
  type Sale,
  type SaleLine,
} from '../sale';

/* ── THE CATALOGUE ────────────────────────────────────────────────────────────────────────────
 * Four kinds today, one shell. Each folds from the sale's own ledger — the reading, the document,
 * the answer that went out, the flag that stopped one — and carries the sale it is about, because
 * an embed's whole job is to be a door onto it.
 */
export type Embed =
  /** what Rocoto read the message as: the day, the lines, its own small mark */
  | { kind: 'readback'; sale: Sale }
  /** the document: number, figure, day, and whether it still stands open */
  | { kind: 'albaran'; sale: Sale }
  /** the sheet's number, said plainly, stamped with the hour it was set */
  | { kind: 'price'; sale: Sale; line: SaleLine }
  /** why this one is waiting: their words, what Rocoto did, what it still needs */
  | { kind: 'reasoning'; sale: Sale; flag?: Flag; missing?: SaleLine };

/** The one line a thread preview or a «Messages · N» chunk draws instead of the card (§12: at 300
 *  orders a day an embed must also exist as ONE LINE, or the list drowns). */
export function embedLine(embed: Embed): string {
  const { sale } = embed;
  if (embed.kind === 'albaran') return `Delivery Note ${sale.number} · ${sale.lines.length} ${sale.lines.length === 1 ? 'line' : 'lines'}`;
  if (embed.kind === 'price') return `${embed.line.product.name} · ${solesRate(embed.line.price, embed.line.unit)}`;
  if (embed.kind === 'readback') return `Read as ${sale.lines.length} ${sale.lines.length === 1 ? 'line' : 'lines'} · ${sale.deliveryDay}`;
  return embed.flag ? stickyWords(sale, embed.flag) : (sale.needsReply?.about ?? 'Waiting on you');
}

/* ── THE FOLD ─────────────────────────────────────────────────────────────────────────────────
 * Embeds come out of the events that are already there. `ThreadRow` gains nothing in `sale.ts`:
 * the fold hangs an embed on the row whose ACT it renders, keyed by that row's own id, and the one
 * embed with no row of its own — the document — arrives as a turn of its own at the hour it was
 * made. Which is exactly what it is: a thing that happened in the conversation at an hour.
 */
/* ── THE TOOL CALL, AS A FACT ON THE ROW THAT CAUSED IT (FEED-IA §77.5b) ──────────────────────
 * «Show tool calls, so we know when a message caused the order to update, for transparency. Part
 * of the transparent data contract we should have.»
 *
 * IT IS DERIVED, LIKE EVERYTHING ELSE IN THIS FOLD. Nothing new is stored: the ledger already
 * knows which message Rocoto read (the reading row sits directly after it) and which message
 * changed the order afterwards (`sale.changed` carries the hour, and the day builds that sentence
 * into a received row of its own). Those are the two messages that move an order in this build,
 * and each one gets the line for what it did.
 *
 * WHAT IT DOES NOT CLAIM. An amount a person typed into the reasoning embed also moves the order,
 * and it gets NO act line — because no message caused it. A line hung on the nearest message would
 * be the app inventing a cause, which is the opposite of a transparent data contract.
 */
export type OrderAct = {
  /** what the tool did, in the app's own words — «Opened the order for Friday 22.08» */
  did: string;
  /** where the order stands after it — «4 lines · 214,60 €». The figure never yields its width. */
  now: string;
  /** the order it moved, so the line belongs to an object and not to a sentence */
  sale: Sale;
};

/** The compact state of an order: its line count only. */
const standsAt = (sale: Sale): string =>
  `${sale.lines.length} ${sale.lines.length === 1 ? 'line' : 'lines'}`;

export type Fold = {
  /** ThreadRow.id → the embed that row's act renders as */
  onRow: Record<string, Embed>;
  /** ThreadRow.id → what that message did to the order (§77.5b) */
  acts: Record<string, OrderAct>;
  /** embeds that ARE their own turn, with the hour they happened at */
  turns: Array<{ id: string; at?: string; embed: Embed }>;
};

/** Every embed one sale contributes to its customer's conversation. */
export function embedsOf(sale: Sale): Fold {
  const onRow: Record<string, Embed> = {};
  const acts: Record<string, OrderAct> = {};
  const turns: Fold['turns'] = [];

  /* THE READBACK RIDES THE READING (§1 of THE-INTELLIGENCE). The row that says «Read from WhatsApp
     as 4 lines for Friday» IS Rocoto's confirmation of what it read; the embed draws the lines it
     read, so the sentence and the card are one act seen at two grains. */
  const reading = sale.thread.find((r) => r.author === 'ai' && r.text === sale.reading);
  if (reading) onRow[reading.id] = { kind: 'readback', sale };

  /* ── THE MESSAGE THAT OPENED THE ORDER (§77.5b) ────────────────────────────────────────────
     The reading sits directly after the words it read, so the message that caused it is the last
     received row BEFORE it. That row gets the act: what the tool did, and where the order stands
     afterwards. It is not the readback said twice — the readback is a SENTENCE that went out to
     the customer on WhatsApp, and this is a reading that never leaves the app. */
  if (reading) {
    const at = sale.thread.indexOf(reading);
    const caused = [...sale.thread.slice(0, at)].reverse().find((r) => r.author === 'received');
    if (caused) {
      acts[caused.id] = { did: `Opened the order for ${sale.deliveryDay}`, now: standsAt(sale), sale };
    }
  }

  /* ── AND THE MESSAGE THAT MOVED IT AFTERWARDS ──────────────────────────────────────────────
     `sale.changed` is the customer changing their mind after the order was recorded, and the day
     builds their sentence into a received row stamped with that same hour. So the act rides that
     row, and it names the LINE that moved rather than merely saying «updated» — «showing what
     changed» is the whole of what §77.5b asks for.
     THE NAMES COME OFF THE SALE'S OWN LINES. `changed` carries product ids; the lines carry the
     resolved products, so the words on this line are the words the document uses. */
  if (sale.changed) {
    const c = sale.changed;
    const raised = sale.lines.find((l) => l.product.id === c.raised.product);
    const dropped = sale.lines.find((l) => l.product.id === c.dropped.product);
    const moved = sale.thread.find((r) => r.author === 'received' && r.time === c.at);
    if (moved && raised) {
      const took = dropped ? ` · took ${dropped.product.name} off` : '';
      acts[moved.id] = {
        did: `Raised ${raised.product.name} to ${qtyWords(c.raised.qty + c.more, c.raised.unit)}${took}`,
        now: standsAt(sale),
        sale,
      };
    }
  }

  /* THE PRICE ANSWER RIDES THE SENTENCE THAT CARRIED IT. Rocoto answers a price question off the
     sheet where the house granted it (§11), and a person can answer one from the reasoning embed
     below — both land as the same sentence, so both render as the same card. */
  const priced = sale.lines.find((l) => sale.thread.some((r) => r.author === 'ai' && r.text === priceAnswer(l, l.price)));
  if (priced) {
    const row = sale.thread.find((r) => r.author === 'ai' && r.text === priceAnswer(priced, priced.price));
    if (row) onRow[row.id] = { kind: 'price', sale, line: priced };
  }

  /* THE DOCUMENT IS ITS OWN TURN, at the hour it was made or sent. It exists from `made` onwards —
     before that there is no albarán to embed, only an order being judged. */
  const made = sale.stamps.send ?? sale.stamps.make;
  if (made) turns.push({ id: `${sale.id}-albaran`, at: made, embed: { kind: 'albaran', sale } });

  /* THE REASONING IS THE LAST WORD WHILE IT STANDS. It is not a snapshot — it is the work itself,
     standing in the talk where the customer's message sits, and it leaves when the answer goes. */
  const flag = flagsOf(sale)[0];
  const missing = openNonSku(sale)[0];
  const answered = Boolean(sale.stamps.answer || sale.stamps.reply);
  if (!answered && (sale.needsReply || flag || missing)) {
    const asked = [...sale.thread].reverse().find((r) => r.author === 'received');
    turns.push({
      id: `${sale.id}-reasoning`,
      at: asked?.time ?? sale.at,
      embed: { kind: 'reasoning', sale, flag, missing },
    });
  }

  return { onRow, acts, turns };
}

/* ── THE SHELL ────────────────────────────────────────────────────────────────────────────────
 * `ChatCard` is the exact counterpart of `detail.tsx`'s `ChatPaper`: where that one is dotted paper
 * with a faint accent ring, this one is PLAIN PAPER with a mono hairline. Every embed is this shell
 * with a different body; no embed rolls its own frame.
 *
 * IT BREATHES (FEED-IA §33, §40.3). An embed jammed against the bubbles above and below it reads
 * as clutter — so the card takes a register's worth of air off the turns around it, and a block's
 * worth inside, on Base's own steps. The width is held short of the thread's full measure for the
 * same reason a document is not a wall: a card the reader's eye can take in at once.
 *
 * AND IT SHARES THE BUBBLE COLUMN'S LEFT EDGE. A conversation's turns stand 8px in from the
 * scrollport (the Message row's own padding); a card that ignored that ran wider than every bubble
 * above it and butted into the pane's gutter. The same 8 puts the card and the talk on one edge,
 * so the eye reads a column rather than two systems sharing a strip of paper. The corner matches
 * the bubbles' (`radius400`) for the same reason.
 *
 * STATE IS STRUCTURAL, NEVER CHROMATIC. An owed embed — an unanswered reasoning — stands raised
 * like a standing card. A settled one lies flat with its hour stamped where the verb was.
 */
export function ChatCard({
  label,
  meta,
  owed = false,
  testid,
  kind,
  onOpen,
  openLabel,
  children,
  dock,
}: {
  /** the header is a LABEL that names the thing — «Albarán 1418», «Today's price» */
  label: React.ReactNode;
  /** the hour, or the record word, riding the header's end */
  meta?: React.ReactNode;
  owed?: boolean;
  testid?: string;
  kind: Embed['kind'];
  /** the door. Every embed has one, and it is the whole card. */
  onOpen?: () => void;
  openLabel?: string;
  children: React.ReactNode;
  dock?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  return (
    <div
      data-testid={testid ?? 'chat-embed'}
      data-embed={kind}
      data-owed={owed ? 'yes' : 'no'}
      data-list-card="inset"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale600,
        margin: `${theme.sizing.scale800} ${theme.sizing.scale300}`,
        padding: theme.sizing.scale600,
        borderRadius: theme.borders.radius400,
        border: `1px solid ${theme.colors.mono300}`,
        background: theme.colors.backgroundPrimary,
        boxShadow: owed ? theme.lighting.shadow400 : undefined,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelSmall, flex: 1, minWidth: 0 }}>{label}</span>
        {meta && (
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto', whiteSpace: 'nowrap' }}>
            {meta}
          </span>
        )}
      </div>

      {children}

      {/* THE DOOR IS A ROW OF ITS OWN, and it is the same row on every kind: one quiet control that
          says where it goes. A whole-card button would swallow the price field the reasoning embed
          holds, and a card that is a button cannot contain one. */}
      {(onOpen || dock) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}>
          {dock}
          {onOpen && (
            <Button
              kind={KIND.tertiary}
              size={SIZE.mini}
              shape={SHAPE.pill}
              data-testid="embed-open"
              onClick={onOpen}
              onMouseEnter={() => setOver(true)}
              onMouseLeave={() => setOver(false)}
              startEnhancer={<Glyph id="doc" size={14} />}
              overrides={over ? undefined : undefined}
            >
              {openLabel ?? 'Open the delivery note'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** The dotted inset a quoted message stands on — the chat's own ground, INSIDE a work card, which
 *  is the texture law read in both directions on one screen. It is `detail.tsx`'s `ChatPaper`
 *  recipe (dots + the accent ring at low strength); the two want to be one component, and that
 *  collapse is in the report. */
export function QuotedPaper({ children, testid = 'embed-quote' }: { children: React.ReactNode; testid?: string }) {
  const [, theme] = useStyletron();
  const tile = (theme as unknown as { brand?: { dotTile: string } }).brand?.dotTile ?? DOT_TILE;
  return (
    <div
      data-testid={testid}
      style={{
        backgroundImage: dots(theme.colors.mono400),
        backgroundSize: tile,
        backgroundColor: theme.colors.mono100,
        border: `1px solid ${RING(theme.colors.accent, theme.colors.mono300)}`,
        borderRadius: theme.borders.radius300,
        padding: theme.sizing.scale500,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/** the ring mixed the way the theme mixes its dot ink: ONE accent, thinned into a neutral, so it
 *  re-themes with the brand and stays a whisper rather than a status colour (§17.3).
 *
 *  IT IS EXPORTED BECAUSE §77.5 NEEDED IT A THIRD TIME. «A faint red line around it» is now the
 *  edge of three things — the chat standing in the albarán, the quoted message standing in a work
 *  card, and the order overlay standing over the composer — and three sites writing the same
 *  `color-mix` by hand is three places it can drift. One recipe, one home.
 *
 *  TWO STRENGTHS, AND THE DIFFERENCE IS THE JOB. §17.3's ring is around an INCLUSION: a quoted
 *  message sitting quietly inside a work card, where the line's whole job is to say «this part is
 *  talk» without competing with the document. §77.5's is around a PINNED OVERLAY that has to be
 *  «visually unmistakable» — so it takes the same mix at `RING_LOUD`, which still reads as a
 *  hairline rather than a painted edge. Neither is a status: both mark the same thing, Rocoto's
 *  own act, at the volume its surface needs. */
export const RING_QUIET = 42;
export const RING_LOUD = 68;

export const RING = (accent: string, neutral: string, strength = RING_QUIET): string =>
  `color-mix(in srgb, ${accent} ${strength}%, ${neutral})`;

/* ── THE LINES, AS THE DOCUMENT DRAWS THEM ────────────────────────────────────────────────────
 * The produce mark, the customer's own word, the amendment chip and the subordinate-decimal figure
 * are the document's, lifted whole. A line inside a readback and the same line inside the albarán
 * are the same drawing — which is the test that nothing here is a chat-only glyph.
 */
function EmbedLines({ sale }: { sale: Sale }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      {sale.lines.map((line) => (
        <div
          key={line.id}
          data-embed-line={line.id}
          style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}
        >
          <Produce of={line.product} size="mini" />
          <span style={{ ...theme.typography.ParagraphSmall, flex: 1, minWidth: 0 }}>
            <LineName line={line} />
          </span>
          {/* A LINE WHOSE AMOUNT THE MESSAGE NEVER CARRIED HAS NO FIGURE TO PRINT, and «0,0 kg» is
              a number nobody said. So the cell states what IS: Rocoto asked them, where the house
              granted it the question, and otherwise the one thing the line wants. */}
          <span style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
            {line.unreadable && line.given === 0 ? (
              <span
                style={{
                  ...theme.typography.LabelXSmall,
                  color: sale.rocotoAsked ? theme.colors.accent : theme.colors.contentSecondary,
                }}
              >
                {sale.rocotoAsked ? 'Rocoto asked' : 'needs its amount'}
              </span>
            ) : (
              <Figure value={line.given} unit={line.unit} decimals={line.weighed ? 1 : 0} size="compact" locale="en-PE" />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── THE DOOR ─────────────────────────────────────────────────────────────────────────────────
 * Tapping an embed opens ITS sale: the document joins the open set and the desk goes to the work.
 * One call, so every embed's door behaves identically wherever it is drawn.
 *
 * The shell's legacy open-item projection retains the lightweight identity used by its strip, while
 * the canonical object landing owns route, selection, narrow release and the Sales arrival walk.
 */
export function openSale(sale: Sale): void {
  openItem({
    id: sale.id,
    customer: sale.customer.name,
    figure: sale.figure,
    number: sale.number,
    threadId: sale.customer.id,
  });
  openOrder(sale.id);
}

/* ── THE READBACK ─────────────────────────────────────────────────────────────────────────────
 * «Read from WhatsApp as 4 lines for Friday.» The sentence is what the customer's channel carries;
 * the card is what the app draws underneath it — the day, the lines, and ONE saffron mark, because
 * reading the message is Rocoto's own act.
 */
function Readback({ sale }: { sale: Sale }) {
  const [, theme] = useStyletron();
  return (
    <ChatCard
      kind="readback"
      testid="embed-readback"
      label={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300 }}>
          <FlagMark label="Read from the message" />
          Read from the message
        </span>
      }
      meta={sale.deliveryDay}
      onOpen={() => openSale(sale)}
    >
      <EmbedLines sale={sale} />
      {/* WHAT IT FILLED DIFFERENTLY, in the grammar §1 already writes it in — their word, the thing
          that went on the albarán, and which brain answered. Saffron, because it is Rocoto's. */}
      {sale.lines.map((line) => {
        const words = fillWords(sale, line);
        return words ? (
          <span
            key={line.id}
            data-testid="embed-fill"
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentSecondary,
              borderLeft: `2px solid ${theme.colors.accent}`,
              paddingLeft: theme.sizing.scale400,
            }}
          >
            {words}
          </span>
        ) : null;
      })}
    </ChatCard>
  );
}

/* ── THE ALBARÁN CARD ─────────────────────────────────────────────────────────────────────────
 * The document, compact: who it is for is the conversation itself, so the card spends its words on
 * the number, the day and the figure.
 *
 * ═══ NOTHING CLOSES (THE-EXPORT-CANON §15.1 · FEED-IA §67.4) ════════════════════════════════
 * «NOTHING CLOSES, basically — get it? I just don't want them to have to make closed to quickly
 * print everything once they trust us, then print again as new shit comes in.» — Peter.
 *
 * So this card no longer says the word. What it carries is THE LIVE READING — the shortest true
 * answer to «what does this want», and where nothing wants anything, the last act that happened:
 * «Changed 10:40» while the crate has moved since the paper came out (the loudest reading there
 * is), «Printed 09:12» once the stream's last act is the paper, and the day it has to go out on
 * while it is still owed. THE ELEVATION FOLLOWS THE SAME READING rather than a flag anybody set —
 * a document with nothing owed lies flat, a document that owes something stands.
 */
function Albaran({ sale, cast }: { sale: Sale; cast: Cast }) {
  const [, theme] = useStyletron();
  /* ONE READING, COMPUTED IN ONE PLACE. The river's row word, the state row's first cell and this
     card are three drawings of `liveReadingOf`, so they can never disagree about what a document
     wants — which is exactly the drift a card that re-derived its own word would reintroduce. */
  const reading = liveReadingOf(sale, todayId(cast));
  return (
    <ChatCard
      kind="albaran"
      testid="embed-albaran"
      owed={reading.owed}
      label={`Delivery Note ${sale.number}`}
      meta={reading.word}
      onOpen={() => openSale(sale)}
    >
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, minWidth: 0 }}>
        {sale.lines.length} {sale.lines.length === 1 ? 'line' : 'lines'} · {sale.deliveryDay}
      </span>
    </ChatCard>
  );
}

/* ── THE PRICE ANSWER ───────────────────────────────────────────────────────────────────────── */
function PriceAnswer({ sale, line }: { sale: Sale; line: SaleLine }) {
  const [, theme] = useStyletron();
  return (
    <ChatCard
      kind="price"
      testid="embed-price"
      label={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale300 }}>
          <FlagMark label="Rocoto answered it" />
          Today’s price
        </span>
      }
      /* THE HOUR IS THE HOUR IT WAS SAID — the stamp on the sentence itself, which is the row this
         card renders. `stamps.answer` exists only where a person pressed «Rocoto answers»; a price
         Rocoto read off the sheet on its own has no such stamp and would fall back to the order's
         hour, printing 06:23 under a message sent at 08:53. */
      meta={sale.thread.find((r) => r.text === priceAnswer(line, line.price))?.time ?? sale.stamps.answer ?? sale.at}
      onOpen={() => openSale(sale)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}>
        <Produce of={line.product} size="mini" />
        <span style={{ ...theme.typography.ParagraphSmall, flex: 1, minWidth: 0 }}>
          <LineName line={line} />
        </span>
        {/* the price on the right, and MARKED, so §109.5's measurement reaches this row too */}
        <span data-rate={line.price} style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
          <Figure value={line.price} unit={`S/ per ${line.unit}`} decimals={2} size="compact" locale="en-PE" />
        </span>
      </div>
    </ChatCard>
  );
}

/* ── THE REASONING EMBED (the one he named) ───────────────────────────────────────────────────
 * «When something needs review, the conversation shows WHY, legibly — the way a colleague would.»
 * Three registers, stacked inside one card:
 *
 *   EVIDENCE          their own message, quoted on the dotted paper, with the unresolved span
 *                     marked in ink. Never a highlight colour: the mark is a rule under the words.
 *   WHAT ROCOTO DID   the lines it could fill, in the fill grammar, saffron-noted.
 *   WHAT IT NEEDS     one sentence in the trade's own numbers — «They ordered 10× their usual» —
 *                     and the control that supplies it, where the missing thing is a sentence.
 *
 * Supplying the fact swaps the sentence for the choice that has been the doctrine since §10:
 * «Rocoto answers» first, «Message them yourself» beside it. Their call, every time.
 */

/** the exact span the reason is about, marked in the customer's own sentence. An ink underline,
 *  because a highlight is a colour with a meaning and this app has none. */
function MarkedQuote({ text, span }: { text: string; span?: string }) {
  const [, theme] = useStyletron();
  const at = span ? text.toLowerCase().indexOf(span.toLowerCase()) : -1;
  if (!span || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span
        data-testid="embed-span"
        style={{
          borderBottom: `2px solid ${theme.colors.contentPrimary}`,
          fontWeight: 700,
        }}
      >
        {text.slice(at, at + span.length)}
      </span>
      {text.slice(at + span.length)}
    </>
  );
}

function Reasoning({
  sale,
  cast,
  flag,
  missing,
  onWrite,
}: {
  sale: Sale;
  cast: Cast;
  flag?: Flag;
  missing?: SaleLine;
  /** «Message them yourself» — the composer this thread already has, given the caret */
  onWrite?: () => void;
}) {
  const [, theme] = useStyletron();
  const now = nowOf(cast);
  const kind = sale.needsReply?.kind;
  const line = kind === 'ask' ? sale.lines[0] : sale.lines[sale.lines.length - 1];
  const [price, setPrice] = React.useState(() => amountWords(syntheticAmountForCountry(line?.price ?? 0, workspaceCapabilitiesNow(cast.sector).country)));
  const [amount, setAmount] = React.useState('');
  const [fact, setFact] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFact(null);
    setAmount('');
    setPrice(amountWords(syntheticAmountForCountry(line?.price ?? 0, workspaceCapabilitiesNow(cast.sector).country)));
  }, [sale.id, line?.price]);

  /* THE MARKED SPAN AND THE REASON NAME THE SAME PRODUCT. The flag's line, the uncoded line, or the
     line the question is about — in that order, because that is the order they are answered in. */
  const subject = flag?.line ?? missing ?? line;
  const span = subject?.asked ?? subject?.product.name;
  /* …SO THE EVIDENCE IS THE MESSAGE THAT CARRIES THAT WORD, not merely the last one. A quote whose
     span is elsewhere is a card asking the reader to hold two messages in their head at once. */
  const received = sale.thread.filter((r) => r.author === 'received');
  const asked =
    [...received].reverse().find((r) => span && r.text.toLowerCase().includes(span.toLowerCase())) ??
    received[received.length - 1];

  /* THE REASON IS THE CHECK THAT TRIPPED, in `sale.ts`'s own conversation register: it leads with
     what the customer did and ends with the one thing Rocoto needs in order to answer them. ONE
     sentence, never two — `confirmWords` says the same fact a second way, and the same fact printed
     twice is the repetition §25.5 forbids. */
  const because = flag
    ? stickyWords(sale, flag)
    : missing
      ? `They asked for ${missing.product.name} — it is off the catalogue, so a price is needed before a reply can be drafted.`
      : (sale.needsReply?.about ?? '');

  /* WHAT ROCOTO DID WITH THE LINE, where that is a fact the reading has not already given: the fill
     it chose, the amount it put on, or the question it put to the customer itself where the house
     granted it one. Silence where it would only repeat the reason. */
  const did = subject
    ? (fillWords(sale, subject) ??
      (subject.given > 0
        ? `${subject.product.name} went on at ${qtyWords(subject.given, subject.unit)}`
        : flag && sale.rocotoAsked && flag.kind === 'unreadable'
          ? askedWords(sale, flag)
          : null))
    : null;

  return (
    <ChatCard
      kind="reasoning"
      testid="embed-reasoning"
      owed
      label="Why this is waiting"
      meta={asked?.time ?? sale.at}
      onOpen={() => openSale(sale)}
    >
      {/* ── EVIDENCE ───────────────────────────────────────────────────────────────────────── */}
      {asked && (
        <QuotedPaper>
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary }}>
            <MarkedQuote text={asked.text} span={span} />
          </span>
        </QuotedPaper>
      )}

      {/* ── WHAT ROCOTO DID ────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
        <span
          data-testid="embed-did"
          style={{
            ...theme.typography.ParagraphXSmall,
            color: theme.colors.contentSecondary,
            borderLeft: `2px solid ${theme.colors.accent}`,
            paddingLeft: theme.sizing.scale400,
          }}
        >
          {sale.reading}
        </span>
        {did && (
          <span
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentSecondary,
              borderLeft: `2px solid ${theme.colors.accent}`,
              paddingLeft: theme.sizing.scale400,
            }}
          >
            {did}
          </span>
        )}
      </div>

      {/* ── WHAT IT NEEDS, IN THE TRADE'S OWN NUMBERS ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
        <span data-testid="embed-because" style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}>
          {because}
        </span>

        {/* ── THE ONE THING IT LACKED, SUPPLIED HERE ─────────────────────────────────────────
            This is the whole argument for routing anything to review: the fact is easier to give
            HERE — a field, two chips — than in a sentence somebody has to write, and giving it is
            what re-arms Rocoto. Three shapes, and the bound is deliberate: a PRICE and a
            CAN-YOU-GET-IT are sentences Rocoto needs in order to reply; an AMOUNT is the fact the
            message never carried, and putting it on is what makes the order readable at all — the
            same act as typing it on the document, on the same event ledger, one door along.
            A person's own YES on an unusual or over-ceiling order is a JUDGEMENT, not a fact, so it
            keeps the door: it is made on the document, where the whole order is in front of them. */}
        {flag?.kind === 'unreadable' && !fact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ width: 108 }}>
              <Input
                size={SIZE.mini}
                value={amount}
                onChange={(e) => setAmount((e.target as HTMLInputElement).value)}
                overrides={{ Input: { props: { 'data-testid': 'embed-amount-field', inputMode: 'decimal' } } }}
              />
            </div>
            <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap' }}>{flag.line.unit}</span>
            <Button
              kind={KIND.secondary}
              size={SIZE.mini}
              data-testid="embed-set-amount"
              onClick={() => {
                const n = Number(amount.replace(',', '.'));
                if (!Number.isFinite(n) || n <= 0) return;
                editLine(sale, saleReplyHour(sale, now), flag.line.id, { given: n });
                setFact(answerWords(sale));
              }}
            >
              Put it on
            </Button>
          </div>
        )}

        {line && kind === 'ask' && !fact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ width: 108 }}>
              <Input
                size={SIZE.mini}
                value={price}
                onChange={(e) => setPrice((e.target as HTMLInputElement).value)}
                overrides={{ Input: { props: { 'data-testid': 'embed-price-field', inputMode: 'decimal' } } }}
              />
            </div>
            <span style={{ ...theme.typography.LabelSmall, whiteSpace: 'nowrap' }}>{workspaceCurrency(cast.sector) === 'EUR' ? '€' : 'S/'} per {line.unit}</span>
            <Button
              kind={KIND.secondary}
              size={SIZE.mini}
              data-testid="embed-set-price"
              onClick={() => {
                const n = Number(price.replace(',', '.'));
                if (Number.isFinite(n) && n > 0) setFact(priceAnswer(line, canonicalSyntheticAmount(n, workspaceCapabilitiesNow(cast.sector).country)));
              }}
            >
              Set it
            </Button>
          </div>
        )}

        {line && kind === 'order' && !fact && (
          <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <Button
              kind={KIND.secondary}
              shape={SHAPE.pill}
              size={SIZE.mini}
              data-testid="embed-can"
              onClick={() => setFact(supplyAnswer(sale, line, true))}
            >
              We can get it
            </Button>
            <Button
              kind={KIND.secondary}
              shape={SHAPE.pill}
              size={SIZE.mini}
              data-testid="embed-cannot"
              onClick={() => setFact(supplyAnswer(sale, line, false))}
            >
              This one goes as it stands
            </Button>
          </div>
        )}

        {/* ── AND THEN THEIR CALL ────────────────────────────────────────────────────────────
            The pair appears only once the fact is in hand, because it is the fact that re-armed
            Rocoto — «answer for me» offered before it has anything to say is the empty sentence
            this product refuses to send. */}
        {fact && (
          <div
            data-testid="embed-answer-choice"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.sizing.scale400,
              padding: theme.sizing.scale500,
              borderRadius: theme.borders.radius200,
              border: `1px solid ${theme.colors.borderOpaque}`,
              minWidth: 0,
            }}
          >
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>“{fact}”</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                data-testid="embed-rocoto-answers"
                startEnhancer={<FlagMark label="Rocoto writes it" />}
                onClick={() => answerSale(sale, saleReplyHour(sale, now), fact)}
              >
                Rocoto answers
              </Button>
              <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="embed-write-yourself" onClick={onWrite}>
                Message them yourself
              </Button>
            </div>
          </div>
        )}
      </div>
    </ChatCard>
  );
}

/* ── THE ONE ENTRY POINT ──────────────────────────────────────────────────────────────────────
 * Every surface that hosts a conversation draws an embed through this, so the sale's own detail and
 * the Chats overlay render the identical card — one component, two doors (§9.3).
 */
export type ChatEmbedProps = {
  /** which of the four documents this turn carries: readback, albarán, price or reasoning */
  embed: Embed;
  /** the house, for the words the reasoning embed composes from */
  cast: Cast;
  /** the door into the composer, where the turn offers one */
  onWrite?: () => void;
};

export function ChatEmbed({ embed, cast, onWrite }: ChatEmbedProps) {
  if (embed.kind === 'readback') return <Readback sale={embed.sale} />;
  if (embed.kind === 'albaran') return <Albaran sale={embed.sale} cast={cast} />;
  if (embed.kind === 'price') return <PriceAnswer sale={embed.sale} line={embed.line} />;
  return <Reasoning sale={embed.sale} cast={cast} flag={embed.flag} missing={embed.missing} onWrite={onWrite} />;
}
