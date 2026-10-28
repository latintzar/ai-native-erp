import type { Cast } from '../../scenarios/data/cast';
import { cedarOperator } from './cedar-operator';
import { seedSoles } from './currency';
import { cedarDayFromId, cedarTodayId, relativeTradeDay, relativeTradeText } from './scenario-clock';

/* The scenario library is shared by sibling prototypes and its numbers are legacy EUR fixtures.
 * Cedar reads a stable clone with the same people, products, quantities and margin relationships,
 * while the two monetary leaves are expressed in the workspace's native PEN. */
const CEDAR_CASTS = new WeakMap<Cast, Cast>();
const CEDAR_SOURCES = new WeakMap<Cast, Cast>();

/** The shared fixture behind a Cedar clone, used only to preserve deterministic seed quantities. */
export const cedarSourceCast = (cast: Cast): Cast => CEDAR_SOURCES.get(cast) ?? cast;

export function cedarCast(cast: Cast): Cast {
  const cached = CEDAR_CASTS.get(cast);
  if (cached) return cached;
  const converted: Cast = {
    ...cast,
    owner: cedarOperator(cast.owner),
    team: cast.team.map((person) => (
      person.id === cast.owner.id ? cedarOperator(person) : { ...person }
    )),
    products: cast.products.map((product) => ({
      ...product,
      trace: product.trace?.fecha
        ? { ...product.trace, fecha: relativeTradeDay(product.trace.fecha) }
        : { ...(product.trace ?? {}) },
    })),
    batches: cast.batches.map((batch) => ({
      ...batch,
      cost: seedSoles(batch.cost),
      day: relativeTradeDay(batch.day),
      ...(batch.trace ? {
        trace: batch.trace.fecha
          ? { ...batch.trace, fecha: relativeTradeDay(batch.trace.fecha) }
          : { ...batch.trace },
      } : {}),
    })),
    order: {
      ...cast.order,
      deliveryDay: (() => {
        const today = cedarDayFromId(cedarTodayId());
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `${weekdays[today.getDay()]} ${relativeTradeDay('22.08')}`;
      })(),
      words: cast.order.words.map(value => relativeTradeText(value)),
      utterances: cast.order.utterances.map(row => ({ ...row, text: relativeTradeText(row.text) })),
      lines: cast.order.lines.map((line) => ({ ...line, price: seedSoles(line.price) })),
    },
  };
  CEDAR_CASTS.set(cast, converted);
  CEDAR_CASTS.set(converted, converted);
  CEDAR_SOURCES.set(converted, cast);
  return converted;
}
