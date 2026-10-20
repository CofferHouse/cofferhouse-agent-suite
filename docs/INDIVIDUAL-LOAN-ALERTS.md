# Individual loan alerts — draft integration

## Status and validation

Prepared on a review branch. The execution environment was unavailable, so npm tests and the production build have NOT been run for this change. Twelve side-effect-injected service checks passed in an isolated JavaScript runtime; this covers the registration/delivery logic, not Node imports, SDK calls, real Redis atomicity or Telegram delivery. The same cases are included as Node tests. Nothing is merged or activated by this draft.

## Private registration

POST /api/guardian/loan-watch accepts a private connected Telegram management token and an action: LIST, ADD, REMOVE or RETRY. ADD requires a loan UUID and explicit consent:true. Wallet identity is derived from the existing wallet-signature-backed Telegram connection, never accepted from the watch request. Borrow Kit must return the same loan UUID, Arc chain and wallet. This is provider-reported ownership, not an independent onchain proof.

The management token must match the CURRENT linkedAt session. Both the wallet subscription and chat-to-wallet record are checked. Only positive private chat IDs matching the linked Telegram user ID are accepted. Group/channel subscriptions cannot register or receive these financial notices. The endpoint returns only the caller wallet's watches. No transaction, approval, repayment or custody authority is introduced. Membership ownership/access eligibility is not verified by this change.

The existing Guardian preference must remain enabled. Registration additionally requires opt-in consent. Removing a watch, disconnecting the subscription, turning Guardian off, reassigning the chat or replacing the wallet-link session prevents subsequent delivery checks. Watches can be listed and removed by the current connected wallet; old private tokens cannot manage a replacement session.

Management requests share an atomic Redis quota of 20 requests per wallet per 60-second window, including LIST and RETRY. Excess requests return 429; a store failure returns 503. This does not replace infrastructure-level protection against unauthenticated floods.

## Durable state

A bounded CAS registry holds at most 20 pilot watches globally and five per wallet. Changes are atomic compare-and-set operations. Repeated ADD for the same loan/session is idempotent. REMOVE only affects the caller wallet. Re-registering an old loan under a new connection gets a new watch ID. Removed-watch state is retained for diagnosis; a retention/deletion policy remains future work.

Each watch stores its last health band, transition revision and delivery state under its opaque watch ID. Fresh server-side position observations produce WARN, URGENT, IMMINENT, LIQUIDATABLE or UNAVAILABLE alerts. Stable healthy/no-debt results update the baseline without messages; recovery followed by renewed deterioration creates a new transition. UNAVAILABLE messages are generic and never contain foreign provider economics or raw errors.

A transition is durably claimed before sending. Concurrent cycles do not send the same transition twice. Immediately before delivery, the watch, current connection, preferences, chat ownership and transition state are checked again. An already in-flight Telegram request cannot be recalled after revocation.

Telegram does not offer an exactly-once idempotency key for this flow. Ambiguous errors/timeouts or crashes leave the delivery CLAIMED/UNKNOWN and do not automatically retry the same band. This favors duplicate suppression over guaranteed delivery. It can lose an alert. LIST exposes delivery status to the connected wallet. RETRY can explicitly request one more attempt for UNKNOWN after ten minutes, with consent:true and acceptDuplicate:true. The next cycle re-observes health and checks revocation before sending. A retry may duplicate a message Telegram already received. Only one retry per unchanged band is allowed. CLAIMED after a crash still requires operator diagnosis; it is not automatically retried. Reminder policies are not implemented. A provider recovering to a healthy baseline then deteriorating again produces a new alert. No claim of exactly-once delivery is made.

## Scheduled runtime

The existing authenticated Scout cycle calls the loan watcher before market discovery and publishes only aggregate counts. No loan UUID, wallet, chat ID, private token or loan economics are added to public cycle status. Per-watch failures do not cancel other watches. Disabled mode performs no loan registry reads or sends.

GUARDIAN_LOAN_WATCH_ENABLED must explicitly equal true AND the existing durable store/Telegram configuration must be available. This draft does not set that flag, create a bot, configure a webhook or add a schedule. The management endpoint is also disabled until the flag is enabled.

Borrow observations and Telegram fetches have five-second timeouts. A cycle starts no further watch after its 15-second processing budget; the persistent cursor rotates deferred watches. The currently in-flight watch may exceed that budget by one observation/send window. Provider timeouts do not cancel the SDK's underlying read but cannot execute a transaction.

Before activation, measure total runtime against the existing 60-second server limit. The existing GitHub workflow invokes Scout every 15 minutes and Vercel has a daily fallback; neither is a liquidation-prevention guarantee. Timely loan monitoring needs an explicitly verified effective cadence, reliable delivery and provider freshness. Webhooks/high-frequency monitoring are not added here.

## API requests

ADD: {token: privateStatusToken, action: "ADD", loanId: loanUuid, consent: true}
LIST: {token: privateStatusToken, action: "LIST"}
REMOVE: {token: privateStatusToken, action: "REMOVE", loanId: loanUuid}
RETRY: {token: privateStatusToken, action: "RETRY", loanId: loanUuid, consent: true, acceptDuplicate: true}

Keep privateStatusToken out of URLs, logs, analytics and public issue/PR comments. No browser controls have been added yet; this draft prepares the backend endpoint and runtime only.

## Required checks before merge/activation

Run npm run check, including the new Node service tests. Verify route authentication, session replacement/revocation, SDK ownership mapping, private chat routing, real Redis CAS and ambiguous delivery behavior in a controlled test environment. Load-test the timing and registry capacity. Do not enable production sends until end-to-end tests and explicit recipient opt-in are in place.

## Reproducible verification

The PR workflow installs the lockfile with npm ci, checks the installed Borrow Kit getPosition method without contacting a provider, and runs npm run check on Node 22. A green SDK shape check does not verify provider response semantics, onchain ownership or real Telegram/Redis behavior. Review the workflow result before merging; adding a workflow is not evidence it passed.
