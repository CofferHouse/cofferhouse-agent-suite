import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const host = 'api.coinbase.com';
const permissionsPath = '/api/v3/brokerage/key_permissions';
const accountsPath = '/api/v3/brokerage/accounts';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const decimal = value => typeof value === 'string' && /^\d{1,32}(\.\d{1,32})?$/.test(value);

export async function readCoinbaseBalances(credentials, {fetcher = globalThis.fetch, now = Date.now} = {}) {
  const {name, privateKey} = credentials ?? {};
  if (typeof name !== 'string' || !/^organizations\/[a-z0-9-]+\/apiKeys\/[a-z0-9-]+$/i.test(name) || typeof privateKey !== 'string') throw new Error('Use a CDP API key JSON file.');
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== 'ec' || !['prime256v1', 'P-256'].includes(key.asymmetricKeyDetails?.namedCurve)) throw new Error('An ECDSA P-256 CDP key is required.');
  const signal = AbortSignal.timeout(20000);
  const get = async (path, query = '') => {
    const nbf = Math.floor(now() / 1000);
    const payload = `${encode({alg:'ES256', kid:name, nonce:randomBytes(16).toString('hex'), typ:'JWT'})}.${encode({sub:name, iss:'cdp', nbf, exp:nbf+120, uri:`GET ${host}${path}`})}`;
    const token = `${payload}.${sign('sha256', Buffer.from(payload), {key, dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
    const response = await fetcher(`https://${host}${path}${query}`, {method:'GET', redirect:'error', signal, headers:{Authorization:`Bearer ${token}`, Accept:'application/json'}});
    if (!response.ok) throw new Error(`Coinbase rejected the request (HTTP ${response.status}).`);
    return response.json();
  };
  const permissions = await get(permissionsPath);
  if (permissions?.can_view !== true || permissions.can_trade !== false || permissions.can_transfer !== false) throw new Error('Coinbase must confirm View only. Trade and Transfer must both be disabled.');
  const balances = [], cursors = new Set();
  let cursor;
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({limit:'250'});
    if (cursor) query.set('cursor',cursor);
    const result = await get(accountsPath,`?${query}`);
    if (!Array.isArray(result?.accounts) || result.accounts.length > 250 || typeof result.has_next !== 'boolean') throw new Error('Incomplete Coinbase account response.');
    for (const {currency, available_balance: available, hold} of result.accounts) {
      if (typeof currency !== 'string' || !/^[A-Z0-9]{1,20}$/.test(currency) || available?.currency !== currency || hold?.currency !== currency || !decimal(available.value) || !decimal(hold.value)) throw new Error('Incomplete Coinbase balance evidence.');
      balances.push({currency, available:available.value, onHold:hold.value});
    }
    if (!result.has_next) return {observedAt:new Date(now()).toISOString(), balances};
    cursor = result.cursor;
    if (typeof cursor !== 'string' || !cursor || cursor.length > 1024 || cursors.has(cursor)) throw new Error('Invalid Coinbase pagination.');
    cursors.add(cursor);
  }
  throw new Error('Coinbase pagination limit reached; no partial balances returned.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const filename = process.argv[2];
  if (!filename || process.argv.length !== 3) {
    console.error('Usage: node scripts/coinbase-readonly.mjs /path/to/local-key.json');
    process.exitCode = 1;
  } else {
    try {
      const credentials = JSON.parse(await readFile(filename, 'utf8'));
      console.log(JSON.stringify(await readCoinbaseBalances(credentials), null, 2));
    } catch (error) {
      const safe = /^(Coinbase (must confirm|rejected)|Incomplete Coinbase|Invalid Coinbase|An ECDSA|Use a CDP)/.test(error.message);
      console.error(safe ? error.message : 'Coinbase lookup failed. Check the local key file and network.');
      process.exitCode = 1;
    }
  }
}
