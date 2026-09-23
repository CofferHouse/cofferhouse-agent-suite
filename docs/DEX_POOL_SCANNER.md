# DEX Pool Scanner

DEX Pool Scanner expands CofferHouse beyond lending markets. Users add an Arc token by its full EVM contract address, optionally mark it as an explicitly accepted speculative asset, and request indexed Arc pool observations.

## Why contracts are required

Symbols and names are not unique. The watchlist stores normalized contract addresses in the current browser so a user does not accidentally research an imitation token with the same ticker.

## Current evidence

- pool and token contract identity;
- DEX identifier;
- reported USD liquidity;
- reported 24-hour volume;
- 24-hour buys and sells;
- 24-hour price change;
- pool age when available;
- modeled swap size divided by reported liquidity;
- user-selected speculative label.

The pool index adapter uses DEX Screener for discovery. CofferHouse filters results to Arc identifiers and fails closed when the provider returns malformed data. The optional official Uniswap quote adapter supports Arc chain ID `5042`, exact-input USDC research quotes, route type, minimum raw output, configured slippage, gas estimate and upstream simulation failure evidence. It requires a server-side `UNISWAP_API_KEY`. The deterministic liquidity ratio remains visible and is explicitly not presented as a quote.

## Important boundary

`USER-APPROVED SPECULATIVE` records the user's research scope. It never changes a `REVIEW` or `REJECT` result. Token taxes, transfer restrictions, sellability, holder concentration, contract controls and independent security evidence remain mandatory review items until verified by dedicated adapters.

Lending APY and LP fee yield are different measurements. They are not merged or compared as if they represented the same risk.

## DEX Opportunity Agent

After screening, DEX Opportunity applies user-controlled minimum pool score, liquidity and 24-hour volume, plus maximum price movement and modeled liquidity impact. It may retain a `REVIEW` pool only when the user explicitly enables that scope; every original warning remains attached. An official Uniswap quote adds route evidence but cannot erase a blocker.

The ranked result is research prioritization, not an instruction to trade. Its preferences persist in the current browser and its receipt is SHA-256 sealed so later changes invalidate verification.

## DEX Strategy Lab

DEX Strategy consumes only candidates marked `ELIGIBLE_FOR_DEX_RESEARCH`. The user selects modeled capital, reserve, number of pools, concentration and one of two separate modes:

- **Swap research:** proposes bounded hypothetical amounts and identifies which positions have official route evidence. Every route must be quoted again before a separately authorized action.
- **LP research:** proposes research allocations but does not claim an APY without verified fee history. It displays a full-range constant-product impermanent-loss reference for 0.5x, 2x and 4x price ratios; concentrated liquidity may behave materially differently.

Both modes cap a position at 1% of observed pool liquidity, remain read-only and produce a separate verifiable receipt. They never connect a wallet, approve tokens, sign or submit a transaction.
