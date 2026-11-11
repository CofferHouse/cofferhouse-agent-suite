# Solana liquidity research: Meteora DLMM

This specializes the existing CofferHouse research pipeline for liquidity provision.
It does not create a separate autonomous fund manager. The user-provided Madcripto
article inspired the workflow; its private filters were neither available nor copied.
The reported four-day result is an unverified example, not a backtest, forecast or
target return for CofferHouse.

## Agent responsibilities

| Stage | Owner | Delivered / required next |
| --- | --- | --- |
| Discover | Scout | A bounded read-only sample from Meteora's public DLMM data API. |
| Screen | Opportunity / liquidity research | User-defined minimum TVL and 24h volume; exclude missing metrics, blacklisted/unknown blacklist state, and unresolved token freeze controls. Passing these checks still requires manual review. |
| Propose | Strategy Lab | Delivered: manual position economics comparing net P&L, holding, costs, minimum required position fees and an adverse principal/fee scenario. Next: position/bin-derived assumptions and bounded allocation. Existing full-range constant-product IL illustrations must not be used as DLMM position forecasts. |
| Observe | Guardian | Next: explicit pool/position baseline, active-bin range, fee accrual, token controls and source freshness, with no automatic action. Existing Morpho watches do not support DLMM positions. |
| Exit / rotate | Action Center | Next: explain the trigger and expected withdrawal assets/costs, require a fresh simulation and explicit approval. Execution is not enabled by this module. |
| Measure | Performance accounting | Next: reconcile deposits, withdrawals, position token quantities, collected and uncollected fees, rewards, transaction costs and a same-assets holding benchmark. |

## Current interface

The Holder Center has a Solana/Meteora liquidity panel and
`GET /api/scout/meteora?minTvlUsd=25000&minVolume24hUsd=10000`.
No API key, wallet or Jupiter configuration is required by this adapter.

The server fetches page one, up to 20 pools, ordered by TVL; filters apply to that
sample. It is not an exhaustive market scan. It validates case-sensitive Solana
pool/mint key syntax and rejects inconsistent or duplicate identities. Source
errors and malformed pages produce UNAVAILABLE, not a fabricated empty result.
Symbols and indexed verification flags do not prove mint authenticity or safety.

The displayed fees are the provider's aggregate 24-hour pool fees, not the user's
share, net return or expected future income. No APR/APY is extrapolated. Fee/TVL
ratios do not specify a DLMM position's participation: active bins, time in range,
competing liquidity and protocol fees matter. TVL is not withdrawal liquidity.
An unavailable measurement cannot pass a filter on that measurement. Matching
pools remain REVIEW_REQUIRED: token mint/program ownership, supply concentration,
volume authenticity and withdrawal behavior are not independently verified here.

Search receipts preserve the filters, sampling scope, outcomes, pool/mint identities
and provider observations. SHA-256 detects content changes relative to the stored
hash; it is not a signature or independent authentication of the API response.

## Accounting and decision gates

The Strategy Lab scenario is a decision model with explicit user assumptions,
not automated yield estimation. For one fixed-horizon position without capital
flows, it checks a target net profit, a same-assets holding benchmark and a maximum
adverse capital-loss limit. The adverse case uses a separately entered principal
value plus a haircut to position-specific fees. Costs are retained in that case;
the assumptions must account for additional costs if a stressed exit is expensive.
It exports its assumptions and calculations in a separate paper receipt.

LPs remain exposed to token prices, including severe loss in speculative pairs.
For a fixed position with no intermediate capital flows, the planned accounting is:

- Net P&L = current principal value + collected fees + uncollected fees + rewards
  - initial capital - costs. Every fee/reward term must be excluded from the
  principal valuation first to avoid counting it twice.
- Holding benchmark = original token quantities valued at the same current prices.
  Separately report the LP principal difference versus holding, and the difference
  after fees and costs. Intermediate deposits/withdrawals require a cash-flow ledger.
- Actual DLMM performance requires position/bin data. The full-range 50/50 formula
  cannot describe arbitrary concentrated ranges or single-sided positions.

Guardian proposals may eventually include review on out-of-range liquidity, stale
data, token-control changes, liquidity deterioration, drawdown limits or fees failing
to cover costs. A triggered rule is a review/exit proposal, not guaranteed protection:
prices can gap, withdrawal simulations can fail, and transfer restrictions can change.
Rotating also incurs swap, network, priority and position-management costs.

Before enabling execution: verify token/program identity, replay real position
events without double-counting fees, run forward paper tests through different
market conditions, compare with holding and cash, test failed/stale withdrawals,
and validate caps, revocation and explicit signing separately.

## Sources

- Official API overview: https://docs.meteora.ag/developer-guides/dlmm/api-reference/overview
- Official pool endpoint schema: https://docs.meteora.ag/api-reference/dlmm/pools/pools
- Source documentation: https://github.com/MeteoraAg/docs/blob/main/developer-guides/dlmm/api-reference/overview.mdx

The production API returned HTTP 403 from the development environment during
implementation. Unit/browser fixtures are based on the documented schema and are
not represented as live pools or financial performance. Deployment checks must
establish whether the production runtime can retrieve live observations.
