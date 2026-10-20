# V4 deployment compatibility preflight

`npm run verify:v4` runs read-only deployment checks using the same environment configuration as swap reconciliation. It prints a JSON report and exits 0 for COMPATIBLE or 2 for BLOCKED. RPC URLs, API keys and raw provider errors are never printed. The command does not save a report, edit environment variables, install permissions, sign or send transactions.

## Required reviewed configuration

Keep `ARC_RPC_URL`, `BOT_CHAIN_ID`, `BOT_USDC_ADDRESS` and the existing `BOT_V4_CONFIG`. Extend its JSON object with:

- `stateView`: verified StateView contract address.
- `stateViewCodeHash`: independently reviewed runtime bytecode hash.
- `tokenCodeHashes`: object keyed by lowercase USDC and every output-token address, containing independently reviewed runtime hashes.
- `tokenDecimals`: object keyed by those same addresses, with expected decimals. USDC must be six; this restricted preflight accepts output decimals between 0 and 36.

The existing router/PoolManager hashes, explicit ABI layout, hook-free static-fee PoolKeys and output-token allowlist remain mandatory. No placeholder addresses or actual production environment values are included in this change. The standalone inspector works with a candidate configuration before enabling it; the runtime still additionally requires `enabled: true`.

## Snapshot checks

All code and contract reads use a single block one block behind the reported head. The block must be recent (no more than two minutes old, with thirty seconds of forward-clock tolerance). Its hash is checked again after observation to detect an intervening reorganization.

The inspector verifies RPC chain ID, reviewed router/PoolManager/StateView bytecode hashes, and router/StateView references to the expected PoolManager. Unexpected bytecode stops contract-state reads through those contracts. It then checks token code hashes and decimals.

For each full PoolKey, StateView provides initialization price, fee configuration and active liquidity. Each pool must pair USDC with an allowlisted output token, be initialized, have positive active liquidity and retain its expected static fee with zero protocol fee. Unsupported hooks are rejected by the adapter configuration validator.

## Runtime gate

Configured swap reconciliation now requires a COMPATIBLE preflight before attempting receipt verification. Missing configuration, RPC failure, stale state, empty pool, code mismatch, token mismatch or unsupported fees produce REVIEW and retain the reservation. A pool becoming unsupported can therefore block reconciliation pending operator investigation; it does not trigger an automatic budget release. An old preflight report is not used as permission to bypass current checks.

## Limits

COMPATIBLE is a technical snapshot result, not production readiness, approval, token legitimacy, proof of ABI-layout provenance or an audit. Runtime hash checks do not by themselves verify proxy implementations. Positive active liquidity is not a dollar valuation, executable quote or guarantee that a proposed order meets slippage limits. Pool state can change after inspection. One RPC provider is used; independent-provider verification, live receipt replay/fork testing, chain-specific finality, wallet ownership and spending permissions remain separate requirements.

No live deployment was inspected in this change because reviewed router/pool/token configuration has not been provided. Run the command once the actual deployment is identified; never copy observed hashes into the allowlist merely to make a report pass.

## Validation

252 tests passed and production build passed. New tests exercise pinned-block reads, chain mismatch, absent configuration, stale blocks, unexpected bytecode/manager, wrong decimals, uninitialized/empty pools, fee changes, canonical-block changes, provider failures and CLI blocking. Tests use injected RPC responses; no live RPC, wallet or production configuration was changed.

## Primary contract references

- https://github.com/Uniswap/v4-periphery/blob/main/src/lens/StateView.sol
- https://github.com/Uniswap/v4-periphery/blob/main/src/base/ImmutableState.sol
- https://github.com/Uniswap/v4-core/blob/main/src/libraries/StateLibrary.sol
