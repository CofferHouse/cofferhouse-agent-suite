# Scout Receipt Registry

`ScoutReceiptRegistry.sol` is an optional, permissionless publication registry for SHA-256 receipt hashes on Arc.

- It stores only a 32-byte content hash, policy hash, publisher, and timestamp.
- It never stores raw market observations or user information.
- Anchoring proves that an address published a hash; it does not prove that the observation was correct or approved by CofferHouse.
- Duplicate hashes are rejected.
- No private key belongs in this repository or in the frontend.

Deployment is intentionally not automated until the bytecode is compiled, independently reviewed, and the operator explicitly authorizes an Arc mainnet transaction.
