# Agent Hub

Agent Hub is the coordinator for the CofferHouse agent system. It prevents users from confusing implemented capabilities with future execution plans, gives every agent one distinct responsibility and can run the implemented research chain as one bounded session.

Mission Control condenses the current system state into one operator brief: data mode, risk flags, modeled positions, human-gate state and 24/7 runtime health. It selects one next permitted step according to a strict priority—Guardian attention, blocked downstream requests, pending human review, stale server runtime, missing research session, or research exclusions. It never advances a gate by itself.

Durable Guardian attention survives browser reloads and has the same highest priority as a local Guardian observation. Active Scout and Guardian alerts appear together in the protected attention inbox. Each incident is acknowledged separately with operator, note and the transient operator token; acknowledgment records review but cannot change the deterministic decision or authorize execution.

## Coordinated research session

`RUN RESEARCH SESSION` executes the current deterministic Scout, Opportunity and Strategy logic in sequence. The DEX branch joins only when the user has loaded real indexed pool observations; otherwise the receipt marks that stage `SKIPPED` instead of inventing an outcome.

The visible trace ends at `WAITING HUMAN`. It does not create an Action Center intent, record approval, connect a wallet, sign or submit anything. The resulting `cofferhouse.agent-hub.session-receipt.v1` document contains the inputs, stage results, complete agent outputs and explicit execution flags (`prepared`, `signed`, `submitted`) set to `false`. Its SHA-256 integrity record lets another copy of the suite detect any later alteration.

The browser retains the ten newest valid session receipts. A user can reopen an earlier session and compare its decision, eligible-market count, modeled lending positions and observed DEX pools with the immediately preceding session. Modified receipts fail integrity verification and are not restored. When Action Center consumes a position from a coordinated session, it preserves the Agent Hub session receipt as the source of evidence rather than breaking the audit trail at the Strategy output.

When durable storage and the protected scheduler are configured, every unattended Scout cycle also creates a coordinated lending-research session and stores up to 25 sealed receipts server-side. DEX remains explicitly skipped because a browser watchlist is not silently converted into server authority. The Hub can import the latest verified server session for inspection and a later Action Center preview.

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
| 8 | Interop Observer | Observe recent Arc CCTP V2 burns and received messages. | Read-only RPC observation; no bridge, quote, wallet or FX account |

## Delivery boundary

The October 14 target is a coherent, demonstrable suite in which every agent performs its analysis, produces evidence and hands a structured result to the next stage. It is not a promise of unaudited autonomous execution with real funds.

Production execution requires wallet architecture, deployed and independently reviewed contracts, permission revocation, transaction simulation, monitoring, incident response and explicit operator authorization.

## Interface rule

Agent Hub is the default view and the coordinator-facing dashboard. Every operational agent has a persistent top navigation tab and its own focused workspace. Changing tabs preserves browser-session state; it does not rerun a scan, approve an intent or imply execution. Only the explicit session button starts coordinated research.

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

This creates one auditable path: Scout detects, Opportunity selects, Strategy allocates, the DEX branch performs separate pool research, Action Center requests approval, Guardian monitors, and Automation tests permissions. Interop Observer is a parallel evidence source for crosschain stablecoin activity; it does not silently join the capital-allocation path.

Strategy Lab is operational with reserve, diversification, concentration, liquidity-impact caps, exit conditions and sealed receipts. The DEX branch adds user-selected Arc token contracts, indexed pool screening, official Uniswap route evidence when configured, bounded DEX Opportunity ranking and separate swap/LP Strategy proposals without mixing lending APY with LP metrics. Action Center now creates non-executable intents with one expiring human gate, and Guardian monitors those approved intents without pretending that a funded position exists.
