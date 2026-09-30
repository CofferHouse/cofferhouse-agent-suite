import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? javascriptFiles(resolve(directory, entry.name))
    : entry.name.endsWith(".js") ? [resolve(directory, entry.name)] : []));
  return nested.flat();
}

test("server API never imports implementation from the visual application", async () => {
  const files = await javascriptFiles(resolve("api"));
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  assert.equal(sources.some((source) => source.includes("apps/agent-suite")), false);
});

test("Agent Suite application directory contains presentation entrypoints only", async () => {
  const files = await javascriptFiles(resolve("apps/agent-suite/src"));
  assert.deepEqual(files.map((file) => file.split("/").at(-1)).sort(), ["main.js"]);
});
