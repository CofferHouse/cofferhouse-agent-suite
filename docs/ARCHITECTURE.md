# Scout Architecture

This document describes the deployed read-only MVP architecture and clearly separates implemented components from future work.

## Components

### 1. Market adapters

Small, isolated adapters read supported Arc contracts, RPC endpoints or indexed APIs. Each adapter must return normalized data together with its source and timestamp.

### 2. Normalization layer

Transforms provider-specific responses into a common market schema. No score should depend directly on an undocumented third-party response.

When `ARC_RPC_URL` is configured, the server agent independently calls `eth_getCode` for each unique loan asset, collateral, and oracle address. This confirms that referenced contracts contain deployed bytecode without pretending that contract existence is a second price feed. RPC failure is recorded as unavailable and does not get silently converted into verification.

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

Successful simulations can be exported through `cofferhouse.scout.simulation-receipt.v2`, which records the market, proposed amount, selected policy, before/after evaluation, and SHA-256 integrity metadata.

### Snapshot monitor

The in-session monitor compares consecutive live snapshots by market ID. It flags listing changes, policy-result transitions, liquidity changes of at least 5% and utilization changes of at least two percentage points. Small market noise is intentionally ignored.

### Agent session runtime

Agent Mode runs a bounded lifecycle without repeated operator clicks: observe live Arc data, evaluate every market, detect material changes, decide whether to watch/review/escalate, and record the observation. The operator controls its cadence and can stop it at any time. The browser runtime is intentionally labeled as session-scoped; the separate server runtime provides unattended scheduling, durable memory, and outbound notification delivery when deployment credentials are configured.

### Durable server runtime

`/api/agent/run` executes the same shared agent cycle without a browser, authenticates scheduled invocations with `CRON_SECRET`, and stores the latest snapshot plus the 100 most recent cycles in Upstash Redis. `/api/agent/status` exposes a read-only operational status and non-secret capability flags for the dashboard. Vercel invokes the included daily safety schedule; the included GitHub Actions workflow calls the same protected endpoint every 15 minutes without changing the policy engine.

Material `REVIEW` and `ESCALATE` decisions can be delivered to a protected webhook. Alerts carry deterministic fingerprints and the runtime stores the last successfully delivered alert, preventing the same condition from being sent on every cycle.

Provider requests have explicit timeouts and typed failure diagnostics (`timeout`, `network_error`, `http_error`, `graphql_error`, `invalid_response`, `empty_result`, or `normalization_error`). A failed cycle is persisted as a visible degraded state with retryability metadata instead of being mistaken for a valid market decision.

### Bounded intelligence layer

For new material incidents, an optional Gemini Interactions API adapter creates a structured operator briefing. Its output is schema-validated and its recommended action is restricted to `MONITOR`, `HUMAN_REVIEW`, or `PAUSE_AUTOMATION`. Gemini cannot change deterministic policy results, invent an execution, sign, or transact. Missing credentials or any model/API/validation failure falls back to a deterministic briefing and is recorded visibly.

### Human acknowledgment

Active material alerts can be acknowledged through `/api/agent/acknowledge` only with a protected operator token. The acknowledgment records the alert fingerprint, operator, time, and optional note in durable storage. The token is never persisted by the browser, and the agent cannot acknowledge its own alert.

### Verifiable receipts

Version 2 Scout and simulation receipts are serialized with a stable canonical JSON format and sealed with SHA-256. Their identifier is derived from the same digest. `/api/receipt/verify` independently recalculates the digest and rejects modified content. This provides tamper evidence but is not a digital signature or proof that a receipt was published onchain.

`contracts/ScoutReceiptRegistry.sol` defines the optional Arc publication layer. It stores only hashes, publisher addresses, and timestamps. The source and ABI are included for review, but no deployment is claimed until independently compiled, reviewed, and explicitly authorized by the operator.

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
- `src/monitor.js` detects material differences between consecutive live snapshots.
- `src/agent-runtime.js` implements the explicit agent lifecycle and bounded decision states.
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
