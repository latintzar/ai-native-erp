# Third-party notices

Original Rocoto code is released under MIT, copyright Peter Neyra. Existing ownership and licence notices remain in their files. The MIT grant covers that original work; the following materials retain their own terms.

| Material | Licence/provenance | Included notice |
|---|---|---|
| Base Web component forks and scaffolds | Uber Technologies, MIT; fork history is in each component’s `CHANGES.md` | `app/src/rocoto/LICENSE.baseweb.txt` |
| jsQR | Cozmo, MIT; vendored decoder | `app/src/prototypes/cedar/vendor/jsqr-LICENSE.txt` |
| Supabase JS 2.110.8 | Supabase, MIT; vendored browser SDK identifies its exact package in its header | `backend/cr/vendor/supabase-LICENSE.txt` |
| Inter | SIL Open Font License 1.1 | `app/public/inter-OFL.txt` |
| Fraunces | SIL Open Font License 1.1 | `app/public/fonts/fraunces/OFL.txt` |
| Test fonts | Their retained upstream terms | `mock-api/tests/fonts/LICENSES.md` |
| Checked-in map tiles | Produced from OpenStreetMap data (ODbL 1.0), OpenFreeMap/OpenMapTiles style lineage and MapLibre rendering | Attribution in `pin-map.tsx`; source/build details in the retained attribution audit |
| npm/Python dependencies | Each dependency’s own published licence | Lock/requirements files and installed package notices; generated npm notice inventory |

Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Map style/schema credit remains OpenMapTiles; the tile-building source records the rendered source and limits. Google Maps uses its own attribution only when the installation deliberately configures that provider.

Product paintings are project-commissioned Ideogram outputs, normalized for the shared catalogue library. `library/paintings/manifest.json` retains prompt, request/response and file provenance; `normalize.py` and the library tools explain the transformation. They are generated illustrations. This code licence does not claim exclusive rights in machine-generated content or transfer third-party trademarks.

Provider and channel marks identify their services and retain their owners’ trademarks. They are separate from the Rocoto/Atelier product identity. The supplied Meta profile photograph and unrelated reference images are outside this public export; the synthetic Meta walkthrough uses the existing initials Avatar.

The vendored Supabase licence was verified from [the exact upstream release](https://github.com/supabase/supabase-js/blob/v2.110.8/LICENSE) on 28 October 2026. The existing Base Web/jsQR/font texts are preserved with their bytes. `THIRD-PARTY-NOTICES.txt` records the installed npm packages’ available licence/notice texts for built artifacts.
