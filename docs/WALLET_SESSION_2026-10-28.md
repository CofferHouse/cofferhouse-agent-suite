# Holder Center wallet session — 28 October 2026

The [31 October release validation](WALLET_SESSION_RELEASE_2026-10-31.md) updates
this work against the current Morpho/Gateway implementation.

After an injected browser wallet connects, changing accounts or networks, or
disconnecting the provider, reloads Holder Center and requires explicit
reconnection. This clears the page's wallet identity, Telegram subscription
credentials and prepared Onramp session links, including pending UI requests.
Browser preferences remain saved. Existing Telegram subscriptions and external
funding sessions are not revoked by this page reset.

This change supports the existing injected provider integration. It does not add
WalletConnect, a QR login, transaction execution or production service credentials.
The QR problem discussed earlier has not been reproduced or resolved here.

Validation: event tests cover account removal, network changes, disconnection,
duplicate events, listener cleanup and providers without event support. Full
automated checks and production build passed (`npm run check`). A real-wallet
browser check remains necessary to confirm the deployed user flow.
