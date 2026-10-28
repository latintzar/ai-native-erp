/* THE INCOMING MAIL — the email feed as a real inbox (THE-DENSE-BRIEF-DESIGN musing 12).
 *
 * ═══ WHAT CHANGED, AND WHY IT IS NOT A SECOND LEDGER ════════════════════════════════════════
 * «The incoming email feed should be an inbox — Gmail-grade.» The ledger already holds every
 * arrival; what an inbox needs is a different UNIT. The ledger's row is a per-product EVENT — 50 kg
 * of merluza landed at 05:12 — but an inbox's row is THE MESSAGE: one supplier email carrying an
 * albarán with twelve lines is ONE row here, grouping the arrivals it produced.
 *
 * So `mailsOf` is a pure derivation over `buildLedger`'s output (rule 2 of `incoming.ts`: derived,
 * never stored). No table, no second history, no chance of the log and the inbox telling different
 * stories: THE INBOX IS THE MAIL SLICE OF ONE LEDGER, and the «Incoming log» pill keeps the full
 * six doors beside it.
 *
 * ═══ READ IS A LATER FACT ABOUT AN ARRIVAL ══════════════════════════════════════════════════
 * Exactly like the lote codes: the ledger is append-only, so what a person has READ lives beside it
 * and is laid over at read time (`codes: Record<eventId, string>` is the idiom this copies). It is
 * a module singleton published through `useSyncExternalStore` — the same no-provider decision
 * `rules.ts`, `incoming.ts` and `threads.ts` all make, because an area package lands files, it does
 * not wrap the app. Opening a row stamps it read; there is no «mark as read» button, per §31.3.
 *
 * ═══ THE FOUNDER'S LAWS, APPLIED TO A ROW ═══════════════════════════════════════════════════
 *   · UNREAD IS TYPOGRAPHIC WEIGHT. Colour is not a status system, so the only difference between
 *     an unread row and a read one is the step its sender and subject are set in.
 *   · THE DOTS STAY OFF THIS SURFACE (§11). Dots mean a conversation; an inbox is work.
 *   · THE ACCENT BELONGS TO THE DISPOSITION, which is Rocoto's own act: it read the sheet and filed
 *     the arrivals. Nothing else in a row is accented.
 *   · EVERY QUANTITY SHARES ITS NUMBER'S LINE with its unit, in the disposition as everywhere.
 *   · THE HEADING NAMES THE THING — «Mail from your suppliers» (§132.4) — and carries the
 *     count of what is new.
 *   · WHAT IS, NEVER WHAT IS NOT. A mail that produced no stock rows says «Filed with the papers».
 *
 * ═══ WHY THIS FILE TAKES ITS DRAWINGS AS PROPS ══════════════════════════════════════════════
 * The file chip, the «what happened» sentence and the day label are Stock's own, already written
 * once. Importing them back would close a module cycle (Stock mounts this section); redrawing them
 * would be two of everything. So they arrive as render props from the one file that owns them, and
 * a chip in the inbox is the identical component a chip in the log is.
 *
 * ═══ THE REPLY SEAM ═════════════════════════════════════════════════════════════════════════
 * Reply and Forward ride the SEND RAILS (FEED-IA §20/§24): the same connection that lets a house
 * send an albarán by email is the one that lets it answer a supplier. Until that rail exists, the
 * mail's foot states who sent it and where it landed — as facts. Nothing renders a control that
 * does nothing, and no copy promises a date. The address IS the seam.
 *
 * ═══ AND THE ROW IS READ, NOT MERELY LISTED (FEED-IA §101.1) ════════════════════════════════
 * «The whole analysis of the supplier emails to see which ones are right — all of that should
 * actually work.» So every row carries `incoming.ts`'s READING of the message it stands for: what
 * the sheet was read into, and what it says that the catalogue row says differently. A person
 * scanning this list is not asking «what arrived» — the ledger already answered that — they are
 * asking WHICH OF THESE MATTERS, and the second line answers exactly that.
 *
 * ═══ THE ROW'S ANATOMY IS THE GMAIL REFERENCE (FEED-IA §115.7, Peter's own screenshot) ══════
 * Four seats on the first line and nothing else: SENDER, carrying the weight · SUBJECT · THE FILE
 * AS A PILL, an icon and a word · THE DATE, hard right. Then the READING on the second line, the
 * way a mail client puts the snippet there. That ordering is why the disposition left the first
 * line: it was a SENTENCE competing with three shapes, and the reference is shapes and icons over
 * sentences. It lost nothing — it opens the reading it always belonged to.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import Name from '../../scenarios/shell/Name';
import type { Cast, Supplier } from '../../scenarios/data/cast';
import { productOf, supplierOf } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';
import { readMail, type IncomingEvent, type IncomingFile, type MailReading } from './incoming';
import { SupplyDoor } from './supply-broadcast';
import { Glyph, STEP } from './glyphs';

/* ── THE UNIT ─────────────────────────────────────────────────────────────────────────────── */

export type IncomingMail = {
  /** Authorized transient native messages; never reconstructed from stock movements. */
  messages?: import('./shell/threads').ThreadTurn[];
  /** supplier · subject · day — the identity of one message */
  id: string;
  supplier?: Supplier;
  subject: string;
  /** the hour it landed */
  at: Date;
  /** the document it carried */
  file?: IncomingFile;
  /** every ledger row this one message produced */
  events: IncomingEvent[];
  /** the rows that actually moved goods — what the mail TAUGHT the stock */
  arrivals: IncomingEvent[];
};

const dayOfKey = (at: Date): string => `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;

/** THE LIST'S OWN MEASURE (FEED-IA §119.5, «why full width?»). Wide enough for a sender, a
 *  subject, a file pill and a time to read as four seats of one row; narrow enough that the date
 *  is still beside the words it stamps. */
export const MAIL_MEASURE = 820;
const MEASURE = MAIL_MEASURE;

/**
 * The mail slice of the ledger, newest first.
 *
 * ONE ROW IS ONE MESSAGE. The grouping key is what identifies a message from outside: who sent it,
 * what its subject line said, and the day it arrived. A supplier albarán carrying four products
 * therefore produces four ledger rows and ONE inbox row, and its disposition names all four.
 */
export function mailsOf(cast: Cast, ledger: IncomingEvent[]): IncomingMail[] {
  const seats = new Map<string, IncomingMail>();
  for (const e of ledger) {
    if (e.kind !== 'email') continue;
    const subject = e.subject ?? e.file?.name ?? 'Delivery Note';
    const id = `${e.supplier ?? 'outside'}|${subject}|${dayOfKey(e.at)}`;
    const seat = seats.get(id);
    if (seat) {
      seat.events.push(e);
      if (e.effect === 'delta') seat.arrivals.push(e);
      if (e.at > seat.at) seat.at = e.at;
      continue;
    }
    seats.set(id, {
      id,
      supplier: e.supplier ? supplierOf(cast, e.supplier) : undefined,
      subject,
      at: e.at,
      file: e.file,
      events: [e],
      arrivals: e.effect === 'delta' ? [e] : [],
    });
  }
  return [...seats.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/* ── WHAT A PERSON HAS READ ───────────────────────────────────────────────────────────────────
 * Beside the ledger, never inside it. The sector switch is a different house, so its reading is
 * its own — the same rule the declarations and the day keep.
 */

type Reads = { sector: SectorId | null; ids: string[] };

let READS: Reads = { sector: null, ids: [] };
const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const snapshot = (): Reads => READS;

const publish = (next: Reads): void => {
  READS = next;
  for (const fn of listeners) fn();
};

/** Looking at it is reading it (§31.3 — no button anywhere). */
export function markMailRead(sector: SectorId, id: string): void {
  const base = READS.sector === sector ? READS : { sector, ids: [] };
  if (base.ids.includes(id)) {
    if (base !== READS) publish(base);
    return;
  }
  publish({ sector, ids: [...base.ids, id] });
}

export function useMailReads(sector: SectorId): string[] {
  const state = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  React.useEffect(() => {
    if (READS.sector !== sector) publish({ sector, ids: [] });
  }, [sector]);
  return state.sector === sector ? state.ids : [];
}

/* ── WHAT THE MAIL DID, IN WORDS ──────────────────────────────────────────────────────────────
 * The disposition is Rocoto's own act — it read the sheet and filed what landed — so its verb takes
 * the accent and nothing else in the row does. Past three products the sentence states the count
 * and the first names, because a row is a row.
 */

const LOCALE = 'es-ES';

const qty = (cast: Cast, e: IncomingEvent): string => {
  const product = productOf(cast, e.product);
  const decimals = product.variableWeight ? 1 : 0;
  return `${e.qty.toLocaleString(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${e.unit}`;
};

const NAMED = 3;

export function Disposition({ cast, mail, reading }: { cast: Cast; mail: IncomingMail; reading?: MailReading }) {
  const [, theme] = useStyletron();
  const accent = { color: theme.colors.accent };

  /* ── A CREDIT NOTE SAYS WHAT IT PUTS BACK (FEED-IA §119.3) ────────────────────────────────
     «Why not one with a problem maybe or another with a credit note?» An abono carries no
     arrival, so the albarán's sentence had nothing to say about it. Its own content is the
     reading: the goods, how much of them, what it comes to, and the arrival it answers. The
     accent stays on ROCOTO'S OWN ACT — it read the abono — and on nothing else in the row. */
  if (reading?.paper === 'abono' && reading.credited) {
    const credited = reading.credited;
    const goods = productOf(cast, credited.product);
    const amount = credited.amount.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const much = credited.qty.toLocaleString(LOCALE, {
      minimumFractionDigits: goods.variableWeight ? 1 : 0,
      maximumFractionDigits: goods.variableWeight ? 1 : 0,
    });
    return (
      <span data-testid="disposition" data-paper="abono" style={{ color: theme.colors.contentSecondary, minWidth: 0 }}>
        <span style={accent}>Credit note read</span>
        {' · '}
        <span style={{ whiteSpace: 'nowrap' }}>
          <Name of={goods} /> {much} {credited.unit}
        </span>
        {' · '}
        <span style={{ whiteSpace: 'nowrap' }}>S/ {amount}</span>
        {credited.lot ? ` on the ${credited.lot} arrival` : ''}
      </span>
    );
  }

  if (mail.arrivals.length === 0) {
    return (
      <span data-testid="disposition" style={accent}>
        Filed with the papers
      </span>
    );
  }

  const named = mail.arrivals.slice(0, NAMED);
  const rest = mail.arrivals.length - named.length;
  return (
    <span data-testid="disposition" style={{ color: theme.colors.contentSecondary, minWidth: 0 }}>
      <span style={accent}>
        {mail.arrivals.length} {mail.arrivals.length === 1 ? 'arrival' : 'arrivals'} landed
      </span>
      {named.map((e) => (
        <span key={e.id} style={{ whiteSpace: 'nowrap' }}>
          {' · '}
          <Name of={productOf(cast, e.product)} /> {qty(cast, e)}
        </span>
      ))}
      {rest > 0 ? ` and ${rest} more` : ''}
    </span>
  );
}

/* ── WHICH MAILS MATTER (FEED-IA §101.1) ──────────────────────────────────────────────────────
 * The row's second line. It carries the disposition — what Rocoto read the sheet into, the accent
 * on its own act — and then the ANALYSIS: how many of the sheet's own facts stand differently on
 * the catalogue row. A message that only confirms what the house already holds says so in words,
 * because «nothing differs» is a real answer to «which of these is right» and a blank would leave
 * a reader to guess whether anything was checked.
 *
 * IT IS ONE LINE. A finding is a sentence with two values in it, and four of them stacked under a
 * mail row would be a paragraph in a list — so the count leads here and the sentences themselves
 * open with the message, where there is room to read them.
 */
export function Reading({
  cast,
  mail,
  reading,
}: {
  cast: Cast;
  mail: IncomingMail;
  reading: MailReading;
}) {
  const [, theme] = useStyletron();
  const rows = reading.findings.length;
  return (
    <span data-testid="mail-reading" data-findings={rows} data-paper={reading.paper} style={{ minWidth: 0 }}>
      <Disposition cast={cast} mail={mail} reading={reading} />
      {mail.arrivals.length > 0 && (
        <span style={{ color: theme.colors.contentSecondary }}>
          {' · '}
          {rows === 0
            ? 'the sheet says what your rows say'
            : `${rows} ${rows === 1 ? 'fact differs' : 'facts differ'} from your rows`}
        </span>
      )}
    </span>
  );
}

/* ── THE ROW (FEED-IA §115.7 — Peter's Gmail reference) ───────────────────────────────────────
 * Desk, FOUR SEATS on the first line and the reading under them:
 *
 *   ┌────────────────────────────────────────────────────────────────────────────────────────┐
 *   │ Pescados Rubio   Albarán L-2217   [🗎 albaran-L-2217.pdf]                        05:14 │
 *   │ 1 arrival landed · Rape 780 kg · 2 facts differ from your rows                         │
 *   └────────────────────────────────────────────────────────────────────────────────────────┘
 *     sender            subject         the file as a pill                          date, right
 *
 * THE DATE IS HARD RIGHT and the subject is the seat that gives way — those two decisions are what
 * make a list of forty messages scan as columns rather than as forty different lines. The file is a
 * PILL WITH ITS ICON, which is the reference's own shape: a mail either carries paper or it does
 * not, and that is read faster as an object than as a sentence about an attachment.
 *
 * Phone: the row every phone inbox has settled on — sender and time, then the subject, then the
 * reading, with the file under it. Same four facts, stacked, nothing clipped.
 *
 * THE ROW IS NOT ONE BUTTON. The file chip is a control of its own and a button inside a button is
 * not a thing the platform allows, so the opening area is the button and the chip stands beside it.
 */
function MailRow({
  cast,
  mail,
  reading,
  read,
  open,
  phone,
  time,
  onOpen,
  chip,
  children,
}: {
  cast: Cast;
  mail: IncomingMail;
  reading: MailReading;
  read: boolean;
  open: boolean;
  phone: boolean;
  time: string;
  onOpen: () => void;
  chip: React.ReactNode;
  /** the expansion, drawn by the caller — one row, opened in place */
  children?: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);

  /* UNREAD IS WEIGHT AND NOTHING ELSE. `LabelMedium` against `ParagraphMedium` is one step of the
     same ramp: same size, same ink, a heavier face. No colour, no dot, no badge.
     AND IT RIDES THE SENDER (§115.7). The reference sets the sender in the heavier face and leaves
     the subject in the paragraph step — which is what makes a column of forty rows scannable BY
     WHO SENT THEM. Both seats carrying the weight made one bold block per row and no hierarchy
     inside it. */
  const heading = read ? theme.typography.ParagraphMedium : theme.typography.LabelMedium;

  /* THE TRUNCATION BELONGS TO THE COLUMN, NOT TO THE WORDS. When the ellipsis rules sit on an
     inner span inside a flex column, the column sizes itself to the text and the span truncates
     inside it anyway — a name cut short in a box with room to spare. One owner: the column. */
  const clip = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
  /* ONE BOX PER COLUMN. A column that carries the type and a span inside it that carries the type
     again are two boxes measured separately, and the inner one lands a few pixels short of its own
     text — which is a name truncated inside a column with room to spare. The column IS the words. */
  const column = { ...heading, ...clip, minWidth: 0 } as const;
  const plain = { ...theme.typography.ParagraphMedium, ...clip, minWidth: 0 } as const;
  const sender = mail.supplier ? <Name of={mail.supplier} /> : 'From outside';
  const subject = mail.subject;
  const stamp = (
    <span
      data-seat="date"
      style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}
    >
      {time}
    </span>
  );
  /* THE READING TRUNCATES ON A DESK AND WRAPS ON A PHONE. On the second line of a dense list an
     ellipsis is the only honest end; on the phone the sentence has the width to finish, and the
     quantities in it are worth reading. Either way nothing is cut off mid-glyph. */
  const readingLine = (
    <span
      data-seat="reading"
      style={
        phone
          ? { ...theme.typography.ParagraphXSmall, minWidth: 0 }
          : { ...theme.typography.ParagraphXSmall, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }
      }
    >
      <Reading cast={cast} mail={mail} reading={reading} />
    </span>
  );

  return (
    <div
      data-testid="mail-row"
      data-mail={mail.id}
      data-read={read ? 'yes' : 'no'}
      data-open={open ? 'yes' : 'no'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: `calc(100% - ${theme.sizing.scale400})`,
        boxSizing: 'border-box',
        margin: `${theme.sizing.scale100} ${theme.sizing.scale200}`,
        border: `1px solid ${open || over ? theme.colors.borderOpaque : 'transparent'}`,
        borderRadius: theme.borders.radius400,
        background: open || over ? theme.colors.backgroundSecondary : 'transparent',
        boxShadow: open ? `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 6%, transparent)` : 'none',
        minWidth: 0,
      }}
      data-list-card="inset"
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocusCapture={() => setOver(true)}
      onBlurCapture={() => setOver(false)}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale200,
          padding: `${theme.sizing.scale500} ${theme.sizing.scale500}`,
          minWidth: 0,
        }}
      >
        {/* LINE ONE — THE FOUR SEATS (§115.7). The sender takes the weight and a fixed measure; the
            subject is the seat that gives way; the file is a pill; the date is hard right. */}
        <div
          data-testid="mail-head"
          style={{
            display: 'flex',
            /* THE PHONE STACKS: the row is a column of its own lines and the pill takes the last
               one, so the sender keeps the whole of the first line and never loses its name. */
            flexDirection: phone ? 'column' : 'row',
            alignItems: phone ? 'stretch' : 'center',
            gap: theme.sizing.scale400,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            data-testid="mail-open"
            aria-expanded={open}
            onClick={onOpen}
            style={{
              display: 'flex',
              flexDirection: phone ? 'column' : 'row',
              alignItems: phone ? 'stretch' : 'baseline',
              gap: phone ? theme.sizing.scale200 : theme.sizing.scale500,
              flex: 1,
              minWidth: 0,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: theme.colors.contentPrimary,
              textAlign: 'left',
              cursor: 'default',
              fontFamily: 'inherit',
            }}
          >
            {phone ? (
              <>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400, minWidth: 0 }}>
                  <span data-seat="sender" style={{ ...column, flex: 1 }}>{sender}</span>
                  {stamp}
                </span>
                <span data-seat="subject" style={plain}>{subject}</span>
              </>
            ) : (
              <>
                {/* THE IDENTITY KEEPS ITS WIDTH AND THE SUBJECT ABSORBS THE PRESSURE. Who sent it is
                    what a column of forty rows is scanned by, so it takes its measure and never
                    shrinks; the subject is the one that gives way — which is what keeps the same row
                    legible in the page's readable column and inside a 680px panel. */}
                <span data-seat="sender" style={{ ...column, flex: '0 0 auto', width: '18ch' }}>{sender}</span>
                <span data-seat="subject" style={{ ...plain, flex: '1 1 0' }}>{subject}</span>
              </>
            )}
          </button>
          <span data-seat="file" style={{ display: 'flex', minWidth: 0, flex: '0 0 auto' }}>{chip}</span>
          {!phone && stamp}
        </div>
        {/* LINE TWO — WHAT ROCOTO MADE OF IT (§101.1). */}
        {readingLine}
      </div>
      {open && children}
    </div>
  );
}

/* ── THE MAIL, OPENED IN PLACE ────────────────────────────────────────────────────────────────
 * Gmail's own move: the row grows into the message rather than taking the reader somewhere. What is
 * inside is the log's own parse — what arrived, what it taught — under the disposition it summarises,
 * and the document itself is one tap further in, where it BECOMES the modal.
 */
function MailBody({
  cast,
  mail,
  reading,
  address,
  event,
}: {
  cast: Cast;
  mail: IncomingMail;
  reading: MailReading;
  address: string;
  event: (row: IncomingEvent) => React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const products = [...new Set(mail.arrivals.map((a) => a.product))];
  return (
    <div
      data-testid="mail-body"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale600,
        padding: `${theme.sizing.scale500} ${theme.sizing.scale500} ${theme.sizing.scale700}`,
        minWidth: 0,
      }}
    >
      {/* THE SAME FACT IS NOT PRINTED TWICE (§25.5). The row above already says what landed; what
          the expansion adds is the LEDGER's own parse of it — the arrival, its lote, its hour — and
          the chip that opens the paper stays on the row, one per mail. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        {mail.events.map((row) => (
          <div key={row.id} data-testid="mail-event" style={{ display: 'flex', minWidth: 0 }}>
            {event(row)}
          </div>
        ))}
      </div>

      {/* WHAT THE SHEET SAYS THAT YOUR ROW SAYS DIFFERENTLY (§101.1). One sentence per fact, each
          carrying both values, with the method under them — a person can check every one of these
          against the paper the pill opens. */}
      {reading.findings.length > 0 && (
        <div
          data-testid="mail-findings"
          data-findings={reading.findings.length}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}
        >
          {reading.findings.map((finding, i) => (
            <span
              key={`${finding.kind}-${finding.product}-${finding.label ?? i}`}
              data-testid="mail-finding"
              data-kind={finding.kind}
              style={{ ...theme.typography.ParagraphSmall, minWidth: 0 }}
            >
              {finding.says}
            </span>
          ))}
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
            {reading.method}
          </span>
        </div>
      )}

      {/* AND WHERE THE CRATE THIS SHEET BROUGHT LEAVES THE BOOK SHORT, THE DOOR (§101.2). It draws
          nothing on a morning that adds up, so the ordinary mail keeps the shape it had. */}
      {products.length > 0 && <SupplyDoor cast={cast} products={products} />}

      {/* THE SEAM. Who sent it, and where it landed — two facts. Reply and Forward stand here the
          day the send rail is connected (FEED-IA §20), written by the email integration; until
          then nothing draws, because a control that does nothing is worse than no control. */}
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
        {mail.supplier ? <Name of={mail.supplier} /> : 'A supplier'} sent it{address ? ` to ${address}` : ''}.
      </span>
    </div>
  );
}

/* ── THE DOOR, AND WHY IT STOPPED BEING A SECOND OFFER (FEED-IA §109.1 · the walk, P1-4) ───────
 * «Connect your email is its own thing. And then WITHIN that, you're able to select HOW to do the
 * connection.» — so the act is offered ONCE, on the seat that owns it, and every other surface
 * that wants it POINTS at that one offer.
 *
 * THIS USED TO BE THE FIFTH WASH. Connections carried four connect cards and this carried a fifth,
 * of which two were the same act («Connect your inbox» here and there, plus «Connect Gmail» and
 * «Connect Microsoft 365» under it) — and this one led ABOVE the albarán log it was offering to
 * fill, which is the offer outranking the thing that is already running (§98.3). The licence
 * §51.20 grants is a flagship treatment for THE connect surfaces, not a coat of paint every
 * surface that mentions email may wear.
 *
 * SO IT IS A LINE AND A ROUTE. `#/admin/connections/email` is the one email door's own tail; the
 * words say what arrives once it is plugged in, which is the only reason this sentence exists.
 * (It also retires a dead route: this pointed at `#/settings`, which §53 replaced.)
 */
export function ConnectOffer({ testid = 'connect-inbox' }: { testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <a
      href="#/admin/connections/email"
      data-testid={testid}
      style={{
        display: 'block',
        padding: theme.sizing.scale600,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        textDecoration: 'none',
        ...theme.typography.ParagraphSmall,
        minWidth: 0,
      }}
    >
      Connect your email, and the delivery notes your suppliers send land here with the file attached.
    </a>
  );
}

/* ── THE DAY GROUPS ───────────────────────────────────────────────────────────────────────────
 * Nearness first (§18), newest inside a day. THE LIST NEVER RE-SORTS UNDER THE READER: unread mail
 * keeps its place in time rather than jumping to the top, because the least a person has to track
 * is a list that stays where they left it.
 */
function group(mails: IncomingMail[], dayOf: (at: Date) => string): Array<{ label: string; mails: IncomingMail[] }> {
  const days: Array<{ label: string; mails: IncomingMail[] }> = [];
  for (const mail of mails) {
    const label = dayOf(mail.at);
    const head = days[days.length - 1];
    if (head && head.label === label) head.mails.push(mail);
    else days.push({ label, mails: [mail] });
  }
  return days;
}

export type InboxProps = {
  cast: Cast;
  mails: IncomingMail[];
  reads: string[];
  /** the row standing open, held by the surface so it survives the file opening over it */
  openId: string | null;
  onOpen: (id: string | null) => void;
  phone: boolean;
  feed: boolean;
  address: string;
  /** Stock's own drawings, injected rather than copied — see the header */
  dayOf: (at: Date) => string;
  timeOf: (at: Date) => string;
  chip: (file: IncomingFile, mail: IncomingMail) => React.ReactNode;
  event: (row: IncomingEvent) => React.ReactNode;
};

function MailList(props: InboxProps & { days: Array<{ label: string; mails: IncomingMail[] }> }) {
  const [, theme] = useStyletron();
  return (
    <>
      {props.days.map((day) => (
        <section key={day.label} data-mail-day={day.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h4
            style={{
              margin: 0,
              padding: `${theme.sizing.scale500} 0 ${theme.sizing.scale300}`,
              ...theme.typography.LabelSmall,
              color: theme.colors.contentSecondary,
            }}
          >
            {day.label}
          </h4>
          {day.mails.map((mail) => {
            const read = props.reads.includes(mail.id);
            const open = props.openId === mail.id;
            /* THE READING IS FOLDED WHERE THE ROW IS DRAWN, off the ledger rows the message already
               carries — no store, no second pass over the inbox, and the row and its expansion
               cannot disagree about what the sheet said (`incoming.ts`'s rule 2). */
            const reading = readMail(props.cast, mail.events);
            return (
              <MailRow
                key={mail.id}
                cast={props.cast}
                mail={mail}
                reading={reading}
                read={read}
                open={open}
                phone={props.phone}
                time={props.timeOf(mail.at)}
                onOpen={() => props.onOpen(open ? null : mail.id)}
                chip={mail.file ? props.chip(mail.file, mail) : null}
              >
                <MailBody
                  cast={props.cast}
                  mail={mail}
                  reading={reading}
                  address={props.address}
                  event={props.event}
                />
              </MailRow>
            );
          })}
        </section>
      ))}
    </>
  );
}

/* ── THE MAIL SECTION OF STOCK'S INCOMING SEAT (FEED-IA §51.21) ───────────────────────────────
 * It used to be a WINDOW: today and yesterday at the foot of the catalogue, with «Open the inbox»
 * beside it for the rest — a window because the mail had no room of its own under three hundred
 * catalogue rows. §51.21 gave it a seat, so the window and its door both go: the whole list is
 * here, in one scrollport, grouped by day.
 *
 * The heading names the thing and carries the count of what is new; it sticks to the top of the
 * seat's own scrollport, and it paints its own ground like every other sticky bar in the app.
 */

export function InboxSection({
  top,
  ...props
}: InboxProps & { top: number }) {
  const [, theme] = useStyletron();
  const days = group(props.mails, props.dayOf);
  const unread = props.mails.filter((m) => !props.reads.includes(m.id)).length;

  return (
    <section
      data-testid="inbox"
      data-unread={unread}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale600,
        minWidth: 0,
        /* ── THE LIST IS THE SIZE OF A ROW, NOT THE SIZE OF THE PANE (FEED-IA §119.5) ────────
           «Why full width?» — asked of this list and of two more in one round. A mail row's
           content is a sender, a subject, a pill and a time: at 1094px the date sits half a
           screen from the words it belongs to and the row stops reading as a row. So the list
           takes a MEASURE and centres in the seat it stands in — narrower and centred, which
           is the same answer the round gave everywhere else. Below the measure it simply
           fills, so a phone is untouched. */
        width: '100%',
        maxWidth: MEASURE,
        marginInline: 'auto',
      }}
    >
      <header
        data-testid="inbox-head"
        style={{
          position: 'sticky',
          top,
          zIndex: 1,
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale500,
          flexWrap: 'wrap',
          paddingTop: theme.sizing.scale500,
          paddingBottom: theme.sizing.scale400,
          borderBottom: `1px solid ${theme.colors.contentPrimary}`,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        {/* THE HEADING NAMES ITS DIRECTION (FEED-IA §132.4). «Incoming mail» was the third thing
            on this surface wearing the word «incoming», and it left a reader to work out whether
            it meant the seat, the log, or this list. The seat is «Supplier emails»; this section
            is the half that ARRIVES, and the one under it is the half that goes back out. */}
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, minWidth: 0 }}>Mail from your suppliers</h3>
        {unread > 0 && (
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
            {unread} new
          </span>
        )}
        <span style={{ flex: 1 }} />
        {props.feed && props.address && (
          /* THE ADDRESS IS A FACT A PERSON ACTS ON — where their suppliers have to send — so it
             rides the head where it is always in sight, rather than sitting under the list as a
             sentence about it. */
          <span
            data-testid="inbox-address"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              ...theme.typography.LabelXSmall,
              color: theme.colors.contentSecondary,
              minWidth: 0,
            }}
          >
            {/* ONE STEP FOR EVERY MARK (FEED-IA §58.3, §30). 13px is off the vocabulary's own
                scale — it puts Lucide's stroke 2 on a box no other mark in the app uses, and the
                same glyph then reads a shade heavier here than it does anywhere else. */}
            <Glyph id="at" size={STEP.small} />
            {props.address}
          </span>
        )}
      </header>

      {props.feed && props.mails.length > 0 ? (
        <div
          style={{
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            background: theme.colors.backgroundPrimary,
            padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale500}`,
            minWidth: 0,
          }}
        >
          <MailList {...props} days={days} />
        </div>
      ) : (
        <ConnectOffer testid="connect-inbox" />
      )}
    </section>
  );
}

/* THE PANEL THAT USED TO STAND BEHIND «Open the inbox» IS GONE (FEED-IA §51.21). It existed
 * because the section at the foot of the catalogue could only afford two days of mail, so the rest
 * needed a card to live in. The mail has a SEAT now; a card over the seat would be the list opened
 * on top of itself. */
