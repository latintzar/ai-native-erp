# Cedar onboarding

[Founder direction §231–232](../../../../docs/FEED-IA.md#231) · [Money](MONEY-SPEC.md) · [System ACT-01](../../../../docs/THE-SYSTEM-SPEC.md#act-01--onboarding-migration-activation-and-support).

## Essential setup

Subscription payment precedes business setup. A workspace with Money on has two milestones:

1. **Customer messages.** Choose WhatsApp Business, email or phone, then connect the existing provider account or save its business address/number for activation. One saved channel advances directly to banking. Additional channels remain available in Connections.
2. **Bank account.** Use the existing Payments setup to choose the receiving account and complete its consent flow. Completion prepares the workspace, enables pricing, leaves inventory disabled and opens the completion screen. **Open workspace** then opens the prepared Sales workspace.

**A workspace with Money off has one** (FEED-IA §247.9). The bank step mounts Money's own payments
setup, so where Money is off the walk is customer messages and then the finished workspace: the
channel's own **Continue** is the act that prepares the workspace, enables pricing, leaves inventory
disabled and opens the completion screen. `#/onboarding/bank` returns to the channel question in the
address bar as well as in the state, a stored draft standing on the bank step resumes at the question
it can answer, and the Business setup ring counts its one milestone and says so.

Fresh progress opens at customer messages. Each screen makes one choice. Back from channel setup returns to channel selection; Back from banking returns to channel selection. Full-page setup has one contextual Back action; the settings dialog retains its Close action. Reloading preserves the scoped draft. A channel is required before the banking route. Provider setup retains its existing authorization, callback and recovery path.

## Optional continuation

The completed screen links to Business details, Product catalogue and Invoice history. These are useful ways to enrich the workspace and do not gate Sales. An already prepared workspace can open `#/onboarding/catalogue` and `#/onboarding/history` directly. Catalogue and document intake keep their existing review, source identity, custody and retention contracts.

Legacy progress remains readable. Name, address and registration steps resume at customer messages; the former additional-channel and invoicing steps resume at banking, or at customer messages where Money is off; former invoice-discovery steps resume at Invoice history. A previously completed workspace stays complete. A stored `sample` or `prepared` row is a note about a walk this browser took, so it is kept, resumed from and shown — and it completes no milestone. The providers answer that question (§246 · §247.2).

## State and integration

`onboarding-model.ts` owns bounded parsing, legacy step normalization and the provider-led readiness predicate:

- `ONBOARDING_STEPS` is the vocabulary a stored step is validated against, legacy names included; `onboardingWalk(money)` is the sequence — `channel · channel-setup · bank · complete` with Money on, `channel · channel-setup · complete` with it off — and it is the one place that sequence is written. `saveChannel` sends a person to the walk's entry after `channel-setup`, and the legacy bank routes resume there too, so editing the walk moves the product.
- `parseOnboarding(raw, fallback, money)` and `saveChannel(state, connection, money)` take the capability, so the screen, the address bar and the next write read one answer. `money` defaults to `true`, and `cedar-onboarding.tsx` reads `useWorkspaceCapabilities(...).money`, normalizes the stored draft through it once and saves the correction — a step corrected this way is a fixed point of the default reading, so the store and the screen agree.
- `ONBOARDING_CHANNELS` is the set the milestone is measured over: `whatsapp`, `email`, `phone`.
- `connectedChannelsOf({whatsappBound, emailConnected, phoneReady})` folds the three live capabilities — `whatsappCapabilityOf(...).bound`, the mailbox capability's `ready` posture and `phoneCapabilityOf(...).posture === 'ready'` — into one `ConnectedChannels` map.
- `communicationReady(connected)` is true where at least one of those channels is connected right now.
- `connectedChannelCount(connected)` is how many, which is the count onboarding prints above its Continue acts.

[`cedar-onboarding.tsx`](cedar-onboarding.tsx) and [`setup-progress.tsx`](setup-progress.tsx) are the two callers, so the Business setup card and the channel screen give one account one answer. Both read the Money capability as well: the ring's milestones are the bank account where Money is on and the order channel always, so `data-of` is `2` or `1`, `data-bank` stands only where the milestone does, and the card offers the bank door only where the bank step exists. The provider read travels with the milestone — `useBankCapability` lives in `BankMilestone`, which mounts only where Money is on — so a workspace with Money off asks the money API for nothing. `app/tools/test-whatsapp-capability.mjs` pins the fold, and `drives/drive-cedar-onboarding.py` walks Meta's test data and asserts the card still reads `data-done="0"`.

A hash naming a step this workspace cannot stand on returns to the question in the address bar as well as in the state, and the reader **replaces** that history entry rather than pushing one — so Back reaches whatever preceded the link. A step a person takes pushes, because it is a place they came from.

`onboarding-store.ts` persists by workspace scope. Every successful write dispatches `rocoto:cedar-onboarding-changed` with `{scope}` so progress indicators update in the same tab; the hook also listens for browser `storage` events from other tabs.

Business values live in the company/config stores, provider evidence stays in its connection model, and bank state stays in Money. Cedar keeps only the resumable sequence and evidence summary. Provider activation, tax acceptance and external sends retain their runtime authorization boundaries.

## Acceptance

Exercise the customer-message choice, validation, saved and connected provider returns, direct transition to banking, banking completion, Sales defaults, completion links and scoped resume. Verify that deep links cannot bypass the required channel, prepared workspaces can open the optional catalogue/history screens, legacy progress normalizes safely, and same-tab listeners update after a write. Inspect 1600px and 390px layouts, keyboard access and focused setup pages.

With Money off, exercise the one-milestone walk: a connected channel's **Continue** opens the completion screen with the workspace prepared, `#/onboarding/bank` stands on the channel question, a stored bank draft resumes there too, and the ring reads `1 of 1`. `drives/drive-cedar-onboarding.py` walks it at 1600 and 390; `drives/drive-cedar-country.py` walks every other Money door in the same workspace, reads the money-API traffic a Sales desk makes either way, and proves each door returns when Settings → Money is switched on.

## Connected accounts and presentation replay

Channel choices are square cards under **Where do orders arrive?**. Current provider evidence
owns each Connected tick and the connected count. Continue uses an already connected account.
Selecting a channel opens its provider flow directly; each provider owns its address/number fields.

WhatsApp setup reuses the live Meta provider and session. An existing account displays its name
and number, Continue, and Add another. Use test data opens the supplied Meta reference with a
small Test data marker. Completion records `sample` provenance and preserves live authorization.
The same facade serves settings. A fresh replay begins at the first provider screen.

The entrance offers **Set up your business** and **Open workspace** side by side. Its About this
workspace disclosure explains prepared records and selected live accounts. Setup completion opens
the same prepared workspace, preserving the selected real connections and existing commerce data.
