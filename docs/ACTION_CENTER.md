# Action Center

Action Center is the explicit boundary between CofferHouse research and any possible future wallet action. It consumes one modeled Lending or DEX Strategy position and creates a readable intent. It does not connect a wallet, request an allowance, create calldata, sign or submit a transaction.

## What it checks

- Arc network and chain ID `5042`;
- complete market or pool identity;
- positive bounded modeled amount;
- source Strategy receipt identity;
- source-specific evidence, including Scout status or official DEX route availability;
- every component still missing before real execution.

The user performs one informed approval. That single confirmation records that the preview does not execute, visible risks were presented and a fresh simulation is required before any future signature. It expires after 15 minutes and authorizes only a later manual preparation step.

The Action receipt is SHA-256 sealed and states `prepared: false`, `signed: false` and `submitted: false`. Altering any field invalidates the receipt.
