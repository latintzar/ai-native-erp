/* §165's replayable demo is a ledger controller, never a parallel chat fixture.
 * Every visible beat has an explicit `theatre-*` event; only `theatre-arrive` creates a Sale.
 * There are no timers here: the shell decides when to advance, and closing it cannot leave a
 * background sequence running. */
import type { Cast, Customer, Product } from '../../../scenarios/data/cast';
import type { SectorId } from '../../../scenarios/meta';
import { clockAfter, dayForSector, nowOf, setDayForSector, type DayEdits } from '../day';
import type { SaleEvent, TheatreOrigin } from '../sale';

export type TheatreScenario = 'order' | 'question';
export type TheatreOrderBeat = 'received' | 'processing' | 'arrived' | 'changed' | 'amended';
export type TheatreQuestionBeat = 'received' | 'deferred';
export type TheatreBeat = TheatreOrderBeat | TheatreQuestionBeat;

export type TheatreThreadRow = {
  id: string;
  at: string;
  author: 'received' | 'ai';
  text: string;
  saleFormed?: boolean;
  /** Tool provenance stays in the thread projection but is never an outgoing AI bubble. */
  visibility: 'conversation' | 'internal';
};

export type TheatreScene = {
  /** Stable, explicitly tainted object identity. */
  id: string;
  sector: SectorId;
  scenario: TheatreScenario;
  saleId: string;
  /** One native conversation per customer — never a parallel theatre chat. */
  threadId: string;
  customer: Customer;
  product: Product;
  messages: { receive: string; processing: string; change?: string; deferred?: string };
  steps: readonly TheatreBeat[];
};

export type TheatreStepStatus = {
  /** Stable UI/control name. `advanceTheatre` consumes exactly this next step. */
  id: TheatreBeat;
  text: string;
  complete: boolean;
  saleFormed: boolean;
};

export type TheatreStatus = {
  scene: TheatreScene;
  completed: readonly TheatreBeat[];
  next: TheatreBeat | null;
  saleFormed: boolean;
  /** User-facing, evidence-backed progress for deterministic replay controls. */
  steps: readonly TheatreStepStatus[];
};

const PREFIX = 'theatre:';
const ORDER_STEPS = ['received', 'processing', 'arrived', 'changed', 'amended'] as const;
const QUESTION_STEPS = ['received', 'deferred'] as const;

const customerFor = (cast: Cast, scenario: TheatreScenario): Customer => {
  const whatsapp = cast.customers.filter((customer) => customer.channel.toLowerCase() === "whatsapp");
  return whatsapp[scenario === "order" ? 0 : 1] ?? whatsapp[0] ?? cast.customers[scenario === "order" ? 0 : 1] ?? cast.customers[0];
};
const productFor = (cast: Cast, scenario: TheatreScenario): Product =>
  cast.products[scenario === 'order' ? 0 : Math.min(1, cast.products.length - 1)] ?? cast.products[0];

/** The first two conversations for the active house. Product/customer names are always that
 * house’s own seed, even though the journey is deterministic. */
export function theatreScenesOf(cast: Cast): readonly TheatreScene[] {
  return (['order', 'question'] as const).map((scenario) => {
    const customer = customerFor(cast, scenario);
    const product = productFor(cast, scenario);
    const id = `${PREFIX}${cast.sector}:${scenario}`;
    const isOrder = scenario === 'order';
    return {
      id, sector: cast.sector, scenario, saleId: id, threadId: customer.id, customer, product,
      messages: isOrder
        ? { receive: `Could you send 4 ${product.unit} of ${product.name} for tomorrow?`, processing: `Rocoto is reading ${customer.name}’s order.`, change: `Please make that 6 ${product.unit} of ${product.name} instead.` }
        : { receive: `Can you confirm whether ${product.name} is available for tomorrow?`, processing: `Rocoto is checking the question.`, deferred: `Rocoto left this question for the desk.` },
      steps: isOrder ? ORDER_STEPS : QUESTION_STEPS,
    };
  });
}
export const theatreSceneOf = (cast: Cast, scenario: TheatreScenario): TheatreScene => theatreScenesOf(cast).find((scene) => scene.scenario === scenario) as TheatreScene;
const minuteOf = (cast: Cast, scene: TheatreScene, beat: TheatreBeat): string =>
  clockAfter(nowOf(cast), (scene.scenario === 'order' ? 0 : 12) + Math.max(0, scene.steps.indexOf(beat)) * 2);
const originOf = (scene: TheatreScene): TheatreOrigin => ({ id: scene.id, scenario: scene.scenario, tainted: true, source: 'kit-demo' });

const eventsFor = (cast: Cast, scene: TheatreScene, beat: TheatreBeat): SaleEvent[] => {
  const at = minuteOf(cast, scene, beat);
  const theatre = originOf(scene);
  if (beat === 'received') return [{ kind: 'theatre-receive', sale: scene.saleId, at, customer: scene.customer.id, scenario: scene.scenario, text: scene.messages.receive, theatre }];
  if (beat === 'processing') return [{ kind: 'theatre-process', sale: scene.saleId, at, scenario: scene.scenario, text: scene.messages.processing, theatre }];
  if (beat === 'arrived') return [{ kind: 'theatre-arrive', sale: scene.saleId, at, customer: scene.customer.id, offset: 1, take: 1, scenario: 'order', product: scene.product.id, text: scene.messages.receive, theatre }];
  if (beat === 'changed') return [{ kind: 'theatre-message', sale: scene.saleId, at, author: 'received', text: scene.messages.change ?? '', theatre }];
  if (beat === 'amended') return [{ kind: 'theatre-amend', sale: scene.saleId, at, line: 'l1', qty: 6, theatre }];
  return [
    { kind: 'theatre-arrive', sale: scene.saleId, at, customer: scene.customer.id, offset: 1, take: 1, scenario: 'question', product: scene.product.id, text: scene.messages.receive, theatre },
    { kind: 'theatre-message', sale: scene.saleId, at, author: 'ai', text: scene.messages.deferred ?? '', theatre },
  ];
};
const hasBeat = (events: SaleEvent[], scene: TheatreScene, beat: TheatreBeat, at: string): boolean => {
  if (beat === 'received') return events.some((event) => event.kind === 'theatre-receive' && event.sale === scene.saleId);
  if (beat === 'processing') return events.some((event) => event.kind === 'theatre-process' && event.sale === scene.saleId);
  if (beat === 'arrived' || beat === 'deferred') return events.some((event) => event.kind === 'theatre-arrive' && event.sale === scene.saleId);
  if (beat === 'changed') return events.some((event) => event.kind === 'theatre-message' && event.sale === scene.saleId && event.author === 'received');
  return events.some((event) => event.kind === 'theatre-amend' && event.sale === scene.saleId && event.line === 'l1' && event.at === at);
};

const stepText = (scene: TheatreScene, beat: TheatreBeat): string => {
  if (beat === 'received') return scene.messages.receive;
  if (beat === 'processing') return scene.messages.processing;
  if (beat === 'arrived') return 'Order added to Sales.';
  if (beat === 'changed') return scene.messages.change ?? '';
  if (beat === 'amended') return `Order amended to 6 ${scene.product.unit} of ${scene.product.name}.`;
  return scene.messages.deferred ?? '';
};

/** The pre-Sale conversation is still projected from ledger events, so the chat has a real seat
 * before arrival. Its `scene.threadId` is the customer's native thread identity. */
export function theatreThreadOf(edits: DayEdits, scene: TheatreScene): TheatreThreadRow[] {
  return edits.events.flatMap<TheatreThreadRow>((event, index): TheatreThreadRow[] => {
    if (event.sale !== scene.saleId) return [];
    if (event.kind === 'theatre-receive') return [{ id: `${scene.id}:receive`, at: event.at, author: 'received', text: event.text, visibility: 'conversation' }];
    if (event.kind === 'theatre-process') return [{ id: `${scene.id}:process`, at: event.at, author: 'ai', text: event.text, visibility: 'internal' }];
    if (event.kind === 'theatre-message') {
      if (scene.scenario === 'question' && event.author === 'ai') return [];
      return [{ id: `${scene.id}:message:${index}`, at: event.at, author: event.author, text: event.text, saleFormed: true, visibility: event.author === 'received' ? 'conversation' : 'internal' }];
    }
    if (event.kind === 'theatre-arrive') return [{ id: `${scene.id}:arrived`, at: event.at, author: 'ai', text: stepText(scene, scene.scenario === 'order' ? 'arrived' : 'deferred'), saleFormed: true, visibility: 'internal' }];
    return [];
  });
}

export function theatreStatus(cast: Cast, scenario: TheatreScenario, edits: DayEdits = dayForSector(cast.sector)): TheatreStatus {
  const scene = theatreSceneOf(cast, scenario);
  const source = edits.sector === cast.sector ? edits.events : [];
  const completed = scene.steps.filter((beat) => hasBeat(source, scene, beat, minuteOf(cast, scene, beat)));
  const saleFormed = completed.includes('arrived') || completed.includes('deferred');
  return {
    scene,
    completed,
    next: scene.steps.find((beat) => !completed.includes(beat)) ?? null,
    saleFormed,
    steps: scene.steps.map((id) => ({ id, text: stepText(scene, id), complete: completed.includes(id), saleFormed: id === 'arrived' || id === 'deferred' })),
  };
}

/** Advance one named scene exactly one beat. Repeating a press after a render is idempotent. */
export function advanceTheatre(cast: Cast, scenario: TheatreScenario): TheatreStatus {
  const before = theatreStatus(cast, scenario, dayForSector(cast.sector));
  if (!before.next) return before;
  setDayForSector(cast.sector, (previous) => ({ events: [...previous.events, ...eventsFor(cast, before.scene, before.next as TheatreBeat)] }));
  return theatreStatus(cast, scenario, dayForSector(cast.sector));
}
/** Run a named scene through its last beat without timers; useful for a deterministic drive/demo. */
export function runTheatre(cast: Cast, scenario: TheatreScenario): TheatreStatus {
  let status = theatreStatus(cast, scenario, dayForSector(cast.sector));
  while (status.next) status = advanceTheatre(cast, scenario);
  return status;
}
export const runTheatreSequence = (cast: Cast): readonly TheatreStatus[] => (['order', 'question'] as const).map((scenario) => runTheatre(cast, scenario));
/** Remove only this namespaced fixture stream. Drafts, test chats and ordinary day events survive. */
export function resetTheatre(cast: Cast, scenario?: TheatreScenario): void {
  const id = scenario ? theatreSceneOf(cast, scenario).saleId : undefined;
  const prefix = `${PREFIX}${cast.sector}:`;
  setDayForSector(cast.sector, (previous) => ({ events: previous.events.filter((event) =>
    id ? event.sale !== id : !event.sale?.startsWith(prefix)) }));
}
export const theatreTaintOf = (saleId: string): boolean => saleId.startsWith(PREFIX);
