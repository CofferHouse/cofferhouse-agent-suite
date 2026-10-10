# CofferHouse — post-hackathon build plan

**Recorded:** 2026-10-10  
**Purpose:** preserve the implementation order from the read-only Agent Suite to member-controlled tools and independently auditable contracts.

## Product boundary

CofferHouse is one product with several independently secured components:

1. the public House;
2. Holder Center;
3. Agent Suite;
4. member bots;
5. membership and ascension contracts;
6. The Big Coffer vault and protocol adapters.

The user experience remains unified even when security-sensitive contracts later live in a separate audited repository.

## Milestone A — close the bounded-agent loop

Agent research is feature-complete for the public prototype, but the holder alert path still requires production work.

- [ ] Read active per-wallet Telegram subscriptions during protected cycles.
- [ ] Match Scout and Guardian incidents to each holder's preferences.
- [ ] Deliver only relevant alerts to the linked Telegram chat.
- [ ] Add preference update and disconnect/unsubscribe operations.
- [ ] Add delivery deduplication, rate limits, failure records and retry boundaries.
- [ ] Add automated tests for multi-user isolation.
- [ ] Create and configure the official bot only after the backend passes the above gates.
- [ ] Complete mobile, cross-browser and final deployment QA.

**Exit condition:** two test holders can select different preferences and receive only their own qualifying alerts, with no wallet authority granted.

## Milestone B — member bot framework

Bots are member tools that consume verified Agent Suite evidence. They must not bypass Guardian or the human-action boundary.

### First bot: bounded DCA planner

Read-only release:

- define asset, cadence, amount and maximum monthly budget;
- compare the requested plan with available balance and risk policy;
- preview future orders without preparing transactions;
- show pause, expiry and maximum-spend controls;
- export a deterministic plan receipt;
- feed alerts to the holder's chosen channel.

Later execution release:

- allowlisted router and assets only;
- exact per-order and period caps;
- fresh quote and slippage limit;
- explicit wallet authorization;
- pause/revoke path;
- independent security review.

### Shared bot capabilities

- membership entitlement check;
- member-owned configuration;
- deterministic policy evaluation;
- simulation and receipt before action;
- Guardian monitoring;
- per-user alerts;
- complete failure and action history.

**Exit condition:** a holder can create, simulate, inspect, download and revoke a DCA plan without moving funds.

## Milestone C — ascension contract

Ascension permanently upgrades membership according to the published CofferHouse progression rules. The contract specification must be frozen before Solidity implementation.

### Decisions to specify

- membership contract standard and immutable collection identity;
- exact level graph, including Phase 0;
- burn combinations accepted for every ascension;
- whether several lower levels can replace a higher input;
- destination token ID/class and metadata behavior;
- treatment of SPECIAL memberships;
- maximum supply changes after burns and ascensions;
- operator/admin powers and whether they can be permanently renounced;
- pause and emergency behavior;
- events required by Holder Center and indexers;
- replay, reentrancy and ownership checks;
- test fixtures covering all valid and invalid combinations.

### Safety properties

- only the current owner or an approved operator can initiate ascension;
- inputs are consumed atomically or the whole transaction reverts;
- no duplicate use of a membership;
- no arbitrary mint path;
- SPECIAL rules cannot be accidentally reached through general ascension;
- supply accounting is reproducible from events.

**Exit condition:** written specification, complete state-transition table, property tests, deployment script, independent review and testnet rehearsal.

## Milestone D — The Big Coffer / Morpho vault

The vault is a separate security domain and must not be added as an informal extension of the Agent Suite.

### Recommended sequence

1. Define the economic mandate: accepted asset, withdrawal rules, reserves, fees, member priority and loss handling.
2. Decide whether to use an existing audited ERC-4626/Morpho vault architecture or a minimal adapter instead of inventing a new lending core.
3. Build a read-only vault dashboard and allocation simulator.
4. Add contract allowlists, market caps, utilization limits and emergency pause.
5. Add deposit/withdrawal testnet flows.
6. Integrate Agent Suite proposals as evidence only; the agent must not control the vault.
7. Require multisig governance, timelock where appropriate, monitoring and independent audit before mainnet funds.

### Required risk controls

- USDC-first scope;
- per-market and total exposure caps;
- liquidity reserve;
- oracle and collateral-market allowlists;
- no unverified market allocation;
- withdrawal and insolvency scenarios;
- fee and reward accounting invariants;
- Guardian alerts independent of the transaction executor;
- emergency pause that does not trap normal withdrawals without an explicit documented reason.

**Exit condition:** audited contracts, testnet evidence, operational runbook and explicit human/governance authority.

## Repository structure

For now, keep product UI, APIs and research agents in:

- `CofferHouse/cofferhouse-agent-suite`

When Solidity implementation begins, create:

- `CofferHouse/cofferhouse-contracts`

Suggested contract repository layout:

```text
src/
  membership/
  ascension/
  vault/
  adapters/morpho/
test/
script/
audit/
deployments/
docs/
```

Do not create one repository per bot or per agent. Bots belong to the product monorepo unless they later require an independently deployed execution service. Security-sensitive contracts belong together so tests, deployment records and audits are easy to inspect.

## Implementation order

1. Finish personal alert delivery.
2. Build the read-only DCA bot.
3. Freeze the ascension state machine and contract specification.
4. Create the contracts repository and implement ascension on testnet.
5. Build the read-only Big Coffer dashboard and simulator.
6. Select the audited Morpho/ERC-4626 integration path.
7. Implement vault contracts only after economic rules are frozen.
8. Audit before any public mainnet capital.

## Non-negotiable boundaries

- No private keys in repositories or server logs.
- No production contract advertised as audited before an independent audit.
- No agent recommendation directly moves funds.
- No simulated capability presented as live.
- Every holder action remains attributable, bounded, pausable and reviewable.
