# Guardian

Guardian monitors an approved research intent. Because CofferHouse does not yet execute or custody funds, Guardian deliberately calls the subject an intent rather than a funded position.

## Lifecycle

1. Action Center creates a preview.
2. One human approval is recorded and remains valid for 15 minutes.
3. Guardian confirms that current evidence matches the approved target and records it as a baseline.
4. A later check requests fresh Lending or DEX observations and compares them with that baseline.

For lending intents, the operator can register the sealed Guardian receipt with the protected server endpoint while the 15-minute approval is still fresh. The operator token is entered transiently and is never saved by the browser. The protected watchlist accepts up to 20 unique Market IDs; adding or updating one target does not remove the others. Every scheduled Scout cycle finds each Morpho market by exact Market ID, applies the current deterministic policy, evaluates Guardian independently and stores a new sealed receipt. A missing target becomes `STOP_EXIT_RESEARCH` instead of being silently dropped.

The server retains the latest receipt for every active target and up to 50 recent Guardian observations across the watchlist. `REVIEW` and `STOP_EXIT_RESEARCH` create per-target deduplicated webhook alerts when the optional alert service is configured. Removing a watch affects only that Market ID and preserves historical receipts.

An active durable incident is promoted into Agent Hub Mission Control and the unified attention inbox. The operator can acknowledge Scout and Guardian incidents independently; older acknowledgments remain available so acknowledging one incident does not make another appear reviewed.

Durable DEX watches are intentionally unavailable until a server-side DEX observation source is configured; a browser watchlist is not treated as server authority.

Guardian returns one bounded decision:

- `HOLD_RESEARCH`: evidence remains inside recorded limits;
- `REVIEW`: a warning, status change or material deterioration requires attention;
- `STOP_EXIT_RESEARCH`: the target disappeared, became `REJECT`, or exceeds a hard modeled-impact limit.

Default monitored conditions include a 10% liquidity decline, five-point utilization increase, 50% absolute 24-hour price movement and 2% modeled liquidity impact. The original deterministic policy status remains authoritative.

Guardian cannot withdraw, rebalance, swap or execute. Any future response must create a new Action Center intent. Its receipt records the baseline, current observation, decision and `automatedAction: false`.
