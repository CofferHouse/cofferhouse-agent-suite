export function notificationConfigured() {
  return Boolean(process.env.SCOUT_ALERT_WEBHOOK_URL);
}

export async function deliverAlert(alert) {
  if (!notificationConfigured()) return { delivered: false, reason: "webhook-not-configured" };
  const text = `${alert.title}\n${alert.message}\nPolicy: ${alert.policyVersion}\nAlert: ${alert.fingerprint}`;
  const response = await fetch(process.env.SCOUT_ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text, event: alert })
  });
  if (!response.ok) throw new Error(`Alert delivery failed (${response.status}).`);
  return { delivered: true, deliveredAt: new Date().toISOString() };
}
