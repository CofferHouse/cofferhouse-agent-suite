# Holder Center membership rehearsal

The Holder Center now includes a separate, explicitly labelled Arc Testnet panel. Production membership actions remain unavailable. The existing research tools and Telegram subscriptions keep their own mainnet identity flow; no agent receives transaction authority.

## Verified rehearsal contracts

| Item | Arc Testnet address |
| --- | --- |
| Membership | `0x9f439d557355674f22e8f2a8babbf22a1122f24a` |
| TESTCOFFERS | `0xd554aa76030dc7f18db5c6fe1d798c89a1d596bf` |
| Rewards | `0x91c838c6c2f1d63900c3cbeb980b2012b747f9f4` |

Chain ID: 5042002. These addresses must never be used as production configuration.

Memberships 2 and 3 were sacrificed to raise membership 4 to level 2. A subsequent 320,000 TESTCOFFERS payment raised membership 4 to level 3. The metadata route ends in `/3/4.json`; its `example.invalid` base is a placeholder, not hosted metadata.

Period 1 reserves 1,000 TESTCOFFERS for the snapshot wallet. At block 67077705, membership 1 has level 2 (4 internal points), membership 4 has level 3 (7 points), and membership 5 remains unactivated (0 points). Total: 11 internal points / 5.5 displayed weight.

The exact manifest bytes are served at `/rewards/testnet-epoch-1.json`. The UI verifies their hash, root, domain, budget, snapshot block and total points against the published epoch, then verifies the wallet's Merkle proof. No balance or reward allocation is inferred from browser preferences.

Claim availability: Unix timestamp 1792026523 (2026-10-14 19:08:43 America/Mexico_City). The claim has not been executed as of this implementation. Future periods require a verified manifest catalog; this panel intentionally supports only rehearsal period 1.

## Wallet behavior

- Reads ownership and levels at one block. Only the ERC721A nonexistent-owner selector is skipped; other RPC errors abort the refresh.
- Every write checks the selected account and Arc Testnet chain, simulates first, and waits for a successful receipt.
- Paid ascension reads the next cost from the contract. If necessary it resets a nonzero allowance and approves only the required amount.
- Sacrifice validates ownership, activation, homogeneous sacrificed levels, quantity and distinct IDs, and presents the burned IDs before requesting a wallet transaction.
- Account/network changes invalidate displayed memberships and reward state. No private keys or server-side wallet signatures are used.
- Reward claims pay the snapshot beneficiary; no token approval is requested for a claim.
- A live countdown enables claim after review; onchain simulation remains authoritative if the browser clock differs.

## Source repair and validation

The latest main.js contained a corrupt prefix. The repair restores that prefix from commit 0aa394b6 while preserving the valid suffix and Telegram preference-update/disconnect behavior from the newer commit.

Validation: 202 Node tests passed; Vite production build passed. Live RPC confirmed the burned-token error selector. Browser wallet end-to-end actions and the post-review claim remain pending. This is not an independent security audit.

Vercel CSP now allows only the additional Arc Testnet RPC origin needed by this panel. Upstash Redis is unchanged; membership ownership and allocations are read from the contracts rather than stored in Redis.
