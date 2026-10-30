import { writeFile } from "node:fs/promises";
import { fetchGatewayObservation } from "../packages/arc-data/gateway.js";
import { createGatewayReceipt } from "../packages/evidence/gateway-receipt.js";

const [output, depositor = null] = process.argv.slice(2);
if (!output) throw new Error("Usage: node scripts/capture-gateway.mjs OUTPUT.json [EVM_DEPOSITOR]");
const observation = await fetchGatewayObservation({ depositor });
await writeFile(output, `${JSON.stringify(createGatewayReceipt(observation), null, 2)}\n`);
console.log(JSON.stringify({ network: observation.network, domains: observation.domains.length, assets: observation.assets.map(asset => ({ token: asset.token, status: asset.status, confirmedUnits: asset.confirmedUnits })) }));
