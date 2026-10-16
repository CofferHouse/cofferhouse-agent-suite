# Server dependency review — October 15, 2026

The MetaMask warning investigation identified dependency advisories in the server
SDK tree. No causal link to the website classification was established.

This change updates Circle SDK packages within the existing declared version
ranges (App Kit 1.16.0 to 1.17.0) and pins the TOML parser used by
`@coral-xyz/anchor` to `toml@4.2.0` using an npm override. This preserves the
existing collection, wallet connection and reward-claim code.

## Advisory scope and remaining work

The production dependency audit initially reported 28 affected package entries:
9 high, 11 moderate and 8 low. After the change it reports 27 entries:
0 high, 19 moderate and 8 low; no critical entries in either scan. These are
package-tree counts, not counts of independently exploitable vulnerabilities.
High-severity transitive entries drop to moderate once TOML is patched, while
other dependency advisories remain.

The TOML recursion fix is documented in GHSA-82x6-q7mm-w9cf (patched in 4.2.0);
the prototype-pollution fix in GHSA-v5mp-jgw5-2x6j is also included.
Anchor's workspace loader uses `toml.parse(Buffer)`; the compatibility test checks
that exact input form and ordinary provider/program configuration.

Remaining advisories include stream-json, uuid and elliptic paths through the SDK
tree. Do not force a stream-json or jayson major upgrade merely to clear a report:
existing consumers import older CommonJS/subpath APIs. Compatibility and upstream
SDK support must be evaluated before replacing them. No claim of production
safety or full vulnerability remediation is made here.

## Validation

`npm run check` passes. Additional tests resolve TOML through the actual Anchor
dependency, check normal Buffer configuration, reject deeply nested input without
a stack overflow, check prototype safety and import all three server SDK routes.
The built browser asset filenames and sizes are unchanged by this server-focused
dependency update. External Circle service requests and wallet end-to-end actions
are not exercised by the import tests.

Reproduce the report with `npm audit --omit=dev --json`. Registry advisory data
can change over time. No production deployment or Blockaid classification change
is performed by this PR; Blockaid review was requested separately.
