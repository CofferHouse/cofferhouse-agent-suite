# Arc App Kits in CofferHouse

CofferHouse uses Circle's official Arc App Kit SDK as an integration layer rather than recreating protocol-specific flows.

## Earn Kit — Opportunities

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
