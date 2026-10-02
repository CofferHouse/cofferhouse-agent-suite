export async function fetchOnrampReadiness(fetcher = globalThis.fetch) {
  const response = await fetcher("/api/app-kits/onramp", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Onramp readiness request failed (${response.status}).`);
  return response.json();
}

export async function requestOnrampSession({ destinationAddress, amount, operatorToken }, fetcher = globalThis.fetch) {
  const response = await fetcher("/api/app-kits/onramp", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ destinationAddress, amount })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Onramp session request failed (${response.status}).`);
  return payload;
}
