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
| `SCOUT_OPERATOR_TOKEN` | Yes | Authorizes human incident acknowledgment. |
| `ARC_RPC_URL` | Recommended | Independently confirms loan asset, collateral, and oracle bytecode through `eth_getCode`. |
| `SCOUT_ALERT_WEBHOOK_URL` | Optional | Receives deduplicated material alerts. |
| `GEMINI_API_KEY` | Optional | Produces bounded incident briefings; deterministic fallback remains active without it. |
| `GEMINI_MODEL` | Optional | Overrides the documented default model. |
| `SCOUT_RECEIPT_REGISTRY_ADDRESS` | Optional | Identifies a reviewed, deployed Arc receipt registry. No deployment is assumed. |

Never prefix these variables with `VITE_`; that would expose them to the browser bundle.

The included Vercel cron is a daily safety cycle. Vercel Hobby does not provide the desired 15-minute cadence, so the repository also includes a protected GitHub Actions scheduler.

## 2. Create the durable store

Create an Upstash Redis database, copy its REST URL and REST token into Vercel, and redeploy. Scout stores:

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

## 5. Optional alert and intelligence services

Configure `SCOUT_ALERT_WEBHOOK_URL` to deliver material incident notifications. Configure `GEMINI_API_KEY` only if a structured operator briefing is desired. Neither service can alter the deterministic policy result or execute a transaction.

## Operational boundary

The server agent observes, evaluates, decides, records, and alerts. It has no wallet, custody, signing, transaction-building, or execution permission.
