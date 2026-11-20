# 4mica review and sandbox preflight

Reviewed 2026-11-20. Upstream snapshot:
`4mica-Network/4mica@f9757b79de87fee65efe1e9e4d8dc05b4c6dd045`, SDK 2.0.0.

## Decision for CofferHouse

4mica is relevant to agent payments for APIs, data and services: its x402 credit
scheme exchanges signed payment guarantees backed by deposited collateral and
settles obligations later. It is not a liquidity scanner, trading strategy or
profit guarantee. A signature can create an obligation before on-chain settlement.

| Idea | CofferHouse decision |
| --- | --- |
| Parse x402 v2 PAYMENT-REQUIRED offers | Implemented as a bounded sandbox decoder and selected-offer validator. |
| Seller, route, token and network policy | Exact recipient and HTTPS route checks; pinned sandbox token/network only. An allowlist does not verify seller identity or service quality. |
| Spending controls | Simulate per-request, remaining task and remaining period caps using integer USDC micro-units. Always require human review. |
| Distinguish reported success from proof | Strict boolean report classification; no response establishes verified settlement or delivery. |
| Wallet/signing/facilitator integration | Deferred. No SDK signing dependency, key entry, deposits, guarantees or paid API requests added. |
| Yield on collateral | Deferred. Credit, smart-contract, strategy and withdrawal risks require separate evaluation. No revenue estimate adopted. |

## Network compatibility at this snapshot

| Network | Upstream documentation | Preflight policy |
| --- | --- | --- |
| Base Sepolia, eip155:84532 | SDK/protocol 2.0 sandbox | Only the documented Aave test USDC is recognized. |
| Base mainnet, eip155:8453 | SDK 2.0 upgrade pending | Blocked explicitly. |
| Ethereum Sepolia, eip155:11155111 | Legacy x402 v1 | Blocked by this v2-only implementation. |
| Arc, Solana, Robinhood | Native support not documented in reviewed network list | Blocked; CofferHouse's other research integrations do not imply 4mica compatibility. |

Pinned sandbox USDC: `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f`.
This is the documented test collateral, not an arbitrary USDC-branded token.
Network availability must be revalidated before any future live integration.

## Implemented developer module

`packages/agent-modules/fourmica-preflight.js` exports
`evaluateFourmicaPreflight(input, { now })` and `classifyFourmicaReport(report)`.
This first integration is a developer module, not a visible dashboard panel or
public API endpoint. It has no network I/O or mutable budget state.

Input fields:

- `challenge`: x402 v2 JSON object or canonical base64 PAYMENT-REQUIRED header.
- `selectedOffer`: explicit zero-based offer index; no automatic cheapest-offer purchase.
- `requestId`: nonzero 32-byte hexadecimal identifier; not proof of idempotency.
- `quoteCapturedAt`: caller-supplied UTC timestamp with milliseconds, at most 60 seconds old.
- `policy`: `resourceUrl`, `payTo`, `paused`, `expiresAt`, `perRequestUsdc`,
  `taskRemainingUsdc`, `periodRemainingUsdc`. Monetary caps are unsigned decimal
  strings with at most six decimal places. The policy expires within 24 hours.

A selected offer must use `4mica-credit`, the pinned network/asset, an allowlisted
nonzero recipient, canonical positive u256 atomic amount and integer
`maxTimeoutSeconds` from 1 to 300. The timeout is a protocol field, not quote
expiry. Unknown nonempty `extra` and `extensions` are blocked, including validator
requirements that this adapter cannot yet verify. A malformed unselected offer
cannot silently become the selected offer. Version numbers and booleans are not
coerced from strings. Invalid input fails closed.

Output is `BLOCKED` or `REVIEW_REQUIRED`, always `SIMULATION_ONLY`, with disabled
execution, no signature/submission, no budget reservation and no enforced replay
protection. Limits and timestamps are untrusted caller data; passing checks is
not permission to spend. The returned object is a check result, not a signed or
sealed evidence receipt. `success: true` only yields
`SUCCESS_REPORTED_UNVERIFIED`; `success: false` is rejected even with HTTP 200.

Tests: `node --test test/fourmica-preflight.test.js`. The fixtures use a reserved
`.invalid` seller hostname and a fixed synthetic recipient; no seller is called.

## Required before live use

Authenticate operator policy and bind approval to exact seller, route, quote,
network, amount and request ID. Atomically reserve credit obligations in the
existing durable budget ledger **before** signing; prevent replay and reconcile
ambiguous failures without signing again blindly. An HTTP retry must not create
a second obligation. Existing transaction-only accounting does not yet account
for off-chain 4mica guarantees.

Then validate current contracts and SDK compatibility, wallet delegation,
facilitator/guarantee verification, seller delivery, refunds and actual chain
settlement as separate evidence. Add sandbox end-to-end tests and operational
recovery before considering mainnet. No customer funds were used in this review.

## Reuse and provenance

The active monorepo carries MIT licensing. Only its small Web-standard base64
helper was adapted, retaining attribution and the full license in
`THIRD_PARTY_NOTICES.md` and `LICENSES/4mica-MIT.txt`. The rest of the validator is
CofferHouse policy code, informed by the documented x402 v2 wire format.
The archived `facilitator-4mica` repository is not used as a production dependency.
No core/AVS contracts or third-party forks were copied or audited.

Sources:

- https://docs.4mica.io/getting-started/introduction
- https://docs.4mica.io/getting-started/supported-networks
- https://docs.4mica.io/buyer/budgets-and-spending-limits
- https://docs.4mica.io/buyer/trust-and-verification
- https://docs.4mica.io/buyer/payment-proof-and-audit
- https://github.com/4mica-Network/4mica/tree/f9757b79de87fee65efe1e9e4d8dc05b4c6dd045/packages/sdk
- https://github.com/4mica-Network/4mica/blob/f9757b79de87fee65efe1e9e4d8dc05b4c6dd045/LICENSE
