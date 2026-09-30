# CofferHouse Holder Command Center

The Holder Command Center is the private-product doorway between the public CofferHouse site and its tools.

## Product path

1. **CofferHouse public site** explains the project and membership.
2. **Holder Center** identifies the access key, progression and entitlements.
3. **Tools** open only from the holder workspace: Agent Suite, rewards, ascension, Vault and future services.

The public site is not replaced by this application. The Vercel application hosts the authenticated-product experience; `#holders` is its default route and legacy `#agents` links remain supported.

## Information shown

| Area | Purpose | Data source today | Production source |
| --- | --- | --- | --- |
| NFT / access key | Identify membership and card class | Unavailable in demo | Verified membership contract |
| Progression | Show Member → Keyholder path | Representative Member preview | Ascension contract/indexer |
| $COFFERS | Show connected-wallet balance | Unavailable in demo | Verified token contract |
| Rewards | Show accrued and claimable amounts | Unavailable in demo | Verified reward contracts |
| Reward destination | Record the holder's intended reward treatment | Browser-local preference | Signed account setting and contract flow |
| Services | Explain access by permanent level | Static entitlement catalog | On-chain ownership plus policy service |

## Permanent levels

| Level | $COFFERS threshold | Representative access |
| --- | ---: | --- |
| Member | 0 | Identity, dashboard and Agent Suite research preview |
| Builder | 20,000 | DCA configuration |
| Steward | 80,000 | Adaptive DCA and Big Coffer eligibility |
| Partner | 320,000 | DCA and Grid tooling |
| Keyholder | 1,000,000 | Broadest scanner and advanced-agent access |

Thresholds are product configuration, not proof of a deployed contract. The interface must not claim ownership, balances, rewards, eligibility or execution until those sources are connected and verified.

## Safety boundary

The current Holder Center is a read-only representative preview. It has no wallet authority, custody, signature request or transaction execution. A saved reward mode is stored only in the browser and is not an instruction to move funds.
