# CofferHouse Agent Suite — connected release candidate

Release candidate prepared for complete visual and deployment testing.

## 2026-10-05

- Agent Hub sessions now seal concrete Action Center and Guardian handoffs.
- The top bounded candidate includes its target, modeled amount, reason, review conditions and required human step.
- Guardian plans expose monitoring limits and explicitly deny rebalance, withdrawal and swap authority.

## Included

- Eight live Morpho market observations on Arc when available, with an explicit demonstration fallback.
- Three versioned deterministic policy profiles and all-market ranking.
- Read-only borrow simulation for every loaded market.
- Visible simulation results and downloadable simulation receipts.
- Downloadable Scout scan receipts and file-based SHA-256 verification.
- Session-scoped autonomous monitoring with configurable cadence.
- Protected server runtime with durable memory and 15-minute GitHub Actions scheduling.
- Material-change detection, deduplicated webhook alerts, and protected human acknowledgment.
- Optional bounded Gemini incident briefing with deterministic fallback.
- Independent Arc RPC bytecode verification without misrepresenting it as a price feed.
- Six-step agent execution trace: observe, verify, evaluate, compare, decide, record.
- Typed provider diagnostics, automatic retries, degraded-state display, and `/api/health` readiness.
- Optional undeployed receipt-hash registry source and ABI.
- Deployment guide, architecture, release checklist, and hackathon demonstration brief.
- Arc CCTP V2 Interop Observer with de-duplicated event windows, durable history and sealed receipts.
- Bidirectional House ↔ Agent Suite navigation using the official CofferHouse visual language.
- Ready-to-publish X launch copy, three-minute demo script and hackathon asset checklist.

## Automated status

Run:

```bash
npm install
npm run check
```

The check command must complete both the Node test suite and Vite production build before deployment.

## Requires deployment configuration

The code cannot make external services active by itself. Durable memory, unattended scheduling, RPC verification, human acknowledgment, alerts, and Gemini require the server-side variables documented in `docs/DEPLOYMENT.md`.

## Intentionally not included

- Wallet connection, custody, signing, calldata generation, or transactions.
- Claims that a market, oracle, or contract is approved by CofferHouse.
- A deployed or audited receipt registry.
- A second independent price feed or verified volatility feed.
- Production lending or The Big Coffer.
