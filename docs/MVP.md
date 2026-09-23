# MVP Scope

## Objective

Build a small, working Arc-native prototype that compares USDC, tokenized RWA and crypto-collateral opportunities and produces an explainable risk report from transparent inputs and policies.

The interface now requests listed Morpho markets on Arc through the public Morpho GraphQL API. Clearly labeled demonstration observations remain only as a safe fallback when the live provider is unavailable. The deterministic policy engine does not depend on the provider.

## Primary user story

> As an Arc user, I want to inspect a market before interacting with it so I can understand its liquidity, utilization, contract status and principal risks.

## Required flow

1. The user opens Scout.
2. Scout loads a supported market from a configured data source.
3. Scout normalizes the available market information.
4. A deterministic policy engine applies visible thresholds.
5. Scout returns:
   - PASS, REVIEW or REJECT;
   - a score breakdown;
   - the source and timestamp of each input;
   - triggered warnings;
   - missing-data warnings;
   - a plain-language explanation.
6. The user can view the relevant contract and explorer links.
7. The bounded Scout Agent evaluates and ranks every loaded market.
8. The user can download a deterministic Scout Receipt with the policy, observations, results and reasons.
9. The user can compare the same markets under three visible research profiles without bypassing contract verification.
10. The selected market shows all three profile outcomes side by side for transparent comparison.
11. A read-only simulator previews how a hypothetical borrow changes liquidity, utilization and policy outcome.
12. A separate simulation receipt records the selected market, proposed amount and before/after result.
13. Consecutive scans flag material liquidity, utilization, listing and policy-result changes.

## Initial inputs

Subject to data availability, the first report should include:

- network and contract address;
- asset pair or market name;
- available liquidity or TVL;
- utilization;
- displayed supply/borrow rate;
- concentration indicators;
- contract allowlist status;
- data freshness;
- missing or unverifiable inputs.

## Initial policy examples

Scout exposes three versioned research profiles: `scout-preservation-0.3`, `scout-balanced-0.3` and `scout-yield-0.3`. The Balanced profile applies:

- preferred liquidity of at least $5 million and rejection below $1 million;
- preferred utilization of 80% or less and rejection at 90% or more;
- Arc as the supported network;
- local contract allowlist status;
- a maximum observation age of 15 minutes;
- at least two independent price sources;
- a collateral-volatility review threshold of 55%;
- rejection when required-data completeness falls below 90%.

## Non-goals for the hackathon MVP

The MVP will not:

- custody user funds;
- lend or borrow funds;
- deploy The Big Coffer;
- trade autonomously;
- promise yield;
- issue `$COFFERS`;
- gate access with membership NFTs;
- implement ascension or rewards;
- create a DAO.

Those features belong to later CofferHouse phases and require separate design, testing and security review.

## Definition of done

The MVP is complete when:

- one real Arc market can be loaded;
- the same inputs always produce the same policy result;
- every result shows its sources and timestamp;
- missing information fails safely;
- the interface is publicly accessible;
- repeated market pairs are distinguishable by market ID and contract identity;
- the full scan can be exported as a versioned JSON receipt;
- the repository contains reproducible setup instructions;
- any onchain component is verified and linked;
- a short demo clearly shows the complete flow.
