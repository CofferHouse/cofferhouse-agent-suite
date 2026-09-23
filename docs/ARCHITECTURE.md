# Scout Architecture

This document describes the deployed read-only MVP architecture and clearly separates implemented components from future work.

## Components

### 1. Market adapters

Small, isolated adapters read supported Arc contracts, RPC endpoints or indexed APIs. Each adapter must return normalized data together with its source and timestamp.

### 2. Normalization layer

Transforms provider-specific responses into a common market schema. No score should depend directly on an undocumented third-party response.

### 3. Deterministic policy engine

Applies versioned rules to normalized data. The policy result must be reproducible without an LLM.

### 4. Explanation layer

Converts the score breakdown and triggered policies into clear language. An AI-generated explanation may improve readability, but it cannot override the deterministic result.

### 5. Web application

Displays the market, score, inputs, sources, warnings and explorer links. Wallet connection is optional for the read-only MVP.

### 6. Bounded Scout Agent

Runs the same versioned policy across every loaded market, ranks the results and exposes the first reason requiring attention. It cannot custody funds, sign transactions or override the deterministic policy result.

### 7. Scout Receipt

Exports a versioned JSON record containing the active policy, market observations, results, reasons and a deterministic receipt identifier. The receipt is an audit artifact, not an onchain attestation or cryptographic signature.

### 8. Optional onchain record

If useful for the hackathon, Scout may publish a compact record containing a report hash, policy version and timestamp. Raw market data should not be stored onchain unnecessarily.

### Read-only action simulator

The simulator applies a hypothetical borrow to the normalized market snapshot, recomputes available liquidity and utilization, and evaluates the projected market with the selected policy. It creates no calldata, wallet request, signature or transaction.

Successful simulations can be exported through `cofferhouse.scout.simulation-receipt.v1`, which records the market, proposed amount, selected policy and before/after evaluation.

## Trust boundaries

- Third-party data can be incomplete, delayed or incorrect.
- RPC responses must be validated before scoring.
- Unknown contracts fail to REVIEW or REJECT.
- AI output is never a source of market truth.
- Private keys must never be exposed to the frontend.
- No transaction is sent without explicit user authorization.

## Proposed repository structure

```text
apps/
  web/                 # User interface
packages/
  market-schema/       # Normalized types and validation
  adapters/            # Arc market/data adapters
  policy-engine/       # Deterministic scoring rules
  explanations/        # Human-readable report generation
contracts/             # Optional report registry/attestation
docs/                  # Public specifications
```

## Prototype implementation

- `src/morpho.js` queries and normalizes listed Morpho markets on Arc chain ID `5042`.
- `src/markets.js` contains normalized demonstration observations used only as a safe fallback.
- `src/policy.js` contains the versioned deterministic policy and evaluation engine.
- `src/agent.js` scans and ranks all normalized markets without execution permissions.
- `src/receipt.js` creates the deterministic, downloadable Scout Receipt.
- `src/simulator.js` projects bounded borrow impact without execution.
- `src/main.js` renders the report and plain-language explanations.
- `test/agent.test.js` verifies bounded ranking and explanation behavior.
- `test/morpho.test.js` verifies API filtering, normalization and safe failure.
- `test/policy.test.js` verifies PASS, REVIEW, REJECT and reproducibility.
- `test/receipt.test.js` verifies receipt completeness and determinism.

The live adapter is deliberately isolated from the policy engine. Provider outages fall back to visibly labeled demonstration observations, and missing live risk inputs are routed to `REVIEW` instead of being invented or silently treated as safe.

## Open technical decisions

- direct RPC verification in addition to the indexed Morpho source;
- whether the MVP needs a wallet connection;
- whether a report hash should be written to Arc mainnet;
- evidence and calibration for production policy thresholds;
- final application stack.
