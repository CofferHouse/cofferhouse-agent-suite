# Morpho vault allocation research

Opportunity Agent now offers **Inspect vault allocations** for Morpho vaults
returned by Earn Kit. The panel reads configuration, total/withdrawable assets
and market or adapter allocations from Morpho's public REST API on Arc (5042).
It also exports a sealed, registered evidence receipt.

## Implemented behavior

- V1 and V2 config endpoints are queried independently. Exactly one must identify
  the requested vault; addresses, chain and version are checked before use.
- V1 displays market allocations. V2 counts each adapter-level balance once;
  market, adapter and unscoped risk caps remain separate overlapping constraints.
  Nested vaults are identified when reported but not recursively expanded.
- Raw amounts remain integer strings and display in the vault asset's units.
  Missing values stay unknown. No token/USD conversion or portfolio allocation is
  made by this feature.
- Every response retains its source block. Combined allocation/concentration
  evidence is withheld if config, state and allocations are not block-aligned.
  Inconsistent totals remain partial even when the source blocks match.
- Owner and curator are displayed. Allocator enumeration and collateral/oracle
  look-through are not implemented by this adapter. V1 idle assets remain unknown.
- Comparing later, block-aligned and reconciled observations in the same browser
  session can flag owner/curator/guardian changes, lower withdrawal coverage and
  increased concentration. This is manual research, not a durable Guardian watch,
  Telegram alert or onchain Sentinel role.

The endpoint is `GET /api/app-kits/vault-exposure?vault=0x...`. It always targets
the fixed Morpho API origin on Arc, rejects invalid inputs and redirects, and has
a 12-second upstream request deadline. No API key or wallet connection is needed.

## Live capture — 28 October 2026

Earn Kit returned the Arc USDC vault
`0x8e357432cc12ff425c36432f312968aeb16112af`. The new adapter retrieved a V2
observation with one adapter. The config source was block 28379490; state and
allocation sources were block 28379491. The result correctly remained
**PARTIAL_EVIDENCE**, with no reconciled total or concentration claim.

The exact normalized capture is [the sealed receipt](VAULT_EXPOSURE_LIVE_2026-10-28.json).
An integrity seal detects edits; it does not establish source accuracy or current
freshness. Index lag is not measured against a live RPC block in this release.

Reproduce using a current Arc vault address from Earn discovery:

```sh
node scripts/capture-vault-exposure.mjs VAULT_ADDRESS output.json
```

The capture script is read-only. The returned index blocks, allocations and status
will change over time. Unsupported/unindexed vaults fail visibly; the adapter does
not substitute another chain or a sample observation.

## Validation and next work

`npm run check` passed 278 tests and the production build. Cases cover V1/V2,
overlapping caps, unknown amounts, unscoped caps, mixed blocks, missing metadata,
duplicate identities, role/liquidity comparisons, receipt tampering, escaping and
unavailable upstream sources. Frontend wallet/browser acceptance remains pending.

Next: obtain independently block-pinned exposure evidence, add allocator and
collateral/oracle look-through, and integrate an explicitly approved baseline into
durable Guardian monitoring. Gateway remains a separate next integration. No
deposit, withdrawal, asset permission or execution is introduced here.

Official API references checked 28 October 2026:

- https://docs.morpho.org/api/vaults-v1/get-v1-vault/
- https://docs.morpho.org/api/vaults-v1/get-v1-vault-state/
- https://docs.morpho.org/api/vaults-v1/get-v1-vault-allocations/
- https://docs.morpho.org/api/vaults-v2/get-v2-vault/
- https://docs.morpho.org/api/vaults-v2/get-v2-vault-state/
- https://docs.morpho.org/api/vaults-v2/get-v2-vault-allocations/
