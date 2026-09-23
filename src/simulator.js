import { evaluateMarket } from "./policy.js";

export function simulateBorrow(market, amountUsd, activePolicy, evaluator = evaluateMarket) {
  const amount = Number(amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a borrow amount greater than zero." };
  }
  if (![market.liquidityUsd, market.suppliedUsd, market.borrowedUsd].every(Number.isFinite)) {
    return { ok: false, error: "This market does not expose enough live data for simulation." };
  }
  if (amount > market.liquidityUsd) {
    return { ok: false, error: "The proposed borrow exceeds currently available liquidity." };
  }

  const projected = {
    ...market,
    liquidityUsd: market.liquidityUsd - amount,
    borrowedUsd: market.borrowedUsd + amount,
    utilizationPct: market.suppliedUsd > 0 ? ((market.borrowedUsd + amount) / market.suppliedUsd) * 100 : null,
    note: "Read-only projection. No transaction was prepared, signed or submitted."
  };

  return {
    ok: true,
    amountUsd: amount,
    before: {
      liquidityUsd: market.liquidityUsd,
      utilizationPct: market.utilizationPct,
      report: evaluator(market, activePolicy)
    },
    after: {
      liquidityUsd: projected.liquidityUsd,
      utilizationPct: projected.utilizationPct,
      report: evaluator(projected, activePolicy)
    }
  };
}
