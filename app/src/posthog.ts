/// <reference path="./build-constants.d.ts" />
/** PostHog — product analytics, session replay, feature flags and error tracking for the app.
 *
 * One module, imported once by every browser entry (the kit, app.html, scenarios, the Spanish
 * snapshot). The key and host arrive as build-time constants (`tools/build-constants.mjs`, from
 * `app/.env` locally and the repository variables in CI). Without them the module is inert:
 * nothing is sent and `isPostHogConfigured` is false, so a capture site never has to think
 * about it. Under a compiler that is not Vite the constants are undefined and the same holds.
 *
 * Every event carries `environment`, read off the hostname, so demo, staging and production
 * separate in one project: filter on it before believing a number.
 */
import posthog from 'posthog-js';

const apiKey = typeof __POSTHOG_KEY__ === 'string' ? __POSTHOG_KEY__ : '';
const apiHost = typeof __POSTHOG_HOST__ === 'string' ? __POSTHOG_HOST__ : '';
const devServer = typeof __DEV_SERVER__ === 'boolean' ? __DEV_SERVER__ : false;

export const isPostHogConfigured = Boolean(apiKey && apiHost);

function environment(): 'production' | 'staging' | 'demo' | 'local' | 'other' {
  const host = typeof location === 'undefined' ? '' : location.hostname;
  if (host === 'app.soyrocoto.com') return 'production';
  if (host === 'staging.soyrocoto.com') return 'staging';
  if (host === 'demo.soyrocoto.com') return 'demo';
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  return 'other';
}

if (isPostHogConfigured) {
  posthog.init(apiKey, {
    api_host: apiHost,
    defaults: '2026-05-30',
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
  });
  posthog.register({ environment: environment() });
} else if (devServer) {
  console.warn('PostHog is off: set VITE_POSTHOG_KEY and VITE_POSTHOG_HOST in app/.env to send events.');
}

export { posthog };
