import { writeFile } from "node:fs/promises";
import { fetchVaultExposure } from "../packages/arc-data/vault-exposure.js";
import { createVaultExposureReceipt } from "../packages/evidence/vault-exposure-receipt.js";

const [vault, output] = process.argv.slice(2);
if (!/^0x[0-9a-f]{40}$/i.test(vault ?? "") || !output) throw new Error("Usage: node scripts/capture-vault-exposure.mjs VAULT OUTPUT.json");
const observation = await fetchVaultExposure(vault);
await writeFile(output, `${JSON.stringify(createVaultExposureReceipt(observation), null, 2)}\n`);
console.log(JSON.stringify({ vault: observation.vaultAddress, version: observation.version, status: observation.status, sourceBlocks: observation.sourceBlocks, positions: observation.positions.length }));
