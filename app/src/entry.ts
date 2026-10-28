import { routeDirectCallback } from './prototypes/bodega-pay-later/direct-callback';

// app.html also publishes as the development root. Scrub its callback before Cedar or analytics.
const callback = routeDirectCallback(window.location.search, {
  clean: () => window.history.replaceState(null, '', '/'),
  replace: (path) => window.location.replace(path),
  request: (path, options) => fetch(path, options),
});
if (!callback) void import('./prototypes/cedar/main');
