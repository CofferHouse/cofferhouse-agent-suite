# CofferHouse Agent Suite

**A connected room of bounded research agents built on Arc.**

The suite connects Scout, Opportunity, Strategy, DEX, Action Center, Guardian, Automation and Interop Observer into one inspectable research flow. Scout includes both a session-scoped monitor and a protected server runtime with an explicit lifecycle: observe, independently verify, evaluate versioned policy, compare durable history, decide whether changes require attention, and record the result. The current public release has no custody, signing, or transaction authority.

CofferHouse Agent Suite is a working room inside the larger CofferHouse product: a transparent research and risk layer that helps users inspect onchain markets, build bounded proposals and preserve evidence before any capital is routed.

> **Status:** Public hackathon prototype · Live, read-only Arc market and interoperability intelligence.

**Live demo:** [cofferhouse-scout.vercel.app](https://cofferhouse-scout.vercel.app/)

## What the suite is designed to do

The suite currently:

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
- expose a six-step execution trace and non-secret readiness diagnostics;
- filter Scout results through user-defined Opportunity limits;
- export a tamper-evident Opportunity Agent receipt.
- transform eligible opportunities into a bounded Strategy Lab allocation proposal;
- preserve reserve, diversification and per-market concentration limits;
- export a tamper-evident Strategy Lab receipt.
- inspect user-selected Arc DEX pools without inventing missing pools or executable quotes;
- carry one approved research intent through Action Center, Guardian and the revocable Automation sandbox;
- observe Arc CCTP interoperability events, compare non-overlapping windows and seal an Interop receipt;
- coordinate the complete evidence path from Agent Hub without merging agent responsibilities.

This release is **read-only**. It does not custody funds, promise returns or execute autonomous strategies.

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
| Agent Hub | Live: coordinates one bounded Scout → Opportunity → Strategy research session, includes DEX only when observed, and seals one session receipt |
| Agent Suite navigation | Live: focused Hub, Scout, Opportunity, Strategy, DEX, Action Center, Guardian and Automation workspaces |
| Opportunity Agent | Live, read-only research prioritization |
| Strategy Lab | Live, read-only allocation research |
| DEX Pool Scanner | Live: user watchlist, indexed Arc screening and sealed receipts |
| DEX Opportunity | Live: bounded pool prioritization with preserved warnings |
| DEX Strategy Lab | Live: separate swap/LP research proposals and sealed receipts |
| Action Center | Live: one human gate, expiring approval and non-executable receipt |
| Guardian | Live: approved-intent baseline monitoring and bounded responses |
| Automation Sandbox | Live: allowlists, caps, expiry, pause and revocation simulation |
| Interop Observer | Live: Arc CCTP event observation, window comparison, durable history and sealed receipts |
| Official Uniswap quote adapter | Implemented; server-side API key required |
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
│   ├── interop/            # manual Arc CCTP observation endpoint
│   ├── receipt/            # independent receipt verification
│   └── health.js           # non-secret deployment readiness
├── contracts/              # optional, undeployed receipt registry source
├── apps/
│   └── agent-suite/        # Agent Room UI and agent-specific domain logic
├── packages/
│   ├── agent-core/         # scanning, lifecycle, monitoring, alerts and human acknowledgment
│   ├── agent-modules/      # Opportunity, Strategy, DEX, Action, Guardian and Automation logic
│   ├── arc-data/           # Morpho adapter, Arc RPC and safe demo data
│   ├── evidence/           # receipts, registry, sealing and verification
│   ├── market-schema/      # normalized Arc identities and validation
│   ├── policies/           # deterministic profiles and alert limits
│   ├── product-config/     # safe House, Agent Suite and repository routes
│   ├── shared/             # safe rendering, retries and browser history
│   └── ui/                 # official tokens and shared rocket cursor behavior
├── test/                   # complete Node test suite
├── .github/workflows/      # protected 15-minute scheduler
├── vite.config.js          # preserves root build and dist deployment contract
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

The Agent Room application lives in `apps/agent-suite/` and now contains presentation code only; reusable agent behavior lives in `packages/`. Vite still emits the deployable site to root `dist/`, so the Vercel deployment contract is unchanged. No contracts are required for the read-only prototype.

See [Production deployment](docs/DEPLOYMENT.md) to activate durable memory, the protected 15-minute agent scheduler, operator acknowledgment, and optional alerts or bounded Gemini briefings.

See the [hackathon submission brief](docs/HACKATHON_SUBMISSION.md), [demo script](docs/HACKATHON_DEMO_SCRIPT.md), and [submission checklist](docs/HACKATHON_ASSET_CHECKLIST.md) for the complete delivery package.

See the [X launch pack](docs/X_LAUNCH_PACK.md) for ready-to-publish build-in-public posts that describe the product without overstating autonomy.

See [Agent Hub](docs/AGENT_HUB.md) for the multi-agent product sequence and the October 14 delivery boundary.

See [Opportunity Agent](docs/OPPORTUNITY_AGENT.md) for its limits, research score, sizing bound and receipt schema.

See [Strategy Lab](docs/STRATEGY_LAB.md) for allocation bounds, sizing, exclusions, observed-rate calculations and receipt schema.

See [DEX Pool Scanner](docs/DEX_POOL_SCANNER.md) for contract watchlists, Arc pool evidence, speculative labels and current quote limitations.

La [guía operativa en español](docs/GUIA_OPERATIVA_ES.md) explica cada apartado de la interfaz, sus indicadores, parámetros modificables, interpretación y límites para usuarios no especializados.

## Official links

- X: [@TheCofferHouse](https://x.com/TheCofferHouse)
- Holder Command Center: [cofferhouse-scout.vercel.app](https://cofferhouse-scout.vercel.app/#holders)
- Agent Suite (holder tool): [cofferhouse-scout.vercel.app](https://cofferhouse-scout.vercel.app/#agents)
- CofferHouse website: [cofferhouse.cheesemachineco.chatgpt.site](https://cofferhouse.cheesemachineco.chatgpt.site/)
- Public documentation: included in this repository
- Contracts: not deployed

## Important notice

CofferHouse Agent Suite is experimental software under active development. It is not financial advice, does not guarantee the accuracy of third-party data and does not guarantee any return. Do not use unfinished software with funds you cannot afford to lose.
