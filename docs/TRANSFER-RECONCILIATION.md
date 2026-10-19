# Direct USDC transfer reconciliation

The operator-only budget API now accepts `track` and `reconcile` actions. This service does not sign or broadcast transactions and does not enable automatic bot execution.

## Lifecycle

- `RESERVED`: may be released if no transaction has been submitted.
- `PENDING`: `track` binds the reservation to a hash, chain ID, sender, USDC contract and recipient. Record this BEFORE any external broadcaster sends the signed transaction. Manual release is blocked from this point.
- `REVIEW`: provider observations do not match the tracked intent. Reservation remains locked; later reconciliation can obtain fresh evidence.
- `CONFIRMED`: RPC evidence matches the direct USDC transfer. Reserved amount moves to cumulative spent amount atomically.
- `FAILED`: a matching, sufficiently confirmed reverted transaction releases the reserved transfer principal, without increasing spent principal.

Terminal results are idempotent. A transaction hash cannot be bound to two operations within one bot ledger. Hash replacements are rejected; there is no dropped-transaction timeout or automatic release. External nonce replacement/cancellation recovery is a future feature. Never submit before `track` has successfully persisted; retry a lost response with the same hash and operation ID.

Reservation limits now include both pending principal and confirmed spent principal. Confirming an operation cannot replenish the authorization period's budget. Old ledgers without `spentUnits` are read as zero until their first confirmation.

## API bodies

Use the existing protected `POST /api/bots/budget` endpoint. Track with:

```json
{
  "action": "track",
  "botId": "ddca_bot_01",
  "operationId": "operation_01",
  "transaction": {
    "hash": "<0x transaction hash>",
    "chainId": 5042,
    "from": "<sender address>",
    "to": "<recipient address>",
    "token": "<USDC contract address>"
  }
}
```

The chain ID above is illustrative: configure and verify the actual target network. Reconcile with `action: "reconcile"`, `botId` and `operationId`; client-supplied receipts or outcome flags are not accepted as evidence.

## Server configuration

- `ARC_RPC_URL`: HTTPS RPC endpoint for the intended network.
- `BOT_CHAIN_ID`: explicit numeric chain ID, checked against RPC on each reconciliation.
- `BOT_USDC_ADDRESS`: explicitly verified USDC contract address for that network.

Missing configuration leaves operations pending. Never infer token contracts from symbols. No credentials or configuration values were added to production by this change.

The verifier checks RPC chain, hash, sender, token destination, exact ERC-20 `transfer` calldata/amount and zero native transaction value; transaction and receipt must agree on block identity. It requires at least two confirmations and checks that the receipt's block hash is still canonical. Successful settlement requires matching outgoing USDC Transfer events totaling the reserved amount. Missing observations or RPC errors retain the reservation. Nonmatching events require review. Reverted matching transfers release principal only after the same identity and confirmation checks.

## Boundaries

This is RPC-reported evidence from one configured provider, not independent RPC quorum verification. Two confirmations are not universal protection against later chain reorganizations. Confirmed results are not automatically revisited for deeper reorganizations. Use the network's required finality policy before enabling real execution.

Only plain ERC-20 USDC transfers are supported. DEX swaps, routers, approvals, fee-on-transfer tokens, vault deposits, repayments, buybacks and burns need dedicated intent/event decoders. This verifier must not label them successful. Gas expenses are not reconciled here; reserves and operating cost accounting must cover them separately.

This is per-bot accounting, not a global wallet ledger: using the same signer/capital across different bot IDs is not yet protected against duplicate attribution or aggregate overspending. Sender ownership, allowlists, funding provenance and installed Circle spending policies remain executor prerequisites. Provider/signed-transaction preparation and broadcasting are outside this service.

## Validation

231 tests passed and production build passed. Tests cover successful and reverted receipts, transaction mismatches, unexpected amounts, RPC failures, insufficient confirmations, canonical-block changes, duplicate tracking, concurrent reconciliation, spent-budget conservation and reserved object-property IDs. No live RPC transaction or Upstash mutation was performed.
