# Arc 2026 submission plan

This repository supports two separate October submissions. They must use the same working product and evidence, but not identical positioning.

## 1. Tameion Agents Hackathon

- **Public event window:** September 27–October 10, 2026.
- **Lead product:** Scout as a bounded micro-agent running the `observe → verify → evaluate → compare → decide → record` loop.
- **Supporting system:** Agent Hub demonstrates how the micro-agent hands evidence to specialized agents without gaining financial authority.
- **Submission emphasis:** autonomy, durable memory, explicit state transitions, protected scheduling, alerts and verifiable receipts.
- **Before submission:** verify the official form and track-specific required fields as soon as the event portal exposes them publicly.

### Tameion one-line pitch

CofferHouse Scout is a bounded Arc micro-agent that continuously observes mainnet markets, applies visible policy, remembers material changes and escalates only when human attention is required.

## 2. Arc Microgrants

- **Deadline:** October 14, 2026 at 23:59 ET; reviews are rolling.
- **Required:** live Arc-mainnet deployment, public repository, short Arc-use description and public builder profile.
- **Lead product:** the deployed, read-only Scout micro-agent plus Agent Suite evidence trail.
- **Submission emphasis:** a working early experiment on Arc mainnet, technical credibility, product quality and a credible path forward.

### Microgrant one-line pitch

CofferHouse Scout turns live Arc mainnet lending and interoperability observations into deterministic risk decisions and tamper-evident receipts without custody or transaction authority.

### Short Arc-use description

CofferHouse Scout reads Morpho-listed lending markets on Arc mainnet, normalizes market identities and risk inputs, applies versioned deterministic policy and records repeatable decisions. When an Arc RPC endpoint is configured, the protected runtime independently checks referenced contract bytecode and observes CCTP V2 events. Its unattended loop compares each observation with durable history and raises a bounded alert only when configured liquidity, utilization or policy limits require human attention.

## Shared proof package

| Proof | Public location | Claim supported |
| --- | --- | --- |
| Live holder doorway | `https://cofferhouse-scout.vercel.app/#holders` | One CofferHouse product with member-gated tools |
| Agent Hub | `https://cofferhouse-scout.vercel.app/#agents` | Coordinated bounded-agent workflow |
| Scout | `https://cofferhouse-scout.vercel.app/#agents/scout` | Live Arc observation, evaluation and simulation |
| Repository | `https://github.com/CofferHouse/cofferhouse-agent-suite` | Reproducible public source and tests |
| Health endpoint | `https://cofferhouse-scout.vercel.app/api/health` | Deployment capabilities without secret exposure |
| Public agent status | `https://cofferhouse-scout.vercel.app/api/agent/status` | Safe aggregate runtime state |

## Remaining gates

- [ ] Configure durable Upstash storage in production.
- [ ] Configure protected scheduler and run at least one unattended cycle.
- [ ] Configure secure Arc RPC and confirm bytecode/Interop observation.
- [ ] Capture health and status proof after configuration.
- [ ] Record the final three-minute demo.
- [ ] Create the DoraHacks/official event submission with final team details.
- [ ] Publish the launch thread from `@TheCofferHouse` after visual assets are captured.

Financial execution, custody, wallet signing and undeployed contract claims remain outside both submissions.
