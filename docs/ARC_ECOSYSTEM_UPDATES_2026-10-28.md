# Arc ecosystem updates — 28 October 2026

This note translates four Arc House publications into CofferHouse implementation
requirements. It records research and proposed work, not newly enabled features.
No SDK update, investment, grant application, outreach or partnership is implied.

## Evidence available

The supplied `/home/` links were not readable through public retrieval. Public
article shells and Arc House's public content index supplied titles, dates and
summaries. The complete Grants FAQ body, Morpho article body, Gateway video
transcript and UAE article body were not retrieved. Detailed conclusions below
are therefore corroborated by Circle's live Grants/Gateway pages and Morpho's
official technical documentation, rather than attributed to unseen passages.

## 1. Morpho: show where a deposit goes

The 27 October article describes vaults routing deposits across lending markets.
Morpho's official role and liquidity references distinguish curator risk decisions
from allocator operations, and distinguish Vault V1 queues from Vault V2 adapters.
Do not apply one version's permissions or liquidity assumptions to the other.

### CofferHouse implementation requirements

- Extend Earn research with a version-aware vault exposure view: chain, vault
  address, underlying asset, owner/curator/allocator identities, enabled markets or
  adapters, allocated balances, collateral and oracle identities where available.
- Collect observations at one block where supported, with provider, observation
  time and block recorded. Missing roles or exposure data remain unknown, not zero.
- Report idle assets, withdrawal capacity and allocation concentration separately
  from total deposits and observed APY. Avoid counting a vault and its underlying
  markets twice in Strategy research.
- Guardian research should compare later role, exposure, cap and liquidity evidence
  with the approved baseline. CofferHouse's Guardian agent is not automatically a
  Morpho onchain Guardian or Sentinel and receives no such permissions here.
- Identify V2 cap drift: caps constrain allocation operations, while withdrawals
  elsewhere or accrued interest may change exposure ratios afterward. Lowering a
  cap does not itself withdraw an existing position.

Acceptance: fixtures for V1/V2 and missing evidence; reproducible exposure totals;
tests for duplicated underlying positions and liquidity deterioration; a read-only
live capture before integration is described as operational. No deposit action is
part of this work. Current Earn discovery does not establish this look-through view.

Sources:
- https://community.arc.io/home/clubs/trading-and-defi/blogs/morpho-where-does-your-lending-deposit-go-2026-10-27
- https://docs.morpho.org/curate/concepts/roles/
- https://docs.morpho.org/curate/concepts/liquidity/

## 2. Gateway: prepare multi-asset funding research

The 28 October video summary announces EURC and cirBTC support through Gateway
and points to Unified Balance Kit. Circle's Gateway product page corroborates
USDC, EURC and cirBTC support. This does not prove support for every route or for
the versions of SDK packages currently installed in CofferHouse.

### CofferHouse implementation requirements

- Prepare a separate Gateway capability adapter; retain the current CCTP observer
  as a CCTP observer. Gateway balances and CCTP transfer observations are different
  evidence types.
- Discover supported asset/chain pairs before presenting a route. Verify deployed
  token/contracts, decimals, SDK support, source finality, destination availability,
  minimums, fees and quote expiry from current official references and live data.
- Keep asset ledgers separate. A unified balance is per asset; it does not convert
  EURC or cirBTC to USDC. Do not add token units or assume equivalent USD value.
- Do not expand treasury asset permissions merely because Gateway supports a
  token. cirBTC introduces BTC price exposure; EURC introduces EUR/USD exposure
  when measured against a USD budget. Valuation needs its own timestamped source.
- Prototype read-only balances and route readiness first. A future funding action
  needs explicit wallet authorization, fresh evidence and result reconciliation.

Acceptance: unsupported routes fail visibly; missing decimals or prices remain
unknown; USDC/EURC/cirBTC balances cannot be summed as raw amounts; no balance,
transfer, exchange or new treasury asset is presented as active before validation.
Do not hardcode promotional fee waivers or sub-second end-to-end delivery promises.

Sources:
- https://community.arc.io/home/videos/gateway-now-supports-eurc-and-cirbtc-2026-10-28
- https://www.circle.com/gateway

## 3. Circle Developer Grants: prepare an evidence-based proposal

The 26 October FAQ summary covers eligibility, integration requirements, Questbook,
review, funding and milestone payments. Circle's current Grants page confirms a
milestone-based process, an application link to Questbook and technical review.
No particular award amount, acceptance probability or review deadline is assumed.

Proposed CofferHouse milestone sequence, not a funding agreement:

1. Reproducible Morpho exposure research, with version-specific fixtures and a live
   read-only evidence capture.
2. Gateway route/balance discovery with separate asset accounting and documented
   SDK/chain compatibility.
3. End-to-end holder pilot and external review of any later execution boundary.

Prepare a dossier with repository links, exact shipped/pending capabilities,
architecture, working demo, evidence receipts, technical ownership, budget and
measurable deliverables. Track pilot participants and successful research sessions
only when observed; do not invent adoption or onchain volume. Check current
eligibility, screening and personal-data requirements before any submission.
Preparing this note does not submit an application or accept grant conditions.

Sources:
- https://community.arc.io/home/resources/circle-developer-grants-questions-and-answers
- https://www.circle.com/grant

## 4. Arc UAE chapter: demos and feedback

The 26 October public announcement summary names Alex Radu and describes local
meetups, builder demos and collaboration. Treat this as a community opportunity,
not a technical dependency, endorsement, partnership or new market authorization.

Prepare a short English demo of Scout -> Strategy -> Guardian, with actual product
boundaries visible, and a feedback questionnaire about clarity, risk evidence and
desired funding flows. Research relevant public events when outreach is requested.
No message, membership request, application or personal information is sent here.

Sources:
- https://community.arc.io/home/clubs/uae/blogs/introducing-the-arc-uae-chapter-2026-10-26
- https://community.arc.io/public/clubs/uae

## Implementation order

First add Morpho exposure research to Opportunity/Guardian. Next prototype Gateway
read-only readiness. Prepare the Grants dossier alongside validated milestones;
use chapter demos for feedback once the demonstrable flow is ready. Funding and
community opportunities do not block the core technical work.

Existing wallet-session PR #15 is separate and remains unmerged at this review.
No deployment, new wallet permission or production transaction is included here.
