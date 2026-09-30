const defaults = Object.freeze({
  house: "https://cofferhouse.cheesemachineco.chatgpt.site/",
  holderCenter: "https://cofferhouse-scout.vercel.app/#holders",
  agentSuite: "https://cofferhouse-scout.vercel.app/#agents",
  repository: "https://github.com/CofferHouse/cofferhouse-agent-suite"
});

function safePublicUrl(value, fallback) {
  try {
    const url = new URL(String(value ?? fallback));
    return url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function productLinks(environment = {}) {
  return Object.freeze({
    house: safePublicUrl(environment.VITE_HOUSE_URL, defaults.house),
    holderCenter: safePublicUrl(environment.VITE_HOLDER_CENTER_URL, defaults.holderCenter),
    agentSuite: safePublicUrl(environment.VITE_AGENT_SUITE_URL, defaults.agentSuite),
    repository: safePublicUrl(environment.VITE_REPOSITORY_URL, defaults.repository)
  });
}

export { defaults as defaultProductLinks };
