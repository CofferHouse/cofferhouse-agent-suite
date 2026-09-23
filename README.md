# CofferHouse Scout

**Risk-aware market intelligence and bounded agents built on Arc.**

Scout includes both a session-scoped monitor and a protected server runtime with an explicit, inspectable lifecycle: observe, independently verify contract deployment, evaluate versioned policy, compare durable history, decide whether changes require attention, and record the result. It has no custody, signing, or transaction authority.

CofferHouse Scout is the first working product planned for CofferHouse: a transparent research and risk layer that helps users inspect onchain markets before any capital is routed.

> **Status:** Public hackathon prototype · Live, read-only Morpho market intelligence on Arc mainnet.

**Live demo:** [cofferhouse-scout.vercel.app](https://cofferhouse-scout.vercel.app/)

## What Scout is designed to do

Scout currently:

- discover supported markets on Arc;
- normalize liquidity, utilization, yield and contract data;
- apply explicit, configurable risk policies;
- switch between Capital Preservation, Balanced and Yield Discovery profiles;
- compare all three policy outcomes for the selected market;
- simulate a hypothetical borrow without preparing or sending a transaction;
- export the hypothetical borrow as a separate deterministic simulation receipt;
- compare consecutive live snapshots and flag material market changes;
- explain why a market passes, fails or requires review;
- keep the user in control of every transaction;
- scan and rank every loaded market through a bounded agent;
- produce a downloadable Scout Receipt containing inputs, policy and results;
- retry temporary provider failures and expose persistent failures as a degraded state;
- run unattended through a protected scheduler with durable memory;
- expose a six-step execution trace and non-secret readiness diagnostics.

The first version will be **read-only**. It will not custody funds, promise returns or execute autonomous strategies.

## Why Arc

Arc provides stablecoin-native infrastructure for programmable money, USDC-based transaction fees, deterministic settlement and agent-oriented tooling. Scout is intended to explore how bounded agents can make onchain financial decisions easier to inspect and safer to authorize.

## MVP

The hackathon MVP has one clear job:

> Read a supported Arc market, evaluate it against a visible policy, and return an explainable risk report.

See [MVP scope](docs/MVP.md) and [architecture](docs/ARCHITECTURE.md).

## Principles

1. **Community first** — development decisions and limitations are communicated publicly.
2. **Explain before acting** — every score must show its inputs and reasoning.
3. **Bounded by default** — agents operate only inside explicit user-defined limits.
4. **Simulation first** — no transaction should be proposed without a preview.
5. **No artificial launch dates** — features become live only after testing and review.
6. **Security before automation** — execution and custody come after the research layer is proven.

## Current status

| Component | Status |
|---|---|
| Product specification | MVP scope complete |
| Data-source selection | Arc RWA + USDC + cirBTC selected |
| Market adapter | Live Morpho/Arc adapter with safe demo fallback |
| Risk-policy engine | Prototype complete |
| Transparent policy profiles | Live |
| Explanation layer | Prototype complete |
| Web interface | Prototype complete |
| Bounded Scout Agent | Live |
| Verifiable market identity | Live |
| Downloadable Scout Receipt | Live |
| Read-only borrow simulation | Live |
| Consecutive-scan change detection | Live |
| Durable server agent | Implementation complete; deployment secrets required |
| 15-minute unattended scheduler | GitHub Actions workflow included |
| Public deployment | Live on Vercel |
| Application hardening | Internal pass complete; independent review pending |

## Run the prototype

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite. To run the complete automated test and production-build gate:

```bash
npm run check
```

Scout first requests listed Morpho markets on Arc (chain ID `5042`) from Morpho's public GraphQL API. If that request fails or returns no markets, Scout fails safely to three observations that are visibly labeled as demonstration data.

Live protocol listing does not equal CofferHouse approval. Markets remain in `REVIEW` until their contracts, oracle design and missing risk inputs are independently verified.

## Repository map

```text
.
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── HACKATHON_SUBMISSION.md
│   ├── MVP.md
│   ├── RELEASE_CHECKLIST.md
│   └── ROADMAP.md
├── api/
│   ├── agent/              # protected run, status and acknowledgment
│   ├── receipt/            # independent receipt verification
│   └── health.js           # non-secret deployment readiness
├── contracts/              # optional, undeployed receipt registry source
├── src/
│   ├── main.js
│   ├── agent*.js           # scan, lifecycle, alerts and server cycle
│   ├── arc-rpc.js          # independent bytecode verification
│   ├── morpho.js           # live Arc market adapter
│   ├── policy.js           # deterministic policy profiles
│   ├── receipt.js          # sealed Scout and simulation receipts
│   └── styles.css
├── test/                   # complete Node test suite
├── .github/workflows/      # protected 15-minute scheduler
├── index.html
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

The application code lives in `src/`. No contracts are required for the read-only prototype.

See [Production deployment](docs/DEPLOYMENT.md) to activate durable memory, the protected 15-minute agent scheduler, operator acknowledgment, and optional alerts or bounded Gemini briefings.

See the [hackathon submission brief](docs/HACKATHON_SUBMISSION.md) for the concise agent explanation, trust model, limitations, and three-minute demo sequence.

## Official links

- X: [@TheCofferHouse](https://x.com/TheCofferHouse)
- Scout: [cofferhouse-scout.vercel.app](https://cofferhouse-scout.vercel.app/)
- CofferHouse website: coming soon
- Public documentation: included in this repository
- Contracts: not deployed

## Important notice

CofferHouse Scout is experimental software under active development. It is not financial advice, does not guarantee the accuracy of third-party data and does not guarantee any return. Do not use unfinished software with funds you cannot afford to lose.
