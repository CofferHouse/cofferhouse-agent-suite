# Arc App Kits in CofferHouse

CofferHouse uses Circle's official Arc App Kit SDK as an integration layer rather than recreating protocol-specific flows.

## Earn Kit — Opportunities

Earn candidates that clear the visible Opportunity limits now feed a dedicated Strategy Lab branch. The branch uses the shared capital, reserve, diversification and concentration bounds, but it preserves Arc Earn vault evidence separately from direct Morpho market evidence. It never merges the two datasets or counts an apparent underlying exposure twice. Its sealed receipt records the official source, vault identity, modeled amount, observed APY, sizing cap, warnings and human-review conditions.

## Onramp Kit — Holder Center

Holder Center now exposes a protected Onramp readiness flow. The public `GET /api/app-kits/onramp` route reports only whether the required server gates exist. Session minting uses `POST` and currently requires the operator bearer gate in addition to a valid connected Arc destination. The Circle API key and referrer domain never enter the browser bundle. A created session is short-lived and opens Circle's hosted flow; it does not itself purchase, deposit or invest funds.

Production holder access must replace the temporary operator demo gate with authenticated membership sessions. The destination wallet must be bound to that authenticated holder before a Circle session is minted.

## Product signals from the Arc ecosystem

- **Embedded wallets:** 1shot demonstrates the product path from passkey-controlled wallet to fiat-funded USDC and scoped permissions. CofferHouse treats this as a UX reference, not a dependency or custody claim.
- **Institutional RWA:** Centrifuge's Arc deployment introduces ERC-4626 exposures to tokenized Treasuries, AAA CLOs and high-yield corporate credit. A future RWA Opportunity adapter must preserve asset class, issuer, NAV oracle, liquidity and transfer restrictions separately from lending-vault evidence.
- **Borrow lifecycle:** Borrow Kit provides market discovery, collateral sizing, quote-time health factor, atomic wallet actions and ongoing health bands. Action Center will own quote review; Guardian will own post-origination health monitoring. No write is enabled until wallet, quote freshness and human approval are independently verified.

## Borrow Kit — Action Center

Action Center now discovers official Arc cirBTC/USDC markets through Borrow Kit and requests `getRequiredCollateral` sizing for a user-selected USDC amount and target health factor. The result preserves market liquidity, utilization, LLTV, variable borrow APY, required cirBTC, resulting health factor, Borrow Kit risk band and liquidation price. Utilization at or above 95% is elevated as a visible review condition.

Each preview can be downloaded as a sealed `cofferhouse.arc-app-kits.borrow-preview-receipt.v1` document. The receipt explicitly records that no wallet adapter, token approval, calldata, signature, loan or transaction was created. Future wallet execution must re-fetch the market and a fresh actionable quote, pass the single human gate and reconcile any submitted result before retrying.

- `/api/app-kits/earn` performs read-only Arc mainnet vault discovery.
- Opportunity Agent displays observed APY, available liquidity, protocol, asset and liquidity status.
- Discovery works without an API key at a shared rate limit. `CIRCLE_API_KEY` is recommended for production and must remain server-side.
- No deposit or withdrawal is prepared by this release.

## Onramp Kit — Holder Center

- Holder Center exposes the intended funding step and its requirements.
- Production activation requires a Circle API key, a server-created 30-minute session, destination wallet, allowed referrer domain, applicable KYC/KYB and an eligible jurisdiction/payment method.
- CofferHouse never places the Circle API key in browser code.

## Borrow Kit — Action Center

- Action Center identifies Borrow Kit as the future execution adapter for cirBTC-collateralized USDC loans.
- Current behavior remains simulation and auditable intent only.
- Real origination stays disabled until wallet atomic batching, fresh collateral/health evidence, human approval and explicit wallet signature are implemented and tested.

## Safety boundary

Installing an SDK does not grant execution authority. CofferHouse keeps discovery, research, approval and transaction submission as separate stages. No browser-visible API key, custody, silent signature or automatic transaction is introduced.

Official documentation:

- https://docs.arc.io/app-kit
- https://docs.arc.io/app-kit/earn
- https://docs.arc.io/app-kit/onramp
- https://docs.arc.io/app-kit/borrow
