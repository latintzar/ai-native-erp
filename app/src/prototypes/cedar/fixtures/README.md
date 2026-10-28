# Cedar money sample data

[money-v1.json](money-v1.json) is the retained synthetic scenario for Cedar’s three sample houses.
It declares each workspace’s opening balance, native currency rate and reference clock, then invoice
seeds associated with existing Sales and customer identities. Source sale quantities and prices
come from `buildSales`; [money-seed.ts](../money-seed.ts) creates the invoice and receipt history.
[money-projections.ts](../money-projections.ts) derives the dashboard from that same state.

The browser imports this exact scenario JSON. The shared lifecycle captures the same collections
in a private run, and its Cedar wrapper checks workspace ownership, unique identities, dates,
amounts and exact populated collection parity. The source-identity test checks every seed against
the actual Sales builder. The lifecycle exercises sample data; browser loading and provider
integration have their own drives and acceptance evidence.

From the repository root:

```bash
python3 tools/vendor/testdata/testdata.py plan --manifest testdata-cedar.json --scenario cedar-money-v1 --environment development
python3 tools/vendor/testdata/testdata.py create --state-root /absolute/private/cedar-testdata --manifest testdata-cedar.json --scenario cedar-money-v1 --environment development
python3 tools/vendor/testdata/testdata.py populate --state-root /absolute/private/cedar-testdata --run <run-id>
python3 tools/vendor/testdata/testdata.py exercise --state-root /absolute/private/cedar-testdata --run <run-id>
python3 tools/vendor/testdata/testdata.py status --state-root /absolute/private/cedar-testdata --run <run-id>
python3 tools/vendor/testdata/testdata.py reset --state-root /absolute/private/cedar-testdata --run <run-id>
python3 tools/vendor/testdata/testdata.py delete --state-root /absolute/private/cedar-testdata --run <run-id>
node app/tools/test-money-seed.mjs
node app/tools/test-money-history.mjs
node app/tools/test-sample-bank.mjs
```

Choose an absolute private state directory outside Git and use it for every operation. Use the run identifier returned by `create`. The shared command retains the scenario and declared
source with hashes; start a fresh run after editing them. `status` and `delete` use the retained
recovery bundle. The root-owned [manifest](../../../../../testdata-cedar.json) retains the Cedar
wrapper, shared fixture adapter, application source graph, package files and seed-test helpers.
The wrapper keeps the shared adapter’s protocol and resource-ownership checks. Effects are captured
in the private fixture file; the lifecycle leaves browser sessions and external providers to their
separately authorized consumers.

## Ninety-day sales and receipts

The source reference is 22 August 2025; `scenario-clock.ts` resolves its offsets onto the current
Peru day. The retained 24 orders keep their identities, and `history` adds 96 calendar days of
Sales. Its weekday counts are 2 Sunday, 14 Monday, 10 Tuesday/Wednesday, 12 Thursday, 16 Friday and
8 Saturday. Each row uses the house's customer, product, quantity and price builders. Money takes
each sale's integer PEN total once.

Customer identity assigns a stable payment method: approximately half Yape, a quarter Plin, a
fifth transfer and the remainder cash. Most invoices settle within six days; about ten percent
remain half paid and ten percent stand five to thirty days overdue. Two disputed sales keep their
full balance. Three aged invoices carry reminder rungs one, two and three, with the third flagged
for a call; the customer's channel supplies the reminder medium.

The Money projection retains ninety daily buckets and displays the final fourteen. The dossier's
Movements section uses the same ninety days, including each day's closing balance. An account
starts with S/ 5,000 plus every matched bank receipt through its clock. Cash settles its invoice
in the cash ledger. The runtime's schema-2 artifact contains seven weekday variants, generated
from this exact Sales and Money source. Its drift test reproduces every weekday in a later week.
New runtime payments advance the account once; seed-opening receipts imported with a request are
deduplicated by their document reference.

Pristine saved Money and reminder books advance together on the next Peru day and migrate from
the earlier 24-order fixture. Authored receipts, request actions and reminders retain their book
and timestamps. Both bank reads carry that book's `fixture_day`, keeping the runtime's seed on the
same calendar after midnight. Authored revision-1 books read the pinned predecessor's seven
weekday ledgers until their next explicit reset; `fixture_revision` selects the matching arithmetic.
The generator verifies the predecessor source tree and freezes its collections digest. Rebuild that
compatibility fixture with `--write --legacy-source /absolute/clean/predecessor-checkout`. Reset follows the shared scope inventory and recreates both books.

Cedar's cast adapter converts inherited shared-cast monetary leaves once at the retained EUR 1 =
PEN 3.90 scenario rate. Money consumes those PEN Sales totals with `fxRate: 1`. Earlier stored EUR
invoices keep their recorded source and frozen conversion.

[Onboarding addresses](onboarding-v1.json) add explicit Peru demo addresses to those same house scopes. Onboarding invoice-discovery cards derive from the retained invoice and supplier-batch identities. Resetting the selected demo house resets its Money, financing, wizard, Meta-preview and capability state; other house scopes retain their own records. Opening a completed demo preserves existing financial records and reopening the walkthrough resets its draft only.
