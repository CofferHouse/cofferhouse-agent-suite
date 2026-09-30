# Production deployment

Scout has two runtimes:

1. the browser session agent, which stops when the page closes; and
2. the protected server agent, which stores durable observations and can run unattended.

## 1. Deploy to Vercel

Import this repository into Vercel and keep the default build command (`npm run build`). Add these server-side environment variables for Production, Preview, and Development as appropriate:

| Variable | Required | Purpose |
|---|---:|---|
| `CRON_SECRET` | Yes | Authorizes `/api/agent/run` scheduled calls. Use a long random value. |
| `UPSTASH_REDIS_REST_URL` | Yes | Durable snapshot, status, history, alert, and acknowledgment storage. |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Server-only Upstash credential. |
| `SCOUT_OPERATOR_TOKEN` | Yes | Authorizes human incident acknowledgment and durable Guardian watch registration/removal. |
| `ARC_RPC_URL` | Recommended | Confirms market bytecode and powers the bounded, read-only CCTP V2 Interop Observer. |
| `SCOUT_ALERT_WEBHOOK_URL` | Optional | Receives deduplicated material alerts. |
| `GEMINI_API_KEY` | Optional | Produces bounded incident briefings; deterministic fallback remains active without it. |
| `GEMINI_MODEL` | Optional | Overrides the documented default model. |
| `UNISWAP_API_KEY` | Recommended for DEX research | Enables protected official read-only quotes for Arc chain ID `5042`. The key remains server-side. |
| `SCOUT_RECEIPT_REGISTRY_ADDRESS` | Optional | Identifies a reviewed, deployed Arc receipt registry. No deployment is assumed. |

Never prefix these variables with `VITE_`; that would expose them to the browser bundle.

The RPC URL remains server-only. `/api/interop/observe` returns decoded event evidence from a capped block window, never the configured URL.

The included Vercel cron is a daily safety cycle. Vercel Hobby does not provide the desired 15-minute cadence, so the repository also includes a protected GitHub Actions scheduler.

## 2. Create the durable store

Create an Upstash Redis database, copy its REST URL and REST token into Vercel, and redeploy. Scout stores:

- the latest coordinated Agent Hub research-session receipt;
- up to 25 durable Agent Hub sessions, independently of any open browser;
- up to 20 active lending Guardian registrations, their latest sealed observations and up to 50 recent historical receipts;
- the latest sealed CCTP V2 Interop observation and up to 50 historical Interop receipts;
- the latest normalized market snapshot;
- the latest sealed cycle status;
- up to 100 historical cycles;
- the last delivered alert fingerprint; and
- the latest operator acknowledgment.

No wallet key or signing key is required.

## 3. Enable the 15-minute scheduler

In GitHub, open **Settings → Secrets and variables → Actions** and create:

- `SCOUT_AGENT_URL`: the canonical deployment origin, for example `https://cofferhouse-scout.vercel.app`;
- `CRON_SECRET`: exactly the same value configured in Vercel.

The workflow `.github/workflows/scout-agent.yml` runs every 15 minutes and can also be started manually from the Actions tab. A non-2xx response fails visibly instead of being treated as a successful cycle.

## 4. Confirm operation

1. Open `/api/health` on the deployment and confirm `readyForUnattendedCycles` is `true`.
2. Run **Scout Agent Cycle** manually once in GitHub Actions.
3. Open the public Scout page.
4. Confirm that **SERVER AGENT · 24/7 CORE** shows `DURABLE AGENT ONLINE`.
5. Confirm a recent **LAST SERVER RUN**, a decision, an execution trace, and at least one durable history cycle.
6. Run the workflow again after market data changes and confirm that the history count increases.
7. Create and approve a lending intent, start Guardian, register its sealed watch with the operator token, run another protected cycle, and confirm a durable Guardian decision appears.
8. Open Interop Observer and confirm the latest protected observation can be restored from durable memory. Zero events is a valid bounded-window result.

Detailed `/api/agent/status` responses require `Authorization: Bearer <SCOUT_OPERATOR_TOKEN>`. Anonymous requests receive only aggregate counts, the last run time and a coarse health/decision summary; durable receipts, traces, incidents and capability flags are never returned publicly.

The public health response and Scout deployment panel expose only boolean capability states and operational freshness. They never return URLs, tokens, webhook addresses or API-key values. Readiness progresses through `SETUP REQUIRED`, `READY FOR FIRST RUN`, `OPERATIONAL`, or `DEGRADED STALE` when the last cycle is more than three expected intervals old (with a 45-minute minimum).

## 5. Optional alert and intelligence services

Configure `SCOUT_ALERT_WEBHOOK_URL` to deliver material incident notifications. Configure `GEMINI_API_KEY` only if a structured operator briefing is desired. Neither service can alter the deterministic policy result or execute a transaction.

Configure `UNISWAP_API_KEY` to enable the `GET UNISWAP QUOTE` controls in DEX Pool Scanner. Scout sends an exact-input Arc USDC quote request with the selected slippage tolerance. It does not request approval, create a swap, sign or submit anything. Without the key, pool discovery and deterministic DEX screening continue to work and the quote control reports that official quotes are not configured.

## Operational boundary

The server agent observes, evaluates, decides, records, and alerts. It has no wallet, custody, signing, transaction-building, or execution permission.
