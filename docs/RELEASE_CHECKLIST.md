# Near-final release checklist

## Automated gates

- [x] Deterministic policy, monitoring, simulation, receipts, runtime, security helpers, RPC checks, retry logic, and API handlers have automated tests.
- [x] `npm run check` runs the complete test suite and production build.
- [x] Provider failures are typed, retryable where appropriate, and visible as degraded state.
- [x] Receipt JSON survives serialization and detects later modification.
- [x] Frontend provider, model, and operator strings are escaped before rendering.
- [x] External links allow HTTPS only.
- [x] Server credentials are never included in the frontend environment.

## Deployment gates

- [ ] Upload the near-final source to the default GitHub branch.
- [ ] Confirm Vercel deploys that exact commit.
- [ ] Configure `CRON_SECRET`, Upstash credentials, `SCOUT_OPERATOR_TOKEN`, and `ARC_RPC_URL`.
- [ ] Optionally configure the alert webhook and Gemini.
- [ ] Add matching `SCOUT_AGENT_URL` and `CRON_SECRET` GitHub Actions secrets.
- [ ] Run one manual GitHub Actions cycle.
- [ ] Confirm `/api/health` reports unattended readiness.
- [ ] Confirm the public dashboard shows the latest durable cycle and six-step trace.

## Visual acceptance

- [ ] Inspect desktop layout at 1440 px and 1024 px widths.
- [ ] Inspect mobile layout near 390 px width.
- [ ] Test all eight current markets.
- [ ] Run one valid simulation per liquidity range.
- [ ] Verify the simulation result is visibly different from the pending state.
- [ ] Download and re-import one Scout receipt and one simulation receipt.
- [ ] Modify a downloaded JSON field and confirm verification fails.
- [ ] Start and stop the session agent and confirm phase, cycle count, and next-run time change.
- [ ] Trigger a fresh scan and confirm the monitor creates a comparison record.

## Submission gates

- [ ] Update screenshots after the final deployment.
- [ ] Record the three-minute demonstration.
- [ ] Verify hackathon-specific title, track, deadline, and required links on the submission form.
- [ ] Do not claim the optional registry is deployed or audited unless that becomes true.
- [ ] Do not claim external alerts, Gemini, RPC verification, or durable memory are active unless the live status confirms them.
