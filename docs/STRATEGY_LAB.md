# Strategy Lab

Strategy Lab is the third CofferHouse agent. It consumes the explainable output of Opportunity Agent and creates a read-only allocation research proposal. It never prepares, signs or submits a transaction.

## Inputs

- modeled capital in USD;
- reserve percentage that remains outside proposed positions;
- maximum number of markets;
- maximum portfolio percentage per market;
- minimum Opportunity research score;
- the active Scout policy and Opportunity limits.

Only `ELIGIBLE_FOR_RESEARCH` Opportunity results can receive an allocation. A Strategy preference cannot override a Scout rejection or missing required data.

## Allocation method

1. Reserve capital is removed from the deployable amount.
2. Eligible candidates below the minimum research score are excluded.
3. The highest-ranked candidates are selected up to the market-count limit.
4. Deployable capital is weighted by research score.
5. Every position is capped by both the portfolio concentration limit and Opportunity's liquidity-impact sizing bound.
6. Capital that cannot be placed inside every bound remains unallocated.

## Outputs

- modeled amount and portfolio percentage per market;
- explicit reserve and additional unallocated capital;
- observed supply APY and arithmetic annualized yield at that rate;
- review and exit conditions copied from the upstream limits;
- exclusions with their first visible reason;
- SHA-256 sealed Strategy receipt.

Observed APY is variable. It is neither a forecast nor a guaranteed return. The research score is not a probability of safety.

## Next data family: DEX pools

Lending markets and DEX pools remain separate data types. DEX research requires pool-specific evidence such as TVL, volume, fees, price impact, slippage, token age, concentration, volatility and impermanent-loss exposure. A user may explicitly include speculative tokens by contract address, but that choice is displayed as user-approved risk and does not erase warnings.
