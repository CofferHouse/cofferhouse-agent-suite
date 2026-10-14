import { createPublicClient, createWalletClient, custom, defineChain, encodeAbiParameters, formatUnits, http, keccak256, parseAbi, stringToHex } from "viem";
import { validateRewardCatalog, selectRewardPeriod, validateRewardBinding } from "./reward-catalog.js";
import { membershipWeights, sacrificePreview, rewardStatus } from "./membership-policy.js";
import { escapeHtml as h } from "../shared/index.js";

const chain = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } });
export const rehearsal = Object.freeze({ chainId: chain.id, membership: "0x9f439d557355674f22e8f2a8babbf22a1122f24a", token: "0xd554aa76030dc7f18db5c6fe1d798c89a1d596bf", rewards: "0x91c838c6c2f1d63900c3cbeb980b2012b747f9f4" });
const nftAbi = parseAbi(["function getMintStats(address) view returns(uint256,uint256,uint256)", "function ownerOf(uint256) view returns(address)", "function tier(uint256) view returns(uint8)", "function ascendCost(uint256) view returns(uint256)", "function ascensionEnabled() view returns(bool)", "function burnToken() view returns(address)", "function activate(uint256)", "function ascend(uint256)", "function cannibalize(uint256,uint256[])"]);
const tokenAbi = parseAbi(["function balanceOf(address) view returns(uint256)", "function allowance(address,address) view returns(uint256)", "function decimals() view returns(uint8)", "function approve(address,uint256) returns(bool)"]);
const rewardsAbi = parseAbi(["function membership() view returns(address)", "function epochs(uint256) view returns(address token,bytes32 root,bytes32 manifestHash,uint256 snapshotBlock,uint256 budget,uint256 paid,uint256 availableAt,uint256 totalPoints,uint256 claimedPoints)", "function paused() view returns(bool)", "function claimed(uint256,address) view returns(bool)", "function claim(uint256,address,uint256,bytes32[])"]);
const rpc = createPublicClient({ chain, transport: http() });
const read = (address, abi, functionName, args = [], blockNumber) => rpc.readContract({ address, abi, functionName, args, ...(blockNumber === undefined ? {} : { blockNumber }) });
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
let state = { account: null, memberships: [], balance: null, decimals: 18, costs: [], reward: null, periods: [], selectedEpoch: null, busy: false, message: "Connect an Arc Testnet wallet to read your memberships. Mainnet actions are disabled." };
let generation = 0;
let boundProvider;
let actionLocked = false;

function forget() {
  generation++;
  state = { ...state, account: null, memberships: [], balance: null, costs: [], reward: null, message: "Wallet or network changed. Reconnect to refresh verified data." };
  paint();
}
function provider() {
  const p = window.ethereum;
  if (!p?.request) throw Error("Install a browser wallet first.");
  if (p !== boundProvider) {
    boundProvider?.removeListener?.("accountsChanged", forget);
    boundProvider?.removeListener?.("chainChanged", forget);
    p.on?.("accountsChanged", forget); p.on?.("chainChanged", forget); boundProvider = p;
  }
  return p;
}
async function walletContext() {
  const p = provider();
  const [accounts, id] = await Promise.all([p.request({ method: "eth_accounts" }), p.request({ method: "eth_chainId" })]);
  if (Number(id) !== chain.id) throw Error("Switch your wallet to Arc Testnet (5042002). No mainnet transaction will be requested.");
  if (!state.account || !same(accounts[0] ?? "", state.account)) throw Error("Wallet changed. Reconnect first.");
  return createWalletClient({ account: state.account, chain, transport: custom(p) });
}
function isBurned(error) {
  // Only ERC721A OwnerQueryForNonexistentToken is omitted; provider failures abort.
  for (let e = error; e; e = e.cause) if (e.data?.raw === "0xdf2d9b42" || e.data === "0xdf2d9b42") return true;
  return false;
}
async function reload() {
  const revision = generation, account = state.account;
  await walletContext();
  const blockNumber = await rpc.getBlockNumber();
  const [, minted] = await read(rehearsal.membership, nftAbi, "getMintStats", [account], blockNumber);
  if (minted > 4444n) throw Error("Unexpected membership supply.");
  const memberships = [];
  for (let start = 1; start <= Number(minted); start += 16) {
    const batch = await Promise.all(Array.from({ length: Math.min(16, Number(minted) - start + 1) }, async (_, i) => {
      const id = BigInt(start + i);
      let owner;
      try { owner = await read(rehearsal.membersship, nftAbi, "ownerOf", [id], blockNumber); }
      catch (error) { if (isBurned(error)) return null; throw error; }
      if (!same(owner, account)) return null;
      return { id: String(id), level: Number(await read(rehearsal.membersship, nftAbi, "tier", [id], blockNumber)) };
    }));
    memberships.push(...batch.filter(Boolean));
  }
  const [balance, decimals, enabled, token, linked, costs] = await Promise.all([
    read(rehearsal.token, tokenAbi, "balanceOf", [account], blockNumber), read(rehearsal.token, tokenAbi, "decimals", [], blockNumber),
    read(rehearsal.membership, nftAbi, "ascensionEnabled", [], blockNumber), read(rehearsal.membership, nftAbi, "burnToken", [], blockNumber),
    read(rehearsal.rewards, rewardsAbi, "membership", [], blockNumber), Promise.all([1,2,3,4,5].map(n => read(rehearsal.membership, nftAbi, "ascendCost", [BigInt(n)], blockNumber)))
  ]);
  if (!same(token, rehearsal.token) || !same(linked, rehearsal.membership)) throw Error("Contract configuration does not match this rehearsal.");
  const catalogResponse = await fetch("/rewards/testnet-catalog.json", { cache: "no-store" });
  if (!catalogResponse.ok) throw Error("Reward catalog is unavailable.");
  const periods = validateRewardCatalog(await catalogResponse.json(), rehearsal);
  const selected = selectRewardPeriod(periods, state.selectedEpoch);
  if (!selected) {
    if (revision !== generation) return;
    state = { ...state, memberships, balance, decimals, enabled, costs, blockNumber, periods, selectedEpoch: null, reward: null, message: "Verified memberships. No reward periods are listed yet." };
    return;
  }
  const response = await fetch(selected.manifest, { cache: "no-store" });
  if (!response.ok) throw Error("Reward proof is unavailable.");
  const bytes = await response.text(), manifest = JSON.parse(bytes), d = manifest.domain;
  validateRewardBinding(manifest, selected, rehearsal);
  const [values, claimed, paused] = await Promise.all([read(rehearsal.rewards, rewardsAbi, "epochs", [BigInt(d.epoch)], blockNumber), read(rehearsal.rewards, rewardsAbi, "claimed", [BigInt(d.epoch), account], blockNumber), read(rehearsal.rewards, rewardsAbi, "paused", [], blockNumber)]);
  const [epochToken, root, manifestHash, snapshotBlock, budget, paid, availableAt, totalPoints] = values;
  if (!same(epochToken, d.token) || root !== manifest.root || manifestHash !== keccak256(stringToHex(bytes)) || snapshotBlock !== BigInt(manifest.snapshotBlock) || budget !== BigInt(manifest.budget) || totalPoints !== BigInt(manifest.totalPoints)) throw Error("Published reward period does not match its proof.");
  const rewardDecimals = Number(await read(selected.token, tokenAbi, "decimals", [], blockNumber));
  const claim = manifest.claims.find(c => same(c.account, account));
  if (claim) {
    let hash = keccak256(keccak256(encodeAbiParameters([{type:"uint256"},{type:"address"},{type:"address"},{type:"uint256"},{type:"address"},{type:"address"},{type:"uint256"}], [BigInt(chain.id), rehearsal.rewards, rehearsal.membership, BigInt(d.epoch), d.token, claim.account, BigInt(claim.points)])));
    for (const sibling of claim.proof) hash = keccak256(`0x${[hash,sibling].sort().map(x => x.slice(2)).join("")}`);
    if (hash !== root) throw Error("Invalid reward proof.");
  }
  if (revision !== generation) return;
  state = { ...state, memberships, balance, decimals, enabled, costs, blockNumber, periods, selectedEpoch: selected.epoch, reward: { manifest, claim, decimals: rewardDecimals, symbol: selected.symbol, epoch: { availableAt, budget, paid, totalPoints }, claimed, paused }, message: "Verified on Arc Testnet. All transactions require your wallet confirmation." };
}
async function connect() {
  await provider().request({ method: "eth_requestAccounts" });
  const [accounts, id] = await Promise.all([provider().request({ method: "eth_accounts" }), provider().request({ method: "eth_chainId" })]);
  if (Number(id) !== chain.id) throw Error("Select Arc Testnet in your wallet, then connect again.");
  if (!accounts[0]) throw Error("No wallet account is available.");
  state = { ...state, account: accounts[0], memberships: [], balance: null, costs: [], reward: null }; generation++;
  await reload();
}
async function send(address, abi, functionName, args) {
  const wallet = await walletContext();
  const { request } = await rpc.simulateContract({ address, abi, functionName, args, account: state.account });
  await walletContext();
  const hash = await wallet.writeContract(request);
  state.message = `Transaction submitted: ${hash}`; paint();
  const receipt = await rpc.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw Error("Transaction reverted. Refresh before retrying.");
}
async function ascend(id) {
  await reload();
  const item = state.memberships.find(x => x.id === id);
  if (!state.enabled || !item || item.level >= 5) throw Error("This membership cannot ascend.");
  const cost = state.costs[item.level];
  if (state.balance < cost) throw Error("Insufficient TESTCOFFERS balance.");
  if (!window.confirm(`Membership #${id}: level ${item.level} → ${item.level + 1}.\nSend ${formatUnits(cost, state.decimals)} TESTCOFFERS to the burn address.\nToken approval may require a separate wallet confirmation.`)) return;
  const allowance = await read(rehearsal.token, tokenAbi, "allowance", [state.account, rehearsal.membership]);
  if (allowance < cost) {
    if (allowance > 0n) await send(rehearsal.token, tokenAbi, "approve", [rehearsal.membership, 0n]);
    await send(rehearsal.token, tokenAbi, "approve", [rehearsal.membership, cost]);
  }
  await send(rehearsal.membership, nftAbi, item.level === 0 ? "activate" : "ascend", [BigInt(id)]);
  await reload();
}
async function sacrifice(survivorId, ids) {
  await reload();
  if (!state.enabled) throw Error("Ascension is disabled.");
  const preview = sacrificePreview(state.memberships, survivorId, ids);
  if (!window.confirm(`Keep membership #${survivorId} and raise it to level ${preview.target}.\nPermanently burn memberships: ${ids.map(x => `#${x}`).join(", ")}.\nThis cannot be undone. No TESTCOFFERS payment is required.`)) return;
  await send(rehearsal.membership, nftAbi, "cannibalize", [BigInt(survivorId), ids.map(BigInt)]);
  await reload();
}
async function claim() {
  await reload();
  const reward = state.reward;
  if (!reward?.claim || rewardStatus(reward.epoch, reward.claimed, reward.paused, Math.floor(Date.now()/1000)) !== "CLAIMABLE") throw Error("This reward is not currently claimable.");
  await send(rehearsal.rewards, rewardsAbi, "claim", [BigInt(reward.manifest.domain.epoch), reward.claim.account, BigInt(reward.claim.points), reward.claim.proof]);
  await reload();
}
async function run(action) {
  if (actionLocked) return;
  actionLocked = true; state.busy = true; paint();
  try { await action(); } catch (error) { state.message = error.shortMessage ?? error.message ?? "Request failed. Refresh before retrying."; }
  finally { actionLocked = false; state.busy = false; paint(); }
}
function paint() {
  const container = document.querySelector("#membership-rehearsal");
  if (!container) return;
  const reward = state.reward, status = reward ? rewardStatus(reward.epoch, reward.claimed, reward.paused, Math.floor(Date.now()/1000)) : null;
  const display = n => h(formatUnits(n, state.decimals));
  container.innerHTML = `<header><span>ARC TESTNET · MEMBERSHIP REHEARSAL</span><h2>Your memberships and rewards.</h2><p>Test tokens and test memberships only. These actions do not activate the production collection.</p><button id="membership-connect" ${state.busy ? "disabled" : ""}>${state.account ? "REFRESH TESTNET DATA" : "CONNECT TESTNET WALLET"}</button></header><p role="status">${h(state.message)}</p>${state.account ? `<code>${h(state.account)}</code>` : ""}
    ${state.balance !== null ? `<div class="membership-summary"><p><b>${display(state.balance)}</b> TESTCOFFERS</p><p><b>${state.memberships.reduce((sum,x) => sum + membershipWeights[x.level],0)/2}</b> current reward weight</p><p>Verified at block ${h(String(state.blockNumber))}</p></div>` : ""}
    <div class="membership-cards">${state.memberships.map(x => `<article><h3>Membership #${h(x.id)}</h3><p>${x.level === 0 ? "Unactivated" : `Level ${x.level}`} · reward weight ${membershipWeights[x.level]/2}</p>${x.level < 5 ? `<p>Next step: ${display(state.costs[x.level])} TESTCOFFERS</p><button data-ascend="${h(x.id)}" ${state.busy || !state.enabled ? "disabled" : ""}>${x.level === 0 ? "ACTIVATE" : "ASCEND"}</button>` : "<p>Maximum level reached</p>"}</article>`).join("")}</div>
    ${state.memberships.length ? `<form id="membership-sacrifice"><h3>Ascend by sacrifice</h3><label>Membership to keep<select name="survivor">${state.memberships.filter(x=>x.level>0&&x.level<5).map(x=>`<option value="${h(x.id)}">#${h(x.id)} · Level ${x.level}</option>`).join("")}</select></label><fieldset><legend>Memberships to burn permanently</legend>${state.memberships.map(x=>`<label><input type="checkbox" name="burn" value="${h(x.id)}"> #${h(x.id)} · Level ${x.level}</label>`).join("")}</fieldset><button ${state.busy || !state.enabled ? "disabled" : ""}>REVIEW SACRIFICE</button></form>` : ""}
    <article class="membership-reward"><h3>Published rewards</h3>${state.account && state.periods?.length ? `<label>Reward period<select id="membership-period" ${state.busy ? "disabled" : ""}>${state.periods.map(item => `<option value="${h(item.epoch)}" ${item.epoch === state.selectedEpoch ? "selected" : ""}>Period ${h(item.epoch)} · ${h(item.symbol)}</option>`).join("")}</select></label>` : ""}${reward ? reward.claim ? `<p><b>${h(formatUnits(reward.epoch.budget * BigInt(reward.claim.points) / reward.epoch.totalPoints, reward.decimals))} ${h(reward.symbol)}</b> · ${h(status)}</p><p>This period uses ${h(reward.claim.points)} snapshot points. Later transfers or ascensions do not change it.</p><p>Reward token: <code>${h(reward.manifest.domain.token)}</code></p><p>Available: ${h(new Date(Number(reward.epoch.availableAt)*1000).toLocaleString())}</p><p data-review-countdown></p><button id="membership-claim" ${state.busy || status !== "CLAIMABLE" ? "disabled" : ""}>${status === "CLAIMED" ? "REWARD CLAIMED" : "CLAIM TEST REWARD"}</button>` : `<p>No allocation for this wallet in period ${h(state.selectedEpoch)}.</p>` : state.account ? "<p>No verified reward period loaded.</p>" : "<p>Connect to read verified rewards.</p>"}</article>`;
  container.querySelector("#membership-connect").onclick = () => run(connect);
  container.querySelectorAll("[data-ascend]").forEach(button => button.onclick = () => run(() => ascend(button.dataset.ascend)));
  container.querySelector("#membership-sacrifice")?.addEventListener("submit", event => { event.preventDefault(); const data = new FormData(event.currentTarget); run(() => sacrifice(data.get("survivor"), data.getAll("burn"))); });
  container.querySelector("#membership-period")?.addEventListener("change", event => {
    const epoch = event.target.value;
    run(async () => { state.selectedEpoch = epoch; state.reward = null; generation++; paint(); await reload(); });
  });
  const claimButton = container.querySelector("#membership-claim"); if (claimButton) claimButton.onclick = () => run(claim);
  tick();
}
function tick() {
  const output = document.querySelector("[data-review-countdown]");
  if (!output || !state.reward) return;
  const seconds = Math.max(0, Number(state.reward.epoch.availableAt) - Math.floor(Date.now()/1000));
  output.textContent = seconds ? `Review ends in ${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s` : "Review period complete.";
  const button = document.querySelector("#membership-claim");
  if (button) button.disabled = state.busy || state.reward.claimed || state.reward.paused || seconds > 0;
}
setInterval(tick, 1000);
export function mountMembershipRoom() { paint(); }
