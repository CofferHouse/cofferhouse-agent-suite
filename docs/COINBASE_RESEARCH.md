# Coinbase research adapter

The Holder Center includes a Coinbase spot research panel. It queries the official
Advanced Trade public product endpoint through `GET /api/coinbase/market?product=BTC-USD`.
The fixed allowlist is BTC-USD, ETH-USD, BTC-USDC and ETH-USDC. USD and USDC are never
combined or assumed equivalent. This centralized venue evidence is separate from
Arc lending observations and does not enter Scout's lending policy or rankings.

The adapter checks the exact product, base/quote currencies, SPOT type and positive
decimal price. Missing volume remains unknown. A fixed origin, GET-only upstream,
redirect rejection and 12-second timeout bound the lookup. Responses are not cached
by CofferHouse. `observedAt` is retrieval time, not an exchange price timestamp;
upstream caching and market-data lag are not independently measured.

A user can calculate a hypothetical purchase of up to 10,000 quote currency units.
The calculation is a floating-point approximation at the reference price, before
fees, spread, slippage, market minimums, increments or eligibility checks. It is
not an order preview, backtest, profit forecast or execution-ready quantity.
Observations retrieved more than 60 seconds earlier (or in the future) cannot be
used for a new estimate. An exported estimate retains its calculation and observation
timestamps; its integrity seal does not certify current freshness or price accuracy.

Switching products or starting a refresh clears the previous observation and estimate.
An unavailable response offers no simulation. Exported evidence uses the registered
`cofferhouse.coinbase.research-receipt.v1` schema and can be integrity-verified.
All new panel copy is translated into EN, ZH, JA, HI and ES.

## Authentication and next integration

This is the public-data foundation for a Coinbase integration. No Coinbase account,
OAuth grant, MCP session, key, private balance, order or transfer is connected.
The official Coinbase for Agents MCP/CLI is a separate authenticated layer. A custom
CofferHouse MCP client needs provider approval; registering a client alone does not
grant access. Any later account connection must scope access and verify actual
available tools and eligibility. Public spot research does not establish eligibility
for the derivatives competition. No competition registration is performed here.

Next: authenticated read-only account access where provider permissions support it,
then strategy evaluation with historical data before considering execution.

## Validation

Unit tests cover identity, malformed data, currency isolation, bounded simulation,
stale/future observations, GET-only requests, timeout, upstream failures, forbidden
products/writes, escaping, and receipt tampering. Browser acceptance exercises the
panel, product switch, estimate, evidence download and unavailable state on desktop
and mobile with deterministic API fixtures. Live public BTC-USD retrieval succeeded
during implementation; no private account or trade was accessed.

Official references checked during implementation:
- https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/public/get-public-product
- https://docs.cdp.coinbase.com/ai-agents/coinbase-for-agents/coinbase-mcp

## Local authenticated balance check

Create an ECDSA CDP API key with **View only** for the intended Coinbase Advanced
portfolio. Leave Trade and Transfer disabled. Keep the downloaded key JSON outside
the repository and never share it in chat or upload it to Vercel. Run locally:

```sh
node scripts/coinbase-readonly.mjs /path/to/local-key.json
```

The script first verifies the key's permissions directly with Coinbase and rejects
any key with trade/transfer access or missing permission evidence. It then retrieves
the selected key's accounts and prints available and held amounts by currency.
No private balance is sent to Holder Center. This does not enumerate derivatives
positions. No live account is verified until the owner runs the script with a key.

- https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/data-api/get-api-key-permissions
- https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/accounts/list-accounts
