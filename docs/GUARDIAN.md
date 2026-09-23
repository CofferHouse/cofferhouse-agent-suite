# Guardian

Guardian monitors an approved research intent. Because CofferHouse does not yet execute or custody funds, Guardian deliberately calls the subject an intent rather than a funded position.

## Lifecycle

1. Action Center creates a preview.
2. One human approval is recorded and remains valid for 15 minutes.
3. Guardian confirms that current evidence matches the approved target and records it as a baseline.
4. A later check requests fresh Lending or DEX observations and compares them with that baseline.

Guardian returns one bounded decision:

- `HOLD_RESEARCH`: evidence remains inside recorded limits;
- `REVIEW`: a warning, status change or material deterioration requires attention;
- `STOP_EXIT_RESEARCH`: the target disappeared, became `REJECT`, or exceeds a hard modeled-impact limit.

Default monitored conditions include a 10% liquidity decline, five-point utilization increase, 50% absolute 24-hour price movement and 2% modeled liquidity impact. The original deterministic policy status remains authoritative.

Guardian cannot withdraw, rebalance, swap or execute. Any future response must create a new Action Center intent. Its receipt records the baseline, current observation, decision and `automatedAction: false`.
