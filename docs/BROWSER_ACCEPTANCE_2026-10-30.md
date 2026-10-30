# Holder Center browser acceptance — 30 October 2026

The combined Morpho/Gateway implementation passed deterministic Chromium browser
acceptance at 1440 x 1000 and 390 x 844. The captured result is in
[BROWSER_ACCEPTANCE_2026-10-30.json](BROWSER_ACCEPTANCE_2026-10-30.json).

## Checked in both viewports

- Gateway support query, disabled balance query before wallet connection, and
  confirmed balances separated by asset, including eight-decimal cirBTC amounts.
- Gateway and Morpho evidence downloads pass the shared integrity verifier.
- English, Chinese, Japanese, Hindi and Spanish controls preserve displayed token
  amounts. The selected language persists after a page reload.
- Failed Gateway/Morpho responses replace the observation with an unavailable
  state and remove its download button.
- Disconnecting the simulated wallet while a balance response is pending clears
  the Gateway panel; the late response does not repopulate it.
- Holder Center navigation reaches Opportunity Agent and its vault inspection.
- No unexpected page exceptions or page-wide horizontal overflow were observed.
- Wallet calls were limited to account and chain identity reads/connection. No
  signing, token approval or transaction method was requested.

**Scope:** browser APIs, backend responses and the wallet provider are simulated.
This checks the rendered application and its event handlers; it does not verify
a deployed backend, a real wallet extension, production credentials, mainnet
execution, every device or every possible translation. Previous live API smoke
captures remain separate evidence. No browser screenshots with user data are used.

## Reproduce

```sh
npm ci --ignore-scripts
npx playwright install --with-deps chromium
npm run test:browser
```

The runner starts and closes its own localhost Vite server. It needs no API key,
funded wallet or production server. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point
to an existing compatible headless Chromium binary when managed browser downloads
are unavailable. `BROWSER_QA_ARTIFACT_DIR` optionally saves mock-data screenshots
and the JSON report; `browser-artifacts/` is ignored by git.

The new GitHub Actions workflow runs unit checks, the production build and browser
acceptance on relevant pull requests, with read-only repository permissions and
no project secrets. Its remote run is separate from the completed local checks.

Local validation: all 289 unit tests passed, production build passed, and both
browser viewport scenarios passed. No production behavior needed correction in
these scenarios. Deployment and real-wallet validation remain pending.
