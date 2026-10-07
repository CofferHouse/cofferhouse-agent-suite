import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../apps/agent-suite/src/main.js", import.meta.url), "utf8");
const styleSource = await readFile(new URL("../apps/agent-suite/src/styles.css", import.meta.url), "utf8");

test("Agent Suite provides a keyboard entry point and named main region", () => {
  assert.match(mainSource, /class="skip-link" href="#main-content"/);
  assert.match(mainSource, /<main id="main-content" tabindex="-1">/);
  assert.match(styleSource, /\.skip-link:focus/);
});

test("inactive Agent Suite rooms leave the accessibility tree", () => {
  assert.match(mainSource, /view\.toggleAttribute\("inert", !isActive\)/);
  assert.match(mainSource, /view\.setAttribute\("aria-hidden", String\(!isActive\)\)/);
  assert.match(mainSource, /aria-controls="\$\{suiteViewTargets\[tab\.id\]\}"/);
});

test("keyboard focus and reduced-motion preferences are visible and respected", () => {
  assert.match(styleSource, /:focus-visible/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(mainSource, /activeHeading\?\.focus\(\{ preventScroll: true \}\)/);
});

test("hidden receipt file picker retains an accessible name", () => {
  assert.match(mainSource, /aria-label="Select a Scout receipt JSON file to verify"/);
});
