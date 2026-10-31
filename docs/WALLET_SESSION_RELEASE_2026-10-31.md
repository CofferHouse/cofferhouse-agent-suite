# Wallet session release — 31 October 2026

Completes the previously prepared session reset against the deployed
Morpho/Gateway code. After an injected wallet connects, account changes, chain
changes and provider disconnection reload Holder Center and require explicit
reconnection. In-flight page requests, wallet identity, prepared Onramp links and
Telegram UI credentials are discarded; saved language/preferences remain.
Existing external subscriptions or funding sessions are not revoked.

Identity checks now require an exposed account before `isArc` can be true.
Malformed chain IDs such as `5042abc` and `0x13b2junk` no longer pass through
numeric-prefix parsing. The chain is read after the wallet account permission
request resolves, so a network switch inside that prompt is not read prematurely.
Disposed event subscriptions cannot invoke a captured invalidation callback.

## Validation

- All 298 unit tests and the production build passed locally.
- Chromium acceptance passed at desktop 1440 x 1000 and mobile 390 x 844.
- The browser fixture persisted account/network changes across reloads and checked
  account switching, wrong-network reconnection, return to Arc and provider
  disconnection. A wallet change during a pending Gateway request removed its
  prior identity/evidence and required reconnection.
- Morpho inspection, Gateway research, five languages, evidence downloads and
  API error states continued to pass. No page exceptions or horizontal overflow
  were observed. No signing or transaction method was requested.

The report is [WALLET_SESSION_BROWSER_2026-10-31.json](WALLET_SESSION_BROWSER_2026-10-31.json).
Wallet and API responses are simulated; this does not establish compatibility
with every real extension, WalletConnect/QR behavior or financial execution.

Deployment verification and the remote CI result are recorded in PR #15 once
available. The implementation does not enable a new wallet transport or a new
financial action.
