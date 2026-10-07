# Demo rehearsal — 7 October 2026

## Public build exercised

- Live product: `https://cofferhouse-scout.vercel.app/#agents`
- Release checkpoint: `06539d963a634d059d8c5697c8c7c2fac2b3249a`
- Browser: Chrome production session
- Automated gate: 181 tests passed and the Vite production build completed.

## Observed coordinated result

The live Agent Hub completed one bounded research session with the following trace:

| Stage | Result | Evidence shown |
|---|---|---|
| Scout | Complete | 0 PASS · 0 REVIEW · 8 REJECT |
| Opportunity | Complete | 0 of 8 eligible for research |
| Strategy | Complete | No eligible lending allocation |
| DEX | Skipped | No observed pools; no DEX result invented |
| Action Center | Skipped | No eligible strategy position to preview |
| Guardian | Skipped | No approved research target to monitor |

Mission Control correctly reported **“No allocation clears the current research limits.”** The session was still sealed as complete and preserved the human gate. This is the expected safe result when current evidence does not satisfy policy.

## Demo rule

Never promise a specific market result before recording. Narrate the result that the live policy produces:

- If no candidate clears: emphasize that the agents completed their work, refused to invent an opportunity and skipped downstream authority honestly.
- If a candidate clears: open its bounded handoff, show the modeled amount and explain that Action Center still requires one fresh human approval.
- If the provider degrades: show the visible data-source label and explain the safe demonstration fallback rather than presenting it as live data.

## Remaining production gate

The public health endpoint currently reports `SETUP_REQUIRED` because durable Upstash memory and the protected scheduler credential are not configured. The browser research workflow is demonstrable; unattended durable cycles must not be claimed operational until those two services are activated and one protected cycle is recorded.

