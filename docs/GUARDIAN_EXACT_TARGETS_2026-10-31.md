# Guardian exact-target lookup — 31 October 2026

Durable Guardian previously searched for watched lending markets inside Scout's
ranked discovery response, which contains at most 20 listed Arc markets. A watched
market falling out of that ranking could be treated as missing even if it still
existed in the index.

## Change

The scheduler now reads two independent evidence sets in parallel:

- Scout keeps its existing ranked/listed discovery universe.
- Guardian issues one bounded GraphQL query with up to 20 exact `marketById`
  aliases, each explicitly scoped to Arc chain 5042. No listed filter or volume
  ranking is applied to the watched targets.

Each alias validates the returned market ID and chain before normalization. A
failure for one alias does not invalidate another successful target. Unsupported
identities, response omissions, malformed data, HTTP errors, GraphQL errors and
timeouts remain source diagnostics rather than zero amounts or market deletion.

Durable evaluation uses the exact lookup exclusively. It cannot silently fall
back to a ranked observation when the exact query failed. A null indexed result
or unavailable source produces `REVIEW`, with no healthy or disappearance claim.
Successfully observed markets still use the existing deterministic policy and
Guardian thresholds; unlisted status is not promoted to approval.

Legacy callers that do not supply exact observations retain their existing
missing-target behavior. The scheduled server supplies exact observations, even
when empty. Watch registration, recipients, delivery configuration, limits and
financial authority are unchanged. Existing RPC contract-code checking remains
scoped to Scout observations; the exact API lookup is not independent RPC proof.

## Evidence and validation

The live schema confirmed `marketById(marketId: String!, chainId: Int!)`. A read-only
lookup of Arc market
`0xc2db905f174e5defcce01d321b09f15f78856a36a21b90cc7e1abbc29225815d`
returned `FOUND` with chain 5042. [The capture](GUARDIAN_TARGET_LOOKUP_2026-10-31.json)
records that normalized observation. No watch registration, protected scheduler
run, notification or transaction was invoked to collect it.

All 310 unit tests and the production build passed locally. New regressions cover
targets outside Scout's ranking, per-alias failures, null/missing results, wrong
identities/chains, timeouts, bounded requests and no healthy fallback on errors.
Production scheduler behavior is not established by manually triggering it here.

This fixes lending-target observation before expanding vault monitoring. It does
not add durable vault allocation watches, recursive vault exposure, or onchain
Guardian/Sentinel permissions.

Sources checked 31 October 2026:

- https://api.morpho.org/graphql — live schema and read-only query
- https://docs.morpho.org/developers/api/get-started/
