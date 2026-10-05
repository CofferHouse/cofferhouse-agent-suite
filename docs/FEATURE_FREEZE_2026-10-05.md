# Feature freeze — 5 October 2026

This document freezes the product surface and judging claims for the October Arc submissions. Bug fixes, deployment activation, accessibility work and evidence capture may continue; new financial authority is not part of this release.

## Publicly demonstrable now

| Capability | Evidence | Claim boundary |
| --- | --- | --- |
| Live Arc lending discovery | Scout and official Borrow Kit adapters | Provider listing is not CofferHouse approval. |
| Deterministic risk policy | Versioned PASS, REVIEW and REJECT checks | Same normalized inputs produce the same result. |
| Coordinated Agent Hub session | Six-stage Scout → Opportunity → Strategy → DEX → Action → Guardian receipt | Handoffs contain research evidence, not transaction authority. |
| Bounded strategies | Reserve, concentration and liquidity-impact limits | Observed APY is not a forecast. |
| Human Action Center gate | Read-only preview plus expiring approval record | Approval is not a signature or transaction. |
| Guardian plan | Post-approval monitoring limits and alert decisions | No automated rebalance, withdrawal, swap or exit. |
| Receipt verification | Canonical JSON and SHA-256 alteration detection | Tamper evidence is not a digital signature. |
| Arc App Kits | Earn research, protected Onramp boundary and cirBTC/USDC Borrow preview | Onramp requires server configuration; Borrow remains a preview. |
| DEX research | Contract-first watchlist, screening and bounded strategy | Official quote evidence requires a configured server key. |
| CCTP observer | Bounded Arc event decoding and comparison | Requires Arc RPC and does not relay transfers. |

## Implemented but deployment-gated

- Upstash durable history, atomic scheduler locking and recoverable failure diagnostics.
- Protected 15-minute GitHub Actions scheduler and daily Vercel safety run.
- Arc RPC bytecode verification and CCTP observation.
- Operator acknowledgment, durable Guardian registration, alert webhooks and optional bounded Gemini briefings.
- Circle Onramp session creation and official Uniswap quote retrieval.

These are claimed as active only after `/api/health` confirms their capability and live evidence is captured.

## Explicit simulations

- Hypothetical borrowing impact.
- Reserve-aware lending and DEX allocation research.
- Action Center checks and human approval record.
- Automation permission sandbox.
- Borrow Kit collateral and liquidation preview.

## Outside this release

- Custody, private keys or a server wallet.
- Token approvals, calldata construction, signatures or transaction submission.
- Automated investment, borrowing, swapping, liquidity provision, exits or rebalancing.
- Audited smart contracts or a deployed receipt registry.
- Guaranteed yield, safety, liquidity or price accuracy.

## Frozen judging claims

1. CofferHouse is an inspectable bounded-agent system, not a single button labeled as an agent.
2. The agents coordinate through typed evidence and tamper-evident receipts.
3. Deterministic policy—not an LLM—owns market decisions.
4. Autonomous authority stops at observation, comparison, memory, escalation and reporting.
5. Every transition toward financial activity requires a separate visible human gate.
6. The public prototype is useful before financial execution because it converts fragmented Arc data into a reproducible decision trail.

## Remaining release work

1. Activate production credentials without committing or exposing them.
2. Capture one manual and one scheduled durable cycle.
3. Complete mobile, keyboard and cross-browser QA.
4. Record the three-minute demo and final screenshots.
5. Submit the same verified product with distinct positioning for Tameion and Arc Microgrants.
