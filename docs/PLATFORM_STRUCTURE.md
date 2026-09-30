# CofferHouse platform structure

CofferHouse is one product with multiple deployable surfaces, not a collection of unrelated repositories. The public House, Agent Suite, future member dashboard, contracts and services share identity, policies, evidence and data adapters.

```text
cofferhouse/
├── apps/
│   ├── house/                 # Public CofferHouse experience
│   ├── agent-suite/           # Agent Hub and focused workspaces
│   └── member-dashboard/      # Future authenticated member area
├── packages/
│   ├── ui/                    # Brand, cursor, tokens and shared components
│   ├── agent-core/            # Scan, lifecycle, monitoring and bounded decisions
│   ├── agent-modules/         # Agent-specific research and permission simulations
│   ├── evidence/              # Canonical receipts and verification
│   ├── policies/              # Versioned deterministic bounds
│   ├── market-schema/         # Shared Arc identities and validation
│   ├── product-config/        # Safe cross-surface routes
│   ├── arc-data/              # Morpho, DEX, RPC and oracle adapters
│   └── shared/                # Common safe utilities
├── contracts/
│   ├── membership/
│   ├── ascension/
│   ├── vault/
│   └── receipts/
└── services/
    ├── scheduler/
    ├── alerts/
    └── indexer/
```

The current repository now implements `apps/agent-suite` and its reusable packages. Root `api/`, `public/`, `test/` and `dist/` remain stable so existing Vercel deployment settings continue to work during the migration.
