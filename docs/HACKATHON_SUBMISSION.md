# CofferHouse Scout — submission brief

## One-line pitch

CofferHouse Scout is a bounded, read-only risk agent for Arc markets that autonomously observes, verifies, evaluates, compares, decides, records, and alerts without custody or transaction authority.

## Problem

Onchain market listings expose data, but users still need to decide whether liquidity, utilization, contract status, freshness, oracle coverage, volatility information, and data completeness fit their risk boundaries. A dashboard can display those numbers; Scout continuously turns them into a reproducible decision trail.

## Working solution

- Loads listed Morpho markets on Arc mainnet.
- Normalizes every market into one documented schema.
- Applies one of three visible, versioned policy profiles.
- Ranks all markets and exposes the first failing or review condition.
- Compares consecutive observations using configurable material-change limits.
- Simulates a hypothetical borrow for every loaded market without creating a transaction.
- Runs in the browser for interactive monitoring and on the server for unattended monitoring.
- Persists up to 100 server cycles and exposes the latest execution trace.
- Filters Scout evidence through user-defined Opportunity limits and produces a verifiable research shortlist.
- Turns eligible evidence into a bounded Strategy Lab proposal with reserve, concentration limits, review conditions and a verifiable receipt.
- Independently confirms referenced contract bytecode through Arc JSON-RPC when configured.
- Sends deduplicated material alerts and requires protected human acknowledgment.
- Produces tamper-evident Scout and simulation receipts with SHA-256 verification.
- Optionally asks Gemini for a bounded incident briefing; the model cannot change policy results.

## Why it is an agent

Scout has an explicit loop and state:

1. **Observe** — request and normalize fresh Arc market observations.
2. **Verify** — independently check referenced contract bytecode through Arc RPC.
3. **Evaluate** — apply the selected deterministic policy to every market.
4. **Compare** — detect material changes against durable memory.
5. **Decide** — choose `WATCH`, `REVIEW`, or `ESCALATE` inside a fixed action boundary.
6. **Record** — seal and persist the cycle, then notify only when required.

It is intentionally not an execution bot. Its autonomy concerns observation, analysis, memory, incident routing, and reporting. Custody, signing, and transactions are outside its permissions.

## Trust model

| Layer | Authority |
|---|---|
| Morpho adapter | Supplies listed-market observations |
| Arc RPC check | Confirms referenced addresses contain deployed bytecode |
| Deterministic policy | Owns PASS, REVIEW, REJECT, score, and warnings |
| Gemini briefing | May summarize evidence; cannot alter the policy decision |
| Human operator | Acknowledges incidents using a protected server token |
| Scout | Cannot hold funds, sign, prepare calldata, or execute |

Contract existence is not presented as a second price source. Missing volatility data or insufficient independent pricing remains visibly routed to human review.

## Suggested three-minute demonstration

1. Open the live page and identify the live Arc market count.
2. Show the all-market ranking and switch the policy profile.
3. Select two markets and compare why their results differ.
4. Enter a hypothetical borrow, run the simulation, and show its before/after result.
5. Download the simulation receipt, verify the JSON file, then explain that modifying a field invalidates its hash.
6. Start the session agent and show its current phase and next cycle.
7. Show the server agent status, independent RPC result, durable history, and six-step execution trace.
8. Close by stating the boundary: no custody, no signature, no execution.

## Technical evidence

- Public application: <https://cofferhouse-scout.vercel.app/>
- Source repository: <https://github.com/CofferHouse/cofferhouse-scout>
- Automated tests: run `npm test`
- Production bundle: run `npm run build`
- Deployment instructions: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Architecture and trust boundaries: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Optional receipt registry source: [`../contracts/ScoutReceiptRegistry.sol`](../contracts/ScoutReceiptRegistry.sol)

## Honest limitations

- Protocol listing is not CofferHouse approval.
- Contract bytecode verification does not prove oracle correctness or economic safety.
- A second independent price feed and verified volatility feed are not yet connected.
- The included receipt registry has not been claimed as deployed or audited.
- Alerts, durable memory, Gemini, and human acknowledgment require deployment credentials.
- Scout is experimental research software and not financial advice.

## Submission checklist

- [ ] Confirm the live deployment uses the final repository commit.
- [ ] Configure durable memory and run the protected scheduler manually once.
- [ ] Confirm the dashboard shows a recent server cycle and execution trace.
- [ ] Record a short demo using the sequence above.
- [ ] Capture one valid receipt verification and one intentionally modified failure.
- [ ] Add the final team description, contact, and hackathon-specific fields.
- [ ] Verify every claim against the live deployment before submitting.
