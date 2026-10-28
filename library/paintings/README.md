# Painted product library

`subjects.json` records commissioned subjects; `manifest.json` records generation status,
request IDs and image provenance. `raw/` holds original images, `set/` holds normalized
paintings, and `app/public/paintings/` holds their published copies. The artwork gate checks
source/public parity. These copies and the four `probes/` images are retained source and
review evidence.

Run the maintenance tools from any directory, using their paths in this checkout:

```sh
python3 library/paintings/pipeline.py stats
python3 library/paintings/pipeline.py next 7
python3 library/paintings/reference_gate.py
python3 library/paintings/exam_map.py
python3 library/paintings/build_map.py --output /tmp/painting-map-review.ts
```

The first two commands inspect the manifest. The reference check reads the current app's
catalogue; the resolver exam runs its actual resolver against thirteen names. `build_map.py`
updates the `PAINTINGS` array while preserving the existing file's reviewed resolver and
curated aliases. `--output` writes a review copy; without it the tool updates
`app/src/prototypes/cedar/painting-map.ts`.

For an authorized generation batch, `pipeline.py claim N REQUEST_ID` records submission and
prints its slug order. `pipeline.py record` accepts a JSON object on stdin containing `slugs`,
`job_id`, `response_ids` and optionally `image_urls`; it retrieves the images and records their
provenance. `normalize.py` turns raw images into the normalized set. Review the images and
copy accepted tiles to `app/public/paintings/` before regenerating the map. `build_subjects.py`
rebuilds the subject list from the authored taxonomy; `kinds_ref.py` supports the reference
coverage check.

The session-specific `next.py`/`enqueue.py` handoff and `.last_batch` scratch state were
retired during the file census. The maintained pipeline supplies batch selection and recording
with explicit inputs. The [original library tree](../../docs/omitted-sources.md)
retains those helpers and the final batch snapshot; the manifest retains the lasting job history.
