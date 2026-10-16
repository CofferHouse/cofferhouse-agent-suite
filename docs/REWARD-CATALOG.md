# Holder Center reward periods

The membership rehearsal panel now loads `/rewards/testnet-catalog.json` and lets
the wallet select an existing period. Only the real Arc Testnet period 1 is listed.
The production collection and mainnet actions are unchanged.

Catalog schema: `cofferhouse-reward-catalog-v1`, with `chainId`, `membership`,
`distributor` and `periods`. Each entry supplies a positive decimal-string `epoch`,
`token`, plain-text `symbol` and same-origin `/rewards/*.json` manifest path.
The symbol is a catalog display label; the token address is also shown to the user.

The panel checks catalog network/collection/distributor and rejects duplicates,
external URLs, path traversal and malformed entries. It defaults to the newest
listed epoch and preserves a previously selected older epoch when refreshing.

An entry is not proof of an allocation. For the selected period, the panel checks
the manifest domain against the entry, reads the epoch at the verified block, and
compares the exact file hash, root, snapshot block, budget and total points to the
published contract state. The wallet proof is verified before enabling a claim.
Review delay, pause and claimed status are read separately for each period.
The reward token's own decimals are used, independently of TESTCOFFERS decimals.

Changing period clears the previous reward state. Changing account or network
invalidates the loaded data. Writes remain locked to Arc Testnet and require a
fresh read and contract simulation. Claiming never requests ERC20 allowance.

To add a real subsequent testnet period, first complete the reviewed publication
workflow in the contracts repository, host its exact manifest bytes, then add its
entry to the testnet catalog. An unpublished or mismatched entry fails verification.
Do not add mainnet addresses to this catalog. Production configuration and wallet
end-to-end testing remain separate launch requirements.
