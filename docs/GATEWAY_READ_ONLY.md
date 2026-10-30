# Gateway multi-asset research — 30 October 2026

Holder Center now includes a Gateway panel with two explicit actions: query
network support, or query confirmed Gateway deposits for the connected EVM
address. Both are read-only. No deposit, burn intent, spend, conversion, signature,
approval, transfer or treasury asset permission is introduced.

## Source and accounting

- Fixed mainnet origin: `https://gateway-api.circle.com/v1/`.
- `GET /info` supplies per-domain wallet/minter contract addresses and supported
  tokens. Source-wallet and Arc destination-minter support must both be reported
  before a source is described as supported by the API. This is not a fee quote
  or proof that a transfer could execute.
- `POST /balances` is a read-only query. Every request explicitly supplies one of
  `USDC`, `EURC` or `cirBTC` and the requested EVM depositor/domain pairs.
- USDC and EURC use six decimals; cirBTC uses eight. Decimal strings are converted
  to integer units with BigInt and summed only within one asset. No floating-point
  aggregation, cross-asset sum, exchange rate or USD valuation is used.
- Missing, malformed or identity-mismatched observations do not become zero.
  Missing source coverage suppresses totals. A reported zero remains a real zero
  for that query; failures remain unavailable and do not erase other asset results.
- Gateway deposits differ from token balances held directly in a wallet. Pending
  deposits and pending batches are not included. Results cover the same address
  on known EVM domains; they exclude Solana and unknown future ecosystems.
- Wallet-provider account/network/disconnect events clear the Gateway panel.
  Account identity is checked before and after balance requests, and superseded
  requests cannot repopulate the panel. Chain-specific smart accounts may have
  other depositor addresses that this same-address query does not discover.

The public first-party endpoint is `GET /api/app-kits/gateway`, optionally with
`?depositor=0x...`. It rejects invalid inputs and writes and uses `Cache-Control:
no-store`. Upstream calls reject redirects and share a 12-second deadline. The
browser has a 15-second fetch deadline. No Circle API key is needed or exposed.

## Live smoke capture

[The sealed capture](GATEWAY_LIVE_2026-10-30.json) records a live mainnet `/info`
response and balance queries for the **zero address**, not a user wallet. Gateway
reported 13 domains. All three asset queries returned observed zero balances.
This proves that coverage and balance queries worked at capture time; it does
not establish funded routing, token contract identity, fees or transaction timing.
The export contains normalized evidence, not a block-pinned RPC snapshot.

```sh
node scripts/capture-gateway.mjs output.json
node scripts/capture-gateway.mjs output.json EVM_DEPOSITOR
```

The first command requests coverage only. The second also queries balances;
neither can sign or move assets. The SDK was not upgraded: this bounded adapter
uses Gateway's documented public API directly.

## Validation and integration

This change is stacked on the Morpho vault allocation implementation (PR #17).
The combined tree passes 289 tests and the production build. New tests cover
six/eight-decimal precision, asset/chain support, missing values, duplicate and
mismatched identities, mainnet isolation, partial service failures, fixed API
paths, endpoint caching and receipt integrity. User-facing controls and notices
are translated into the existing five languages.

Browser acceptance and deployment remain pending. Future funding execution needs
current token/contract verification, source/destination selection, a fresh fee
estimate, wallet authorization and result reconciliation. Current docs differ on
EURC forwarding support between the raw Gateway API and App Kit overview; no
forwarding readiness or FAST deposit support is inferred from this balance reader.
CCTP observation remains a separate feature.

Official references checked 30 October 2026:

- https://developers.circle.com/gateway/references/supported-blockchains
- https://developers.circle.com/gateway/concepts/non-usdc-assets
- https://docs.arc.io/app-kit/unified-balance
- https://docs.arc.io/app-kit/tutorials/unified-balance/check-unified-balance
- https://gateway-api.circle.com/v1/info
