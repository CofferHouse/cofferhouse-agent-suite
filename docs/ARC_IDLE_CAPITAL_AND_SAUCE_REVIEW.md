# Arc articles: idle capital and programmable settlement

Reviewed 2026-11-21. This is a CofferHouse engineering assessment, not a partnership,
provider audit, deposit recommendation or claim of deployed SDK execution.

## What was accessible

- [GetLiquid / idle capital](https://community.arc.io/public/blogs/guest-post-idle-capital-is-a-private-credit-problem-heres-how-we-put-it-to-work-on-arc-2026-11-19):
  the public page describes variable yield on idle USDC between private-credit
  deals through Earn Kit. The displayed publication date is November 20, despite
  November 19 in the slug. The full body was not exposed in the retrieved page.
  We did not validate GetLiquid's contracts, rates, lending terms or solvency.
- [Arc x Eco replay](https://community.arc.io/public/videos/event-replay-arc-x-eco-programmable-money-with-sauce-sdk-2026-11-19):
  the public summary covers payments, treasury and agent examples using Sauce.
  The transcript/video content was not exposed; this is not a transcript review.
- Implementation decisions below are independently informed by Eco's official
  [SDK documentation](https://docs.eco.com/platform/sauce-sdk),
  [chain/fee reference](https://docs.eco.com/sauce-sdk/cli/chains-and-endpoints),
  [deployments](https://docs.eco.com/sauce-sdk/reference/deployments), and
  [launch article](https://eco.com/blog/eco-sauce-sdk/).

## Fit within CofferHouse

| Source idea | Application | Status |
| --- | --- | --- |
| Idle USDC between commitments | First protect operating reserves, earmarked cash and obligations; model only the remainder. | Implemented in `planIdleUsdc`. |
| Variable yield is not the whole result | Subtract entered entry/exit costs and withdrawal lead time, then apply a minimum net scenario margin. | Implemented; caller assumptions, not a forecast. |
| Redeemability matters | Limit modeled allocation by entered liquidity share; keep withdrawal uncertainty explicit. | Implemented; no withdrawal guarantee. |
| Live transaction conditions | A future Sauce program should enforce recipient, spend ceiling, minimum output, balance and deadline checks at execution. | Design adopted; SDK integration deferred. |
| Transaction-level rollback | Separate source funding, destination execution, proof, settlement and refunds for cross-chain flows. | Required for future executor; no end-to-end atomicity claim. |

This extends existing Earn strategy research rather than adding a second source
of yield or combining Earn and Morpho exposure. No new GetLiquid pool is listed.
4mica guarantees awaiting settlement must count as obligations even before an
on-chain debit. This planner does not read or reserve the durable budget ledger.

## Implemented usage

```js
import { planIdleUsdc, buildEarnStrategy } from '../packages/agent-modules/index.js';

const assumptions = {
  walletUsdc: '10000', reserveUsdc: '2000', committedUsdc: '3000',
  earmarkedUsdc: '1000', maxAllocationUsdc: '8000',
  vaultAvailableLiquidityUsdc: '50000', maxLiquidityShareBps: 1000,
  entryCostUsdc: '0.5', exitCostUsdc: '0.5', minimumNetScenarioUsdc: '1',
  holdingHours: 240, withdrawalLeadHours: 24,
  scenarioAnnualSimpleRateBps: 500,
  observedAt: new Date().toISOString(),
  withdrawalTermsReviewed: true, paused: false,
};
const scenario = planIdleUsdc(assumptions);
// Optional developer integration; ordinary dashboard allocations are unchanged.
const proposal = buildEarnStrategy(earnAnalysis, strategyPreferences, {
  idleCapitalInput: assumptions,
});
```

The example is synthetic and its rate/cost inputs are not live quotes. Replace
`earnAnalysis` with the existing Earn discovery analysis and use a strategy
capital equal to the entered USDC wallet balance. Monetary inputs are decimal
strings with at most six fractional places. All reserve/commitment/earmarked
categories must be disjoint; do not count the same obligation twice. Balance
means available wallet USDC, not already-invested vault shares or unclaimed fees.

Calculations use integer micro-units:

1. Protected cash = reserve + commitments + earmarked cash.
2. Available cash = max(wallet cash - protected cash, 0).
3. Modeled amount = min(available cash, allocation cap, liquidity × share cap).
4. Earning hours = max(holding hours - withdrawal lead hours, 0).
5. Gross sensitivity = amount × entered annual simple rate × earning hours / 8760.
6. Net scenario = gross sensitivity - entered entry cost - entered exit cost.

The simple-rate sensitivity is **not** an APY conversion or projected profit.
There is no compounding assumption or automatic use of a displayed APY. The model
omits depeg, credit losses, capital losses and changing rates. Costs must include
gas, protocol/Kitchen fees, conversions, bridges where relevant, and a reasonable
allowance for failed attempts; none is assumed to be free.

Data older than five minutes, future/missing observations, unreviewed withdrawal
terms, insufficient time, missing costs, zero liquidity or obligations above
cash lead to `KEEP_LIQUID`, with zero reviewable allocation. Even a passing result
is only `REVIEW_REQUIRED`, not an instruction to invest. Withdrawal lead time is
an entered planning buffer, not a provider guarantee; a positive one is mandatory.

The optional Earn integration also checks Earn observation freshness, accepts
USDC candidates only, applies existing diversification/vault caps, rounds down to
cents for the existing allocator, and rechecks costs after the actual modeled
allocation is smaller. If that smaller position no longer clears the margin, no
position is proposed. Its idle-capital assumptions and result are included in
`createEarnStrategyReceipt`, so changing them invalidates the integrity seal.
A valid seal does not authenticate entered data or operator authority.

Strategy Lab now includes a separate manual USDC scenario form. It starts blank;
an optional synthetic example is visibly marked and does not pre-check withdrawal
review. All monetary values remain decimal strings. Percent inputs convert to
integer basis points without floating point. The manual form does not fetch
wallet balances or allocate into Earn vaults; the developer opt-in Earn allocation
integration above remains separate.

Results distinguish protected cash, cash after commitments, the amount modeled
before checks and the amount available for manual review. Every field or checkbox
change removes the previous result and download until recalculation. Clearing the
form also removes results. Figures remain in memory for the current page session
and are not persisted in browser storage. EN/zh/ja/hi/es labels and reason messages
are included; numeric values and exported evidence are never translated.

A new supported `cofferhouse.treasury.idle-capital-receipt.v1` download includes
the assumptions, scenario, timestamp and an explicit synthetic/user-entered source.
Its integrity seal detects edits but does not verify the entered figures.
No network call, wallet prompt, permission or transfer is added.
Run `node --test test/idle-capital.test.js test/idle-capital-view.test.js test/arc-app-kits.test.js`.
Browser acceptance checks exercise calculation, blocked scenarios, download
invalidation, language changes, receipt verification and mobile layout.

## Sauce integration boundary

Eco documents transaction building/sending on Ethereum, Base, Arc and Solana,
plus their listed testnets. Robinhood is not listed among those supported send
chains in the reviewed reference; do not silently enable it from a registry
entry. Product coverage differs between Sauce and Routes. Verify deployment
bytecode, chain, tokens, protocol bindings and current fees before any integration.

A same-chain Sauce execution rolls back its own changes on an unhandled failure.
Earlier approvals/funding transactions do not roll back with it. Cross-chain
funding, destination fulfillment, proofs and refunds are separate lifecycle steps.
Reverted execution can still cost gas. Programs do not schedule themselves, and
simulation success does not ensure state is unchanged when execution occurs.

A future sandbox adapter should pin a reviewed SDK/compiler release and verify
its license before copying code; compile and simulate without a signer; compare
source/bytecode; then bind any operator-approved policy to chain, token addresses,
recipient, amount, minimum received, fee ceiling and deadline. Apply those checks
inside the transaction as well as in the planner. Persist cross-chain progress
and reconcile failures before retrying or releasing budget. Never give a research
agent access to wallet keys just to compile a program.

The testnet registries do not necessarily contain mainnet DEX/lending protocols:
Eco explicitly documents no DEX, lending market or oracle entries for the listed
EVM testnets. Do not fabricate an Arc Testnet lending deployment for a demo.

No Eco/GetLiquid source code, contracts or SDK dependencies were copied in this
release. The planning code is original CofferHouse code informed by these ideas.


## Earn liquidity source import (2026-11-23)

The Strategy Lab form can now select a reported active USDC vault from the Earn
response already loaded by the application, or explicitly refresh that existing
read-only endpoint. Importing a source copies only its human-readable USDC
liquidity string. It does not fetch a wallet balance, copy APY into the simple
rate, set costs, review withdrawal terms or allocate funds. Choosing a different
source invalidates the previous result; importing it resets withdrawal review.
Imported liquidity is read-only until the user explicitly switches to manual
estimates. A pending selection must be imported or cleared before calculation.

The source uses SDK asset amounts, not the legacy floating-point USD display
field. The installed `@circle-fin/earn-kit` 1.9.0 type declarations describe
`EarnVaultInfo.liquidity` and `EarnLiquidityProfile.available` as human-readable
decimal strings. Normalization now retains an exact asset-amount string and the
explicit response timestamp. Missing/blank/boolean metrics remain unknown instead
of becoming numeric zero. No new SDK dependency or copied SDK code is introduced.

Only canonical positive USDC amounts with up to six decimals, nonzero unique EVM
vault addresses, active status and the Arc read-only source contract are accepted.
EURC, inactive vaults, duplicate identities, missing source timestamps and numeric
liquidity values without the original decimal string are excluded. Existing Earn
opportunity ranking/filters remain separate; source import is not an endorsement
or a declaration that those investment filters passed.

An explicit Earn response timestamp must be no more than five minutes old and
not in the future. A provider liquidity timestamp is checked if actually present;
no provider time is fabricated from the APY date or the retrieval time. A recent
API response alone cannot prove the underlying liquidity is fresh, liquid or
redeemable. Its freshness remains unverified even after the source matches.
The server's cache can return the same snapshot until refreshed or expired.

`planIdleUsdcWithEarn` binds the reported amount, vault, chain, asset, response
time and available provider metadata to the latest available report. A changed,
stale or unavailable source, or an overridden liquidity field, forces zero
reviewable allocation. Updating the manual scenario time does not refresh source
evidence. Response refresh/reconciliation clears old results and downloads.
Sources stay in memory only; clearing the form or loading the synthetic example
removes the imported source. Wallet, cash, simple rate, costs and timing stay
explicit caller assumptions.

The existing scenario receipt now embeds `marketSource` and `sourceReview` and
uses `EARN_LIQUIDITY_WITH_USER_ASSUMPTIONS` or
`EARN_LIQUIDITY_WITH_EDITABLE_SYNTHETIC_CASH` provenance. The latter keeps sample
cash distinct from the provider-reported amount. The source schema is embedded
metadata, not a standalone registered evidence receipt. The integrity seal covers
source fields, but does not authenticate the provider, token backing or funds.

Tests include exact amounts beyond floating-point precision, stale/missing/future
timestamps, missing provider times, changed sources, overridden amounts,
non-USDC/inactive/duplicate identities, rate independence, receipt tampering and
refresh invalidation. Browser acceptance also covers import, source refresh and
failure, explicit manual detachment and source controls in all five languages.
