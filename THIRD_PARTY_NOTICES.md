# Third-party code notices

## 4mica base64 decoding

`packages/shared/fourmica-base64.js` adapts the byte conversion and Web-standard
base64/UTF-8 decoding approach from `packages/sdk/src/x402/base64.ts` in
[4mica-Network/4mica](https://github.com/4mica-Network/4mica/blob/f9757b79de87fee65efe1e9e4d8dc05b4c6dd045/packages/sdk/src/x402/base64.ts),
commit `f9757b79de87fee65efe1e9e4d8dc05b4c6dd045`.

Copyright (c) 2025 4mica Network. MIT license; the complete notice and disclaimer
are retained in [LICENSES/4mica-MIT.txt](LICENSES/4mica-MIT.txt).

Changes: TypeScript removed; only the required decoder retained; input length,
canonical base64, fatal UTF-8 and JSON validation added. This does not imply
endorsement, a partnership or an audit by 4mica. Other CofferHouse code is not
relicensed by this notice.
