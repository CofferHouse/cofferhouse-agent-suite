# Scout market discovery API

Scout exposes a public, read-only endpoint for discovering listed Morpho Blue markets. It requires no wallet or API key. Each request retrieves a bounded sample from Morpho and can filter it by asset, liquidity and utilization.

## Make a request

```bash
curl -fsS 'https://cofferhouse-scout.vercel.app/api/scout/discovery?chains=8453,1'
```

Use `GET /api/scout/discovery` with these query parameters:

| Parameter | Accepted input |
| --- | --- |
| `chains` | Required. One to three distinct IDs separated by commas: `5042` (Arc), `8453` (Base), `1` (Ethereum). |
| `asset` | Optional loan asset symbol (case-insensitive) or exact EVM token address. |
| `minLiquidityUsd` | Optional minimum reported liquidity in USD. |
| `maxUtilizationPct` | Optional maximum utilization from `0` to `100`, in percentage points. |

For example, filter for USDC markets with at least $1,000 in reported liquidity and at most 90% utilization:

```bash
curl -fsS 'https://cofferhouse-scout.vercel.app/api/scout/discovery?chains=8453,1&asset=USDC&minLiquidityUsd=1000&maxUtilizationPct=90'
```

## Interpret the result

A successful request returns `ok: true` and a `networks` array. Check each network separately:

| Status | Meaning |
| --- | --- |
| `FOUND` | At least one market in the sample passed the filters. |
| `NO_MATCH` | The data source responded but no sampled market matched. Other markets may exist outside the sample. |
| `UNAVAILABLE` | Scout could not retrieve or validate the provider response for this network. Treat this as missing data. |

`scanned` counts the rows examined before applying filters, up to 20 listed markets per network ranked by supply assets in USD. `observedAt` records when Scout processed a valid response; it is not a timestamp for each individual market measurement. Both fields are `null` when the network is unavailable.

Each market includes its chain ID, protocol, market ID, loan asset, optional collateral asset, and reported liquidity, utilization and supply APY. Use `id`, which includes the network, protocol and market ID, as the market key. A metric can be `null`; do not treat it as zero. A missing liquidity or utilization value cannot pass a filter on that metric. Yield and utilization are returned in percentage points (`5` means 5%).

Invalid filters or networks return HTTP `400`; methods other than `GET` return `405`. HTTP `200` alone does not guarantee data availability. The results are observations for research, not a complete inventory, an executable quote or a guarantee of future returns.
