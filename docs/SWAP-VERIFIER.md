# Swap verification foundation

## Scope

This release adds immutable swap intents to the existing reservation ledger and an injectable, server-owned verification boundary for protocol adapters. It does NOT include a production Uniswap/Universal Router/v4 adapter. Production swap reconciliation returns REVIEW, keeping funds reserved. No DEX address, COFFERS contract, wallet permission or live execution was configured.

Direct transfer behavior remains supported. No new external endpoint is introduced; operator requests use the existing protected budget endpoint.

## Record before execution

For `reserve`, optionally provide `swapIntent`:

- `kind`: `SWAP`
- explicit `chainId`, `adapter`, `from`, `recipient`, `router`, `tokenIn`, `tokenOut`
- `maxInputUnits`: raw integer USDC micro-units, exactly equal to the reservation
- `minOutputUnits`: positive raw integer output-token units; do not assume 18 decimals
- `calldataHash`: keccak256 of the exact intended router calldata
- `expiresAt`: quote authorization expiry within five minutes of reservation

Retries must reproduce the original normalized intent; changing tokens, router, minimum output, calldata hash or deadline conflicts with the operation ID. Reservation retries use the original creation time for expiry validation, so replaying an old reservation does not grant a fresh quote authorization.

`track` binds the transaction hash, chain, sender and router to that pre-recorded intent. A request cannot convert an already reserved direct transfer into a swap. Once tracked, manual release remains prohibited. Tracking is accounting, not a permission to broadcast, and does not extend a quote's expiry.

## Verification boundary

`createSwapReconciler` takes a trusted RPC client, chain, USDC address, router allowlist, output-token allowlist and protocol adapter registry. These are server-side dependencies, never client-supplied configuration. Unknown protocols or addresses require review before any RPC read.

A protocol adapter must decode and reject unsupported calldata commands, enforce route/recipients/deadlines and validate relevant protocol events on success. For reverted transactions, it must still validate the calldata intent; it cannot rely on successful swap events. There is no universal heuristic fallback. The test-only adapter is not deployed as a protocol implementation.

The common layer checks:

1. Chain, transaction/receipt hash, sender, router, zero native value and calldata hash.
2. Receipt and transaction block agreement, at least two confirmations and canonical block identity.
3. Protocol adapter approval of calldata and events.
4. For success, inclusion before the recorded expiry, net USDC outflow greater than zero and no more than the reserved budget, and net output received by the exact recipient at or above its minimum.

Net flows include refunds and outgoing output-token transfers in that receipt. Integer arithmetic is used for all token quantities. Malformed Transfer events require review. Token identity comes from exact contract addresses, not names/symbols. This assumes vetted standard ERC-20 event behavior; rebasing, malicious or nonstandard tokens need additional balance/state verification.

Only actual verified net USDC spend moves into `spentUnits`; unused reservation is released on confirmation. Confirmed spend must be positive and no greater than the reserved amount. Pending/mismatched outcomes retain the full reservation. Duplicate reconciliation cannot charge twice.

## Before production

Select the actual DEX/router version and deploy-tested contract addresses. Implement its strict calldata/event decoder with real successful, failed, refunded and adversarial receipt fixtures. Configure server allowlists, confirm output-token decimals, and obtain fresh executable quotes. Wallet-bound aggregate budgets, installed permissions, broadcasting, gas accounting and reorganization recovery remain separate prerequisites.

A successful buyback is not a burn. Burning COFFERS requires its own contract-specific verifier and must not be inferred from swap receipts.

## Validation

238 tests passed and production build passed. New cases cover malformed/expired quote intents, unauthorized adapters, token/input/calldata/recipient mismatches, budget/minimum-output violations, refunds, RPC failure, reorg observations, reverted swaps, immutable reservation terms and invalid settlement amounts. Protocol proof is injected in tests; no live DEX swap, RPC receipt or production protocol decoder was tested.
