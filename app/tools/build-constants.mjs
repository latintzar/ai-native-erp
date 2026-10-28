/** Build-time constants for the app, substituted by Vite's `define` in both build paths
 *  (`vite.config.ts` and `tools/build-english-app.mjs`).
 *
 *  They exist so that `src/` never reads `import.meta.env`: the tool tests compile app modules
 *  for Node with `--module commonjs`, where `import.meta` is a compile error, and a module that
 *  most of the app imports (the PostHog client) cannot be the one that breaks that compile.
 *  Under any compiler but Vite the constants are simply undefined, and the reader says so.
 *
 *  Values come from `app/.env` (the VITE_ names in `app/.env.example`) or the environment — the
 *  repository variables in CI. A build without them makes the PostHog client inert. */
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const APP_ROOT = fileURLToPath(new URL('../', import.meta.url));

export function buildConstants({ mode, command }) {
  const env = loadEnv(mode, APP_ROOT, 'VITE_');
  return {
    __SUPPORT_WIDGET_URL__: JSON.stringify(env.VITE_SUPPORT_WIDGET_URL ?? ''),
    __POSTHOG_KEY__: JSON.stringify(env.VITE_POSTHOG_KEY ?? ''),
    __POSTHOG_HOST__: JSON.stringify(env.VITE_POSTHOG_HOST ?? ''),
    // The map ground's key. A Maps browser key is public by design — it travels in the page — so
    // its fence is on the account: referrer restriction, API restriction and a daily quota cap.
    // A build without it draws the checked-in tiles, which is also what every proof runs on.
    __GOOGLE_MAPS_KEY__: JSON.stringify(env.VITE_GOOGLE_MAPS_KEY ?? ''),
    __DEV_SERVER__: JSON.stringify(command === 'serve'),
    // Only the development server may receive a separate runtime base. Published builds stay
    // same-origin, and `make dev` names the loopback runtime it started itself.
    __RUNTIME_BASE__: JSON.stringify(command === 'serve' ? (env.VITE_ROCOTO_RUNTIME_BASE ?? '') : ''),
  };
}
