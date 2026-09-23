# Proposed Architecture

This document describes the intended MVP architecture. It is a proposal, not a deployed system.

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

### 6. Optional onchain record

If useful for the hackathon, Scout may publish a compact record containing a report hash, policy version and timestamp. Raw market data should not be stored onchain unnecessarily.

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

- `src/markets.js` contains normalized demonstration observations.
- `src/policy.js` contains the versioned deterministic policy and evaluation engine.
- `src/main.js` renders the report and plain-language explanations.
- `test/policy.test.js` verifies PASS, REVIEW, REJECT and reproducibility.

The demonstration adapter is deliberately isolated from the policy engine so a live Aave, Morpho or direct-RPC adapter can replace it without changing scoring behavior.

## Open technical decisions

- first live supported Arc market and protocol;
- direct RPC versus indexed data source;
- whether the MVP needs a wallet connection;
- whether a report hash should be written to Arc mainnet;
- policy thresholds and their evidence;
- deployment provider;
- final application stack.
