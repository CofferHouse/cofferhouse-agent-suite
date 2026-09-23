# Agent Hub

Agent Hub is the product map for the CofferHouse agent system. It prevents users from confusing implemented capabilities with future execution plans and gives every agent one distinct responsibility.

## Sequence

| Order | Agent | Product responsibility | Target for the October 14 suite |
|---:|---|---|---|
| 1 | Scout | Observe, verify, evaluate, compare, alert, simulate and record market risk. | Operational |
| 2 | Opportunity | Rank eligible opportunities with sizing bounds and missing evidence. | Operational |
| 3 | Strategy Lab | Build a bounded allocation research proposal from eligible opportunities. | Operational |
| 4 | DEX Research | Discover selected Arc pools and build bounded swap or LP research without mixing lending and pool metrics. | Operational |
| 5 | Action Center | Separate research from an action and require one informed human approval. | Operational |
| 6 | Guardian | Monitor approved research intents and propose protective responses. | Operational |
| 7 | Automation | Define revocable allowlists, caps, expiry and emergency pause. | Operational sandbox; real autonomous funds remain gated |

## Delivery boundary

The October 14 target is a coherent, demonstrable suite in which every agent performs its analysis, produces evidence and hands a structured result to the next stage. It is not a promise of unaudited autonomous execution with real funds.

Production execution requires wallet architecture, deployed and independently reviewed contracts, permission revocation, transaction simulation, monitoring, incident response and explicit operator authorization.

## Interface rule

Agent Hub is the default view and the coordinator-facing dashboard. Every operational agent has a persistent top navigation tab and its own focused workspace. Changing tabs preserves browser-session state; it does not rerun a scan, approve an intent or imply execution.

- `LIVE` means the capability works in the current application.
- `NEXT BUILD` identifies the active product task.
- `PLANNED` and `FUTURE · GATED` are roadmap states and must not present fake action buttons.
- `LIVE · SANDBOX` means the complete simulator operates but no wallet or onchain permission is installed.
- A future agent becomes `LIVE` only when its logic, interface, tests, documentation and receipt are integrated.

## Shared handoff

Every agent will eventually receive and produce a common evidence envelope containing:

- source agent and version;
- market or strategy identity;
- observed inputs and timestamps;
- active user policy;
- decision and explanation;
- missing evidence;
- proposed action;
- authorization required;
- expiration;
- integrity hash and receipt identifier.

This creates one auditable path: Scout detects, Opportunity selects, Strategy allocates, the DEX branch performs separate pool research, Action Center requests approval, Guardian monitors, and Automation enforces permissions.

Strategy Lab is operational with reserve, diversification, concentration, liquidity-impact caps, exit conditions and sealed receipts. The DEX branch adds user-selected Arc token contracts, indexed pool screening, official Uniswap route evidence when configured, bounded DEX Opportunity ranking and separate swap/LP Strategy proposals without mixing lending APY with LP metrics. Action Center now creates non-executable intents with one expiring human gate, and Guardian monitors those approved intents without pretending that a funded position exists.
