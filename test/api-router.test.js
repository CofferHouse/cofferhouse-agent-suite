import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/index.js";
function responseMock() { return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
test("router handles rewritten health path and rejects unknown endpoints", async () => {
 const response = responseMock();
 await handler({ url: "/api?endpoint=health", method: "GET", headers: {} }, response);
 assert.equal(response.body.ok, true);
 const missing = responseMock();
 await handler({ url: "/api?endpoint=unknown", method: "GET", headers: {} }, missing);
 assert.equal(missing.statusCode, 404);
});
test("router preserves scheduled-run authorization", async () => {
 const response = responseMock();
 await handler({ url: "/api/agent/run", method: "GET", headers: {}, query: { endpoint: "agent/run" } }, response);
 assert.equal(response.statusCode, 401);
});
