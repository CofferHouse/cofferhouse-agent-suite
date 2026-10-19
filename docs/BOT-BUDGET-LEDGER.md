# Durable bot budget reservations

The protected `POST /api/bots/budget` endpoint manages reservation accounting in Upstash Redis. It requires `SCOUT_OPERATOR_TOKEN` and a configured durable store. It never creates, signs or submits transactions.

## Authorization window

Initialize one immutable budget for a stable bot ID. It starts paused. The authorization must expire within 24 hours. Explicitly resume it to accept new reservations. Each action checks the stored caps and protected reserve; requests cannot replace them. There is no automatic midnight reset, policy overwrite, TTL, renewal or budget deletion. Reusing the same bot ID cannot erase its history. Provisioning another ID does not establish additional real capital; account-wide funding and ownership checks remain a future executor responsibility.

Example initialization body (illustrative amounts, not a project allocation):

```json
{
  "action": "initialize",
  "botId": "ddca_bot_01",
  "policy": {
    "perActionCapUsdc": "10",
    "periodCapUsdc": "50",
    "balanceUsdc": "100",
    "reserveUsdc": "50",
    "expiresAt": "<ISO timestamp within the next 24 hours>"
  }
}
```

`resume` and `pause` take the bot ID. `reserve` additionally takes a unique `operationId` and decimal-string `amountUsdc`. `release` takes the bot and operation ID and is only for plans that have never been submitted. The service has no executor or submission path. Its new `track` action records the hash and exact transfer intent before external broadcast; tracked operations cannot be manually released. See `TRANSFER-RECONCILIATION.md`.

## Atomicity and retries

Each mutation uses a single Redis Lua compare-and-set against the full serialized prior ledger. CAS failures retry at most 12 times. Reservations use integer micro-USDC strings; Redis never performs floating-point currency arithmetic.

Two requests reading the same version cannot both commit it. Replaying the same operation ID and amount returns the original reservation without increasing the total. The same ID with a different amount is rejected. Released IDs cannot be reused. Duplicate releases do not decrement twice. A lost network response is reconciled by retrying the exact same operation ID; do not invent a new ID after a timeout. A reservation replay acknowledges accounting, even after pause/expiry, and never authorizes submission.

At most 500 operation records are retained per ledger; exceeding this blocks further reservations rather than discarding idempotency history. Pause and expiry stop new reservations. Neither expiry nor process restarts release reserved funds implicitly.

## Boundaries before execution

Balances are operator-declared. This is not an onchain balance check, installed Circle wallet permission, cross-bot aggregate wallet limit, daily rolling spend meter or settled spending ledger. Real bot execution still needs wallet-bound funding verification, chain and contract allowlists, quote freshness/slippage checks, installed spending permissions, irreversible submission state and receipt reconciliation. Direct USDC transfers now support RPC receipt reconciliation; transaction execution remains disabled.

## Validation

224 tests passed, including competing reservations, concurrent duplicate IDs, a lost response after successful persistence, duplicate releases, pause/expiry/caps, CAS contention and protected endpoint failures. The Redis command shape is tested; concurrency behavior uses an injected atomic CAS store. No live Upstash mutation or live wallet execution was performed. Production build passed.
