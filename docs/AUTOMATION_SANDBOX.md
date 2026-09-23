# Automation Permission Sandbox

Automation is a counterfactual permission simulator. It demonstrates how CofferHouse could constrain future account automation without installing permissions or accessing funds.

## Inherited scope

The sandbox can only start from an approved Action Center intent with a Guardian baseline. It automatically inherits:

- the exact Arc contract or market identifier;
- the exact intent type;
- the source Strategy receipt;
- the required Guardian decision `HOLD_RESEARCH`;
- the requirement for fresh human approval.

The user controls only the maximum USD-equivalent amount per action, modeled daily cap and permission duration from 5 minutes to 24 hours.

## Evaluation

A hypothetical request receives `WOULD_ALLOW` only when every gate passes: active state, unexpired policy, exact target, exact intent, per-action cap, daily cap, Guardian state and fresh human approval. Any failed gate produces `WOULD_BLOCK` and visible reasons.

Emergency pause and revocation immediately make subsequent evaluations block. These operations only change the local simulated policy because no wallet, smart-account module or contract permission is installed.

The sealed receipt states `installed: false`, `attempted: false`, `signed: false` and `submitted: false`.
