# Infrastructure reinforcement — 19 October 2026

## Shipped scope

- Guardian requires observations no older than 15 minutes, rejects timestamps more than 30 seconds ahead, and requests review for incomplete economics, unknown screening status or a source mismatch. Missing/rejected targets retain the stronger stop-research decision. Existing durable lending cycles consume these checks automatically.
- Borrow normalization preserves unavailable health and amount fields as null, rather than coercing them to zero. Missing health produces an explicit preview warning.
- `POST /api/guardian/loan-health` is an operator-only, uncached read endpoint. It requires `SCOUT_OPERATOR_TOKEN`, a loan UUID and expected wallet address. It calls the installed Circle Borrow Kit `getPosition` server-side and checks the returned loan ID, wallet and Arc chain. Client-supplied health data is ignored. Provider failures produce no healthy-position assertion.
- Loan assessments distinguish pending/unknown data, no debt, and SAFE/WARN/URGENT/IMMINENT/LIQUIDATABLE bands. Retrieval time is not proof of the provider's indexing freshness or independent onchain verification. This endpoint is on-demand; it is not a scheduled loan watch, user-facing ownership authentication or a Telegram loan alert subscription.
- `planUsdcRevenue` budgets explicitly supplied confirmed revenue after costs and a protected reserve. Buyback and holder allocations must be explicitly passed in basis points. Six-decimal integer arithmetic preserves rounding dust as retained funds. Deposits, principal and unsettled payments must never be passed as revenue; this module does not reconcile a ledger or establish provenance.
- `evaluateBotBudget` checks proposed spending against action/period caps, reserve, pause state and expiry using integer micro-USDC. It is a planning gate, not an executor, installed Circle policy or concurrency-safe spending ledger.

## Economic direction

Revenue is received in USDC. Configured portions may fund a COFFERS buyback/burn route or holder distributions. No split is selected by this change. A buyback needs an independently validated DEX route for the actual token, a fresh quote, slippage bounds, execution reconciliation and verification of a subsequent burn. A treasury budget is not a holder claim, and buying tokens alone is not burning them.

## Next integration boundaries

1. Register authenticated, wallet-bound loan watches and schedule fresh observations with deduplicated per-holder alerts; continue RPC checks alongside provider reads.
2. Add a durable, atomic spending-reservation ledger with idempotency before any bot execution. Enforce chain/contract allowlists and fresh quotes in the executor.
3. Configure and verify Circle Agent Wallet policies separately. Circle currently documents custom policies for mainnet only; a simulated test is not proof that a wallet policy is installed.
4. Add settled-revenue reconciliation before buyback or reward preparation. Keep ledger principal, reserves, revenue and unsettled receipts separate.
5. Implement a testnet x402 seller pilot as a separate feature with settlement reconciliation. No paid endpoint or CPN agreement is activated here.

## Verification

`npm ci --ignore-scripts`, then `npm run check`: 218 tests passed, production build passed. This includes protected endpoint tests with injected provider responses, loan-health boundary tests, pending/stale data, USDC conservation and budget denials. Live Circle loan calls, installed wallet policies and real transactions were not tested. Browser UI is unchanged.

## Official references

- https://docs.arc.io/app-kit/concepts/borrow-loan-health
- https://docs.arc.io/app-kit/borrow
- https://developers.circle.com/agent-stack/agent-wallets/wallet-operations/custom-policies
- https://developers.circle.com/gateway-nanopayments
- https://www.circle.com/blog/turn-agent-traffic-into-revenue-with-cpn-managed-payments
