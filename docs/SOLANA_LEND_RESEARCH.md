# Solana lending discovery: Jupiter Earn

The Holder Center includes a separate Solana research panel backed by the official
Jupiter Lend Earn token endpoint. Configure a Jupiter developer API key as the
server-only Vercel variable `JUPITER_API_KEY`. No wallet or private key is needed
to query this endpoint. Do not enter this key in the browser or commit it to git.

`GET /api/scout/solana` returns NOT_CONFIGURED without making an upstream request
when the key is absent; FOUND/NO_MATCH distinguish successful lists, and UNAVAILABLE
covers authentication, timeout, upstream and malformed-evidence failures.

The adapter uses a fixed HTTPS origin, GET only, redirect rejection and a 10-second
timeout. It bounds the list at 200 entries, checks 32-byte base58 key syntax, preserves
case, and verifies agreement between the underlying mint fields. It does not verify
the program owner or mint account onchain; those are prerequisites for stronger
verification claims. A mint's public-key syntax does not prove authenticity.
No protocol code or external skill was copied or installed.

## Rate and liquidity evidence boundary

The current documentation's example shows rates such as 0.025 and 0.035, while its
schema describes supply/reward rates as using 1e4 decimals. This implementation
retains raw rate strings but deliberately withholds normalized APY and rankings
until an authenticated live response and units can be reconciled independently.
It also retains totalAssets/totalSupply as integer strings; neither is treated as
withdrawable liquidity or converted to USD. Token identification is separate from
the lending receipt mint. The API base route scopes this research to Solana mainnet;
the provider's asset.chain_id value is not used as an EVM chain identifier.

The visible panel shows returned underlying/lending mints and retrieval timestamps.
When assets are found, it exports a JSON receipt with the observed mints, raw provider
values and timestamps. The receipt verifier checks its integrity hash, not the
authenticity of the upstream source. No receipt is offered without observations.
No transactions, wallet connection, paid data requests, portfolio allocation or
Guardian watch registration is enabled for Solana in this release.

## Validation / activation

Unit tests cover mint syntax, case/identity handling, duplicates, raw units,
unknown metrics, missing key without network access, fixed request destination,
redaction, upstream errors, timeout and non-GET rejection. Desktop/mobile browser
acceptance checks the unconfigured state. An authenticated live lookup has not
been performed: activate the server variable, redeploy and inspect a real response
before presenting Solana as a verified opportunity source.

Official references reviewed:
- https://developers.jup.ag/docs/api-reference/lend/earn/tokens
- https://developers.jup.ag/docs/lend/earn/api
- https://developers.jup.ag/docs/lend/program-addresses

Next: verify live token/rate units, validate program and mint accounts on Solana,
add independently sourced withdrawal liquidity, then user filters and monitoring.
Pay.sh remains a separately reviewed data-payment candidate; it is not installed.
