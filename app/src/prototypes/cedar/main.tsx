/* The English app entry — SAME providers, SAME theme, SAME components as the kit and the scenarios.
 *
 * Everything this entry mounts lives in `app-root.tsx`, because the Spanish entry
 * (`snapshot/main-spanish.tsx`) mounts exactly the same application. An entry is an address and a
 * language, and nothing else.
 */
import { guestPrefix } from "./guest-preview";
import { initializePreviewWorkspace } from "./guest-seed.mjs";

if (guestPrefix()) initializePreviewWorkspace(window.localStorage);
void import('./app-root').then(({mountCedar}) => mountCedar());
