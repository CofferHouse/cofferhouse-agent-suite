# MVP Scope

## Objective

Build a small, working Arc-native prototype that compares USDC, tokenized RWA and crypto-collateral opportunities and produces an explainable risk report from transparent inputs and policies.

The first interface uses clearly labeled demonstration observations. The next integration milestone replaces them with live, timestamped Arc market adapters without changing the policy engine.

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

Prototype policy `scout-demo-0.1` applies:

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
- the repository contains reproducible setup instructions;
- any onchain component is verified and linked;
- a short demo clearly shows the complete flow.
