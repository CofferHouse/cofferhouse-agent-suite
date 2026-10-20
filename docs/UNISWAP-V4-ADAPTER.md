# Restricted Universal Router v4 adapter

This adds a protocol-specific verifier behind the shared swap reconciliation layer. It does not broadcast, sign, approve tokens or create a live deployment configuration. No mainnet addresses have been guessed or enabled.

## Accepted shape

Only `execute(bytes,bytes[],uint256)` with exactly one V4 swap command, followed by one exact-input-single action, settle-all and take-all is accepted. The recipient must be the sender. Additional commands, allow-revert flags, approvals, multicalls, subplans, native-token paths and extra ABI bytes are rejected. Calldata must be canonically encoded. Limits and deadline must respect the pre-recorded intent.

Pools are explicitly allowlisted by their full PoolKey hash. This version allows only sorted ERC-20 currencies, static fees, positive tick spacing, no hooks and empty hook data. It supports either token ordering. It must not be used to claim support for arbitrary launchpad hooks or dynamic-fee pools.

The decoder's layout is selected explicitly:

- `legacy`: ExactInputSingleParams without a per-hop price field, as in the official swapping guide.
- `min-hop-price`: includes `minHopPriceX36`, present in the inspected v4-periphery interface at commit `9969eec44cfdf07e24b41de47f40276a58401976`.

There is no ABI guessing or fallback. Match the configured layout to verified deployed router code. A nonzero per-hop price bound is preserved in the hashed calldata and enforced by the matching router implementation.

## Receipt and code evidence

The adapter queries router and PoolManager runtime bytecode at the receipt block and compares hashes with reviewed configuration. A successful receipt must contain exactly one Swap event from that PoolManager, identifying the approved pool and router initiator, with the expected direction, input cap and minimum output. This conservative verifier currently requires the event fee to equal the static PoolKey fee; fee-policy changes may require review rather than confirmation.

The shared verifier additionally checks transaction identity, calldata hash, finality/canonical block and net ERC-20 flows. Protocol events alone cannot confirm settlement. Matching reverted transactions still need valid calldata, deployment hashes and shared finality checks, but do not require successful Swap events.

This relies on one RPC provider. Historical code support is required; unavailable observations retain the reservation. Proxy upgrades, native currencies, multi-hop/mixed routes, hooks and nonstandard tokens are outside scope. Bytecode hashes must be obtained from independently verified deployment information; an allowlist is not an audit.

## Explicit server configuration

In addition to `BOT_CHAIN_ID`, `BOT_USDC_ADDRESS` and HTTPS `ARC_RPC_URL`, `BOT_V4_CONFIG` must be a JSON object containing:

- `enabled: true`
- `router`, `poolManager`
- `routerCodeHash`, `poolManagerCodeHash`
- `layout`: `legacy` or `min-hop-price`
- `pools`: reviewed PoolKey objects with currency0, currency1, fee, tickSpacing and zero hooks
- `outputTokens`: exact reviewed output-token contract addresses

The stored swap intent selects adapter `uniswap_v4_single`. Runtime reconciliation additionally runs the deployment preflight documented in `V4-DEPLOYMENT-PREFLIGHT.md`; StateView and reviewed token hashes/decimals are now required. Missing or invalid configuration fails closed. No production environment values were changed. A live COFFERS deployment/pool must be inspected before configuring it. If its pool uses hooks, this adapter intentionally rejects it.

## Verification

246 tests passed and production build passed. New synthetic ABI/receipt tests cover both layouts and directions, unknown flags/actions, canonical encoding, budget/output/deadline violations, wrong pool/sender/event, codehash mismatches, reverted transactions and integration with shared net-flow checks. The known execute selector is asserted. No live successful/reverted DEX transaction was replayed, no local EVM fork was run and no real swap was sent. Real deployment fixtures/fork tests remain necessary before enabling production settlement.

## Primary references

- https://developers.uniswap.org/docs/protocols/v4/guides/swapping/swapping
- https://developers.uniswap.org/docs/protocols/universal-router/concepts/commands
- https://github.com/Uniswap/v4-periphery/blob/9969eec44cfdf07e24b41de47f40276a58401976/src/interfaces/IV4Router.sol
- https://github.com/Uniswap/v4-periphery/blob/9969eec44cfdf07e24b41de47f40276a58401976/src/V4Router.sol
- https://github.com/Uniswap/v4-periphery/blob/9969eec44cfdf07e24b41de47f40276a58401976/src/libraries/Actions.sol
- https://github.com/Uniswap/v4-core/blob/main/src/interfaces/IPoolManager.sol
