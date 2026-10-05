# CofferHouse Agent Suite — submission brief

## One-line pitch

CofferHouse Agent Suite is an inspectable room of bounded Arc agents that autonomously observes, verifies, evaluates, compares, records and escalates market and interoperability evidence while humans retain financial authority.

## Short description

CofferHouse Agent Suite turns fragmented onchain data into a reproducible research trail. Eight specialized, read-only agents cover market scanning, opportunity filtering, reserve-aware strategy research, DEX pool investigation, one expiring human approval, post-approval monitoring, revocable-permission simulation and Arc CCTP interoperability observation. Deterministic policies own every PASS, REVIEW and REJECT result; optional AI may summarize evidence but cannot change policy outcomes. Important stages produce tamper-evident JSON receipts that can be independently verified. The public prototype does not custody funds, sign messages, prepare calldata or execute transactions.

## Problem

Onchain interfaces expose numbers but often leave users to reconcile market identity, liquidity, utilization, contract status, data freshness, oracle coverage, pool quality and crosschain activity themselves. When research is spread across dashboards, the reasoning, limits and human decision are difficult to reproduce.

## Solution

The suite gives each responsibility a bounded agent and connects their receipts:

| Room | Responsibility | Hard boundary |
|---|---|---|
| Agent Hub | Coordinate one research session | Cannot override child-agent results |
| Scout | Observe and rank Arc lending markets | No custody or execution |
| Opportunity | Filter evidence using user limits | Cannot create missing evidence |
| Strategy | Model capped, reserve-aware allocations | Observed APY is not a forecast |
| DEX | Inspect contract-first pool watchlists | Screening is not an executable quote |
| Action Center | Record one expiring human approval | Approval is not a transaction |
| Guardian | Compare later evidence with approved intent | Responses stay inside the approved baseline |
| Automation | Prove hypothetical requests against limits | Installs no permissions in this release |
| Interop Observer | Observe Arc CCTP V2 events | Not a bridge, signer or relayer |

## Why it is an agent system

The runtime has an explicit loop and durable state:

1. **Observe** fresh Arc market and interoperability evidence.
2. **Verify** identities, required data and referenced contract bytecode where configured.
3. **Evaluate** every observation with visible, versioned rules.
4. **Compare** it with durable history and an approved intent when one exists.
5. **Decide** between bounded outcomes such as `WATCH`, `REVIEW` and `ESCALATE`.
6. **Record** the cycle, seal receipts and notify only when limits require attention.

The system can run on a protected schedule without a browser. Its autonomy covers observation, analysis, memory, incident routing and reporting—not financial execution.

Each coordinated browser or server session also seals a bounded handoff into Action Center and a Guardian monitoring plan. The handoff identifies the selected target and modeled amount, but Action Center still requires fresh human review and Guardian still requires an approved intent and current evidence.

## Arc integration

- Morpho-listed markets on Arc mainnet, normalized into a documented schema.
- Arc JSON-RPC bytecode checks for referenced contract identity.
- Arc CCTP V2 `DepositForBurn` and `MessageReceived` event observation.
- Non-overlapping block-window comparison with `transactionHash + logIndex` de-duplication.
- USDC-denominated market research and simulation.
- A deployment path for durable memory, protected scheduling and alerts.

## Architecture and trust model

| Layer | Authority |
|---|---|
| External adapters | Supply observed market, pool, quote and CCTP data |
| Deterministic policy | Owns status, score, warnings and hard limits |
| Agent modules | Transform valid upstream evidence within their own bounds |
| Optional Gemini briefing | Summarizes evidence; cannot change policy results |
| Human operator | Approves or rejects one expiring intent |
| Guardian and Automation | May monitor or simulate only inside that intent |
| Public release | Cannot hold funds, sign, prepare calldata or execute |

## Technical evidence

- Live product: <https://cofferhouse-scout.vercel.app/#agents>
- Official House: <https://cofferhouse.cheesemachineco.chatgpt.site/>
- Source: <https://github.com/CofferHouse/cofferhouse-agent-suite>
- Tests and production build: `npm run check`
- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Deployment: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Demo script: [`HACKATHON_DEMO_SCRIPT.md`](HACKATHON_DEMO_SCRIPT.md)
- Asset checklist: [`HACKATHON_ASSET_CHECKLIST.md`](HACKATHON_ASSET_CHECKLIST.md)
- Frozen capability and claims list: [`FEATURE_FREEZE_2026-10-05.md`](FEATURE_FREEZE_2026-10-05.md)

## Honest limitations

- Protocol or pool listing is not CofferHouse approval.
- Contract bytecode existence does not prove oracle correctness or economic safety.
- A second independent price feed and verified volatility feed are not connected to every market.
- DEX screening ratios are not executable quotes unless the official quote adapter is configured.
- The receipt registry source is not claimed as deployed or audited.
- Durable memory, scheduling, alerts, optional Gemini summaries and acknowledgments require deployment credentials.
- Interop Observer records CCTP evidence but does not initiate or complete transfers.
- The software is experimental research infrastructure, not financial advice.

## Judge takeaway

CofferHouse does not call a button click an agent. The suite demonstrates autonomous observation, durable memory, explicit decisions, protected escalation, specialized handoffs and verifiable evidence while keeping irreversible financial authority outside the public prototype.
