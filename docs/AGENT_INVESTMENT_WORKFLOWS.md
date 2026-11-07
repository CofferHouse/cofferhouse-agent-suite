# Investment research workflows and agent responsibilities

Research reviewed 7 November 2026. This is a product specification, not a release
of new investment or payment capabilities. User goal: help people make better
capital-allocation decisions across crypto and tokenized equities, with explicit
costs, monitoring and user-defined boundaries. Profitability is an outcome to
measure, not a product guarantee. Avoid presenting a research score as a probability
of profit or safety.

## Evidence and product hypotheses

The sources below describe known frictions. They do not establish that no competing
product solves them or that users will pay for CofferHouse. Validate the proposed
workflows with user tests and compare against existing tools.

- Morpho: vault liquidity, role changes, adapter exposure and withdrawal restrictions
  matter beyond displayed APY. A high yield does not establish an available exit.
- Uniswap: concentrated LP positions stop earning fees outside their range. The
  position value and fee income must be compared against holding the same assets.
- Alpaca: paper trading does not model all real execution costs and frictions.
  A successful simulation is not evidence that a strategy is profitable live.
- xStocks: the issuer/partner product terms, underlying trading session, secondary
  liquidity, dividend adjustments and chain representation affect interpretation.
  Do not equate a tokenized instrument with direct shareholder rights.
- Circle's upcoming agentic-payments event discusses discovering APIs, paying for
  requests with USDC, and using results, including wallet and spending controls.
  It is an announced session, not evidence that CofferHouse has integrated payments.

## Split responsibilities without duplicating agents

| Owner | Responsibility | Required output / gate |
| --- | --- | --- |
| Scout | Discover authenticated asset identities and observable venue conditions across supported networks. | Source, chain, protocol, address/market, timestamps, coverage and unknown data. Never qualify an asset by ticker alone. |
| Opportunity | Apply user limits and compare suitable lending, LP or spot candidates within each strategy class. | Explain exclusions, liquidity and quality limits. No universal APY ranking across incomparable risks. |
| Strategy Lab | Compare scenarios, horizons, reserves, exposures and switching costs. | Net modeled outcomes, downside cases, assumptions, benchmark and reason to act or wait. |
| Performance accounting (new module) | Reconcile cash flows, positions, costs and benchmark history. | Realized/unrealized P&L, income, fees, funding and data costs. Keep deposits distinct from returns. |
| DEX Research | Evaluate routes and LP positions using actual pool/position parameters. | Depth, executable-size evidence, range status, fee income and comparison with holding. |
| Trading research (new module) | Evaluate DCA, rule-based rebalancing and explicit trading rules. | Historical and forward paper results with costs, drawdown and out-of-sample checks. No autonomous leverage in the initial scope. |
| Tokenized-equity research (new module) | Validate issuer, product terms, eligibility, reference equity and market session. | Token/reference price basis, quote freshness, issuance/redemption constraints and corporate-action adjustments. |
| Guardian | Monitor selected positions or research targets and distinguish incidents from source failure. | Threshold breaches, stale evidence, changes in permissions or exit liquidity. A watch is not proof of a funded position. |
| Action Center / Automation | Separate investment intent from approval, policy enforcement and execution. | Exact allowlists, spending limits, expiry, revocation, verified transaction outcomes and bounded human authorization. |
| Research procurement (new module) | Request data only when a defined evidence gap justifies a paid service. | Cost quote, approval/budget check, payment reconciliation and usable-data validation. Cannot authorize an investment. |
| Agent Hub | Coordinate handoffs and propose one justified next step. | Research, wait, refresh evidence or seek approval; abstention is a valid result. |

These new modules are planned; they are not additional live agents yet. Reuse the
existing Scout/Opportunity/Strategy/Guardian structure before expanding navigation.

## User policy

Ask for budget, existing assets/positions, selected networks, investment horizon,
withdrawal needs, acceptable drawdown, concentration limits and permitted strategy
types. Separately request leverage permission, data-spending budget and jurisdiction
where a product needs eligibility checks. Do not infer risk appetite from wallet
wealth. A stablecoin-only request must not become an equity, LP or leveraged trade.

An understandable initial instruction could be: research USDC lending on selected
networks, keep a specified reserve and minimum exit liquidity, and alert when the
selected limits cease to hold. Notifications must go to the subscribing user.

## What each investment workflow must solve

1. Lending: separate base yield from temporary incentives, monitor withdrawals and
   utilization, inspect collateral/oracle/curator concentration and pending changes.
2. Liquidity: explain fees in token units and reporting currency; measure time in
   range, inventory changes, costs of rebalancing and divergence from holding.
   Never count an APR snapshot as realized profit.
3. Trading: start with transparent DCA and rebalancing rules. Backtests need point-in-
   time data, fees, slippage, an untouched test interval and parameter-selection
   disclosure. Paper trading must not assume every signal fills at the shown price.
4. Funding/carry: defer until reliable spot/perp pricing, changing funding, financing,
   margin, liquidation and counterparty exposure can all be modeled. “Delta neutral”
   does not mean loss-free.
5. Tokenized equities: monitor the reference and token separately. Closed underlying
   markets can make a price comparison stale. Adjust for splits, dividends/rebasing,
   wrappers, currency and units before labeling a premium an opportunity. Review
   product-specific access/redemption rights rather than assuming arbitrage is
   available to the user.
6. Portfolio: consolidate exposure to the same asset, issuer, curator, oracle and
   protocol across chains; cross-chain balances are not independent diversification.

## Net-return and benchmark rules

Report both investment-currency and USD results. Keep historical realized results,
unrealized changes, scenario estimates and annualized snapshots separate.

Value paid for data belongs in the cost ledger even when a trade is never placed.
Include entry/exit fees, gas, bridge costs, spread, slippage, borrowing/funding and
management/performance fees where applicable; avoid subtracting costs twice when
the source already reports a net rate. Unknown material costs block a confident
net-return claim. Tax results require separate jurisdiction-specific inputs.

Illustration, not a forecast: moving 1,000 USD from 8% to 10% annual simple yield
adds 20 USD per year if both rates and capital remain unchanged. Six USD in switching
costs takes about 110 days to recover, before tax and additional risk. A “better APY”
can therefore be unsuitable for a short holding period.

Compare lending to a user-appropriate alternative/reserve, trading to buy-and-hold
and/or a specified DCA baseline, and LP to holding the initial token inventory.
Use matching dates, cash flows and reporting currency. Report net result, drawdown,
time below the benchmark, exit availability and reconciliation failures, not win
rate alone. Transfers between owned accounts are not profit.

## Paid APIs with USDC: bounded research procurement

Reference event: “Agentic Payments: How AI Agents Pay for APIs with USDC”, scheduled
for 12 November 2026, 15:00–16:00 GMT (09:00–10:00 Mexico City). Speaker: Shafu
Elfouly, Staff Software Engineer at Circle. Subjects: x402, Circle Agent Stack,
provider acceptance, wallets, spending controls, setup/funding and Q&A. Revisit the
replay/documentation after the event; the announcement is not an implementation guide.

Proposed workflow:

1. State the evidence gap and check whether an adequate free/cached source exists.
2. Discover an allowlisted provider and exact resource, chain, canonical payment
   asset, recipient, amount, price expiry and expected schema/freshness.
3. Enforce per-request, per-session and daily budgets outside the LLM. Reserve
   concurrent spend atomically; isolate research funds from investment principal.
4. Obtain the required approval and record a stable request/payment identifier.
   An API response or payment challenge cannot expand authorization.
5. Reconcile payment independently of data delivery. On unknown payment outcome,
   do not blindly create another payment. Use supported idempotency and inspect
   settlement before retrying.
6. Validate receipt, schema, timestamps and identity. “Payment succeeded, unusable
   data” is a distinct result; charge it to research cost and do not invent data.
7. Show cumulative research spend and remaining budget; pause/revoke immediately.
   Record provider, resource, payment status and evidence references without secrets.

x402/Circle Agent Stack, Coinbase's authenticated data-payment tools and Catena are
candidate routes, not interchangeable integrations. Verify network/token support,
permissions, eligibility and payment semantics for each adapter. No live purchases
or funding are authorized by this specification.

## Delivery order and acceptance

1. Complete exact-target Guardian watches on Base/Ethereum, keeping Arc operational.
2. Add performance/cost accounting and net scenario comparisons for existing lending.
3. Add actual-position LP observation and holding-benchmark accounting.
4. Add Solana sources, then a verified Robinhood Chain adapter with the same evidence
   gates. Source verification precedes “supported” status.
5. Run transparent spot strategies in forward paper testing; separately prototype
   issuer-aware tokenized-equity research.
6. Evaluate paid-data procurement in sandbox only when an existing workflow has an
   evidenced data gap, then test bounded authorization and duplicate-payment recovery.

Required failure cases: wrong network/asset, stale or missing quotes, no withdrawal
liquidity, unavailable index, overlapping vault exposures, out-of-range LP,
corporate-action mismatch, ambiguous payment outcome and exhausted budget.
Missing evidence must lead to refresh/review or abstention. Do not advertise a
strategy as profitable merely because its components or unit tests work.

## Primary sources

- https://docs.morpho.org/curate/concepts/liquidity/
- https://docs.morpho.org/learn/resources/risks/
- https://support.uniswap.org/hc/en-us/articles/32514988932877-What-does-out-of-range-liquidity-mean
- https://developers.uniswap.org/docs/liquidity/overview
- https://docs.alpaca.markets/us/v1.4.2/docs/paper-trading
- https://xstocks.com/us/partners/learn
- https://docs.catena.com/
- https://docs.cdp.coinbase.com/ai-agents/coinbase-for-agents/coinbase-mcp
- https://community.arc.io/home/events/agentic-payments-how-ai-agents-pay-for-apis-with-usdc

The event announcement was retrieved directly after search extraction failed.
Product recommendations in this document are CofferHouse design proposals inferred
from these sources, not endorsements by those providers.
