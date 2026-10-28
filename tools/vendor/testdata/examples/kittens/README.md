# Kitten sitting

A development example for two synthetic households, their kittens and their sitting bookings.
Each run owns a separate SQLite database. The adapter uses Python's standard library and the
addresses in the scenario use `example.invalid`.

Run from the company repository root:

```sh
python3 tools/testdata/testdata.py create \
  --manifest tools/testdata/examples/kittens/testdata.json \
  --scenario two-households --environment development \
  --state-root /absolute/private/testdata
```

Use the returned `run_id` with `populate`, `exercise`, `status`, `reset` and `delete`:

```sh
python3 tools/testdata/testdata.py populate \
  --state-root /absolute/private/testdata --run RUN_ID
python3 tools/testdata/testdata.py exercise \
  --state-root /absolute/private/testdata --run RUN_ID
```

`populate` inserts two households, two kittens and two bookings. `exercise` reads each booking
through its household ID and captures one booking confirmation per household in SQLite.
Repeated calls keep those counts stable. `reset` restores the scenario and clears captured
confirmations. `delete` removes this run's database; the shared runner retains its receipt.

The database records its run ID and verifies ownership before reuse or deletion. It uses composite
foreign keys to keep each booking's kitten in the same household.
The lifecycle tests verify that another household's booking lookup returns an empty result,
that a booking referencing another household's kitten fails, and that resetting or deleting one
run preserves a second run. This example demonstrates local data and query isolation. Real
login, network authorization and provider integrations belong to a product adapter's own tests.
