// A connected page must not retain wallet-scoped state after provider changes.
export function watchWalletSession(provider, invalidate) {
  if (typeof provider?.on !== "function") return () => {};
  const events = ["accountsChanged", "chainChanged", "disconnect"];
  let invalidated = false;
  const dispose = () => {
    invalidated = true;
    for (const event of events) provider.removeListener?.(event, changed);
  };
  const changed = () => {
    if (invalidated) return;
    invalidated = true;
    dispose();
    invalidate();
  };
  for (const event of events) provider.on(event, changed);
  return dispose;
}
