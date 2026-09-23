const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function withRetry(operation, { attempts = 3, delayMs = 400, sleep = wait } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      error.attempts = attempt;
      if (attempt >= attempts || error.retryable === false) throw error;
      await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}
