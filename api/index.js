import handler0 from "../server/agent/acknowledge.js";
import handler1 from "../server/agent/run.js";
import handler2 from "../server/agent/status.js";
import handler3 from "../server/alerts/telegram/challenge.js";
import handler4 from "../server/alerts/telegram/link.js";
import handler5 from "../server/alerts/telegram/status.js";
import handler6 from "../server/alerts/telegram/webhook.js";
import handler7 from "../server/app-kits/borrow.js";
import handler8 from "../server/app-kits/earn.js";
import handler9 from "../server/app-kits/onramp.js";
import handler10 from "../server/dex/pools.js";
import handler11 from "../server/dex/quote.js";
import handler12 from "../server/guardian/watch.js";
import handler13 from "../server/health.js";
import handler14 from "../server/interop/observe.js";
import handler15 from "../server/receipt/verify.js";

const routes = new Map([
  ["/api/agent/acknowledge", handler0],
  ["/api/agent/run", handler1],
  ["/api/agent/status", handler2],
  ["/api/alerts/telegram/challenge", handler3],
  ["/api/alerts/telegram/link", handler4],
  ["/api/alerts/telegram/status", handler5],
  ["/api/alerts/telegram/webhook", handler6],
  ["/api/app-kits/borrow", handler7],
  ["/api/app-kits/earn", handler8],
  ["/api/app-kits/onramp", handler9],
  ["/api/dex/pools", handler10],
  ["/api/dex/quote", handler11],
  ["/api/guardian/watch", handler12],
  ["/api/health", handler13],
  ["/api/interop/observe", handler14],
  ["/api/receipt/verify", handler15],
]);

export default async function handler(request, response) {
  const url = new URL(request.url, "https://cofferhouse.invalid");
  const rewrittenPath = request.query?.endpoint ?? url.searchParams.get("endpoint");
  const pathname = rewrittenPath ? `/api/${rewrittenPath}` : url.pathname;
  const endpoint = routes.get(pathname);
  if (!endpoint) return response.status(404).json({ error: "Unknown API endpoint" });
  return endpoint(request, response);
}
