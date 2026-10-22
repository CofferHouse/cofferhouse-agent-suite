# Metered AI payments: Arc House / Ando / MPP-I evaluation

Reviewed 22 October 2026. Status: research and integration requirements only. No provider, wallet, signer or payment execution is enabled by this document.

## Evidence reviewed

- Arc House episode dated 21 October: [How Arc Helps AI Agents Pay for Intelligence Before They Know the Cost](https://community.arc.io/public/videos/how-arc-helps-ai-agents-pay-for-intelligence-before-they-know-the-cost-2026-10-21). The accessible public summary identifies Ando / MPP-I and explicitly says the walkthrough used Arc Testnet and testnet USDC. The video transcript was not exposed in the retrieved page; this is not a claim to have watched the full recording.
- [Ando-OSS/mpp-i](https://github.com/Ando-OSS/mpp-i), source commit `aae26d7a3aaa36857b3f1f01abfa62735b72ff59`: README, paper source, Arc v1 README and public interface were read. The authors describe an early proposal and a pre-audit contract candidate.
- [Arc v1 contract documentation](https://github.com/Ando-OSS/mpp-i/blob/aae26d7a3aaa36857b3f1f01abfa62735b72ff59/contracts/arc/v1/README.md): describes escrow channels, cumulative settlement, top-ups, closure and a review deployment on testnet. Deployment identity and runtime were not independently verified in this task.
- [Public interface](https://github.com/Ando-OSS/mpp-i/blob/aae26d7a3aaa36857b3f1f01abfa62735b72ff59/contracts/arc/v1/src/IAndoMPPI.sol) exposes cumulative vouchers and channel balances. An interface is not proof of production service availability.
- [Paper source](https://github.com/Ando-OSS/mpp-i/blob/aae26d7a3aaa36857b3f1f01abfa62735b72ff59/paper/mpp-i-paper-v1.0.tex) describes separate inference/control flows, run-scoped authorization, metering and final receipts. We did not execute the upstream tests or audit its contracts.
- https://docs.andoai.xyz/docs could not be retrieved here; SDK availability, commercial pricing and service terms remain unverified.

## Relevance to CofferHouse

A research agent might buy a bounded amount of inference or data when usage cannot be priced exactly beforehand. Candidate uses are optional Scout analysis, Guardian explanations and user-requested bot research. These are proposed product uses, not current capabilities.

Keep deterministic market/risk alerts available independently of optional paid model calls. Payment infrastructure does not establish answer quality, reduce the model's price automatically, or create vault investment yield.

## Current gap

At agent-suite main commit `4ad2cc605c3771f90d0f57723e0e3583aa2b10b2`, `server/_budget-ledger.js` supports reservations and reconciliation for configured transfers/swaps. It is accounting in Redis, does not sign or submit, and has no channel/voucher reconciliation path. It cannot be relabeled as an MPP-I adapter.

A confirmed escrow funding transfer is not the same as confirmed inference consumption. Reusing the transfer reconciler unchanged would conflate escrow capital with actual spending. Per-run usage and channel funding/refunds need distinct records, with each unit counted once.

## Proposed integration boundaries

1. **Explicit opt-in and maximum:** reserve a fixed upper bound before admission, including quoted input/prefill and any output/tools. Reject missing or unbounded pricing. Bind provider, model, currency, chain, wallet, quote identity, expiry, run and policy version.
2. **Separate authority:** a future signer policy must restrict payee, verified contract, token and total authorization. Redis reservation is not a wallet permission. Never use community investment principal as an agent's unrestricted payment wallet.
3. **Controlled increments:** cumulative grants must increase monotonically within the run cap, available channel balance and global budget. Verify message authenticity and replay protection. A provider asking for more does not itself authorize a top-up.
4. **Stop semantics:** cancellation or low budget stops further grants/admissions, but already authorized claims may remain payable. Disconnecting HTTP is not settlement, revocation or refund.
5. **Settlement:** distinguish reserved cap, cumulative authorized amount, metered amount claimed, settled amount, channel balance and refund. Provider receipt, signed voucher and independently verified chain state are different evidence.
6. **Uncertain outcomes:** timeout, partial response, mismatched receipt or unavailable RPC retains the relevant liability for review. Never release solely because the stream ended or a refund was requested. Release only after the settlement method proves unused authority no longer claimable and reconciles any refund.
7. **Privacy:** keep prompts, credentials, responses and application/user identifiers out of public chain data. Follow the provider's documented privacy boundary; a hash of predictable private content is not automatically confidential.

These requirements are our proposed controls, not a claim that the upstream SDK implements them.

## Acceptance criteria before enabling a testnet pilot

- Verify service/API availability, exact profile/SDK versions, prices and delivery semantics from provider documentation.
- Verify chain, proxy, implementation, governance and accepted token/units independently. Do not use testnet addresses on mainnet.
- Add a dedicated disabled-by-default provider adapter and channel-aware accounting/reconciliation, without changing the existing transfer/swap semantics.
- Test duplicate and out-of-order cumulative grants, quote substitution, cap overrun, parallel runs, stream disconnect after authorization, partial settlement, close grace periods, double refunds, expired policy and Redis/RPC timeouts.
- Demonstrate a complete testnet lifecycle: bounded funding, metered call, stop, final settlement and independently reconciled unused funds.
- Review signer/storage boundaries and upstream audit status. Record the exact code, configuration and results.

No account was registered, no partnership claimed, no third party contacted, no upstream code copied and no payment made.
