# Hackathon asset checklist

## Already in the repository

- [x] Public source and reproducible local setup.
- [x] Working read-only application.
- [x] Explicit multi-agent architecture and permission boundaries.
- [x] Automated tests plus production build gate.
- [x] Deterministic policy engine and tamper-evident receipts.
- [x] Durable-agent deployment path with protected scheduler.
- [x] Arc market, RPC and CCTP interoperability integrations.
- [x] Three-minute demo script.
- [x] Honest limitations and security disclosures.

## Capture after deployment

- [x] Confirm the live Vercel deployment matches the Holder Center release commit.
- [x] Confirm the official House opens the Holder Center and the Holder Center opens Agent Suite.
- [x] Rehearse the production Agent Hub and document the safe no-allocation branch.
- [ ] Record a 16:9 demo, maximum three minutes.
- [ ] Optional after submission: capture a 20–30 second silent product loop for social media.
- [ ] Capture one desktop hero image and one mobile image.
- [ ] Capture valid and modified receipt verification.
- [ ] Save the final live URL and repository URL in the submission form.

## Submission text fields

- [ ] Project name: **CofferHouse Agent Suite**.
- [ ] One-line pitch from `HACKATHON_SUBMISSION.md`.
- [ ] Short description from `HACKATHON_SUBMISSION.md`.
- [ ] Problem, solution, architecture and Arc integration.
- [ ] Team names, roles and contact details.
- [ ] Public X account: `@TheCofferHouse`.
- [ ] Live demo and source links.
- [ ] State clearly: experimental, read-only, no custody, no execution, not financial advice.

## Two-program delivery

- [ ] Tameion Agents Hackathon: deadline October 17, 23:59 ET; first resolve the business-usage and USDC-payment fit gate.
- [ ] Arc Microgrants: submit by October 14; reconfirm the form timezone and fields before sending.
- [ ] Recheck each official form immediately before submission; do not assume identical fields.
- [ ] Use `ARC_2026_SUBMISSION_PLAN.md` for the track-specific copy.
- [x] Prepare copy-ready field text in `SUBMISSION_FORM_COPY.md`.

## Final claim audit

- [ ] No invented partner, audit, deployment or approval claims.
- [ ] No guaranteed APY, return, safety or market quality claim.
- [ ] No claim that bytecode existence proves economic safety.
- [ ] No claim that receipt integrity proves the underlying data is correct.
- [ ] No claim that simulations are executable quotes or transactions.
- [ ] Every live claim is demonstrable in the submitted build.

## October 9 Microgrants priority

- [x] Public repository and application respond.
- [x] Production health reports OPERATIONAL; latest protected cycles succeeded.
- [x] Local baseline: 193 tests passed and production build passed.
- [ ] Verify anonymous browser flow after fixing the public-status rendering crash.
- [ ] Check the final DoraHacks form fields and select builder/contact/payout wallet.
- [ ] Submit the Microgrant application; no submission has been recorded here.

Telegram activation, NFT contracts, the main marketing website/domain and a full whitepaper are not release gates for the read-only Microgrants prototype. Screenshots and a video are supporting evidence, not mandatory Microgrants fields in the published Arc House brief.

### Vercel deployment repair

The API handlers now live in `server/` and are dispatched by one Vercel function (`api/index.js`). Public endpoint URLs, handler authorization, and the scheduled-run path remain unchanged. This avoids the Hobby plan limit of 12 functions. Router regression tests cover rewritten health routing, unknown endpoints, and scheduler authorization.
