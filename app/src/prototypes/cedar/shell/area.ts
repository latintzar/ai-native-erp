/* THE AREA CONTRACT — how a surface joins the app, and how a SECOND WORLD joins beside it.
 *
 * A BUILDER WRITES THE AREA AND THE META AND NEVER THE CHROME, exactly as a scenario builder
 * writes the screen and never the card. An area registers by EXISTING: drop
 * `src/prototypes/cedar/areas/<id>.tsx` exporting `meta` and a default component, and the shell globs it onto
 * the rail. The area packages therefore land files without touching this shell, and the rail
 * cannot fall out of step with what is built.
 *
 * THE FILE NAME IS THE ROUTE. `areas/sales.tsx` is `#/sales`, and that is the whole rule — the id
 * is read off the path in `App.tsx` rather than off the meta, so a surface's route and its file
 * can never drift apart while a package is mid-rename.
 *
 * THREE IDS, AND THAT IS THE DESK (THE-APP-V2 §1 and §5.1). «One thing: their Sales. Then the rest
 * is, like, Stock.» Requests are grey rows inside Sales; prices are a property of a product and
 * live in Stock; dispatch, rounds and delivery are parked in `areas/_parked/`, which the glob below
 * cannot see.
 *
 * ═══ AND CUSTOMERS, WHICH THE FOUNDER ASKED FOR BY NAME (FEED-IA §37.6) ════════════════════
 * «CUSTOMERS get the same: their own surface, master-detail, the customer's main sheet as the
 * preview.» So the book of accounts is a seat, and it sits after Stock because that is the order
 * of the work: what went out · what you sell · who you sell it to.
 *
 * ═══ AND CHATS LEFT THE REGISTRY ENTIRELY (FEED-IA §42 — decided) ══════════════════════════
 * «Chats live ONLY in the widget. The Chats tab/area dies, desk and phone.» Two doors to one store
 * is one door too many: the widget is the conversation everywhere now, on both housings. The
 * surface itself is parked in `areas/_parked/`, readable beside the widget that replaced it.
 *
 * ═══ AND SETTINGS LEFT IT TOO — IT BECAME A WORLD (FEED-IA §53) ════════════════════════════
 * «That's an admin thing, right? Your business is a SUPER important card, and it lives where these
 * things typically live.» A settings page was ONE seat holding seven unrelated sections; what §53
 * asks for is an ADMINISTRATION with seats of its own — Tu negocio · Equipo · Geografía ·
 * Operaciones · Tu agente · Conexiones · Ajustes · Plan · Datos — and «administration is its OWN
 * world: they would change the sidebar, and they would have a back button at the top».
 *
 * So this file now describes TWO REGISTRIES rather than one:
 *
 *   THE DESK    `areas/*.tsx`        →  `#/<area>`          Sales · Stock · Customers
 *   THE WORLD   `areas/admin/*.tsx`  →  `#/admin/<seat>`    the nine seats + Cuenta at the foot
 *
 * They share EVERYTHING that is chrome — the same `AreaMeta`, the same posture declaration, the
 * same Frame, the same DayBar, the same glob-and-register discipline — and differ in exactly one
 * thing: which navigation is drawn beside them. That is what «its own world» means structurally,
 * and it is why a third world would cost a registry and a rail rather than a rewrite.
 *
 * FIVE IS THE CEILING ON THE PHONE. Base's bottom navigation is a grid, so a fifth seat is a
 * decision about 78px per word rather than an addition; the row is Sales · Stock · Customers ·
 * Admin, and the fourth is the door into the world (§53's phone shape, and the open call §9 of
 * THE-ADMIN-CANON records).
 */
import type * as React from 'react';

/** The three tabs. Names are English — the review surface's language. */
export type AreaId = 'sales' | 'money' | 'stock' | 'customers';

export type AreaMeta = {
  /** the surface's own word for itself. THE ROUTE IS THE FILE NAME — `App.tsx` reads it off the
   *  path and stamps it here — so this is a label and never a router key, and a package renaming
   *  a surface can land the file before it lands the string. */
  id: string;
  /** the rail's word for it, and the bottom navigation's */
  title: string;
  /* `lead` LIVED HERE AND IS GONE (THE-CONTENT-CANON §9, closed 2026-08-28). It rendered
   * nowhere — `Page` stopped drawing it at §36 and the Frame never read it — so nineteen
   * surfaces carried a sentence no screen painted. Deprecated first so no holder's tsc went
   * red mid-edit; deleted when the last setter was stripped. */
  /** the package that owns this surface — V2-CORE, V2-SALES, V2-STOCK, V2-ADMIN */
  owner: string;
  /** ── THE SURFACE'S POSTURE, DECLARED (FEED-IA §38, and §45.3's flicker) ──────────────────
   * Is this a master-detail surface — two full-height panes, the page itself not scrolling — or
   * one column of work that scrolls?
   *
   * IT IS DECLARED HERE RATHER THAN ASKED FOR AT RUNTIME because posture is a fact about the
   * SURFACE, not a negotiation between it and the frame. The frame used to learn it from an
   * effect the arriving area ran after its first paint, which meant every area switch painted at
   * least one frame in the WRONG posture: `main` went 1100px → 47.000px → 1100px, and the floating
   * conversation flew to the far corner and back, on every single move. That is the founder's
   * «random footer, flickering/flipping modes» (§45.3), caught by rAF-sampling the chrome's boxes
   * across a switch — a box that leaves a value and returns to it is a transient nobody settled on.
   *
   * `usePanes` still exists and still works: a surface that changes posture WITHIN itself (the
   * phone, which is one screen and one scroll) keeps saying so. What it no longer has to do is
   * teach the frame something the app knew before it rendered.
   *
   * ═══ AND THE ADMINISTRATION WING IS EXEMPT — RULED (FEED-IA §87) ══════════════════════════
   * «THE DESK WORKS IN PANES; ADMINISTRATION SEATS are settings surfaces and MAY SCROLL AS ONE
   * COLUMN — the convention every settings surface follows.» Peter's ruling, 2026-08-28, off
   * THE-CUMULATIVE-AUDIT-2's G.
   *
   * Eight seats declare `panes: false` and every one of them used to say so as an APOLOGY — «one
   * column, the page scrolls (panes: false)», a builder writing down that they had departed from
   * §38 and hoping somebody would come back to it. Nobody was going to: they are settings pages,
   * and a settings page that fixes its height and hides its own overflow is a settings page whose
   * last section cannot be reached. §38 was written for the WORK — the river, the sheet, the
   * catalogue, where two panes are the whole point — and it now says so in its own words.
   *
   * SO `panes: false` ON AN ADMIN SEAT IS A CITATION, NOT A CONFESSION. It is the law being
   * obeyed, and the seats say «§87» where they used to explain themselves. A seat that wants
   * panes still declares them: `team` and `geography` do, because they are master-detail
   * surfaces that happen to live in this wing, and the exemption is a permission rather than a
   * rule about where a file sits. */
  panes?: boolean;
  /* ── `lane` IS REPEALED (FEED-IA §83.3) ────────────────────────────────────────────────────
   * A surface used to declare how wide its sheet pane was, so the frame could step the floating
   * conversation left of it. The bubble now stands in the VIEWPORT's own corner at every width and
   * on every surface, so nothing reads that number any more — and the rule it served survives
   * inverted, in each bottom bar's own padding (see `shell/chats.tsx` → LAUNCHER_LANE). */
};

export type AreaModule = {
  default: React.ComponentType;
  meta: AreaMeta;
};

/** The order both navigations draw in, stated once. An area that registers outside this list
 *  still lands, at the end — a navigation that silently drops a built surface is worse than one
 *  with a surprise on it. */
export const RAIL_ORDER: AreaId[] = ['sales', 'money', 'stock', 'customers'];

/** THE NAVIGATION'S OWN WORDS. «Sales · Stock» is the founder's sentence, so the labels belong to
 *  the shell that draws them; an area still carries a `title` and an unknown one is drawn with it.
 *  One word each, and each one names the thing it opens. */
export const AREA_TITLE: Record<AreaId, string> = {
  sales: 'Sales',
  money: 'Money',
  stock: 'Products',
  customers: 'Customers',
};

/** Where the app opens. First run lands here with the cast already in it (THE-APP-V2 §1.2: no
 *  questionnaire, no onboarding flow), and so does every hash the router does not recognise. */
export const HOME: AreaId = 'sales';

/** Is this hash one of the desk's own places? */
export const isAreaId = (id: string): id is AreaId =>
  id === 'sales' || id === 'money' || id === 'stock' || id === 'customers';

/* ═══ THE ADMINISTRATION WORLD (FEED-IA §53 · THE-ADMIN-CANON §2, §7) ═════════════════════════
 *
 * «They would change the sidebar, and they would have a back button at the top.»
 *
 * THE HEAD SEGMENT SELECTS THE WORLD. `#/admin/team` is head `admin`, seat `team`, and everything
 * after the seat is the seat's own tail — the identical «the tail belongs to the area» rule the
 * desk already keeps, one level deeper. A router that had learned the seats by name would have to
 * be edited to add one; this one only has to know the word `admin`.
 */
export const ADMIN = 'admin';

/**
 * THE NINE SEATS, IN CANON ORDER, plus Cuenta at the foot.
 *
 * The order is THE-ADMIN-CANON §2's, which is frequency-of-truth: the card that is the company
 * first, the people who work it second, the ground they cover third, then how the house runs, then
 * what Rocoto is allowed to do, then the rails in and out, then the app's own knobs, then money,
 * then data. `account` is deliberately NOT in this list — it is the PERSONAL scope and its
 * separation from the business scope is the foot placement itself (the Linear/Notion scope law).
 */
export type AdminSeatId =
  | 'business' | 'team' | 'geography' | 'operations' | 'agent'
  | 'connections' | 'units' | 'app-settings' | 'plan' | 'data'
  /** the foot, separated: the PERSON rather than the house */
  | 'account';

export const ADMIN_ORDER: AdminSeatId[] = [
  'business', 'team', 'geography', 'operations', 'agent',
  'connections', 'units', 'app-settings', 'plan', 'data',
];

/** The foot of the admin rail — the personal scope, visually broken off the business seats. */
export const ADMIN_FOOT: AdminSeatId = 'account';

/**
 * THE SEATS' OWN WORDS.
 *
 * ⚠ OPEN CALL, RECORDED (THE-ADMIN-CANON §9). The canon's seat table names these in SPANISH —
 * «Tu negocio · Equipo · Geografía» — because that is what the PRODUCT ships. This build's every
 * other surface is in English («Sales · Stock · Customers», every row in the old Settings), because
 * a design build reviewed with Peter boots English (the standing language rule) and a rail reading
 * `Sales · Stock · Customers · Tu negocio` would be two languages in one navigation.
 *
 * THE DEFAULT TAKEN: English here, the Spanish ship names kept in the canon, and the switch is one
 * edit to this object plus the seat files' own headings. It is written up as an open Peter call
 * rather than decided quietly, which is what §53's «the canon keeps building» asks for.
 */
export const ADMIN_TITLE: Record<AdminSeatId, string> = {
  business: 'Your business',
  team: 'Team',
  geography: 'Geography',
  operations: 'Operations',
  agent: 'Your agent',
  connections: 'Connections',
  units: 'Units',
  'app-settings': 'App settings',
  plan: 'Plan',
  /* PETER'S OWN WORDS, AND THEY WERE ENGLISH ALL ALONG (FEED-IA §60: «it's probably about "your
     data"»). The first build shipped the canon's Spanish rendering of that line and left one seat
     in a different register from its own rail; Peter settled it 2026-08-26 — UNIFORM ENGLISH, and
     the seat is «Your data», which is what he actually said. Spanish arrives at ship time with the
     whole surface, not one seat ahead of it. */
  data: 'Your data',
  account: 'Account',
};

/** Where the world opens on a desk. The company card is the seat §53 leads with — «your business
 *  is a SUPER important card» — so it is the one standing when the rail has not been used yet. */
export const ADMIN_HOME: AdminSeatId = 'business';

/**
 * THE WORD THE RAIL SAYS, which is not always the word the header says.
 *
 * ═══ WHY THERE ARE TWO, AND THE SHOT THAT SETTLED IT ════════════════════════════════════════
 * The first build put `ADMIN_TITLE` straight into the rail and the screenshot came back reading
 * «Your bu… · Geogra… · Operati… · Your ag… · Connec… · App set…». Six of the nine seats were
 * ELLIPSES. A rail whose words you cannot read is worse than a rail of bare marks, because it looks
 * like it is telling you something.
 *
 * TWO CHANGES FIXED IT AND BOTH ARE HONEST. The world's rail is WIDER than the desk's (below) —
 * ten seats with real names have earned twenty-eight pixels — and the seats say their SHORT name
 * here while the header says the full one. «Your business» over the work and «Business» in the
 * navigation is not a drift: it is a heading and a label, which are different jobs, and both of
 * them name the same thing blatantly.
 */
export const ADMIN_RAIL_WORD: Record<AdminSeatId, string> = {
  business: 'Business',
  team: 'Team',
  geography: 'Geography',
  operations: 'Operations',
  agent: 'Agent',
  connections: 'Connections',
  units: 'Units',
  'app-settings': 'Settings',
  plan: 'Plan',
  /* the same words the header says — see ADMIN_TITLE above for why they are English */
  data: 'Your data',
  account: 'Account',
};

/** THE WORLD'S RAIL USED TO BE WIDER THAN THE DESK'S, AND §77.3 COLLAPSED THE TWO NUMBERS.
 *
 *  It was 104 against the desk's 92 for exactly one reason: the word sat UNDER the mark in a
 *  centred column, so a rail had to be as wide as its own longest word and the canon's seat names
 *  are longer than «Sales · Stock · Customers». §77.3 puts the word BESIDE the mark, which hands
 *  every seat in either registry the same 132px box — so one measurement holds both worlds and the
 *  two guesses become one.
 *
 *  IT KEEPS ITS NAME because it is the world's own word for that width, and because a constant
 *  other packages may have read must not silently start meaning something else. `rail.tsx` owns
 *  the pair (`RAIL_COLLAPSED` · `RAIL_EXPANDED`) and `railWidth(open)` is what the frame lays its
 *  grid out with, in both worlds. */
export const ADMIN_RAIL_WIDTH = 208;

export const isAdminSeat = (id: string): id is AdminSeatId =>
  (ADMIN_ORDER as string[]).includes(id) || id === ADMIN_FOOT;

/* ── THE WAY BACK (THE-ADMIN-CANON §7) ────────────────────────────────────────────────────────
 * «A back button at the top.» Back to WHERE is the question the sentence leaves open, and the
 * honest answer is: to the desk you left. So the router records the last desk area the person
 * stood in, and the rail's head walks back to it.
 *
 * IT IS A MODULE SINGLETON AND NOT STORAGE, deliberately. A cold load straight into `#/admin/plan`
 * — a deep link out of the foot menu, a bookmark, a pasted URL — has no «where you left» to
 * remember, and inventing one out of localStorage would send somebody to a surface they were never
 * on. Nothing remembered means the fallback, and the fallback is the app's own home.
 */
let LAST_DESK: AreaId = HOME;

/** Called by the router every time a desk area is standing. */
export const rememberDesk = (id: string): void => {
  if (isAreaId(id)) LAST_DESK = id;
};

/** The hash the admin rail's back door walks to. */
export const deskBack = (): string => `#/${LAST_DESK}`;

/** The word that back door says, so the control names its destination rather than a direction. */
export const deskBackTitle = (): string => AREA_TITLE[LAST_DESK];
