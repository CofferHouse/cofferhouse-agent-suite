const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN;

export function durableStoreConfigured() {
  return configuredHttpsEndpoint(redisUrl()) && configuredSecret(redisToken());
}

async function command(parts) {
  if (!durableStoreConfigured()) throw new Error("Durable store is not configured.");
  const response = await fetch(redisUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(parts)
  });
  if (!response.ok) throw new Error(`Durable store request failed (${response.status}).`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

export async function setJsonIfAbsent(key, value, ttlSeconds = 90) {
  const result = await command(["SET", key, JSON.stringify(value), "NX", "EX", String(ttlSeconds)]);
  return result === "OK";
}

export async function deleteJsonIfValue(key, value) {
  const expected = JSON.stringify(value);
  const script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
  return Number(await command(["EVAL", script, "1", key, expected])) === 1;
}

export async function getJson(key) {
  const value = await command(["GET", key]);
  return value ? JSON.parse(value) : null;
}

export async function setJson(key, value) {
  await command(["SET", key, JSON.stringify(value)]);
}

export async function setJsonWithTtl(key, value, ttlSeconds) {
  await command(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
}

export async function deleteJson(...keys) {
  if (!keys.length) return;
  await command(["DEL", ...keys]);
}

export async function pushJson(key, value, limit = 50) {
  await command(["LPUSH", key, JSON.stringify(value)]);
  await command(["LTRIM", key, "0", String(limit - 1)]);
}

export async function listJson(key, limit = 10) {
  const values = await command(["LRANGE", key, "0", String(limit - 1)]);
  return (values ?? []).map((value) => JSON.parse(value));
}

export async function addSetMember(key, ...members) {
  if (!members.length) return 0;
  return Number(await command(["SADD", key, ...members.map(String)]));
}

export async function removeSetMember(key, ...members) {
  if (!members.length) return 0;
  return Number(await command(["SREM", key, ...members.map(String)]));
}

export async function setMembers(key, limit = 500) {
  const members = await command(["SMEMBERS", key]);
  return (members ?? []).slice(0, limit);
}
import { configuredHttpsEndpoint, configuredSecret } from "../packages/agent-core/index.js";

// Atomic JSON CAS. A null expected value means the key must not exist.
export async function compareAndSetJson(key, expected, next) {
  const script = "local current = redis.call('get', KEYS[1]); if (ARGV[1] == 'absent' and not current) or (ARGV[1] == 'present' and current == ARGV[2]) then redis.call('set', KEYS[1], ARGV[3]); return 1 else return 0 end";
  return Number(await command(['EVAL', script, '1', key, expected === null ? 'absent' : 'present', expected === null ? '' : JSON.stringify(expected), JSON.stringify(next)])) === 1;
}
