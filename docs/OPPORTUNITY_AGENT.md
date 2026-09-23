# Opportunity Agent

Opportunity Agent is the second bounded agent in CofferHouse. It consumes Scout reports and applies user-defined research limits to produce a transparent shortlist. It does not recommend an investment, connect a wallet or execute.

## Inputs

- the current normalized market observations;
- the active Scout policy and complete Scout report;
- capital the user wants to research;
- minimum observed Supply APY;
- minimum available liquidity;
- maximum utilization;
- maximum permitted research sizing as a percentage of observed liquidity.

Preferences are normalized to safe numeric ranges and stored only in the current browser.

## Decision

Each market receives one of two Opportunity decisions:

- `ELIGIBLE_FOR_RESEARCH`: it clears the active Opportunity limits. Human research remains required.
- `BLOCKED_BY_LIMITS`: it fails at least one explicit limit or has a hard Scout rejection.

A Scout `REVIEW` market may remain eligible for research because eligibility is not approval to invest. Every Scout warning remains attached to the candidate.

## Sizing bound

The maximum research amount is:

```text
min(user research capital, observed liquidity × maximum impact percentage)
```

This is a comparison bound, not a recommended position size. The default maximum impact is 1% of observed liquidity.

## Research score

The score orders research candidates and is not a probability of safety or expected return.

| Component | Weight |
|---|---:|
| Scout policy score | 65% |
| Liquidity depth relative to the user minimum | 15% |
| Utilization buffer below the user maximum | 10% |
| Observed Supply APY relevance | 10% |

Eligibility is determined by explicit limits before ranking. A high score cannot override a blocker.

## Receipt

Every analysis can be exported as `cofferhouse.opportunity.receipt.v1`. The sealed JSON includes:

- active policy;
- normalized user limits;
- eligible and blocked counts;
- ordered market results;
- sizing bounds;
- blockers and preserved Scout warnings;
- observation timestamp;
- SHA-256 integrity metadata.

The receipt can be re-imported through Scout's receipt verifier. Integrity proves that the file content did not change; it does not prove an investment outcome or source-data correctness.

## Handoff to Strategy Lab

Strategy Lab will accept only an Opportunity result plus its evidence. It will never infer that `ELIGIBLE_FOR_RESEARCH` means approved for execution. The next agent must preserve blockers, warnings, market identity, observation time and user limits.
