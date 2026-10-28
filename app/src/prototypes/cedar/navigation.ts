/* Browser history belongs to places and deliberate layers. Draft text stays with its owner. */
import * as React from 'react';

export type LayerSnapshot = Record<string, string | number | boolean | null>;
type LayerState = { v: 1; id: string; snapshot: LayerSnapshot; href?: string };
type StoredState = Record<string, unknown> & { rocotoLayers?: LayerState[] };
const layersOf = (): LayerState[] => {
  const value = (window.history.state as StoredState | null)?.rocotoLayers;
  return Array.isArray(value) && value.every((layer) => layer && layer.v === 1 && typeof layer.id === 'string' && typeof layer.snapshot === 'object') ? value : [];
};
const layerFor = (id: string): LayerState | undefined => [...layersOf()].reverse().find((layer) => layer.id === id);

/* A popstate fan-outs to sibling hooks. The parent may restore synchronously before its child has
 * observed the popped stack; without one shared barrier, that child's still-active write effect
 * can immediately push the layer that Back just removed. */
let restoringPop = false;
let restoringPopFrame: number | null = null;
/* ── ONE BACK STEP PER LAYER, NEVER ONE PER RENDER (found by E193.16's third track) ───────────
 * `window.history.back()` is ASYNCHRONOUS: the entry it removes is still on the stack when this
 * effect re-runs, and the effect below re-runs on every render, because `snapshot` is a fresh
 * object literal at nearly every call site. So any render landing between the call and its
 * `popstate` sees `!active && own` a second time and pops AGAIN — and two steps out of a
 * one-layer stack walks off the app's own first entry.
 *
 * ⚠ IT WAS A WHITE SCREEN, and the drive photographed it: reserving the Copilot's grid track made
 * the frame re-render on close, the Copilot's history layer popped twice, and the page landed on
 * `about:blank` with `localStorage` denied. The extra render is legitimate — the layout changed —
 * so the guard belongs here rather than in whatever surface happens to trigger it next.
 *
 * The flag clears on the `popstate` that answers the call, and on the layer standing again, so a
 * step that never lands can never wedge a layer shut. */
const popping = new Set<string>();

const beginPopRestore = () => {
  restoringPop = true;
  if (restoringPopFrame !== null) return;
  restoringPopFrame = window.requestAnimationFrame(() => {
    restoringPop = false;
    restoringPopFrame = null;
  });
};

/** A read layer earns one Back step. A serializable stack keeps its parent active while a child
 * is open. A parent does not restore merely because a child changed: Pop only calls a layer whose
 * own presence changed. That gives Back/Forward the expected thread → list → origin walk. */
export function useHistoryLayer({
  id, active, snapshot = {}, onRestore,
}: {
  id: string;
  active: boolean;
  snapshot?: LayerSnapshot;
  onRestore: (snapshot: LayerSnapshot | null) => void;
}): void {
  const restore = React.useRef(onRestore);
  const restoring = React.useRef(false);
  const present = React.useRef<boolean | null>(null);
  restore.current = onRestore;
  React.useEffect(() => {
    const reconcile = (fromPop: boolean) => {
      const layer = layerFor(id);
      const now = Boolean(layer);
      const all = layersOf();
      const top = all[all.length - 1]?.id;
      /* Hydrate a saved layer once; an ordinary first mount has no history work. */
      if (!fromPop && !now) { present.current = false; return; }
      /* A parent remains present while a child returns. Restore that parent only once it is the
         top surviving layer; while a child is restored it must stay out of the way. */
      if (fromPop && present.current === now && top !== id) return;
      present.current = now;
      restoring.current = true;
      restore.current(layer?.snapshot ?? null);
      window.requestAnimationFrame(() => { restoring.current = false; });
    };
    reconcile(false);
    const onPop = () => {
      popping.delete(id);
      beginPopRestore();
      reconcile(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [id]);
  React.useEffect(() => {
    if (restoringPop || restoring.current) return;
    const layers = layersOf();
    const own = layerFor(id);
    if (active) popping.delete(id);
    if (active && !own) {
      window.history.pushState({ ...(window.history.state ?? {}), rocotoLayers: [...layers, { v: 1, id, snapshot, href: window.location.href }] satisfies LayerState[] }, '', window.location.href);
      present.current = true;
    }
    if (active && own && JSON.stringify(own.snapshot) !== JSON.stringify(snapshot)) {
      // A choice made inside an open layer replaces its saved context; it earns no extra Back step.
      window.history.replaceState(
        { ...(window.history.state ?? {}), rocotoLayers: layers.map((layer) => layer === own ? { ...layer, snapshot } : layer) },
        '',
        window.location.href,
      );
    }
    if (!active && own) {
      if (layers[layers.length - 1]?.id === id && (!own.href || own.href === window.location.href)) {
        /* the step is already in flight; a second one would leave the app (see `popping` above) */
        if (!popping.has(id)) {
          popping.add(id);
          window.history.back();
        }
      } else {
        /* A destination writes a new hash entry before its transient reader closes. That entry
           inherits the reader's state, but must not make a later reopen think the reader is
           already present. Dropping this layer and every child keeps Back/Forward useful without
           navigating away from the destination that was just chosen. */
        const at = layers.findIndex((layer) => layer === own);
        window.history.replaceState(
          { ...(window.history.state ?? {}), rocotoLayers: layers.slice(0, at) },
          '',
          window.location.href,
        );
        present.current = false;
      }
    }
  }, [id, active, snapshot]);
}
