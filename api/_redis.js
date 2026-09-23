const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const redisToken = () => process.env.UPSTASH_REDIS_REST_TOKEN;

export function durableStoreConfigured() {
  return Boolean(redisUrl() && redisToken());
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

export async function getJson(key) {
  const value = await command(["GET", key]);
  return value ? JSON.parse(value) : null;
}

export async function setJson(key, value) {
  await command(["SET", key, JSON.stringify(value)]);
}

export async function pushJson(key, value, limit = 50) {
  await command(["LPUSH", key, JSON.stringify(value)]);
  await command(["LTRIM", key, "0", String(limit - 1)]);
}

export async function listJson(key, limit = 10) {
  const values = await command(["LRANGE", key, "0", String(limit - 1)]);
  return (values ?? []).map((value) => JSON.parse(value));
}
