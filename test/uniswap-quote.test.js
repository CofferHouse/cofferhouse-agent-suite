import test from "node:test";
import assert from "node:assert/strict";
import { ARC_USDC, normalizeUniswapQuote, requestUniswapQuote } from "../src/uniswap-quote.js";

const token = "0x1111111111111111111111111111111111111111";
const response = { requestId: "req-1", routing: "CLASSIC", isTokenApprovalApplicable: true, tokenIn: ARC_USDC, tokenOut: token, outputDecimals: 18, slippageTolerance: 0.5, quote: { input: { amount: "100000000", token: ARC_USDC }, output: { amount: "250000000000000000000", minimumAmount: "248750000000000000000", token }, classicGasUseEstimateUSD: "0.01", slippageTolerance: 0.5 } };

test("normalizes an official Arc Uniswap quote without execution data", () => {
  const quote = normalizeUniswapQuote(response);
  assert.equal(quote.routing, "CLASSIC");
  assert.equal(quote.outputAmount, 250);
  assert.equal(quote.gasEstimateUsd, 0.01);
  assert.match(quote.notice, /No approval/);
});

test("rejects incomplete quote responses", () => {
  assert.throws(() => normalizeUniswapQuote({}), /incomplete/);
});

test("requests Arc USDC exact-input quote through the protected endpoint", async () => {
  let body;
  const quote = await requestUniswapQuote({ tokenOut: token, amountUsd: 100 }, async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => response }; });
  assert.equal(body.tokenIn, ARC_USDC);
  assert.equal(body.amountUsd, 100);
  assert.equal(quote.outputAmount, 250);
});
